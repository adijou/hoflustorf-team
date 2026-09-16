import React, {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Sun,
  CalendarDays,
  ClipboardList,
  Clock3,
  BarChart3,
  Plus,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Users,
  Download,
  Repeat2,
  Sprout,
  ArrowRight,
  RefreshCw,
  Pencil,
} from "lucide-react";
import {
  getUser,
  handleAuthCallback,
  login,
  logout,
  acceptInvite,
  updateUser,
  requestPasswordRecovery,
  type CallbackResult,
} from "@netlify/identity";
import {
  addDays,
  applyAction,
  csv,
  keyFor,
  occurs,
  reportFor,
  today,
  viewFor,
  weekStart,
  taskTitle,
  taskNotes,
  entryTitle,
  type Member,
  type Action,
  type Entry,
  type Lang,
  type Task,
  type View,
  type State,
} from "../shared/domain";
import { copy, type TextKey } from "./i18n";
import { demoState } from "./demo";
import { TaskForm } from "./TaskForm";
import "./style.css";
const DEMO = import.meta.env.VITE_DEMO === "true";
const icons = {
  today: Sun,
  week: CalendarDays,
  tasks: ClipboardList,
  hours: Clock3,
  reports: BarChart3,
  people: Users,
};
type Tab = keyof typeof icons;
type Modal =
  | { kind: "task"; task: Task; date: string }
  | { kind: "newTask"; task?: Task }
  | { kind: "member"; member: Member }
  | { kind: "entry"; entry?: Entry; task?: Task; date?: string }
  | {
      kind: "reason";
      action:
        | "entry.void"
        | "report.reopen"
        | "report.delete"
        | "task.delete"
        | "member.delete";
      payload: Record<string, unknown>;
    }
  | { kind: "pause"; task: Task };
