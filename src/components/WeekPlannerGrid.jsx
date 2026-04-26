import { DayColumn } from "./DayColumn.jsx";

export function WeekPlannerGrid({ days, plan, warnings, activeRules, onSlotClick }) {
  return (
    <section className="week-grid" aria-label="Weekly menu planner">
      {days.map((day) => (
        <DayColumn
          key={day.key}
          day={day}
          meals={plan[day.key]}
          warnings={warnings.filter((warning) => warning.day === day.key)}
          activeRules={activeRules}
          onSlotClick={onSlotClick}
        />
      ))}
    </section>
  );
}
