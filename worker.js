const USER_ID = "local-user";
const MODEL = "gpt-5-nano";
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const SLOTS = ["lunch", "dinner"];
const ALLOWED_COMPONENTS = new Set([
  "choice_buttons",
  "meal_cards",
  "rule_warning_cards",
  "form_fields",
  "ingredient_chips",
  "schedule_patch",
  "preference_block",
  "next_step_panel",
]);
const SEVERITIES = new Set(["hard", "soft", "warning"]);
const SCOPES = new Set(["global", "day", "meal", "ingredient", "dish", "shopping_list"]);

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);

    try {
      if (!url.pathname.startsWith("/api/")) {
        return json({ error: "Not found" }, 404);
      }

      const route = matchRoute(request.method, url.pathname);
      if (!route) return json({ error: "Not found" }, 404);

      return await route.handler({ request, env, params: route.params });
    } catch (error) {
      return json({ error: error.message || "Unexpected server error" }, 500);
    }
  },
};

function matchRoute(method, pathname) {
  const routes = [
    ["GET", /^\/api\/health$/, health],
    ["GET", /^\/api\/preferences$/, getPreferences],
    ["PUT", /^\/api\/preferences$/, putPreferences],
    ["GET", /^\/api\/rules$/, listRules],
    ["POST", /^\/api\/rules$/, createRule],
    ["PUT", /^\/api\/rules\/([^/]+)$/, updateRule],
    ["DELETE", /^\/api\/rules\/([^/]+)$/, deleteRule],
    ["POST", /^\/api\/rules\/normalize$/, normalizeRule],
    ["GET", /^\/api\/blocks$/, listBlocks],
    ["POST", /^\/api\/blocks$/, createBlock],
    ["PUT", /^\/api\/blocks\/([^/]+)$/, updateBlock],
    ["DELETE", /^\/api\/blocks\/([^/]+)$/, deleteBlock],
    ["POST", /^\/api\/plans$/, createPlan],
    ["GET", /^\/api\/plans\/([^/]+)$/, getPlan],
    ["PUT", /^\/api\/plans\/([^/]+)$/, updatePlan],
    ["DELETE", /^\/api\/plans\/([^/]+)$/, deletePlan],
    ["POST", /^\/api\/plans\/([^/]+)\/suggest-options$/, suggestOptions],
    ["POST", /^\/api\/plans\/([^/]+)\/check-rules$/, checkRules],
    ["GET", /^\/api\/interface-templates$/, listInterfaceTemplates],
  ];

  for (const [routeMethod, pattern, handler] of routes) {
    const match = pathname.match(pattern);
    if (method === routeMethod && match) return { handler, params: match.slice(1) };
  }
  return null;
}

async function health() {
  return json({ ok: true, service: "week-menu-planner", version: 1 });
}

async function getPreferences({ env }) {
  const row = await env.DB.prepare("SELECT * FROM preferences WHERE user_id = ? LIMIT 1").bind(USER_ID).first();
  return json(row ? decodeRow(row) : null);
}

async function putPreferences({ request, env }) {
  const input = await readJson(request);
  const now = timestamp();
  const id = input.id || makeId("pref");
  await env.DB.prepare(
    `INSERT INTO preferences (id, user_id, household_size, default_budget, default_diet_style, locale, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET household_size = excluded.household_size, default_budget = excluded.default_budget,
       default_diet_style = excluded.default_diet_style, locale = excluded.locale, updated_at = excluded.updated_at`,
  )
    .bind(id, USER_ID, input.household_size || null, input.default_budget || null, input.default_diet_style || null, input.locale || "en", now, now)
    .run();
  return getPreferences({ env });
}

async function listRules({ env }) {
  const result = await env.DB.prepare("SELECT * FROM rules WHERE user_id = ? AND status != 'archived' ORDER BY created_at DESC").bind(USER_ID).all();
  return json(result.results.map(decodeRow));
}

