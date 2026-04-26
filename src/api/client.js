const API_BASE = "";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }

  return data;
}

export const api = {
  getRules: () => request("/api/rules"),
  createRule: (payload) =>
    request("/api/rules", { method: "POST", body: JSON.stringify(payload) }),
  normalizeRule: (text) =>
    request("/api/rules/normalize", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  getBlocks: () => request("/api/blocks"),
  createBlock: (payload) =>
    request("/api/blocks", { method: "POST", body: JSON.stringify(payload) }),
  createPlan: (payload) =>
    request("/api/plans", { method: "POST", body: JSON.stringify(payload) }),
  updatePlan: (id, payload) =>
    request(`/api/plans/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  suggestOptions: (id, payload) =>
    request(`/api/plans/${id}/suggest-options`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  checkRules: (id) => request(`/api/plans/${id}/check-rules`, { method: "POST" }),
};
