from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
import httpx
import os

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
    """현재 사용자 정보를 조회합니다. (리뷰 및 제보 내역 포함)"""
    return current_user

@router.delete("/users/me", response_model=schemas.ActionResponse)
def delete_user_me(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """회원 탈퇴: 유저 계정 및 연관된 모든 데이터(로그, 리뷰, 제보)를 안전하게 삭제합니다."""
    try:
        # 1. 객체 동기화: current_user가 현재 DB 세션에 속해 있는지 확인 및 병합
        user = db.merge(current_user)
        user_id = user.user_id

        # 2. 명시적 순차 삭제: 외래 키 제약 조건을 고려하여 자식 데이터부터 먼저 삭제
        # (SQLAlchemy의 자동 삭제 기능이 물리 DB 제약 조건과 충돌할 경우를 대비한 안전장치)
        
        # 2.1 마일리지 로그 삭제
        db.query(models.MileageLog).filter(models.MileageLog.user_id == user_id).delete(synchronize_session=False)
        
        # 2.2 리뷰 삭제
        db.query(models.Review).filter(models.Review.user_id == user_id).delete(synchronize_session=False)
        
        # 2.3 제보 삭제
        db.query(models.Report).filter(models.Report.user_id == user_id).delete(synchronize_session=False)
        
        # 3. 부모 유저 삭제
        db.delete(user)
        
        # 모든 작업이 성공하면 한꺼번에 커밋
        db.commit()
        
        print(f"✅ [Withdrawal Success]: User {user_id} and all related data removed.")
        return {"success": True, "message": "회원 탈퇴가 성공적으로 완료되었습니다."}
        
    except Exception as e:
        db.rollback()
        import traceback
        error_trace = traceback.format_exc()
        print(f"💥 [Withdrawal Error Detail]:\n{error_trace}")
        
        # 사용자에게는 친절한 메시지, 로그에는 상세 정보를 남깁니다.
        raise HTTPException(
            status_code=500, 
            detail=f"회원 탈퇴 처리 중 시스템 오류가 발생했습니다. (사유: {str(e)})"
        )

@router.post("/stations/{station_id}/reviews", response_model=schemas.RewardResponse)
def create_station_review(
    station_id: str, 
    review_in: schemas.ReviewCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """리뷰를 작성하고 마일리지를 지급합니다. 작성 당시의 충전소 정보(이름, 주소)를 영구 기록합니다."""
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    new_review = models.Review(
        station_id=station_id,
        station_name=station.station_name, # 작성 당시 이름 스냅샷
        station_address=station.address,   # 작성 당시 주소 스냅샷
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
    update_in: schemas.ReviewAdminUpdate,
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

@router.patch("/reviews/{review_id}", response_model=schemas.ActionResponse)
def update_review(
    review_id: int,
    review_in: schemas.ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """사용자가 자신의 리뷰를 수정합니다."""
    review = db.query(models.Review).filter(
        models.Review.id == review_id,
        models.Review.user_id == current_user.user_id
    ).first()
    
    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없거나 수정 권한이 없습니다.")

    if review_in.rating is not None:
        review.rating = review_in.rating
    if review_in.content is not None:
        review.content = review_in.content
    
    db.commit()
    return {"success": True, "message": "리뷰가 성공적으로 수정되었습니다."}

@router.delete("/reviews/{review_id}", response_model=schemas.ActionResponse)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """사용자가 자신의 리뷰를 삭제합니다. 물리적으로 지우지 않고 'DELETED' 상태로 변경(Soft Delete)합니다."""
    review = db.query(models.Review).filter(
        models.Review.id == review_id,
        models.Review.user_id == current_user.user_id
    ).first()

    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없거나 삭제 권한이 없습니다.")

    if review.status == 'DELETED':
        return {"success": True, "message": "이미 삭제된 리뷰입니다."}

    # 마일리지 회수 (Abuse 방지)
    penalty_amount = 100
    current_user.mileage_balance -= penalty_amount
    
    new_log = models.MileageLog(
        user_id=current_user.user_id,
        description=f"리뷰 삭제로 인한 포인트 회수",
        amount=-penalty_amount
    )
    db.add(new_log)
    
    # 물리 삭제 대신 상태만 변경
    review.status = 'DELETED'
    db.commit()

    return {"success": True, "message": f"리뷰가 삭제 처리되었으며 {penalty_amount}P가 회수되었습니다."}

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

@router.get("/directions", response_model=schemas.DirectionResponse)
async def get_directions(origin: str, destination: str):
    """
    카카오 모빌리티 API를 프록시하여 길찾기 경로를 가져옵니다.
    origin, destination: "longitude,latitude" 형식의 문자열
    """
    rest_api_key = os.getenv("KAKAO_REST_API_KEY")
    if not rest_api_key:
        raise HTTPException(status_code=500, detail="Kakao API key not configured")

    url = "https://apis-navi.kakaomobility.com/v1/directions"
    headers = {"Authorization": f"KakaoAK {rest_api_key}"}
    params = {
        "origin": origin,
        "destination": destination,
        "summary": "false" # 상세 경로(vertexes)를 가져오기 위해 false로 설정
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, params=params)
            data = response.json()
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            print(f"💥 [Kakao API HTTP Error]: {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail="Kakao API call failed")
        except Exception as e:
            print(f"💥 [Directions Proxy Error]: {e}")
            raise HTTPException(status_code=500, detail="Internal server error while fetching directions")

    # Kakao API 응답 구조: data['routes'][0]['result_code'] 확인
    if not data.get("routes") or data["routes"][0].get("result_code") != 0:
        error_msg = data["routes"][0].get("result_msg") if data.get("routes") else "Routing failed"
        result_code = data["routes"][0].get("result_code") if data.get("routes") else "No data"
        print(f"❌ [Kakao Routing Failed]: {error_msg} (code: {result_code})")
        raise HTTPException(status_code=400, detail=error_msg)

    # vertexes(경로 좌표) 추출 및 변환
    path = []
    route = data["routes"][0]
    for section in route["sections"]:
        for road in section["roads"]:
            # vertexes는 [x1, y1, x2, y2, ...] 형태임
            v = road["vertexes"]
            for i in range(0, len(v), 2):
                path.append([v[i], v[i+1]])

    return {
        "success": True,
        "path": path,
        "summary": {
            "distance": route["summary"]["distance"],
            "duration": route["summary"]["duration"],
            "origin": route["summary"]["origin"],
            "destination": route["summary"]["destination"]
        }
    }
