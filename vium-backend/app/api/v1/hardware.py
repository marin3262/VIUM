from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from datetime import datetime

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
    
    # [고정밀 로그 출력]
    print("\n" + "🔌" * 25)
    print(f"📡 [IoT] CONNECTOR SIGNAL: {signal.status} | 🔋 {signal.battery}% | ⚡ {signal.voltage}V")
    print(f"📍 STATION : {station.station_name if station else 'N/A'}")
    if signal.user_id:
        print(f"👤 USER ID : {signal.user_id}")
    print("🔌" * 25 + "\n")

    # [중요: 점검 중 상태 보호 로직]
    # 관리자가 고장으로 승인한 충전기는 IoT 신호에 의해 상태가 변경되지 않도록 잠금(Lock) 처리합니다.
    if charger.status == "Faulty":
        print(f"🛡️ [Status Lock] {charger.charger_id} is in 'Faulty' state. Skipping IoT status update.")
        # 배터리 정보는 실시간 애니메이션을 위해 Redis에만 업데이트하고 종료
        if signal.status == "CONNECTED" and signal.battery is not None:
             update_station_battery(charger.station_id, signal.battery, signal.user_id)
        return {"success": True, "message": "Charger is under maintenance. Status update ignored."}

    # 1. Redis 동기화 및 지능형 알림 트리거
    if signal.status in ["CONNECTED", "CHARGING"] and signal.battery is not None:
        update_station_battery(charger.station_id, signal.battery, signal.user_id)

        # [초정밀 개선] 알림 대상 세션 식별 최적화
        query = db.query(models.ChargingSession).filter(
            models.ChargingSession.charger_id == charger.charger_id,
            models.ChargingSession.status == "PENDING"  # 충전 중인 세션만 타겟
        )
        if signal.user_id:
            query = query.filter(models.ChargingSession.user_id == signal.user_id)
        else:
            query = query.filter(models.ChargingSession.is_guest == True)

        active_session = query.order_by(models.ChargingSession.created_at.desc()).first()

        if active_session:
            user_nickname = active_session.user.nickname if active_session.user else "비회원 고객"
            target_soc = active_session.target_soc or 80
            print(f"🔍 [Notification Check] Session:{active_session.order_id[:8]} | User:{user_nickname} | Battery:{signal.battery}% | Target:{target_soc}%")

            # [단계 1: 충전 시작 알림] - 단 한 번만 발송
            if not active_session.is_start_notified:
                title = "⚡ 충전 시작"
                body = f"{user_nickname}님, {station.station_name}에서 충전이 시작되었습니다. 안전하게 충전해 드릴게요!"
                trigger_push_notification(
                    db, title, body, 
                    user_id=active_session.user_id, 
                    session_id=active_session.order_id if active_session.is_guest else None,
                    tag=f"start-{active_session.order_id}",
                    n_type="INFO"
                )
                active_session.is_start_notified = True
                db.commit()
                print(f"📢 [Start Alert] Sent to {user_nickname}")

            # [단계 3: 매너 알림 - 목표가 80%보다 클 때만 80%에서 발송]
            # 부동소수점 오차를 고려하여 79.5% 이상일 때 트리거
            if target_soc > 80 and signal.battery >= 79.5 and not active_session.is_80_notified:
                title = "🔋 배터리 80% 도달"
                body = f"{user_nickname}님, 배터리가 80%에 도달했습니다. 다음 분을 위해 출차를 준비해 주세요!"
                trigger_push_notification(
                    db, title, body, 
                    user_id=active_session.user_id, 
                    session_id=active_session.order_id if active_session.is_guest else None,
                    tag=f"80-percent-{active_session.order_id}",
                    n_type="WARNING"
                )
                active_session.is_80_notified = True
                db.commit()
                print(f"📢 [80% Alert] Sent to {user_nickname}")

            # [단계 4: 충전 완료 알림 - 사용자가 설정한 목표치(target_soc) 도달 시]
            # 사용자가 설정한 개별 목표치 도달을 정확히 감지
            if signal.battery >= (target_soc - 0.5) and not active_session.is_completed_notified:
                title = f"✅ 목표 충전({target_soc}%) 도달"
                body = f"{user_nickname}님, 설정하신 {target_soc}% 충전이 완료되었습니다. 결제 후 안전하게 출차해 주세요."
                trigger_push_notification(
                    db, title, body, 
                    user_id=active_session.user_id, 
                    session_id=active_session.order_id if active_session.is_guest else None,
                    tag=f"done-{active_session.order_id}",
                    n_type="SUCCESS"
                )
                active_session.is_completed_notified = True
                db.commit()
                print(f"📢 [Completion Alert] Sent to {user_nickname} (Target: {target_soc}%)")

    # 2. 상태 전이 로직
    old_status = charger.status
    new_status = old_status

    if signal.status == "CHARGING":
        new_status = "Charging"
        # [지능형 유저/세션 매핑]: 하드웨어에서 정보가 안 오더라도, 현재 이 충전기를 쓰려는 세션을 찾아 매핑
        if not signal.user_id:
            active_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PENDING"
            ).order_by(models.ChargingSession.created_at.desc()).first()
            
            if active_session:
                charger.active_user_id = active_session.user_id
                charger.active_session_id = active_session.order_id
                print(f"🔗 [Auto Mapping] Charger {charger.charger_id} -> User:{active_session.user_id}, Session:{active_session.order_id[:8]}")
        else:
            charger.active_user_id = signal.user_id
            # user_id가 있다면 해당 유저의 최신 세션 ID도 찾아 매핑
            active_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.user_id == signal.user_id,
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PENDING"
            ).order_by(models.ChargingSession.created_at.desc()).first()
            if active_session:
                charger.active_session_id = active_session.order_id
            
    elif signal.status == "CONNECTED":
        # 단순히 켜진 상태(CONNECTED)는 Charging 상태로 만들지 않고, 
        # 이전 상태가 Charging이었다면(충전기 분리 시) Occupied로 전이
        if old_status == "Charging":
            new_status = "Occupied"
        else:
            # 점유 중이거나 사용 가능 상태라면 상태 유지 (보통 RPi가 Occupied로 만듦)
            pass
                
    elif signal.status == "DISCONNECTED":
        new_status = "Occupied"
        if old_status == "Charging":
            # [단계 5: 커넥터 해제 알림] - 결제 전(PENDING) 해제 시에도 알림이 가도록 수정
            query = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status.in_(["PENDING", "PAID"])
            )
            if signal.user_id:
                query = query.filter(models.ChargingSession.user_id == signal.user_id)
            
            active_session = query.order_by(models.ChargingSession.created_at.desc()).first()
            
            if active_session:
                user_nickname = active_session.user.nickname if active_session.user else "고객"
                title = "🔌 커넥터 분리 확인"
                body = f"{user_nickname}님, 커넥터가 안전하게 분리되었습니다. 이제 출차해 주세요."
                trigger_push_notification(
                    db, title, body, 
                    user_id=active_session.user_id, 
                    session_id=active_session.order_id if active_session.is_guest else None,
                    tag=f"disconnect-{active_session.order_id}",
                    n_type="INFO"
                )
                print(f"📢 [Disconnect Alert] Sent to {user_nickname}")
    
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

    # [고정밀 로그 출력 복구]
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
        
        # [단계 6: 최종 출차 알림]
        if new_status == "Available":
            last_session = db.query(models.ChargingSession).filter(
                models.ChargingSession.charger_id == charger.charger_id,
                models.ChargingSession.status == "PAID"
            ).order_by(models.ChargingSession.paid_at.desc()).first()
            
            if last_session:
                user_nickname = last_session.user.nickname if last_session.user else "고객"
                title = "🚗 출차 확인 완료"
                body = f"{user_nickname}님, 안전하게 출차되었습니다. 오늘도 즐거운 드라이빙 되세요!"
                trigger_push_notification(
                    db, title, body, 
                    user_id=last_session.user_id, 
                    session_id=last_session.order_id if last_session.is_guest else None,
                    tag=f"exit-{last_session.order_id}",
                    n_type="SUCCESS"
                )
                print(f"📢 [Exit Alert] Sent to {user_nickname}")
            
            charger.active_user_id = None
            charger.active_session_id = None

        db.commit()
        update_redis_slots(charger.station_id, db)
        print(f"🚀 [Auto-Transition] {charger.charger_id}: {old_status} -> {new_status}")
        
    return {"success": True, "message": "Camera signal processed."}
