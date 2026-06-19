// ============================================================
// RENDER-MAIN.JS — Main rendering orchestration + dynamic tab system
// ============================================================

// ---- TAB CONFIGURATION (single source of truth) ----
// access: 'full' → visible en mode full (TIGRE/BINGA). 'priv' → BINGA only.
// soloMode: si présent, le tab est AUSSI visible quand ACCESS_MODE === soloMode
//   (porte dédiée d'un tiers). Garantit l'isolement : COUPA (benoit) ne voit
//   que Benoit, EPONGE (bob) ne voit que Bob — jamais les deux.
const TAB_CONFIG = [
  { id: 'amine',    label: 'Ma Position', access: 'full' },
  { id: 'augustin', label: 'Augustin', access: 'full' },
  { id: 'benoit',   label: 'Benoit',   access: 'full', soloMode: 'benoit' },
  { id: 'bob',      label: 'Bob',      access: 'full', soloMode: 'bob' },
  { id: 'radar',    label: 'Radar USDT', access: 'priv' },
  { id: 'fxp2p',    label: 'FX P2P',   access: 'priv' },
  { id: 'gains',    label: 'Mes Gains', access: 'priv' },
];

// ---- Render a single panel by id ----
function renderPanel(id) {
  const el = document.getElementById(id);
  if (!el) return;
  switch (id) {
    case 'amine':
      el.innerHTML = renderAmine();
      break;
    case 'augustin': {
      const y = window.azYear || 2026;
      el.innerHTML = y === 0 ? renderAugustinAll() : y === 2025 ? renderAugustin2025() : renderAugustin2026();
      break;
    }
    case 'benoit': {
      const y = window.baYear || 2026;
      el.innerHTML = y === 0 ? renderBenoitAll() : y === 2025 ? renderBenoit2025() : renderBenoit2026();
      break;
    }
    case 'bob':
      el.innerHTML = renderBob();
      break;
    case 'radar':
      el.innerHTML = renderRadar();
      break;
    case 'fxp2p':
      el.innerHTML = renderFXP2P();
      break;
    case 'gains':
      el.innerHTML = renderMesGains();
      break;
  }
}

// ---- Visibility: single source of truth ----
// Honors window.RADAR_ONLY (set when the user typed BINANCE) to restrict
// the UI to the Radar tab only. Standard access-level rules otherwise.
function isTabVisible(t) {
  if (window.RADAR_ONLY) return t.id === 'radar';
  const mode = window.ACCESS_MODE;
  const priv = window.PRIV;
  // Priv tabs (Radar / FX / Gains) need BINGA.
  if (t.access === 'priv') return !!priv;
  // Full mode (TIGRE / BINGA) sees every 'full' tab — incl. counterparty tabs.
  if (mode === 'full') return t.access === 'full';
  // Counterparty solo modes (COUPA → benoit, EPONGE → bob) see ONLY their tab.
  return !!(t.soloMode && mode === t.soloMode);
}

// ---- Render all visible panels (skip hidden ones to avoid missing-data crashes) ----
function renderAll() {
  TAB_CONFIG.forEach(t => {
    if (isTabVisible(t)) renderPanel(t.id);
  });
}

// ---- Build tabs + panels from TAB_CONFIG ----
function buildTabs() {
  const tabBar = document.getElementById('tabBar');
  const content = document.getElementById('content');
  if (!tabBar || !content) return;

  tabBar.innerHTML = '';
  content.innerHTML = '';

  let firstVisible = null;

  TAB_CONFIG.forEach(t => {
    const visible = isTabVisible(t);

    // Create tab button
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.textContent = t.label;
    tab.dataset.tab = t.id;
    tab.style.display = visible ? '' : 'none';
    tab.onclick = function() { showTab(t.id); };
    tabBar.appendChild(tab);

    // Create panel
    let panel = document.getElementById(t.id);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = t.id;
      panel.className = 'panel';
      content.appendChild(panel);
    }

    if (visible && !firstVisible) firstVisible = t.id;
  });

  // Activate first visible tab
  if (firstVisible) showTab(firstVisible);
}

// ---- Tab switching ----
function showTab(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById(id);
  const tab = document.querySelector(`.tab[data-tab="${id}"]`);
  if (panel) panel.classList.add('active');
  if (tab) tab.classList.add('active');
}

// ---- Refresh tab visibility (called when PRIV changes) ----
function refreshTabVisibility() {
  TAB_CONFIG.forEach(t => {
    const tab = document.querySelector(`.tab[data-tab="${t.id}"]`);
    if (tab) tab.style.display = isTabVisible(t) ? '' : 'none';
  });
}
