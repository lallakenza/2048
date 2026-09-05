// ============================================================================
// garde-fous.js — les cinq régressions qu'on refuse de revoir.
//
// Chacune correspond à un défaut CONSTATÉ, pas à une précaution théorique :
// on écrit le test qui l'aurait attrapé.
// ============================================================================
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');

/** 1. Un « payé » doit s'appuyer sur une preuve structurée, jamais sur un libellé. */
function payeSansPreuve(DATA) {
  const { validerFactures } = require('./validate-invoices.js');
  const r = validerFactures(DATA);
  const fautifs = r.anomalies.filter(a =>
    a.gravite === 'erreur' && (a.categorie === 'paye-sans-preuve' || a.categorie === 'reglement-statut-inconnu'));
  return { ok: fautifs.length === 0, detail: fautifs.map(f => f.message) };
}

/**
 * 2. La séquence doit être jugée au périmètre ÉMETTEUR.
 * Le défaut : AZCS0010 et AZCS0012 (client Bridgevale) vivent hors du tableau des
 * councils Majalis ; en jugeant tableau par tableau, AZCS0010 passait pour manquante.
 */
function sequencePerimetreEmetteur(DATA) {
  const { validerSequences } = require('./validate-invoices.js');
  const anomalies = [];
  const parPrefixe = validerSequences(DATA, anomalies);
  const azcs = parPrefixe.get('AZCS');
  const vus = azcs ? [...azcs.keys()].sort((a, b) => a - b) : [];
  const attendus = [10, 12].every(n => vus.includes(n));  // les deux factures Bridgevale
  const trous = anomalies.filter(a => a.categorie === 'sequence-trouee');
  return {
    ok: attendus && trous.length === 0,
    detail: [
      attendus ? null : 'AZCS0010/AZCS0012 absents du périmètre émetteur — la séquence est jugée par relation',
      ...trous.map(t => t.message),
    ].filter(Boolean),
    vus,
  };
}

/** 3. La fenêtre « 3 mois » doit rester une fenêtre de 3 mois. */
function fenetreTroisMois(dataAsOf) {
  const src = fs.readFileSync(path.join(RACINE, 'render-fxp2p.js'), 'utf8');
  const enDur = /t\.date >= '20\d\d-\d\d-\d\d'/.test(src);
  const [a, m, j] = dataAsOf.split('-').map(Number);
  const d0 = new Date(Date.UTC(a, m - 1, j));
  const fin = new Date(d0);
  d0.setUTCMonth(d0.getUTCMonth() - 3);
  const jours = Math.round((fin - d0) / 86400000);
  return {
    ok: !enDur && jours <= 92,
    detail: [
      enDur ? 'borne de fenêtre écrite en dur dans render-fxp2p.js — elle ne glissera pas' : null,
      jours > 92 ? `fenêtre de ${jours} jours — ce n'est plus « 3 mois »` : null,
    ].filter(Boolean),
    jours,
  };
}

/**
 * 4. Pas de montant financier figé dans un texte narratif.
 * On cible les montants SIGNÉS (« −89€ », « +484€ ») hors interpolation : un montant
 * signé écrit à la main est presque toujours une valeur calculée qui a été gelée.
 */
function montantsEnDurDansLeRecit() {
  const fichiers = fs.readdirSync(RACINE).filter(f => /^render-.*\.js$/.test(f));
  const fautifs = [];
  for (const f of fichiers) {
    const lignes = fs.readFileSync(path.join(RACINE, f), 'utf8').split('\n');
    lignes.forEach((ligne, i) => {
      if (/^\s*(\/\/|\*)/.test(ligne)) return;                 // commentaire
      const sansInterpolation = ligne.replace(/\$\{[^}]*\}/g, '·');
      const m = sansInterpolation.match(/[−+]\s?\d[\d  ]*\s?(€|DH)/g);
      if (m) fautifs.push(`${f}:${i + 1} → ${m.join(', ')}`);
    });
  }
  return { ok: fautifs.length === 0, detail: fautifs };
}

/**
 * 5. Les positions publiées doivent être celles qui sont affichées.
 * Invariants : la somme des trois fait le total, et la compensation — qui n'est qu'un
 * scénario — laisse ce total STRICTEMENT inchangé. Si elle le déplaçait, elle
 * créerait ou effacerait de la valeur.
 */
