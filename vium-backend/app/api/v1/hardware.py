from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging
from datetime import datetime

from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ...utils.redis_sync import update_redis_slots
from ...db.redis_client import update_station_battery

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/connectors", response_model=schemas.ActionResponse)
def receive_connector_signal(signal: schemas.ConnectorSignal, db: Session = Depends(get_db)):
    """
    아두이노(ESP32)로부터 충전 커넥터 상태와 배터리 정보를 수신합니다.
    """
    charger = db.query(models.Charger).filter(models.Charger.charger_id == signal.charger_id).first()
    if not charger:
        print(f"❌ [IoT Error] Charger ID {signal.charger_id} not found in database.")
        raise HTTPException(status_code=404, detail=f"Charger {signal.charger_id} not found")

    station = charger.station
    
    # [시니어 아키텍트 고정밀 로그]
    print("\n" + "🔌" * 25)
    print(f"📡 [IoT] CONNECTOR SENSOR SIGNAL")
    print(f"⏰ TIME    : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📍 STATION : {station.station_name if station else 'N/A'} ({charger.station_id})")
    print(f"🔌 CHARGER : {charger.charger_id} ({charger.charger_type})")
    print(f"📝 SIGNAL  : {signal.status} | 🔋 BATTERY: {signal.battery}% | ⚡ V: {signal.voltage}")
    print("🔌" * 25 + "\n")

    # 1. Redis에 실시간 배터리 정보 기록 (웹 UI용)
    if signal.status == "CONNECTED" and signal.battery is not None:
        update_station_battery(charger.station_id, signal.battery)

    # 2. 상태 전이 로직 적용
    old_status = charger.status
    new_status = old_status

    if signal.status == "CONNECTED":
        new_status = "Charging"
    elif signal.status == "DISCONNECTED":
        new_status = "Occupied"
    
    if old_status != new_status:
        charger.status = new_status
        db.commit()
        # Redis 동기화 (잔여석 수)
        update_redis_slots(charger.station_id, db)
        
        print(f"✅ [Status Change] {charger.charger_id}: {old_status} -> {new_status}")
        return {
            "success": True, 
            "message": f"Charger status changed to {new_status} with battery {signal.battery}%"
        }

    return {"success": True, "message": "Battery info updated."}

@router.post("/cameras", response_model=schemas.ActionResponse)
def receive_camera_signal(signal: schemas.CameraSignal, db: Session = Depends(get_db)):
    """
    라즈베리파이(OpenCV)로부터 차량 점유 감지 신호를 수신합니다.
    [상태 전이 로직 고도화]
    - Vehicle Present (True) -> 'Occupied' (입차 감지)
    - Vehicle Present (False) -> 'Available' (출차 확인)
    """
    # [시니어 아키텍트 고정밀 로그]
    print("\n" + "📸" * 25)
    print(f"📡 [IoT] VISION MONITORING SIGNAL")
    print(f"⏰ TIME    : {datetime.now().strftime('%H:%M:%S')}")
    print(f"📍 ID      : {signal.parking_space_id}")
    print(f"🚘 PRESENT : {signal.vehicle_present}")
    print(f"🔍 CONF    : {signal.confidence_score}")
    print("📸" * 25 + "\n")

    charger = db.query(models.Charger).filter(models.Charger.charger_id == signal.parking_space_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail=f"Charger/Parking Space {signal.parking_space_id} not found")

    old_status = charger.status
    new_status = old_status

    # 1. 입차 감지 (차량이 있고 신뢰도가 높을 때)
    # [고정밀 튜닝] 라즈베리파이의 CONFIDENCE_THRESHOLD(0.7)와 일치시킵니다.
    if signal.vehicle_present and signal.confidence_score >= 0.7:
        # 비어있는 상태일 때만 '점유중'으로 변경 (충전중인 상태는 유지)
        if old_status == "Available":
            new_status = "Occupied"

    # 2. 출차 감지 (차량이 없고 신뢰도가 높을 때)
    elif not signal.vehicle_present and signal.confidence_score >= 0.7:
        # 어떤 상태였든 차량이 사라지면 '이용가능'으로 변경
        new_status = "Available"

    if old_status != new_status:
        charger.status = new_status
        db.commit()
        update_redis_slots(charger.station_id, db)
        
        print(f"🚀 [Auto-Transition] {charger.charger_id}: {old_status} -> {new_status}")
        return {
            "success": True, 
            "message": f"Status updated via Vision: {old_status} -> {new_status}"
        }
    
    return {
        "success": True, 
        "message": f"Signal received, no transition needed (Current: {old_status})"
    }
