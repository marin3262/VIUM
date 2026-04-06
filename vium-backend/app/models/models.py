from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from ..db.session import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(100), primary_key=True, index=True)
    name = Column(String(100))
    points = Column(Integer, default=0)
    level = Column(String(100), default="에코 드라이버")
    recentActivity = Column(JSON, default=[])

    reviews = relationship("Review", back_populates="user")
    reports = relationship("Report", back_populates="user")

class Station(Base):
    __tablename__ = "stations"
    
    id = Column(String(100), primary_key=True, index=True)
    name = Column(String(255), index=True)
    address = Column(String(255))
    lat = Column(Float)
    lng = Column(Float)
    type = Column(String(50)) 
    status = Column(String(50)) 
    price = Column(Integer)
    isTimeSale = Column(Boolean, default=False)
    priceHistory = Column(JSON) 
    distance = Column(String(50))
    availableSlots = Column(Integer)
    totalSlots = Column(Integer)
    connectorTypes = Column(JSON) 
    lastSuccessTime = Column(String(100))

    reviews = relationship("Review", back_populates="station")
    reports = relationship("Report", back_populates="station")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(String(100), primary_key=True, index=True)
    station_id = Column(String(100), ForeignKey("stations.id"))
    user_id = Column(String(100), ForeignKey("users.id"))
    user_name = Column(String(100)) 
    rating = Column(Integer)
    content = Column(String(1000))
    date = Column(DateTime, default=datetime.utcnow)

    station = relationship("Station", back_populates="reviews")
    user = relationship("User", back_populates="reviews")

class Report(Base):
    __tablename__ = "reports"
    
    id = Column(String(100), primary_key=True, index=True)
    stationId = Column(String(100), ForeignKey("stations.id"))
    userId = Column(String(100), ForeignKey("users.id"))
    issueType = Column(String(100)) # 'ConnectorBroken' | 'ScreenOff' | 'PaymentError' 등
    content = Column(String(1000))
    status = Column(String(50), default="PENDING") # 'PENDING' | 'APPROVED' | 'REJECTED'
    timestamp = Column(DateTime, default=datetime.utcnow)

    station = relationship("Station", back_populates="reports")
    user = relationship("User", back_populates="reports")
