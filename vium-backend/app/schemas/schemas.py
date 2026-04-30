from pydantic import BaseModel, Field
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
    status: str # 'VISIBLE' | 'HIDDEN' (관리자용 제어)

class Review(ReviewBase):
    id: int
    user_name: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Charger Schemas ---
class ChargerBase(BaseModel):
    charger_id: str
    charger_type: str
    connector_type: str
    status: str

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
class UserProfile(BaseModel):
    user_id: int
    email: str
    nickname: Optional[str]
    mileage_balance: int
    level: str
    trust_score: int
    mileage_logs: List[MileageLog] = []

    class Config:
        from_attributes = True

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

# --- Hardware Schemas (Added for IoT Integration) ---
class ConnectorSignal(BaseModel):
    """아두이노(ESP32)로부터 수신하는 충전 커넥터 상태 데이터"""
    charger_id: str
    status: str # 'CONNECTED' | 'DISCONNECTED'
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)

class CameraSignal(BaseModel):
    """라즈베리파이(OpenCV)로부터 수신하는 차량 점유 감지 데이터"""
    parking_space_id: str # DB의 charger_id와 1:1 매핑됨
    vehicle_present: bool
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    timestamp: Optional[datetime] = Field(default_factory=datetime.utcnow)
