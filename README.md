# B2B ERP MCP

지피터스 b2b-sales ERP를 Claude Code에서 조회/수정할 수 있는 MCP 서버.

## 설치 (팀원용 한 줄)

```bash
claude mcp add b2b-erp -s user --env B2B_ERP_API_KEY=받은_키 -- npx -y github:chat-prompt/b2b-erp-mcp
```

`받은_키` 자리에 ERP 설정 > API 키에서 발급한 키를 넣으세요. 위 명령어 한 줄로 등록되고, 다음 Claude Code 세션부터 `mcp__b2b-erp__*` 도구가 활성화됩니다.

## 업데이트

**재설치할 필요 없습니다.** `npx -y github:...`가 실행할 때마다 GitHub main의 최신 코드를 가져오므로, 도구가 추가되면 Claude Code를 재시작하는 것만으로 반영됩니다.

거꾸로 말하면, 로컬에서 이 리포를 고쳐도 main에 push하지 않으면 아무에게도 반영되지 않습니다.

## 제공 도구 (24개)

### 조회
- `list_projects` - 프로젝트 목록 (단계/담당자 필터)
- `get_project` - 프로젝트 상세 (매출/비용/강사/최근 메모)
- `get_notes` - 프로젝트 메모 전체 (get_project는 최근 5건만)
- `get_sessions` - 교육 세션 목록 (날짜·시간·장소·배정 강사)
- `list_accounts` / `get_account` - 거래처 목록 / 상세
- `list_instructors` / `get_instructor` - 강사 목록 / 상세
- `get_dashboard` - 대시보드 KPI (월·연 매출, 마진, 파이프라인)
- `list_invoices` - 세금계산서 발행·수금·미수 현황
- `list_disbursements` - 월별 강사료 지급 현황 (상태별 합계 포함)
- `list_vouchers` - 상품권 발송 배치
- `get_activity` - 활동 이력 (누가 언제 무엇을 바꿨는지)

### 생성·수정
- `create_project` / `update_project` - 프로젝트 생성 / 수정
- `create_account` - 거래처 생성
- `add_note` - 프로젝트 메모 추가
- `add_sessions` / `update_session` / `delete_sessions` - 교육 세션 등록 / 수정(시간·장소·비고) / 삭제
- `assign_session_instructors` - 세션별 강사 배정 (본명·닉네임 자동 매칭)
- `add_revenue_item` / `add_cost_item` - 매출 항목 / 기타비용 항목 추가
- `update_instructor` - 강사 정보 수정 (계좌·주민번호·정산 필드는 제외)

### 캘린더 동기화 (Google OAuth 설정 시에만 등록)
- `sync_to_calendar` / `sync_preparing_to_calendar` - ERP 세션을 구글 캘린더로
- `import_sessions_from_calendar` - 캘린더 일정을 ERP 세션으로
- `list_calendar_events` - 다가오는 일정 조회

OAuth를 설정하지 않아도 위 24개는 모두 동작합니다. 캘린더 4개 도구만 추가로 나타납니다.

## 캘린더 기능 활성화 (선택)

```bash
claude mcp add b2b-erp -s user \
  --env B2B_ERP_API_KEY=받은_키 \
  --env B2B_ERP_GOOGLE_CLIENT_ID=... \
  --env B2B_ERP_GOOGLE_CLIENT_SECRET=... \
  --env B2B_ERP_GOOGLE_TOKEN_PATH=/path/to/oauth-token.json \
  -- npx -y github:chat-prompt/b2b-erp-mcp
```

## 키에 관한 주의

- **키는 사람마다 따로 발급하세요.** 공유키 하나를 여러 명이 쓰면 활동 이력에서 누가 무엇을 바꿨는지 구분되지 않고, 한 명 때문에 키를 교체하면 전원이 끊깁니다.
- 발급·폐기는 ERP 설정 > API 키에서 합니다.
- 키는 슬랙·메일 본문에 평문으로 남기지 마세요. 남았다면 폐기하고 재발급하는 편이 안전합니다.
- 권한 등급(조회 전용 / 수정 가능)은 현재 라우트에서 강제되지 않습니다. 진행 상황은 `STATUS.md`와 `docs/team-deploy-plan.html` 참조.

## 제거

```bash
claude mcp remove b2b-erp -s user
```

## 본체

- ERP: https://b2b-sales-three.vercel.app
- API 베이스: `/api/external/` (`x-api-key` 헤더)
- 팀 배포 설계: `docs/team-deploy-plan.html`
- 작업 연속성: `STATUS.md`
