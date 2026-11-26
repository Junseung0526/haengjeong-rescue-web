# 행정 구조대 · 웹 프론트엔드

사업 참여자 인건비 정산 행정을 한 화면에서 처리하는 업무용 웹입니다.
부서별 엑셀 취합 → 검증 → 인건비 계산 → 4대보험 귀속 → 지급·제출 양식 출력까지, 월 마감 흐름을 따라 화면을 구성했습니다.

> 개인 작업 중인 프론트엔드입니다. 백엔드(FastAPI)는 별도 저장소 [YC-CapstoneDesign-5/Back](https://github.com/YC-CapstoneDesign-5/Back)에 있고, 이 프론트는 그 API를 그대로 사용합니다.

## 주요 화면

| 경로 | 화면 | 기능 코드 |
|---|---|---|
| `/` | 현황 대시보드 (월 마감 진행, 오늘의 브리핑, 에이전트 활동) | FN-08 |
| `/participants` | 참여자 관리 | FN-01 |
| `/attendance` | 전자출석 | FN-12 |
| `/submissions` | 부서 제출 포털 | FN-09 |
| `/ingest` | 엑셀 취합 (미리보기 → 확정 반영 → 취소) | FN-02 |
| `/validation` | 검증 오류 | FN-05 |
| `/changes` | 전월 대비 변경 (계좌 변경 확인 등) | FN-11 |
| `/ocr` | 스캔 출석부 대조 | FN-06 |
| `/payroll` | 인건비 계산 (월별 집계·개인별 계산·계산 규칙, 계산 근거 보기) | FN-03 |
| `/settlements` | 중도 입·퇴사 정산 | FN-14 |
| `/insurance` | 4대보험 귀속 | FN-04 |
| `/exports` | 제출 양식 출력 | FN-07·16 |
| `/deadlines` | 마감·독촉 | FN-15 |
| `/notifications` | 알림 | FN-15 |
| `/admin/*` | 계정·권한, 부서, 감사 로그, 오류 이력, 개인정보 파기 | NFR-08·09·10·18 |

메뉴는 로그인한 사용자의 역할에 따라 보이는 항목이 달라집니다.

## 화면 특징

- **월 마감 진행 카드**: 제출 → 검증 → 인건비 → 4대보험 → 지급 5단계를 실제 API 수치로 판정합니다. 막힌 단계와 이유를 보여주고, 누르면 해당 화면으로 이동합니다.
- **오늘의 브리핑**: 현황 수치에서 지금 처리할 일을 문장으로 정리합니다. 문장마다 출처·사용한 수치·판단 규칙을 펼쳐 볼 수 있고, 담당자가 '확인 표시'를 남길 수 있습니다. 규칙 기반 요약이며 외부 언어 모델을 호출하지 않습니다.
- **에이전트 활동**: 30초마다 수치를 다시 확인하고, 이전과 달라진 결과는 '확인 필요'로 담당자에게 넘깁니다.
- **계산 근거 보기**: 개인별 급여에서 금액이 쌓이는 순서, 화면 검산 결과, 적용된 규칙 버전을 보여줍니다.
- **화면 안내 투어**: 처음 여는 화면마다 단계별 안내가 뜨고, 상단 `?` 버튼으로 다시 볼 수 있습니다.
- **빠른 이동**: `⌘K`(Windows `Ctrl+K`)로 메뉴·추천 할 일 검색, `/`로 표 검색창 이동.
- **상태 유지**: 사업·부서·업무월 범위는 모든 화면에 공통 적용되고, 탭·필터·검색어는 주소(`?tab=` 등)에 남아 새로고침·공유해도 유지됩니다.
- KRDS(범정부 디자인 시스템) 색·타이포 기준, Pretendard 글꼴.

## 기술 스택

- React 19, React Router 7, Vite 8
- lucide-react (아이콘), Oxlint (린트)
- 상태 관리 라이브러리 없이 React Context + `useApi` 훅

## 시작하기

Node.js 20 이상이 필요합니다.

```bash
npm install
```

백엔드 주소를 `.env.local`에 적습니다 (커밋하지 않는 파일).

```bash
API_URL=https://your-backend.example.com
```

```bash
npm run dev
```

개발 서버가 `/api`, `/health` 요청을 `API_URL`로 넘깁니다. `API_URL`이 없으면 `http://localhost:8000`(로컬 FastAPI)을 사용합니다.

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | `dist`에 배포용 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | Oxlint 검사 |

## CI/CD · Vercel 배포

`.github/workflows/ci.yml`이 다음을 자동으로 합니다.

| 언제 | 하는 일 |
|---|---|
| PR을 올리거나 고칠 때 | 린트·빌드 검사 → 통과하면 Vercel **미리보기** 배포 (주소는 Actions 실행 요약에 표시) |
| `main`에 머지될 때 | 린트·빌드 검사 → 통과하면 Vercel **운영** 배포 |

`vercel.json`이 `/api`, `/health`를 백엔드로 넘기고, 나머지 경로는 `index.html`로 돌려줍니다.
Vercel의 Git 자동 배포는 꺼 두었습니다(`git.deploymentEnabled: false`). 배포는 검사를 통과한 뒤 Actions에서만 일어납니다.

### 처음 한 번 설정

1. Vercel에서 프로젝트를 만듭니다. 로컬에서 `npx vercel link`를 실행하면 `.vercel/project.json`에 `orgId`, `projectId`가 생깁니다 (이 폴더는 커밋하지 않습니다).
2. Vercel 계정 설정 → Tokens에서 토큰을 만듭니다.
3. GitHub 저장소 → Settings → Secrets and variables → Actions에 세 값을 등록합니다.
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

시크릿이 없으면 검사만 하고 배포 단계는 건너뜁니다.

### 백엔드 주소 바꾸기

지금은 임시 터널(trycloudflare) 주소를 쓰고 있어서, 터널을 다시 열면 주소가 바뀝니다.
그때는 `vercel.json`의 두 `destination` 주소를 새 주소로 고쳐 PR로 올리면 됩니다.

## 배포할 때 주의

- 프론트는 API를 상대 경로(`/api`)로 호출하고, 백엔드에는 CORS 설정이 없습니다. 그래서 **정적 호스팅만으로는 동작하지 않습니다.**
  화면 파일과 `/api`를 같은 주소에서 제공해야 합니다. 예: nginx가 `dist`를 내보내고 `/api`를 백엔드로 넘기는 구성, 또는 Vercel/Netlify의 경로 프록시.
- 주소 기반 라우팅(`BrowserRouter`)이라, 서버가 모르는 경로는 `index.html`을 돌려주도록 설정해야 새로고침해도 404가 나지 않습니다.
- 개인정보·급여를 다루므로 실제 운영은 내부망 배포를 전제로 합니다 (NFR-05).

## 폴더 구조

```
.
├─ index.html
├─ vite.config.js        # 개발 서버 프록시 (/api → API_URL)
├─ public/               # 파비콘
└─ src/
   ├─ main.jsx
   ├─ App.jsx            # 로그인, 레이아웃(사이드바·상단 바), 라우팅, ⌘K 명령 창
   ├─ api.js             # fetch 래퍼, 토큰, 오류 메시지 정리
   ├─ ui.jsx             # 공통 컴포넌트(표·탭·모달·카드 등), useApi, useUrlState, 상태 라벨
   ├─ agents.jsx         # 에이전트 정의, 화면 안내 투어, 로그인 인트로
   ├─ index.css          # 전체 스타일
   └─ pages/             # 화면별 컴포넌트
```
