from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from datetime import datetime, timedelta

from ...db.session import get_db
from ...models import models
from ...models.models import get_kst_now
from ...schemas import schemas
from ...utils.redis_sync import update_redis_slots
from ...db.redis_client import update_station_battery
from ...utils.push_handler import trigger_push_notification
from .. import deps

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/claim", response_model=schemas.ActionResponse)
def claim_charger(
    charger_id: str, 
    db: Session = Depends(get_db), 
    current_user: Optional[models.User] = Depends(deps.get_current_user_optional)
):
    """[은밀한 트리거] 사용자가 UI에서 호기를 클릭하면 해당 충전기를 미리 점유합니다."""
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    
    # 해당 충전기에 유저 ID 선점 기록 (비회원은 9999로 기록)
    charger.active_user_id = current_user.user_id if current_user else 9999
    charger.active_session_id = None 
    
    db.commit()
    print(f"🤫 [Secret Claim] Charger {charger_id} is now locked for User {charger.active_user_id}")
    return {"success": True, "message": "Charger claimed successfully."}

@router.post("/connectors", response_model=schemas.ActionResponse)
def receive_connector_signal(signal: schemas.ConnectorSignal, db: Session = Depends(get_db)):
    """아두이노(ESP32)로부터 충전 커넥터 상태와 배터리 정보를 수신합니다."""
    charger = db.query(models.Charger).filter(models.Charger.charger_id == signal.charger_id).first()
    if not charger:
        print(f"❌ [IoT Error] Charger ID {signal.charger_id} not found.")
        raise HTTPException(status_code=404, detail="Charger not found")

    station = charger.station
    
    # [핵심 보강] 하드웨어가 유저 정보를 안 보냈을 때, 클릭 정보를 주인으로 인정
    effective_user_id = signal.user_id or charger.active_user_id
    effective_is_guest = False
    if effective_user_id == 9999: # 비회원 클릭 마킹
        effective_is_guest = True
        effective_user_id = None

    # [100% 복구] 고정밀 로그 출력 - 시연 가시성 확보
    print("\n" + "🔌" * 25)
    print(f"📡 [IoT] CONNECTOR SIGNAL: {signal.status} | 🔋 {signal.battery}% | ⚡ {signal.voltage:.2f}V")
    print(f"📍 STATION : {station.station_name if station else 'N/A'}")
    if effective_user_id:
        print(f"👤 MAPPED USER : {effective_user_id}")
    elif effective_is_guest:
        print(f"👤 MAPPED USER : GUEST")
    print("🔌" * 25 + "\n")

    # [중요: 점검 중 상태 보호 로직]
    if charger.status == "Faulty":
        print(f"🛡️ [Status Lock] {charger.charger_id} is in 'Faulty' state. Skipping IoT status update.")
        if signal.status in ["CONNECTED", "CHARGING"] and signal.battery is not None:
             update_station_battery(charger.station_id, signal.battery, effective_user_id)
        return {"success": True, "message": "Charger is under maintenance. Status update ignored."}

    # 1. Redis 동기화 및 지능형 알림 트리거
    if signal.status in ["CONNECTED", "CHARGING"] and signal.battery is not None:
        update_station_battery(charger.station_id, signal.battery, effective_user_id)

        # 알림을 보낼 대상 세션 식별 (최신 순)
        query = db.query(models.ChargingSession).filter(
            models.ChargingSession.charger_id == charger.charger_id,
            models.ChargingSession.status == "PENDING"
        )
        if effective_user_id:
            query = query.filter(models.ChargingSession.user_id == effective_user_id)
        elif effective_is_guest:
            query = query.filter(models.ChargingSession.is_guest == True)

        active_session = query.order_by(models.ChargingSession.created_at.desc()).first()

        if active_session:
            user_nickname = active_session.user.nickname if active_session.user else "비회원 고객"
            target_soc = active_session.target_soc or 80
            
            # 디버깅 로그 복구
            print(f"🔍 [Notification Check] Session:{active_session.order_id[:8]} | User:{user_nickname} | Battery:{signal.battery}% | Target:{target_soc}%")

            # 충전 시작 알림
            if not active_session.is_start_notified:
                title = "⚡ 충전 시작"
                body = f"{user_nickname}님, {station.station_name}에서 충전이 시작되었습니다. 안전하게 충전해 드릴게요!"
                trigger_push_notification(db, title, body, user_id=active_session.user_id, session_id=active_session.order_id if active_session.is_guest else None, tag=f"start-{active_session.order_id}", n_type="INFO")
                active_session.is_start_notified = True
                db.commit()

            # 매너 알림 (80%)
            if target_soc > 80 and signal.battery >= 79.5 and not active_session.is_80_notified:
                title = "🔋 배터리 80% 도달"
                body = f"{user_nickname}님, 배터리가 80%에 도달했습니다. 다음 분을 위해 출차를 준비해 주세요!"
                trigger_push_notification(db, title, body, user_id=active_session.user_id, session_id=active_session.order_id if active_session.is_guest else None, tag=f"80-percent-{active_session.order_id}", n_type="WARNING")
                active_session.is_80_notified = True
                db.commit()

            # 목표 도달 알림
            if signal.battery >= (target_soc - 0.5) and not active_session.is_completed_notified:
                title = f"✅ 목표 충전({target_soc}%) 도달"
                body = f"{user_nickname}님, 설정하신 {target_soc}% 충전이 완료되었습니다. 결제 후 안전하게 출차해 주세요."
                trigger_push_notification(db, title, body, user_id=active_session.user_id, session_id=active_session.order_id if active_session.is_guest else None, tag=f"done-{active_session.order_id}", n_type="SUCCESS")
                active_session.is_completed_notified = True
                db.commit()

    # 2. 상태 전이 및 사용자 매핑 로직 (2중 방어선)
    old_status = charger.status
    new_status = old_status

    if signal.status == "CHARGING":
        new_status = "Charging"
        
        # [🛡️ 1단계 방어선: 은밀한 클릭 선점 또는 신호 내 ID 확인]
        target_user_id = signal.user_id or charger.active_user_id
        
        if target_user_id:
            ten_minutes_ago = get_kst_now() - timedelta(minutes=10)
            # 선점된 유저의 최근 세션을 찾아 연결
            active_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.user_id == (target_user_id if target_user_id != 9999 else None),
                models.ChargingSession.is_guest == (True if target_user_id == 9999 else False),
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PENDING",
                models.ChargingSession.created_at >= ten_minutes_ago
            ).order_by(models.ChargingSession.created_at.desc()).first()
            
            if active_session:
                charger.active_user_id = target_user_id
                charger.active_session_id = active_session.order_id
                print(f"🎯 [Direct Mapping Success] Locked for User {target_user_id}")
            else:
                print(f"⚠️ [Claim Mismatch] Claimed user {target_user_id} has no active session. Trying Fallback...")
                target_user_id = None

        # [🛡️ 2단계 방어선: 기존 지능형 추리 (Fallback)]
        if not target_user_id:
            ten_minutes_ago = get_kst_now() - timedelta(minutes=10)
            active_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PENDING",
                models.ChargingSession.created_at >= ten_minutes_ago
            ).order_by(models.ChargingSession.created_at.desc()).first()
            
            if active_session:
                charger.active_user_id = active_session.user_id or 9999
                charger.active_session_id = active_session.order_id
                print(f"🔗 [Auto Mapping Fallback] Charger {charger.charger_id} -> User:{charger.active_user_id}")
            
    elif signal.status == "CONNECTED":
        if old_status == "Charging":
            new_status = "Occupied"
                
    elif signal.status == "DISCONNECTED":
        new_status = "Occupied"
        if old_status == "Charging":
            query = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status.in_(["PENDING", "PAID"])
            )
            # 알림 대상도 동일한 effective_user_id 기반으로 필터링
            if effective_user_id: query = query.filter(models.ChargingSession.user_id == effective_user_id)
            elif effective_is_guest: query = query.filter(models.ChargingSession.is_guest == True)
            
            active_session = query.order_by(models.ChargingSession.created_at.desc()).first()
            if active_session:
                user_nickname = active_session.user.nickname if active_session.user else "고객"
                title = "🔌 커넥터 분리 확인"
                body = f"{user_nickname}님, 커넥터가 안전하게 분리되었습니다. 이제 출차해 주세요."
                trigger_push_notification(db, title, body, user_id=active_session.user_id, session_id=active_session.order_id if active_session.is_guest else None, tag=f"disconnect-{active_session.order_id}", n_type="INFO")
    
    if old_status != new_status:
        charger.status = new_status
        db.commit()
        update_redis_slots(charger.station_id, db)
        print(f"✅ [Status Change] {charger.charger_id}: {old_status} -> {new_status}")

    return {"success": True, "message": "Signal processed successfully."}

