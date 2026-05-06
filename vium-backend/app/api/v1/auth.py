from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import os
from ...db.session import get_db
from ...models import models
from ...schemas import schemas
from ...core import security

router = APIRouter()

@router.post("/signup", response_model=schemas.ActionResponse)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """회원가입 엔드포인트: 이메일 중복 확인 후 유저 생성"""
    try:
        user = db.query(models.User).filter(models.User.email == user_in.email).first()
        if user:
            raise HTTPException(
                status_code=400,
                detail="이미 존재하는 이메일입니다."
            )
        
        # 관리자 초대 코드 검증
        is_admin = False
        if user_in.admin_code:
            admin_invite_code = os.getenv("ADMIN_INVITE_CODE", "ViumMaster2026")
            if user_in.admin_code == admin_invite_code:
                is_admin = True
            else:
                raise HTTPException(
                    status_code=400,
                    detail="잘못된 관리자 초대 코드입니다."
                )

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
