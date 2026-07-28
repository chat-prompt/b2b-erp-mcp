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

// ── ERP enum 값 (b2b-sales/src/lib/constants.ts 와 동기화) ──
// 드롭다운 고정값. 자유입력 금지 — z.enum으로 잠가 무효값을 거부하고 유효값을 스키마에 노출한다.
const SEGMENTS = ["대기업", "중견기업", "중소기업", "스타트업", "공공기관", "교육기관", "비영리단체", "기타"];
const INDUSTRIES = ["IT/소프트웨어", "통신", "금융/보험", "제조", "건설/엔지니어링", "에너지/화학", "유통/물류", "의료/제약", "미디어/엔터테인먼트", "교육", "컨설팅/전문서비스", "소비재", "자동차/운송", "부동산", "공공/정부", "기타"];
const LEAD_SOURCES = ["인바운드", "아웃바운드", "소개/추천", "기존고객", "웹사이트", "세미나", "기타"];
const PROJECT_TYPES = ["교육과정", "컨설팅", "기타"];
const DELIVERY_FORMATS = ["online", "offline", "hybrid"];
const STAGES = ["lead", "meeting_done", "proposal_sent", "negotiating", "won", "preparing", "in_progress", "completed", "lost"];
const ACCOUNT_GROUPS = ["SK", "기타"];

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
    stage: z.enum(STAGES).optional().describe("단계 변경"),
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
  "create_project",
  "ERP 신규 프로젝트 생성 (인바운드 문의 등록). projectName, accountId, ownerName 필수. accountId가 없으면 먼저 create_account로 거래처를 만든다.",
  {
    projectName: z.string().describe("프로젝트명 (예: 금융결제원 AI 업무자동화 교육)"),
    accountId: z.string().describe("거래처 ID (list_accounts/create_account에서 확보)"),
    ownerName: z.string().describe("담당자명 (예: 한가경)"),
    stage: z.enum(STAGES).optional().describe("단계 (기본 lead)"),
    leadSource: z.enum(LEAD_SOURCES).optional().describe("리드 출처 (인바운드 폼은 '인바운드')"),
    projectType: z.enum(PROJECT_TYPES).optional().describe("프로젝트 유형 (교육은 '교육과정')"),
    deliveryFormat: z.enum(DELIVERY_FORMATS).optional().describe("진행 형태 (오프라인은 'offline')"),
    expectedParticipants: z.number().optional().describe("예상 참여인원"),
    expectedRevenueAmount: z.number().optional().describe("예상 매출 (원)"),
    probability: z.number().optional().describe("성공 확률 (%)"),
    educationStartDate: z.string().optional().describe("교육 시작일 (YYYY-MM-DD)"),
    educationEndDate: z.string().optional().describe("교육 종료일 (YYYY-MM-DD)"),
    mainNeeds: z.string().optional().describe("주요 니즈"),
    description: z.string().optional().describe("설명/메모"),
  },
  async (fields) => {
    const data = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const result = await erp.createProject(data);
    const p = result.project || result;
    return { content: [{ type: "text", text: `프로젝트 생성 완료: ${p.projectName} (${p.projectCode || ""})\nID: ${p.id}\nhttps://b2b-sales-three.vercel.app/projects/${p.id}` }] };
  }
);

server.tool(
  "create_account",
  "ERP 신규 거래처(고객사) 생성. companyName 필수. 생성 후 반환 id를 create_project의 accountId로 쓴다.",
  {
    companyName: z.string().describe("기업명 (예: 금융결제원)"),
    industry: z.enum(INDUSTRIES).optional().describe("산업군 (금융기관은 '금융/보험')"),
    segment: z.enum(SEGMENTS).optional().describe("세그먼트 (공공·금융 인프라는 '공공기관')"),
    accountGroup: z.enum(ACCOUNT_GROUPS).optional().describe("그룹"),
    defaultContactName: z.string().optional().describe("담당자명"),
    defaultContactEmail: z.string().optional().describe("담당자 이메일"),
    defaultContactPhone: z.string().optional().describe("담당자 연락처"),
  },
  async (fields) => {
    const data = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const a = await erp.createAccount(data);
    return { content: [{ type: "text", text: `거래처 생성 완료: ${a.companyName || data.companyName}\nID: ${a.id}` }] };
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
    occurredAt: z
      .string()
      .optional()
      .describe("실제로 그 일이 있었던 날 (YYYY-MM-DD). 지난 일을 나중에 적을 때 넣는다. 비우면 오늘로 기록"),
  },
  async ({ projectId, content, occurredAt }) => {
    await erp.addNote(projectId, content, occurredAt);
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
      `${i.instructorName} (${i.nickname || "-"}) | ${i.affiliation || "-"} | ${i.expertiseArea || "-"} | ${i.phone || "연락처 없음"} | id:${i.id}`
    );
    return { content: [{ type: "text", text: `총 ${(Array.isArray(instructors) ? instructors : []).length}건\n\n${lines.join("\n")}` }] };
  }
);

