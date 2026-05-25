import cv2
import numpy as np
import time
import requests
from datetime import datetime
from fastapi import FastAPI
from fastapi.responses import StreamingResponse, HTMLResponse
import threading

app = FastAPI()

# ==============================================================================
# 설정 (VIUM Architect 최적화 패치 v2.1)
# ==============================================================================
# [중요] KT Cloud 공인 IP 및 하드웨어 매핑 정보
SERVER_URL = "http://211.253.31.143:8000/api/v1/hardware/cameras"
TARGET_ID = "3682"  # 양주시 신도8차 아파트 1호기
CONFIDENCE_THRESHOLD = 0.7
DEBOUNCE_SECONDS = 3  # 출차 확정 대기 시간

# 공유 상태 및 잠금
lock = threading.Lock()
vehicle_status = {"text": "Detecting...", "color": (255, 255, 0)}

# ==============================================================================
# 카메라 초기화
# ==============================================================================
cap = None
for i in range(10):
    temp = cv2.VideoCapture(i)
    if temp.isOpened():
        cap = temp
        print(f"✅ Camera index {i} in use")
        break
    temp.release()

if cap is None:
    print("❌ No camera found!")
    exit()

# 라즈베리파이 부하 감소를 위해 해상도 최적화
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 320)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 240)

# ==============================================================================
# 모델 로딩
# ==============================================================================
print("⏳ Loading model...")
try:
    net = cv2.dnn.readNetFromONNX('vium_car.onnx')
    print("✅ Model loaded!")
except Exception as e:
    print(f"❌ Model load failed: {e}")
    exit()

# ==============================================================================
# [핵심 솔루션] 비동기 서버 전송 로직 (Blocking 방지)
# ==============================================================================
def _send_task(payload, headers, status_str):
    """실제 네트워크 통신을 담당하는 워커 함수 (별도 스레드에서 실행)"""
    try:
        # 타임아웃을 5초로 설정하여 무한 대기 방지
        response = requests.post(SERVER_URL, json=payload, headers=headers, timeout=5)
        if response.status_code == 200:
            print(f"🚀 [IoT Cloud] {status_str} signal synced successfully.")
        else:
            print(f"⚠️ [IoT Cloud] Server responded with code: {response.status_code}")
    except Exception as e:
        print(f"❌ [IoT Cloud] Sync failed (Network Error): {e}")

def send_to_server_async(vehicle_present, confidence_score=0.0):
    """추론 루프의 흐름을 방해하지 않고 서버로 데이터를 던집니다."""
    status_str = "Occupied" if vehicle_present else "Available"
    payload = {
        "parking_space_id": TARGET_ID,
        "vehicle_present": bool(vehicle_present),
        "confidence_score": float(confidence_score)
    }
    headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "69420"
    }
    
    # Fire and Forget: 통신 전용 스레드를 즉시 생성하여 실행
    worker = threading.Thread(target=_send_task, args=(payload, headers, status_str), daemon=True)
    worker.start()

