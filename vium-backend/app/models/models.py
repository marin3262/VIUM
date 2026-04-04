from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from ..db.session import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    points = Column(Integer, default=0)
    level = Column(String, default="에코 드라이버")
    recentActivity = Column(JSON, default=[])

    reviews = relationship("Review", back_populates="user")
    reports = relationship("Report", back_populates="user")

class Station(Base):
    __tablename__ = "stations"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    address = Column(String)
    lat = Column(Float)
    lng = Column(Float)
    type = Column(String) 
    status = Column(String) 
    price = Column(Integer)
    isTimeSale = Column(Boolean, default=False)
    priceHistory = Column(JSON) 
    distance = Column(String)
    availableSlots = Column(Integer)
    totalSlots = Column(Integer)
    connectorTypes = Column(JSON) 
    lastSuccessTime = Column(String)

    reviews = relationship("Review", back_populates="station")
    reports = relationship("Report", back_populates="station")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(String, primary_key=True, index=True)
    station_id = Column(String, ForeignKey("stations.id"))
    user_id = Column(String, ForeignKey("users.id"))
    user_name = Column(String) 
    rating = Column(Integer)
    content = Column(String)
    date = Column(DateTime, default=datetime.utcnow)

    station = relationship("Station", back_populates="reviews")
    user = relationship("User", back_populates="reviews")

class Report(Base):
    __tablename__ = "reports"
    
    id = Column(String, primary_key=True, index=True)
    stationId = Column(String, ForeignKey("stations.id"))
    userId = Column(String, ForeignKey("users.id"))
    issueType = Column(String) # 'ConnectorBroken' | 'ScreenOff' | 'PaymentError' 등
    content = Column(String)
    status = Column(String, default="PENDING") # 'PENDING' | 'APPROVED' | 'REJECTED'
    timestamp = Column(DateTime, default=datetime.utcnow)

    station = relationship("Station", back_populates="reports")
    user = relationship("User", back_populates="reports")
