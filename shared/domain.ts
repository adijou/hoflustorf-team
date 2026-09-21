export type Lang = "de" | "es";
export type Role = "manager" | "staff";
export type Category = "horses" | "pasture" | "maintenance" | "other";
export type Repeat = "once" | "daily" | "weekly" | "monthly";
export interface Member {
  id: string;
  name: string;
  // Read-only Identity address, populated in manager responses (or demo data).
  email?: string;
  role: Role;
  weeklyMinutes: number;
  version?: number;
  deletedAt?: string;
}
export interface Task {
  id: string;
  titleDe: string;
  titleEs: string;
  notes: string;
  category: Category;
  budget: number;
  assignee: string;
  startDate: string;
  endDate?: string;
  repeat: Repeat;
  twoPeople: boolean;
  status: "active" | "proposed";
  createdBy: string;
  version?: number;
  deletedAt?: string;
  sourceLang?: Lang;
  notesDe?: string;
  notesEs?: string;
  translationStatus?: "ready" | "pending";
}
export interface Entry {
  id: string;
  memberId: string;
  date: string;
  start: number;
  end: number;
  pause: number;
  minutes: number;
  taskId: string;
  note: string;
  version: number;
  voided: boolean;
  taskTitleDe?: string;
  taskTitleEs?: string;
  changedBy?: string;
  changedAt?: string;
  changeReason?: string;
}
export interface Completion {
  key: string;
  by: string;
  at: string;
}
export interface Report {
  memberId: string;
  month: string;
  status: "submitted" | "approved";
  at: string;
  by: string;
  note: string;
  version?: number;
  id?: string;
}
export interface State {
  members: Member[];
  tasks: Task[];
  entries: Entry[];
  completions: Completion[];
  reports: Report[];
}
export interface View extends State {
  me: Member;
  totals: Record<string, number>;
}
export type Action = { type: string; payload: Record<string, unknown> };
export class DomainError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export const emptyState = (): State => ({
  members: [],
  tasks: [],
  entries: [],
  completions: [],
  reports: [],
});
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function dateValid(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) &&
    new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s
  );
}
export function addDays(s: string, n: number) {
  const d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekStart(s: string) {
  const day = new Date(s + "T12:00:00Z").getUTCDay();
  return addDays(s, -((day + 6) % 7));
}
export const keyFor = (id: string, date: string) => `${id}:${date}`;
export function occurs(t: Task, date: string) {
  if (
    t.deletedAt ||
    t.status !== "active" ||
    date < t.startDate ||
    (t.endDate && date > t.endDate)
  )
    return false;
  if (t.repeat === "daily") return true;
  if (t.repeat === "once") return date === t.startDate;
  if (t.repeat === "weekly")
    return (
      new Date(date + "T12:00:00Z").getUTCDay() ===
      new Date(t.startDate + "T12:00:00Z").getUTCDay()
    );
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d === Math.min(Number(t.startDate.slice(8)), last);
}
export function duration(start: number, end: number, pause: number) {
  if (
    ![start, end, pause].every(Number.isInteger) ||
    start < 0 ||
    end > 1440 ||
    end <= start ||
    pause < 0 ||
    pause >= end - start
  )
    throw new DomainError("invalidTime");
  return end - start - pause;
}
export const reportFor = (s: State, id: string, month: string) =>
  s.reports.find((r) => r.memberId === id && r.month === month);
export function taskTotals(s: State) {
  const r: Record<string, number> = {};
  for (const e of s.entries)
    if (!e.voided)
      r[keyFor(e.taskId, e.date)] =
        (r[keyFor(e.taskId, e.date)] || 0) + e.minutes;
  return r;
}
export function viewFor(s: State, id: string): View {
  const me = s.members.find((m) => m.id === id);
  if (!me || me.deletedAt) throw new DomainError("forbidden");
  const members = s.members.map((member) => {
    const { email, ...profile } = member;
    return me.role === "manager" ? { ...member } : profile;
  });
  return {
    ...s,
    members,
    me: members.find((m) => m.id === id)!,
    entries:
      me.role === "manager"
        ? s.entries
        : s.entries.filter((e) => e.memberId === id),
    reports:
      me.role === "manager"
        ? s.reports
        : s.reports.filter((r) => r.memberId === id),
    totals: taskTotals(s),
  };
}
function string(p: Record<string, unknown>, key: string, max = 500) {
  const v = p[key];
  if (typeof v !== "string" || v.length > max)
    throw new DomainError("invalidInput");
  return v.trim();
}
function integer(
  p: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
) {
  const n = p[key];
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max)
    throw new DomainError("invalidInput");
  return n;
}
export const taskTitle = (t: Task, lang: Lang) =>
  lang === "es" ? t.titleEs || t.titleDe : t.titleDe || t.titleEs;
