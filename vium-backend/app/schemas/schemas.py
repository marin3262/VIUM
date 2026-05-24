import re
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any
from datetime import datetime
from decimal import Decimal

# --- Review Schemas ---
class ReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    content: str = Field(..., min_length=5)

class ReviewCreate(ReviewBase):
    pass

class ReviewUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)
    content: Optional[str] = Field(None, min_length=5)

class ReviewAdminUpdate(BaseModel):
    status: str # 'VISIBLE' | 'HIDDEN' (관리자용 제어)

class Review(ReviewBase):
    id: int
    station_id: str
    station_name: Optional[str] = None
    station_address: Optional[str] = None
    user_name: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Charger Schemas ---
class ChargerBase(BaseModel):
    charger_id: str
    charger_type: str
    connector_type: str
    status: str

class ChargerStatusUpdate(BaseModel):
    status: str # 'Available' | 'Faulty' | 'Occupied' | 'Charging'

class Charger(ChargerBase):
    class Config:
        from_attributes = True

# --- Station Schemas ---
class StationBase(BaseModel):
    station_id: str
    station_name: str
    address: str
    latitude: Decimal
    longitude: Decimal
    price: int = 300
    isTimeSale: bool = False
    priceHistory: List[int] = Field(default_factory=lambda: [300]*24)
    lastSuccessTime: str = "정보 없음"
    distance: Optional[str] = "-"
    current_battery: Optional[float] = None

class Station(StationBase):
    chargers: List[Charger] = []
    reviews: List[Review] = []

    class Config:
        from_attributes = True

# --- Report Schemas ---
class ReportCreate(BaseModel):
    charger_id: str
    keyword: str
    content: str = Field(..., min_length=10)

class ReportUpdate(BaseModel):
    status: str # 'APPROVED' | 'REJECTED' (관리자용)

class Report(BaseModel):
    report_id: int
    user_id: int
    charger_id: str
    keyword: str
    content: str
    image_url: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Mileage Log Schemas ---
class MileageLog(BaseModel):
    log_id: int
    amount: int
    description: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- User Schemas ---
class UserCreate(BaseModel):
    email: str = Field(..., example="user@example.com")
    password: str = Field(
        ..., 
        min_length=8, 
        description="비밀번호는 최소 8자 이상이어야 하며, 영문, 숫자, 특수문자를 각각 최소 하나 이상 포함해야 합니다."
    )
    nickname: str = Field(..., min_length=2, max_length=20)
    admin_code: Optional[str] = None # 관리자 가입용 시크릿 코드

    @field_validator('password')
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        """비밀번호 복잡도 수동 검증: 영문, 숫자, 특수문자 포함 여부 확인"""
        # Python의 re 모듈은 look-around를 완벽하게 지원합니다.
        password_regex = r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$'
        if not re.match(password_regex, v):
            raise ValueError(
                "비밀번호는 최소 8자 이상이어야 하며, 영문, 숫자, 특수문자를 각각 최소 하나 이상 포함해야 합니다."
            )
        return v

class NicknameCheck(BaseModel):
    nickname: str

class VerificationRequest(BaseModel):
    email: str

class VerificationVerify(BaseModel):
    email: str
    code: str

class UserProfile(BaseModel):
    user_id: int
    email: str
    nickname: Optional[str]
    is_admin: bool
    mileage_balance: int
    level: str
    trust_score: int
    mileage_logs: List[MileageLog] = []
    reviews: List[Review] = [] # 내가 남긴 리뷰
    reports: List[Report] = [] # 내가 보낸 제보

    class Config:
        from_attributes = True

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenPayload(BaseModel):
    sub: Optional[int] = None

# --- Response Schemas ---
class RewardResponse(BaseModel):
    success: bool
    points_added: int
    total_balance: int
    message: str

class ActionResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None

# --- Routing (GPS) Schemas ---
class RouteSummary(BaseModel):
    distance: int # 미터
    duration: int # 초
    origin: dict
    destination: dict

class DirectionResponse(BaseModel):
    success: bool
    path: List[List[float]] # [[lng, lat], ...]
    summary: RouteSummary

# --- Hardware Schemas (Added for IoT Integration) ---
class ConnectorSignal(BaseModel):
    """아두이노(ESP32)로부터 수신하는 충전 커넥터 상태 데이터"""
    charger_id: str
    status: str # 'CONNECTED' | 'DISCONNECTED'
    voltage: Optional[float] = 0.0
    battery: Optional[float] = 0.0
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)

class CameraSignal(BaseModel):
    """라즈베리파이(OpenCV)로부터 수신하는 차량 점유 감지 데이터"""
    parking_space_id: str # DB의 charger_id와 1:1 매핑됨
    vehicle_present: bool
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)
