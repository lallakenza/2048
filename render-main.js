// ============================================================
// RENDER-MAIN.JS — Main rendering orchestration + dynamic tab system
// ============================================================

// ---- TAB CONFIGURATION (single source of truth) ----
const TAB_CONFIG = [
  { id: 'augustin', label: 'Azarkan', access: 'full' },
  { id: 'benoit',   label: 'Badre',   access: 'all' },
  { id: 'fxp2p',    label: 'FX P2P',   access: 'priv' },
  { id: 'gains',    label: 'Mes Gains', access: 'priv' },
];

// ---- Render a single panel by id ----
function renderPanel(id) {
  const el = document.getElementById(id);
  if (!el) return;
  switch (id) {
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
    case 'fxp2p':
      el.innerHTML = renderFXP2P();
      break;
    case 'gains':
      el.innerHTML = renderMesGains();
      break;
  }
}

// ---- Render all visible panels ----
function renderAll() {
  TAB_CONFIG.forEach(t => renderPanel(t.id));
}

// ---- Build tabs + panels from TAB_CONFIG ----
function buildTabs() {
  const mode = window.ACCESS_MODE; // 'full' or 'benoit'
  const priv = window.PRIV;

  const tabBar = document.getElementById('tabBar');
  const content = document.getElementById('content');
  if (!tabBar || !content) return;

  tabBar.innerHTML = '';
  content.innerHTML = '';

  let firstVisible = null;

  TAB_CONFIG.forEach(t => {
    // Visibility rules
    const visible =
      t.access === 'all' ||
      (t.access === 'full' && mode === 'full') ||
      (t.access === 'priv' && priv);

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
  const mode = window.ACCESS_MODE;
  const priv = window.PRIV;
  TAB_CONFIG.forEach(t => {
    const visible =
      t.access === 'all' ||
      (t.access === 'full' && mode === 'full') ||
      (t.access === 'priv' && priv);
    const tab = document.querySelector(`.tab[data-tab="${t.id}"]`);
    if (tab) tab.style.display = visible ? '' : 'none';
  });
}
