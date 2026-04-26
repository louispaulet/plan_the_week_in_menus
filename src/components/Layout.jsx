export function Layout({ title, weekStartDate, status, notice, ready, onCheckRules, children }) {
  return (
    <div className="app-frame">
      <header className="top-bar">
        <div className="top-bar-inner">
          <div>
            <h1 className="brand-title">{title}</h1>
            <p className="brand-subtitle">Week of {weekStartDate}</p>
          </div>
          <div className="toolbar">
            <span className="chip">{ready ? notice : "Starting"}</span>
            <span className="chip">{status}</span>
            <button className="primary-button" onClick={onCheckRules}>Check rules</button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
