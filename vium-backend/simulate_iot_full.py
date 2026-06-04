import requests
import json
import time

# --- 설정 ---
BASE_URL = "http://127.0.0.1:8000/api/v1/hardware"

def send_camera(target_id, present):
    url = f"{BASE_URL}/cameras"
    payload = {
        "parking_space_id": target_id,
        "vehicle_present": present,
        "confidence_score": 0.85
    }
    try:
        resp = requests.post(url, json=payload)
        print(f"📸 Vision Signal ({target_id}): {'Arrived' if present else 'Left'} -> {resp.json().get('message')}")
    except Exception as e:
        print(f"❌ Camera Sync Error: {e}")

def send_connector(target_id, status, battery=None, user_id=None):
    url = f"{BASE_URL}/connectors"
    payload = {
        "charger_id": target_id,
        "status": status,
        "battery": battery,
        "voltage": 3.0 + (1.2 * battery / 100.0) if battery is not None else 0.0
    }
    if user_id:
        payload["user_id"] = user_id

    try:
        resp = requests.post(url, json=payload)
        print(f"🔌 Connector Signal ({target_id}): {status} ({battery if battery is not None else 0}%) [User: {user_id}] -> {resp.json().get('message')}")
    except Exception as e:
        print(f"❌ Connector Sync Error: {e}")

if __name__ == "__main__":
    print("\n" + "="*40)
    print("🚀 VIUM Manual Live Control Panel")
    print("="*40)
    print("💡 이 시뮬레이터는 하드웨어의 물리적 동작을 하나씩 재현합니다.")
    print("💡 실제 시연 시나리오대로 조작하며 웹 UI의 알림을 확인하세요.")
    
    target_charger_id = input("Enter Target Charger ID (Default: 3682): ").strip()
    if not target_charger_id:
        target_charger_id = "3682"
    print(f"📍 Target Charger set to: {target_charger_id}")

    try:
        user_input = input("\nEnter Target User ID (Check My Page): ").strip()
        active_user_id = int(user_input) if user_input else None
    except ValueError:
        active_user_id = None

    while True:
        print(f"\n[Vision AI Controls]")
        print("1. Vehicle Arrived (입차 감지)")
        print("2. Vehicle Left    (퇴거 감지)")
        print("\n[Charger Sensor Controls]")
        print("3. Connector Connected (플러그 연결 - 배터리 입력 가능)")
        print("4. Update Battery %    (현재 배터리 잔량 업데이트)")
        print("5. Connector Disconnected (플러그 해제)")
        print("\nq. Quit")
        
        choice = input("\nAction >> ").strip().lower()
        
        if choice == '1':
            send_camera(target_charger_id, True)
        elif choice == '2':
            send_camera(target_charger_id, False)
        elif choice == '3':
            try:
                initial_bat = float(input("Enter Initial Vehicle Battery % (0-100, Default 30): ") or 30.0)
                send_connector(target_charger_id, "CONNECTED", battery=initial_bat, user_id=active_user_id)
                print(f"\n✅ 커넥터가 {initial_bat}% 상태로 연결되었습니다.")
            except ValueError:
                print("Invalid percentage.")
        elif choice == '4':
            try:
                bat = float(input("Enter Vehicle Battery % (0-100): "))
                send_connector(target_charger_id, "CONNECTED", battery=bat, user_id=active_user_id)
                print(f"\n🔋 배터리가 {bat}%로 업데이트되었습니다.")
            except ValueError:
                print("Invalid percentage.")
        elif choice == '5':
            send_connector(target_charger_id, "DISCONNECTED", battery=0)
            print("\n✅ 커넥터가 해제되었습니다.")
        elif choice == 'q':
            break