export const taskNotes = (t: Task, lang: Lang) =>
  lang === "es" ? t.notesEs || t.notes : t.notesDe || t.notes;
export function entryTitle(e: Entry, t: Task | undefined, lang: Lang) {
  return lang === "es"
    ? e.taskTitleEs || e.taskTitleDe || (t && taskTitle(t, lang)) || ""
    : e.taskTitleDe || e.taskTitleEs || (t && taskTitle(t, lang)) || "";
}
function checkVersion(
  entity: { version?: number },
  p: Record<string, unknown>,
) {
  if (p.version !== (entity.version ?? 1)) throw new DomainError("conflict");
}
function editableTask(m: Member, t: Task) {
  if (
    m.role !== "manager" &&
    !(t.status === "proposed" && t.createdBy === m.id)
  )
    throw new DomainError("forbidden");
}
function snapshotTitles(s: State, t: Task) {
  for (const e of s.entries)
    if (e.taskId === t.id) {
      e.taskTitleDe ??= t.titleDe;
      e.taskTitleEs ??= t.titleEs;
    }
}
function requireManager(m: Member) {
  if (m.role !== "manager") throw new DomainError("forbidden");
}
export function applyAction(
  input: State,
  actorId: string,
  action: Action,
  newId: string,
  now: string,
): State {
  const s = structuredClone(input),
    m = s.members.find((x) => x.id === actorId);
  if (!m || m.deletedAt) throw new DomainError("forbidden");
  const p = action.payload,
    currentDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Zurich",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
  if (!p || typeof p !== "object" || Array.isArray(p))
    throw new DomainError("invalidInput");
  switch (action.type) {
    case "task.create":
    case "task.update": {
      const existing =
        action.type === "task.update"
          ? s.tasks.find((t) => t.id === p.id)
          : undefined;
      if (action.type === "task.update") {
        if (!existing || existing.deletedAt) throw new DomainError("notFound");
        editableTask(m, existing);
        checkVersion(existing, p);
        snapshotTitles(s, existing);
      }
      // Accept old clients during the rollout; the new form sends a single source title.
      const sourceLang = (p.inputLang ?? (p.titleDe ? "de" : "es")) as Lang;
      if (!["de", "es"].includes(sourceLang))
        throw new DomainError("invalidInput");
      const title =
        typeof p.title === "string"
          ? string(p, "title", 300)
          : string(p, sourceLang === "de" ? "titleDe" : "titleEs", 300);
      if (!title) throw new DomainError("titleRequired");
      const notes = string(p, "notes", 1000),
        startDate = string(p, "startDate", 10);
      const endDate = p.endDate ? string(p, "endDate", 10) : undefined;
      if (
        !dateValid(startDate) ||
        (endDate && (!dateValid(endDate) || endDate < startDate))
      )
        throw new DomainError("invalidDate");
      const category = string(p, "category") as Category,
        repeat = string(p, "repeat") as Repeat,
        assignee = string(p, "assignee", 100);
      if (
        !["horses", "pasture", "maintenance", "other"].includes(category) ||
        !["once", "daily", "weekly", "monthly"].includes(repeat) ||
        (assignee && !s.members.some((x) => x.id === assignee && !x.deletedAt))
      )
        throw new DomainError("invalidInput");
      if (typeof p.twoPeople !== "boolean")
        throw new DomainError("invalidInput");
      const sameText =
        existing &&
        existing.sourceLang === sourceLang &&
        taskTitle(existing, sourceLang) === title &&
        existing.notes === notes;
      const task: Task = {
        id: existing?.id || newId,
        titleDe: sourceLang === "de" ? title : "",
        titleEs: sourceLang === "es" ? title : "",
        notes,
        notesDe: sourceLang === "de" ? notes : "",
        notesEs: sourceLang === "es" ? notes : "",
        sourceLang,
        translationStatus: "pending",
        category,
        budget: integer(p, "budget", 0, 2880),
        assignee,
        startDate,
        endDate,
        repeat,
        twoPeople: p.twoPeople,
        status:
          existing?.status || (m.role === "manager" ? "active" : "proposed"),
        createdBy: existing?.createdBy || actorId,
        version: (existing?.version ?? (existing ? 1 : 0)) + 1,
      };
      if (sameText)
        Object.assign(task, {
          titleDe: existing.titleDe,
          titleEs: existing.titleEs,
          notesDe: existing.notesDe,
          notesEs: existing.notesEs,
          translationStatus: existing.translationStatus,
        });
      if (existing)
        s.tasks = s.tasks.map((t) => (t.id === existing.id ? task : t));
      else s.tasks.push(task);
      break;
    }
    case "task.approve":
    case "task.pause":
    case "task.translate":
    case "task.delete":
    case "task.restore": {
      const t = s.tasks.find((x) => x.id === p.id);
      if (!t) throw new DomainError("notFound");
      if (["task.approve", "task.pause", "task.restore"].includes(action.type))
        requireManager(m);
      else editableTask(m, t);
      checkVersion(t, p);
      if (t.deletedAt && action.type !== "task.restore")
        throw new DomainError("notFound");
      if (action.type === "task.approve") t.status = "active";
      if (action.type === "task.pause") t.endDate = currentDate;
      if (action.type === "task.translate") t.translationStatus = "pending";
      if (action.type === "task.delete") {
        if (!string(p, "reason", 500)) throw new DomainError("noteRequired");
        snapshotTitles(s, t);
        t.deletedAt = now;
      }
      if (action.type === "task.restore") delete t.deletedAt;
      t.version = (t.version ?? 1) + 1;
      break;
    }
    case "member.update":
    case "member.delete":
    case "member.restore": {
      requireManager(m);
      const target = s.members.find((x) => x.id === p.id);
      if (!target) throw new DomainError("notFound");
      checkVersion(target, p);
      if (action.type === "member.update") {
        if (target.deletedAt) throw new DomainError("notFound");
        const name = string(p, "name", 100);
        if (!name) throw new DomainError("invalidInput");
        target.name = name;
        target.weeklyMinutes = integer(p, "weeklyMinutes", 0, 10080);
      } else if (action.type === "member.delete") {
        if (target.id === actorId) throw new DomainError("selfDelete");
        if (!string(p, "reason", 500)) throw new DomainError("noteRequired");
        target.deletedAt = now;
        for (const t of s.tasks)
          if (t.assignee === target.id) {
            t.assignee = "";
            t.version = (t.version ?? 1) + 1;
          }
      } else delete target.deletedAt;
      target.version = (target.version ?? 1) + 1;
      break;
    }
    case "task.complete": {
      const t = s.tasks.find((x) => x.id === p.id),
        date = string(p, "date", 10);
      if (!t || !dateValid(date) || !occurs(t, date) || date > currentDate)
        throw new DomainError("invalidDate");
      const k = keyFor(t.id, date);
      if (typeof p.done !== "boolean") throw new DomainError("invalidInput");
      s.completions = s.completions.filter((c) => c.key !== k);
      if (p.done) s.completions.push({ key: k, by: actorId, at: now });
      break;
    }
    case "entry.save": {
      const id = string(p, "id", 100),
        existing = id ? s.entries.find((e) => e.id === id) : undefined;
      if (id && !existing) throw new DomainError("notFound");
      if (existing && existing.voided) throw new DomainError("forbidden");
      const ownerId = existing?.memberId || actorId;
      if (ownerId !== actorId) {
        requireManager(m);
        if (!string(p, "reason", 500)) throw new DomainError("noteRequired");
      }
      if (existing && existing.version !== p.version)
        throw new DomainError("conflict");
      const date = string(p, "date", 10);
      if (!dateValid(date) || date > currentDate)
        throw new DomainError("invalidDate");
      if (
        reportFor(s, ownerId, date.slice(0, 7)) ||
        (existing && reportFor(s, ownerId, existing.date.slice(0, 7)))
      )
        throw new DomainError("reportLocked");
      const taskId = string(p, "taskId", 100),
        t = s.tasks.find((x) => x.id === taskId);
      // Unplanned work can always be reported without inventing a task.
      if (
        taskId &&
        (!t ||
          (!occurs(t, date) &&
            !(
              existing &&
              existing.taskId === taskId &&
              existing.date === date
            )))
      )
        throw new DomainError("invalidTask");
      const note = string(p, "note", 1000);
      if (!taskId && !note) throw new DomainError("noteRequired");
      const start = integer(p, "start", 0, 1439),
        end = integer(p, "end", 1, 1440),
        pause = integer(p, "pause", 0, 1439),
        minutes = duration(start, end, pause);
      if (
        s.entries.some(
          (e) =>
            !e.voided &&
            e.id !== id &&
            e.memberId === ownerId &&
            e.date === date &&
            start < e.end &&
            end > e.start,
        )
      )
        throw new DomainError("overlap");
      const entry: Entry = {
        id: id || newId,
        memberId: ownerId,
        date,
        start,
        end,
        pause,
        minutes,
        taskId,
        note,
        version: (existing?.version || 0) + 1,
        voided: false,
        taskTitleDe:
          existing?.taskId === taskId
            ? (existing.taskTitleDe ?? t?.titleDe)
            : t?.titleDe,
        taskTitleEs:
          existing?.taskId === taskId
            ? (existing.taskTitleEs ?? t?.titleEs)
            : t?.titleEs,
        changedBy: actorId,
        changedAt: now,
        changeReason: ownerId !== actorId ? string(p, "reason", 500) : "",
      };
      if (existing) s.entries = s.entries.map((e) => (e.id === id ? entry : e));
      else s.entries.push(entry);
      break;
    }
    case "entry.void": {
      const e = s.entries.find((x) => x.id === p.id);
      if (!e) throw new DomainError("notFound");
      if (e.memberId !== actorId) requireManager(m);
      if (reportFor(s, e.memberId, e.date.slice(0, 7)))
        throw new DomainError("reportLocked");
      if (e.version !== p.version) throw new DomainError("conflict");
      if (!string(p, "reason", 500)) throw new DomainError("noteRequired");
      e.voided = true;
      e.version++;
      e.changedBy = actorId;
      e.changedAt = now;
      e.changeReason = string(p, "reason", 500);
      break;
    }
    case "report.submit": {
      const month = string(p, "month", 7);
      if (
        !/^\d{4}-\d{2}$/.test(month) ||
        !dateValid(month + "-01") ||
        month > currentDate.slice(0, 7)
      )
        throw new DomainError("invalidDate");
      if (reportFor(s, actorId, month)) throw new DomainError("reportLocked");
      if (
        !s.entries.some(
          (e) =>
            e.memberId === actorId && !e.voided && e.date.startsWith(month),
        )
      )
        throw new DomainError("emptyReport");
      s.reports.push({
        memberId: actorId,
        month,
        status: "submitted",
        at: now,
        by: actorId,
        note: "",
        version: 1,
        id: newId,
      });
      break;
    }
    case "report.approve": {
      requireManager(m);
      const r = reportFor(s, string(p, "memberId", 100), string(p, "month", 7));
      if (!r || r.status !== "submitted") throw new DomainError("notFound");
      checkVersion(r, p);
      if (p.reportId !== (r.id ?? r.at)) throw new DomainError("conflict");
      if (r.memberId === actorId) throw new DomainError("selfApproval");
      r.status = "approved";
      r.at = now;
      r.by = actorId;
      r.version = (r.version ?? 1) + 1;
      break;
    }
    case "report.delete":
    case "report.reopen": {
      requireManager(m);
      const note = string(p, "note", 500);
      if (!note) throw new DomainError("noteRequired");
      const memberId = string(p, "memberId", 100),
        month = string(p, "month", 7);
      const r = reportFor(s, memberId, month);
      if (!r) throw new DomainError("notFound");
      checkVersion(r, p);
      if (p.reportId !== (r.id ?? r.at)) throw new DomainError("conflict");
      s.reports = s.reports.filter(
        (r) => r.memberId !== memberId || r.month !== month,
      );
      break;
    }
    default:
      throw new DomainError("invalidAction");
  }
  return s;
}
export function csv(rows: unknown[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((v) => {
            let x = String(v ?? "");
            if (/^[\s]*[=+@-]/.test(x)) x = "'" + x;
            return '"' + x.replaceAll('"', '""') + '"';
          })
          .join(";"),
      )
      .join("\r\n")
  );
}
