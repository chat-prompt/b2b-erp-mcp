# STATUS — b2b-erp-mcp (ERP를 클로드·봇에서 쓰게 만드는 통로)

업데이트: 2026-07-28

## 한 줄 요약
로컬 stdio MCP는 도구 24개로 정상 동작(0단계 완료). 팀원 배포는 ERP 안에 원격 MCP를 만드는 방향으로 설계 확정, 권한 게이트 작업이 선행 조건.

## 현재 상태
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
