import React, { useEffect, useMemo, useReducer, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { api } from "./api/client.js";
import { DAYS, nextMonday } from "./utils/dates.js";
import { createEmptyPlan, plannerReducer } from "./state/plannerReducer.js";
import { Layout } from "./components/Layout.jsx";
import { WeekPlannerGrid } from "./components/WeekPlannerGrid.jsx";
import { RuleEditor } from "./components/RuleEditor.jsx";
import { RuleBlockLibrary } from "./components/RuleBlockLibrary.jsx";
import { InterfaceRenderer } from "./components/InterfaceRenderer.jsx";
import { WarningCard } from "./components/WarningCard.jsx";

function App() {
  const [state, dispatch] = useReducer(plannerReducer, {
    planId: null,
    title: "This week's menu",
    weekStartDate: nextMonday(),
    plan: createEmptyPlan(),
    activeRuleIds: [],
    rules: [],
    blocks: [],
    generatedUi: [],
    warnings: [],
    selectedSlot: null,
    status: "idle",
    notice: "",
  });
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    async function boot() {
      dispatch({ type: "status", status: "loading", notice: "Loading planner" });
      try {
        const [rules, blocks] = await Promise.all([api.getRules(), api.getBlocks()]);
        const activeRuleIds = rules.filter((rule) => rule.status === "active").map((rule) => rule.id);
        const created = await api.createPlan({
          title: state.title,
          week_start_date: state.weekStartDate,
          active_rules_json: activeRuleIds,
          plan_json: state.plan,
        });
        dispatch({
          type: "boot",
          rules,
          blocks,
          planId: created.id,
          plan: created.plan_json,
          activeRuleIds: created.active_rules_json,
        });
      } catch (error) {
        dispatch({
          type: "status",
          status: "error",
          notice: "Using local fallback state. Start the Worker to persist changes.",
        });
      } finally {
        setBooted(true);
      }
    }
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRules = useMemo(
    () => state.rules.filter((rule) => state.activeRuleIds.includes(rule.id)),
    [state.rules, state.activeRuleIds],
  );

  async function savePlan(nextPlan = state.plan, nextRuleIds = state.activeRuleIds) {
    if (!state.planId) return;
    const updated = await api.updatePlan(state.planId, {
      title: state.title,
      week_start_date: state.weekStartDate,
      active_rules_json: nextRuleIds,
      plan_json: nextPlan,
    });
    dispatch({
      type: "setPlan",
      plan: updated.plan_json,
      activeRuleIds: updated.active_rules_json,
    });
  }

  async function handleCreateRule(input) {
    dispatch({ type: "status", status: "loading", notice: "Saving rule" });
    try {
      const normalized = await api.normalizeRule(input.text);
      const rule = await api.createRule({
        name: input.name || normalized.name,
        text: input.text,
        severity: input.severity,
        scope: input.scope,
        status: "active",
        tags_json: normalized.tags || [],
        structured_json: normalized.structured || {},
      });
      const block = await api.createBlock({
        type: "rule",
        name: rule.name,
        display_summary: `${rule.severity} - ${rule.scope}`,
        hidden_context: rule.text,
        metadata_json: { rule_id: rule.id, tags: rule.tags_json },
      });
      dispatch({ type: "addRule", rule, block });
      dispatch({ type: "status", status: "idle", notice: "Rule saved" });
    } catch (error) {
      dispatch({ type: "status", status: "error", notice: error.message });
    }
  }

  async function handleToggleRule(ruleId) {
    const nextRuleIds = state.activeRuleIds.includes(ruleId)
      ? state.activeRuleIds.filter((id) => id !== ruleId)
      : [...state.activeRuleIds, ruleId];
    dispatch({ type: "setActiveRules", activeRuleIds: nextRuleIds });
    try {
      await savePlan(state.plan, nextRuleIds);
    } catch (error) {
      dispatch({ type: "status", status: "error", notice: error.message });
    }
  }

  async function handleSuggest(day, slot) {
    dispatch({ type: "selectSlot", selectedSlot: { day, slot } });
    dispatch({ type: "generatedUi", ui: [], warnings: state.warnings });
    dispatch({ type: "status", status: "loading", notice: "Finding meal names" });
    try {
      const response = await api.suggestNames(state.planId, { day, slot });
      dispatch({ type: "generatedUi", ui: response.ui || [], warnings: response.warnings || [] });
      dispatch({ type: "status", status: "loading", notice: "Loading meal details" });
      const meals = (response.ui || []).find((item) => item.component === "meal_cards")?.props?.meals || [];
      await Promise.allSettled(meals.map((meal) => enrichMealDetails({ day, slot, meal })));
      dispatch({ type: "status", status: "idle", notice: "Options ready" });
    } catch (error) {
      dispatch({ type: "status", status: "error", notice: "⚠️" });
    }
  }

  async function enrichMealDetails({ day, slot, meal }) {
    try {
      const response = await api.describeMeal(state.planId, { day, slot, meal });
      dispatch({ type: "updateGeneratedMeal", meal: response.meal });
    } catch (error) {
      dispatch({
        type: "updateGeneratedMeal",
        meal: {
          ...meal,
          description: "⚠️",
          details_status: "error",
        },
      });
    }
  }

  async function handleSelectMeal(meal, target = state.selectedSlot) {
    if (!target) return;
    const nextPlan = {
      ...state.plan,
      [target.day]: {
        ...state.plan[target.day],
        [target.slot]: meal,
      },
    };
    dispatch({ type: "setPlan", plan: nextPlan, activeRuleIds: state.activeRuleIds });
    dispatch({ type: "generatedUi", ui: [], warnings: state.warnings });
    try {
      await savePlan(nextPlan);
    } catch (error) {
      dispatch({ type: "status", status: "error", notice: error.message });
    }
  }

  async function handleCheckRules() {
    dispatch({ type: "status", status: "loading", notice: "Checking rules" });
    try {
      const response = await api.checkRules(state.planId);
      dispatch({ type: "generatedUi", ui: response.ui || [], warnings: response.warnings || [] });
      dispatch({ type: "status", status: "idle", notice: "Rules checked" });
    } catch (error) {
      dispatch({ type: "status", status: "error", notice: error.message });
    }
  }

  function handleAction(action) {
    if (!action) return;
    if (action.type === "select_meal_option") {
      handleSelectMeal(action.payload.meal, {
        day: action.payload.day,
        slot: action.payload.slot,
      });
    }
    if (action.type === "suggest_options") {
      handleSuggest(action.payload.day, action.payload.slot);
    }
    if (action.type === "check_rules") {
      handleCheckRules();
    }
    if (action.type === "accept_warning") {
      dispatch({ type: "acceptWarning", warningId: action.payload.warning_id });
    }
  }

  return (
    <Layout
      title={state.title}
      weekStartDate={state.weekStartDate}
      status={state.status}
      notice={state.notice}
      ready={booted}
      onCheckRules={handleCheckRules}
    >
      <section className="planner-shell">
        <WeekPlannerGrid
          days={DAYS}
          plan={state.plan}
          warnings={state.warnings}
          activeRules={activeRules}
          onSlotClick={handleSuggest}
        />
        <aside className="side-panel">
          <RuleEditor onCreateRule={handleCreateRule} />
          <RuleBlockLibrary
            rules={state.rules}
            blocks={state.blocks}
            activeRuleIds={state.activeRuleIds}
            onToggleRule={handleToggleRule}
          />
          <div className="panel-section">
            <div className="section-heading">
              <span>Guided choices</span>
              <button className="ghost-button" onClick={handleCheckRules}>Check</button>
            </div>
            <InterfaceRenderer ui={state.generatedUi} status={state.status} notice={state.notice} onAction={handleAction} />
          </div>
          <div className="panel-section">
            <div className="section-heading">
              <span>Warnings</span>
              <span className="count-pill">{state.warnings.length}</span>
            </div>
            <div className="stack">
              {state.warnings.length === 0 ? (
                <p className="muted">No open rule conflicts for the current plan.</p>
              ) : (
                state.warnings.map((warning) => (
                  <WarningCard key={warning.id} warning={warning} onAction={handleAction} />
                ))
              )}
            </div>
          </div>
        </aside>
      </section>
    </Layout>
  );
}

const rootElement = document.getElementById("root");
const root = window.__weekMenuPlannerRoot || createRoot(rootElement);
window.__weekMenuPlannerRoot = root;
root.render(<App />);
