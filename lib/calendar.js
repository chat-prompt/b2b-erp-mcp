// Google Calendar integration using OAuth2 token

import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLIENT_ID = process.env.B2B_ERP_GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.B2B_ERP_GOOGLE_CLIENT_SECRET || "";
const TOKEN_PATH = process.env.B2B_ERP_GOOGLE_TOKEN_PATH
  || path.join(process.env.HOME || "", "clawd/skills/b2b-secretary/gmail-token.json");

function isCalendarConfigured() {
  if (!CLIENT_ID || !CLIENT_SECRET) return false;
  try {
    return fs.existsSync(TOKEN_PATH);
  } catch {
    return false;
  }
}

function calendarUnavailableError() {
  return new Error(
    "캘린더 도구는 OAuth 설정이 필요합니다. " +
    "B2B_ERP_GOOGLE_CLIENT_ID, B2B_ERP_GOOGLE_CLIENT_SECRET, B2B_ERP_GOOGLE_TOKEN_PATH 환경변수와 토큰 파일이 필요합니다."
  );
}

export { isCalendarConfigured };

// GPTers 교육 일정 (shared calendar)
const EDUCATION_CALENDAR_ID = "c_c90c7b4ba578d17b9b8aabe503a0c2a002a48c4f81b6645d3cd04e6f1242772f@group.calendar.google.com";
const OWNER_CALENDAR_ID = "gkhan@gpters.org";

let calendarClient = null;

async function getAuth() {
  if (!isCalendarConfigured()) throw calendarUnavailableError();
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "urn:ietf:wg:oauth:2.0:oob");
  oauth2Client.setCredentials(tokens);

  // Auto-refresh if expired
  if (tokens.expiry_date && tokens.expiry_date < Date.now() + 60000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
    oauth2Client.setCredentials(credentials);
  }
  return oauth2Client;
}

async function getCalendar() {
  if (!calendarClient) {
    const auth = await getAuth();
    calendarClient = google.calendar({ version: "v3", auth });
  }
  return calendarClient;
}

/**
 * Search for existing calendar events matching a project name prefix.
 * Returns all matches.
 */
export async function findEventsByProject(projectName) {
  const calendar = await getCalendar();
  const res = await calendar.events.list({
    calendarId: OWNER_CALENDAR_ID,
    q: projectName,
    timeMin: "2025-01-01T00:00:00+09:00",
    timeMax: "2027-12-31T23:59:59+09:00",
    singleEvents: true,
    maxResults: 50,
  });

  const events = res.data.items || [];
  // Match events that start with the project name
  return events.filter((e) => e.summary && e.summary.startsWith(projectName));
}

// Legacy: find single event by exact name
export async function findEventByProject(projectName) {
  const events = await findEventsByProject(projectName);
  return events.find((e) => e.summary === projectName) || null;
}

/**
 * Sync project education sessions to Google Calendar.
 * Creates individual timed events for each session.
 * Uses education_sessions if available, falls back to start/end date range.
 *
 * Returns { results: [{ action, date, eventId, link }], summary }
 */
export async function syncProjectToCalendar(project) {
  const { projectName, educationStartDate, educationEndDate, account, educationSessions } = project;
  const companyName = account?.companyName || "";
  const calendar = await getCalendar();

  // Find all existing events for this project
  const existingEvents = await findEventsByProject(projectName);
  const existingByDate = new Map();
  for (const ev of existingEvents) {
    const dateStr = ev.start?.date || ev.start?.dateTime?.slice(0, 10);
    if (dateStr) existingByDate.set(dateStr, ev);
  }

  const results = [];

  // Use education sessions if available
  const sessions = educationSessions || [];

  if (sessions.length > 0) {
    // Create/update events for each session
    for (const session of sessions) {
      const dateStr = (session.date || "").slice(0, 10);
      if (!dateStr) continue;

      const startTime = session.startTime || "09:00";
      const endTime = session.endTime || "18:00";
      const summary = `${projectName}`;
      const location = session.location || "";

      const eventBody = {
        summary,
        description: `고객사: ${companyName}\n담당: ${project.ownerName || ""}\n${session.note || ""}\nERP: https://b2b-sales-three.vercel.app/projects/${project.id}`.trim(),
        location,
        start: { dateTime: `${dateStr}T${startTime}:00+09:00`, timeZone: "Asia/Seoul" },
        end: { dateTime: `${dateStr}T${endTime}:00+09:00`, timeZone: "Asia/Seoul" },
        attendees: [
          { email: EDUCATION_CALENDAR_ID, optional: false, displayName: "GPTers 교육 일정" },
          { email: OWNER_CALENDAR_ID, optional: true, displayName: "한가경" },
        ],
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 1440 }],
        },
      };

      const existing = existingByDate.get(dateStr);
      if (existing) {
        const res = await calendar.events.update({
          calendarId: OWNER_CALENDAR_ID,
          eventId: existing.id,
          requestBody: eventBody,
          sendUpdates: "none",
        });
        existingByDate.delete(dateStr);
        results.push({ action: "updated", date: dateStr, eventId: res.data.id, link: res.data.htmlLink });
      } else {
        const res = await calendar.events.insert({
          calendarId: OWNER_CALENDAR_ID,
          requestBody: eventBody,
          sendUpdates: "none",
        });
        results.push({ action: "created", date: dateStr, eventId: res.data.id, link: res.data.htmlLink });
      }
    }

    // Delete events that no longer have matching sessions
    for (const [dateStr, ev] of existingByDate) {
      await calendar.events.delete({
        calendarId: OWNER_CALENDAR_ID,
        eventId: ev.id,
        sendUpdates: "none",
      });
      results.push({ action: "deleted", date: dateStr, eventId: ev.id });
    }
  } else if (educationStartDate) {
    // Fallback: no sessions defined, skip (don't create range events)
    return {
      results: [],
      summary: `교육 세션이 등록되지 않음 (educationSessions 비어있음). ERP에서 교육 세션 날짜를 먼저 등록하세요.`,
    };
  } else {
    return {
      results: [],
      summary: "교육 시작일 없음",
    };
  }

  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const deleted = results.filter((r) => r.action === "deleted").length;

  return {
    results,
    summary: `${projectName}: 생성 ${created}, 업데이트 ${updated}, 삭제 ${deleted}`,
  };
}

/**
 * Delete all calendar events for a project.
 */
export async function deleteEventsByProject(projectName) {
  const calendar = await getCalendar();
  const events = await findEventsByProject(projectName);

  let deleted = 0;
  for (const ev of events) {
    await calendar.events.delete({
      calendarId: OWNER_CALENDAR_ID,
      eventId: ev.id,
      sendUpdates: "none",
    });
    deleted++;
  }
  return { action: "deleted", count: deleted };
}

// Legacy single delete
export async function deleteEventByProject(projectName) {
  const result = await deleteEventsByProject(projectName);
  return result.count > 0 ? { action: "deleted" } : { action: "not_found" };
}

/**
 * List upcoming education events.
 */
export async function listUpcomingEvents(maxResults = 10) {
  const calendar = await getCalendar();
  const now = new Date().toISOString();
  const res = await calendar.events.list({
    calendarId: OWNER_CALENDAR_ID,
    timeMin: now,
    singleEvents: true,
    orderBy: "startTime",
    maxResults,
  });
  return (res.data.items || []).map((e) => ({
    id: e.id,
    summary: e.summary,
    start: e.start?.date || e.start?.dateTime,
    end: e.end?.date || e.end?.dateTime,
    link: e.htmlLink,
  }));
}