# ==============================================================================
# [핵심 솔루션] 최적화된 추론 루프
# ==============================================================================
def inference_loop():
    global vehicle_status

    vehicle_present = False
    empty_start_time = None
    frame_count = 0

    while True:
        with lock:
            ret, frame = cap.read()
        if not ret:
            print("⚠️ Camera frame capture failed.")
            break

        frame_count += 1
        # 매 3프레임마다 연산하여 라즈베리파이 CPU 발열 및 부하 제어
        if frame_count % 3 == 0:
            blob = cv2.dnn.blobFromImage(frame, 1/255.0, (320, 320), swapRB=True)
            net.setInput(blob)
            
            # 추론 실행
            outputs = net.forward()[0].T

            car_detected = False
            max_conf = 0.0

            # 결과 해석
            for row in outputs:
                conf = row[4]
                if conf > CONFIDENCE_THRESHOLD:
                    car_detected = True
                    max_conf = conf
                    break

            # --- 상태 전이 로직 ---
            if car_detected:
                # 1. 입차 감지 (새로운 차량이 나타난 엣지)
                if not vehicle_present:
                    print(f"\n🚗 [Vision] Vehicle arrived! (Confidence: {max_conf:.2f})")
                    send_to_server_async(vehicle_present=True, confidence_score=max_conf)
                
                vehicle_present = True
                empty_start_time = None  # 비어있는 시간 초기화

                # UI 텍스트 업데이트
                vehicle_status["text"] = f"● Occupied ({max_conf:.2f})"
                vehicle_status["color"] = (0, 255, 0) # Green
            else:
                # 2. 비어있는 상태 시작 감지
                if empty_start_time is None:
                    empty_start_time = time.time()

                # 디바운스 로직: 3초 동안 연속으로 비어있어야 출차로 확정
                elapsed = time.time() - empty_start_time
                if elapsed >= DEBOUNCE_SECONDS:
                    # 3. 출차 확정
                    if vehicle_present:
                        print("\n✨ [Vision] Vehicle cleared! (Available)")
                        # 퇴거 시에는 신뢰도를 1.0으로 고정하여 서버 인계 확실화
                        send_to_server_async(vehicle_present=False, confidence_score=1.0)
                    
                    vehicle_present = False
                    empty_start_time = None

                    vehicle_status["text"] = "○ Available"
                    vehicle_status["color"] = (0, 255, 255) # Cyan
                else:
                    # 디바운스 진행 중 UI 피드백
                    remaining = DEBOUNCE_SECONDS - elapsed
                    vehicle_status["text"] = f"? Monitoring... ({remaining:.1f}s)"
                    vehicle_status["color"] = (255, 255, 0) # Yellow

        # 루프 간 짧은 휴식으로 스트리밍 자원 확보
        time.sleep(0.01)

# ==============================================================================
# CCTV 시각 효과 및 스트리밍 (팀원 로직 보존)
# ==============================================================================
def add_cctv_overlay(frame):
    h, w = frame.shape[:2]
    # 반투명 상단 바
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w, 22), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)

    # 시계
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(frame, now, (3, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)

    # 녹화 중 표시 (RED DOT)
    cv2.circle(frame, (w - 8, 11), 4, (0, 0, 255), -1)
    cv2.putText(frame, "CAM-01 VIUM", (w - 110, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)

    # 하단 상태 바
    status_text = vehicle_status["text"]
    status_color = vehicle_status["color"]
    cv2.rectangle(frame, (0, h - 22), (w, h), (0, 0, 0), -1)
    cv2.putText(frame, status_text, (3, h - 7), cv2.FONT_HERSHEY_SIMPLEX, 0.35, status_color, 1)

    return frame

def generate_frames():
    while True:
        with lock:
            ret, frame = cap.read()
        if not ret:
            break
        frame = add_cctv_overlay(frame)
        _, buffer = cv2.imencode('.jpg', frame)
        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n'
        )

# ==============================================================================
# FastAPI 엔드포인트
# ==============================================================================
@app.get("/", response_class=HTMLResponse)
def index():
    return """
    <html>
        <head>
            <title>VIUM Admin CCTV</title>
            <style>
                body { background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; flex-direction: column; color: #fff; font-family: sans-serif; }
                .container { position: relative; border: 4px solid #333; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
                img { display: block; width: 640px; }
                h2 { margin-bottom: 20px; letter-spacing: 2px; font-weight: 900; color: #00ffcc; }
                .status { margin-top: 15px; font-size: 14px; color: #888; }
            </style>
        </head>
        <body>
            <h2>🛰️ VIUM REAL-TIME MONITOR</h2>
            <div class="container">
                <img src="/video" />
            </div>
            <p class="status">LIVE FEED | ASYNC OPTIMIZED v2.1</p>
        </body>
    </html>
    """

@app.get("/video")
def video():
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# ==============================================================================
# 스레드 실행
# ==============================================================================
@app.on_event("startup")
def startup_event():
    # 추론 스레드를 데몬 스레드로 시작
    t = threading.Thread(target=inference_loop, daemon=True)
    t.start()
    print(f"\n" + "="*50)
    print(f"🚀 VIUM VISION ENGINE STARTED")
    print(f"📍 TARGET ID : {TARGET_ID}")
    print(f"📡 BACKEND   : {SERVER_URL}")
    print(f"⚡ ASYNC MODE : ENABLED (Blocking Removed)")
    print("="*50 + "\n")
