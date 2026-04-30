from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os

from app.db.session import engine, Base
from app.api.v1 import endpoints

# 데이터베이스 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="VIUM Smart EV Charging Management System",
    description="전기차 충전소 효율성 제고 및 관제를 위한 백엔드 API 서비스",
    version="1.0.0"
)

# CORS 설정: 모든 도메인 허용 (테스트 및 ngrok 연동용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙 설정 (사진 업로드용)
static_path = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_path):
    os.makedirs(static_path)
app.mount("/static", StaticFiles(directory=static_path), name="static")

# API 라우터 등록
app.include_router(endpoints.router, prefix="/api/v1")
from app.api.v1 import hardware
app.include_router(hardware.router, prefix="/api/v1/hardware", tags=["Hardware"])

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
