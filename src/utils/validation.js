import { DAYS, SLOTS } from "./dates.js";

const dayKeys = new Set(DAYS.map((day) => day.key));
const slotKeys = new Set(SLOTS.map((slot) => slot.key));

export function isValidSlot(day, slot) {
  return dayKeys.has(day) && slotKeys.has(slot);
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}
