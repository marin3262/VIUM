from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid

from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ...db.redis_client import get_station_slots, update_station_slots, get_station_battery
from ...utils.image_handler import save_compressed_image
from ...utils.redis_sync import update_redis_slots
from ..deps import get_current_user, get_current_admin_user

router = APIRouter()

@router.get("/stations", response_model=List[schemas.Station])
def read_stations(db: Session = Depends(get_db)):
    """전체 충전소 목록을 조회합니다."""
    stations = db.query(models.Station).all()
    
    # 보안 및 무결성: 숨겨진(HIDDEN) 리뷰는 일반 사용자에게 노출하지 않습니다.
    # Pydantic 모델로 변환 후 필터링하여 DB 세션에 영향을 주지 않도록 처리합니다.
    results = []
    for s in stations:
        # Pydantic v2 표준 변환 함수인 model_validate를 사용합니다.
        station_dto = schemas.Station.model_validate(s)
        station_dto.reviews = [r for r in station_dto.reviews if r.status == "VISIBLE"]
        
        # Redis에서 실시간 배터리 정보 가져오기
        station_dto.current_battery = get_station_battery(s.station_id)
        
        results.append(station_dto)
        
    return results

@router.get("/users/me", response_model=schemas.UserProfile)
def read_user_me(current_user: models.User = Depends(get_current_user)):
    """현재 사용자 정보를 조회합니다."""
    return current_user

@router.post("/stations/{station_id}/reviews", response_model=schemas.RewardResponse)
def create_station_review(
    station_id: str, 
    review_in: schemas.ReviewCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """리뷰를 작성하고 마일리지를 지급합니다."""
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    new_review = models.Review(
        station_id=station_id,
        user_id=current_user.user_id,
        user_name=current_user.nickname,
        rating=review_in.rating,
        content=review_in.content,
        status="VISIBLE"
    )
    db.add(new_review)

    reward_amount = 100
    current_user.mileage_balance += reward_amount
    
    new_log = models.MileageLog(
        user_id=current_user.user_id,
        description=f"리뷰 작성 보상: {station.station_name}",
        amount=reward_amount
    )
    db.add(new_log)

    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "points_added": reward_amount,
        "total_balance": current_user.mileage_balance,
        "message": "리뷰 등록 및 보상 지급 완료"
    }

@router.get("/admin/reviews", response_model=List[schemas.Review])
def read_all_reviews(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """관리자용: 모든 리뷰(숨김 포함)를 최신순으로 조회합니다."""
    return db.query(models.Review).order_by(models.Review.created_at.desc()).all()

@router.patch("/admin/reviews/{review_id}/status", response_model=schemas.ActionResponse)
def update_review_status(
    review_id: int,
    update_in: schemas.ReviewUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """관리자가 리뷰를 숨김/복구 처리합니다. 상태 변경 시 유저 신뢰도를 연동하여 조정합니다."""
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    old_status = review.status
    new_status = update_in.status
    
    if old_status == new_status:
        return {"success": True, "message": "상태가 동일합니다."}

    review.status = new_status
    user = db.query(models.User).filter(models.User.user_id == review.user_id).first()

    if user:
        if new_status == 'HIDDEN':
            user.trust_score -= 10
        elif new_status == 'VISIBLE' and old_status == 'HIDDEN':
            user.trust_score += 10
            if user.trust_score > 100: user.trust_score = 100

    db.commit()
    return {"success": True, "message": f"리뷰가 {new_status} 상태로 변경되었습니다."}

@router.post("/reports", response_model=schemas.ActionResponse)
async def create_report(
    charger_id: str = Form(...),
    keyword: str = Form(...),
    content: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """고장 제보를 접수합니다."""
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    
    if not charger:
        raise HTTPException(
            status_code=404, 
            detail=f"해당 충전기({charger_id}) 정보를 찾을 수 없습니다."
        )

    image_url = None
    if image:
        try:
            content_bytes = await image.read()
            image_url = save_compressed_image(content_bytes, image.filename)
        except Exception as e:
            print(f"이미지 저장 오류: {e}")

    new_report = models.Report(
        user_id=current_user.user_id,
        charger_id=charger_id,
        keyword=keyword,
        content=content,
        image_url=image_url,
        status="PENDING"
    )
    db.add(new_report)
    db.commit()

    return {
        "success": True,
        "message": "제보가 성공적으로 접수되었습니다.",
        "data": {"report_id": new_report.report_id, "image_url": image_url}
    }

@router.get("/reports", response_model=List[schemas.Report])
def read_reports(
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """관리자용: 모든 제보를 조회합니다."""
    return db.query(models.Report).order_by(models.Report.created_at.desc()).all()

@router.patch("/reports/{report_id}", response_model=schemas.ActionResponse)
def update_report_status(
    report_id: int,
    update_in: schemas.ReportUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """관리자용: 제보 승인/반려 처리"""
    report = db.query(models.Report).filter(models.Report.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = update_in.status
    user = db.query(models.User).filter(models.User.user_id == report.user_id).first()

    if update_in.status == "APPROVED" and user:
        reward_amount = 500
        user.mileage_balance += reward_amount
        user.trust_score += 5 
        if user.trust_score > 100: user.trust_score = 100

        new_log = models.MileageLog(
            user_id=user.user_id,
            description=f"고장 제보 승인 보상",
            amount=reward_amount
        )
        db.add(new_log)
        
        charger = db.query(models.Charger).filter(models.Charger.charger_id == report.charger_id).first()
        if charger:
            charger.status = "Faulty"
            # Redis 동기화 (충전기 상태가 수동으로 변경되었으므로 잔여석 정보 업데이트)
            update_redis_slots(charger.station_id, db)
            
    elif update_in.status == "REJECTED" and user:
        user.trust_score -= 5

    db.commit()
    return {"success": True, "message": f"제보가 {update_in.status} 처리되었습니다."}

@router.patch("/chargers/{charger_id}/status", response_model=schemas.ActionResponse)
def update_charger_status(
    charger_id: str,
    update_in: schemas.ChargerStatusUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_current_admin_user)
):
    """관리자용: 충전기 상태 강제 변경 (JSON Body 수신)"""
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")

    charger.status = update_in.status
    db.commit()
    
    # Redis 동기화: 점검 완료 등으로 상태가 변하면 실시간 잔여석 통계를 다시 계산합니다.
    update_redis_slots(charger.station_id, db)
    
    return {"success": True, "message": f"충전기 {charger_id} 상태가 {update_in.status}로 변경되었습니다."}

@router.post("/stations/{station_id}/complete-charging", response_model=schemas.RewardResponse)
def complete_charging(
    station_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()

    reward_amount = 200
    current_user.mileage_balance += reward_amount
    if current_user.trust_score < 100:
        current_user.trust_score += 2
        if current_user.trust_score > 100: current_user.trust_score = 100
    
    new_log = models.MileageLog(
        user_id=current_user.user_id,
        description=f"충전 완료 보상: {station.station_name if station else '알 수 없는 충전소'}",
        amount=reward_amount
    )
    db.add(new_log)
    db.commit()
    db.refresh(current_user)

    return {
        "success": True,
        "points_added": reward_amount,
        "total_balance": current_user.mileage_balance,
        "message": "충전 완료 및 신뢰도 회복 완료"
    }
