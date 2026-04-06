from app.db.session import SessionLocal, engine, Base
from app.models import models
from app.db.redis_client import update_station_slots
import random

# 테이블 초기화
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

def generate_price_history(base_price):
    """실제와 비슷한 24시간 요금 트렌드 생성 (심야 저렴, 낮 피크 비쌈)"""
    history = []
    for hour in range(24):
        if 0 <= hour <= 6: # 심야
            price = base_price - random.randint(50, 80)
        elif 11 <= hour <= 15: # 낮 피크
            price = base_price + random.randint(20, 50)
        else:
            price = base_price + random.randint(-20, 20)
        history.append(price)
    return history

def seed():
    # 1. 초기 사용자
    user = models.User(
        id="user-001",
        name="최정환",
        points=15700,
        level="에코 드라이버",
        recentActivity=[
            {"id": "act-1", "type": "충전 적립", "date": "2026.03.26", "amount": "+450 P"},
            {"id": "act-2", "type": "고장 제보 보상", "date": "2026.03.24", "amount": "+1,000 P"}
        ]
    )
    db.add(user)

    # 2. 현실적인 충전소 데이터 (모델 컬럼명과 100% 일치)
    stations = [
        models.Station(
            id="st-001",
            name="강남역 공용주차장 충전소",
            address="서울특별시 강남구 역삼동 821-1",
            lat=37.4979, lng=127.0276,
            type="Rapid", status="Available", price=324,
            isTimeSale=True,
            priceHistory=generate_price_history(324),
            distance="0.8km",
            availableSlots=3, totalSlots=5,
            connectorTypes=["DC_Combo", "Chademo"],
            lastSuccessTime="12분 전"
        ),
        models.Station(
            id="st-002",
            name="코엑스 지하주차장 B2",
            address="서울특별시 강남구 삼성동 159",
            lat=37.5113, lng=127.0598,
            type="Rapid", status="Charging", price=345,
            isTimeSale=False,
            priceHistory=generate_price_history(345),
            distance="1.2km",
            availableSlots=0, totalSlots=10,
            connectorTypes=["DC_Combo", "AC3"],
            lastSuccessTime="2시간 전"
        ),
        models.Station(
            id="st-003",
            name="삼성역 현대백화점 충전소",
            address="서울특별시 강남구 테헤란로 517",
            lat=37.5085, lng=127.0595,
            type="Standard", status="Available", price=250,
            isTimeSale=True,
            priceHistory=generate_price_history(250),
            distance="1.5km",
            availableSlots=2, totalSlots=4,
            connectorTypes=["Slow"],
            lastSuccessTime="15분 전"
        ),
        models.Station(
            id="st-004",
            name="역삼역 테헤란로 충전소",
            address="서울특별시 강남구 역삼동 737",
            lat=37.5006, lng=127.0364,
            type="Rapid", status="Faulty", price=310,
            isTimeSale=False,
            priceHistory=generate_price_history(310),
            distance="2.1km",
            availableSlots=0, totalSlots=2,
            connectorTypes=["DC_Combo"],
            lastSuccessTime="3일 전"
        )
    ]
    
    for s in stations:
        db.add(s)
        # [실시간 연동] Redis에도 초기 잔여석 정보를 동기화
        update_station_slots(s.id, s.availableSlots)
    
    # 3. 초기 리뷰
    db.add(models.Review(
        id="rev-1", station_id="st-001", user_id="user-001", user_name="에코러버",
        rating=5, content="충전 속도 정말 빨라요! 주차 공간도 넓습니다."
    ))

    db.commit()
    print("Database and Redis seeded successfully!")

if __name__ == "__main__":
    seed()
