export function RuleBlockLibrary({ rules, blocks, activeRuleIds, onToggleRule }) {
  return (
    <section className="panel-section">
      <div className="section-heading">
        <span>Reusable blocks</span>
        <span className="count-pill">{blocks.length}</span>
      </div>
      <div className="stack">
        {rules.length === 0 ? (
          <p className="muted">Saved rules will appear as compact planning blocks.</p>
        ) : (
          rules.map((rule) => {
            const active = activeRuleIds.includes(rule.id) || rule.status === "active";
            return (
              <button
                key={rule.id}
                className={`rule-block ${active ? "rule-block-active" : ""}`}
                onClick={() => onToggleRule(rule.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong>{rule.name}</strong>
                  <span className="chip">{rule.severity}</span>
                </div>
                <p className="mt-2 text-sm text-ink-600">{rule.text}</p>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
