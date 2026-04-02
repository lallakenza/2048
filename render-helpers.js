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

// ---- NICKNAME MAPPING (noms réels → nicknames) ----
// Règle : on n'affiche JAMAIS les vrais noms sur le site, uniquement les nicknames
const NICK_MAP = {
  'jean augustin':          'Augustin',
  'mohammed azarkan':       'Augustin',
  'azarkan':                'Augustin',
  'benoit chevalier':       'Benoit',
  'badrecheikh elmouksit':  'Benoit',
  'badre':                  'Benoit',
  'amine koraibi':          'Amine',
  'nezha':                  'Nezha',
  'hanane':                 'Hanane',
};
const nick = (name) => {
  if (!name) return '—';
  const key = name.toLowerCase().trim();
  return NICK_MAP[key] || name;
};
// Replace ALL real names in a free-text string (labels, descriptions, etc.)
const NICK_REPLACE = [
  [/\bAzarkan\b/gi, 'Augustin'], [/\bMohammed Azarkan\b/gi, 'Augustin'],
  [/\bBadre\b/gi, 'Benoit'], [/\bBadrecheikh\b/gi, 'Benoit'],
  [/\bBadrecheikh Elmouksit\b/gi, 'Benoit'],
  [/\bKoraibi\b/gi, 'Amine'],
];
const nickText = (text) => {
  if (!text) return '';
  return NICK_REPLACE.reduce((t, [re, nick]) => t.replace(re, nick), text);
};

// ---- SORTABLE TABLE SUPPORT ----
(function() {
  const MOIS_FR = {'janvier':0,'février':1,'mars':2,'avril':3,'mai':4,'juin':5,
    'juillet':6,'août':7,'septembre':8,'octobre':9,'novembre':10,'décembre':11};

  function parseNum(s) {
    if (!s || s === '—') return 0;
    // Strip spaces, currency, signs → keep digits, minus, comma, dot
    let c = s.replace(/\s/g,'').replace('−','-').replace(',','.');
    c = c.replace(/[^0-9.\-]/g,'');
    return parseFloat(c) || 0;
  }

  function parseDate(s) {
    if (!s || s === '—') return 0;
    s = s.trim();
    // ISO: 2025-03-15
    if (/^\d{4}-\d{2}/.test(s)) return new Date(s).getTime();
    // DD/MM/YYYY
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return new Date(+m[3],+m[2]-1,+m[1]).getTime();
    // DD/MM
    m = s.match(/^(\d{2})\/(\d{2})$/);
    if (m) return new Date(2025,+m[2]-1,+m[1]).getTime();
    // Month name (French), optionally with year: "Février", "Janvier 2026"
    const lower = s.toLowerCase();
    for (const [name, idx] of Object.entries(MOIS_FR)) {
      if (lower.startsWith(name)) {
        const ym = s.match(/\d{4}/);
        return new Date(ym ? +ym[0] : 2025, idx, 1).getTime();
      }
    }
    return 0;
  }

  document.addEventListener('click', function(e) {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;
    const table = th.closest('table');
    const tbody = table && table.querySelector('tbody');
    if (!tbody) return;

    const headers = Array.from(th.closest('tr').children);
    const colIdx = headers.indexOf(th);
    const type = th.dataset.sort; // 'date' or 'num'
    const curDir = th.dataset.dir || '';
    const newDir = curDir === 'asc' ? 'desc' : 'asc';

    // Reset sibling headers
    headers.forEach(h => { delete h.dataset.dir; h.classList.remove('sort-asc','sort-desc'); });
    th.dataset.dir = newDir;
    th.classList.add('sort-' + newDir);

    // Separate data rows vs total/separator rows
    const allRows = Array.from(tbody.children);
    const dataRows = allRows.filter(r => !r.classList.contains('tr') && !r.querySelector('td[colspan]'));
    const otherRows = allRows.filter(r => r.classList.contains('tr') || r.querySelector('td[colspan]'));

    const parser = type === 'date' ? parseDate : parseNum;
    dataRows.sort((a, b) => {
      const va = parser((a.children[colIdx] || {}).textContent || '');
      const vb = parser((b.children[colIdx] || {}).textContent || '');
      return newDir === 'asc' ? va - vb : vb - va;
    });

    // Rebuild: data rows first, then total/separator rows
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    dataRows.forEach(r => tbody.appendChild(r));
    otherRows.forEach(r => tbody.appendChild(r));
  });
})();

// ---- COLLAPSIBLE SECTION HELPER ----
function collapsible(title, contentHtml, opts = {}) {
  const id = 'coll-' + Math.random().toString(36).substr(2, 6);
  const openByDefault = opts.open || false;
  const cls = openByDefault ? 'open' : '';
  return `<div class="s">
    <div class="st section-toggle ${cls}" onclick="toggleSection('${id}',this)"><span>${title}</span></div>
    <div class="section-body ${cls}" id="${id}">${contentHtml}</div>
  </div>`;
}

function toggleSection(id, btn) {
  const body = document.getElementById(id);
  if (!body) return;
  body.classList.toggle('open');
  btn.classList.toggle('open');
}

// ---- RECO VIEW TOGGLE (Paid / Invoiced / Accrued) ----
function switchRecoView(view) {
  ['paid','invoiced','accrued'].forEach(v => {
    const cards = document.getElementById('reco-cards-' + v);
    const table = document.getElementById('reco-table-' + v);
    const btn = document.getElementById('reco-btn-' + v);
    if (cards) cards.style.display = v === view ? '' : 'none';
    if (table) table.style.display = v === view ? '' : 'none';
    if (btn) {
      btn.style.background = v === view ? 'var(--accent)' : 'transparent';
      btn.style.color = v === view ? '#fff' : 'var(--muted)';
    }
  });
}

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
