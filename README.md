# B2B ERP MCP

지피터스 b2b-sales ERP를 Claude Code에서 조회/수정할 수 있는 MCP 서버.

## 설치 (팀원용 한 줄)

```bash
claude mcp add b2b-erp -s user --env B2B_ERP_API_KEY=받은_키 -- npx -y github:chat-prompt/b2b-erp-mcp
```

`받은_키` 자리에 가경님께 받은 API 키를 넣으세요. 위 명령어 한 줄로 등록되고, 다음 Claude Code 세션부터 `mcp__b2b-erp__*` 도구가 활성화됩니다.

## 제공 도구

ERP 조회/수정:
- `list_projects` — 프로젝트 목록 (단계/담당자 필터)
- `get_project` — 프로젝트 상세 (매출/비용/강사/메모)
- `update_project` — 프로젝트 수정 (단계, 일정, 매출 등)
- `list_accounts` — 거래처 목록
- `list_instructors` — 강사 목록
- `get_dashboard` — 대시보드 KPI (월/연 매출, 마진, 파이프라인)
- `add_note` — 프로젝트 메모 추가
- `add_sessions` / `get_sessions` — 교육 세션 등록/조회

캘린더 동기화 (선택, OAuth 설정 시에만 등록):
- `sync_to_calendar` / `sync_preparing_to_calendar` / `list_calendar_events`

## 캘린더 기능 활성화 (선택)

Google Calendar 동기화 도구를 쓰려면 다음 환경변수를 추가하세요:

```bash
claude mcp add b2b-erp -s user \
  --env B2B_ERP_API_KEY=받은_키 \
  --env B2B_ERP_GOOGLE_CLIENT_ID=... \
  --env B2B_ERP_GOOGLE_CLIENT_SECRET=... \
  --env B2B_ERP_GOOGLE_TOKEN_PATH=/path/to/oauth-token.json \
  -- npx -y github:chat-prompt/b2b-erp-mcp
```

## 제거

```bash
claude mcp remove b2b-erp -s user
```

## 본체

- ERP: https://b2b-sales-three.vercel.app
- API 베이스: `/api/external/` (x-api-key 헤더)
