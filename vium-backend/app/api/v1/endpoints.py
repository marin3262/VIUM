from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid

from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ...db.redis_client import get_station_slots, update_station_slots
from ...utils.image_handler import save_compressed_image

router = APIRouter()

@router.get("/stations", response_model=List[schemas.Station])
def read_stations(db: Session = Depends(get_db)):
    """전체 충전소 목록을 조회합니다. (HIDDEN 상태인 리뷰는 제외)"""
    stations = db.query(models.Station).all()
    for station in stations:
        station.reviews = [r for r in station.reviews if r.status == 'VISIBLE']
    return stations

@router.get("/users/me", response_model=schemas.UserProfile)
def read_user_me(db: Session = Depends(get_db)):
    """현재 사용자 정보를 조회합니다."""
    user = db.query(models.User).filter(models.User.user_id == 1).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/stations/{station_id}/reviews", response_model=schemas.RewardResponse)
def create_station_review(
    station_id: str, 
    review_in: schemas.ReviewCreate, 
    db: Session = Depends(get_db)
):
    """리뷰를 작성하고 마일리지를 지급합니다."""
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    user = db.query(models.User).filter(models.User.user_id == 1).first()
    
    new_review = models.Review(
        station_id=station_id,
        user_id=user.user_id,
        user_name=user.nickname,
        rating=review_in.rating,
        content=review_in.content,
        status="VISIBLE"
    )
    db.add(new_review)

    reward_amount = 100
    user.mileage_balance += reward_amount
    
    new_log = models.MileageLog(
        user_id=user.user_id,
        description=f"리뷰 작성 보상: {station.station_name}",
        amount=reward_amount
    )
    db.add(new_log)

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "points_added": reward_amount,
        "total_balance": user.mileage_balance,
        "message": "리뷰 등록 및 보상 지급 완료"
    }

@router.get("/admin/reviews", response_model=List[schemas.Review])
def read_all_reviews(db: Session = Depends(get_db)):
    """관리자용: 모든 리뷰(숨김 포함)를 최신순으로 조회합니다."""
    return db.query(models.Review).order_by(models.Review.created_at.desc()).all()

@router.patch("/admin/reviews/{review_id}/status", response_model=schemas.ActionResponse)
def update_review_status(
    review_id: int,
    update_in: schemas.ReviewUpdate,
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
):
    """고장 제보를 접수합니다. 실제 KEPCO 데이터 대응을 위해 Charger 존재 여부 확인 로직을 개선합니다."""
    # 중요: 실제 한전 데이터에서 CP ID는 중복될 수 있으므로 Station ID와 함께 검증하는 것이 안전하지만,
    # 현재 Report 모델 구조상 charger_id(PK)만으로 조회합니다.
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    
    # [방어 로직] 만약 Charger가 DB에 없으면 (실시간 동기화 지연 등), 임시로 생성하거나 에러를 반환합니다.
    # 여기서는 고장 제보의 중요성을 고려하여 에러 메시지를 더 상세히 보냅니다.
    if not charger:
        print(f"[Report Error] Charger not found: {charger_id}")
        raise HTTPException(
            status_code=404, 
            detail=f"해당 충전기({charger_id}) 정보를 찾을 수 없습니다. 다시 시도해 주세요."
        )

    image_url = None
    if image:
        try:
            content_bytes = await image.read()
            image_url = save_compressed_image(content_bytes, image.filename)
        except Exception as e:
            print(f"이미지 저장 오류: {e}")

    new_report = models.Report(
        user_id=1,
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
def read_reports(db: Session = Depends(get_db)):
    return db.query(models.Report).order_by(models.Report.created_at.desc()).all()

@router.patch("/reports/{report_id}", response_model=schemas.ActionResponse)
def update_report_status(
    report_id: int,
    update_in: schemas.ReportUpdate,
    db: Session = Depends(get_db)
):
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
            
    elif update_in.status == "REJECTED" and user:
        user.trust_score -= 5

    db.commit()
    return {"success": True, "message": f"제보가 {update_in.status} 처리되었습니다."}

@router.patch("/chargers/{charger_id}/status", response_model=schemas.ActionResponse)
def update_charger_status(
    charger_id: str,
    status: str,
    db: Session = Depends(get_db)
):
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")

    charger.status = status
    db.commit()
    return {"success": True, "message": f"충전기 {charger_id} 상태가 {status}로 변경되었습니다."}

@router.post("/stations/{station_id}/complete-charging", response_model=schemas.RewardResponse)
def complete_charging(
    station_id: str,
    db: Session = Depends(get_db)
):
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    user = db.query(models.User).filter(models.User.user_id == 1).first()

    reward_amount = 200
    user.mileage_balance += reward_amount
    if user.trust_score < 100:
        user.trust_score += 2
        if user.trust_score > 100: user.trust_score = 100
    
    new_log = models.MileageLog(
        user_id=user.user_id,
        description=f"충전 완료 보상: {station.station_name if station else '알 수 없는 충전소'}",
        amount=reward_amount
    )
    db.add(new_log)
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "points_added": reward_amount,
        "total_balance": user.mileage_balance,
        "message": "충전 완료 및 신뢰도 회복 완료"
    }
