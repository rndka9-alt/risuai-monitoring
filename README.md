# RisuAI Monitoring

RisuAI 프록시 인프라(sync, db-proxy, caddy, risuai)의 실시간 모니터링 대시보드.

Docker 컨테이너 로그를 수집하여 SSE로 브라우저에 스트리밍한다.

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

## API

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/logs/stream` | SSE — `init` (버퍼 일괄) + `log` (실시간) 이벤트 |
| `GET /api/logs?proxy=sync&level=error&limit=200` | REST 로그 조회 |
| `GET /api/health` | `{ "status": "ok" }` |

## 구조

```
server/                  # 백엔드 (Node.js, 프레임워크 없음)
├── index.ts             # HTTP 서버 + 라우팅 + 정적파일 서빙
├── config.ts            # 환경변수 기반 설정
├── logger.ts            # [Monitor] 로거
├── docker.ts            # Docker socket API + 스트림 디먹서
├── parsers.ts           # Sync/DB-Proxy/Caddy 로그 파서
├── log-collector.ts     # 컨테이너별 로그 수집 + 자동 재접속
├── log-store.ts         # 인메모리 링버퍼
└── sse.ts               # SSE 엔드포인트

src/                     # 프론트엔드 (React + TypeScript + Tailwind + TanStack Query)
├── pages/
│   └── Dashboard/
│       ├── Dashboard.tsx
│       └── components/
│           └── LogViewer/
├── hooks/
│   └── useLogStream.ts  # SSE 연결 훅
└── types.ts             # 서버-클라이언트 공유 타입
```

## 빌드

```bash
npm run build            # 클라이언트(Vite) + 서버(esbuild) 빌드
npm run build:client     # 클라이언트만
npm run build:server     # 서버만
npm start                # 프로덕션 서버 실행
```
