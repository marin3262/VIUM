from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, DECIMAL, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from ..db.session import Base

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(100), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    nickname = Column(String(50))
    is_admin = Column(Boolean, default=False)
    mileage_balance = Column(Integer, default=0)
    level = Column(String(50), default="에코 드라이버")
    # 신규: 악성 유저 관리를 위한 신뢰도 점수 (추후 확장용)
    trust_score = Column(Integer, default=100) 
    created_at = Column(DateTime, default=datetime.utcnow)

    reviews = relationship("Review", back_populates="user")
    reports = relationship("Report", back_populates="user")
    mileage_logs = relationship("MileageLog", back_populates="user", order_by="desc(MileageLog.created_at)")

class Station(Base):
    __tablename__ = "stations"
    station_id = Column(String(50), primary_key=True)
    station_name = Column(String(100), index=True)
    address = Column(String(200))
    latitude = Column(DECIMAL(10, 7))
    longitude = Column(DECIMAL(10, 7))
    price = Column(Integer, default=300)
    isTimeSale = Column(Boolean, default=False)
    priceHistory = Column(JSON) 
    lastSuccessTime = Column(String(50), default="방금 전")
    distance = Column(String(20))

    chargers = relationship("Charger", back_populates="station", lazy="joined")
    # 리뷰 조회 시 조건부 렌더링을 위해 lazy='joined' 유지
    reviews = relationship("Review", back_populates="station", lazy="joined")

class Charger(Base):
    __tablename__ = "chargers"
    charger_id = Column(String(50), primary_key=True)
    station_id = Column(String(50), ForeignKey("stations.station_id"))
    charger_type = Column(String(20)) 
    connector_type = Column(String(50)) 
    status = Column(String(20), default="Available") 

    station = relationship("Station", back_populates="chargers")
    reports = relationship("Report", back_populates="charger")

class Report(Base):
    __tablename__ = "reports"
    report_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    charger_id = Column(String(50), ForeignKey("chargers.charger_id"))
    keyword = Column(String(50))
    content = Column(String(1000))
    image_url = Column(String(255))
    # 변경: is_verified (Boolean) -> status (String)
    # 상태: PENDING (대기), APPROVED (승인), REJECTED (반려)
    status = Column(String(20), default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reports")
    charger = relationship("Charger", back_populates="reports")

class MileageLog(Base):
    __tablename__ = "mileage_logs"
    log_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    amount = Column(Integer)
    description = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="mileage_logs")

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, autoincrement=True)
    station_id = Column(String(50), ForeignKey("stations.station_id"))
    user_id = Column(Integer, ForeignKey("users.user_id"))
    user_name = Column(String(100))
    rating = Column(Integer)
    content = Column(String(1000))
    # 신규: 리뷰 노출 제어 (Soft Delete)
    # 상태: VISIBLE (정상 노출), HIDDEN (관리자 숨김)
    status = Column(String(20), default="VISIBLE")
    created_at = Column(DateTime, default=datetime.utcnow)

    station = relationship("Station", back_populates="reviews")
    user = relationship("User", back_populates="reviews")