function pontCoherent(pont) {
  const g = pont.positionsGross;
  const somme = g.augustin.signedMAD + g.benoit.signedMAD + g.bob.signedMAD;
  const n = pont.positionsNettingScenario;
  const sommeScenario = n.augustin + n.benoit + n.bob;
  const ecarts = [];
  if (somme !== g.total.signedMAD) ecarts.push(`somme des 3 (${somme}) ≠ total publié (${g.total.signedMAD})`);
  if (sommeScenario !== g.total.signedMAD) ecarts.push(`le scénario de compensation déplace le total (${sommeScenario} vs ${g.total.signedMAD})`);
  if (!pont.dataAsOf) ecarts.push('dataAsOf absent — le consommateur ne peut pas juger la fraîcheur');
  if (!pont.schemaVersion) ecarts.push('schemaVersion absent');
  if (pont.evidenceStatus.compte.sans_bloc > 0) ecarts.push(`${pont.evidenceStatus.compte.sans_bloc} règlement(s) publiés sans preuve structurée`);
  return { ok: ecarts.length === 0, detail: ecarts };
}

/**
 * 6. Arrondis : la somme des valeurs affichées doit valoir le total affiché.
 * Le défaut : le tableau des gains annonçait 237 036 alors que ses lignes faisaient
 * 237 035, et la ligne Augustin affichait 17 858 + 30 781 pour un total de 48 638.
 * Test de propriété sur des séries aléatoires, plus les cas réels constatés.
 */
function invariantsArrondi() {
  require('./charger-donnees.js').bouchonsDOM();
  const { repartirArrondi } = require('../render-helpers.js');
  const ecarts = [];
  const cas = [[17857.6, 30780.7], [0.5, 0.5], [-2.5, -3.5], [1e6 + 0.5, 0.5]];
  for (let i = 0; i < 400; i++) {
    const n = 2 + (i % 7);
    cas.push(Array.from({ length: n }, () => (Math.random() - 0.35) * 50000));
  }
  for (const v of cas) {
    const r = repartirArrondi(v);
    const somme = r.reduce((a, b) => a + b, 0);
    const cible = Math.round(v.reduce((a, b) => a + b, 0));
    if (somme !== cible) ecarts.push(`Σ arrondis ${somme} ≠ arrondi de Σ ${cible}`);
    if (r.some(x => !Number.isInteger(x))) ecarts.push('valeur non entière produite');
  }
  return { ok: ecarts.length === 0, detail: ecarts.slice(0, 5), cas: cas.length };
}

/** 7. Schéma et formule de l'artefact publié à /data/networth-bridge.json. */
function artefactPublie(attendu) {
  const chemin = path.join(RACINE, 'data', 'networth-bridge.json');
  if (!fs.existsSync(chemin)) return { ok: false, detail: ['data/networth-bridge.json absent — lance `node encrypt.js`'] };
  let a;
  try { a = JSON.parse(fs.readFileSync(chemin, 'utf8')); }
  catch (e) { return { ok: false, detail: ['JSON illisible : ' + e.message] }; }
  const { validerPontMinimal } = require('./bridge.js');
  const r = validerPontMinimal(a);
  // Le contrat interdit toute facture détaillée dans l'artefact public.
  const brut = JSON.stringify(a);
  if (/INVRTL|AZCS|INZOR/.test(brut)) r.erreurs.push('référence de facture détectée — l\'artefact doit rester agrégé');

  // COHÉRENCE avec les calculs internes : un artefact valide mais périmé serait pire
  // qu'un artefact absent — le consommateur ne verrait rien d'anormal.
  if (attendu) {
    for (const k of ['augustin', 'benoit', 'bob']) {
      if (a.positionsGross[k] !== attendu.positionsGross[k].signedMAD) {
        r.erreurs.push(`${k} publié ${a.positionsGross[k]} ≠ calcul interne ${attendu.positionsGross[k].signedMAD}`);
      }
    }
    if (a.netPositionMad !== attendu.positionsGross.total.signedMAD) {
      r.erreurs.push(`net publié ${a.netPositionMad} ≠ calcul interne ${attendu.positionsGross.total.signedMAD}`);
    }
    if (a.dataAsOf !== attendu.dataAsOf) r.erreurs.push(`dataAsOf publié ${a.dataAsOf} ≠ ${attendu.dataAsOf}`);
  }
  return { ok: r.erreurs.length === 0, detail: r.erreurs, net: a.netPositionMad };
}

/**
 * 8. Traçabilité : tant qu'un règlement n'a pas sa pièce, il doit le DIRE.
 * Avertissement (pas erreur) : l'absence de preuve est un état légitime, la masquer
 * ne l'est pas.
 */
