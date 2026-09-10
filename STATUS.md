# STATUS — b2b-erp-mcp (ERP를 클로드·봇에서 쓰게 만드는 통로)

업데이트: 2026-09-10

## 최신 (2026-09-10) - 내부 정책 문서 도구 4종 (get_current_policy 등)
- **배경**: ERP에 「내부 정책」 탭(/policies, b2b-sales PR #99)이 생김. 교육 단가 정책 v3.2가 PDF(사람용)+MD(AI용) 한 세트로 현행 등록돼 있다. 김현철 조건("ERP든 에이전트든 불러다 쓰게") 충족용.
- **get_current_policy**: 현행 교육 단가 정책 md 전문을 한 호출로. 견적·제안·단가 질문 전에 이걸 먼저 읽는 게 의도. external `GET /policies/current?category=pricing&format=md`.
- **list_policy_documents / add_policy_link / update_policy_document**: 목록·링크 등록·메타 수정·현행 지정(makeCurrent). 파일 업로드는 MCP 스코프 밖(ERP 화면).
- 봇 적용은 게이트웨이 재시작(npx 캐시 제거) 필요. 팀원 CC는 재시작만.

## 최신 (2026-09-04) - 거래처 접촉 기록 도구 (main 4c38d89 push)
- **add_interaction / get_interactions** 신설. ERP에 기업 접촉 기록(인터뷰·전화·미팅·메일)이 생겨서(EDU-10533) MCP에서도 남기고 읽는다. 외부 API `accounts/{id}/interactions`.
- add_interaction: occurredAt(YYYY-MM-DD)·content 필수, kind(interview/call/meeting/email/message/event/other/memo)·outcome(positive/neutral/negative/no_response)·contactName·contactId·nextStep·**nextStepDue(기한)**·sourceUrl·actorName 선택. 기한이 있어야 ERP 타겟 탭 재접촉 큐에 잡힌다.
- get_interactions: 접촉일 최신순, 다음 액션에 기한·[완료] 표시.
- 봇 적용은 게이트웨이 재시작(npx 캐시 제거) 필요. 팀원 CC는 재시작만.

## 최신 (2026-09-02) - 목록 도구 "총 N건" 오표기 수정 (맹미나 제보, main bb11766 push·봇 재시작 완료)
- **증상**: `list_projects(limit=1)`이 "총 1건"으로 시작해, MCP로 붙은 에이전트가 잘린 수를 전체 건수로 집계(실제 95건을 60건으로 센 사고). 서버는 이미 `total`을 주는데 index.js가 `projects.length`를 찍고 있었다.
- **수정 (로컬, 실데이터 검증 완료)**: `countHeader()` 헬퍼 신설. list_projects → "총 95건 중 30건 표시 (limit=30, 더 있음)" / 다 보이면 "총 95건". get_activity → nextCursor 노출해 "N건 표시 (더 있음, 전체 건수 아님)" 또는 "(이 조건의 전부)". get_notes·list_vouchers → 서버가 total 없이 최신 50·20건만 주므로 그 상한에 닿으면 "전체 건수는 이보다 많을 수 있음" 경고(상수 NOTES_SERVER_CAP/VOUCHERS_SERVER_CAP, b2b-sales take 값과 수동 동기화).
- **영향 없음 확인**: list_accounts·list_instructors·list_invoices·get_sessions·list_quotations는 서버가 자르지 않아 "총 N건"이 정확.
- **반영 완료**: main push, npx 캐시 제거, 게이트웨이 재시작 후 npx 원격판 실호출로 새 표기 확인. 팀원은 CC 재시작만. get_notes·list_vouchers의 정확한 전체 건수는 b2b-sales 라우트에 count 추가해야 가능(선택).
- **비투비서 무응답 원인(같은 날)**: 10:43~10:56 맥 DNS 고질병으로 슬랙 소켓 죽어 있던 사이 10:48 멘션이 유실됨. health-monitor가 자동 복구, 현재 정상. 코드 문제 아님.

## 최신 (2026-09-01) - 접근·운영 정보(accessInfo) 지원 + 봇 쓰기 개방
- **배경**: ERP Project에 accessInfo Json 필드가 생김(b2b-sales main). 수강생 페이지·운영 화면 주소와 비밀번호, 오픈채팅방을 프로젝트 상세 "접근·운영 정보" 표로 모으는 필드. 활성·최근 완료 17개 프로젝트에 데이터 입력 완료.
- **이 리포 변경 2건 (main push 완료)**:
  - `get_project` 출력에 "## 접근·운영 정보" 섹션 추가, `update_project`에 accessInfo 파라미터(전체 교체 방식, 병합 후 전송 필요) 추가.
  - **`update_access_info` 신설**: 접근·운영 정보만 만지는 전용 쓰기 도구. 병합 방식(같은 label 교체·새 label 추가·나머지 보존, 삭제는 removeLabels로만)이라 표 전체가 날아가는 실수를 구조적으로 차단. 병합·삭제는 실데이터 왕복으로 검증함. 비투비서에게는 이 도구만 열었다(update_project는 여전히 봇 권한 밖).
- **봇 반영**: `~/.claude/settings.json`(봇에 실제 먹히는 곳)과 `~/clawd/.claude/settings.local.json` allow에 update_access_info 추가, `~/clawd/TOOLS.md`에 사용 규칙(실행 전 한 줄 확인, 비고는 쉬운 말) 추가, npx 캐시 비우고 게이트웨이 재시작. 새 슬랙 스레드부터 유효.

## 최신 (2026-08-19) - 세션 강사 배정 데이터 정합 가드
- **사고**: `assign_session_instructors`의 `instructorIds` 우회 경로로 프로젝트 미배정 강사(김민철)를 세션에 붙였더니, 세션엔 있는데 ERP 강사 탭(ProjectInstructor)엔 없는 불일치가 생김(가경 발견, SKT 팀장 과정 edu075). 데이터는 Prisma로 행 생성해 복구.
- **가드 배포**: ERP API PATCH `/projects/:id/sessions`가 이제 instructorIds도 프로젝트 강사 배정 기준으로 검증, 미배정 강사는 400 거부 + 등록 엔드포인트 안내 (b2b-sales main `8bf859b`, 프로덕션 실호출로 검증 완료).
- **이 리포**: instructorIds 파라미터 설명에 거부 규칙과 올바른 순서(POST `/projects/:id/instructors` 먼저) 명시 (main `c5fbfc4` push 완료). npx 사용자는 Claude Code 재시작 시 반영.

## 한 줄 요약
로컬 stdio MCP는 도구 24개로 정상 동작(0단계 완료). 팀원 배포는 ERP 안에 원격 MCP를 만드는 방향으로 설계 확정, 권한 게이트 작업이 선행 조건.

## 쉬운 요약 (비개발자용, 2026-07-28 기준)

이 프로젝트가 하려는 일: **팀원이 클로드에게 "충북대 교육 언제 어디서 해?"라고 물으면 ERP에서 찾아 답하게 만드는 것.**

클로드가 ERP에 전화를 거는 전화선이 있고, 전화로 물어볼 수 있는 질문 목록이 도구다.

**오늘 한 일 세 가지**

1. **꺼져 있던 질문 목록을 살렸다.** 교육 세션·매출·비용 관련 질문들이 하필 구글 캘린더 기능과 한 덩어리로 묶여 있어서, 캘린더를 안 켜면 통째로 사라지는 구조였다. 그걸 분리해서 지금 24개가 다 뜬다. 세금계산서 미수 현황, 월별 강사료 지급 현황처럼 새로 물어볼 수 있는 것도 7개 넣었다.

2. **교육팀 채널에 알렸다.** 이미 쓰는 사람은 재설치 없이 클로드 코드만 재시작하면 새 질문이 들어온다. 아직 안 쓰는 사람은 명령어 한 줄이면 붙는다.

3. **열쇠 문제를 고치는 PR을 올렸다.** ERP에 열쇠(API 키) 발급 화면이 있고 등급도 세 개(구경만/고칠 수도/다 됨) 만들어져 있었는데, **자물쇠가 등급을 안 보고 있었다.** 구경용 열쇠로도 삭제까지 됐다. 이걸 실제로 검사하게 고쳐서 PR #67로 올렸다. 팀 코드라서 리뷰를 받아야 머지된다.

**지금 걸려 있는 것**

- PR #67이 리뷰 대기 중이다. 머지되고 배포되면 "구경용 열쇠는 구경만" 이 진짜가 된다. 그때 교육팀에 다시 공지하기로 예고해 뒀다.
- 지금은 전권 열쇠 하나를 세 명이 돌려쓰고 있다(가경·이재혁·조리장). 그래서 ERP 활동 이력에 누가 바꿨는지 사람 이름이 안 남는다. 각자 발급하라고 공지했지만 실제 교체는 확인이 필요하다.

**다음에 고민할 것**: 팀원 각자 노트북에 설치하는 지금 방식은 도구를 고칠 때마다 각자 업데이트해야 한다. ERP 서버가 직접 대답하게 옮기면(원격 방식) 배포하는 순간 전원이 최신을 쓴다. 그 비교는 `docs/team-deploy-plan.html`에 정리돼 있다.

## 현재 상태
- **완료 (2026-08-14)**: `update_project`에 `studentPageUrl`(수강생 공유 페이지)·`instructorPageUrl`(강사·운영진 공유 페이지) 필드 추가. 외부 API PATCH 화이트리스트에는 원래 있었는데 MCP 스키마에만 빠져 있어서 student-page 스킬이 URL 자동 등록을 못 하던 원인 중 하나였다. 두 필드 혼동 금지(수강생용 vs 운영용) 설명을 스키마 description에 박음. 반영은 Claude Code 재시작 필요(npx 사용자 포함).
- **완료 (2026-07-28, f45e070 push)**
  - 캘린더 게이트 축소: 구글 OAuth가 실제로 필요한 4개 도구(sync_to_calendar, sync_preparing_to_calendar, import_sessions_from_calendar, list_calendar_events)만 게이트 안. 세션·매출·비용 도구 7개는 게이트 밖으로 이동.
    - 원인이었던 문제: OAuth 미설정 환경에서 `get_sessions`·`update_session`·`add_revenue_item` 등이 통째로 미등록 → 충북대 장소 입력을 API 직접 호출로 우회해야 했음.
  - 조회 도구 7개 신규: `get_notes`, `get_account`, `list_invoices`, `list_disbursements`, `list_vouchers`, `get_activity` (+ 기존 `get_sessions` 노출)
  - 미push 상태였던 `create_project`, `create_account`, 드롭다운 z.enum 잠금 포함해 커밋
  - 검증: 캘린더 없는 환경에서 도구 24개 등록 확인, 신규 7개 실호출 확인
  - `npx -y github:chat-prompt/b2b-erp-mcp` 원격 실행도 24개 확인 → **기존 사용자는 재설치 없이 Claude Code 재시작만으로 최신 반영됨** (npx 캐시 문제 없음)
  - README 갱신 (도구 24개 목록, 업데이트 방식, 개인키 주의) — c1d2d73
- **설계 확정**: 팀 배포는 ERP(b2b-sales) 안에 원격 MCP 엔드포인트를 만드는 방식. 문서 `docs/team-deploy-plan.html`
- **결정 (가경)**: B2B 인원으로 등록된 팀원은 강사 전화번호·강사료 금액 조회 가능. 응답 마스킹 작업 불필요.
- **확인된 현황 (중요)**: 팀원 배포는 이미 시작돼 있었다. 2026-05-07 이재혁, 2026-05-14 조리장에게 슬랙 DM으로 설치 명령을 전달했고 재혁님은 연결 성공 확인. 설치 명령은 지금 README와 동일.
- **#02-교육 공지 발송 (2026-07-28)**: 도구 24개 추가, 재설치 불필요(재시작만), 설치 한 줄, 개인키 각자 발급 요청, 현재 키가 전권이라는 주의까지. https://gpters-org.slack.com/archives/C07JW531HUG/p1785226622872629
- **권한 게이트 구현 완료, PR 대기 (2026-07-28)**: b2b-sales PR #67. external 라우트 23개 파일 41곳에 `denyUnlessScope` 게이트(GET=read, POST·PATCH=write, DELETE·정산=admin), 개인키 발급에 scope 명시(화면은 read 기본·write 선택, admin 발급 차단), API 키 화면에 등급 배지와 MCP 연결 명령 복사 버튼. DB 마이그레이션 없음. 로컬 14케이스 검증 통과(기존 admin 공유키 호환 확인).

## 다음에 할 일 (순서대로)
0. **권한 게이트 PR 리뷰·머지 대기** — https://github.com/chat-prompt/b2b-sales/pull/67 (브랜치 `feat/external-api-scope-gate`). 머지·배포되면 조회 전용 키가 실제로 조회만 되고, 발급 화면에서 등급 선택과 MCP 연결 명령 복사가 가능해진다. 배포 후 #02-교육에 재공지 필요(첫 공지에서 "적용되면 다시 알린다"고 예고함).
   - 리뷰 포인트: 정산 PATCH를 admin으로 올린 것, 화면에서 admin 키 발급 차단, 기존 admin 개인키 일괄 강등 여부
1. **공유키를 개인키로 교체** — 이재혁·조리장·가경이 동일한 전권 공유키 하나를 사용 중. 2026-07-28 #02-교육 공지로 각자 발급 요청은 완료. 실제 교체 여부 확인 필요.
2. **원격 MCP 엔드포인트** (b2b-sales, PR 필요) — `/api/mcp` 추가. 도구 정의를 이 리포에서 이전.
3. **온보딩** — 발급 화면에 연결 명령 복사 버튼, 팀원 안내 한 장.
4. (선택) 슬랙봇 팀 확장 — 상시 가동 서버 + 슬랙 유저별 권한 매핑. 클로드 CLI 배포 이후.

## 핵심 경로 / 단일 진실
- 메인 파일: `index.js` (도구 정의), `lib/erp.js` (API 클라이언트), `lib/calendar.js` (구글 캘린더)
- 설계 문서: `docs/team-deploy-plan.html`
- ERP API: `https://b2b-sales-three.vercel.app/api/external` (헤더 `x-api-key`)
- ERP 코드: `~/b2b-sales` (팀 리포 chat-prompt/b2b-sales, 배포는 main push)
- 한 줄 설치(현행 stdio):
  `claude mcp add -s user b2b-erp -e B2B_ERP_API_KEY=키 -- npx -y github:chat-prompt/b2b-erp-mcp`

## 막힌 것 / 주의
- **전역 MCP 등록이 `npx -y github:chat-prompt/b2b-erp-mcp`다.** 로컬 파일을 고쳐도 반영되지 않는다. 반드시 main에 push하고 클로드 코드를 재시작해야 도구가 바뀐다. 개발 중에는 로컬 경로로 등록해 두는 편이 낫다.
- **전권 공유키(`API_SECRET_KEY`) 하나를 3명이 공유 중이고 슬랙 DM 본문에 평문으로 남아 있다.** 그래서 활동 이력의 행위자가 사람 이름이 아니라 `erp-mcp`로 찍힌다. 키를 교체하면 세 명이 동시에 끊기므로 개인키 발급과 함께 진행해야 한다.
- GitHub이 이 리포 의존성에서 취약점 26건(높음 5)을 경고하고 있다. 팀 확대 전에 정리 필요.
- **권한이 아직 껍데기다.** `external-auth.ts`에 read/write/admin과 `hasScope()`가 있으나 라우트에서 호출하는 곳이 0개. 발급 라우트도 scope를 안 넘겨서 개인키가 전부 `admin`. 팀원에게 키를 뿌리기 전에 반드시 1번 작업이 필요하다.
- **권한 게이트를 넣을 때 기존 연동이 끊길 수 있다.** 비투비서 봇, 인바운드 자동초안, 로컬 스크립트가 공유키(`API_SECRET_KEY`, admin)로 붙어 있다. 게이트 적용 후 실제 호출로 확인해야 한다.
- 계좌번호·주민번호는 external API가 반환하지 않는다. 등급과 무관하게 막혀 있고, ERP 웹에서만 다룬다.
