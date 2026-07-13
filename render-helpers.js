// ============================================================
// RENDER-HELPERS.JS — Utility functions for formatting and DOM manipulation
//
// SHARED FUNCTIONS:
//   computeBenoitSolde() — Single source of truth for Benoit position
//     Called by render-amine.js (dashboard) AND render-benoit.js (tab).
//     Returns { report25, netPaid26, totalPaye26, solde, paidCount }
//
// FORMATTING:
//   fmtSigned(n, suffix='€')  — "+1 234 €" ou "−1 234 €"
//   fmtPlain(n)               — "1 234" (absolute value, no sign)
//   fmtRate(r)                — "10,500"
//   fmtDelta(d)               — "+0,300" ou "−0,100"
//
// DISPLAY:
//   badge(type, text)         — Status badge HTML
//   nick(name)                — Real name → nickname (Augustin → Augustin)
//   nickText(text)            — Replace all real names in free text
//   collapsible(title, html)  — Collapsible section
//   yearToggle3(section, y)   — Year toggle (Tout/2025/2026)
//
// Pill badge helper (in render-augustin.js):
//   pill(val, type) — Colored inline badge: 'pro'=indigo, 'eur'=emerald, 'mad'=amber
//
// SIGN CONVENTION in reco table:
//   All amounts are ADDITIVE — sum all rows to get the total.
//   + = money received, − = money paid out.
//   Divers: data positive = money to Augustin = display NEGATIVE (negate for display)
// ============================================================

// ---- MODE ----
window.PRIV = false;

// ---- HELPERS ----
const fmtSigned = (n, suffix = '€') => {
  if (n == null) return '—';
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

const badge = (type, text) => `<span class="b ${type}">${text}</span>`;

const sum = (arr, key) => arr.reduce((s, x) => s + (typeof key === 'function' ? key(x) : (x[key] || 0)), 0);

// ---- SHARED: Benoit position calculation ----
// Single source of truth — called by render-amine.js AND render-benoit.js
function computeBenoitSolde() {
  const b25 = DATA.benoit2025;
  const b26 = DATA.benoit2026;
  const rate25 = b25.commissionRate || 0;
  const rate26 = b26.commissionRate || 0;

  // Report 2025: net dû − payé
  const net25 = b25.councils.reduce((s, m) => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    return s + dh - Math.round(dh * rate25);
  }, 0);
  const paye25 = sum(b25.virements, 'dh');
  const report25 = net25 - paye25;

  // 2026: only paid councils count
  const paidCouncils26 = b26.councils.filter(c => c.statut === 'ok');
  const netPaid26 = paidCouncils26.reduce((s, c) => {
    const dh = Math.round(c.htEUR * c.tauxApplique);
    return s + dh - Math.round(dh * rate26);
  }, 0);
  const totalPaye26 = sum(b26.virements, 'dh');
  const solde = report25 + netPaid26 - totalPaye26;

  return { report25, netPaid26, totalPaye26, solde, paidCount: paidCouncils26.length };
}

// ---- SHARED: Bob (Bob) position calculation ----
// Single source of truth — called by render-amine.js (dashboard) AND
// render-bob.js (tab). Two-tier commission (Amine + Augustin), report = 0.
// Guarded: returns zeros when bob2026 is absent (e.g. COUPA/benoit blob).
function computeBobSolde() {
  const b = (typeof DATA !== 'undefined') ? DATA.bob2026 : null;
  if (!b) return { report: 0, netPaid: 0, totalPaye: 0, solde: 0, paidCount: 0,
                   transactions: [], totalDHPaid: 0, totalCommAPaid: 0, totalCommMPaid: 0,
                   totalGainFXPaid: 0, commAugEUR: 0, rA: 0, rM: 0 };
  const rA = b.commissionAmineRate || 0;
  const rM = b.commissionAugustinRate || 0;
  const report = b.report2025 || 0;

  // Per-transaction breakdown (aussi utilisé pour la table de render-bob.js)
  const transactions = (b.councils || []).map(m => {
    const taux = m.tauxApplique || 0;
    const dh = taux ? Math.round(m.htEUR * taux) : 0;
    const delta = m.tauxMarche && taux ? taux - m.tauxMarche : null;
    const gainFX = m.tauxMarche && taux ? Math.round(m.htEUR * (m.tauxMarche - taux)) : (m.tauxMarche ? 0 : null);
    const commA = Math.round(dh * rA);
    const commM = Math.round(dh * rM);
    const netBob = dh - commA - commM;
    return { ...m, dh, delta, gainFX, commA, commM, netBob };
  });
  const paid = transactions.filter(t => t.statut === 'ok');
  const totalDHPaid = sum(paid, 'dh');
  const totalCommAPaid = sum(paid, 'commA');
  const totalCommMPaid = sum(paid, 'commM');   // = commission Augustin (dispatch)
  const totalGainFXPaid = sum(paid, t => t.gainFX || 0);
  const netPaid = sum(paid, 'netBob');
  const totalPaye = sum(b.virements || [], 'dh');
  const solde = report + netPaid - totalPaye;
  // Commission Augustin en EUR (dashboard Amine) : round(Σ htEUR × rM × 100)/100
  const commAugEUR = Math.round(paid.reduce((s, c) => s + c.htEUR * rM, 0) * 100) / 100;

  return { report, netPaid, totalPaye, solde, paidCount: paid.length,
           transactions, totalDHPaid, totalCommAPaid, totalCommMPaid, totalGainFXPaid,
           commAugEUR, rA, rM };
}

