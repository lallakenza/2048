#!/usr/bin/env node
// ============================================================================
// Contrôle HTTP de l'artefact DÉPLOYÉ.
//
// Le contrôle de build vérifie le fichier écrit localement ; celui-ci vérifie ce que
// le public reçoit réellement. Les deux peuvent diverger : déploiement en retard,
// cache CDN, fichier non publié. Un artefact valide en local mais absent en ligne est
// exactement le cas qu'un consommateur ne peut pas diagnostiquer.
//
// Usage : node scripts-verifier-artefact.js [url]
// ============================================================================
const URL_DEFAUT = 'https://lallakenza.github.io/2048/data/networth-bridge.json';

(async () => {
  const url = process.argv[2] || URL_DEFAUT;
  const { validerPontMinimal } = require('./lib/bridge.js');
  const { charger } = require('./lib/charger-donnees.js');
  const { derniereOperation } = require('./lib/data-freshness.js');
  const { construirePont } = require('./lib/bridge.js');

  let distant;
  try {
    const rep = await fetch(url + '?cb=' + Date.now());
    if (!rep.ok) { console.error(`✗ HTTP ${rep.status} sur ${url}`); process.exit(1); }
    distant = await rep.json();
  } catch (e) {
    console.error('✗ Artefact injoignable : ' + e.message);
    process.exit(1);
  }

  const erreurs = [];
  const schema = validerPontMinimal(distant);
  erreurs.push(...schema.erreurs);

  // Comparaison au calcul interne courant.
  const ctx = charger();
  ctx.DATA._meta = { derniereOperation: derniereOperation(ctx.DATA).date };
  const local = construirePont(ctx.DATA, ctx.helpers, { sourceVersion: null });
  const g = local.positionsGross;
  for (const k of ['augustin', 'benoit', 'bob']) {
    if (distant.positionsGross[k] !== g[k].signedMAD) {
      erreurs.push(`${k} en ligne ${distant.positionsGross[k]} ≠ calcul local ${g[k].signedMAD}`);
    }
  }
  if (distant.netPositionMad !== g.total.signedMAD) erreurs.push(`net en ligne ${distant.netPositionMad} ≠ ${g.total.signedMAD}`);
  if (distant.dataAsOf !== local.dataAsOf) erreurs.push(`dataAsOf en ligne ${distant.dataAsOf} ≠ ${local.dataAsOf}`);
  if (distant.nettingApplied !== false) erreurs.push('nettingApplied doit rester false en ligne');

  console.log(`Artefact déployé : ${url}`);
  console.log(`  schéma ${distant.schemaVersion} · producteur ${distant.producerVersion} · données au ${distant.dataAsOf}`);
  console.log(`  positions ${JSON.stringify(distant.positionsGross)} · net ${distant.netPositionMad} · netting ${distant.nettingApplied}`);
  if (erreurs.length) {
    console.error('\n✗ ' + erreurs.length + ' anomalie(s) :');
    erreurs.forEach(e => console.error('   ' + e));
    process.exit(1);
  }
  console.log('\n✅ Artefact déployé conforme et cohérent avec les calculs internes.');
})();
