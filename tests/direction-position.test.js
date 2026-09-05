#!/usr/bin/env node
// ============================================================================
// « Qui doit à qui » — direction d'une position.
//
// Le bandeau « Position Entreprise (AZCS) » affichait `deltaEntreprisePaid` en y
// accolant la direction de `deltaNetPro`, une AUTRE position. Les deux différant de
// (virements Maroc + divers), elles peuvent être de signes opposés : l'interface
// annonçait alors un montant et la direction inverse.
// ============================================================================
// render-helpers.js est un script de NAVIGATEUR : il touche `window` au chargement.
// On fournit le contexte minimal plutôt que de découper le fichier pour les tests.
global.window = global.window || {};
global.document = global.document || {
  getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
  addEventListener: () => {}, createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
  body: { appendChild: () => {} },
};
const { directionPosition } = require('../render-helpers.js');

let echecs = [];
const attendu = (montant, contrepartie, voulu) => {
  const obtenu = directionPosition(montant, contrepartie);
  if (obtenu !== voulu) echecs.push(`directionPosition(${montant}) → « ${obtenu} », attendu « ${voulu} »`);
};

// Positif : la contrepartie est créditrice, Amine doit.
attendu(12500, 'Augustin', 'Amine doit à Augustin');
attendu(1, 'Augustin', 'Amine doit à Augustin');
// Négatif : l'inverse.
attendu(-8300, 'Augustin', 'Augustin doit à Amine');
attendu(-1, 'Augustin', 'Augustin doit à Amine');
// Zéro : ce n'est pas une dette. Le traiter comme positif faisait dire « Amine doit 0 € ».
attendu(0, 'Augustin', 'Position à l’équilibre');
attendu(0.4, 'Augustin', 'Position à l’équilibre');   // arrondi à 0
attendu(-0.4, 'Augustin', 'Position à l’équilibre');
// Données absentes : ne doit pas jeter ni inventer une direction.
attendu(null, 'Augustin', 'Position à l’équilibre');
attendu(undefined, 'Augustin', 'Position à l’équilibre');
attendu(NaN, 'Augustin', 'Position à l’équilibre');
// Autres contreparties.
attendu(500, 'Bob', 'Amine doit à Bob');
attendu(-500, 'Benoit', 'Benoit doit à Amine');

// Le bandeau Entreprise doit utiliser SA position, pas celle des cartes hero.
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'render-augustin.js'), 'utf-8');
if (!/whoOwesEntreprise\s*=\s*directionPosition\(deltaEntreprisePaid/.test(src)) {
  echecs.push('render-augustin.js : whoOwesEntreprise n’est pas dérivé de deltaEntreprisePaid');
}
if (!/Position Entreprise[\s\S]{0,400}\$\{whoOwesEntreprise\}/.test(src)) {
  echecs.push('render-augustin.js : le bandeau Entreprise n’affiche pas whoOwesEntreprise');
}
// Régression : le bandeau Entreprise ne doit plus jamais réutiliser whoOwes.
const bandeau = /Position Entreprise[\s\S]{0,400}?<\/div>`;/.exec(src);
if (bandeau && /\$\{whoOwes\}/.test(bandeau[0])) {
  echecs.push('render-augustin.js : le bandeau Entreprise réutilise whoOwes (position Net Pro)');
}

if (echecs.length) {
  console.error('✗ ' + echecs.length + ' contrôle(s) en échec :');
  for (const e of echecs) console.error('   - ' + e);
  process.exit(1);
}
console.log('✓ direction des positions : 12 cas (positif, négatif, nul, absent, 3 contreparties) + 3 contrôles de câblage');
