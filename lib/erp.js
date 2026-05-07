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

// ── Revenue Items ─────────────────────────────────────

export async function addRevenueItem(projectId, data) {
  return request(`/projects/${projectId}/revenue-items`, {
    method: "POST",
    body: JSON.stringify({ ...data, botName: "erp-mcp" }),
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

export async function addNote(projectId, content) {
  return request(`/projects/${projectId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content, botName: "erp-mcp" }),
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
