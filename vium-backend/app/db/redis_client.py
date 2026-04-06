import os
import redis
from dotenv import load_dotenv

load_dotenv()

# Redis 설정 정보 로드
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "vium_redis_pass")

# Redis 클라이언트 생성 (연결 풀 사용으로 효율성 증대)
redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD,
    decode_responses=True # 데이터를 바이트가 아닌 문자열로 가져오도록 설정
)

def get_redis():
    """Redis 클라이언트를 반환하는 헬퍼 함수"""
    try:
        # 연결 확인용 핑(Ping) 테스트
        redis_client.ping()
        return redis_client
    except redis.ConnectionError as e:
        print(f"Redis connection failed: {e}")
        return None

def update_station_slots(station_id: str, available_slots: int):
    """특정 충전소의 잔여석 정보를 Redis에 초고속으로 기록합니다."""
    key = f"station:{station_id}:slots"
    redis_client.set(key, available_slots)

def get_station_slots(station_id: str, default_val: int):
    """Redis에서 특정 충전소의 최신 잔여석 정보를 가져옵니다."""
    key = f"station:{station_id}:slots"
    val = redis_client.get(key)
    return int(val) if val is not None else default_val
