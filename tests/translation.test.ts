import test from "node:test";
import assert from "node:assert/strict";
import { translateTask } from "../netlify/lib/translation.ts";
import type { Task } from "../shared/domain.ts";
const source: Task = {
  id: "t",
  titleDe: "Stall reinigen",
  titleEs: "",
  notes: "Tränke um 08:30 prüfen.\n2 Eimer Wasser.",
  notesDe: "Tränke um 08:30 prüfen.\n2 Eimer Wasser.",
  sourceLang: "de",
  category: "horses",
  budget: 60,
  assignee: "PRIVATE_MEMBER_ID",
  startDate: "2026-09-16",
  repeat: "daily",
  twoPeople: false,
  status: "active",
  createdBy: "PRIVATE_MANAGER",
  translationStatus: "pending",
};
const gateway = {
  baseUrl: "https://gateway.example/openai",
  apiKey: "test-placeholder",
};
function response(
  title = "Limpiar el establo",
  description = "Revisar el bebedero a las 08:30.\n2 cubos de agua.",
  finish = "stop",
) {
  return Response.json({
    choices: [
      {
        finish_reason: finish,
        message: { content: JSON.stringify({ title, description }) },
      },
    ],
  });
}
test("translates title and description together and sends no member or report data", async () => {
  let calls = 0;
  const mock: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://gateway.example/openai/v1/chat/completions");
    const body = JSON.parse(init!.body as string);
    assert.deepEqual(JSON.parse(body.messages[1].content), {
      title: source.titleDe,
      description: source.notes,
    });
    assert.ok(!(init!.body as string).includes("PRIVATE"));
    assert.ok(init?.signal);
    return response();
  };
  const result = await translateTask(source, gateway, mock);
  assert.equal(calls, 1);
  assert.equal(result.titleEs, "Limpiar el establo");
  assert.equal(
    result.notesEs,
    "Revisar el bebedero a las 08:30.\n2 cubos de agua.",
  );
  assert.equal(result.titleDe, source.titleDe);
  assert.equal(result.notes, source.notes);
  assert.equal(result.translationStatus, "ready");
  assert.equal(source.translationStatus, "pending");
});
test("Spanish input translates to German and supports base URL ending in v1", async () => {
  const mock: typeof fetch = async (url) => {
    assert.equal(url, "https://gateway.example/openai/v1/chat/completions");
    return response("Stall reinigen", "Wasser wechseln");
  };
  const result = await translateTask(
    {
      ...source,
      titleDe: "",
      titleEs: "Limpiar el establo",
      notes: "Cambiar el agua",
      sourceLang: "es",
    },
    { ...gateway, baseUrl: gateway.baseUrl + "/v1/" },
    mock,
  );
  assert.equal(result.titleDe, "Stall reinigen");
  assert.equal(result.notesDe, "Wasser wechseln");
  assert.equal(result.notesEs, "Cambiar el agua");
});
test("gateway failure, incomplete output, malformed JSON and missing translations are not marked successful", async () => {
  const bad: Response[] = [
    new Response("", { status: 503 }),
    response("", "Text"),
    response("Title", ""),
    response("Title", "Text", "length"),
    Response.json({
      choices: [{ finish_reason: "stop", message: { content: "not JSON" } }],
    }),
  ];
  for (const output of bad)
    await assert.rejects(
      translateTask(source, gateway, async () => output),
      /translationUnavailable/,
    );
  await assert.rejects(
    translateTask(source, {}, async () => {
      throw Error("must not call");
    }),
    /translationUnavailable/,
  );
});
test("empty descriptions remain empty even if the model adds text", async () => {
  const result = await translateTask(
    { ...source, notes: "" },
    gateway,
    async () => response("Limpiar", "Unexpected addition"),
  );
  assert.equal(result.notesEs, "");
  assert.equal(result.notes, "");
});
