# MARS 프로그램 확인 방법

완성된 MARS 확장을 확인하는 단계별 가이드입니다.

---

## 1. 사전 요구사항 확인

- **Node.js 18 이상**  
  ```bash
  node -v   # v18.x.x 이상
  ```
- **VSCode 1.85 이상** (또는 Cursor)

---

## 2. 의존성 설치 및 빌드

프로젝트 루트에서 다음을 순서대로 실행합니다.

```bash
# 1) 루트 의존성 설치
npm install

# 2) Webview UI 의존성 설치
cd webview-ui && npm install && cd ..

# 3) 전체 빌드 (Extension + Webview)
npm run build
```

**성공 시 예시:**
- `[MARS] Build complete.` (Extension)
- `✓ built in ...ms` (Webview)

---

## 3. 단위 테스트 실행

```bash
npm test
```

**확인:** `Test Files 2 passed (2)`, `Tests 24 passed (24)` 출력

---

## 4. VSCode에서 확장 실행 (개발 모드)

1. **창 제목을 "MARS"로 보이게 하려면**  
   **File → Open Workspace from File…** 에서 이 프로젝트의 **`MARS.code-workspace`** 를 연다.  
   그러면 창 제목·검색창 등에 긴 폴더명 대신 **MARS** 가 표시된다.
2. 이 프로젝트 폴더를 **VSCode(또는 Cursor)로 연다.**
3. **F5** 키를 누르거나, **Run and Debug** 패널에서 **"Launch Extension"** 을 선택한 뒤 실행(녹색 재생 버튼).
4. **Extension Development Host** 창이 새로 열리면 확장이 로드된 상태이다.  
   이 창도 워크스페이스로 **MARS.code-workspace** 를 열어 두면 제목이 **MARS** 로 보인다.

**Extension Development Host가 열리지 않을 때**
- `.vscode/launch.json` 이 있어야 F5가 동작합니다. (프로젝트에 포함됨)
- 상단 구성에서 **"Launch Extension"** 이 선택되어 있는지 확인하세요.
- 먼저 터미널에서 `npm run build` 를 한 번 실행한 뒤, **"Launch Extension (no pre-build)"** 로 실행해 보세요.
- 디버그 콘솔에 에러가 있으면 그 메시지를 확인하세요.

---

## 5. 동작 확인 체크리스트

### 5-1. MARS 패널 표시

- 왼쪽 **Activity Bar**에 **로켓 아이콘(MARS)** 이 보이는지 확인.
- 클릭 시 **MARS Panel**과 **Blast Radius** 트리가 사이드바에 보이는지 확인.
- **상태바(오른쪽 하단)** 에 `MARS: beginner` 또는 `MARS: expert` 가 보이는지 확인.

### 5-2. Blast Radius 분석

1. Extension Development Host 창에서 **TypeScript/JavaScript 프로젝트**를 연다  
   (이 MARS 프로젝트 자체 또는 다른 TS 프로젝트).
2. `.ts` / `.tsx` 파일을 열고, **함수명이나 클래스명** 위에 커서를 둔다.
3. **명령 팔레트** (`Ctrl+Shift+P` / `Cmd+Shift+P`) → **"MARS: Analyze Blast Radius"** 실행.
4. **확인:**
   - 알림에 영향 파일 수·위험도 메시지가 뜨는지.
   - MARS Panel의 **Blast Radius** 섹션에 대상 심볼·영향 파일 트리·위험 점수 바가 보이는지.
   - **Blast Radius** 트리뷰에 "Target", "Distance N" 노드가 보이는지.

### 5-3. Intent 기록

1. MARS Panel에서 **Record Intent** 섹션을 연다.
2. **수정 의도 설명**에 예: `사용자 데이터 마스킹 정책 변경` 입력.
3. (선택) 대상 파일·심볼을 쉼표로 구분해 입력.
4. **"Auto-Analyze & Record"** 또는 **"Record Intent"** 버튼 클릭.
5. **확인:**
   - Intent Memory 목록에 새 항목이 추가되는지.
   - Beginner 모드일 때 제안 알림이 뜨는지.

### 5-4. Intent 검색 (RAG)

1. **Intent Memory** 섹션의 검색창에 예: `인증` 또는 `마스킹` 입력 후 **Search** 클릭.
2. **확인:** 유사도와 함께 과거 Intent가 표시되는지.
3. 또는 **명령 팔레트** → **"MARS: Search Past Intents"** 실행 후 검색어 입력해 동일하게 확인.

### 5-5. 모드 전환

1. MARS Panel의 **Mode** 섹션에서 **Beginner** / **Expert** 토글 클릭.
2. **확인:** 상태바 텍스트가 `MARS: beginner` ↔ `MARS: expert` 로 바뀌는지.
3. 또는 상태바의 **MARS: ...** 를 클릭해 전환되는지 확인.

### 5-6. 명령 팔레트

- `Ctrl+Shift+P` (Windows/Linux) 또는 `Cmd+Shift+P` (Mac) 후 아래 명령이 보이는지 확인:
  - **MARS: Analyze Blast Radius**
  - **MARS: Record Intent**
  - **MARS: Search Past Intents**
  - **MARS: Toggle Beginner/Expert Mode**

---

## 6. 문제 발생 시

| 증상 | 확인 사항 |
|------|------------|
| MARS 아이콘이 안 보임 | `npm run build` 후 Extension Development Host 창을 **완전히 닫았다가 F5로 다시 실행**. |
| Blast Radius 분석 실패 | TypeScript/JavaScript 파일이 열린 워크스페이스인지, 루트에 `tsconfig.json`이 있으면 더 정확함. |
| Webview가 비어 있음 | `npm run build:webview` 실행 후 `webview-ui/dist/` 에 `index.html`, `assets/` 가 생성되었는지 확인. |
| 테스트 실패 | `npm test` 출력에서 실패한 테스트 파일·이름 확인 후, 해당 모듈 수정 여부 확인. |

---

## 7. 패키징 (선택)

로컬에서 `.vsix` 패키지를 만들어 다른 VSCode에 설치해 보고 싶을 때:

```bash
npm run package
```

생성된 `mars-refactoring-0.1.0.vsix` 를 VSCode에서 **Extensions → ... → Install from VSIX** 로 설치할 수 있습니다.

---

위 단계대로 진행하면 **빌드 → 테스트 → 확장 실행 → 기능별 동작**까지 완성된 프로그램을 확인할 수 있습니다.
