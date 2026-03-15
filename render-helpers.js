// ============================================================
// RENDER-HELPERS.JS — Utility functions for formatting and DOM manipulation
// ============================================================

// ---- MODE ----
window.PRIV = false;

// ---- HELPERS ----
const fmt = (n, suffix = '€') => {
  if (n === 0 || n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('fr-FR');
  const sign = n < 0 ? '−' : (n > 0 ? '+' : '');
  // For amounts, show sign only when explicitly needed
  return formatted + (suffix ? ' ' + suffix : '');
};

const fmtSigned = (n, suffix = '€') => {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('fr-FR');
  const sign = n < 0 ? '−' : '+';
  return sign + formatted + (suffix ? ' ' + suffix : '');
};

const fmtPlain = (n) => {
  if (n === 0 || n === null || n === undefined) return '—';
  return Math.abs(n).toLocaleString('fr-FR');
};

const fmtRate = (r) => {
  if (!r) return '—';
  return r.toFixed(3).replace('.', ',');
};

const fmtDelta = (d) => {
  if (d === null || d === undefined) return '—';
  const sign = d < 0 ? '−' : '+';
  return sign + Math.abs(d).toFixed(3).replace('.', ',');
};

const colorForSolde = (n) => n > 0 ? 'var(--green)' : n < 0 ? 'var(--red)' : 'var(--green)';
const classForSolde = (n) => n > 0 ? 'green' : n < 0 ? 'red' : 'green';

const badge = (type, text) => `<span class="b ${type}">${text}</span>`;

const sum = (arr, key) => arr.reduce((s, x) => s + (typeof key === 'function' ? key(x) : (x[key] || 0)), 0);

// ---- YEAR TOGGLE HELPER ----
function yearToggle(section, activeYear) {
  return `<div class="year-toggle">
    <div class="year-btn ${activeYear===2025?'active':''}" data-year="2025" onclick="switch${section}Year(2025)">2025</div>
    <div class="year-btn ${activeYear===2026?'active':''}" data-year="2026" onclick="switch${section}Year(2026)">2026</div>
  </div>`;
}
function yearToggle3(section, activeYear) {
  return `<div class="year-toggle">
    <div class="year-btn ${!activeYear?'active':''}" data-year="0" onclick="switch${section}Year(0)">Tout</div>
    <div class="year-btn ${activeYear===2025?'active':''}" data-year="2025" onclick="switch${section}Year(2025)">2025</div>
    <div class="year-btn ${activeYear===2026?'active':''}" data-year="2026" onclick="switch${section}Year(2026)">2026</div>
  </div>`;
}
