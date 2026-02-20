# MARS: Memory-Augmented Retrieval & Refactoring System

**AI 코드 수정의 의도를 기억하고, 영향 범위를 분석하며, RAG 기반으로 안전한 리팩터링을 지원하는 VSCode 확장**

---

## 문제 정의

AI 기반 코딩 도구(Cursor, Windsurf 등)는 개발 속도를 비약적으로 향상시켰지만, **의도 해석 불일치(Intent Mismatch)** 문제가 구조적으로 존재합니다:

- 사용자의 클릭·의도 정보가 구조화되지 않음
- 코드 수정의 전역 영향 범위가 계산되지 않음
- 수정 결과의 신뢰성을 보장하는 검증 체계가 부재함

MARS는 이 세 가지 문제를 **Structured Intent Memory**, **Blast Radius Engine**, **RAG Pipeline**으로 해결합니다.

---

## 아키텍처

```
┌─────────────────────────────────────────────────┐
│                  VSCode Extension                │
│                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ Commands  │  │  Sidebar UI  │  │ Status Bar│  │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  │
│       │               │                │         │
│  ┌────▼───────────────▼────────────────▼─────┐   │
│  │              Core Engine                   │   │
│  │                                            │   │
│  │  ┌─────────────┐  ┌──────────────────┐    │   │
│  │  │Intent Memory │  │ Blast Radius     │    │   │
│  │  │  (RAG)       │  │   Engine         │    │   │
│  │  │              │  │                  │    │   │
│  │  │ • Vector     │  │ • AST Parser     │    │   │
│  │  │   Store      │  │ • Dependency     │    │   │
│  │  │ • Embedding  │  │   Graph          │    │   │
│  │  │   Provider   │  │ • Risk Tagger    │    │   │
│  │  │ • RAG        │  │                  │    │   │
│  │  │   Pipeline   │  │                  │    │   │
│  │  └──────────────┘  └──────────────────┘    │   │
│  │                                            │   │
│  │  ┌─────────────────────────────────────┐   │   │
│  │  │         Mode Manager                │   │   │
│  │  │  • Beginner (Auto-suggest)          │   │   │
│  │  │  • Expert   (Manual approval)       │   │   │
│  │  └─────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────┘   │
│                                                   │
│  ┌────────────────────────────────────────────┐   │
│  │        React Webview (Sidebar Panel)       │   │
│  │  • Blast Radius Tree (색상 코딩)            │   │
│  │  • Intent Record / Search                  │   │
│  │  • Risk Badge / Score Bar                  │   │
│  │  • Mode Toggle (Beginner / Expert)         │   │
│  └────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

---

## 핵심 기능

### Layer 1 — Structured Intent Memory (RAG)

AI가 수정 요청을 받으면 해당 요청의 **의도, 범위, 위험 태그, 의존성 스냅샷**을 구조화하여 저장합니다.

- **Vector Store**: 코사인 유사도 기반 시맨틱 검색
- **Embedding Provider**: 로컬(transformers.js) / OpenAI API 듀얼 지원
- **RAG Pipeline**: 과거 유사 수정 사례를 실시간 검색하여 위험 회피

### Layer 2 — Blast Radius Engine

코드 수정 시 **의존성 그래프**를 추적하여 영향 반경을 계산합니다.

- **AST Parser**: ts-morph 기반 TypeScript AST 분석
- **Dependency Graph**: BFS/DFS로 호출 체인 추적
- **Risk Tagger**: 경로 패턴 + 키워드 기반 위험 태그 자동 분류
  - `auth`, `database`, `security`, `payment`, `api`, `validation`, `state`, `config`, `migration`, `test`

### Dual Mode — Beginner & Expert

| 기능 | Beginner | Expert |
|------|----------|--------|
| Blast Radius 분석 | 자동 | 수동 실행 |
| 위험 제안 | 자동 표시 | 수동 검토 |
| Intent 승인 | 자동 승인 (임계값 이하) | 명시적 승인 필요 |
| 경로 제외 | 불가 | 가능 |
| 가중치 조정 | 불가 | 가능 |

---

## 설치 및 빌드

### 사전 요구사항

- Node.js 18+
- VSCode 1.85+

### 빌드

```bash
# 의존성 설치
npm install
cd webview-ui && npm install && cd ..

