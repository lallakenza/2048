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

module.exports = { payeSansPreuve, sequencePerimetreEmetteur, fenetreTroisMois, montantsEnDurDansLeRecit, pontCoherent };
