import { ChoiceButtons } from "./ChoiceButtons.jsx";
import { MealOptionCard } from "./MealOptionCard.jsx";
import { WarningCard } from "./WarningCard.jsx";

export function InterfaceRenderer({ ui, status, notice, onAction }) {
  if (!ui || ui.length === 0) {
    if (status === "loading") {
      return (
        <div className="loading-panel" aria-live="polite">
          <span className="loader-dot" />
          <span>{notice || "Loading"}</span>
        </div>
      );
    }
    if (status === "error") {
      return <p className="failure-mark" aria-label="Recommendation failed">⚠️</p>;
    }
    return <p className="muted">Pick an empty slot to get structured meal options.</p>;
  }

  return (
    <div className="stack">
      {status === "loading" && (
        <div className="loading-panel" aria-live="polite">
          <span className="loader-dot" />
          <span>{notice || "Loading"}</span>
        </div>
      )}
      {ui.map((item, index) => {
        if (item.component === "choice_buttons") {
          return <ChoiceButtons key={index} props={item.props} onAction={onAction} />;
        }
        if (item.component === "meal_cards") {
          return (
            <div className="stack" key={index}>
              {(item.props?.meals || []).map((meal) => (
                <MealOptionCard key={meal.id || meal.name} meal={meal} onSelect={() => onAction(meal.action)} />
              ))}
            </div>
          );
        }
        if (item.component === "rule_warning_cards") {
          return (
            <div className="stack" key={index}>
              {(item.props?.warnings || []).map((warning) => (
                <WarningCard key={warning.id} warning={warning} onAction={onAction} />
              ))}
            </div>
          );
        }
        if (item.component === "next_step_panel") {
          return (
            <div className="choice-panel" key={index}>
              <strong>{item.props?.title || "Next step"}</strong>
              <div className="choice-list">
                {(item.props?.actions || []).map((action) => (
                  <button className="choice-button" key={action.label} onClick={() => onAction(action.action)}>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        if (item.component === "ingredient_chips") {
          return (
            <div className="chip-row" key={index}>
              {(item.props?.ingredients || []).map((ingredient) => <span className="chip" key={ingredient}>{ingredient}</span>)}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
