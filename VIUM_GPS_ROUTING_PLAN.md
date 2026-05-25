# VIUM 프로젝트: 지능형 GPS 및 길찾기(경로 표시) 구현 마스터 플랜

## 1. 개요 및 기획 변경 히스토리

### 1.1 초기 기획 및 변경 사유
*   **초기 기획 (Phase 3)**: 'Geo-Fencing'을 이용한 도착 전 선점 알림 기능 구상.
*   **기획 변경**: 사용자의 날카로운 피드백 반영. 가는 중이니 비워두세요 식의 선점 기능은 충전기가 비어있는 시간(유휴 시간)을 인위적으로 늘려 우리 프로젝트의 핵심 목표인 **'충전소 회전율 극대화'에 완벽하게 정면으로 배치되는 안티 패턴(Anti-pattern)**이므로 과감히 폐기함.
*   **최종 목표**: 전기차 충전소 앱에 필수적인 '현재 내 위치(GPS)'를 확인하고, 원하는 충전소까지의 '경로(Line)'와 '거리/예상 시간'을 지도 위에 직접 그려주는 직관적인 길찾기 기능 구현.

### 1.2 카카오 모빌리티 API 분석 결과
사용자가 제안한 카카오 모빌리티 자동차 길찾기 REST API 사양서를 정밀 분석한 결과:
*   **사용 가능 여부**: 100% 사용 가능. 일 5,000건 무료 쿼터 제공으로 개인/데모 프로젝트 운영에 차고 넘침.
*   **핵심 활용 데이터**: 응답 JSON의 routes[0].sections[].roads[].vertexes 배열. 이 좌표들을 이어 붙이면 단순 직선이 아닌 실제 도로를 따라가는 구불구불한 주행 경로를 완벽하게 그릴 수 있음.
*   **부가 정보 활용**: distance(총 거리), duration(예상 소요 시간) 데이터를 추출하여 사용자 UI에 실시간 안내 가능.

---

## 2. 아키텍처 및 시스템 설계 (Architecture Design)

### 2.1 보안 중심 데이터 플로우 (Backend Proxy)
API 키 탈취 방지를 위해 클라이언트가 카카오 서버를 직접 호출하지 않고, **백엔드(FastAPI)를 경유(Proxy)하는 구조** 채택.

1.  **Client (React)**: 내 GPS 좌표(origin)와 목적지 충전소 좌표(destination)를 담아 백엔드로 요청.
2.  **Server (FastAPI)**: .env에 숨겨둔 KAKAO_REST_API_KEY를 헤더에 장착하여 카카오 모빌리티 서버로 REST API 호출.
3.  **Kakao Server**: 복잡한 도로 노드 데이터(vertexes)와 요약 정보 계산 후 응답.
4.  **Server (FastAPI)**: 불필요한 데이터를 가지치기(Parsing)하고 필수 정보만 Client로 반환.
5.  **Client (React)**: 수신된 데이터를 바탕으로 카카오맵 SDK의 Polyline 객체를 생성하여 지도 위에 경로 렌더링.

### 2.2 사용자 경험(UX) 설계
*   **내 위치 탐색**: 화면 우측 하단의 [내 위치] 버튼 클릭 시 HTML5 Geolocation API를 통해 현재 위치를 잡고 파란색 펄스(Pulse) 마커 렌더링.
*   **원클릭 길찾기**: 충전소 상세 정보창(StationModal)에서 [경로 보기] 클릭 시 길찾기 즉시 실행.
*   **오토 포커스(Auto-Fit)**: 경로가 그려지면, 출발지와 도착지가 모두 화면에 들어오도록 지도의 레벨(Zoom)과 중심 좌표가 자동으로 애니메이션 이동.

---

## 3. 세부 구현 스텝 (Implementation Steps)

### Step 1. 백엔드 인프라 구축 (FastAPI)
1.  **환경 변수 추가**: .env 파일에 KAKAO_REST_API_KEY 등록.
2.  **API 엔드포인트 생성**: vium-backend/app/api/v1/endpoints.py에 GET /directions 라우터 신설.
3.  **통신 로직**: httpx 또는 requests 라이브러리를 사용하여 카카오 모빌리티 API(https://apis-navi.kakaomobility.com/v1/directions) 호출.

### Step 2. 프론트엔드 통신 및 상태 관리 (React/Zustand)
1.  **API Client**: vium-web/src/services/apiClient.ts에 getDirections(origin, destination) 함수 추가.
2.  **Store 확장**: vium-web/src/store/stationStore.ts에 routePath (위경도 배열), routeSummary (거리, 시간 객체) 상태 변수 추가.

### Step 3. 지도 렌더링 엔진 고도화 (Kakao Map SDK)
1.  **내 위치 마커**: vium-web/src/components/station/StationMap.tsx에 Geolocation 기반 내 위치 마커 로직 이식.
2.  **경로 선 그리기**: stationStore의 routePath 데이터를 감지하여 카카오맵 Polyline (선 두께 5, 색상 보라색 등) 컴포넌트 렌더링.
3.  **바운딩 박스 제어**: LatLngBounds 객체를 사용하여 경로가 전체적으로 보이도록 map.setBounds() 호출.

### Step 4. UI/UX 연동 (Station Modal)
1.  **버튼 추가**: vium-web/src/components/station/StationModal.tsx에 [길찾기 시작] 액션 버튼 배치.
2.  **정보 표시**: 경로 탐색 성공 시 예상 소요시간: 12분 / 거리: 4.2km 요약 정보 노출.

---

## 4. 사전 준비 사항 (Prerequisites)
본 작업을 시작하기 전, 다음 단계의 개발자는 반드시 아래 사항을 확인하십시오.

*   [ ] **카카오 디벨로퍼스 REST API 키 발급 여부 확인** (현재 JavaScript 키 089928ca...와는 다른, 백엔드용 키가 필요함).
*   [ ] 브라우저에서 Geolocation 권한 허용 동의 프롬프트가 정상적으로 작동하는지 로컬 환경(localhost 또는 https)에서 점검.