function minutes(v: number) {
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}
function time(v: number) {
  return minutes(v);
}
function parseTime(v: FormDataEntryValue | null) {
  const s = String(v || "");
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(s)) return NaN;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
function initialLang(): Lang {
  try {
    return localStorage.getItem("hof-team-language") === "es" ? "es" : "de";
  } catch {
    return "de";
  }
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "field wide" : "field"}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={
            copy[document.documentElement.lang.startsWith("es") ? "es" : "de"]
              .close
          }
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function EntryForm({
  v,
  lang,
  modal,
  busy,
  submit,
  onClose,
}: {
  v: View;
  lang: Lang;
  modal: Extract<Modal, { kind: "entry" }>;
  busy: boolean;
  submit: (a: Action) => Promise<void>;
  onClose: () => void;
}) {
  const t = copy[lang],
    e = modal.entry;
  const [date, setDate] = useState(e?.date || modal.date || today());
  const [task, setTask] = useState(e?.taskId || modal.task?.id || "");
  const onSubmit = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    await submit({
      type: "entry.save",
      payload: {
        id: e?.id || "",
        version: e?.version || 0,
        date,
        taskId: task,
        start: parseTime(f.get("start")),
        end: parseTime(f.get("end")),
        pause: Number(f.get("pause")),
        note: String(f.get("note") || ""),
        reason: String(f.get("reason") || ""),
      },
    });
  };
  return (
    <form onSubmit={onSubmit}>
      {e && e.memberId !== v.me.id && (
        <p className="notice">
          {t.reportOwner}: {v.members.find((m) => m.id === e.memberId)?.name}
        </p>
      )}
      <div className="form-grid">
        <Field label={t.date}>
          <input
            type="date"
            required
            value={date}
            max={today()}
            onChange={(e) => {
              setDate(e.target.value);
              setTask("");
            }}
          />
        </Field>
        <Field label={t.task}>
          <select value={task} onChange={(e) => setTask(e.target.value)}>
            <option value="">{t.unplanned}</option>
            {v.tasks
              .filter(
                (t) =>
                  occurs(t, date) || (e?.taskId === t.id && e.date === date),
              )
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {lang === "es"
                    ? x.titleEs || x.titleDe
                    : x.titleDe || x.titleEs}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t.start}>
          <input
            name="start"
            required
            inputMode="numeric"
            placeholder="07:00"
            defaultValue={e ? time(e.start) : "07:00"}
            pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
          />
        </Field>
        <Field label={t.end}>
          <input
            name="end"
            required
            inputMode="numeric"
            placeholder="09:00"
            defaultValue={e ? time(e.end) : "09:00"}
            pattern="([01][0-9]|2[0-3]):[0-5][0-9]|24:00"
          />
        </Field>
        <Field label={t.pause}>
          <input
            name="pause"
            type="number"
            min="0"
            max="1439"
            required
            defaultValue={e?.pause || 0}
          />
        </Field>
        <Field label={t.note} wide>
          <textarea
            name="note"
            maxLength={1000}
            required={!task}
            defaultValue={e?.note || ""}
            rows={3}
          />
        </Field>
        {e && e.memberId !== v.me.id && (
          <Field label={t.reason} wide>
            <textarea name="reason" required maxLength={500} rows={2} />
          </Field>
        )}
      </div>
      <p className="muted small">{t.timeHint}</p>
      <p className="notice">{t.budgetNote}</p>
      <div className="dialog-actions">
        <button type="button" className="button ghost" onClick={onClose}>
          {t.cancel}
        </button>
        <button disabled={busy} className="button primary" type="submit">
          {busy ? t.saving : t.save}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
function App() {
  const [lang, setLang] = useState<Lang>(initialLang),
    t = copy[lang];
  const [v, setV] = useState<View | null>(null),
    [loading, setLoading] = useState(true),
    [logged, setLogged] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [callback, setCallback] = useState<CallbackResult | null>(null);
  const demo = useRef<State>(demoState());
  const [demoActor, setDemoActor] = useState("demo-manager");
  const [tab, setTab] = useState<Tab>("today"),
    [selectedDate, setSelectedDate] = useState(today()),
    [month, setMonth] = useState(today().slice(0, 7)),
    [filter, setFilter] = useState<"all" | "own">("all"),
    [modal, setModal] = useState<Modal | null>(null),
    [menu, setMenu] = useState(false);
  const title = (x: Task) => taskTitle(x, lang);
  const [showDeleted, setShowDeleted] = useState(false);
  const label = (key: string) => (t as Record<string, string>)[key] || t.error;
  const niceDate = (date: string, short = false) =>
    new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "de-CH", {
      weekday: short ? "short" : "long",
      day: "numeric",
      month: short ? "short" : "long",
      timeZone: "UTC",
    }).format(new Date(date + "T12:00:00Z"));
  useEffect(() => {
    document.documentElement.lang = lang === "de" ? "de-CH" : "es";
    try {
      localStorage.setItem("hof-team-language", lang);
    } catch {}
  }, [lang]);
  const load = async () => {
    setError("");
    try {
      if (DEMO) {
        setV(viewFor(demo.current, demoActor));
        setLogged(true);
        return;
      }
      const user = await getUser();
      setLogged(!!user);
      if (!user) {
        setV(null);
        return;
      }
      const r = await fetch("/api/workspace", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "serverUnavailable");
      setV(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "serverUnavailable");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    (async () => {
      if (!DEMO) {
        try {
          const c = await handleAuthCallback();
          if (active && c && (c.type === "invite" || c.type === "recovery")) {
            setCallback(c);
            setLoading(false);
            return;
          }
        } catch {
          if (active) setError("error");
        }
      }
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [demoActor]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  const run = async (action: Action) => {
    setBusy(true);
    setError("");
    try {
      let pending = false;
      if (DEMO) {
        demo.current = applyAction(
          demo.current,
          demoActor,
          action,
          crypto.randomUUID(),
          new Date().toISOString(),
        );
        setV(viewFor(demo.current, demoActor));
        pending =
          ["task.create", "task.update", "task.translate"].includes(
            action.type,
          ) &&
          demo.current.tasks.some(
            (x) =>
              x.translationStatus === "pending" &&
              (action.type === "task.create" || x.id === action.payload.id),
          );
      } else {
        const r = await fetch("/api/workspace", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "serverUnavailable");
        setV(data);
        pending = data.warnings?.includes("translationPending");
      }
      setModal(null);
      setMessage(
        pending
          ? "translationPending"
          : action.type === "entry.save"
            ? "timeSaved"
            : "saved",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  };
  const auth = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (callback?.type === "invite")
        await acceptInvite(callback.token!, String(f.get("password")));
      else if (callback?.type === "recovery")
        await updateUser({ password: String(f.get("password")) });
      else await login(String(f.get("email")), String(f.get("password")));
      setCallback(null);
      await load();
    } catch {
      setError("error");
    } finally {
      setBusy(false);
    }
  };
  const language = (
    <div className="language" aria-label={t.lang}>
      <button aria-pressed={lang === "de"} onClick={() => setLang("de")}>
        DE
      </button>
      <span>/</span>
      <button aria-pressed={lang === "es"} onClick={() => setLang("es")}>
        ES
      </button>
    </div>
  );
  const toast = (
    <>
      {error && (
        <div role="alert" className="alert error">
          {label(error)}
          <button aria-label={t.close} onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}
      {message && (
        <div role="status" className="alert success">
          <Check size={18} />
          {label(message)}
        </div>
      )}
    </>
  );
  if (loading)
    return (
      <div className="loading">
        <img src="/assets/hof-lustorf-logo.png" alt="Hof Lustorf" />
        <p>{t.loading}</p>
      </div>
    );
  if (!v || callback)
    return (
      <div className="login-page">
        <header>
          <img src="/assets/hof-lustorf-logo.png" alt="Hof Lustorf" />
          {language}
        </header>
        <main className="login-content">
          <div className="eyebrow">
            <Sprout size={18} />
            {t.team}
          </div>
          <h1>{t.loginIntro}</h1>
          <p>{t.loginText}</p>
          {toast}
          {logged && !callback ? (
            <>
              <p className="notice">{t.serverUnavailable}</p>
              <button className="button primary" onClick={load}>
                {t.retry}
                <RefreshCw size={16} />
              </button>
              <button
                className="button ghost"
                onClick={async () => {
                  await logout();
                  setLogged(false);
                  setV(null);
                }}
              >
                {t.logout}
              </button>
            </>
          ) : (
            <form onSubmit={auth}>
              {!callback && (
                <Field label={t.email}>
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    required
                  />
                </Field>
              )}
              <Field label={t.password}>
                <input
                  type="password"
                  name="password"
                  autoComplete={callback ? "new-password" : "current-password"}
                  minLength={callback ? 10 : 1}
                  required
                />
              </Field>
              <button className="button primary" disabled={busy}>
                {callback?.type === "invite"
                  ? t.acceptInvite
                  : callback?.type === "recovery"
                    ? t.resetPassword
                    : t.login}
                <ArrowRight size={18} />
              </button>
              {!callback && (
                <button
                  type="button"
                  className="text-button"
                  onClick={async (ev) => {
                    const form = ev.currentTarget.closest("form")!,
                      email = form.elements.namedItem(
                        "email",
                      ) as HTMLInputElement;
                    if (!email.reportValidity()) return;
                    setBusy(true);
                    try {
                      await requestPasswordRecovery(email.value);
                    } catch {
                    } finally {
                      setBusy(false);
                      setMessage("passwordSent");
                    }
                  }}
                >
                  {t.forgot}
                </button>
              )}
            </form>
          )}
          <small>{t.inviteOnly}</small>
        </main>
        <footer>
          Hof Lustorf <span>·</span> {t.team}
        </footer>
      </div>
    );
  const isManager = v.me.role === "manager",
    members = v.members;
  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name || t.unassigned;
  const currentTasks = v.tasks.filter(
    (x) =>
      occurs(x, selectedDate) &&
      (filter === "all" || x.assignee === v.me.id || !x.assignee),
  );
  const completed = currentTasks.filter((x) =>
    v.completions.some((c) => c.key === keyFor(x.id, selectedDate)),
  ).length;
  const week = weekStart(selectedDate),
    weekEnd = addDays(week, 6);
  const entries = v.entries.filter((e) => !e.voided),
    monthEntries = entries.filter((e) => e.date.startsWith(month));
  const ownWeek = entries
    .filter(
      (e) => e.memberId === v.me.id && e.date >= week && e.date <= weekEnd,
    )
    .reduce((n, e) => n + e.minutes, 0);
  const proposals = v.tasks.filter(
    (x) => x.status === "proposed" && !x.deletedAt,
  );
  const canEditTask = (task: Task) =>
    isManager || (task.status === "proposed" && task.createdBy === v.me.id);
  const reportPayload = (memberId: string) => {
    const r = reportFor(v, memberId, month);
    return {
      memberId,
      month,
      version: r?.version ?? 1,
      reportId: r?.id ?? r?.at,
    };
  };
  const entryLabel = (e: Entry) =>
    e.taskId
      ? entryTitle(
          e,
          v.tasks.find((x) => x.id === e.taskId),
          lang,
        ) || t.taskMissing
      : t.unplanned;
  const ownReport = reportFor(v, v.me.id, month);
  const displayedEntries =
    tab === "hours"
      ? monthEntries.filter((e) => e.memberId === v.me.id)
      : monthEntries;
  const actions = (
    <div className="top-actions">
      <button
        className="button ghost"
        onClick={() => {
          setError("");
          setModal({ kind: "newTask" });
        }}
      >
        <Plus size={16} />
        {t.newTask}
      </button>
      <button
        className="button primary"
        onClick={() => {
          setError("");
          setModal({ kind: "entry" });
        }}
      >
        <Clock3 size={16} />
        {t.logTime}
      </button>
    </div>
  );
  const dateControl = (
    <div className="date-control">
      <button
        className="icon-button"
        aria-label={lang === "de" ? "Vorheriger Tag" : "Día anterior"}
        onClick={() => setSelectedDate(addDays(selectedDate, -1))}
      >
        <ChevronLeft size={18} />
      </button>
      <label>
        <span className="sr-only">{t.date}</span>
        <input
          aria-label={t.date}
          type="date"
          required
          value={selectedDate}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
        />
      </label>
      <button
        className="icon-button"
        aria-label={lang === "de" ? "Nächster Tag" : "Día siguiente"}
        onClick={() => setSelectedDate(addDays(selectedDate, 1))}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
  const download = (forMember?: string) => {
    const rows = monthEntries.filter(
      (e) => !forMember || e.memberId === forMember,
    );
    const out = csv([
      [
        t.person,
        t.date,
        t.start,
        t.end,
        t.pause,
        t.duration,
        t.task,
        t.note,
        t.status,
      ],
      ...rows.map((e) => [
        memberName(e.memberId),
        e.date,
        time(e.start),
        time(e.end),
        e.pause,
        minutes(e.minutes),
        entryLabel(e),
        e.note,
        label(reportFor(v, e.memberId, month)?.status || "draft"),
      ]),
    ]);
    const url = URL.createObjectURL(
      new Blob([out], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `hof-lustorf-rapport-${month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const taskRow = (task: Task, date = selectedDate) => {
    const key = keyFor(task.id, date),
      done = v.completions.some((c) => c.key === key),
      actual = v.totals[key] || 0,
      over = task.budget > 0 && actual > task.budget;
    return (
      <div className={"task-row" + (done ? " completed" : "")} key={key}>
        <button
          disabled={busy || date > today()}
          className={"check-button" + (done ? " checked" : "")}
          aria-label={(done ? t.reopenTask : t.markDone) + ": " + title(task)}
          aria-pressed={done}
          onClick={() =>
            run({
              type: "task.complete",
              payload: { id: task.id, date, done: !done },
            })
          }
        >
          {done && <Check size={18} />}
        </button>
        <button
          className="task-main"
          onClick={() => {
            setError("");
            setModal({ kind: "task", task, date });
          }}
        >
          <span className="task-category">
            {label(task.category)}
            {task.repeat !== "once" && <Repeat2 size={13} />}
          </span>
          <strong>{title(task)}</strong>
          <span className="task-meta">
            {memberName(task.assignee)} <span>·</span>{" "}
            {task.twoPeople ? t.twoPeople : t.onePerson}
          </span>
        </button>
        <div className={"task-budget" + (over ? " over" : "")}>
          <strong>
            {minutes(actual)}{" "}
            <span>
              / {task.budget ? minutes(task.budget) : "—"} {t.hoursShort}
            </span>
          </strong>
          <div className="budget-track">
            <span
              style={{
                width: `${task.budget ? Math.min((actual / task.budget) * 100, 100) : 0}%`,
              }}
            />
          </div>
          <small>
            {over ? t.budgetOver : task.budget ? t.teamBudget : t.noBudget}
          </small>
        </div>
        <button
          className="icon-button task-arrow"
          aria-label={t.showDetails + ": " + title(task)}
          onClick={() => setModal({ kind: "task", task, date })}
        >
          <ArrowUpRight size={20} />
        </button>
      </div>
    );
  };
  const entriesTable = (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {isManager && <th>{t.person}</th>}
            <th>{t.date}</th>
            <th>{t.task}</th>
            <th>
              {t.from} – {t.to}
            </th>
            <th>{t.pause}</th>
            <th>{t.duration}</th>
            <th>
              <span className="sr-only">{t.edit}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedEntries
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start)
            .map((e) => (
              <tr key={e.id}>
                {isManager && <td>{memberName(e.memberId)}</td>}
                <td>
                  {e.date.slice(8)}.{e.date.slice(5, 7)}.
                </td>
                <td>
                  {entryLabel(e)}
                  {e.note && <small>{e.note}</small>}
                  {e.changedBy && e.changedBy !== e.memberId && (
                    <small>
                      {t.managerCorrection}: {memberName(e.changedBy)} ·{" "}
                      {e.changeReason}
                    </small>
                  )}
                </td>
                <td className="nowrap">
                  {time(e.start)} – {time(e.end)}
                </td>
                <td>{e.pause}</td>
                <td className="number">{minutes(e.minutes)}</td>
                <td>
                  {(e.memberId === v.me.id || isManager) &&
                    !reportFor(v, e.memberId, month) && (
                      <button
                        className="icon-button"
                        aria-label={
                          t.edit + ": " + e.date + " " + time(e.start)
                        }
                        onClick={() => {
                          setError("");
                          setModal({ kind: "entry", entry: e });
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {!displayedEntries.length && (
        <div className="empty">
          <Clock3 size={26} />
          <p>{t.noEntries}</p>
        </div>
      )}
    </div>
  );
  return (
    <div className="app">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <img src="/assets/hof-lustorf-logo.png" alt="Hof Lustorf" />
          <span>{t.team}</span>
        </div>
        <button
          className="mobile-close icon-button"
          onClick={() => setMenu(false)}
          aria-label={t.close}
        >
          <X />
        </button>
        <nav aria-label={t.team}>
          {(Object.keys(icons) as Tab[])
            .filter((x) => !["reports", "people"].includes(x) || isManager)
            .map((x) => {
              const Icon = icons[x];
              return (
                <button
                  key={x}
                  aria-current={tab === x ? "page" : undefined}
                  className={tab === x ? "nav-item active" : "nav-item"}
                  onClick={() => {
                    setTab(x);
                    setMenu(false);
                  }}
                >
                  <Icon size={19} />
                  {x === "reports" ? t.overview : t[x]}
                  {x === "tasks" && proposals.length > 0 && (
                    <span className="nav-count">{proposals.length}</span>
                  )}
                </button>
              );
            })}
        </nav>
        <div className="sidebar-bottom">
          <span className="eyebrow">HOF LUSTORF</span>
          <p>
            {lang === "de"
              ? "Gut organisiert.\nGemeinsam auf dem Hof."
              : "Bien organizados.\nJuntos en la finca."}
          </p>
          <a href="https://hoflustorf.ch" target="_blank" rel="noreferrer">
            hoflustorf.ch <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Menu"
            onClick={() => setMenu(true)}
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            Hof Lustorf <span>/</span> {tab === "reports" ? t.overview : t[tab]}
          </span>
          <div className="topbar-right">
            {language}
            <button
              className="icon-button"
              aria-label={t.refresh}
              onClick={load}
            >
              <RefreshCw size={17} />
            </button>
            <span className="user-name">{v.me.name}</span>
            {!DEMO && (
              <button
                className="icon-button"
                aria-label={t.logout}
                onClick={async () => {
                  await logout();
                  setV(null);
                  setLogged(false);
                }}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>
        {DEMO && (
          <div className="demo-banner">
            <div>
              <strong>{t.demo}</strong>
              <span>{t.demoDetail}</span>
            </div>
            <label>
              {t.demoRole}
              <select
                disabled={busy}
                value={demoActor}
                onChange={(e) => {
                  setModal(null);
                  setTab("today");
                  setDemoActor(e.target.value);
                }}
              >
                {v.members
                  .filter((m) => !m.deletedAt)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        )}
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <Sprout size={15} />
                {tab === "today"
                  ? niceDate(selectedDate)
                  : "HOF LUSTORF · TEAM"}
              </div>
              <h1>
                {tab === "today"
                  ? t.welcome
                  : tab === "reports"
                    ? t.overview
                    : t[tab]}
              </h1>
              <p>
                {tab === "today"
                  ? t.subtitle
                  : tab === "hours"
                    ? t.monthHint
                    : tab === "week"
                      ? t.weekHint
                      : tab === "tasks"
                        ? t.budgetNote
                        : tab === "people"
                          ? t.peopleHint
                          : t.monthHint}
              </p>
            </div>
            {actions}
          </div>
          {!modal && toast}
          {(tab === "today" || tab === "week") && (
            <div className="facts">
              <div>
                <span>{t.taskCount}</span>
                <strong>
                  {currentTasks.length.toString().padStart(2, "0")}
                  <small>{t.planned}</small>
                </strong>
              </div>
              <div>
                <span>{t.completion}</span>
                <strong>
                  {completed.toString().padStart(2, "0")}
                  <small>/ {currentTasks.length}</small>
                </strong>
              </div>
              <div>
                <span>{isManager ? t.todayBudget : t.weekTarget}</span>
                <strong>
                  {isManager
                    ? minutes(currentTasks.reduce((n, x) => n + x.budget, 0))
                    : minutes(ownWeek)}
                  <small>
                    {isManager
                      ? t.hoursShort
                      : `/ ${minutes(v.me.weeklyMinutes)} ${t.hoursShort}`}
                  </small>
                </strong>
              </div>
            </div>
          )}
          {tab === "today" && (
            <>
              <section className="section">
                <div className="section-head">
                  <h2>{t.today}</h2>
                  <div className="section-tools">
                    <div className="segmented">
                      <button
                        className={filter === "all" ? "active" : ""}
                        onClick={() => setFilter("all")}
                      >
                        {t.all}
                      </button>
                      <button
                        className={filter === "own" ? "active" : ""}
                        onClick={() => setFilter("own")}
                      >
                        {t.own}
                      </button>
                    </div>
                    {dateControl}
                  </div>
                </div>
                <div className="task-list">
                  {currentTasks.map((x) => taskRow(x))}
                  {!currentTasks.length && (
                    <div className="empty">
                      <Sun size={30} />
                      <p>{t.noTasks}</p>
                    </div>
                  )}
                </div>
              </section>
              <div className="bottom-note">
                <Users size={21} />
                <p>
                  <strong>{t.teamBudget}.</strong> {t.budgetNote}
                </p>
              </div>
            </>
          )}
          {tab === "week" && (
            <section className="section">
              <div className="section-head">
                <h2>
                  {t.weekOf} {niceDate(week, true)}
                </h2>
                {dateControl}
              </div>
              <div className="week-grid">
                {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map(
                  (day) => (
                    <div
                      className={
                        "week-day" + (day === today() ? " current" : "")
                      }
                      key={day}
                    >
                      <button
                        className="day-heading"
                        onClick={() => {
                          setSelectedDate(day);
                          setTab("today");
                        }}
                      >
                        {niceDate(day, true)}
                        <ArrowUpRight size={15} />
                      </button>
                      {v.tasks
                        .filter((x) => occurs(x, day))
                        .map((task) => (
                          <button
                            className="week-task"
                            key={task.id}
                            onClick={() =>
                              setModal({ kind: "task", task, date: day })
                            }
                          >
                            <span className={"dot " + task.category} />
                            <strong>{title(task)}</strong>
                            <small>{memberName(task.assignee)}</small>
                            <span>
                              {task.budget
                                ? minutes(task.budget) + " " + t.hoursShort
                                : "—"}
                              {v.completions.some(
                                (c) => c.key === keyFor(task.id, day),
                              ) && <Check size={14} />}
                            </span>
                          </button>
                        ))}
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
          {tab === "tasks" && (
            <>
              <label className="deleted-toggle">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                />
                {t.showDeleted}
              </label>
              {proposals.length > 0 && (
                <section className="section">
                  <div className="section-head">
                    <h2>
                      {t.proposals}{" "}
                      <span className="badge">{proposals.length}</span>
                    </h2>
                  </div>
                  <div className="proposal-list">
                    {proposals.map((x) => (
                      <div className="proposal" key={x.id}>
                        <div>
                          <strong>{title(x)}</strong>
                          <p>{taskNotes(x, lang)}</p>
                          <small>
                            {memberName(x.createdBy)} · {label(x.repeat)} ·{" "}
                            {minutes(x.budget)} {t.hoursShort}
                          </small>
                        </div>
                        {canEditTask(x) && (
                          <div className="row-actions">
                            <button
                              className="text-button"
                              onClick={() =>
                                setModal({ kind: "newTask", task: x })
                              }
                            >
                              {t.edit}
                            </button>
                            <button
                              className="text-button danger"
                              onClick={() =>
                                setModal({
                                  kind: "reason",
                                  action: "task.delete",
                                  payload: {
                                    id: x.id,
                                    version: x.version ?? 1,
                                  },
                                })
                              }
                            >
                              {t.delete}
                            </button>
                          </div>
                        )}
                        {isManager && (
                          <button
                            className="button ghost"
                            disabled={busy}
                            onClick={() =>
                              run({
                                type: "task.approve",
                                payload: { id: x.id, version: x.version ?? 1 },
                              })
                            }
                          >
                            {t.approveTask}
                            <Check size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section className="section">
                <div className="section-head">
                  <h2>{t.activeTasks}</h2>
                </div>
                <div className="template-list">
                  {v.tasks
                    .filter(
                      (x) =>
                        (x.status === "active" && !x.deletedAt) ||
                        (showDeleted && x.deletedAt),
                    )
                    .map((x) => (
                      <div className="template-row" key={x.id}>
                        <span className={"dot " + x.category} />
                        <div>
                          <button
                            className="text-button strong"
                            onClick={() =>
                              setModal({
                                kind: "task",
                                task: x,
                                date: selectedDate,
                              })
                            }
                          >
                            {title(x)}
                          </button>
                          <small>
                            {label(x.category)} · {memberName(x.assignee)}
                            {x.translationStatus === "pending" &&
                              " · " + t.translationPendingBadge}
                          </small>
                        </div>
                        <span className="badge">
                          {x.deletedAt
                            ? t.deleted
                            : x.endDate && x.endDate <= today()
                              ? t.paused
                              : label(x.repeat)}
                        </span>
                        <span className="number">
                          {minutes(x.budget)} {t.hoursShort}
                        </span>
                        {isManager &&
                          !x.deletedAt &&
                          !x.endDate &&
                          x.repeat !== "once" && (
                            <button
                              className="text-button muted"
                              onClick={() =>
                                setModal({ kind: "pause", task: x })
                              }
                            >
                              {t.pauseTask}
                            </button>
                          )}
                        {!x.deletedAt && canEditTask(x) && (
                          <div className="row-actions">
                            <button
                              className="text-button"
                              onClick={() =>
                                setModal({ kind: "newTask", task: x })
                              }
                            >
                              {t.edit}
                            </button>
                            <button
                              className="text-button danger"
                              onClick={() =>
                                setModal({
                                  kind: "reason",
                                  action: "task.delete",
                                  payload: {
                                    id: x.id,
                                    version: x.version ?? 1,
                                  },
                                })
                              }
                            >
                              {t.delete}
                            </button>
                          </div>
                        )}
                        {x.deletedAt && isManager && (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              run({
                                type: "task.restore",
                                payload: { id: x.id, version: x.version ?? 1 },
                              })
                            }
                          >
                            {t.restore}
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            </>
          )}
          {(tab === "hours" || tab === "reports") && (
            <>
              <section className="section">
                <div className="section-head">
                  <h2>{tab === "hours" ? t.hours : t.reports}</h2>
                  <div className="section-tools">
                    <label className="inline-field">
                      {t.month}
                      <input
                        type="month"
                        max={today().slice(0, 7)}
                        value={month}
                        onChange={(e) =>
                          e.target.value && setMonth(e.target.value)
                        }
                      />
                    </label>
                    <button
                      className="button ghost"
                      disabled={!monthEntries.length}
                      onClick={() =>
                        download(tab === "hours" ? v.me.id : undefined)
                      }
                    >
                      <Download size={16} />
                      {t.export}
                    </button>
                  </div>
                </div>
                {tab === "hours" && (
                  <div className="report-summary">
                    <div>
                      <span>{t.monthTotal}</span>
                      <strong>
                        {minutes(
                          monthEntries
                            .filter((e) => e.memberId === v.me.id)
                            .reduce((n, e) => n + e.minutes, 0),
                        )}{" "}
                        <small>{t.hoursShort}</small>
                      </strong>
                    </div>
                    <span className={"badge " + (ownReport?.status || "draft")}>
                      {label(ownReport?.status || "draft")}
                    </span>
                    {!ownReport && (
                      <button
                        className="button primary"
                        disabled={
                          busy ||
                          !monthEntries.some((e) => e.memberId === v.me.id)
                        }
                        onClick={() =>
                          run({ type: "report.submit", payload: { month } })
                        }
                      >
                        {t.submit}
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                )}
                {tab === "reports" && (
                  <div className="report-members">
                    {members
                      .filter(
                        (m) =>
                          m.role === "staff" ||
                          monthEntries.some((e) => e.memberId === m.id),
                      )
                      .map((m) => {
                        const r = reportFor(v, m.id, month),
                          total = monthEntries
                            .filter((e) => e.memberId === m.id)
                            .reduce((n, e) => n + e.minutes, 0);
                        return (
                          <div className="report-member" key={m.id}>
                            <div>
                              <strong>{m.name}</strong>
                              <small>
                                {t.weekTarget}: {minutes(m.weeklyMinutes)}{" "}
                                {t.hoursShort}
                              </small>
                            </div>
                            <strong className="number">
                              {minutes(total)} {t.hoursShort}
                            </strong>
                            <span className={"badge " + (r?.status || "draft")}>
                              {label(r?.status || "draft")}
                            </span>
                            <div className="row-actions">
                              {r?.status === "submitted" &&
                                m.id !== v.me.id && (
                                  <button
                                    className="button primary compact"
                                    disabled={busy}
                                    onClick={() =>
                                      run({
                                        type: "report.approve",
                                        payload: reportPayload(m.id),
                                      })
                                    }
                                  >
                                    {t.approve}
                                  </button>
                                )}
                              {r && (
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    setModal({
                                      kind: "reason",
                                      action: "report.reopen",
                                      payload: reportPayload(m.id),
                                    })
                                  }
                                >
                                  {t.reopenReport}
                                </button>
                              )}
                              {r && (
                                <button
                                  className="text-button danger"
                                  onClick={() =>
                                    setModal({
                                      kind: "reason",
                                      action: "report.delete",
                                      payload: reportPayload(m.id),
                                    })
                                  }
                                >
                                  {t.deleteReport}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
                {entriesTable}
              </section>
              <p className="muted small">{t.weekHint}</p>
            </>
          )}
          {tab === "people" && isManager && (
            <section className="section">
              <label className="deleted-toggle">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                />
                {t.showDeleted}
              </label>
              <div className="report-members">
                {members
                  .filter((m) => showDeleted || !m.deletedAt)
                  .map((m) => (
                    <div className="report-member" key={m.id}>
                      <div>
                        <strong>{m.name}</strong>
                        <small>
                          {label(m.role)} · {minutes(m.weeklyMinutes)}{" "}
                          {t.hoursShort}
                          {m.deletedAt && " · " + t.deleted}
                        </small>
                      </div>
                      <div className="row-actions">
                        {!m.deletedAt ? (
                          <>
                            <button
                              className="button ghost compact"
                              onClick={() =>
                                setModal({ kind: "member", member: m })
                              }
                            >
                              {t.edit}
                            </button>
                            {m.id !== v.me.id && (
                              <button
                                className="text-button danger"
                                onClick={() =>
                                  setModal({
                                    kind: "reason",
                                    action: "member.delete",
                                    payload: {
                                      id: m.id,
                                      version: m.version ?? 1,
                                    },
                                  })
                                }
                              >
                                {t.delete}
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            className="button ghost compact"
                            disabled={busy}
                            onClick={() =>
                              run({
                                type: "member.restore",
                                payload: { id: m.id, version: m.version ?? 1 },
                              })
                            }
                          >
                            {t.restore}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </main>
        <footer className="app-footer">
          <span>Hof Lustorf · {t.team}</span>
          <span>{t.budgetNote}</span>
        </footer>
      </div>
      {modal && (
        <Dialog
          title={
            modal.kind === "newTask"
              ? modal.task
                ? t.editTask
                : t.newTask
              : modal.kind === "member"
                ? t.editMember
                : modal.kind === "entry"
                  ? t.logTime
                  : modal.kind === "task"
                    ? t.taskDetail
                    : modal.kind === "pause"
                      ? t.pauseTask
                      : t.reason
          }
          onClose={() => {
            if (!busy) {
              setModal(null);
              setError("");
            }
          }}
        >
          {toast}
          {modal.kind === "entry" && (
            <>
              <EntryForm
                v={v}
                lang={lang}
                modal={modal}
                busy={busy}
                submit={run}
                onClose={() => setModal(null)}
              />
              {modal.entry && (
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() =>
                    setModal({
                      kind: "reason",
                      action: "entry.void",
                      payload: {
                        id: modal.entry!.id,
                        version: modal.entry!.version,
                      },
                    })
                  }
                >
                  {t.voidEntry}
                </button>
              )}
            </>
          )}
          {modal.kind === "newTask" && (
            <>
              <TaskForm
                view={v}
                lang={lang}
                task={modal.task}
                date={selectedDate}
                busy={busy}
                submit={run}
                onClose={() => setModal(null)}
              />
              {DEMO && <p className="muted small">{t.demoTranslationHint}</p>}
            </>
          )}
          {modal.kind === "member" && (
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                const f = new FormData(ev.currentTarget);
                run({
                  type: "member.update",
                  payload: {
                    id: modal.member.id,
                    version: modal.member.version ?? 1,
                    name: String(f.get("name") || ""),
                    weeklyMinutes: Math.round(
                      Number(f.get("weeklyHours")) * 60,
                    ),
                  },
                });
              }}
            >
              <div className="form-grid">
                <Field label={t.memberName}>
                  <input
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={modal.member.name}
                  />
                </Field>
                <Field label={t.weeklyHours}>
                  <input
                    type="number"
                    name="weeklyHours"
                    required
                    min="0"
                    max="168"
                    step="0.25"
                    defaultValue={modal.member.weeklyMinutes / 60}
                  />
                </Field>
              </div>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button ghost"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  {t.cancel}
                </button>
                <button className="button primary" disabled={busy}>
                  {t.save}
                </button>
              </div>
            </form>
          )}
          {modal.kind === "task" && (
            <div className="task-detail">
              <span className="eyebrow">
                {label(modal.task.category)} · {niceDate(modal.date, true)}
              </span>
              <h3>{title(modal.task)}</h3>
              <p className="preserve">{taskNotes(modal.task, lang)}</p>
              {modal.task.translationStatus !== "ready" &&
                canEditTask(modal.task) &&
                !modal.task.deletedAt && (
                  <p className="notice">
                    {t.translationPendingBadge} ·{" "}
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() =>
                        run({
                          type: "task.translate",
                          payload: {
                            id: modal.task.id,
                            version: modal.task.version ?? 1,
                          },
                        })
                      }
                    >
                      {t.translateAgain}
                    </button>
                  </p>
                )}
              <dl>
                <div>
                  <dt>{t.assignee}</dt>
                  <dd>{memberName(modal.task.assignee)}</dd>
                </div>
                <div>
                  <dt>{t.repeat}</dt>
                  <dd>{label(modal.task.repeat)}</dd>
                </div>
                <div>
                  <dt>{t.teamBudget}</dt>
                  <dd>
                    {minutes(v.totals[keyFor(modal.task.id, modal.date)] || 0)}{" "}
                    / {minutes(modal.task.budget)} {t.hoursShort}
                  </dd>
                </div>
                <div>
                  <dt>{t.people}</dt>
                  <dd>{modal.task.twoPeople ? t.twoPeople : t.onePerson}</dd>
                </div>
              </dl>
              <p className="notice">{t.budgetNote}</p>
              <div className="dialog-actions">
                <button className="button ghost" onClick={() => setModal(null)}>
                  {t.close}
                </button>
                <button
                  className="button primary"
                  disabled={
                    modal.date > today() || !occurs(modal.task, modal.date)
                  }
                  onClick={() =>
                    setModal({
                      kind: "entry",
                      task: modal.task,
                      date: modal.date,
                    })
                  }
                >
                  {t.logTime}
                  <ArrowRight size={16} />
                </button>
              </div>
              {canEditTask(modal.task) && !modal.task.deletedAt && (
                <div className="dialog-actions">
                  <button
                    className="button ghost"
                    onClick={() =>
                      setModal({ kind: "newTask", task: modal.task })
                    }
                  >
                    {t.editTask}
                  </button>
                  <button
                    className="text-button danger"
                    onClick={() =>
                      setModal({
                        kind: "reason",
                        action: "task.delete",
                        payload: {
                          id: modal.task.id,
                          version: modal.task.version ?? 1,
                        },
                      })
                    }
                  >
                    {t.delete}
                  </button>
                </div>
              )}
            </div>
          )}
          {modal.kind === "reason" && (
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                const f = new FormData(ev.currentTarget);
                run({
                  type: modal.action,
                  payload: {
                    ...modal.payload,
                    [modal.action.startsWith("report.") ? "note" : "reason"]:
                      String(f.get("reason")),
                  },
                });
              }}
            >
              {modal.action !== "report.reopen" && (
                <p className="notice">
                  {modal.action === "task.delete"
                    ? t.deleteTaskHint
                    : modal.action === "member.delete"
                      ? t.deleteMemberHint
                      : modal.action === "report.delete"
                        ? t.deleteReportHint
                        : t.deleteEntryHint}
                </p>
              )}
              <Field label={t.reason}>
                <textarea name="reason" required maxLength={500} rows={4} />
              </Field>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setModal(null)}
                >
                  {t.cancel}
                </button>
                <button className="button primary" disabled={busy}>
                  {t.confirm}
                </button>
              </div>
            </form>
          )}
          {modal.kind === "pause" && (
            <>
              <p>{t.stopConfirm}</p>
              <strong>{title(modal.task)}</strong>
              <div className="dialog-actions">
                <button className="button ghost" onClick={() => setModal(null)}>
                  {t.cancel}
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    run({
                      type: "task.pause",
                      payload: {
                        id: modal.task.id,
                        version: modal.task.version ?? 1,
                      },
                    })
                  }
                >
                  {t.confirm}
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
