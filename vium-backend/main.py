from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.db.session import engine, Base
from app.api.v1 import endpoints

# 데이터베이스 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="VIUM Smart EV Charging Management System",
    description="전기차 충전소 효율성 제고 및 관제를 위한 백엔드 API 서비스",
    version="1.0.0"
)

# CORS 설정: 프론트엔드(React/Vite) 포트 허용
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(endpoints.router, prefix="/api/v1")

@app.get("/")
async def root():
    """서버 상태 확인용 헬스 체크 엔드포인트"""
    return {
        "status": "online",
        "message": "VIUM Backend API Server is running.",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
