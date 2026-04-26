import { useState } from "react";

const severities = ["warning", "soft", "hard"];
const scopes = ["global", "day", "meal", "ingredient", "dish", "shopping_list"];

export function RuleEditor({ onCreateRule }) {
  const [form, setForm] = useState({
    name: "",
    text: "",
    severity: "warning",
    scope: "global",
  });

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.text.trim()) return;
    await onCreateRule(form);
    setForm({ name: "", text: "", severity: "warning", scope: "global" });
  }

  return (
    <section className="panel-section">
      <div className="section-heading">
        <span>Rules</span>
      </div>
      <form className="form-stack" onSubmit={submit}>
        <label>
          <span className="field-label">Name</span>
          <input
            className="field-input"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Low carb dinners"
          />
        </label>
        <label>
          <span className="field-label">Rule text</span>
          <textarea
            className="field-input min-h-24"
            value={form.text}
            onChange={(event) => update("text", event.target.value)}
            placeholder="Avoid rice, pasta and bread for weekday dinners."
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="field-label">Severity</span>
            <select className="field-input" value={form.severity} onChange={(event) => update("severity", event.target.value)}>
              {severities.map((severity) => <option key={severity}>{severity}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Scope</span>
            <select className="field-input" value={form.scope} onChange={(event) => update("scope", event.target.value)}>
              {scopes.map((scope) => <option key={scope}>{scope}</option>)}
            </select>
          </label>
        </div>
        <button className="primary-button" type="submit">Save rule</button>
      </form>
    </section>
  );
}
