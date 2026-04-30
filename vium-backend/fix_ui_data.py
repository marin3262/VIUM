from app.db.session import SessionLocal
from app.models import models
import random

def generate_price_history(base_price):
    history = []
    for hour in range(24):
        if 0 <= hour <= 6: price = base_price - random.randint(50, 80)
        elif 11 <= hour <= 15: price = base_price + random.randint(20, 50)
        else: price = base_price + random.randint(-20, 20)
        history.append(price)
    return history

def fix_stations():
    db = SessionLocal()
    try:
        stations = db.query(models.Station).all()
        updated_count = 0
        for s in stations:
            needs_update = False
            if not s.priceHistory or len(s.priceHistory) == 0:
                s.priceHistory = generate_price_history(300)
                needs_update = True
            if not s.lastSuccessTime or s.lastSuccessTime == "정보 없음":
                s.lastSuccessTime = "방금 전"
                needs_update = True
            if not s.isTimeSale:
                s.isTimeSale = random.choice([True, False])
                needs_update = True
            
            if needs_update:
                updated_count += 1
        
        db.commit()
        print(f"Successfully fixed {updated_count} stations for UI rendering.")
    except Exception as e:
        print(f"Error fixing stations: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_stations()