# Extension 빌드
npm run build:ext

# Webview UI 빌드
npm run build:webview

# 전체 빌드
npm run build
```

### 개발 모드

```bash
# Extension 워치 모드
npm run watch

# Webview UI 개발 서버
cd webview-ui && npm run dev
```

### 테스트

```bash
npm test
```

---

## 사용법

### 1. Blast Radius 분석

1. TypeScript 파일에서 함수/클래스 이름에 커서를 올립니다.
2. `Ctrl+Shift+P` → **MARS: Analyze Blast Radius** 실행
3. 사이드바와 Blast Radius 트리뷰에서 영향 범위를 확인합니다.

### 2. Intent 기록

1. `Ctrl+Shift+P` → **MARS: Record Intent** 실행
2. 수정 의도를 자연어로 설명합니다.
3. RAG가 유사 과거 사례를 자동으로 검색하여 표시합니다.

### 3. Intent 검색

1. `Ctrl+Shift+P` → **MARS: Search Past Intents** 실행
2. 시맨틱 검색으로 과거 수정 의도를 탐색합니다.

### 4. 모드 전환

- 상태바의 **MARS: beginner/expert** 클릭
- 또는 `Ctrl+Shift+P` → **MARS: Toggle Beginner/Expert Mode**

---

## 설정

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `mars.mode` | `beginner` | 동작 모드 |
| `mars.embeddingProvider` | `local` | 임베딩 제공자 (`local` / `openai`) |
| `mars.openaiApiKey` | `""` | OpenAI API 키 |
| `mars.riskThreshold` | `60` | 위험도 경고 임계값 (0-100) |
| `mars.excludePaths` | `[]` | 분석 제외 경로 패턴 |

---

## 기술 스택

| 구성요소 | 기술 |
|---------|------|
| Extension | TypeScript + esbuild |
| AST 분석 | ts-morph |
| 로컬 임베딩 | @xenova/transformers (all-MiniLM-L6-v2) |
| 클라우드 임베딩 | OpenAI text-embedding-3-small |
| 벡터 저장 | JSON + Cosine Similarity |
| Webview UI | React + Vite |
| 스타일링 | CSS Variables (VSCode 테마 연동) |

---

## 프로젝트 구조

```
├── src/
│   ├── extension.ts                  # 확장 진입점
│   ├── commands/                     # VSCode 커맨드
│   ├── providers/                    # Webview, TreeView 프로바이더
│   ├── core/
│   │   ├── analysis/                 # Blast Radius Engine
│   │   │   ├── astParser.ts          # ts-morph AST 파서
│   │   │   ├── dependencyGraph.ts    # 의존성 그래프
│   │   │   ├── blastRadiusEngine.ts  # 영향 반경 계산
│   │   │   └── riskTagger.ts         # 위험 태그 분류
│   │   ├── memory/                   # Intent Memory (RAG)
│   │   │   ├── vectorStore.ts        # 벡터 저장/검색
│   │   │   ├── embeddingProvider.ts  # 임베딩 추상화
│   │   │   ├── intentStore.ts        # Intent CRUD
│   │   │   └── ragPipeline.ts        # RAG 파이프라인
│   │   └── modes/                    # 모드 관리
│   ├── models/                       # 데이터 모델
│   └── utils/                        # 유틸리티
├── webview-ui/                       # React 웹뷰
│   └── src/
│       ├── components/               # UI 컴포넌트
│       └── hooks/                    # React Hooks
└── test/                             # 테스트
```

---

## 기대 효과

1. **반복 수정 감소** — RAG가 과거 오류 패턴을 회피
2. **오류 발견 시점 조기화** — 수정 단계에서 리스크 사전 검출
3. **LLM 호출 감소** — 프롬프트 반복 제거로 비용 절감
4. **온보딩 기간 단축** — 신규 인력도 Intent 기반 맥락을 빠르게 이해
5. **설계 의도 보존** — 팀 단위 Intent Memory 공유로 프로젝트 일관성 유지

---

## 라이선스

MIT License
