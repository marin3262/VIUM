import requests
import json
import time
import sys

# --- 설정 (필요 시 수정) ---
# 로컬에서 테스트할 때는 http://localhost:8000
# ngrok을 통해 테스트할 때는 ngrok URL로 변경하세요.
BASE_URL = "http://localhost:8000/api/v1/hardware"
CHARGER_ID = "3682"  # 양주시 신도8차 아파트 1호기

def send_signal(status):
    url = f"{BASE_URL}/connectors"
    payload = {
        "charger_id": CHARGER_ID,
        "status": status  # 'CONNECTED' 또는 'DISCONNECTED'
    }
    headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "69420"
    }

    print(f"\n🚀 Sending {status} signal for Charger {CHARGER_ID}...")
    try:
        response = requests.post(url, data=json.dumps(payload), headers=headers)
        if response.status_code == 200:
            print(f"✅ Success: {response.json()['message']}")
        else:
            print(f"❌ Failed (Status {response.status_code}): {response.text}")
    except Exception as e:
        print(f"💥 Error: {e}")

if __name__ == "__main__":
    print("=== VIUM IoT Hardware Simulator ===")
    print("1. CONNECTED (충전기 연결)")
    print("2. DISCONNECTED (충전기 해제)")
    print("q. Quit")
    
    while True:
        choice = input("\nSelect action: ").strip().lower()
        if choice == '1':
            send_signal("CONNECTED")
        elif choice == '2':
            send_signal("DISCONNECTED")
        elif choice == 'q':
            print("Exiting simulator...")
            break
        else:
            print("Invalid choice. Try again.")
