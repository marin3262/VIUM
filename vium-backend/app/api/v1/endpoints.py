from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import uuid

from ...db.session import get_db
from ...models import models
from ...schemas import schemas

router = APIRouter()

@router.get("/stations", response_model=List[schemas.Station])
def read_stations(db: Session = Depends(get_db)):
    """전체 충전소 목록을 조회합니다."""
    return db.query(models.Station).all()

@router.get("/users/me", response_model=schemas.UserProfile)
def read_user_me(db: Session = Depends(get_db)):
    """현재 접속 중인 사용자 정보를 조회합니다."""
    user = db.query(models.User).filter(models.User.id == "user-001").first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post("/stations/{station_id}/reviews", response_model=schemas.RewardResponse)
def create_station_review(
    station_id: str, 
    review_in: schemas.ReviewCreate, 
    db: Session = Depends(get_db)
):
    """리뷰를 작성하고 100P 보상을 지급하며 리뷰 정보를 반환합니다."""
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    user = db.query(models.User).filter(models.User.id == "user-001").first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1. 리뷰 데이터 생성 및 저장
    new_review = models.Review(
        id=f"rev-{uuid.uuid4().hex[:8]}",
        station_id=station_id,
        user_id=user.id,
        user_name=user.name,
        rating=review_in.rating,
        content=review_in.content,
        date=datetime.utcnow()
    )
    db.add(new_review)

    # 2. 마일리지 보상 적립 (100P)
    reward_amount = 100
    user.points += reward_amount
    
    activity = {
        "id": f"act-{uuid.uuid4().hex[:8]}",
        "type": f"리뷰 작성 보상: {station.name}",
        "date": datetime.now().strftime("%Y.%m.%d"),
        "amount": f"+{reward_amount:,} P"
    }
    
    if not user.recentActivity:
        user.recentActivity = [activity]
    else:
        user.recentActivity = [activity] + list(user.recentActivity)

    db.commit()
    db.refresh(user)
    db.refresh(new_review)

    return {
        "success": True,
        "points_added": reward_amount,
        "total_points": user.points,
        "message": "리뷰가 등록되었으며 100P가 적립되었습니다.",
        "review": new_review
    }

@router.post("/reports", response_model=schemas.ActionResponse)
def create_report(
    report_in: schemas.ReportCreate,
    db: Session = Depends(get_db)
):
    """충전소 고장/상태 정보를 제보합니다."""
    station = db.query(models.Station).filter(models.Station.id == report_in.stationId).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    user = db.query(models.User).filter(models.User.id == "user-001").first()
    
    new_report = models.Report(
        id=f"rep-{uuid.uuid4().hex[:8]}",
        stationId=report_in.stationId,
        userId=user.id if user else "user-001",
        issueType=report_in.issueType,
        content=report_in.content,
        status="PENDING",
        timestamp=datetime.utcnow()
    )
    db.add(new_report)
    db.commit()

    return {
        "success": True,
        "message": "제보가 성공적으로 접수되었습니다. 관리자 확인 후 보상이 지급됩니다.",
        "data": {"reportId": new_report.id}
    }

@router.get("/reports", response_model=List[schemas.Report])
def read_reports(db: Session = Depends(get_db)):
    """모든 제보 내역을 조회합니다 (관리자용)."""
    return db.query(models.Report).order_by(models.Report.timestamp.desc()).all()

@router.patch("/reports/{report_id}", response_model=schemas.ActionResponse)
def update_report_status(
    report_id: str,
    update_in: schemas.ReportUpdate,
    db: Session = Depends(get_db)
):
    """제보를 승인하거나 반려합니다. 승인 시 상세 정보를 포함한 보상을 지급합니다."""
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != "PENDING":
        raise HTTPException(status_code=400, detail="Report is already processed")

    report.status = update_in.status

    if update_in.status == "APPROVED":
        # 1. 제보와 연결된 충전소 정보를 가져와 이름을 확보함
        station = db.query(models.Station).filter(models.Station.id == report.stationId).first()
        station_name = station.name if station else "알 수 없는 충전소"

        # 2. 제보자에게 상세 보상 포인트 지급 (500P)
        user = db.query(models.User).filter(models.User.id == report.userId).first()
        if user:
            reward_amount = 500
            user.points += reward_amount
            # [디테일 개선] 활동 로그에 충전소 이름을 포함함
            activity = {
                "id": f"act-{uuid.uuid4().hex[:8]}",
                "type": f"고장 제보 보상: {station_name}",
                "date": datetime.now().strftime("%Y.%m.%d"),
                "amount": f"+{reward_amount:,} P"
            }
            user.recentActivity = [activity] + list(user.recentActivity or [])

        # 3. 충전소를 '점검 중'으로 자동 변경
        if report.issueType in ["ConnectorBroken", "ScreenOff", "PaymentError"] and station:
            station.status = "Faulty"

    db.commit()
    return {
        "success": True, 
        "message": f"제보가 {update_in.status} 처리되었습니다."
    }
