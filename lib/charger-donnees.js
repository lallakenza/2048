// ============================================================================
// charger-donnees.js — charge la source hors dépôt et applique l'overlay PRIV,
// pour que Node voie EXACTEMENT le même objet DATA que le navigateur.
//
// POURQUOI. Les fonctions de position vivent dans render-helpers.js, écrit pour le
// navigateur : elles lisent les globals `DATA`/`PRIV` et le fichier touche `document`
// au chargement. Plutôt que de réécrire ces calculs côté Node — ce qui créerait deux
// implémentations vouées à diverger — on pose les mêmes globals et quelques bouchons
// DOM inertes, puis on réutilise les fonctions telles quelles.
// ============================================================================
const path = require('path');
const os = require('os');

function bouchonsDOM() {
  if (typeof global.window === 'undefined') global.window = {};
  if (typeof global.document === 'undefined') {
    const noop = () => {};
    global.document = {
      addEventListener: noop, removeEventListener: noop,
      querySelectorAll: () => [], querySelector: () => null, getElementById: () => null,
      createElement: () => ({ style: {}, classList: { add: noop, remove: noop }, appendChild: noop }),
      body: { appendChild: noop },
    };
  }
  if (typeof global.localStorage === 'undefined') {
    global.localStorage = { getItem: () => null, setItem: noopSafe, removeItem: noopSafe };
  }
}
function noopSafe() {}

/** Réplique d'injectPrivData (index.html) : l'overlay est indexé PAR POSITION. */
function appliquerPriv(FULL, PRIV) {
  if (!PRIV) return FULL;
  if (PRIV.benoit2025 && FULL.benoit2025) {
    FULL.benoit2025.commissionRate = PRIV.benoit2025.commissionRate;
    (PRIV.benoit2025.councilsTaux || []).forEach((t, i) => {
      if (FULL.benoit2025.councils[i]) FULL.benoit2025.councils[i].tauxMarche = t.tauxMarche;
    });
  }
  if (PRIV.benoit2026 && FULL.benoit2026) {
    FULL.benoit2026.tauxApplique = PRIV.benoit2026.tauxApplique;
    FULL.benoit2026.commissionRate = PRIV.benoit2026.commissionRate;
    (PRIV.benoit2026.councilsTauxMarche || []).forEach((t, i) => {
      if (FULL.benoit2026.councils[i]) FULL.benoit2026.councils[i].tauxMarche = t.tauxMarche;
    });
  }
  if (PRIV.bob2026 && FULL.bob2026) {
    if (PRIV.bob2026.commissionAmineRate != null) FULL.bob2026.commissionAmineRate = PRIV.bob2026.commissionAmineRate;
    if (PRIV.bob2026.commissionAugustinRate != null) FULL.bob2026.commissionAugustinRate = PRIV.bob2026.commissionAugustinRate;
    (PRIV.bob2026.councilsTauxMarche || []).forEach((t, i) => {
      if (FULL.bob2026.councils[i]) FULL.bob2026.councils[i].tauxMarche = t.tauxMarche;
    });
  }
  FULL.fxP2P = PRIV.fxP2P;
  FULL._ycarreCommission = PRIV.ycarreCommission;
  FULL._ycarreTotal = PRIV.ycarreTotal;
  return FULL;
}

/** @returns {{DATA, PRIV, helpers}} — globals posés, helpers prêts à l'emploi. */
function charger(chemin) {
  const SOURCE = chemin || process.env.FACT_DATA_SOURCE
    || path.join(os.homedir(), 'facturation-data', 'source.js');
  const src = require(SOURCE);
  bouchonsDOM();
  const DATA = appliquerPriv(src.FULL_DATA, src.PRIV_DATA);
  global.DATA = DATA;
  global.PRIV = src.PRIV_DATA;
  const helpers = require(path.join(__dirname, '..', 'render-helpers.js'));
  return { DATA, PRIV: src.PRIV_DATA, helpers, source: src };
}

module.exports = { charger, appliquerPriv, bouchonsDOM };
