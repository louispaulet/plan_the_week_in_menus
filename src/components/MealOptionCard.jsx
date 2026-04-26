export function MealOptionCard({ meal, onSelect }) {
  const detailsLoading = meal.details_status === "loading";
  const detailsError = meal.details_status === "error";
  return (
    <button className="meal-option" onClick={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <strong>{meal.name}</strong>
        <span className="chip">{detailsLoading ? "..." : `${meal.prep_time_minutes || 25} min`}</span>
      </div>
      <p className="mt-2 text-sm text-ink-600">
        {detailsError ? <span className="failure-mark" aria-label="Details failed">⚠️</span> : meal.description}
      </p>
      <div className="chip-row">
        {detailsLoading && <span className="chip">Loading details</span>}
        {(meal.ingredients || []).slice(0, 4).map((ingredient) => <span className="chip" key={ingredient}>{ingredient}</span>)}
      </div>
    </button>
  );
}
