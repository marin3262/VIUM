from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid
import httpx
import base64
from datetime import datetime

from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ..deps import get_current_user

router = APIRouter()

# [사용자 전용 골든 키] 토스페이먼츠 API 개별 연동 테스트 키
TOSS_SECRET_KEY = "test_sk_4yKeq5bgrpymjvLQz9QA8GX0lzW6"

@router.post("/create-session", response_model=schemas.ChargingSession)
async def create_payment_session(
    session_data: schemas.ChargingSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 주문당 하나의 세션만 생성
    order_id = str(uuid.uuid4())
    new_session = models.ChargingSession(
        user_id=current_user.user_id,
        station_id=session_data.station_id,
        charger_id=session_data.charger_id,
        total_price=session_data.total_price,
        used_mileage=session_data.used_mileage,
        final_amount=session_data.final_amount,
        order_id=order_id,
        status="PENDING"
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.post("/confirm", response_model=schemas.ActionResponse)
async def confirm_payment(
    confirm_data: schemas.ChargingSessionConfirm,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. 중복 승인 방지 및 세션 조회
    payment_session = db.query(models.ChargingSession).filter(
        models.ChargingSession.order_id == confirm_data.orderId
    ).first()

    if not payment_session:
        raise HTTPException(status_code=404, detail="결제 세션을 찾을 수 없습니다.")
        
    if payment_session.status == "PAID":
        return schemas.ActionResponse(success=True, message="이미 정산이 완료된 결제입니다.")

    # 2. 토스 서버 승인 요청
    # 공식 가이드: 시크릿 키 뒤에 콜론(:)을 붙여서 Base64 인코딩
    auth_str = f"{TOSS_SECRET_KEY}:"
    encoded_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    
    headers = {
        "Authorization": f"Basic {encoded_auth}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "paymentKey": confirm_data.paymentKey,
        "orderId": confirm_data.orderId,
        "amount": confirm_data.amount
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.tosspayments.com/v1/payments/confirm",
                json=payload,
                headers=headers,
                timeout=15.0
            )
            toss_res = response.json()
            
            if response.status_code != 200:
                # 이미 처리된 건은 에러가 아닌 성공으로 간주 (Idempotency)
                if toss_res.get("code") == "ALREADY_PROCESSED_PAYMENT":
                    pass 
                else:
                    print(f"❌ Toss API Confirm Error: {toss_res}")
                    raise HTTPException(status_code=400, detail=f"토스 승인 실패: {toss_res.get('message')}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail="토스 서버 통신 장애")

    # 3. 비즈니스 로직 (마일리지 차감 및 상태 변경)
    try:
        current_user.mileage_balance -= payment_session.used_mileage
        if payment_session.used_mileage > 0:
            db.add(models.MileageLog(
                user_id=current_user.user_id,
                amount=-payment_session.used_mileage,
                description=f"결제 할인 ({payment_session.station_id})"
            ))
        
        payment_session.status = "PAID"
        payment_session.payment_key = confirm_data.paymentKey
        payment_session.paid_at = datetime.now()
        db.commit()
        
        return schemas.ActionResponse(success=True, message="정상 처리되었습니다.")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="서버 정산 처리 오류")
