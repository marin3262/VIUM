from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
import uuid
import httpx
import base64
from datetime import datetime

from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ..deps import get_current_user_optional
from ...utils.push_handler import trigger_push_notification

router = APIRouter()

# [사용자 전용 골든 키] 토스페이먼츠 API 개별 연동 테스트 키
TOSS_SECRET_KEY = "test_sk_4yKeq5bgrpymjvLQz9QA8GX0lzW6"

@router.post("/create-session", response_model=schemas.ChargingSession)
async def create_payment_session(
    session_data: schemas.ChargingSessionCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """결제 세션을 생성하거나 업데이트합니다."""
    try:
        order_id = str(uuid.uuid4())
        
        new_session = models.ChargingSession(
            user_id=current_user.user_id if current_user else None,
            station_id=session_data.station_id,
            charger_id=session_data.charger_id,
            total_price=session_data.total_price,
            used_mileage=session_data.used_mileage if current_user else 0,
            final_amount=session_data.final_amount,
            target_soc=session_data.target_soc, # 사용자의 목표 충전량 저장
            order_id=order_id,
            status="PENDING",
            is_guest=True if not current_user else False
        )
        db.add(new_session)
        
        # 충전기 상태 및 활성 세션 업데이트 (격리용)
        charger = db.query(models.Charger).filter(models.Charger.charger_id == session_data.charger_id).first()
        if charger:
            charger.active_session_id = order_id
            if current_user:
                charger.active_user_id = current_user.user_id

        db.commit()
        db.refresh(new_session)
        print(f"💰 [Payment Session]: Created Order ID {order_id} (Target: {session_data.target_soc}%)")
        return new_session
    except Exception as e:
        db.rollback()
        print(f"💥 [Session Error]: {e}")
        raise HTTPException(status_code=500, detail="결제 세션 생성 실패")

@router.patch("/sessions/{order_id}", response_model=schemas.ChargingSession)
async def update_payment_session(
    order_id: str,
    session_data: schemas.ChargingSessionCreate,
    db: Session = Depends(get_db)
):
    """기존 세션의 금액 및 목표 충전량을 최종 충전 결과에 맞춰 업데이트합니다."""
    session = db.query(models.ChargingSession).filter(models.ChargingSession.order_id == order_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    
    session.total_price = session_data.total_price
    session.used_mileage = session_data.used_mileage
    session.final_amount = session_data.final_amount
    session.target_soc = session_data.target_soc
    
    db.commit()
    db.refresh(session)
    print(f"🔄 [Session Updated]: {order_id} -> Amount: {session.final_amount}, Mileage: {session.used_mileage}, Target: {session.target_soc}%")
    return session

@router.post("/confirm", response_model=schemas.ActionResponse)
async def confirm_payment(
    confirm_data: schemas.ChargingSessionConfirm,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user_optional)
):
    """토스 결제 승인, 마일리지 차감 및 실시간 알림 피드백"""
    print(f"💳 [Confirm Request]: Order ID {confirm_data.orderId}")
    
    payment_session = db.query(models.ChargingSession).filter(
        models.ChargingSession.order_id == confirm_data.orderId
    ).first()

    if not payment_session:
        print(f"❌ [Confirm Error]: Order ID {confirm_data.orderId} not found in DB.")
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
        
    if payment_session.status == "PAID":
        return {"success": True, "message": "이미 완료된 결제입니다."}

    # 토스 서버 통신
    auth_str = f"{TOSS_SECRET_KEY}:"
    encoded_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.tosspayments.com/v1/payments/confirm",
                json={"paymentKey": confirm_data.paymentKey, "orderId": confirm_data.orderId, "amount": confirm_data.amount},
                headers={"Authorization": f"Basic {encoded_auth}", "Content-Type": "application/json", "TossPayments-Version": "2024-06-01"},
                timeout=15.0
            )
            if response.status_code != 200 and response.json().get("code") != "ALREADY_PROCESSED_PAYMENT":
                print(f"❌ [Toss Reject]: {response.text}")
                raise HTTPException(status_code=400, detail="토스 승인 실패")
        except Exception as e:
            print(f"💥 [Toss Network Error]: {e}")
            raise HTTPException(status_code=503, detail="통신 장애")

    # 정산, 마일리지 차감 및 알림 트리거
    try:
        payment_session.status = "PAID"
        payment_session.paid_at = datetime.now()
        payment_session.payment_key = confirm_data.paymentKey
        
        # [충전기 최종 사용 시간 업데이트]
        charger = db.query(models.Charger).filter(models.Charger.charger_id == payment_session.charger_id).first()
        if charger:
            charger.last_used_at = payment_session.paid_at

        # [초정밀 차감] 마일리지 트랜잭션 검증 및 로깅
        if payment_session.user_id and payment_session.used_mileage > 0:
            user = db.query(models.User).filter(models.User.user_id == payment_session.user_id).first()
            if user:
                before_balance = user.mileage_balance
                # 음수 방어 로직 적용
                user.mileage_balance = max(0, user.mileage_balance - payment_session.used_mileage)
                after_balance = user.mileage_balance
                
                db.add(models.MileageLog(
                    user_id=user.user_id,
                    description=f"충전 요금 결제 할인 사용: {payment_session.station_id}",
                    amount=-(before_balance - after_balance)
                ))
                print(f"📉 [Mileage Deduction]: User:{user.user_id} | {before_balance}P -> {after_balance}P (Used:{payment_session.used_mileage}P)")

        db.commit()
        
        print(f"✅ [Payment Success]: {confirm_data.orderId} is now PAID. Triggering Notification...")
        
        # [결제 완료 즉시 알림]
        trigger_push_notification(
            db, "💳 결제 및 충전 승인 완료", 
            "안전하게 충전이 완료되었습니다. 이용해 주셔서 감사합니다!",
            user_id=payment_session.user_id,
            session_id=payment_session.order_id if payment_session.is_guest else None,
            tag=f"paid-{payment_session.order_id}",
            n_type="SUCCESS"
        )
        
        return {"success": True, "message": "결제 승인 및 정산 완료"}
    except Exception as e:
        db.rollback()
        print(f"💥 [Settlement Error]: {e}")
        raise HTTPException(status_code=500, detail="정산 처리 오류")

