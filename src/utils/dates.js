// Utilitários de data trabalhando com strings "YYYY-MM-DD" no fuso local do servidor.

const pad = (n) => String(n).padStart(2, '0');

function toDateKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function today() {
  return toDateKey(new Date());
}

function parseDateKey(key) {
  if (!isDateKey(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1) return null; // ex.: 2026-02-31
  return date;
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(key, days) {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

function addMonths(key, months) {
  const d = parseDateKey(key);
  d.setMonth(d.getMonth() + months);
  return toDateKey(d);
}

function daysBetween(startKey, endKey) {
  const ms = parseDateKey(endKey) - parseDateKey(startKey);
  return Math.round(ms / 86400000);
}

function eachDay(startKey, endKey) {
  const days = [];
  for (let k = startKey; k <= endKey; k = addDays(k, 1)) days.push(k);
  return days;
}

function dayOfWeek(key) {
  return parseDateKey(key).getDay(); // 0 = domingo
}

function dayOfMonth(key) {
  return parseDateKey(key).getDate();
}

function monthKey(key) {
  return key.slice(0, 7);
}

module.exports = {
  toDateKey,
  today,
  parseDateKey,
  isDateKey,
  addDays,
  addMonths,
  daysBetween,
  eachDay,
  dayOfWeek,
  dayOfMonth,
  monthKey,
};
