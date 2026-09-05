// ============================================================================
// data-freshness.js — date de la dernière opération FINANCIÈRE.
//
// POURQUOI. Le badge du site affichait une seule date, `APP_VERSION_DATE`, bumpée à
// chaque déploiement. Or le cron P2P et `data-history.enc.js` déclenchent des
// déploiements sans qu'aucune donnée financière n'ait bougé : le badge rajeunissait
// tout seul, et le site paraissait à jour alors qu'il était arrêté au 27 août avec des
// opérations de septembre non saisies.
//
// La date est donc DÉRIVÉE des données : c'est la plus récente date de facture, de
// paiement ou de virement effectivement présente. Une date dérivée ne peut pas mentir
// sur ce qu'elle décrit — elle n'avance que si une opération avance.
// ============================================================================

/** Champs susceptibles de porter une date d'opération. */
const CHAMPS_DATE = ['dateFacture', 'datePaiement', 'dateDue', 'date', 'dateVirement'];

/** `31/12/2025` ou `2025-12-31` → `2025-12-31`. null si illisible. */
function normaliser(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return s;
  return null;
}

/**
 * Parcourt les données et renvoie la dernière date d'opération trouvée.
 * @returns {{date: string|null, source: string|null, nombre: number}}
 */
function derniereOperation(DATA) {
  let max = null, source = null, nombre = 0;
  const visiter = (o, chemin) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach((x, i) => visiter(x, chemin + '[' + i + ']')); return; }
    for (const [cle, val] of Object.entries(o)) {
      const ici = chemin ? chemin + '.' + cle : cle;
      if (CHAMPS_DATE.includes(cle)) {
        const d = normaliser(val);
        if (d) {
          nombre++;
          // `dateDue` est une échéance FUTURE : elle ne témoigne pas d'une saisie.
          if (cle !== 'dateDue' && (!max || d > max)) { max = d; source = ici; }
        }
      } else if (val && typeof val === 'object') {
        visiter(val, ici);
      }
    }
  };
  visiter(DATA, '');
  return { date: max, source, nombre };
}

/** Nombre de jours entre la dernière opération et aujourd'hui. */
function ancienneteJours(DATA, maintenant) {
  const { date } = derniereOperation(DATA);
  if (!date) return null;
  const d = new Date(date + 'T00:00:00');
  const n = maintenant || new Date();
  return Math.floor((n - d) / 86400000);
}

module.exports = { derniereOperation, ancienneteJours, normaliser };
