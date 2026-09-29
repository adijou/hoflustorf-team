import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  emptyState,
  viewFor,
  occurs,
  duration,
  csv,
  weekStart,
  migrateSharedTasks,
  type State,
  type Action,
} from "../shared/domain.ts";
const now = "2026-09-16T10:00:00Z";
function state(): State {
  const s = emptyState();
  s.members = [
    { id: "boss", name: "Manager", role: "manager", weeklyMinutes: 0 },
    { id: "a", name: "A", role: "staff", weeklyMinutes: 2100 },
    { id: "b", name: "B", role: "staff", weeklyMinutes: 2100 },
  ];
  s.tasks = [
    {
      id: "stall",
      titleDe: "Stall",
      titleEs: "Establo",
      notes: "",
      category: "horses",
      budget: 60,
      assignee: "",
      startDate: "2026-09-01",
      repeat: "daily",
      twoPeople: false,
      status: "active",
      createdBy: "boss",
    },
  ];
  return s;
}
function entry(
  s: State,
  actor = "a",
  id = "e1",
  overrides: Record<string, unknown> = {},
) {
  return applyAction(
    s,
    actor,
    {
      type: "entry.save",
      payload: {
        id: "",
        version: 0,
        date: "2026-09-16",
        start: 420,
        end: 510,
        pause: 0,
        taskId: "stall",
        note: "",
        ...overrides,
      },
    },
    id,
    now,
  );
}
let counter = 0;
function command(
  s: State,
  actor: string,
  type: string,
  payload: Action["payload"],
) {
  const target = type.startsWith("task.")
    ? s.tasks.find((t) => t.id === payload.id)
    : type.startsWith("member.")
      ? s.members.find((m) => m.id === payload.id)
      : type.startsWith("report.")
        ? s.reports.find(
            (r) => r.memberId === payload.memberId && r.month === payload.month,
          )
        : undefined;
  const report = type.startsWith("report.")
    ? s.reports.find(
        (r) => r.memberId === payload.memberId && r.month === payload.month,
      )
    : undefined;
  return applyAction(
    s,
    actor,
    {
      type,
      payload: {
        version: target?.version ?? 1,
        reportId: report?.id ?? report?.at,
        ...payload,
      },
    },
    `new-${++counter}`,
    now,
  );
}
test("shared task budget sums both people and never caps actual time", () => {
  let s = entry(state());
  s = entry(s, "b", "e2");
  assert.equal(viewFor(s, "a").totals["stall:2026-09-16"], 180);
  assert.equal(s.entries[0].minutes, 90);
  assert.equal(viewFor(s, "a").entries.length, 1);
  assert.equal(viewFor(s, "boss").entries.length, 2);
  assert.equal(viewFor(s, "a").me.weeklyMinutes, 2100);
});
test("overlapping entries are rejected for the same person, including updates", () => {
  const s = entry(state());
  assert.throws(() => entry(s, "a", "e2", { start: 480, end: 540 }), /overlap/);
  assert.doesNotThrow(() => entry(s, "a", "e2", { start: 510, end: 540 }));
  assert.doesNotThrow(() => entry(s, "b", "e2", { start: 480, end: 540 }));
});
test("staff cannot overwrite another employee and manager needs a reason", () => {
  const s = entry(state());
  assert.throws(
    () => entry(s, "b", "unused", { id: "e1", version: 1 }),
    /forbidden/,
  );
  assert.throws(
    () => entry(s, "boss", "unused", { id: "e1", version: 1, reason: "" }),
    /noteRequired/,
  );
});
test("stale entry updates cannot silently overwrite corrections", () => {
  const s = entry(state());
  assert.throws(
    () => entry(s, "a", "unused", { id: "e1", version: 0 }),
    /conflict/,
  );
  const changed = entry(s, "a", "unused", { id: "e1", version: 1, end: 520 });
  assert.equal(changed.entries[0].version, 2);
  assert.equal(changed.entries[0].minutes, 100);
  assert.equal(s.entries[0].minutes, 90);
});
test("submitted report locks additions, corrections, voids and moves out of month", () => {
  let s = entry(state());
  s = command(s, "a", "report.submit", { month: "2026-09" });
  assert.throws(
    () => entry(s, "a", "e2", { start: 600, end: 630 }),
    /reportLocked/,
  );
  assert.throws(
    () => entry(s, "a", "e1", { id: "e1", version: 1, date: "2026-08-16" }),
    /reportLocked/,
  );
  assert.throws(
    () =>
      command(s, "a", "entry.void", {
        id: "e1",
        version: 1,
        reason: "mistake",
      }),
    /reportLocked/,
  );
});
test("approval and reopening require manager permission and preserve actual hours", () => {
  let s = entry(state());
  s = command(s, "a", "report.submit", { month: "2026-09" });
  assert.throws(
    () =>
      command(s, "b", "report.approve", { memberId: "a", month: "2026-09" }),
    /forbidden/,
  );
  s = command(s, "boss", "report.approve", { memberId: "a", month: "2026-09" });
  assert.equal(s.reports[0].status, "approved");
  assert.throws(
    () =>
      command(s, "boss", "report.reopen", {
        memberId: "a",
        month: "2026-09",
        note: "",
      }),
    /noteRequired/,
  );
  s = command(s, "boss", "report.reopen", {
    memberId: "a",
    month: "2026-09",
    note: "Please correct pause",
  });
  assert.equal(s.entries[0].minutes, 90);
  assert.equal(s.reports.length, 0);
  assert.doesNotThrow(() =>
    entry(s, "a", "e1", { id: "e1", version: 1, pause: 10 }),
  );
});
test("a manager cannot approve their own report", () => {
  let s = entry(state(), "boss");
  s = command(s, "boss", "report.submit", { month: "2026-09" });
  assert.throws(
    () =>
      command(s, "boss", "report.approve", {
        memberId: "boss",
        month: "2026-09",
      }),
    /selfApproval/,
  );
});
test("staff create shared work immediately, legacy assignment and approval fields cannot restrict it", () => {
  let s = command(state(), "a", "task.create", {
    titleDe: "Zaun",
    titleEs: "Cerca",
    notes: "",
    category: "pasture",
    assignee: "b",
    budget: 120,
    startDate: "2026-09-16",
    repeat: "weekly",
    twoPeople: true,
    status: "proposed",
    createdBy: "boss",
  });
  const t = s.tasks.at(-1)!;
  assert.equal(t.status, "active");
  assert.equal(t.assignee, "");
  assert.equal(t.createdBy, "a");
  assert.equal(occurs(t, "2026-09-16"), true);
  s = entry(s, "a", "creator-time", { taskId: t.id });
  s = entry(s, "b", "colleague-time", { taskId: t.id });
  s = entry(s, "boss", "manager-time", { taskId: t.id });
  assert.equal(viewFor(s, "boss").totals[`${t.id}:2026-09-16`], 270);
  assert.equal(viewFor(s, "a").entries.length, 1);
  assert.equal(viewFor(s, "b").entries.length, 1);
  assert.equal(occurs(s.tasks.at(-1)!, "2026-09-23"), true);
});
test("recurrence respects anchor date, weekly cadence, month end and stop date", () => {
  const t = state().tasks[0];
  assert.equal(occurs(t, "2026-08-31"), false);
  assert.equal(occurs({ ...t, repeat: "weekly" }, "2026-09-08"), true);
  assert.equal(occurs({ ...t, repeat: "weekly" }, "2026-09-09"), false);
  assert.equal(
    occurs({ ...t, repeat: "monthly", startDate: "2026-01-31" }, "2026-02-28"),
    true,
  );
  assert.equal(occurs({ ...t, endDate: "2026-09-16" }, "2026-09-17"), false);
  assert.equal(weekStart("2027-01-01"), "2026-12-28");
});
test("unplanned necessary work can be recorded with a note, without a task budget", () => {
  assert.throws(
    () => entry(state(), "a", "e", { taskId: "", note: "" }),
    /noteRequired/,
  );
  assert.equal(
    entry(state(), "a", "e", { taskId: "", note: "Emergency horse care" })
      .entries[0].minutes,
    90,
  );
});
test("future and impossible dates, invalid durations and excessive pauses are rejected", () => {
  for (const date of ["2026-02-31", "2026-13-01", "2026-09-17", "no"])
    assert.throws(() => entry(state(), "a", "e", { date }), /invalidDate/);
  assert.throws(() => duration(600, 590, 0), /invalidTime/);
  assert.throws(() => duration(600, 660, 60), /invalidTime/);
  assert.equal(duration(1380, 1440, 0), 60);
});
test("voiding retains original entry and excludes it from budget totals", () => {
  let s = entry(state());
  s = command(s, "a", "entry.void", {
    id: "e1",
    version: 1,
    reason: "duplicate",
  });
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].voided, true);
  assert.deepEqual(viewFor(s, "a").totals, {});
});
test("CSV neutralizes spreadsheet formulas and preserves quotes and newlines", () => {
  const data = csv([["=1+1", " @SUM(A1)", 'quote"line\nnext']]);
  assert.ok(data.includes("'=1+1"));
  assert.ok(data.includes("' @SUM(A1)"));
  assert.ok(data.includes('quote""line\nnext'));
});
test("reports and private entries stay personal in staff responses", () => {
  let s = entry(state(), "b");
  s = command(s, "b", "report.submit", { month: "2026-09" });
  assert.deepEqual(viewFor(s, "a").entries, []);
  assert.deepEqual(viewFor(s, "a").reports, []);
  assert.throws(() => viewFor(s, "stranger"), /forbidden/);
});

