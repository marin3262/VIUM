import requests
import sys

# [설정] 서버 주소 (로컬 테스트용)
SERVER_URL = "http://localhost:8000/api/v1/hardware/connectors"

def send_signal(charger_id, status, voltage, battery):
    payload = {
        "charger_id": charger_id,
        "status": status,
        "voltage": voltage,
        "battery": battery,
        "user_id": None,   # 유저 정보 미포함 (실제 아두이노와 동일)
        "is_guest": False
    }
    try:
        resp = requests.post(SERVER_URL, json=payload, timeout=5)
        print(f"📡 [{status}] Sent to {charger_id} -> HTTP {resp.status_code}")
    except Exception as e:
        print(f"❌ Failed to reach server: {e}")

if __name__ == "__main__":
    print("🚀 VIUM Pure Hardware Simulator")
    print("---------------------------------------------")
    target_id = input("🎯 Enter Target Charger ID (e.g., 3682, 3683): ").strip()
    if not target_id:
        print("❌ Charger ID is required.")
        sys.exit(1)
    
    print(f"\n⚡ Monitoring Charger: {target_id}")
    print("1: CONNECTED (Plugged in, Waiting)")
    print("2: CHARGING  (Charging Started!)")
    print("3: DISCONNECTED (Unplugged)")
    print("q: QUIT")
    print("---------------------------------------------")

    while True:
        cmd = input(f">> [{target_id}] Select Command: ").strip().lower()
        if cmd == '1': send_signal(target_id, "CONNECTED", 3.70, 55)
        elif cmd == '2': send_signal(target_id, "CHARGING", 4.10, 56)
        elif cmd == '3': send_signal(target_id, "DISCONNECTED", 3.75, 56)
        elif cmd == 'q': break
