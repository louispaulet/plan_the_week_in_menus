import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { validatePlannerResponse } from "../worker.js";

execFileSync("node", ["--check", "worker.js"], { stdio: "inherit" });

const fallback = {
  type: "planner_response",
  version: 1,
  ui: [{ component: "choice_buttons", props: { choices: [] } }],
  warnings: [],
  schedule_patch: null,
  saved_blocks_suggestions: [],
};

const valid = validatePlannerResponse(
  {
    type: "planner_response",
    version: 1,
    ui: [
      { component: "choice_buttons", props: { choices: [] } },
      { component: "unknown_component", props: { unsafe: true } },
    ],
    warnings: [],
  },
  fallback,
);

assert.equal(valid.ui.length, 1);
assert.equal(valid.ui[0].component, "choice_buttons");

const invalid = validatePlannerResponse({ type: "chat", ui: [] }, fallback);
assert.equal(invalid, fallback);

console.log("Smoke tests passed");
