import { EmptySlotCTA } from "./EmptySlotCTA.jsx";

export function MealSlotCard({ day, slot, meal, warnings, onSlotClick }) {
  if (!meal) {
    return (
      <div className="meal-card">
        <div className="meal-slot-label">{slot.label}</div>
        <EmptySlotCTA onClick={() => onSlotClick(day, slot.key)} />
      </div>
    );
  }

  return (
    <div className="meal-card meal-card-filled">
      <div className="flex items-center justify-between gap-2">
        <span className="meal-slot-label">{slot.label}</span>
        {warnings.length > 0 && <span className="warning-chip">{warnings.length} warning</span>}
      </div>
      <h3 className="meal-name">{meal.name}</h3>
      <p className="meal-description">{meal.description}</p>
      <div className="chip-row">
        {(meal.tags || []).slice(0, 3).map((tag) => <span className="chip" key={tag}>{tag}</span>)}
      </div>
    </div>
  );
}
