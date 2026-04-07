from app.db.session import SessionLocal, engine, Base
from app.models import models
from app.db.redis_client import update_station_slots
from sqlalchemy import text
from decimal import Decimal
from datetime import datetime, timedelta
import random

def generate_price_history(base_price):
    history = []
    for hour in range(24):
        if 0 <= hour <= 6: price = base_price - random.randint(50, 80)
        elif 11 <= hour <= 15: price = base_price + random.randint(20, 50)
        else: price = base_price + random.randint(-20, 20)
        history.append(price)
    return history

def reset_database():
    with engine.connect() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        Base.metadata.drop_all(bind=conn)
        Base.metadata.create_all(bind=conn)
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        conn.commit()

db = SessionLocal()

def seed():
    reset_database()
    
    user = models.User(user_id=1, email="test@vium.com", password="hashed_password", nickname="최정환", mileage_balance=15700, level="에코 드라이버")
    db.add(user)

    # 1. 강남역 (일부 사용 가능)
    s1 = models.Station(station_id="KEPCO_001", station_name="강남역 공용주차장 충전소", address="서울특별시 강남구 역삼동 821-1", latitude=Decimal("37.4979"), longitude=Decimal("127.0276"), price=324, isTimeSale=True, priceHistory=generate_price_history(324), lastSuccessTime="12분 전", distance="0.8km")
    db.add(s1)
    db.add(models.Charger(charger_id="CH_001_1", station_id="KEPCO_001", charger_type="급속", connector_type="DC Combo", status="Available"))
    db.add(models.Charger(charger_id="CH_001_2", station_id="KEPCO_001", charger_type="급속", connector_type="Chademo", status="Charging"))

    # 2. 코엑스 (모두 충전 중 - 이전에는 3곳만 나왔던 이유)
    s2 = models.Station(station_id="KEPCO_002", station_name="코엑스 지하주차장 B2", address="서울특별시 강남구 삼성동 159", latitude=Decimal("37.5113"), longitude=Decimal("127.0598"), price=345, isTimeSale=False, priceHistory=generate_price_history(345), lastSuccessTime="2시간 전", distance="1.2km")
    db.add(s2)
    db.add(models.Charger(charger_id="CH_002_1", station_id="KEPCO_002", charger_type="초급속", connector_type="DC Combo", status="Charging"))
    db.add(models.Charger(charger_id="CH_002_2", station_id="KEPCO_002", charger_type="초급속", connector_type="DC Combo", status="Charging"))

    # 3. 삼성역 (완속 포함)
    s3 = models.Station(station_id="KEPCO_003", station_name="삼성역 현대백화점 충전소", address="서울특별시 강남구 테헤란로 517", latitude=Decimal("37.5085"), longitude=Decimal("127.0595"), price=250, isTimeSale=True, priceHistory=generate_price_history(250), lastSuccessTime="15분 전", distance="1.5km")
    db.add(s3)
    db.add(models.Charger(charger_id="CH_003_1", station_id="KEPCO_003", charger_type="완속", connector_type="Slow", status="Available"))

    # 4. 역삼역 (고장)
    s4 = models.Station(station_id="KEPCO_004", station_name="역삼역 테헤란로 충전소", address="서울특별시 강남구 역삼동 737", latitude=Decimal("37.5006"), longitude=Decimal("127.0364"), price=310, isTimeSale=False, priceHistory=generate_price_history(310), lastSuccessTime="3일 전", distance="2.1km")
    db.add(s4)
    db.add(models.Charger(charger_id="CH_004_1", station_id="KEPCO_004", charger_type="급속", connector_type="DC Combo", status="Faulty"))

    db.commit()
    print("Database seeded with FULL UI DATA!")

if __name__ == "__main__":
    seed()
