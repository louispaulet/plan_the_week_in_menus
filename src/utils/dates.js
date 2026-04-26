export const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

export const SLOTS = [
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

export function nextMonday(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 1 ? 0 : (8 - day) % 7 || 7;
  next.setDate(next.getDate() + diff);
  return next.toISOString().slice(0, 10);
}
