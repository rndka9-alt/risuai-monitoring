# RisuAI Monitoring

RisuAI 프록시 인프라의 모니터링 대시보드.
Docker 컨테이너 로그, 퍼포먼스 메트릭, 에러 리포팅을 실시간으로 제공한다.

## 런타임 환경

- **RisuAI를 Docker로 구동하는 환경을 전제로 한다.**
- Docker socket(`/var/run/docker.sock`)에 접근하여 컨테이너 로그와 상태를 수집한다.
- 모니터링 대상: sync, with-sqlite, caddy, risuai 컨테이너

## 설계 우선순위

1. **P1 — 관찰만**: 모니터링 대상 서비스의 동작에 영향을 주지 않는다. 읽기 전용.
2. **P2 — 경량**: 최소 리소스로 동작한다. 모니터링 도구가 모니터링 대상보다 무거워선 안 된다.
3. **P3 — 실시간**: 로그와 메트릭을 실시간(SSE)으로 전달한다.

## Docker 실행

Docker 구성은 `risu-files/custom-codes/risuai-network/` 레포에서 관리한다.
이 프로젝트 단독으로 `docker build/run`하지 않고, network 레포의 `docker-compose.yml`로 실행한다.

## 기술 스택

- **서버**: Node.js 20 + TypeScript (프레임워크 없음, `node:http` 직접 사용)
- **클라이언트**: React + TypeScript + TailwindCSS v4 + TanStack Query
- **빌드**: 서버 esbuild, 클라이언트 Vite

## Git

- 커밋 시 `/commit-with-context`를 사용하여 의사결정 컨텍스트를 보존한다.
- 후속 작업 시 `git log`를 확인하여 기존 결정 배경과 기각된 방향을 참조한다.

## 코딩 컨벤션

- TypeScript에서 `as` 타입단언을 사용하지 않는다. interface의 index signature, 제네릭, 타입 가드 등으로 해결한다.
- `index.ts`에는 named re-export 문만 기재한다. 구현 코드를 넣지 않는다.

### 프론트엔드 구조

```
src/
  pages/
    PageName/
      index.ts         # named re-export만
      PageName.tsx     # 페이지 컴포넌트 (디렉터리명과 동일)
      components/      # 페이지 종속 컴포넌트 (재귀 구조)
        WidgetName/
          index.ts
          WidgetName.tsx
          components/  # 더 깊은 종속 컴포넌트 (재귀)
  components/          # 공용 컴포넌트 (페이지에 종속되지 않는 것만)
    ComponentName/
      index.ts
      ComponentName.tsx
      components/      # 종속 서브 컴포넌트 (재귀)
  hooks/
  utils/
```

접근 규칙:
- 외부에서는 `index.ts`로 export되는 것만 접근 가능
- 내부(자식)에서는 상위를 자유롭게 접근 가능
- 형제나 부모의 형제에 접근하려면 반드시 `index.ts`를 통해 접근
- `@/` alias로 `src/` 디렉터리 참조 가능

### 서버 구조

```
server/
  index.ts         # HTTP 서버 진입점
  config.ts        # 설정
  logger.ts        # [Monitor] 로거
```

## 문서

- API 엔드포인트, 환경변수, 프로젝트 구조 등 외부 인터페이스가 변경되면 README.md도 함께 업데이트한다.

## 테스트

- 테스트 파일은 소스 옆에 co-locate한다 (`parser.ts` → `parser.test.ts`).
- 코드 수정 후 `npm test`로 전체 테스트 통과 확인.