server.tool(
  "get_instructor",
  "ERP 강사 상세 조회 (연락처, 소속, 배정 프로젝트 포함). 계좌·주민번호는 반환되지 않는다.",
  {
    id: z.string().describe("강사 ID (UUID). list_instructors에서 확보"),
  },
  async ({ id }) => {
    const i = await erp.getInstructor(id);
    const projects = (i.projectInstructors || []).map((pi) =>
      `  - ${pi.project?.projectName || "?"} (${pi.project?.stage || "-"}) | ${Number(pi.totalFee || 0).toLocaleString()}원 | ${pi.paymentStatus}`
    ).join("\n");

    const text = `# ${i.instructorName}${i.nickname ? ` (${i.nickname})` : ""}
연락처: ${i.phone || "없음"}
이메일: ${i.email || "없음"}
소속: ${i.affiliation || "없음"}
전문분야: ${i.expertiseArea || "없음"}
상태: ${i.status || "-"}
메모: ${i.memo || "없음"}

## 배정 프로젝트
${projects || "  없음"}`;

    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "update_instructor",
  "ERP 강사 정보 수정 (연락처·이메일·소속·메모 등). 계좌번호·주민번호 등 민감 정보는 외부 API에서 수정 불가하므로 이 도구로도 다룰 수 없다. 강사료·세금유형 등 정산 필드도 실수 방지를 위해 제외했다 — 필요하면 ERP 웹에서 수정할 것.",
  {
    id: z.string().describe("강사 ID (UUID). list_instructors에서 확보"),
    instructorName: z.string().optional().describe("강사 본명"),
    nickname: z.string().optional().describe("닉네임"),
    phone: z.string().optional().describe("연락처 (예: 010-1234-5678)"),
    email: z.string().optional().describe("이메일"),
    affiliation: z.string().optional().describe("소속"),
    expertiseArea: z.string().optional().describe("전문분야"),
    memo: z.string().optional().describe("메모 (차량번호 등 전용 필드가 없는 정보는 여기에)"),
  },
  async ({ id, ...fields }) => {
    const data = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (Object.keys(data).length === 0) {
      throw new Error("수정할 필드를 하나 이상 지정하세요");
    }
    const updated = await erp.updateInstructor(id, data);
    const changed = Object.keys(data).join(", ");
    return { content: [{ type: "text", text: `강사 수정 완료: ${updated.instructorName || id}\n변경 필드: ${changed}` }] };
  }
);

// ── 조회 전용 도구 (read) ────────────────────────────

server.tool(
  "get_notes",
  "프로젝트 메모 전체 조회. get_project는 최근 5건만 보여주므로 이력을 다 보려면 이 도구를 쓴다.",
  {
    projectId: z.string().describe("프로젝트 ID"),
    limit: z.number().optional().default(30).describe("최대 건수 (최신순)"),
  },
  async ({ projectId, limit }) => {
    const res = await erp.getNotes(projectId);
    const notes = res.notes || (Array.isArray(res) ? res : []);
    if (notes.length === 0) {
      return { content: [{ type: "text", text: "메모 없음" }] };
    }
    const lines = notes.slice(0, limit).map((n) => {
      const when = (n.occurredAt || n.createdAt || "").slice(0, 10);
      const who = n.author?.name || n.author || "";
      return `[${when}]${who ? ` ${who}` : ""}\n${n.content}`;
    });
    return { content: [{ type: "text", text: `메모 ${notes.length}건 (표시 ${Math.min(notes.length, limit)}건)\n\n${lines.join("\n\n")}` }] };
  }
);

server.tool(
  "get_account",
  "거래처(고객사) 상세 조회. 사업자번호·주소·세금계산서 이메일·담당자 연락처 포함.",
  {
    id: z.string().describe("거래처 ID. list_accounts에서 확보"),
  },
  async ({ id }) => {
    const a = await erp.getAccount(id);
    const text = `# ${a.companyName}
사업자번호: ${a.businessNumber || "없음"}
산업군: ${a.industry || "미지정"} | 세그먼트: ${a.segment || "미지정"} | 그룹: ${a.accountGroup || "미지정"}
담당자: ${a.defaultContactName || "없음"} / ${a.defaultContactEmail || "이메일 없음"} / ${a.defaultContactPhone || "연락처 없음"}
세금계산서 이메일: ${a.invoiceEmail || "없음"}
주소: ${a.address || "없음"}
메모: ${a.memo || "없음"}
프로젝트 수: ${a._count?.projects ?? (Array.isArray(a.projects) ? a.projects.length : "확인 불가")}`;
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "list_invoices",
  "세금계산서 발행·수금 현황 조회. 월 지정 시 그 달 발행/청구 건. 미수금 확인용.",
  {
    month: z.string().optional().describe("조회 월 (YYYY-MM). 미지정 시 전체"),
    status: z.string().optional().describe("수금 상태 필터 (예: not_billed / billed / paid)"),
  },
  async ({ month, status }) => {
    const invoices = await erp.listInvoices({ month, status });
    if (invoices.length === 0) {
      return { content: [{ type: "text", text: "해당 조건의 세금계산서 없음" }] };
    }
    let total = 0;
    let paid = 0;
    const lines = invoices.map((v) => {
      const amount = Number(v.invoiceAmount || 0);
      const paidAmount = Number(v.paidAmount || 0);
      total += amount;
      paid += paidAmount;
      const name = v.groupName || v.companyName || "이름 없음";
      const issue = (v.invoiceIssueDate || "").slice(0, 10);
      const due = (v.expectedPaymentDate || "").slice(0, 10);
      return `· ${name} | ${amount.toLocaleString()}원 | ${v.paymentStatus} | ${issue ? `발행 ${issue}` : "미발행"}${due ? ` | 입금예정 ${due}` : ""}`;
    });
    const outstanding = total - paid;
    return {
      content: [{
        type: "text",
        text: `세금계산서 ${invoices.length}건${month ? ` (${month})` : ""}\n합계 ${total.toLocaleString()}원 | 입금 ${paid.toLocaleString()}원 | 미수 ${outstanding.toLocaleString()}원\n\n${lines.join("\n")}`,
      }],
    };
  }
);

server.tool(
  "list_disbursements",
  "월별 강사료 지급 현황 조회 (지급 예정일 기준, 없으면 교육일 기준). 지급 상태별 합계 포함.",
  {
    month: z.string().describe("조회 월 (YYYY-MM). 필수"),
  },
  async ({ month }) => {
    const { items, summary } = await erp.listDisbursements(month);
    if (items.length === 0) {
      return { content: [{ type: "text", text: `${month} 강사료 지급 대상 없음` }] };
    }
    const lines = items.map((i) => {
      const who = i.instructor?.instructorName || i.instructor?.nickname || "?";
      const proj = i.project?.projectName || "?";
      return `· ${who} | ${proj} | ${Number(i.totalFee || 0).toLocaleString()}원 | ${i.roleType || "-"} | ${i.paymentStatus}`;
    });
    const byStatus = Object.entries(summary?.byStatus || {})
      .map(([k, v]) => `  ${k}: ${Number(v.fee || 0).toLocaleString()}원 (${v.count}건)`)
      .join("\n");
    const head = summary
      ? `공급가 ${Number(summary.totalSupply || 0).toLocaleString()}원 | 부가세 ${Number(summary.totalVat || 0).toLocaleString()}원 | 지급총액 ${Number(summary.totalPayment || 0).toLocaleString()}원`
      : "";
    return {
      content: [{
        type: "text",
        text: `${month} 강사료 ${items.length}건\n${head}\n\n## 상태별\n${byStatus || "  없음"}\n\n## 상세\n${lines.join("\n")}`,
      }],
    };
  }
);

server.tool(
  "list_vouchers",
  "상품권 발송 배치 조회. 기본은 작성중(draft)·승인(approved) 상태.",
  {
    status: z.string().optional().describe("상태 필터 쉼표 구분 (draft,checking,ready,approved,sending,sent,failed)"),
  },
  async ({ status }) => {
    const batches = await erp.listVouchers({ status });
    if (batches.length === 0) {
      return { content: [{ type: "text", text: "해당 상태의 상품권 배치 없음" }] };
    }
    const lines = batches.map((b) => {
      const name = b.batchName || b.name || b.title || b.id;
      const when = (b.createdAt || "").slice(0, 10);
      return `· ${name} | ${b.status} | 생성 ${when} | id:${b.id}`;
    });
    return { content: [{ type: "text", text: `상품권 배치 ${batches.length}건\n${lines.join("\n")}` }] };
  }
);

server.tool(
  "get_activity",
  "ERP 활동 이력(감사 로그) 조회. 누가 언제 무엇을 바꿨는지. 프로젝트별·기간별 필터 가능.",
  {
    limit: z.number().optional().default(20).describe("최대 건수 (최대 50)"),
    projectId: z.string().optional().describe("특정 프로젝트만"),
    entityType: z.string().optional().describe("대상 종류 필터 (예: Project, EducationSession, PersonalApiKey)"),
    dateFrom: z.string().optional().describe("시작일 (YYYY-MM-DD)"),
    dateTo: z.string().optional().describe("종료일 (YYYY-MM-DD)"),
  },
  async ({ limit, projectId, entityType, dateFrom, dateTo }) => {
    const logs = await erp.getActivity({ limit, projectId, entityType, dateFrom, dateTo });
    if (logs.length === 0) {
      return { content: [{ type: "text", text: "해당 조건의 활동 이력 없음" }] };
    }
    const lines = logs.map((l) => {
      const when = (l.createdAt || "").slice(0, 16).replace("T", " ");
      const target = l.entityName || l.projectName || l.entityId || "";
      return `· ${when} | ${l.actorName || "?"} | ${l.action} ${l.entityType}${target ? ` (${target})` : ""}`;
    });
    return { content: [{ type: "text", text: `활동 이력 ${logs.length}건\n${lines.join("\n")}` }] };
  }
);

// ── Calendar Sync Tools (Google OAuth 필요) ─────────────
// 이 게이트 안에는 구글 캘린더 자체가 필요한 도구만 둔다.
// 세션·매출·비용 등 ERP 데이터 도구는 캘린더와 무관하므로 게이트 밖에 있어야 한다.
// (과거에 이 블록이 너무 넓어서 OAuth 미설정 환경에서 세션 도구가 통째로 사라졌다)
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

} // end calendar sync tools

// ── Education Session / 매출·비용 Tools (캘린더 무관, 항상 등록) ──

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
  "delete_sessions",
  "프로젝트의 교육 세션 삭제. sessionIds로 특정 세션들만, 또는 deleteAll:true로 전체 삭제.",
  {
    projectId: z.string().describe("프로젝트 ID"),
    sessionIds: z.array(z.string()).optional().describe("삭제할 세션 ID 배열"),
    deleteAll: z.boolean().optional().describe("true면 해당 프로젝트 전체 세션 삭제"),
  },
  async ({ projectId, sessionIds, deleteAll }) => {
    if (!deleteAll && (!sessionIds || sessionIds.length === 0)) {
      throw new Error("sessionIds 또는 deleteAll 중 하나는 필요합니다");
    }
    await erp.deleteSessions(projectId, { sessionIds, deleteAll });
    return { content: [{ type: "text", text: deleteAll ? "전체 세션 삭제 완료" : `세션 ${sessionIds.length}건 삭제 완료` }] };
  }
);

