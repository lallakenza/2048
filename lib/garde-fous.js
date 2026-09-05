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
function artefactPublie() {
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
      const ev = o.reglement.paymentEvidence;
      if (ev == null) manquants.push(`${o.ref} : champ paymentEvidence absent`);
    }
    for (const v of Object.values(o)) if (v && typeof v === 'object') visiter(v);
  };
  visiter(DATA);
  const aProuver = [];
  const v2 = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(v2); return; }
    if (o.reglement && o.reglement.paymentEvidence === 'missing' && typeof o.ref === 'string') aProuver.push(o.ref);
    for (const v of Object.values(o)) if (v && typeof v === 'object') v2(v);
  };
  v2(DATA);
  return { ok: manquants.length === 0, detail: manquants, aProuver: [...new Set(aProuver)] };
}

module.exports = { payeSansPreuve, sequencePerimetreEmetteur, fenetreTroisMois,
                   montantsEnDurDansLeRecit, pontCoherent, invariantsArrondi,
                   artefactPublie, preuvesManquantes };
