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

/**
 * Développe une référence en la LISTE des numéros qu'elle couvre.
 * `INVRTL017` → [17] · `INVRTL004+5` → [4, 5] · `INVRTL010+11` → [10, 11]
 */
function numerosDe(ref, serie) {
  const groupe = /^([A-Z]+)(\d+)((?:\+\d+)+)$/.exec(ref);
  if (groupe) {
    const base = parseInt(groupe[2], 10);
    const out = [base];
    for (const suite of groupe[3].split('+').filter(Boolean).map(Number)) {
      // `004+5` désigne 004 et 005 : compléter les dizaines depuis la base.
      out.push(suite < base
        ? Number(String(base).slice(0, String(base).length - String(suite).length) + String(suite))
        : suite);
    }
    return out;
  }
  const suffixe = ref.slice(serie.prefixe.length);
  return /^\d+$/.test(suffixe) ? [parseInt(suffixe, 10)] : [];
}

/** Vocabulaire fermé des statuts de règlement. */
const STATUTS_REGLEMENT = ['paye', 'paye_non_verifie', 'inconnu', 'en_attente'];

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

    // ── Preuve de règlement STRUCTURÉE ───────────────────────────────────────
    // Un « Paid » dans un libellé n'est pas une preuve : on exige un objet
    // `reglement` avec statut, date, montant et référence de pièce. Quand la preuve
    // est incomplète on l'assume (`paye_non_verifie` / `inconnu`) plutôt que
    // d'inventer une date — un trou déclaré vaut mieux qu'un trou masqué.
    if (estPayee(f)) {
      const r = f.reglement;
      if (!r || typeof r !== 'object') {
        ajoute('erreur', 'paye-sans-preuve',
          `${ref} est marquée payée sans bloc « reglement » — statut, date, montant et pièce sont obligatoires`);
      } else if (!STATUTS_REGLEMENT.includes(r.statut)) {
        ajoute('erreur', 'reglement-statut-inconnu',
          `${ref} : statut de règlement « ${r.statut} » hors du vocabulaire (${STATUTS_REGLEMENT.join(', ')})`);
      } else if (r.statut === 'paye') {
        const manque = [];
        if (!r.date) manque.push('date');
        if (typeof r.montant !== 'number') manque.push('montant');
        if (!r.preuve) manque.push('preuve');
        if (manque.length) {
          ajoute('erreur', 'paye-sans-preuve',
            `${ref} est « paye » mais il manque ${manque.join(', ')} — utilise « paye_non_verifie » tant que la pièce n'est pas là`);
        }
      } else if (r.statut === 'paye_non_verifie') {
        if (!r.preuve) {
          ajoute('erreur', 'paye-sans-preuve',
            `${ref} est « paye_non_verifie » sans aucune référence de pièce — au minimum, dire où chercher`);
        } else {
          ajoute('avertissement', 'preuve-incomplete',
            `${ref} : encaissement assumé non vérifié — ${r.preuve}`);
        }
      } else if (r.statut === 'inconnu') {
        ajoute('avertissement', 'preuve-inconnue', `${ref} : encaissement non tracé`);
      }
    }
    if (!estPayee(f) && traceEncaissement(f)) {
      ajoute('avertissement', 'trace-sans-statut',
        `${ref} porte une trace d'encaissement mais n'est pas marquée payée`);
    }
  });
}

/**
 * Continuité des séquences, à l'échelle de l'ÉMETTEUR et non de la relation.
 *
 * POURQUOI. La séquence était vérifiée tableau par tableau. Or un émetteur numérote
 * en continu pour TOUS ses clients : AZ Consulting facture Majalis (AZCS0011) et
 * Bridgevale (AZCS0010, AZCS0012) sur la même suite. Vérifier `benoit2026.councils`
 * isolément faisait donc apparaître AZCS0010 comme « manquante » alors qu'elle est
 * simplement rangée ailleurs — dans `augustin2026.virementsBridgevale`.
 *
 * On collecte donc les références sur TOUT le jeu de données, d'où qu'elles viennent,
 * avant de juger de la continuité.
 */
function validerSequences(DATA, anomalies) {
  const parPrefixe = new Map();   // prefixe → Map(numero → Set(chemins))
  const visiter = (o, chemin) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach((x, i) => visiter(x, chemin + '[' + i + ']')); return; }
    if (typeof o.ref === 'string') {
      const serie = serieDe(o.ref);
      if (serie) {
        // Une référence peut couvrir PLUSIEURS numéros (`INVRTL004+5` = 004 et 005) :
        // c'est une facture groupée, pas un trou. Il faut donc développer la notation
        // avant de juger la continuité, sinon on invente deux ruptures.
        for (const n of numerosDe(o.ref, serie)) {
          if (!parPrefixe.has(serie.prefixe)) parPrefixe.set(serie.prefixe, new Map());
          const m = parPrefixe.get(serie.prefixe);
          if (!m.has(n)) m.set(n, new Set());
          m.get(n).add(chemin);
        }
      }
    }
    for (const [cle, val] of Object.entries(o)) {
      if (val && typeof val === 'object') visiter(val, chemin ? chemin + '.' + cle : cle);
    }
  };
  visiter(DATA, '');

  for (const [prefixe, m] of parPrefixe) {
    const largeur = (SERIES.find(x => x.prefixe === prefixe) || {}).chiffres || 3;
    const fmt = (n) => prefixe + String(n).padStart(largeur, '0');
    const nums = [...m.keys()].sort((a, b) => a - b);
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] <= 1) continue;
      const manquants = [];
      for (let n = nums[i - 1] + 1; n < nums[i]; n++) manquants.push(fmt(n));
      anomalies.push({
        gravite: 'erreur', categorie: 'sequence-trouee', contexte: 'série ' + prefixe,
        message: `séquence ${prefixe} interrompue (périmètre émetteur) : ${manquants.join(', ')} ${manquants.length > 1 ? 'manquent' : 'manque'} entre ${fmt(nums[i - 1])} et ${fmt(nums[i])}`,
      });
    }
  }
  return parPrefixe;
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
  // Séquences : périmètre ÉMETTEUR, après la collecte des lots (cf. validerSequences).
  validerSequences(DATA, anomalies);
  return {
    anomalies,
    lots,
    erreurs: anomalies.filter(a => a.gravite === 'erreur').length,
    avertissements: anomalies.filter(a => a.gravite === 'avertissement').length,
  };
}

module.exports = { validerFactures, validerLot, validerSequences, parseFr, estPayee, traceEncaissement, SERIES, STATUTS_REGLEMENT };