function taskEdit(
  s: State,
  actor = "boss",
  extra: Record<string, unknown> = {},
) {
  const t = s.tasks[0];
  return command(s, actor, "task.update", {
    id: t.id,
    title: "Stall reinigen",
    inputLang: "de",
    notes: "Wasser wechseln",
    category: "horses",
    assignee: "b",
    budget: 100,
    startDate: "2026-09-01",
    endDate: "",
    repeat: "weekly",
    twoPeople: true,
    ...extra,
  });
}
test("single title input sets source language and translation pending, including Spanish input", () => {
  let s = taskEdit(state());
  const t = s.tasks[0];
  assert.equal(t.titleDe, "Stall reinigen");
  assert.equal(t.titleEs, "");
  assert.equal(t.notesDe, "Wasser wechseln");
  assert.equal(t.translationStatus, "pending");
  assert.equal(t.version, 2);
  s = taskEdit(s, "boss", {
    title: "Limpiar el establo",
    inputLang: "es",
    notes: "Cambiar el agua",
  });
  assert.equal(s.tasks[0].titleDe, "");
  assert.equal(s.tasks[0].titleEs, "Limpiar el establo");
  assert.equal(s.tasks[0].notesEs, "Cambiar el agua");
});
test("editing a task preserves recorded hours and historical titles", () => {
  const original = entry(state());
  const s = taskEdit(original);
  assert.equal(s.entries[0].minutes, 90);
  assert.equal(s.entries[0].taskTitleDe, "Stall");
  assert.equal(s.tasks[0].assignee, "");
  assert.equal(s.tasks[0].budget, 100);
  assert.equal(s.tasks[0].repeat, "weekly");
  assert.equal(s.tasks[0].twoPeople, true);
  assert.equal(original.tasks[0].titleDe, "Stall");
  assert.doesNotThrow(() =>
    entry(s, "a", "ignored", { id: "e1", version: 1, pause: 5 }),
  );
});
test("metadata-only edits retain existing translations, changed source invalidates both translated fields", () => {
  let s = taskEdit(state());
  Object.assign(s.tasks[0], {
    titleEs: "Limpiar el establo",
    notesEs: "Cambiar el agua",
    translationStatus: "ready",
  });
  s = taskEdit(s, "boss", { budget: 70 });
  assert.equal(s.tasks[0].titleEs, "Limpiar el establo");
  assert.equal(s.tasks[0].translationStatus, "ready");
  s = taskEdit(s, "boss", { notes: "Neu" });
  assert.equal(s.tasks[0].titleEs, "");
  assert.equal(s.tasks[0].notesEs, "");
  assert.equal(s.tasks[0].translationStatus, "pending");
});
test("staff edit and delete their own active tasks; managers can manage all tasks", () => {
  assert.throws(() => taskEdit(state(), "a"), /forbidden/);
  let s = state();
  s.tasks[0].createdBy = "a";
  s = taskEdit(s, "a");
  assert.equal(s.tasks[0].status, "active");
  assert.throws(() => taskEdit(s, "b"), /forbidden/);
  assert.throws(
    () => command(s, "b", "task.delete", { id: "stall", reason: "No" }),
    /forbidden/,
  );
  s = command(s, "a", "task.delete", { id: "stall", reason: "Duplicate" });
  assert.ok(s.tasks[0].deletedAt);
});
test("delete and restore tasks without removing or orphaning time entries", () => {
  let s = entry(state());
  s = command(s, "boss", "task.delete", { id: "stall", reason: "Replaced" });
  assert.equal(occurs(s.tasks[0], "2026-09-16"), false);
  assert.equal(s.entries.length, 1);
  assert.equal(s.entries[0].taskTitleEs, "Establo");
  assert.throws(() => entry(s, "b", "other"), /invalidTask/);
  assert.doesNotThrow(() =>
    entry(s, "a", "e1", { id: "e1", version: 1, pause: 5 }),
  );
  assert.throws(() => taskEdit(s), /notFound/);
  s = command(s, "boss", "task.restore", { id: "stall" });
  assert.equal(occurs(s.tasks[0], "2026-09-16"), true);
});
test("task mutations reject stale forms, missing deletion reasons and invalid recurrence boundaries", () => {
  const s = taskEdit(state());
  assert.throws(() => taskEdit(s, "boss", { version: 1 }), /conflict/);
  assert.throws(
    () =>
      command(s, "boss", "task.delete", {
        id: "stall",
        version: 1,
        reason: "Old",
      }),
    /conflict/,
  );
  assert.throws(
    () => command(s, "boss", "task.delete", { id: "stall", reason: "" }),
    /noteRequired/,
  );
  assert.throws(
    () => taskEdit(s, "boss", { endDate: "2026-08-01" }),
    /invalidDate/,
  );
});
test("manager corrections keep the owner, require a reason and check that owner overlaps", () => {
  let s = entry(state());
  s = entry(s, "a", "e2", { start: 550, end: 600 });
  assert.throws(
    () =>
      entry(s, "boss", "unused", {
        id: "e1",
        version: 1,
        end: 570,
        reason: "Correct end",
      }),
    /overlap/,
  );
  s = entry(s, "boss", "unused", {
    id: "e1",
    version: 1,
    end: 520,
    reason: "Correct end",
    memberId: "boss",
  });
  assert.equal(s.entries[0].memberId, "a");
  assert.equal(s.entries[0].changedBy, "boss");
  assert.equal(s.entries[0].changeReason, "Correct end");
  assert.equal(s.entries[0].minutes, 100);
});
test("manager cannot change or delete times in a locked employee month", () => {
  let s = entry(state());
  s = command(s, "a", "report.submit", { month: "2026-09" });
  assert.throws(
    () =>
      entry(s, "boss", "unused", {
        id: "e1",
        version: 1,
        reason: "Correction",
      }),
    /reportLocked/,
  );
  assert.throws(
    () =>
      command(s, "boss", "entry.void", {
        id: "e1",
        version: 1,
        reason: "Correction",
      }),
    /reportLocked/,
  );
  s = command(s, "boss", "report.reopen", {
    memberId: "a",
    month: "2026-09",
    note: "Correction",
  });
  s = command(s, "boss", "entry.void", {
    id: "e1",
    version: 1,
    reason: "Duplicate",
  });
  assert.equal(s.entries[0].voided, true);
  assert.equal(s.entries[0].changedBy, "boss");
  assert.equal(s.entries[0].minutes, 90);
});
test("team profile changes and deletion are manager-only and cannot escalate roles", () => {
  assert.throws(
    () =>
      command(state(), "a", "member.update", {
        id: "b",
        name: "X",
        weeklyMinutes: 1200,
      }),
    /forbidden/,
  );
  let s = command(state(), "boss", "member.update", {
    id: "a",
    name: "Changed",
    weeklyMinutes: 1800,
    role: "manager",
  });
  assert.equal(s.members[1].name, "Changed");
  assert.equal(s.members[1].weeklyMinutes, 1800);
  assert.equal(s.members[1].role, "staff");
  assert.throws(
    () =>
      command(s, "boss", "member.update", {
        id: "a",
        version: 1,
        name: "Stale",
        weeklyMinutes: 0,
      }),
    /conflict/,
  );
  assert.throws(
    () => command(s, "boss", "member.delete", { id: "boss", reason: "Oops" }),
    /selfDelete/,
  );
});
test("deleted profiles lose app access, preserve times and can be restored", () => {
  let s = entry(state());
  s = command(s, "boss", "member.delete", { id: "a", reason: "Left" });
  assert.throws(() => viewFor(s, "a"), /forbidden/);
  assert.throws(() => entry(s, "a", "e2"), /forbidden/);
  assert.equal(s.entries[0].memberId, "a");
  assert.equal(s.tasks[0].assignee, "");
  assert.equal(taskEdit(s, "boss", { assignee: "a" }).tasks[0].assignee, "");
  s = command(s, "boss", "member.restore", { id: "a" });
  assert.equal(viewFor(s, "a").entries.length, 1);
});
test("deleting a monthly report retains times and rejects stale approvals after resubmission", () => {
  let s = entry(state());
  s = command(s, "a", "report.submit", { month: "2026-09" });
  const old = s.reports[0];
  assert.throws(
    () =>
      command(s, "a", "report.delete", {
        memberId: "a",
        month: "2026-09",
        note: "No",
      }),
    /forbidden/,
  );
  s = command(s, "boss", "report.delete", {
    memberId: "a",
    month: "2026-09",
    note: "Wrong submission",
  });
  assert.equal(s.entries[0].minutes, 90);
  assert.equal(s.reports.length, 0);
  s = command(s, "a", "report.submit", { month: "2026-09" });
  assert.throws(
    () =>
      command(s, "boss", "report.approve", {
        memberId: "a",
        month: "2026-09",
        version: old.version,
        reportId: old.id,
      }),
    /conflict/,
  );
});

