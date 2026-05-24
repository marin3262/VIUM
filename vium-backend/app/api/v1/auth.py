from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
import os
import random
import string
from fastapi_mail import MessageSchema, MessageType
from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ...core import security
from ...core.mail import fastmail
from ...db.redis_client import redis_client

router = APIRouter()

def generate_verification_code(length=6):
    """6자리 숫자 인증 코드 생성"""
    return ''.join(random.choices(string.digits, k=length))

async def send_auth_email(email: str, code: str):
    """실제 이메일 발송 비동기 함수"""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #2563eb; text-align: center;">VIUM 스마트 충전 인증</h2>
        <p>안녕하세요! VIUM 회원가입을 위한 인증 코드입니다.</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1f2937; border-radius: 8px;">
            {code}
        </div>
        <p style="margin-top: 20px;">이 코드는 <b>3분</b> 동안 유효합니다.</p>
        <p style="color: #6b7280; font-size: 12px; border-top: 1px solid #eee; pt-10px; margin-top: 30px;">
            본 메일은 발신 전용입니다. 문의사항은 고객센터를 이용해 주세요.
        </p>
    </div>
    """
    
    message = MessageSchema(
        subject="[VIUM] 회원가입 인증 코드입니다",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )
    
    try:
        await fastmail.send_message(message)
        print(f"✅ [Email Sent] Real email sent to {email}")
    except Exception as e:
        print(f"❌ [Email Failed] Error sending to {email}: {str(e)}")

@router.post("/send-verification", response_model=schemas.ActionResponse)
async def send_verification(
    req: schemas.VerificationRequest, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """이메일 인증 코드 발송: 중복 이메일 체크 후 Redis에 코드 저장 및 실제 메일 발송 (백그라운드)"""
    # 1. 가입된 이메일인지 확인
    existing_user = db.query(models.User).filter(models.User.email == req.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="이미 가입되어 있는 이메일입니다.")
    
    # 2. 인증 코드 생성
    code = generate_verification_code()
    
    # 3. Redis 저장 (Signup Code용 키, TTL 180초)
    redis_key = f"signup_code:{req.email}"
    redis_client.setex(redis_key, 180, code)
    
    # 4. 터미널 로그 출력 (개발용 백업)
    print(f"\n📩 [Email Verification] To: {req.email} | Code: {code}\n")
    
    # 5. 실제 메일 발송 (백그라운드 태스크)
    background_tasks.add_task(send_auth_email, req.email, code)
    
    return {"success": True, "message": "인증 코드가 실제 이메일로 발송되었습니다. (3분 이내 입력)"}

@router.post("/verify-code", response_model=schemas.ActionResponse)
async def verify_code(req: schemas.VerificationVerify):
    """인증 코드 검증: 일치할 경우 15분간 '인증됨' 상태를 Redis에 저장"""
    redis_key = f"signup_code:{req.email}"
    saved_code = redis_client.get(redis_key)
    
    if not saved_code:
        raise HTTPException(status_code=400, detail="인증 코드가 만료되었거나 존재하지 않습니다.")
    
    if saved_code != req.code:
        raise HTTPException(status_code=400, detail="인증 코드가 일치하지 않습니다.")
    
    # 인증 성공 시 Redis에 인증 완료 마크 (TTL 900초 = 15분)
    verified_key = f"verified_email:{req.email}"
    redis_client.setex(verified_key, 900, "true")
    
    # 사용된 인증 코드는 삭제
    redis_client.delete(redis_key)
    
    return {"success": True, "message": "이메일 인증이 완료되었습니다."}

@router.get("/check-nickname", response_model=schemas.ActionResponse)
def check_nickname(nickname: str, db: Session = Depends(get_db)):
    """닉네임 중복 여부 확인: 대소문자 구분 없이 체크하여 중복 가입 방지"""
    user = db.query(models.User).filter(func.lower(models.User.nickname) == func.lower(nickname)).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="이미 사용 중인 닉네임입니다."
        )
    return {"success": True, "message": "사용 가능한 닉네임입니다."}

@router.post("/signup", response_model=schemas.ActionResponse)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """최종 회원가입: 이메일 인증 여부 및 닉네임 중복 최종 재검증 후 유저 생성"""
    try:
        # 1. 이메일 인증 여부 최종 확인 (Redis)
        verified_key = f"verified_email:{user_in.email}"
        if not redis_client.get(verified_key):
            raise HTTPException(status_code=400, detail="이메일 인증이 필요합니다.")
        
        # 2. 이메일 중복 최종 확인
        user = db.query(models.User).filter(models.User.email == user_in.email).first()
        if user:
            raise HTTPException(status_code=400, detail="이미 존재하는 이메일입니다.")
            
        # 3. 닉네임 중복 최종 확인
        existing_nickname = db.query(models.User).filter(models.User.nickname == user_in.nickname).first()
        if existing_nickname:
            raise HTTPException(status_code=400, detail="이미 존재하는 닉네임입니다.")
        
        # 4. 관리자 초대 코드 검증
        is_admin = False
        if user_in.admin_code:
            admin_invite_code = os.getenv("ADMIN_INVITE_CODE", "ViumMaster2026")
            if user_in.admin_code == admin_invite_code:
                is_admin = True
            else:
                raise HTTPException(status_code=400, detail="잘못된 관리자 초대 코드입니다.")

        new_user = models.User(
            email=user_in.email,
            password=security.get_password_hash(user_in.password),
            nickname=user_in.nickname,
            is_admin=is_admin,
            mileage_balance=1000 # 가입 축하 포인트
        )
        db.add(new_user)
        
        # 가입 축하 로그 추가
        new_log = models.MileageLog(
            user=new_user,
            description="회원가입 축하 포인트",
            amount=1000
        )
        db.add(new_log)
        
        db.commit()
        db.refresh(new_user)
        
        # 가입 성공 시 인증 마크 삭제
        redis_client.delete(verified_key)
        
        return {"success": True, "message": f"{new_user.nickname}님, 환영합니다!"}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"💥 [Signup Error] Detailed log: {e}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"서버 내부 데이터베이스 오류가 발생했습니다: {str(e)}"
        )

@router.post("/login", response_model=schemas.Token)
def login(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    """로그인 엔드포인트: 이메일/비밀번호 검증 후 JWT 발급"""
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 잘못되었습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {
        "access_token": security.create_access_token(user.user_id),
        "token_type": "bearer",
    }
