#include <WiFi.h>
#include <HTTPClient.h>

// =========================
// WiFi 정보
// =========================
const char* ssid = "Wjdghks";
const char* password = "wjdghks1212";

// =========================
// 서버 주소
// =========================
const char* serverUrl =
"http://211.253.31.143:8000/api/v1/hardware/connectors";

// =========================
// 배터리 변수
// =========================
float voltage = 0;
float percent = 0;
float prevVoltage = 0;
float smoothPercent = 0;

bool chargingStarted = false;
unsigned long chargeStartTime = 0;

float startPercent = 0;
bool firstRun = true;

// [추가] 이전 상태를 기억하여 중복 전송 방지
String lastStatus = "UNKNOWN";

// =========================
// 🔋 실제 측정 기준값
// =========================
int FULL_RAW = 2550;
int EMPTY_RAW = 2000;

// =========================
// 80% 제한 모드
// =========================
bool limit80Mode = true;

// =========================
// 충전 상태 문자열
// =========================
String chargeStatus = "DISCONNECTED";

// =========================
// ESP32 ADC 핀
// =========================
int analogPin = 34;

// =========================
// setup
// =========================
void setup() {

  Serial.begin(115200);

  analogReadResolution(12);

  WiFi.begin(ssid, password);

  Serial.print("WiFi 연결 중");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi 연결 완료!");
}

// =========================
// loop
// =========================
void loop() {

  // =========================
  // ADC 여러 번 읽기
  // =========================
  int readings[10];
  int sum = 0;

  for (int i = 0; i < 10; i++) {

    readings[i] = analogRead(analogPin);

    sum += readings[i];

    delay(5);
  }

  int avgRaw = sum / 10;

  // =========================
  // 노이즈 계산
  // =========================
  int maxVal = readings[0];
  int minVal = readings[0];

  for (int i = 1; i < 10; i++) {

    if (readings[i] > maxVal) maxVal = readings[i];

    if (readings[i] < minVal) minVal = readings[i];
  }

  int noise = maxVal - minVal;

  // =========================
  // 배터리 미연결 감지
  // =========================
  if (avgRaw < 1500 || avgRaw > 3000) {

    Serial.println("Battery not connected");

    smoothPercent = 0;
    percent = 0;
    voltage = 0;

    chargeStatus = "DISCONNECTED";

    chargingStarted = false;

    // [수정] 상태가 변했을 때만 한 번 전송
    if (lastStatus != "DISCONNECTED") {
      sendData(voltage, smoothPercent, chargeStatus);
      lastStatus = "DISCONNECTED";
    }

    delay(1000);

    return;
  }

  // =========================
  // 전압 계산
  // =========================
  voltage =
    avgRaw * (3.3 / 4095.0) * 2;

  // =========================
  // 이상 전압 제거
  // =========================
  if (voltage > 4.3) {

    Serial.println("Invalid voltage");

    smoothPercent = 0;
    percent = 0;

    chargeStatus = "DISCONNECTED";

    chargingStarted = false;

    // [수정] 상태가 변했을 때만 한 번 전송
    if (lastStatus != "DISCONNECTED") {
      sendData(voltage, smoothPercent, chargeStatus);
      lastStatus = "DISCONNECTED";
    }

    delay(1000);

    return;
  }

  // =========================
  // 퍼센트 계산
  // =========================
  percent =
    (float)(avgRaw - EMPTY_RAW)
    /
    (FULL_RAW - EMPTY_RAW)
    * 100.0;

  // =========================
  // 작은 변화 무시
  // =========================
  if (abs(percent - smoothPercent) < 3) {

    percent = smoothPercent;
  }

  // 범위 제한
  if (percent > 100) percent = 100;

  if (percent < 0) percent = 0;

  // =========================
  // 첫 실행 시 즉시 표시
  // =========================
  if (firstRun) {

    smoothPercent = percent;

    prevVoltage = voltage;

    firstRun = false;
  }

  // =========================
  // 충전 시작 감지
  // =========================
  if (voltage > prevVoltage + 0.03 &&
      !chargingStarted) {

    chargingStarted = true;

    chargeStartTime = millis();

    startPercent = smoothPercent;
  }

  // =========================
  // 충전 중 배터리 급상승 방지
  // =========================
  if (chargingStarted) {

    // 충전 시작 후 8초 동안은
    // 기존 퍼센트 유지
    if (millis() - chargeStartTime < 8000) {

      percent = startPercent;
    }

    // 이후에도 한 번에 많이 안오르게 제한
    else {

      // 현재 표시값보다
      // 최대 0.5%만 증가 가능
      if (percent > smoothPercent + 0.5) {

        percent = smoothPercent + 0.5;
      }
    }
  }

  // =========================
  // 충전 중 감소 방지
  // =========================
  if (chargingStarted &&
      percent < smoothPercent) {

    percent = smoothPercent;
  }

  // =========================
  // 부드럽게 변경
  // =========================
  smoothPercent =
    (percent * 0.05)
    +
    (smoothPercent * 0.95);

  // =========================
  // 80% 제한 모드
  // =========================
  if (limit80Mode &&
      smoothPercent >= 80) {

    smoothPercent = 80;

    chargingStarted = false;

    chargeStatus = "FULL";

    Serial.println("Charging Complete (80%)");
  }

  // =========================
  // 충전 상태 결정
  // =========================
  else if (chargingStarted) {

    chargeStatus = "CHARGING";
  }

  else {

    chargeStatus = "CONNECTED";
  }

  // =========================
  // 충전 종료 감지
  // =========================
  if (voltage <= prevVoltage) {

    chargingStarted = false;
  }

  // =========================
  // 서버 전송 (연결 상태에서는 실시간성 위해 3초마다 지속 전송)
  // =========================
  sendData(
    voltage,
    smoothPercent,
    chargeStatus
  );
  
  // 상태 갱신 (다시 해제되었을 때 감지할 수 있도록)
  lastStatus = chargeStatus;

  // =========================
  // 시리얼 출력
  // =========================
  Serial.print("RAW: ");
  Serial.print(avgRaw);

  Serial.print(" | Noise: ");
  Serial.print(noise);

  Serial.print(" | Voltage: ");
  Serial.print(voltage);

  Serial.print(" V | Battery: ");
  Serial.print((int)smoothPercent);

  Serial.print(" % | Status: ");
  Serial.println(chargeStatus);

  prevVoltage = voltage;

  delay(3000);
}

// =========================
// 서버 전송
// =========================
void sendData(
  float voltage,
  float percent,
  String status
) {

  if (WiFi.status() == WL_CONNECTED) {

    HTTPClient http;

    http.begin(serverUrl);

    http.addHeader(
      "Content-Type",
      "application/json"
    );

    String json = "{";

    json += "\"charger_id\":\"3682\",";
    json += "\"status\":\"" + status + "\",";
    json += "\"voltage\":" + String(voltage) + ",";
    json += "\"battery\":" + String((int)percent);

    json += "}";

    int httpResponseCode =
      http.POST(json);

    Serial.print("📡 Server Response: ");
    Serial.println(httpResponseCode);

    http.end();
  }

  else {

    Serial.println("🌐 WiFi 연결 끊김");

    WiFi.begin(ssid, password);
  }
}
