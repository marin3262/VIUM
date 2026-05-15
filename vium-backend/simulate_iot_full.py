import requests
import json
import time

# --- 설정 ---
BASE_URL = "http://127.0.0.1:8000/api/v1/hardware"
TARGET_ID = "3682"  # 양주시 신도8차 아파트 1호기

def send_camera(present):
    url = f"{BASE_URL}/cameras"
    payload = {
        "parking_space_id": TARGET_ID,
        "vehicle_present": present,
        "confidence_score": 0.85 # 시연을 위해 항상 높은 신뢰도를 전송합니다.
    }
    try:
        resp = requests.post(url, json=payload)
        print(f"📸 Vision Signal: {'Arrived' if present else 'Left'} -> {resp.json().get('message')}")
    except Exception as e:
        print(f"❌ Camera Sync Error: {e}")

def send_connector(status, battery=None):
    url = f"{BASE_URL}/connectors"
    payload = {
        "charger_id": TARGET_ID,
        "status": status,
        "battery": battery,
        "voltage": 3.0 + (1.2 * battery / 100.0) if battery else 0.0
    }
    try:
        resp = requests.post(url, json=payload)
        print(f"🔌 Connector Signal: {status} ({battery if battery else 0}%) -> {resp.json().get('message')}")
    except Exception as e:
        print(f"❌ Connector Sync Error: {e}")

if __name__ == "__main__":
    print("\n" + "="*40)
    print("🚀 VIUM Full-Stack Live Control Panel")
    print("Target: Shindo 8th Apt (ID: 3682)")
    print("="*40)
    
    while True:
        print("\n[Vision AI Controls]")
        print("1. Vehicle Arrived (입차 감지)")
        print("2. Vehicle Left    (퇴거 감지)")
        print("\n[Charger Sensor Controls]")
        print("3. Connector Connected (충전기 연결 + 배터리%)")
        print("4. Connector Disconnected (충전기 해제)")
        print("\nq. Quit")
        
        choice = input("\nAction >> ").strip().lower()
        
        if choice == '1':
            send_camera(True)
        elif choice == '2':
            send_camera(False)
        elif choice == '3':
            try:
                bat = float(input("Enter Vehicle Battery % (0-100): "))
                send_connector("CONNECTED", battery=bat)
            except ValueError:
                print("Invalid percentage.")
        elif choice == '4':
            send_connector("DISCONNECTED", battery=0)
        elif choice == 'q':
            print("Control panel closed.")
            break
        else:
            print("Invalid choice.")
