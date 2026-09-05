#!/usr/bin/env node
// ============================================================================
// Garde-fou : AUCUNE donnée financière en clair ne doit revenir dans le dépôt.
//
// encrypt.js a contenu 55 Ko de données en clair — montants, numéros de facture,
// références bancaires, et la table de correspondance des vrais noms derrière les
// alias — dans un dépôt PUBLIC. Ce test échoue si un fichier versionné se remet à
// contenir ce genre de contenu, plutôt que de compter sur la vigilance.
// ============================================================================
const { execSync } = require('child_process');
const fs = require('fs');

let echecs = [];

function verifier(nom, condition, detail) {
  if (!condition) echecs.push(nom + ' — ' + detail);
}

// 1. Les vrais noms ne doivent apparaître dans AUCUN fichier versionné.
const NOMS_REELS = ['Azarkan', 'Badrecheikh', 'El Azzouzi', 'ZOR Consulting'];
const versionnes = execSync('git ls-files', { encoding: 'utf-8' }).split('\n').filter(Boolean);
for (const f of versionnes) {
  if (!fs.existsSync(f) || f.endsWith('.enc.js') || f.startsWith('tests/')) continue;
  let contenu;
  try { contenu = fs.readFileSync(f, 'utf-8'); } catch (e) { continue; }
  for (const nom of NOMS_REELS) {
    verifier('noms réels', !contenu.includes(nom),
      'le nom « ' + nom + " » apparaît dans " + f + ' (fichier versionné, dépôt public)');
  }
}

// 2. encrypt.js ne doit plus porter les données : il lit une source hors dépôt.
const enc = fs.readFileSync('encrypt.js', 'utf-8');
verifier('encrypt.js', enc.length < 20000,
  'encrypt.js fait ' + enc.length + ' octets — les données y sont probablement revenues (logique seule ≈ 6 Ko)');
verifier('encrypt.js', /FACT_DATA_SOURCE|facturation-data/.test(enc),
  'encrypt.js ne lit plus la source hors dépôt');
verifier('encrypt.js', !/const FULL_DATA = \{[\s\S]{500,}/.test(enc),
  'FULL_DATA est de nouveau déclaré inline dans encrypt.js');

// 3. .gitignore doit continuer de protéger la source.
const gi = fs.readFileSync('.gitignore', 'utf-8');
verifier('.gitignore', /^source\.js$/m.test(gi), 'source.js n’est plus ignoré');

if (echecs.length) {
  console.error('✗ ' + echecs.length + ' contrôle(s) en échec :');
  for (const e of echecs) console.error('   - ' + e);
  process.exit(1);
}
console.log('✓ Aucune donnée en clair dans les fichiers versionnés (noms réels, encrypt.js, .gitignore)');
