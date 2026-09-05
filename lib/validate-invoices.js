// ============================================================================
// validate-invoices.js — contrôles automatiques sur les factures.
//
// POURQUOI. `verify.js` comparait des totaux à des constantes écrites à la main :
// il attrapait une somme fausse, jamais une facture manquante, une échéance absente,
// une séquence trouée ou un statut « payé » sans encaissement. Ces contrôles-là
// portent sur la STRUCTURE, pas sur des montants attendus — ils continuent donc de
// fonctionner quand les données évoluent, ce qu'une constante figée ne fait pas.
//
// Chaque anomalie porte une gravité, une catégorie et un message qui NOMME l'objet
// fautif. Un « all checks passed » global ne dit pas quoi corriger.
// ============================================================================

/** Séries de factures connues, avec le format attendu de leur numéro. */
const SERIES = [
  { prefixe: 'INVRTL', chiffres: 3, libelle: 'RTL' },
  { prefixe: 'AZCS', chiffres: 4, libelle: 'AZCS' },
  { prefixe: 'INZOR', chiffres: 3, libelle: 'ZOR' },
  { prefixe: 'INVSNT', chiffres: 3, libelle: 'SAP/Tax' },
];

function serieDe(ref) {
  for (const s of SERIES) {
    if (typeof ref === 'string' && ref.startsWith(s.prefixe)) return s;
  }
  return null;
}

