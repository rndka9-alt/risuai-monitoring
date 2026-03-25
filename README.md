# RisuAI Monitoring

RisuAI 프록시 인프라의 실시간 모니터링 대시보드.

Docker 컨테이너 로그 수집, 헬스 체크, 퍼포먼스 메트릭, LLM 요청 추적을 제공한다.

**모니터링 대상**: sync, with-sqlite, remote-inlay, caddy, risuai

## 실행

### Docker Compose (권장)

[risuai-network](../risuai-network/) 프로젝트에서 관리한다.

```bash
# monitor만 띄우기
docker compose -f risu-files/custom-codes/risuai-network/docker-compose.yml \
  --profile monitor up -d

# 전체 프로필 조합
docker compose -f risu-files/custom-codes/risuai-network/docker-compose.yml \
  --profile sync --profile sqlite --profile monitor up -d
```

접속: **http://localhost:3002**

### 로컬 개발

```bash
npm install

# 클라이언트 (Vite dev server, /api → :3002 프록시)
npm run dev           # http://localhost:5173

# 서버 (별도 터미널)
npm run dev:server    # http://localhost:3002
```

Docker socket 접근이 필요하므로 Docker가 실행 중이어야 한다.

## 설정

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `PORT` | `3002` | 서버 포트 |
| `LOG_BUFFER_SIZE` | `5000` | 서버 인메모리 로그 보관 수 |
| `LOG_LEVEL` | `info` | 서버 로그 레벨 (debug/info/warn/error) |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker socket 경로 |
| `METRICS_RETENTION_MINUTES` | `180` | 메트릭 보존 기간 (분) |
| `SYNC_URL` | *(없음)* | Sync 서버 URL — LLM 스트림 abort에 필요 |

## API

### 로그

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/logs/stream` | SSE — `init` (버퍼 일괄) + `log` (실시간) 이벤트 |
| `GET /api/logs?proxy=sync&level=error&limit=200` | REST 로그 조회 |

### 헬스 & 메트릭

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/health` | 각 프록시의 상태(up/down/unknown), 응답 지연시간, 컨테이너 스탯(CPU%, 메모리) |
| `GET /api/metrics?bucket=60s` | RPS, 에러율, TTFB p50/p95 시계열. bucket: `5s` `10s` `30s` `60s`(기본) `1h` |

### LLM 스트림

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /_api/llm-event` | sync에서 push하는 LLM 스트림 이벤트 (start/end) |
| `GET /api/streams` | 활성 + 최근 완료 LLM 요청 목록 |
| `GET /api/streams/events` | SSE — 스트림 목록 변경 알림 (`change` 이벤트) |
| `GET /api/streams/:id/images` | 요청/응답 내 이미지 (base64) |
| `GET /api/streams/:id/response-body` | 응답 바디 (JSON 또는 ZIP 이미지 파싱) |
| `POST /api/streams/:id/abort` | sync로 스트림 중단 요청 (`SYNC_URL` 필요) |

## 구조

```
server/                      # 백엔드 (Node.js, 프레임워크 없음)
├── index.ts                 # HTTP 서버 + 라우팅 + 정적파일 서빙
├── config.ts                # 환경변수 기반 설정
├── logger.ts                # [Monitor] 로거
├── docker.ts                # Docker socket API + 스트림 디먹서
├── parsers.ts               # Sync/DB-Proxy/Caddy 로그 파서
├── log-collector.ts         # 컨테이너별 로그 수집 + 자동 재접속
├── log-store.ts             # 인메모리 링버퍼
├── sse.ts                   # SSE 엔드포인트
├── health-poller.ts         # 주기적 헬스 체크 + 컨테이너 스탯 수집
├── metrics-aggregator.ts    # RPS/에러율/TTFB 시계열 집계
└── llm-store.ts             # LLM 요청 추적 + 이미지/ZIP 파싱

src/                         # 프론트엔드 (React + TypeScript + Tailwind + TanStack Query)
├── types.ts                 # 서버-클라이언트 공유 타입
├── components/
│   └── JsonTree/            # 중첩 JSON 트리 뷰어
├── hooks/
│   ├── useLogStream.ts      # SSE 로그 스트림
│   ├── useHealth.ts         # 헬스 폴링
│   ├── useMetrics.ts        # 메트릭 폴링
│   ├── useStreams.ts         # LLM 스트림 목록 (SSE + 폴링)
│   ├── useStreamImages.ts   # 스트림 이미지 조회
│   ├── useStreamResponseBody.ts
│   ├── useAbortStream.ts    # 스트림 중단
│   └── useTick.ts           # 주기적 시간 갱신
└── pages/
    └── Dashboard/
        ├── Dashboard.tsx
        └── components/
            ├── HealthBar/       # 프록시 상태 카드 (상태, 지연, CPU, 메모리)
            ├── MetricsPanel/    # RPS/TTFB/에러율 시계열 차트 (Recharts)
            ├── ActiveStreams/   # 활성/최근 LLM 요청 목록
            └── LogViewer/       # 실시간 로그 필터링 + 자동스크롤
```

## 빌드

```bash
npm run build            # 클라이언트(Vite) + 서버(esbuild) 빌드
npm run build:client     # 클라이언트만
npm run build:server     # 서버만
npm start                # 프로덕션 서버 실행
```