server.tool(
  "add_revenue_item",
  "프로젝트에 매출 항목 추가. 금액은 원 단위 숫자.",
  {
    projectId: z.string().describe("프로젝트 ID"),
    revenueName: z.string().describe("매출 항목명 (예: '1차수 교육비')"),
    amount: z.number().describe("금액 (원)"),
    taxType: z.string().optional().describe("세금유형: 세금계산서 / 원천징수 / 면세 (미지정 가능)"),
  },
  async ({ projectId, revenueName, amount, taxType }) => {
    await erp.addRevenueItem(projectId, { revenueName, amount, taxType });
    return { content: [{ type: "text", text: `매출 항목 추가 완료: ${revenueName} ${amount.toLocaleString()}원` }] };
  }
);

server.tool(
  "add_cost_item",
  "프로젝트에 기타비용 항목 추가(강사료 제외). 금액은 원 단위 숫자.",
  {
    projectId: z.string().describe("프로젝트 ID"),
    costName: z.string().describe("비용명 (예: '교재 인쇄')"),
    amount: z.number().describe("금액 (원)"),
    costType: z.string().optional().describe("비용 유형 (미지정 시 '기타')"),
    vendorName: z.string().optional().describe("거래처/업체명"),
    note: z.string().optional().describe("비고"),
    expectedPaymentDate: z.string().optional().describe("지급 예정일 (YYYY-MM-DD)"),
  },
  async ({ projectId, costName, amount, costType, vendorName, note, expectedPaymentDate }) => {
    await erp.addCostItem(projectId, { costName, amount, costType, vendorName, note, expectedPaymentDate });
    return { content: [{ type: "text", text: `기타비용 항목 추가 완료: ${costName} ${amount.toLocaleString()}원` }] };
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

// ── Calendar Import/Read Tools (Google OAuth 필요) ──────
if (calendar.isCalendarConfigured()) {

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
