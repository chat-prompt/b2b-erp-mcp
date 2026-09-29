# 이 레포는 동결됐다 — 먼저 읽는다

**`chat-prompt/b2b-erp-mcp`는 2026-09-28부로 더 이상 업데이트하지 않는다.** B2B ERP MCP는 ERP 본체 레포 안의 원격 MCP로 옮겼다.

## 에이전트가 지킬 것

- **이 레포에 코드를 고치거나 커밋·push·PR 하지 않는다.** 도구 추가·수정·버그 수정을 요청받아도 여기서 하지 않는다. 고쳐도 원격 MCP를 쓰는 팀원과 슬랙 봇에게는 반영되지 않는다.
- 요청받은 작업은 **`chat-prompt/b2b-sales`** 에서 한다.
  - 도구 정의: `src/lib/mcp/tools.ts` (`server.tool(이름, 설명, zod 스키마, 핸들러)`)
  - ERP 외부 API 호출: `src/lib/mcp/erp-client.ts` — 도구는 같은 배포의 `/api/external/*`를 요청자의 키 그대로 부르는 얇은 어댑터다
  - 엔드포인트: `src/app/api/mcp/route.ts` (운영 `https://b2b-sales-three.vercel.app/api/mcp`)
  - 작업 방식·금지선: 그 레포의 `docs/remote-mcp-handoff.md`
- 사용자에게 이 사실을 먼저 알리고, b2b-sales 에서 이어서 할지 묻는다. b2b-sales 는 비공개 레포라 접근 권한이 없으면 최하영님께 요청하게 안내한다.
- 이 레포의 Dependabot PR 은 머지하지 않는다.

## 사용자 MCP 등록 바꾸기

옛 npx 방식(`npx -y github:chat-prompt/b2b-erp-mcp`)은 당분간 동작하지만 새 도구·수정이 반영되지 않는다. 원격 MCP 등록 방법은 README 맨 위에 있다. 개인 API 키는 ERP 설정 > API 키에서 발급한다(키를 코드·커밋·대화에 남기지 않는다).