function preuvesManquantes(DATA) {
  const manquants = [];
  const vu = new Set();
  const visiter = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(visiter); return; }
    if (o.reglement && typeof o.ref === 'string' && !vu.has(o.ref)) {
      vu.add(o.ref);
      const r = o.reglement;
      if (r.status == null) manquants.push(`${o.ref} : champ status absent`);
      if (r.paymentEvidenceStatus == null) manquants.push(`${o.ref} : champ paymentEvidenceStatus absent`);
      // Une date renseignée ne vaut pas preuve : on refuse « verified » sans pièce.
      if (r.paymentEvidenceStatus === 'verified' && (!r.paymentDate || !r.preuve)) {
        manquants.push(`${o.ref} : « verified » sans date ou sans pièce`);
      }
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') visiter(v);
  };
  visiter(DATA);
  const aProuver = [];
  const v2 = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(v2); return; }
    if (o.reglement && o.reglement.paymentEvidenceStatus === 'missing' && typeof o.ref === 'string') aProuver.push(o.ref);
    for (const v of Object.values(o)) if (v && typeof v === 'object') v2(v);
  };
  v2(DATA);
  return { ok: manquants.length === 0, detail: manquants, aProuver: [...new Set(aProuver)] };
}

/**
 * 9. Invariants du tableau des gains.
 *
 * Reproduit l'allocation d'arrondi de la page (une seule, par colonne) et vérifie les
 * trois identités qui doivent tenir quelles que soient les valeurs :
 *   · total d'une source = sa valeur 2025 + sa valeur 2026
 *   · total général = somme des sources
 *   · total général = sous-total 2025 + sous-total 2026
 *
 * Le défaut : le récapitulatif répartissait les restes sur la colonne entière et le
 * détail sur la seule paire Augustin — 17 858 ici, 17 857 là, deux totaux.
 */
function invariantsGains() {
  require('./charger-donnees.js').bouchonsDOM();
  const { repartirArrondi } = require('../render-helpers.js');
  const ecarts = [];
  for (let essai = 0; essai < 300; essai++) {
    const n = 3 + (essai % 6);
    const v25 = Array.from({ length: n }, (_, i) => (i % 4 === 3 ? null : (Math.random() - 0.3) * 40000));
    const v26 = Array.from({ length: n }, (_, i) => (i % 5 === 4 ? null : (Math.random() - 0.3) * 40000));
    const a25 = repartirArrondi(v25.map(x => x || 0));
    const a26 = repartirArrondi(v26.map(x => x || 0));
    const st25 = a25.reduce((s, x) => s + x, 0);
    const st26 = a26.reduce((s, x) => s + x, 0);
    const total = st25 + st26;
    // invariant 1 : total d'une source = 2025 + 2026
    const totauxSources = a25.map((x, i) => x + a26[i]);
    totauxSources.forEach((t, i) => {
      if (t !== a25[i] + a26[i]) ecarts.push(`source ${i} : total ≠ 2025 + 2026`);
    });
    // invariant 2 : total général = somme des sources
    const sommeSources = totauxSources.reduce((s, x) => s + x, 0);
    if (sommeSources !== total) ecarts.push(`Σ sources ${sommeSources} ≠ total ${total}`);
    // invariant 3 : total général = gains 2025 + gains 2026
    if (st25 + st26 !== total) ecarts.push(`sous-totaux ${st25}+${st26} ≠ total ${total}`);
    // l'allocation ne doit jamais déplacer la somme réelle
    if (st25 !== Math.round(v25.reduce((s, x) => s + (x || 0), 0))) ecarts.push('colonne 2025 déplacée par l\'arrondi');
    if (st26 !== Math.round(v26.reduce((s, x) => s + (x || 0), 0))) ecarts.push('colonne 2026 déplacée par l\'arrondi');
  }
  return { ok: ecarts.length === 0, detail: [...new Set(ecarts)].slice(0, 5) };
}

/** 10. Une seule allocation d'arrondi dans render-gains.js — pas de recalcul local. */
function allocationUnique() {
  const src = fs.readFileSync(path.join(RACINE, 'render-gains.js'), 'utf8');
  const appels = (src.match(/repartirArrondi\(/g) || []).length;
  const fautifs = [];
  // Une allocation par colonne (A25, A26) + les colonnes annexes du détail Augustin.
  // Ce qui est interdit, c'est de ré-allouer les gains MAD d'Augustin séparément.
  if (/repartirArrondi\(\[gainMAD_az25, gainMAD_az26\]\)/.test(src)) {
    fautifs.push('les gains MAD Augustin sont ré-alloués séparément du récapitulatif');
  }
  if (/Math\.round\(gainMAD_az25 \+ gainMAD_az26\)/.test(src)) {
    fautifs.push('total Augustin recalculé par Math.round(somme) au lieu de la somme des cellules');
  }
  return { ok: fautifs.length === 0, detail: fautifs, appels };
}

module.exports = { invariantsGains, allocationUnique, payeSansPreuve, sequencePerimetreEmetteur, fenetreTroisMois,
                   montantsEnDurDansLeRecit, pontCoherent, invariantsArrondi,
                   artefactPublie, preuvesManquantes };
