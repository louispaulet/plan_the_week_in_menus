export function EmptySlotCTA({ onClick }) {
  return (
    <div className="empty-slot">
      <p className="muted">Open slot</p>
      <button className="secondary-button" onClick={onClick}>Suggest meals</button>
    </div>
  );
}
