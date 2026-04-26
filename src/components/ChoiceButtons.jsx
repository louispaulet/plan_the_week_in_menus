export function ChoiceButtons({ props, onAction }) {
  return (
    <div className="choice-panel">
      <strong>{props?.question || "Choose an option"}</strong>
      <div className="choice-list">
        {(props?.choices || []).slice(0, 4).map((choice) => (
          <button className="choice-button" key={choice.label} onClick={() => onAction(choice.action)}>
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}