test("every role can create work without an assignee or approval fields", () => {
  for (const actor of ["boss", "a", "b"]) {
    const s = command(state(), actor, "task.create", {
      title: "Gemeinsame Arbeit",
      inputLang: "de",
      notes: "",
      category: "other",
      budget: 45,
      startDate: "2026-09-16",
      repeat: "daily",
      twoPeople: false,
    });
    const task = s.tasks.at(-1)!;
    assert.equal(task.assignee, "");
    assert.equal(task.status, "active");
    assert.equal(task.createdBy, actor);
    for (const member of ["boss", "a", "b"]) {
      assert.ok(viewFor(s, member).tasks.some((t) => t.id === task.id));
      assert.doesNotThrow(() =>
        entry(s, member, `time-${member}`, { taskId: task.id }),
      );
    }
  }
});

test("existing proposals and assignments become shared once without reopening deleted or ended work", () => {
  const s = entry(state());
  s.tasks[0].assignee = "a";
  s.tasks.push(
    {
      ...s.tasks[0],
      id: "proposal",
      status: "proposed",
      createdBy: "b",
      version: 4,
    },
    { ...s.tasks[0], id: "deleted", status: "proposed", deletedAt: now },
    { ...s.tasks[0], id: "ended", endDate: "2026-09-15" },
  );
  s.completions.push({ key: "stall:2026-09-16", by: "a", at: now });
  const before = structuredClone(s);
  assert.deepEqual(migrateSharedTasks(s), [
    "stall",
    "proposal",
    "deleted",
    "ended",
  ]);
  assert.ok(s.tasks.every((t) => t.assignee === "" && t.status === "active"));
  assert.equal(s.tasks[1].version, 5);
  assert.equal(s.tasks[0].version, 2);
  assert.equal(occurs(s.tasks[1], "2026-09-16"), true);
  assert.equal(occurs(s.tasks[2], "2026-09-16"), false);
  assert.equal(occurs(s.tasks[3], "2026-09-16"), false);
  assert.deepEqual(s.entries, before.entries);
  assert.deepEqual(s.completions, before.completions);
  assert.deepEqual(s.reports, before.reports);
  assert.deepEqual(s.members, before.members);
  assert.equal(s.tasks[1].budget, before.tasks[1].budget);
  const upgraded = structuredClone(s);
  assert.deepEqual(migrateSharedTasks(s), []);
  assert.deepEqual(s, upgraded);
  assert.doesNotThrow(() =>
    entry(s, "b", "proposal-time", { taskId: "proposal" }),
  );
  assert.throws(() => taskEdit(s, "boss", { version: 1 }), /conflict/);
});
