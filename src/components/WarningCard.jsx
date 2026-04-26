export function WarningCard({ warning, onAction }) {
  return (
    <article className="warning-card">
      <div className="flex items-start justify-between gap-2">
        <strong>{warning.title || "Rule warning"}</strong>
        <span className="warning-chip">{warning.severity}</span>
      </div>
      <p className="mt-2 text-sm text-ink-600">{warning.message}</p>
      <div className="choice-list">
        {(warning.actions || []).map((action) => (
          <button className="choice-button" key={action.label} onClick={() => onAction(action.action)}>
            {action.label}
          </button>
        ))}
      </div>
    </article>
  );
}