@router.post("/cameras", response_model=schemas.ActionResponse)
def receive_camera_signal(signal: schemas.CameraSignal, db: Session = Depends(get_db)):
    """라즈베리파이(OpenCV)로부터 차량 점유 감지 신호를 수신합니다."""
    charger = db.query(models.Charger).filter(models.Charger.charger_id == signal.parking_space_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Parking space not found")

    # [100% 복구] 고정밀 로그 출력
    print("\n" + "📸" * 25)
    print(f"📡 [IoT] VISION MONITORING SIGNAL")
    print(f"📍 ID      : {signal.parking_space_id}")
    print(f"🚘 PRESENT : {signal.vehicle_present}")
    print(f"🔍 CONF    : {signal.confidence_score}")
    print("📸" * 25 + "\n")

    # [중요: 점검 중 상태 보호 로직]
    if charger.status == "Faulty":
        print(f"🛡️ [Vision Lock] {charger.charger_id} is in 'Faulty' state. Ignoring vision signal.")
        return {"success": True, "message": "Charger is under maintenance. Vision signal ignored."}

    old_status = charger.status
    new_status = old_status

    if signal.vehicle_present and signal.confidence_score >= 0.7:
        if old_status == "Available":
            new_status = "Occupied"
    elif not signal.vehicle_present and signal.confidence_score >= 0.7:
        new_status = "Available"

    if old_status != new_status:
        charger.status = new_status
        if new_status == "Available":
            # [격리 보호] 출차 시 모든 세션 매핑 정보 완전 삭제 (유령 충전 방지 핵심)
            last_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PAID"
            ).order_by(models.ChargingSession.paid_at.desc()).first()
            if last_session:
                user_nickname = last_session.user.nickname if last_session.user else "고객"
                title = "🚗 출차 확인 완료"
                body = f"{user_nickname}님, 안전하게 출차되었습니다. 오늘도 즐거운 드라이빙 되세요!"
                trigger_push_notification(db, title, body, user_id=last_session.user_id, session_id=last_session.order_id if last_session.is_guest else None, tag=f"exit-{last_session.order_id}", n_type="SUCCESS")
            
            charger.active_user_id = None
            charger.active_session_id = None

        db.commit()
        update_redis_slots(charger.station_id, db)
        print(f"🚀 [Auto-Transition] {charger.charger_id}: {old_status} -> {new_status}")
        
    return {"success": True, "message": "Camera signal processed."}
