# 🎯 VIUM 영구 CCTV 터널링(FRP) 구축 가이드

본 문서는 ngrok의 24시간 주소 만료 문제를 해결하고, **KT Cloud 서버(211.253.31.143)**를 활용하여 라즈베리파이 CCTV의 **영구적인 고정 접속 주소**를 만들기 위한 Step-by-Step 가이드입니다. 

팀원 누구나 이 문서의 명령어를 복사/붙여넣기 하는 것만으로 완벽한 인프라를 구축할 수 있도록 작성되었습니다.

---

## 📌 0. 사전 준비 사항 (매우 중요)

가장 먼저 **KT Cloud 콘솔(웹사이트)**에 접속하여 방화벽(포트 포워딩)을 열어주어야 합니다.
*   **TCP 7000**: FRP 서버와 라즈베리파이가 몰래 통신할 '비밀 통로'입니다.
*   **TCP 8080**: 우리가 웹 브라우저나 웹페이지에서 최종적으로 영상을 볼 '출구'입니다.

> ⚠️ **주의**: 위 두 개의 포트가 KT Cloud 방화벽 설정에서 열려있지 않으면 아무리 세팅을 잘해도 접속이 되지 않습니다.

---

## 🚀 Phase 1. KT Cloud (서버) 세팅하기

KT Cloud 서버에 접속하여 라즈베리파이의 신호를 받아줄 '중계소(FRP Server)'를 설치합니다.

### 1-1. KT Cloud 서버 접속
터미널(또는 PuTTY)을 열고 서버에 접속합니다.
```bash
ssh root@211.253.31.143
```

### 1-2. FRP 다운로드 및 압축 해제
```bash
# 작업 폴더로 이동
cd /usr/local/src

# 최신 FRP 다운로드 (리눅스 64비트 용)
wget https://github.com/fatedier/frp/releases/download/v0.58.1/frp_0.58.1_linux_amd64.tar.gz

# 압축 풀기
tar -zxvf frp_0.58.1_linux_amd64.tar.gz

# 폴더 이름 변경 (관리하기 쉽게)
mv frp_0.58.1_linux_amd64 frp
cd frp
```

### 1-3. 서버 설정 파일(frps.toml) 수정
서버 설정 파일을 열어 포트를 지정합니다.
```bash
# 기존 설정 삭제 후 새로 작성
rm frps.toml
nano frps.toml
```
아래 내용을 복사해서 붙여넣고 저장(`Ctrl+O`, `Enter`, `Ctrl+X`)합니다.
```toml
bindPort = 7000
```

### 1-4. 백그라운드 실행 (PM2 활용)
서버가 꺼지지 않도록 기존에 설치되어 있는 PM2를 이용하여 실행합니다.
```bash
pm2 start ./frps --name "frp-server" -- -c ./frps.toml
pm2 save
```
*성공 확인:* `pm2 list`를 쳤을 때 `frp-server`가 `online`으로 떠있으면 완벽합니다! 🎉

---

## 🚗 Phase 2. 라즈베리파이 (클라이언트) 세팅하기

이제 라즈베리파이로 넘어가서, 카메라 영상을 KT Cloud 서버로 쏴주는 '전송기(FRP Client)'를 설치합니다.

### 2-1. 라즈베리파이 터미널 열기
라즈베리파이에 모니터를 연결하거나 SSH로 접속하여 터미널을 엽니다.

### 2-2. FRP 다운로드 (ARM 버전)
```bash
cd ~

# 라즈베리파이용(ARM64) 다운로드
wget https://github.com/fatedier/frp/releases/download/v0.58.1/frp_0.58.1_linux_arm64.tar.gz
# 만약 라즈베리파이 OS가 32비트라면 아래 주소 사용:
# wget https://github.com/fatedier/frp/releases/download/v0.58.1/frp_0.58.1_linux_arm.tar.gz

# 압축 풀기
tar -zxvf frp_0.58.1_linux_arm64.tar.gz
mv frp_0.58.1_linux_arm64 frp
cd frp
```

### 2-3. 클라이언트 설정 파일(frpc.toml) 수정
라즈베리파이에서 서버로 어떻게 데이터를 보낼지 설정합니다.
```bash
rm frpc.toml
nano frpc.toml
```
아래 내용을 복사해서 붙여넣고 저장합니다. (자신의 환경에 맞게 `localPort` 확인!)
```toml
# 접속할 KT Cloud 서버 주소
serverAddr = "211.253.31.143"
serverPort = 7000

# CCTV 영상 스트리밍 터널링 규칙
[[proxies]]
name = "cctv-stream"
type = "tcp"
localIP = "127.0.0.1"
localPort = 5000       # ⚠️ 라즈베리파이에서 송출 중인 Flask 영상 포트 (5000이 아니면 수정하세요!)
remotePort = 8080      # KT Cloud를 통해 밖으로 보여질 포트
```

### 2-4. 라즈베리파이에서 백그라운드 실행
```bash
# nohup을 사용하여 백그라운드에서 무한 실행
nohup ./frpc -c ./frpc.toml > frpc.log 2>&1 &
```
*성공 확인:* 터미널에 `cat frpc.log`를 쳤을 때 `start proxy success`라는 문구가 보이면 터널 개통 성공입니다! 🎊

---

## 🎯 Phase 3. 최종 확인 및 웹 페이지 적용

모든 세팅이 끝났습니다. 이제 ngrok은 완전히 지워버리셔도 됩니다.

1. **브라우저 테스트**: 스마트폰이나 노트북의 인터넷 브라우저 주소창에 아래 주소를 입력해 보세요.
   👉 `http://211.253.31.143:8080/video` (Flask 라우터 이름에 따라 `/video_feed` 등 다를 수 있음)
   영상이 잘 나온다면 인프라 구축이 완벽하게 성공한 것입니다.

2. **웹 UI 적용**: 프론트엔드 담당자에게 위에서 확인한 주소를 전달해주면, `AdminDashboard.tsx`에 해당 영구 주소를 반영하여 관제 시스템이 완성됩니다.

고생하셨습니다! 이제 24시간 내내 끊기지 않는 강력한 VIUM 스마트 관제 인프라가 완성되었습니다.