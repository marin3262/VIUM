from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 프로토타입용 SQLite DB (향후 MariaDB/PostgreSQL로 전환 용이)
SQLALCHEMY_DATABASE_URL = "sqlite:///./vium.db"

# SQLite 특성상 check_same_thread=False 설정 필요
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# DB 세션 의존성 주입용 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