// ---- SHARED: Augustin (Augustin) position (paid) ----
// Source unique pour le dashboard (render-amine.js), cohérent avec Benoit/Bob.
// Position AZCS payée : Entreprise = RTL payé − AZCS reçu (Majalis via Benoit)
// − Bridgevale + report ; Net = Entreprise − virements Maroc − divers.
// Même calcul (au caractère près) que le bloc « paid » de render-augustin.js.
function computeAugustinPosition() {
  const az = (typeof DATA !== 'undefined') ? DATA.augustin2026 : null;
  const b26 = (typeof DATA !== 'undefined') ? DATA.benoit2026 : null;
  const PERSO_FACTOR = 0.95;
  if (!az) return { rtlPaidHT: 0, azcsRecuPaid: 0, totalMAD: 0, virementsEUR: 0, bridgevaleEUR: 0,
                    diversPro: 0, diversPerso: 0, posEntreprise: 0, posNetPro: 0, posNetPerso: 0,
                    posNetMAD: 0, PERSO_FACTOR, tauxMaroc: 0, report2025: 0 };
  const rtlPaidHT = sum(az.rtl.filter(r => r.statut === 'ok'), 'montant');
  const azcsAll = (b26 && b26.councils) ? b26.councils : [];
  const azcsRecuPaid = sum(azcsAll.filter(c => c.statut === 'ok'), 'htEUR');
  const totalMAD = sum(az.virementsMaroc, 'dh');
  const virementsEUR = totalMAD / az.tauxMaroc;
  const bridgevaleEUR = sum(az.virementsBridgevale || [], 'eur');
  const diversPerso = az.divers ? az.divers.reduce((s, x) => {
    if (x.proOrigin) return s + Math.round(x.montant * PERSO_FACTOR * 100) / 100;
    return s + x.montant;
  }, 0) : 0;
  const diversPro = az.divers ? az.divers.reduce((s, x) => {
    if (x.proOrigin) return s + x.montant; // montant IS pro
    return s + Math.round(x.montant / PERSO_FACTOR * 100) / 100;
  }, 0) : 0;
  const posEntreprise = rtlPaidHT - azcsRecuPaid - bridgevaleEUR + az.report2025;
  const posNetPro = posEntreprise - virementsEUR - diversPro;
  const posNetPerso = posNetPro * PERSO_FACTOR;
  const posNetMAD = posNetPro * az.tauxMaroc;
  return { rtlPaidHT, azcsRecuPaid, totalMAD, virementsEUR, bridgevaleEUR, diversPro, diversPerso,
           posEntreprise, posNetPro, posNetPerso, posNetMAD, PERSO_FACTOR,
           tauxMaroc: az.tauxMaroc, report2025: az.report2025 };
}

// ---- NICKNAME MAPPING (real → alias) ----
// Règle : on n'affiche JAMAIS les vrais noms, uniquement les alias. La table
// réelle→alias vit dans le BLOB CHIFFRÉ (jamais dans ce fichier servi en clair) ;
// elle est injectée au runtime par applyNick() après déchiffrement. Tant qu'elle
// n'est pas injectée, nick()/nickText() = identité (le site ne rend rien avant
// login de toute façon). Chaque blob ne porte que les alias de son onglet.
window._NICK_MAP = window._NICK_MAP || {};
window._NICK_REPLACE = window._NICK_REPLACE || [];
// Appelé par index.html (tryAccess) avec les données déchiffrées (data._nick).
function applyNick(data) {
  if (data && data._nick) {
    window._NICK_MAP = data._nick.map || {};
    window._NICK_REPLACE = data._nick.replace || [];
  }
}
const nick = (name) => {
  if (!name) return '—';
  return window._NICK_MAP[name.toLowerCase().trim()] || name;
};
const _escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Replace ALL real names in a free-text string (labels, descriptions, etc.)
const nickText = (text) => {
  if (!text) return '';
  return (window._NICK_REPLACE || []).reduce(
    (t, pair) => t.replace(new RegExp('\\b' + _escRe(pair[0]) + '\\b', 'gi'), pair[1]),
    text
  );
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
    const table = document.getElementById('reco-table-' + v);
    const btn = document.getElementById('reco-btn-' + v);
    if (table) table.style.display = v === view ? '' : 'none';
    if (btn) {
      btn.style.background = v === view ? 'var(--accent)' : 'transparent';
      btn.style.color = v === view ? '#fff' : 'var(--muted)';
    }
  });
}

// ---- YEAR TOGGLE HELPER (Tout / 2025 / 2026) ----
function yearToggle3(section, activeYear) {
  return `<div class="year-toggle">
    <div class="year-btn ${!activeYear?'active':''}" data-year="0" onclick="switch${section}Year(0)">Tout</div>
    <div class="year-btn ${activeYear===2025?'active':''}" data-year="2025" onclick="switch${section}Year(2025)">2025</div>
    <div class="year-btn ${activeYear===2026?'active':''}" data-year="2026" onclick="switch${section}Year(2026)">2026</div>
  </div>`;
}