async function createRule({ request, env }) {
  const input = await readJson(request);
  const rule = normalizeRuleInput(input);
  const now = timestamp();
  const id = makeId("rule");
  await env.DB.prepare(
    `INSERT INTO rules (id, user_id, name, text, severity, scope, status, tags_json, structured_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, USER_ID, rule.name, rule.text, rule.severity, rule.scope, rule.status, encode(rule.tags_json), encode(rule.structured_json), now, now)
    .run();
  const row = await env.DB.prepare("SELECT * FROM rules WHERE id = ?").bind(id).first();
  return json(decodeRow(row), 201);
}

async function updateRule({ request, env, params }) {
  const input = await readJson(request);
  const rule = normalizeRuleInput(input);
  await env.DB.prepare(
    `UPDATE rules SET name = ?, text = ?, severity = ?, scope = ?, status = ?, tags_json = ?, structured_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(rule.name, rule.text, rule.severity, rule.scope, rule.status, encode(rule.tags_json), encode(rule.structured_json), timestamp(), params[0], USER_ID)
    .run();
  const row = await env.DB.prepare("SELECT * FROM rules WHERE id = ?").bind(params[0]).first();
  return json(decodeRow(row));
}

async function deleteRule({ env, params }) {
  await env.DB.prepare("UPDATE rules SET status = 'archived', updated_at = ? WHERE id = ? AND user_id = ?").bind(timestamp(), params[0], USER_ID).run();
  return json({ ok: true });
}

async function normalizeRule({ request, env }) {
  const { text } = await readJson(request);
  if (!text || typeof text !== "string") return json({ error: "Rule text is required" }, 400);
  const fallback = fallbackNormalizedRule(text);
  const response = await callOpenAI(env, buildRuleNormalizePrompt(text), fallback);
  return json({
    name: stringOr(response.name, fallback.name),
    severity: SEVERITIES.has(response.severity) ? response.severity : fallback.severity,
    scope: SCOPES.has(response.scope) ? response.scope : fallback.scope,
    tags: Array.isArray(response.tags) ? response.tags.slice(0, 8) : fallback.tags,
    structured: typeof response.structured === "object" && response.structured ? response.structured : fallback.structured,
  });
}

async function listBlocks({ env }) {
  const result = await env.DB.prepare("SELECT * FROM reusable_blocks WHERE user_id = ? ORDER BY created_at DESC").bind(USER_ID).all();
  return json(result.results.map(decodeRow));
}

async function createBlock({ request, env }) {
  const input = await readJson(request);
  const block = normalizeBlockInput(input);
  const now = timestamp();
  const id = makeId("block");
  await env.DB.prepare(
    `INSERT INTO reusable_blocks (id, user_id, type, name, display_summary, hidden_context, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, USER_ID, block.type, block.name, block.display_summary, block.hidden_context, encode(block.metadata_json), now, now)
    .run();
  const row = await env.DB.prepare("SELECT * FROM reusable_blocks WHERE id = ?").bind(id).first();
  return json(decodeRow(row), 201);
}

async function updateBlock({ request, env, params }) {
  const block = normalizeBlockInput(await readJson(request));
  await env.DB.prepare(
    `UPDATE reusable_blocks SET type = ?, name = ?, display_summary = ?, hidden_context = ?, metadata_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(block.type, block.name, block.display_summary, block.hidden_context, encode(block.metadata_json), timestamp(), params[0], USER_ID)
    .run();
  const row = await env.DB.prepare("SELECT * FROM reusable_blocks WHERE id = ?").bind(params[0]).first();
  return json(decodeRow(row));
}

async function deleteBlock({ env, params }) {
  await env.DB.prepare("DELETE FROM reusable_blocks WHERE id = ? AND user_id = ?").bind(params[0], USER_ID).run();
  return json({ ok: true });
}

async function createPlan({ request, env }) {
  const input = await readJson(request);
  const now = timestamp();
  const id = makeId("plan");
  const plan = sanitizePlan(input.plan_json || emptyPlan());
  const activeRules = Array.isArray(input.active_rules_json) ? input.active_rules_json : [];
  await env.DB.prepare(
    `INSERT INTO meal_plans (id, user_id, title, week_start_date, active_rules_json, plan_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, USER_ID, stringOr(input.title, "This week's menu"), stringOr(input.week_start_date, today()), encode(activeRules), encode(plan), now, now)
    .run();
  const row = await env.DB.prepare("SELECT * FROM meal_plans WHERE id = ?").bind(id).first();
  return json(decodeRow(row), 201);
}

async function getPlan({ env, params }) {
  const plan = await loadPlan(env, params[0]);
  return json(plan);
}

async function updatePlan({ request, env, params }) {
  const input = await readJson(request);
  const plan = sanitizePlan(input.plan_json || emptyPlan());
  const activeRules = Array.isArray(input.active_rules_json) ? input.active_rules_json : [];
  await env.DB.prepare(
    `UPDATE meal_plans SET title = ?, week_start_date = ?, active_rules_json = ?, plan_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
  )
    .bind(stringOr(input.title, "This week's menu"), stringOr(input.week_start_date, today()), encode(activeRules), encode(plan), timestamp(), params[0], USER_ID)
    .run();
  return getPlan({ env, params });
}

async function deletePlan({ env, params }) {
  await env.DB.prepare("DELETE FROM meal_plans WHERE id = ? AND user_id = ?").bind(params[0], USER_ID).run();
  return json({ ok: true });
}

async function suggestOptions({ request, env, params }) {
  const input = await readJson(request);
  const plan = await loadPlan(env, params[0]);
  const day = DAYS.includes(input.day) ? input.day : "monday";
  const slot = SLOTS.includes(input.slot) ? input.slot : "dinner";
  const rules = await loadActiveRules(env, plan.active_rules_json);
  const fallback = fallbackSuggestions(day, slot);
  const candidate = await callOpenAI(env, buildSuggestionPrompt({ plan, rules, day, slot }), fallback);
  return json(validatePlannerResponse(candidate, fallback));
}

async function checkRules({ env, params }) {
  const plan = await loadPlan(env, params[0]);
  const rules = await loadActiveRules(env, plan.active_rules_json);
  const warnings = deterministicWarnings(plan, rules);
  const response = {
    type: "planner_response",
    version: 1,
    ui: warnings.length
      ? [{ component: "rule_warning_cards", props: { warnings } }]
      : [{
          component: "next_step_panel",
          props: {
            title: "Plan status",
            actions: [{ label: "Fill another slot", action: { type: "suggest_options", payload: firstEmptySlot(plan.plan_json) } }],
          },
        }],
    warnings,
    schedule_patch: null,
    saved_blocks_suggestions: [],
  };
  await replaceWarnings(env, plan.id, warnings);
  return json(response);
}

async function listInterfaceTemplates() {
  return json([
    { id: "choice_buttons", name: "Choice buttons", component: "choice_buttons" },
    { id: "meal_cards", name: "Meal cards", component: "meal_cards" },
    { id: "rule_warning_cards", name: "Rule warning cards", component: "rule_warning_cards" },
    { id: "next_step_panel", name: "Next step panel", component: "next_step_panel" },
  ]);
}

async function loadPlan(env, id) {
  const row = await env.DB.prepare("SELECT * FROM meal_plans WHERE id = ? AND user_id = ?").bind(id, USER_ID).first();
  if (!row) throw new Error("Plan not found");
  return decodeRow(row);
}

async function loadActiveRules(env, activeRuleIds = []) {
  if (activeRuleIds.length > 0) {
    const placeholders = activeRuleIds.map(() => "?").join(",");
    const result = await env.DB.prepare(`SELECT * FROM rules WHERE user_id = ? AND id IN (${placeholders})`).bind(USER_ID, ...activeRuleIds).all();
    return result.results.map(decodeRow);
  }
  const result = await env.DB.prepare("SELECT * FROM rules WHERE user_id = ? AND status = 'active'").bind(USER_ID).all();
  return result.results.map(decodeRow);
}

async function replaceWarnings(env, planId, warnings) {
  await env.DB.prepare("DELETE FROM warnings WHERE plan_id = ?").bind(planId).run();
  for (const warning of warnings) {
    await env.DB.prepare(
      `INSERT INTO warnings (id, plan_id, rule_id, day, slot, severity, message, actions_json, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    )
      .bind(warning.id, planId, warning.rule_id || null, warning.day || null, warning.slot || null, warning.severity, warning.message, encode(warning.actions), timestamp(), timestamp())
      .run();
  }
}

export async function callOpenAI(env, prompt, fallback, options = {}) {
  if (!env.OPENAI_API_KEY) {
    if (options.throwOnError) throw new Error("OPENAI_API_KEY is required");
    return fallback;
  }
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: prompt.system },
          { role: "user", content: JSON.stringify(prompt.payload) },
        ],
        text: { format: { type: "json_object" } },
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      if (options.throwOnError) throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
      return fallback;
    }
    const data = await response.json();
    const text = extractOutputText(data);
    if (!text && options.throwOnError) throw new Error("OpenAI response did not include output text");
    return text ? JSON.parse(text) : fallback;
  } catch (error) {
    if (options.throwOnError) throw error;
    return fallback;
  }
}

function extractOutputText(data) {
  return data.output_text || data.output?.flatMap((item) => item.content || []).find((content) => content.type === "output_text")?.text;
}

export function buildSuggestionPrompt({ plan, rules, day, slot }) {
  return {
    system:
      "You are a menu planning engine. Return strict JSON only. Do not return markdown or chat prose. Use only known UI components: choice_buttons, meal_cards, rule_warning_cards, form_fields, ingredient_chips, schedule_patch, preference_block, next_step_panel. Prefer exactly 3 or 4 meal choices. Every warning must include actionable choices.",
    payload: {
      task: "suggest meal options",
      selected_day: day,
      selected_slot: slot,
      active_rules: rules.map((rule) => ({ name: rule.name, severity: rule.severity, scope: rule.scope, text: rule.text })),
      current_plan: plan.plan_json,
      response_contract: "planner_response version 1",
    },
  };
}

export function buildRuleNormalizePrompt(text) {
  return {
    system:
      "Normalize a menu planning rule. Return strict JSON only with keys: name, severity, scope, tags, structured. severity must be hard, soft, or warning. scope must be global, day, meal, ingredient, dish, or shopping_list.",
    payload: { text },
  };
}

export function validatePlannerResponse(candidate, fallback = fallbackSuggestions("monday", "dinner")) {
  if (!candidate || candidate.type !== "planner_response" || candidate.version !== 1 || !Array.isArray(candidate.ui)) {
    return fallback;
  }

  const ui = candidate.ui
    .filter((item) => ALLOWED_COMPONENTS.has(item.component))
    .map((item) => ({ component: item.component, props: item.props || {} }));

  if (ui.length === 0) return fallback;

  return {
    type: "planner_response",
    version: 1,
    summary: candidate.summary || null,
    ui,
    warnings: Array.isArray(candidate.warnings) ? candidate.warnings.map(normalizeWarning).filter(Boolean) : [],
    schedule_patch: candidate.schedule_patch || null,
    saved_blocks_suggestions: Array.isArray(candidate.saved_blocks_suggestions) ? candidate.saved_blocks_suggestions : [],
  };
}

function deterministicWarnings(plan, rules) {
  const warnings = [];
  for (const rule of rules) {
    const text = `${rule.name} ${rule.text}`.toLowerCase();
    for (const day of DAYS) {
      for (const slot of SLOTS) {
        const meal = plan.plan_json?.[day]?.[slot];
        if (!meal) continue;
        const mealText = `${meal.name} ${meal.description || ""} ${(meal.ingredients || []).join(" ")} ${(meal.tags || []).join(" ")}`.toLowerCase();
        if (text.includes("low carb") && slot === "dinner" && ["monday", "tuesday", "wednesday", "thursday", "friday"].includes(day) && /(rice|pasta|bread|noodle|potato)/.test(mealText)) {
          warnings.push(makeWarning(rule, day, slot, "Low-carb dinner conflict", "This dinner includes a higher-carb ingredient while a low-carb dinner rule is active."));
        }
        const avoidMatch = text.match(/avoid ([a-z ,]+)/);
        if (avoidMatch) {
          const avoided = avoidMatch[1].split(/,| and /).map((item) => item.trim()).filter(Boolean);
          const hit = avoided.find((ingredient) => mealText.includes(ingredient));
          if (hit) warnings.push(makeWarning(rule, day, slot, "Avoided ingredient", `This meal appears to include ${hit}.`));
        }
      }
      if ((text.includes("5 fruits") || text.includes("5 fruit") || text.includes("vegetables per day")) && fruitVegCount(plan.plan_json?.[day]) < 5) {
        warnings.push(makeWarning(rule, day, null, "Fruit and vegetable target", "This day is below the active fruit and vegetable target."));
      }
    }
  }
  return warnings;
}

function makeWarning(rule, day, slot, title, message) {
  const warningId = makeId("warning");
  return {
    id: warningId,
    rule_id: rule.id,
    day,
    slot,
    title,
    severity: rule.severity || "warning",
    message,
    actions: [
      { label: "Show alternatives", action: { type: "suggest_options", payload: { day, slot: slot || "dinner" } } },
      { label: "Accept once", action: { type: "accept_warning", payload: { warning_id: warningId } } },
      { label: "Check again", action: { type: "check_rules", payload: {} } },
    ],
  };
}

export function fallbackSuggestions(day, slot) {
  const meals = [
    {
      id: `generated_${day}_${slot}_salmon`,
      name: "Air fryer salmon with green beans",
      description: "Fast fish dinner with a lemon yogurt sauce and a crisp vegetable side.",
      ingredients: ["salmon", "green beans", "lemon", "yogurt"],
      tags: ["low_carb", "fast", "air_fryer"],
      prep_time_minutes: 25,
      nutrition_estimate: { fruit_veg_servings: 2 },
    },
    {
      id: `generated_${day}_${slot}_chicken`,
      name: "Chicken salad bowl",
      description: "Lean chicken, crunchy vegetables and a simple vinaigrette.",
      ingredients: ["chicken", "lettuce", "cucumber", "tomato"],
      tags: ["high_protein", "low_carb"],
      prep_time_minutes: 20,
      nutrition_estimate: { fruit_veg_servings: 3 },
    },
    {
      id: `generated_${day}_${slot}_omelette`,
      name: "Mushroom omelette and side salad",
      description: "A quick egg-based option with mushrooms, herbs and greens.",
      ingredients: ["eggs", "mushrooms", "spinach", "salad"],
      tags: ["vegetarian", "fast"],
      prep_time_minutes: 18,
      nutrition_estimate: { fruit_veg_servings: 2 },
    },
  ].map((meal) => ({
    ...meal,
    action: { type: "select_meal_option", payload: { day, slot, meal } },
  }));

  return {
    type: "planner_response",
    version: 1,
    summary: { machine_label: "fallback_meal_options", user_visible_title: "Choose a meal" },
    ui: [
      {
        component: "meal_cards",
        props: { meals },
      },
      {
        component: "choice_buttons",
        props: {
          question: "Need a different direction?",
          choices: [
            { label: "Show another set", action: { type: "suggest_options", payload: { day, slot } } },
            { label: "Check rules first", action: { type: "check_rules", payload: {} } },
          ],
        },
      },
    ],
    warnings: [],
    schedule_patch: null,
    saved_blocks_suggestions: [],
  };
}

export function fallbackNormalizedRule(text) {
  const lower = text.toLowerCase();
  return {
    name: lower.includes("low carb") ? "Low carb" : text.split(/[.!?]/)[0].slice(0, 42) || "Planning rule",
    severity: lower.includes("avoid") ? "hard" : "warning",
    scope: lower.includes("ingredient") || lower.includes("avoid") ? "ingredient" : "global",
    tags: lower.split(/[^a-z0-9]+/).filter((word) => word.length > 3).slice(0, 6),
    structured: { source: "fallback", normalized_at: timestamp() },
  };
}

function normalizeRuleInput(input) {
  if (!input.text || typeof input.text !== "string") throw new Error("Rule text is required");
  return {
    name: stringOr(input.name, input.text.slice(0, 42)),
    text: input.text,
    severity: SEVERITIES.has(input.severity) ? input.severity : "warning",
    scope: SCOPES.has(input.scope) ? input.scope : "global",
    status: ["active", "inactive", "archived"].includes(input.status) ? input.status : "active",
    tags_json: Array.isArray(input.tags_json) ? input.tags_json : [],
    structured_json: typeof input.structured_json === "object" && input.structured_json ? input.structured_json : {},
  };
}

function normalizeBlockInput(input) {
  if (!input.name || !input.hidden_context) throw new Error("Block name and hidden context are required");
  return {
    type: stringOr(input.type, "rule"),
    name: input.name,
    display_summary: stringOr(input.display_summary, input.name),
    hidden_context: input.hidden_context,
    metadata_json: typeof input.metadata_json === "object" && input.metadata_json ? input.metadata_json : {},
  };
}

function normalizeWarning(warning) {
  if (!warning || !warning.message) return null;
  return {
    id: warning.id || makeId("warning"),
    rule_id: warning.rule_id || null,
    day: DAYS.includes(warning.day) ? warning.day : null,
    slot: SLOTS.includes(warning.slot) ? warning.slot : null,
    title: stringOr(warning.title, "Rule warning"),
    severity: SEVERITIES.has(warning.severity) ? warning.severity : "warning",
    message: warning.message,
    actions: Array.isArray(warning.actions) && warning.actions.length > 0 ? warning.actions : [],
  };
}

function sanitizePlan(plan) {
  const clean = emptyPlan();
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      clean[day][slot] = typeof plan?.[day]?.[slot] === "object" ? plan[day][slot] : null;
    }
  }
  return clean;
}

export function emptyPlan() {
  return DAYS.reduce((plan, day) => {
    plan[day] = { lunch: null, dinner: null };
    return plan;
  }, {});
}

function firstEmptySlot(plan) {
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      if (!plan.plan_json?.[day]?.[slot]) return { day, slot };
    }
  }
  return { day: "monday", slot: "lunch" };
}

function fruitVegCount(dayPlan) {
  return SLOTS.reduce((count, slot) => count + Number(dayPlan?.[slot]?.nutrition_estimate?.fruit_veg_servings || 0), 0);
}

function decodeRow(row) {
  if (!row) return null;
  const decoded = { ...row };
  for (const key of ["tags_json", "structured_json", "metadata_json", "active_rules_json", "plan_json", "ingredients_json", "nutrition_estimate_json", "default_props_json", "schema_json", "actions_json"]) {
    if (key in decoded) decoded[key] = parseJson(decoded[key], key.endsWith("_json") ? {} : []);
  }
  if (Array.isArray(decoded.tags_json) === false && decoded.tags_json && typeof decoded.tags_json === "object") decoded.tags_json = [];
  if (Array.isArray(decoded.active_rules_json) === false) decoded.active_rules_json = [];
  return decoded;
}

async function readJson(request) {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function encode(value) {
  return JSON.stringify(value ?? null);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function timestamp() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
