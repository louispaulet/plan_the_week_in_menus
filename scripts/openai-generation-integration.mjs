import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  buildRuleNormalizePrompt,
  buildSuggestionPrompt,
  callOpenAI,
  emptyPlan,
  fallbackNormalizedRule,
  fallbackSuggestions,
  validatePlannerResponse,
} from "../worker.js";

const allowedComponents = new Set([
  "choice_buttons",
  "meal_cards",
  "rule_warning_cards",
  "form_fields",
  "ingredient_chips",
  "schedule_patch",
  "preference_block",
  "next_step_panel",
]);

loadDotEnv();

if (!process.env.OPENAI_API_KEY) {
  console.log("Skipping live OpenAI integration tests: OPENAI_API_KEY is not set.");
  process.exit(0);
}

const env = { OPENAI_API_KEY: process.env.OPENAI_API_KEY };

const plan = {
  id: "test_plan",
  title: "Integration test week",
  week_start_date: "2026-04-27",
  active_rules_json: ["rule_low_carb"],
  plan_json: emptyPlan(),
};

const rules = [
  {
    id: "rule_low_carb",
    name: "Low carb dinners",
    severity: "warning",
    scope: "meal",
    text: "Keep weekday dinners low carb. Avoid rice, pasta, bread and potatoes for dinner.",
  },
];

const suggestionCandidate = await callOpenAI(
  env,
  buildSuggestionPrompt({ plan, rules, day: "wednesday", slot: "dinner" }),
  fallbackSuggestions("wednesday", "dinner"),
  { throwOnError: true },
);

assert.equal(
  suggestionCandidate.type,
  "planner_response",
  `planner response type mismatch; received keys: ${Object.keys(suggestionCandidate).join(", ")}`,
);
assert.equal(suggestionCandidate.version, 1, "planner response version must be 1");
assert.ok(Array.isArray(suggestionCandidate.ui), "planner response must include a ui array");
assert.ok(
  suggestionCandidate.ui.every((item) => item.component && !item.type),
  "raw model UI items must use component/props, not type/cards",
);

const suggestion = validatePlannerResponse(suggestionCandidate, fallbackSuggestions("wednesday", "dinner"));
assert.equal(suggestion.type, "planner_response");
assert.ok(suggestion.ui.length > 0, "validated response must include at least one UI component");
assert.ok(
  suggestion.ui.every((item) => allowedComponents.has(item.component)),
  "validated response must include only allowed UI components",
);

const mealCards = suggestion.ui.find((item) => item.component === "meal_cards");
const choiceButtons = suggestion.ui.find((item) => item.component === "choice_buttons");
assert.ok(mealCards || choiceButtons, "planner generation must return meal cards or choice buttons");

if (mealCards) {
  const meals = mealCards.props.meals || [];
  assert.ok(meals.length >= 2 && meals.length <= 4, "meal_cards should provide 2 to 4 meal options");
  assert.ok(meals.every((meal) => meal.name && meal.action?.type === "select_meal_option"));
  console.log("Generated meal options:");
  for (const meal of meals) console.log(`- ${meal.name}`);
}

if (choiceButtons) {
  const choices = choiceButtons.props.choices || [];
  assert.ok(choices.length >= 2 && choices.length <= 4, "choice_buttons should provide 2 to 4 choices");
  assert.ok(choices.every((choice) => choice.label && choice.action?.type));
}

const normalizedRule = await callOpenAI(
  env,
  buildRuleNormalizePrompt("Avoid bell peppers. Prefer air fryer compatible meals on work nights."),
  fallbackNormalizedRule("Avoid bell peppers. Prefer air fryer compatible meals on work nights."),
  { throwOnError: true },
);

assert.ok(normalizedRule.name, "normalized rule must include a name");
assert.ok(["hard", "soft", "warning"].includes(normalizedRule.severity), "normalized rule severity must be valid");
assert.ok(
  ["global", "day", "meal", "ingredient", "dish", "shopping_list"].includes(normalizedRule.scope),
  "normalized rule scope must be valid",
);
assert.ok(Array.isArray(normalizedRule.tags), "normalized rule must include tags");
assert.equal(typeof normalizedRule.structured, "object", "normalized rule must include structured metadata");

console.log("Live OpenAI generation integration tests passed");

function loadDotEnv() {
  if (process.env.OPENAI_API_KEY || !existsSync(".env")) return;

  const contents = readFileSync(".env", "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
