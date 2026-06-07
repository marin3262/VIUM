from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from datetime import datetime, timedelta

from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ...utils.redis_sync import update_redis_slots
from ...db.redis_client import update_station_battery
from ...utils.push_handler import trigger_push_notification

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/connectors", response_model=schemas.ActionResponse)
def receive_connector_signal(signal: schemas.ConnectorSignal, db: Session = Depends(get_db)):
    """아두이노(ESP32)로부터 충전 커넥터 상태와 배터리 정보를 수신합니다."""
    charger = db.query(models.Charger).filter(models.Charger.charger_id == signal.charger_id).first()
    if not charger:
        print(f"❌ [IoT Error] Charger ID {signal.charger_id} not found.")
        raise HTTPException(status_code=404, detail="Charger not found")

    station = charger.station
    
    # [100% 복구] 고정밀 로그 출력 - 시연 가시성 확보
    print("\n" + "🔌" * 25)
    print(f"📡 [IoT] CONNECTOR SIGNAL: {signal.status} | 🔋 {signal.battery}% | ⚡ {signal.voltage}V")
    print(f"📍 STATION : {station.station_name if station else 'N/A'}")
    if signal.user_id:
        print(f"👤 USER ID : {signal.user_id}")
    print("🔌" * 25 + "\n")

    # [100% 복구] 점검 중 상태 보호 로직 로그
    if charger.status == "Faulty":
        print(f"🛡️ [Status Lock] {charger.charger_id} is in 'Faulty' state. Skipping IoT status update.")
        if signal.status in ["CONNECTED", "CHARGING"] and signal.battery is not None:
             update_station_battery(charger.station_id, signal.battery, signal.user_id)
        return {"success": True, "message": "Charger is under maintenance. Status update ignored."}

    # 1. Redis 동기화 및 지능형 알림 트리거
    if signal.status in ["CONNECTED", "CHARGING"] and signal.battery is not None:
        update_station_battery(charger.station_id, signal.battery, signal.user_id)

        query = db.query(models.ChargingSession).filter(
            models.ChargingSession.charger_id == charger.charger_id,
            models.ChargingSession.status == "PENDING"
        )
        if signal.user_id:
            query = query.filter(models.ChargingSession.user_id == signal.user_id)
        else:
            query = query.filter(models.ChargingSession.is_guest == True)

        active_session = query.order_by(models.ChargingSession.created_at.desc()).first()

        if active_session:
            user_nickname = active_session.user.nickname if active_session.user else "비회원 고객"
            target_soc = active_session.target_soc or 80
            
            # 디버깅 로그 복구
            print(f"🔍 [Notification Check] Session:{active_session.order_id[:8]} | User:{user_nickname} | Battery:{signal.battery}% | Target:{target_soc}%")

            # [원본 문구 복구] 충전 시작 알림
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

            # [원본 문구 복구] 목표 도달 알림
            if signal.battery >= (target_soc - 0.5) and not active_session.is_completed_notified:
                title = f"✅ 목표 충전({target_soc}%) 도달"
                body = f"{user_nickname}님, 설정하신 {target_soc}% 충전이 완료되었습니다. 결제 후 안전하게 출차해 주세요."
                trigger_push_notification(db, title, body, user_id=active_session.user_id, session_id=active_session.order_id if active_session.is_guest else None, tag=f"done-{active_session.order_id}", n_type="SUCCESS")
                active_session.is_completed_notified = True
                db.commit()

    # 2. 상태 전이 로직
    old_status = charger.status
    new_status = old_status

    if signal.status == "CHARGING":
        new_status = "Charging"
        # [지능형 가드] 최근 10분 이내에 생성된 PENDING 세션만 매핑하여 유령 충전 방지
        ten_minutes_ago = datetime.now() - timedelta(minutes=10)
        if not signal.user_id:
            active_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PENDING",
                models.ChargingSession.created_at >= ten_minutes_ago
            ).order_by(models.ChargingSession.created_at.desc()).first()
            if active_session:
                charger.active_user_id = active_session.user_id
                charger.active_session_id = active_session.order_id
                print(f"🔗 [Auto Mapping] Charger {charger.charger_id} -> User:{active_session.user_id}")
        else:
            charger.active_user_id = signal.user_id
            active_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.user_id == signal.user_id,
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PENDING",
                models.ChargingSession.created_at >= ten_minutes_ago
            ).order_by(models.ChargingSession.created_at.desc()).first()
            if active_session:
                charger.active_session_id = active_session.order_id
            
    elif signal.status == "CONNECTED":
        if old_status == "Charging":
            new_status = "Occupied"
                
    elif signal.status == "DISCONNECTED":
        new_status = "Occupied"
        if old_status == "Charging":
            # [단계 5: 커넥터 해제 알림] - 결제 전/후 상관없이 알림 발송
            query = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status.in_(["PENDING", "PAID"])
            )
            if signal.user_id: query = query.filter(models.ChargingSession.user_id == signal.user_id)
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

    # [100% 복구] 점검 중 상태 보호 로직 로그
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
