import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import {
  taskTitle,
  today,
  type Action,
  type Lang,
  type Task,
  type View,
} from "../shared/domain";
import { copy } from "./i18n";
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
export function TaskForm({
  view,
  lang,
  task,
  date,
  busy,
  submit,
  onClose,
}: {
  view: View;
  lang: Lang;
  task?: Task;
  date: string;
  busy: boolean;
  submit: (action: Action) => Promise<void>;
  onClose: () => void;
}) {
  const t = copy[lang];
  const [source, setSource] = useState<Lang>(
    task?.sourceLang || (task?.titleDe ? "de" : lang),
  );
  const initialSource = task?.sourceLang || (task?.titleDe ? "de" : lang);
  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await submit({
      type: task ? "task.update" : "task.create",
      payload: {
        id: task?.id,
        version: task?.version ?? 1,
        title: String(f.get("title") || ""),
        inputLang: source,
        notes: String(f.get("notes") || ""),
        category: String(f.get("category")),
        assignee: String(f.get("assignee") || ""),
        startDate: String(f.get("startDate")),
        endDate: String(f.get("endDate") || ""),
        repeat: String(f.get("repeat")),
        budget: Number(f.get("budget")),
        twoPeople: f.get("twoPeople") === "on",
      },
    });
  };
  return (
    <form onSubmit={onSubmit}>
      {view.me.role !== "manager" && <p className="notice">{t.newTaskHint}</p>}
      <div className="form-grid">
        <Field label={t.taskTitle} wide>
          <input
            name="title"
            required
            maxLength={300}
            defaultValue={task ? taskTitle(task, initialSource) : ""}
          />
        </Field>
        <Field label={t.inputLanguage}>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as Lang)}
          >
            <option value="de">Deutsch</option>
            <option value="es">Español</option>
          </select>
        </Field>
        <Field label={t.category}>
          <select name="category" defaultValue={task?.category || "horses"}>
            {(["horses", "pasture", "maintenance", "other"] as const).map(
              (c) => (
                <option key={c} value={c}>
                  {t[c]}
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label={t.notes} wide>
          <textarea
            name="notes"
            maxLength={1000}
            rows={3}
            defaultValue={task?.notes || ""}
          />
        </Field>
        <Field label={t.assignee}>
          <select name="assignee" defaultValue={task?.assignee || ""}>
            <option value="">{t.unassigned}</option>
            {view.members
              .filter((m) => !m.deletedAt)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label={t.repeat}>
          <select name="repeat" defaultValue={task?.repeat || "once"}>
            {(["once", "daily", "weekly", "monthly"] as const).map((r) => (
              <option key={r} value={r}>
                {t[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.startDate}>
          <input
            type="date"
            name="startDate"
            required
            defaultValue={task?.startDate || date || today()}
          />
        </Field>
        <Field label={t.endDate}>
          <input
            type="date"
            name="endDate"
            defaultValue={task?.endDate || ""}
          />
        </Field>
        <Field label={t.budget}>
          <input
            name="budget"
            type="number"
            min="0"
            max="2880"
            required
            defaultValue={task?.budget ?? 0}
          />
        </Field>
        <label className="checkbox-field">
          <input
            name="twoPeople"
            type="checkbox"
            defaultChecked={task?.twoPeople || false}
          />
          {t.twoPeopleLabel}
        </label>
      </div>
      <p className="notice">{t.translationHint}</p>
      {task?.repeat !== "once" && task && (
        <p className="muted small">{t.seriesEditHint}</p>
      )}
      <p className="muted small">{t.budgetHelp}</p>
      <div className="dialog-actions">
        <button
          type="button"
          className="button ghost"
          disabled={busy}
          onClick={onClose}
        >
          {t.cancel}
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? t.saving : t.save}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
