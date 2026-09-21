import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, viewFor, applyAction } from "../shared/domain.ts";
import { withMemberEmails } from "../netlify/lib/member-emails.ts";

function state() {
  const s = emptyState();
  s.members = [
    { id: "boss", name: "Hofleitung", role: "manager", weeklyMinutes: 0 },
    { id: "a", name: "Teammitglied", role: "staff", weeklyMinutes: 2100 },
    { id: "b", name: "Teammitglied", role: "staff", weeklyMinutes: 2100 },
  ];
  return s;
}

test("staff responses omit every member email and never query Identity admin", async () => {
  const s = state();
  for (const m of s.members) m.email = `${m.id}@example.com`;
  const view = await withMemberEmails(viewFor(s, "a"), async () => {
    assert.fail("Staff must not trigger Identity admin lookups");
  });
  assert.equal("email" in view.me, false);
  assert.ok(view.members.every((m) => !("email" in m)));
  assert.ok(!JSON.stringify(view).includes("@example.com"));
  assert.equal(s.members[0].email, "boss@example.com");
});

test("managers can identify existing profiles by ID without overwriting names or persisting emails", async () => {
  const s = state();
  const original = structuredClone(s);
  const calls: string[] = [];
  const view = await withMemberEmails(viewFor(s, "boss"), async (id) => {
    calls.push(id);
    return { id, email: `${id}@example.com`, name: "Identity name", roles: ["manager"] };
  });
  assert.deepEqual(calls.sort(), ["a", "b", "boss"]);
  assert.equal(view.members[1].email, "a@example.com");
  assert.equal(view.members[2].email, "b@example.com");
  assert.equal(view.me.email, "boss@example.com");
  assert.equal(view.members[1].name, "Teammitglied");
  assert.equal(view.members[1].role, "staff");
  assert.deepEqual(s, original);
});

test("missing, mismatched or unavailable Identity accounts do not disclose another address or fail the response", async () => {
  const s = state();
  s.members[1].email = "outdated@example.com";
  const view = await withMemberEmails(viewFor(s, "boss"), async (id) => {
    if (id === "a") throw new Error("Identity unavailable");
    if (id === "b") return { id: "someone-else", email: "private@example.com" };
    return { id };
  });
  assert.ok(view.members.every((m) => !("email" in m)));
  assert.equal(view.members.length, 3);
});

test("renaming a member cannot change the read-only login email", () => {
  const s = state();
  s.members[1].email = "a@example.com";
  const result = applyAction(s, "boss", {
    type: "member.update",
    payload: { id: "a", version: 1, name: "Neuer Name", weeklyMinutes: 2100, email: "spoofed@example.com" },
  }, "test", "2026-09-21T12:00:00Z");
  assert.equal(result.members[1].name, "Neuer Name");
  assert.equal(result.members[1].email, "a@example.com");
});
