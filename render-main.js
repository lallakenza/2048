// ============================================================
// RENDER-MAIN.JS — Main rendering orchestration function
// ============================================================

function renderAll() {
  const azY = window.azYear || 2026;
  const baY = window.baYear || 2026;
  document.getElementById('augustin').innerHTML = azY === 0 ? renderAugustinAll() : (azY === 2025) ? renderAugustin2025() : renderAugustin2026();
  document.getElementById('benoit').innerHTML = baY === 0 ? renderBenoitAll() : (baY === 2025) ? renderBenoit2025() : renderBenoit2026();
  document.getElementById('fxp2p').innerHTML = renderFXP2P();
  document.getElementById('gains').innerHTML = renderMesGains();
}

// renderAll() is called after gate validation in index.html
