// ERP API client for b2b-sales-three.vercel.app/api/external/

const BASE_URL = "https://b2b-sales-three.vercel.app/api/external";

let apiKey = null;

export function setApiKey(key) {
  apiKey = key;
}

async function request(path, options = {}) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ERP API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Projects ──────────────────────────────────────────

export async function listProjects({ search, stage, owner, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (stage) params.set("stage", stage);
  if (owner) params.set("owner", owner);
  params.set("limit", String(limit));
  const res = await request(`/projects?${params}`);
  return { data: res.projects || res.data || res, total: res.total };
}

export async function getProject(id) {
  const res = await request(`/projects/${id}`);
  return res.project || res;
}

export async function updateProject(id, data) {
  return request(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...data, botName: "erp-mcp" }),
  });
}

export async function createProject(data) {
  return request("/projects", {
    method: "POST",
    body: JSON.stringify({ ...data, botName: "erp-mcp" }),
  });
}

// ── Accounts ──────────────────────────────────────────

export async function listAccounts({ search } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const res = await request(`/accounts?${params}`);
  return Array.isArray(res) ? res : res.data || res.accounts || res;
}

export async function getAccount(id) {
  const res = await request(`/accounts/${id}`);
  return res.account || res;
}

export async function createAccount(data) {
  const res = await request("/accounts", {
    method: "POST",
    body: JSON.stringify({ ...data, botName: "erp-mcp" }),
  });
  return res.account || res;
}

// ── Dashboard ─────────────────────────────────────────

export async function getDashboard(month) {
  const params = month ? `?month=${month}` : "";
  return request(`/dashboard${params}`);
}

// ── Instructors ───────────────────────────────────────

export async function listInstructors({ search } = {}) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const res = await request(`/instructors?${params}`);
  return Array.isArray(res) ? res : res.data || res.instructors || res;
}

export async function getInstructor(id) {
  const res = await request(`/instructors/${id}`);
  return res.instructor || res;
}

export async function updateInstructor(id, data) {
  const res = await request(`/instructors/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...data, botName: "erp-mcp" }),
  });
  return res.instructor || res;
}

// ── Revenue Items ─────────────────────────────────────

export async function addRevenueItem(projectId, data) {
  return request(`/projects/${projectId}/revenue-items`, {
    method: "POST",
    body: JSON.stringify({ ...data, botName: "erp-mcp" }),
  });
}

// ── Quotations (견적서) ───────────────────────────────

export async function listQuotations(projectId) {
  const res = await request(`/projects/${projectId}/quotations`);
  return res.quotations || [];
}

export async function addQuotation(projectId, data) {
  return request(`/projects/${projectId}/quotations`, {
    method: "POST",
    body: JSON.stringify({ ...data, botName: "erp-mcp" }),
  });
}

export async function updateQuotation(projectId, itemId, data) {
  return request(`/projects/${projectId}/quotations`, {
    method: "PATCH",
    body: JSON.stringify({ ...data, itemId, botName: "erp-mcp" }),
  });
}

export async function deleteQuotation(projectId, itemId) {
  return request(`/projects/${projectId}/quotations?itemId=${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}

// ── Cost Items ────────────────────────────────────────

export async function addCostItem(projectId, data) {
  return request(`/projects/${projectId}/cost-items`, {
    method: "POST",
    body: JSON.stringify({ ...data, botName: "erp-mcp" }),
  });
}

// ── Project Notes ─────────────────────────────────────

export async function addNote(projectId, content, occurredAt) {
  return request(`/projects/${projectId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content, botName: "erp-mcp", occurredAt: occurredAt || null }),
  });
}

export async function getNotes(projectId) {
  return request(`/projects/${projectId}/notes`);
}

// ── Education Sessions ────────────────────────────────

export async function getSessions(projectId) {
  return request(`/projects/${projectId}/sessions`);
}

export async function addSessions(projectId, sessions) {
  return request(`/projects/${projectId}/sessions`, {
    method: "POST",
    body: JSON.stringify({ sessions }),
  });
}

export async function deleteSessions(projectId, { sessionIds, deleteAll } = {}) {
  return request(`/projects/${projectId}/sessions`, {
    method: "DELETE",
    body: JSON.stringify(deleteAll ? { deleteAll: true } : { sessionIds }),
  });
}

export async function patchSession(projectId, body) {
  return request(`/projects/${projectId}/sessions`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ── Invoices (세금계산서) ──────────────────────────────

export async function listInvoices({ month, status } = {}) {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (status) params.set("status", status);
  const res = await request(`/invoices?${params}`);
  return res.invoices || [];
}

// ── Disbursements (강사료 지급) ────────────────────────

export async function listDisbursements(month) {
  const res = await request(`/disbursements?month=${month}`);
  return { items: res.items || [], summary: res.summary || null };
}

// ── Vouchers (상품권 발송) ─────────────────────────────

export async function listVouchers({ status } = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const res = await request(`/vouchers?${params}`);
  return res.batches || [];
}

// ── Activity (활동 이력) ───────────────────────────────

export async function getActivity({ limit, entityType, projectId, dateFrom, dateTo } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (entityType) params.set("entityType", entityType);
  if (projectId) params.set("projectId", projectId);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const res = await request(`/activity?${params}`);
  return res.logs || [];
}
