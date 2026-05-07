#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as erp from "./lib/erp.js";
import * as calendar from "./lib/calendar.js";

// ── API Key ──────────────────────────────────────────
const API_KEY = process.env.B2B_ERP_API_KEY;
if (!API_KEY) {
  console.error("B2B_ERP_API_KEY environment variable is required");
  process.exit(1);
}
erp.setApiKey(API_KEY);

// ── Server ───────────────────────────────────────────
const server = new McpServer({
  name: "b2b-erp",
  version: "1.0.0",
});

// ── Tools ────────────────────────────────────────────

server.tool(
  "list_projects",
  "ERP 프로젝트 목록 조회. 검색어, 단계, 담당자로 필터링 가능",
  {
    search: z.string().optional().describe("프로젝트명/기업명/코드 검색"),
    stage: z.string().optional().describe("단계 필터 (lead/meeting_done/proposal_sent/negotiating/won/preparing/in_progress/completed/lost)"),
    owner: z.string().optional().describe("담당자명 필터"),
    limit: z.number().optional().default(30).describe("최대 결과 수"),
  },
  async ({ search, stage, owner, limit }) => {
    const data = await erp.listProjects({ search, stage, owner, limit });
    const projects = data.data || data;
    const lines = projects.map((p) =>
      `[${p.projectCode || "미발번"}] ${p.projectName} | ${p.companyName || ""} | ${p.stage} | ${p.ownerName || ""} | 예상매출 ${Number(p.expectedRevenueAmount || 0).toLocaleString()}원 | id:${p.id}`
    );
    return { content: [{ type: "text", text: `총 ${projects.length}건\n\n${lines.join("\n")}` }] };
  }
);