/** `31/12/2025` → Date. Renvoie null si la chaîne n'est pas une date exploitable. */
function parseFr(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

/** Une facture est-elle marquée encaissée ? */
function estPayee(f) {
  if (f.statut === 'ok') return true;
  const t = String(f.statutText || '');
  return /paid|payé|payee|encaiss/i.test(t);
}

/** Porte-t-elle une trace d'encaissement (date ou montant reçu) ? */
function traceEncaissement(f) {
  if (f.datePaiement) return true;
  if (typeof f.recu === 'number' && f.recu > 0) return true;
  return /paid\s+\d|payé\s+\d|\d{2}\/\d{2}/i.test(String(f.statutText || ''));
}

/**
 * Contrôle un lot de factures d'une même série.
 * @param {Array} factures
 * @param {string} contexte  ex. « augustin2026.rtl » — apparaît dans les messages
 * @param {Array} anomalies  accumulateur
 */
function validerLot(factures, contexte, anomalies) {
  if (!Array.isArray(factures)) return;
  const ajoute = (gravite, categorie, message) => anomalies.push({ gravite, categorie, contexte, message });

  const vues = new Map();          // ref → index
  const numerosParSerie = new Map();

  factures.forEach((f, i) => {
    const ref = f.ref;
    if (!ref || ref === '—') return;   // ligne non facturée : légitime (accrual)

    // ── Doublons ─────────────────────────────────────────────────────────────
    if (vues.has(ref)) {
      ajoute('erreur', 'doublon',
        `la facture ${ref} apparaît deux fois (positions ${vues.get(ref)} et ${i})`);
    } else {
      vues.set(ref, i);
    }

    // ── Format du numéro ─────────────────────────────────────────────────────
    // `INVRTL004+5` note un paiement GROUPÉ : une ligne, deux factures réglées
    // ensemble. C'est une notation légitime du jeu de données — la refuser produisait
    // deux faux positifs (format invalide, puis fausse rupture de séquence).
    const groupe = /^([A-Z]+)(\d+)((?:\+\d+)+)$/.exec(ref);
    const serie = serieDe(ref);
    if (groupe && serie) {
      const base = parseInt(groupe[2], 10);
      const suites = groupe[3].split('+').filter(Boolean).map(Number);
      if (!numerosParSerie.has(serie.prefixe)) numerosParSerie.set(serie.prefixe, []);
      numerosParSerie.get(serie.prefixe).push({ n: base, ref });
      for (const suite of suites) {
        // `004+5` désigne 004 et 005 : on complète les dizaines/centaines depuis la base.
        const n = suite < base ? Number(String(base).slice(0, String(base).length - String(suite).length) + String(suite)) : suite;
        numerosParSerie.get(serie.prefixe).push({ n, ref });
      }
    } else if (!serie) {
      ajoute('avertissement', 'serie-inconnue',
        `${ref} n'appartient à aucune série connue (${SERIES.map(s => s.prefixe).join(', ')})`);
    } else {
      const suffixe = ref.slice(serie.prefixe.length);
      if (!new RegExp('^\\d{' + serie.chiffres + '}$').test(suffixe)) {
        ajoute('erreur', 'format-numero',
          `${ref} : la série ${serie.libelle} attend ${serie.chiffres} chiffres après « ${serie.prefixe} »`);
      } else {
        if (!numerosParSerie.has(serie.prefixe)) numerosParSerie.set(serie.prefixe, []);
        numerosParSerie.get(serie.prefixe).push({ n: parseInt(suffixe, 10), ref });
      }
    }

    // ── Montant ──────────────────────────────────────────────────────────────
    const montant = f.montant != null ? f.montant : f.htEUR;
    if (montant == null) {
      ajoute('erreur', 'montant-absent', `${ref} n'a ni montant ni htEUR`);
    } else if (typeof montant !== 'number' || !isFinite(montant)) {
      ajoute('erreur', 'montant-invalide', `${ref} : montant non numérique (${JSON.stringify(montant)})`);
    } else if (montant <= 0) {
      ajoute('avertissement', 'montant-nul', `${ref} : montant ${montant} — facture à zéro ou négative`);
    }

    // ── Échéance ─────────────────────────────────────────────────────────────
    const dFact = parseFr(f.dateFacture);
    const dDue = parseFr(f.dateDue);
    if (f.dateFacture && !dFact) {
      ajoute('erreur', 'date-illisible', `${ref} : dateFacture « ${f.dateFacture} » n'est pas au format JJ/MM/AAAA`);
    }
    if (f.dateDue && !dDue) {
      ajoute('erreur', 'date-illisible', `${ref} : dateDue « ${f.dateDue} » n'est pas au format JJ/MM/AAAA`);
    }
    if (!f.dateDue) {
      // Non bloquant : les séries anciennes n'en portaient pas. Mais il faut le VOIR,
      // pas le découvrir quand une relance n'est pas partie.
      ajoute('avertissement', 'echeance-absente',
        `${ref} : échéance non renseignée — aucune alerte de retard ne peut être calculée`);
    }
    if (dFact && dDue && dDue < dFact) {
      ajoute('erreur', 'echeance-anterieure',
        `${ref} : échéance ${f.dateDue} antérieure à la date de facture ${f.dateFacture}`);
    }
    if (dFact && dDue) {
      const jours = Math.round((dDue - dFact) / 86400000);
      if (jours > 120) {
        ajoute('avertissement', 'delai-inhabituel',
          `${ref} : ${jours} jours entre facture et échéance — conditions de paiement à vérifier`);
      }
    }

    // ── Statut ↔ encaissement ────────────────────────────────────────────────
    if (estPayee(f) && !traceEncaissement(f)) {
      ajoute('erreur', 'paye-sans-trace',
        `${ref} est marquée payée sans date ni montant d'encaissement — le total encaissé sera sous-évalué`);
    }
    if (!estPayee(f) && traceEncaissement(f)) {
      ajoute('avertissement', 'trace-sans-statut',
        `${ref} porte une trace d'encaissement mais n'est pas marquée payée`);
    }
  });

  // ── Continuité des séquences ───────────────────────────────────────────────
  for (const [prefixe, entrees] of numerosParSerie) {
    const nums = entrees.map(e => e.n).sort((a, b) => a - b);
    for (let i = 1; i < nums.length; i++) {
      const ecart = nums[i] - nums[i - 1];
      if (ecart === 0) continue;               // doublon déjà signalé
      if (ecart > 1) {
        // Le rembourrage doit suivre le FORMAT de la série (INVRTL003), pas la longueur
        // du voisin — sinon le message annonce « INVRTL4 », un numéro qui n'existe pas.
        const largeur = (SERIES.find(x => x.prefixe === prefixe) || {}).chiffres || 3;
        const manquants = [];
        for (let n = nums[i - 1] + 1; n < nums[i]; n++) {
          manquants.push(prefixe + String(n).padStart(largeur, '0'));
        }
        const fmt = (n) => prefixe + String(n).padStart(largeur, '0');
        ajoute('erreur', 'sequence-trouee',
          `séquence ${prefixe} interrompue : ${manquants.join(', ')} ${manquants.length > 1 ? 'manquent' : 'manque'} entre ${fmt(nums[i - 1])} et ${fmt(nums[i])}`);
      }
    }
  }
}

/**
 * Contrôle l'ensemble des factures d'un jeu de données.
 * @returns {{anomalies: Array, erreurs: number, avertissements: number, lots: number}}
 */
function validerFactures(DATA) {
  const anomalies = [];
  let lots = 0;
  const visiter = (obj, chemin) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [cle, val] of Object.entries(obj)) {
      const ici = chemin ? chemin + '.' + cle : cle;
      // Un tableau n'est un lot de FACTURES que si ses lignes portent un montant facturé.
      // Les virements portent aussi une `ref` (celle de la facture réglée) sans être des
      // factures : les valider produisait « AZCS0010 n'a ni montant ni htEUR ».
      const estLotFactures = Array.isArray(val) && val.length > 0
        && val.filter(x => x && typeof x === 'object' && 'ref' in x
             && (x.montant != null || x.htEUR != null)).length >= Math.ceil(val.length / 2);
      if (estLotFactures) {
        validerLot(val, ici, anomalies);
        lots++;
      } else if (val && typeof val === 'object' && !Array.isArray(val)) {
        visiter(val, ici);
      }
    }
  };
  visiter(DATA, '');
  return {
    anomalies,
    lots,
    erreurs: anomalies.filter(a => a.gravite === 'erreur').length,
    avertissements: anomalies.filter(a => a.gravite === 'avertissement').length,
  };
}

module.exports = { validerFactures, validerLot, parseFr, estPayee, traceEncaissement, SERIES };
