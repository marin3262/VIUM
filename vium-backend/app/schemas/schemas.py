from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# --- Review Schemas ---
class ReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    content: str = Field(..., min_length=5)

class ReviewCreate(ReviewBase):
    pass

class Review(ReviewBase):
    id: str
    user_name: str
    date: datetime

    class Config:
        from_attributes = True

# --- Report Schemas ---
class ReportBase(BaseModel):
    issueType: str
    content: str = Field(..., min_length=10)

class ReportCreate(ReportBase):
    stationId: str

class ReportUpdate(BaseModel):
    status: str # 'APPROVED' | 'REJECTED'

class Report(ReportBase):
    id: str
    stationId: str
    userId: str
    status: str
    timestamp: datetime

    class Config:
        from_attributes = True

# --- Station Schemas ---
class StationBase(BaseModel):
    name: str
    address: str
    lat: float
    lng: float
    type: str
    status: str
    price: int
    isTimeSale: bool
    priceHistory: List[int]
    distance: str
    availableSlots: int
    totalSlots: int
    connectorTypes: List[str]
    lastSuccessTime: str

class Station(StationBase):
    id: str
    reviews: List[Review] = []
    reports: List[Report] = []

    class Config:
        from_attributes = True

# --- User Schemas ---
class UserActivity(BaseModel):
    id: str
    type: str
    date: str
    amount: str

class UserProfile(BaseModel):
    id: str
    name: str
    points: int
    level: str
    recentActivity: List[UserActivity] = []

    class Config:
        from_attributes = True

# --- Response Schemas ---
class RewardResponse(BaseModel):
    success: bool
    points_added: int
    total_points: int
    message: str
    review: Optional[Review] = None

class ActionResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
