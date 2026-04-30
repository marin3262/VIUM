from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging
from datetime import datetime

from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ...db.redis_client import update_station_slots

router = APIRouter()
logger = logging.getLogger(__name__)

def update_redis_slots(station_id: str, db: Session):
    """
    DB에서 해당 충전소의 사용 가능한 충전기(Available) 수를 계산하여 Redis에 업데이트합니다.
    이 작업은 웹 화면의 잔여석 숫자를 실시간으로 변경하는 트리거가 됩니다.
    """
    try:
        available_count = db.query(models.Charger).filter(
            models.Charger.station_id == station_id,
            models.Charger.status == "Available"
        ).count()
        update_station_slots(station_id, available_count)
        logger.info(f"Redis updated for station {station_id}: {available_count} slots available")
    except Exception as e:
        logger.error(f"Failed to update Redis slots for station {station_id}: {e}")

@router.post("/connectors", response_model=schemas.ActionResponse)
def receive_connector_signal(signal: schemas.ConnectorSignal, db: Session = Depends(get_db)):
    """
    아두이노(ESP32)로부터 충전 커넥터 상태를 수신합니다.
    """
    # [시니어 아키텍트 로그 추가]
    print("\n" + "🔌" * 20)
    print(f"🚨 [IoT] CONNECTOR SIGNAL RECEIVED: {datetime.now().strftime('%H:%M:%S')}")
    print(f"📍 ID: {signal.charger_id} | Status: {signal.status}")
    print("🔌" * 20 + "\n")

    charger = db.query(models.Charger).filter(models.Charger.charger_id == signal.charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail=f"Charger {signal.charger_id} not found")

    # 상태 전이 (단순 매핑)
    old_status = charger.status
    new_status = "Occupied" if signal.status == "CONNECTED" else "Available"
    
    if old_status != new_status:
        charger.status = new_status
        db.commit()
        update_redis_slots(charger.station_id, db)
        return {
            "success": True, 
            "message": f"Charger {signal.charger_id} status changed: {old_status} -> {new_status}"
        }

    return {"success": True, "message": "No status change required (Same as current)"}

@router.post("/cameras", response_model=schemas.ActionResponse)
def receive_camera_signal(signal: schemas.CameraSignal, db: Session = Depends(get_db)):
    """
    라즈베리파이(OpenCV)로부터 차량 점유 감지 신호를 수신합니다.
    """
    # [시니어 아키텍트 로그 추가]
    print("\n" + "📸" * 20)
    print(f"🚨 [IoT] CAMERA SIGNAL RECEIVED: {datetime.now().strftime('%H:%M:%S')}")
    print(f"📍 ID: {signal.parking_space_id} | Present: {signal.vehicle_present} | Conf: {signal.confidence_score}")
    print("📸" * 20 + "\n")

    # parking_space_id를 DB의 charger_id와 동일하게 취급하여 조회
    charger = db.query(models.Charger).filter(models.Charger.charger_id == signal.parking_space_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail=f"Charger/Parking Space {signal.parking_space_id} not found")

    # [핵심 로직] 차량이 없고(false), 인식 신뢰도가 70% 이상일 때만 출차로 인정
    if not signal.vehicle_present and signal.confidence_score >= 0.7:
        if charger.status != "Available":
            old_status = charger.status
            charger.status = "Available"
            db.commit()
            update_redis_slots(charger.station_id, db)
            
            logger.info(f"Vehicle departure confirmed via Camera for {charger.charger_id}")
            return {
                "success": True, 
                "message": f"Vehicle departure confirmed. Status: {old_status} -> Available"
            }
        else:
            return {"success": True, "message": "Already Available state."}
    
    # 차량이 여전히 있거나 신뢰도가 낮은 경우
    return {
        "success": True, 
        "message": f"Signal received (Present: {signal.vehicle_present}, Conf: {signal.confidence_score}). No status change."
    }
