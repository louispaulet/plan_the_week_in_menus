export function MealOptionCard({ meal, onSelect }) {
  return (
    <button className="meal-option" onClick={onSelect}>
      <div className="flex items-start justify-between gap-2">
        <strong>{meal.name}</strong>
        <span className="chip">{meal.prep_time_minutes || 25} min</span>
      </div>
      <p className="mt-2 text-sm text-ink-600">{meal.description}</p>
      <div className="chip-row">
        {(meal.ingredients || []).slice(0, 4).map((ingredient) => (
          <span className="chip" key={ingredient}>{ingredient}</span>
        ))}
      </div>
    </button>
  );
}