server.tool(
  "get_project",
  "ERP 프로젝트 상세 조회 (매출/비용/강사/메모 포함)",
  {
    id: z.string().describe("프로젝트 ID (UUID)"),
  },
  async ({ id }) => {
    const p = await erp.getProject(id);
    const revenue = (p.revenueItems || []).map((r) =>
      `  - ${r.revenueName}: ${Number(r.amount).toLocaleString()}원 (${r.paymentStatus})`
    ).join("\n");
    const costs = (p.costItems || []).map((c) =>
      `  - ${c.costName}: ${Number(c.amount).toLocaleString()}원`
    ).join("\n");
    const instructors = (p.instructors || p.projectInstructors || []).map((i) =>
      `  - ${i.instructor?.instructorName || i.instructorName || "?"}: ${Number(i.totalFee || 0).toLocaleString()}원 (${i.paymentStatus})`
    ).join("\n");
    const notes = (p.notes || []).slice(0, 5).map((n) =>
      `  - [${n.createdAt?.slice(0, 10)}] ${n.content?.slice(0, 100)}`
    ).join("\n");

    const text = `# ${p.projectName} (${p.projectCode || "미발번"})
기업: ${p.account?.companyName || ""}
담당: ${p.ownerName || ""}
단계: ${p.stage}
교육일: ${p.educationStartDate?.slice(0, 10) || "미정"} ~ ${p.educationEndDate?.slice(0, 10) || "미정"}
예상매출: ${Number(p.expectedRevenueAmount || 0).toLocaleString()}원
예상인원: ${p.expectedParticipants || "미정"}명
세그먼트: ${p.segment || "미지정"} | 그룹: ${p.accountGroup || "미지정"}
리드소스: ${p.leadSource || "미지정"}
주요니즈: ${p.mainNeeds || "없음"}

## 매출 항목
${revenue || "  없음"}

## 비용 항목
${costs || "  없음"}

## 강사 배정
${instructors || "  없음"}

## 최근 메모
${notes || "  없음"}

ERP 링크: https://b2b-sales-three.vercel.app/projects/${p.id}`;

    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "update_project",
  "ERP 프로젝트 정보 수정 (단계, 일정, 매출 등)",
  {
    id: z.string().describe("프로젝트 ID"),
    stage: z.string().optional().describe("단계 변경"),
    ownerName: z.string().optional().describe("담당자 변경"),
    educationStartDate: z.string().optional().describe("교육 시작일 (YYYY-MM-DD)"),
    educationEndDate: z.string().optional().describe("교육 종료일 (YYYY-MM-DD)"),
    expectedRevenueAmount: z.number().optional().describe("예상 매출 (원)"),
    expectedParticipants: z.number().optional().describe("예상 참여인원"),
    probability: z.number().optional().describe("성공 확률 (%)"),
    mainNeeds: z.string().optional().describe("주요 니즈"),
    description: z.string().optional().describe("설명"),
    nextStep: z.string().optional().describe("다음 단계"),
    lossReason: z.string().optional().describe("실주 사유"),
  },
  async ({ id, ...fields }) => {
    // Remove undefined fields
    const data = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const result = await erp.updateProject(id, data);
    return { content: [{ type: "text", text: `프로젝트 수정 완료: ${result.projectName || id}` }] };
  }
);

server.tool(
  "list_accounts",
  "ERP 거래처(고객사) 목록 조회",
  {
    search: z.string().optional().describe("기업명/담당자명 검색"),
  },
  async ({ search }) => {
    const accounts = await erp.listAccounts({ search });
    const lines = (Array.isArray(accounts) ? accounts : []).map((a) =>
      `${a.companyName} | ${a.segment || "-"} | ${a.accountGroup || "-"} | ${a.defaultContactName || "-"} | id:${a.id}`
    );
    return { content: [{ type: "text", text: `총 ${(Array.isArray(accounts) ? accounts : []).length}건\n\n${lines.join("\n")}` }] };
  }
);

server.tool(
  "get_dashboard",
  "ERP 대시보드 요약 (매출/비용/마진/파이프라인)",
  {
    month: z.string().optional().describe("조회 월 (YYYY-MM). 미지정 시 당월"),
  },
  async ({ month }) => {
    const d = await erp.getDashboard(month);
    const year = (d.selectedMonth || "").split("-")[0] || new Date().getFullYear();
    const fmt = (n) => `${Math.round(n / 10000).toLocaleString()}만원`;

    const stageLines = Object.entries(d.projectsByStage || {})
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `  ${k}: ${v}건`)
      .join("\n");

    const groupLines = (d.revenueByGroup || [])
      .map((g) => `  ${g.group}: ${fmt(g.revenue)} (${g.projectCount}건)`)
      .join("\n");

    const segmentLines = (d.revenueBySegment || [])
      .map((s) => `  ${s.segment}: ${fmt(s.revenue)} (${s.projectCount}건, ${s.accountCount}개사)`)
      .join("\n");

    const text = `# ${year}년 대시보드 (${d.selectedMonth})

## 연간
매출: ${fmt(d.annualRevenue)} | 비용: ${fmt(d.annualCost)} | 마진: ${fmt(d.annualMargin)}
미수금: ${fmt(d.annualReceivables)} | 미지급금: ${fmt(d.annualPayables)}

## ${d.selectedMonth} 월간
매출: ${fmt(d.monthlyActualRevenue)} | 비용: ${fmt(d.monthlyTotalCost)} | 마진: ${fmt(d.monthlyMargin)}

## 사업 현황
고객사: ${d.totalAccounts || 0}개사 | 교육인원: ${(d.totalParticipants || 0).toLocaleString()}명

## 그룹별 매출
${groupLines || "  데이터 없음"}

## 세그먼트별 매출
${segmentLines || "  데이터 없음"}

## 파이프라인
${stageLines || "  데이터 없음"}

## 예정 교육
${(d.upcomingTrainings || []).map((t) => `  ${t.date} ${t.name} (${t.company})`).join("\n") || "  없음"}`;

    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "add_note",
  "ERP 프로젝트에 메모 추가",
  {
    projectId: z.string().describe("프로젝트 ID"),
    content: z.string().describe("메모 내용"),
  },
  async ({ projectId, content }) => {
    await erp.addNote(projectId, content);
    return { content: [{ type: "text", text: "메모 추가 완료" }] };
  }
);

server.tool(
  "list_instructors",
  "ERP 강사 목록 조회",
  {
    search: z.string().optional().describe("강사명/전문분야 검색"),
  },
  async ({ search }) => {
    const instructors = await erp.listInstructors({ search });
    const lines = (Array.isArray(instructors) ? instructors : []).map((i) =>
      `${i.instructorName} (${i.nickname || "-"}) | ${i.affiliation || "-"} | ${i.expertiseArea || "-"} | id:${i.id}`
    );
    return { content: [{ type: "text", text: `총 ${(Array.isArray(instructors) ? instructors : []).length}건\n\n${lines.join("\n")}` }] };
  }
);

// ── Calendar Tools (OAuth 설정된 경우에만 등록) ──────────
if (calendar.isCalendarConfigured()) {

server.tool(
  "sync_to_calendar",
  "프로젝트의 교육 세션을 Google Calendar에 동기화. 세션별로 개별 일정 생성 (09:00-18:00). 세션이 없으면 먼저 add_sessions로 등록 필요.",
  {
    projectId: z.string().describe("프로젝트 ID"),
  },
  async ({ projectId }) => {
    const project = await erp.getProject(projectId);
    const result = await calendar.syncProjectToCalendar(project);

    const lines = result.results.map((r) => {
      if (r.action === "created") return `+ ${r.date} 생성`;
      if (r.action === "updated") return `~ ${r.date} 업데이트`;
      if (r.action === "deleted") return `- ${r.date} 삭제`;
      return `? ${r.date} ${r.action}`;
    });

    return {
      content: [{
        type: "text",
        text: `${result.summary}\n${lines.join("\n") || "(변경 없음)"}`,
      }],
    };
  }
);

server.tool(
  "sync_preparing_to_calendar",
  "교육준비(preparing) 및 진행중(in_progress) 단계의 모든 프로젝트를 Google Calendar에 동기화. 교육 세션이 등록된 프로젝트만 동기화됨.",
  {},
  async () => {
    const summaries = [];

    for (const stage of ["preparing", "in_progress"]) {
      const data = await erp.listProjects({ stage, limit: 100 });
      const projects = data.data || data;

      for (const p of projects) {
        try {
          const detail = await erp.getProject(p.id);
          const result = await calendar.syncProjectToCalendar(detail);
          summaries.push(result.summary);
        } catch (err) {
          summaries.push(`${p.projectName}: 오류 - ${err.message}`);
        }
      }
    }

    return {
      content: [{
        type: "text",
        text: `캘린더 동기화 완료\n\n${summaries.join("\n")}`,
      }],
    };
  }
);

server.tool(
  "add_sessions",
  "프로젝트에 교육 세션(날짜/시간) 등록. 캘린더 동기화 전에 먼저 세션을 등록해야 함.",
  {
    projectId: z.string().describe("프로젝트 ID"),
    sessions: z.array(z.object({
      date: z.string().describe("날짜 (YYYY-MM-DD)"),
      startTime: z.string().optional().default("09:00").describe("시작 시간 (HH:MM)"),
      endTime: z.string().optional().default("18:00").describe("종료 시간 (HH:MM)"),
      location: z.string().optional().describe("장소"),
      note: z.string().optional().describe("비고"),
    })).describe("교육 세션 배열"),
  },
  async ({ projectId, sessions }) => {
    const created = await erp.addSessions(projectId, sessions);
    const count = Array.isArray(created) ? created.length : 1;
    return { content: [{ type: "text", text: `교육 세션 ${count}건 등록 완료` }] };
  }
);

server.tool(
  "get_sessions",
  "프로젝트의 교육 세션 목록 조회 (각 세션의 강사 배정 포함)",
  {
    projectId: z.string().describe("프로젝트 ID"),
  },
  async ({ projectId }) => {
    const sessions = await erp.getSessions(projectId);
    const list = Array.isArray(sessions) ? sessions : [];
    if (list.length === 0) {
      return { content: [{ type: "text", text: "등록된 교육 세션 없음" }] };
    }
    const lines = list.map((s) => {
      const instructorList = (s.instructors || []).map((i) => i.instructorName).join(", ");
      const parts = [
        `${s.date?.slice(0, 10)} ${s.startTime}-${s.endTime}`,
        s.location ? `장소: ${s.location}` : "",
        instructorList ? `강사: ${instructorList}` : "강사: 미배정",
        s.note ? `비고: ${s.note}` : "",
        `id:${s.id}`,
      ].filter(Boolean);
      return `· ${parts.join(" | ")}`;
    });
    return { content: [{ type: "text", text: `교육 세션 ${list.length}건:\n${lines.join("\n")}` }] };
  }
);

server.tool(
  "assign_session_instructors",
  "교육 세션에 강사를 배정/변경. sessionId 또는 date(YYYY-MM-DD)로 세션을 식별. instructorNames에 본명 또는 닉네임 입력 (예: ['허승연','민수']) — 프로젝트에 등록된 강사 목록에서 자동 매칭. 빈 배열을 보내면 모든 강사 해제.",
  {
    projectId: z.string().describe("프로젝트 ID"),
    sessionId: z.string().optional().describe("세션 ID (있으면 우선)"),
    date: z.string().optional().describe("세션 날짜 YYYY-MM-DD (sessionId 없을 때 사용)"),
    instructorNames: z.array(z.string()).optional().describe("강사 본명 또는 닉네임 배열. 닉네임/접미사/부분일치 자동 매칭"),
    instructorIds: z.array(z.string()).optional().describe("강사 ID 배열 (instructorNames 대신 직접 ID로 지정 가능)"),
  },
  async ({ projectId, sessionId, date, instructorNames, instructorIds }) => {
    const body = {};
    if (sessionId) body.sessionId = sessionId;
    if (date) body.date = date;
    if (Array.isArray(instructorIds)) body.instructorIds = instructorIds;
    else if (Array.isArray(instructorNames)) body.instructorNames = instructorNames;
    else {
      throw new Error("instructorNames 또는 instructorIds 중 하나는 필요합니다");
    }
    const updated = await erp.patchSession(projectId, body);
    const names = (updated.instructors || []).map((i) => i.instructorName).join(", ");
    const dateStr = updated.date?.slice(0, 10) || "";
    return {
      content: [{
        type: "text",
        text: `세션 ${dateStr} 강사 배정 완료: ${names || "(없음)"}`,
      }],
    };
  }
);

server.tool(
  "update_session",
  "교육 세션의 시간/장소/비고 수정. sessionId 또는 date로 식별.",
  {
    projectId: z.string().describe("프로젝트 ID"),
    sessionId: z.string().optional().describe("세션 ID"),
    date: z.string().optional().describe("세션 날짜 YYYY-MM-DD (sessionId 없을 때)"),
    newDate: z.string().optional().describe("날짜 변경 (sessionId 사용 시)"),
    startTime: z.string().optional().describe("시작 시간 HH:MM"),
    endTime: z.string().optional().describe("종료 시간 HH:MM"),
    location: z.string().optional().describe("장소"),
    note: z.string().optional().describe("비고"),
  },
  async ({ projectId, sessionId, date, newDate, startTime, endTime, location, note }) => {
    const body = {};
    if (sessionId) body.sessionId = sessionId;
    if (date) body.date = date;
    if (newDate && sessionId) body.date = newDate; // sessionId가 있으면 date는 변경값으로
    if (startTime !== undefined) body.startTime = startTime;
    if (endTime !== undefined) body.endTime = endTime;
    if (location !== undefined) body.location = location;
    if (note !== undefined) body.note = note;
    const updated = await erp.patchSession(projectId, body);
    return {
      content: [{
        type: "text",
        text: `세션 수정 완료: ${updated.date?.slice(0, 10)} ${updated.startTime}-${updated.endTime}${updated.location ? ` @ ${updated.location}` : ""}`,
      }],
    };
  }
);

server.tool(
  "import_sessions_from_calendar",
  "Google Calendar에서 프로젝트명 매칭 이벤트를 찾아서 ERP 세션으로 자동 생성/매칭. 이벤트의 location도 함께 채움. dryRun=true면 미리보기만.",
  {
    projectId: z.string().describe("프로젝트 ID"),
    fuzzyKeywords: z.array(z.string()).optional().describe("프로젝트명 외에 추가로 매칭할 키워드 (예: ['SKT MNO', 'AI Camp 1차수'])"),
    dryRun: z.boolean().optional().default(false).describe("true면 변경 없이 미리보기만"),
  },
  async ({ projectId, fuzzyKeywords = [], dryRun }) => {
    const project = await erp.getProject(projectId);
    const projectName = project.projectName;
    const events = await calendar.searchProjectEvents({
      projectName,
      fuzzyKeywords,
      timeMin: project.educationStartDate ? new Date(new Date(project.educationStartDate).getTime() - 7 * 86400000).toISOString() : undefined,
      timeMax: project.educationEndDate ? new Date(new Date(project.educationEndDate).getTime() + 7 * 86400000).toISOString() : undefined,
    });

    if (events.length === 0) {
      return { content: [{ type: "text", text: `'${projectName}' 매칭 캘린더 이벤트 없음` }] };
    }

    const existingSessions = await erp.getSessions(projectId);
    const existingByDate = new Map();
    for (const s of (Array.isArray(existingSessions) ? existingSessions : [])) {
      const d = (s.date || "").slice(0, 10);
      if (d) existingByDate.set(d, s);
    }

    // 캘린더 이벤트를 날짜별로 정리
    const eventsByDate = new Map();
    for (const e of events) {
      const dateStr = e.start?.date || e.start?.dateTime?.slice(0, 10);
      if (!dateStr) continue;
      if (!eventsByDate.has(dateStr)) eventsByDate.set(dateStr, []);
      eventsByDate.get(dateStr).push(e);
    }

    const summaryLines = [];
    const newSessions = [];

    for (const [dateStr, evs] of Array.from(eventsByDate.entries()).sort()) {
      const ev = evs[0];
      const startTime = ev.start?.dateTime ? ev.start.dateTime.slice(11, 16) : "09:00";
      const endTime = ev.end?.dateTime ? ev.end.dateTime.slice(11, 16) : "18:00";
      const location = ev.location || "";
      const note = ev.summary || "";

      if (existingByDate.has(dateStr)) {
        summaryLines.push(`= ${dateStr}: 이미 등록됨 (그대로 유지)`);
      } else {
        summaryLines.push(`+ ${dateStr} ${startTime}-${endTime}${location ? ` @ ${location}` : ""}`);
        if (!dryRun) {
          newSessions.push({ date: dateStr, startTime, endTime, location, note });
        }
      }
    }

    if (!dryRun && newSessions.length > 0) {
      await erp.addSessions(projectId, newSessions);
    }

    return {
      content: [{
        type: "text",
        text: [
          `'${projectName}' 캘린더 매칭 ${events.length}개 이벤트, 날짜 ${eventsByDate.size}일`,
          `${dryRun ? "[미리보기]" : "[적용 완료]"} 새로 추가: ${newSessions.length}건`,
          "",
          ...summaryLines,
        ].join("\n"),
      }],
    };
  }
);

server.tool(
  "list_calendar_events",
  "Google Calendar 다가오는 일정 조회",
  {
    maxResults: z.number().optional().default(10).describe("최대 결과 수"),
  },
  async ({ maxResults }) => {
    const events = await calendar.listUpcomingEvents(maxResults);
    const lines = events.map((e) =>
      `${e.start} ~ ${e.end} | ${e.summary}`
    );
    return { content: [{ type: "text", text: lines.join("\n") || "예정 일정 없음" }] };
  }
);

} // end calendar tools block

// ── Start ────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
