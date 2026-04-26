import { DAYS } from "../utils/dates.js";

export function createEmptyPlan() {
  return DAYS.reduce((plan, day) => {
    plan[day.key] = { lunch: null, dinner: null };
    return plan;
  }, {});
}

export function plannerReducer(state, action) {
  switch (action.type) {
    case "boot":
      return {
        ...state,
        rules: action.rules,
        blocks: action.blocks,
        planId: action.planId,
        plan: action.plan || createEmptyPlan(),
        activeRuleIds: action.activeRuleIds || [],
        status: "idle",
        notice: "Planner ready",
      };
    case "status":
      return { ...state, status: action.status, notice: action.notice };
    case "addRule":
      return {
        ...state,
        rules: [action.rule, ...state.rules],
        blocks: action.block ? [action.block, ...state.blocks] : state.blocks,
        activeRuleIds: state.activeRuleIds.includes(action.rule.id)
          ? state.activeRuleIds
          : [...state.activeRuleIds, action.rule.id],
      };
    case "setActiveRules":
      return { ...state, activeRuleIds: action.activeRuleIds };
    case "selectSlot":
      return { ...state, selectedSlot: action.selectedSlot };
    case "setPlan":
      return {
        ...state,
        plan: action.plan,
        activeRuleIds: action.activeRuleIds || state.activeRuleIds,
      };
    case "generatedUi":
      return {
        ...state,
        generatedUi: action.ui,
        warnings: action.warnings,
      };
    case "updateGeneratedMeal":
      return {
        ...state,
        generatedUi: state.generatedUi.map((item) => {
          if (item.component !== "meal_cards") return item;
          return {
            ...item,
            props: {
              ...item.props,
              meals: (item.props?.meals || []).map((meal) =>
                meal.id === action.meal.id || meal.name === action.meal.name ? { ...meal, ...action.meal } : meal,
              ),
            },
          };
        }),
      };
    case "acceptWarning":
      return {
        ...state,
        warnings: state.warnings.filter((warning) => warning.id !== action.warningId),
      };
    default:
      return state;
  }
}
