import { SLOTS } from "../utils/dates.js";
import { MealSlotCard } from "./MealSlotCard.jsx";
import { RuleBadge } from "./RuleBadge.jsx";

export function DayColumn({ day, meals, warnings, activeRules, onSlotClick }) {
  const vegCount = SLOTS.reduce((count, slot) => {
    const meal = meals?.[slot.key];
    return count + Number(meal?.nutrition_estimate?.fruit_veg_servings || 0);
  }, 0);

  return (
    <article className="day-column">
      <header className="day-header">
        <div>
          <h2 className="day-name">{day.label}</h2>
          <p className="day-meta">{vegCount} fruit/veg servings</p>
        </div>
        {warnings.length > 0 && <span className="warning-chip">{warnings.length}</span>}
      </header>
      <div className="chip-row">
        {activeRules.slice(0, 2).map((rule) => <RuleBadge key={rule.id} rule={rule} />)}
      </div>
      {SLOTS.map((slot) => (
        <MealSlotCard
          key={slot.key}
          day={day.key}
          slot={slot}
          meal={meals?.[slot.key]}
          warnings={warnings.filter((warning) => warning.slot === slot.key)}
          onSlotClick={onSlotClick}
        />
      ))}
    </article>
  );
}
