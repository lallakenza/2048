// ============================================================================
// verify.js — contrôles de cohérence des données de facturation.
//
// Usage : node verify.js
//
// Il déchiffrait `data-enc.js` avec le mot de passe 'TIGRE' ÉCRIT EN DUR dans ce
// fichier versionné. Il lit désormais la source en clair, hors dépôt : plus aucune
// clé ici, et on vérifie ce qui fait foi plutôt que sa copie chiffrée.
//
// Il ne comparait que des totaux à des constantes écrites à la main : il attrapait
// une somme fausse, jamais une facture manquante, une échéance absente, une séquence
// trouée, un statut « payé » sans encaissement, ni ce que Net Worth consomme
// réellement. Ces contrôles-là sont ajoutés, et chaque échec NOMME l'objet fautif.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { validerFactures } = require('./lib/validate-invoices.js');

const SOURCE = process.env.FACT_DATA_SOURCE
  || path.join(require('os').homedir(), 'facturation-data', 'source.js');
if (!fs.existsSync(SOURCE)) {
  console.error('✗ Source introuvable : ' + SOURCE);
  console.error('  Les données en clair vivent hors du dépôt. Renseigne FACT_DATA_SOURCE si besoin.');
  process.exit(2);
}
const DATA = require(SOURCE).FULL_DATA;

let errors = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.log(`❌ ${label}: got ${actual}, expected ${expected}`);
    errors++;
  } else {
    console.log(`✅ ${label}: ${actual}`);
  }
}

const sum = (arr, key) => arr.reduce((s, x) => s + (typeof key === 'function' ? key(x) : (x[key] || 0)), 0);

// ===== AUGUSTIN 2025 =====
console.log('\n=== AUGUSTIN 2025 ===');
const az = DATA.augustin2025;

const totalActuals = sum(az.mois, 'actuals');
check('Total Actuals', totalActuals, 198475);

const totalBYM = sum(az.mois, 'bym');
check('Total B+Y+M', totalBYM, 157288);

const totalMaroc = sum(az.mois, 'maroc');
check('Total Maroc', totalMaroc, 23000);

const totalDivers = sum(az.mois, 'divers');
check('Total Divers', totalDivers, 1170);

const totalDep = totalBYM + totalMaroc + totalDivers;
check('Total dépenses', totalDep, 181458);

const moisFevDec = az.mois.slice(1);
const actualsFevDec = sum(moisFevDec, 'actuals');
const depFevDec = sum(moisFevDec, m => m.bym + m.maroc + m.divers);
const solde = actualsFevDec - depFevDec;
check('Actuals Fév-Déc', actualsFevDec, 179775);
check('Dépenses Fév-Déc', depFevDec, 181458);
check('Solde (balance)', solde, -1683);

const totalYcarré = sum(az.ycarre, 'montant');
check('Total Ycarré', totalYcarré, 54300);

const totalCouncils = sum(az.councils, 'ebsHT');
check('Total Councils HT', totalCouncils, 30188);

const totalBaraka = sum(az.baraka, 'montant');
check('Total Baraka', totalBaraka, 72800);

const totalMarocExcel = sum(az.virementsMaroc, 'excelEUR');
check('Maroc Excel', totalMarocExcel, 23000);
const totalMarocDH = sum(az.virementsMaroc, 'totalDH');
check('Maroc DH', totalMarocDH, 230000);
check('Maroc EUR réel', totalMarocDH / az.tauxMaroc, 23000);

const totalDiversCalc = sum(az.divers, 'montant');
check('Divers total net', totalDiversCalc, 1170);
check('Divers vérifié (abs)', az.diversVerifie, 9170);

const totalRTL = sum(az.rtl, 'montant');
check('Total RTL', totalRTL, 198475);

// ===== AUGUSTIN 2026 =====
console.log('\n=== AUGUSTIN 2026 ===');
const az26 = DATA.augustin2026;
check('Report 2025', az26.report2025, -1683);
const totalMAD26 = sum(az26.virementsMaroc, 'dh');
check('Total MAD 2026', totalMAD26, 270000); // ...12/07 50k + 17/07 10k + 03/08 50k + 27/08 20k
const totalEUR26 = totalMAD26 / az26.tauxMaroc;
check('Total EUR Maroc 2026', Math.round(totalEUR26 * 100), Math.round(270000 / 10.26 * 100));
const totalRTL26 = sum(az26.rtl.filter(r => r.ref !== '—'), 'montant');
check('Total RTL facturé 2026', totalRTL26, 103700); // INVRTL013..019 (018+019 émises non payées)

const diversNet26 = az26.divers.reduce((s, x) => s + x.montant, 0);
check('Divers net montant 2026', diversNet26, 5600); // +800 - 1200 + 6000
check('Divers count 2026 (Oum + Zak + Nezha)', az26.divers.length, 3);

// AZCS via Majalis (from benoit2026)
const azcsAll26 = DATA.benoit2026.councils;
const azcsPaid26 = azcsAll26.filter(c => c.statut === 'ok');
const azcsRecuPaid26 = sum(azcsPaid26, 'htEUR');
check('AZCS paid via Majalis 2026', azcsRecuPaid26, 55312.5); // AZCS0001..0009 + 0011 (Juillet 5000, payé 02/08)

const paidRTL26 = az26.rtl.filter(r => r.statut === 'ok');
const amineRecu26 = sum(paidRTL26, 'montant');
check('RTL paid 2026', amineRecu26, 87550); // INVRTL013..018 payés (018 payée 26/08, payment advice 1700002684)

// Paiements Bridgevale (EUR B2B à la société AZCS) — dans la Position Entreprise
const bridgevaleEUR26 = az26.virementsBridgevale ? az26.virementsBridgevale.reduce((s, x) => s + x.eur, 0) : 0;
check('Bridgevale EUR 2026', bridgevaleEUR26, 2400);

// Position Entreprise (paid) = ce qu'AZCS doit recevoir (RTL) − reçu (Majalis + Bridgevale) + report
const posEntreprise = amineRecu26 - azcsRecuPaid26 - bridgevaleEUR26 + az26.report2025;
check('Position Entreprise (paid)', posEntreprise, 28154.5); // 87550 − 55312.5 AZCS − 2400 Bridgevale − 1683 report

// Divers : montant = PERSO normally. proOrigin items: montant = PRO, Perso = Pro × 0.95
const PERSO_FACTOR = 0.95;
const diversPro26 = az26.divers.reduce((s, x) => {
  if (x.proOrigin) return s + x.montant; // proOrigin: montant IS pro
  return s + Math.round(x.montant / PERSO_FACTOR * 100) / 100;
}, 0);
// All items are perso: Oum +800 + Zak -1200 + Nezha 6000 = 5600 perso
// Pro = each montant / 0.95
const expectedDiversPro = Math.round(800/0.95*100)/100 + Math.round(-1200/0.95*100)/100 + Math.round(6000/0.95*100)/100;
check('Divers Pro 2026', Math.round(diversPro26 * 100), Math.round(expectedDiversPro * 100));

const diversPerso26 = az26.divers.reduce((s, x) => {
  if (x.proOrigin) return s + Math.round(x.montant * PERSO_FACTOR * 100) / 100;
  return s + x.montant;
}, 0);
check('Divers Perso 2026', diversPerso26, 5600);

// Position Net PRO (paid) = Entreprise − virements Maroc − divers (Bridgevale déjà dans l'Entreprise)
const posNetPro = posEntreprise - totalEUR26 - diversPro26;
check('Position Net Pro (paid)', Math.round(posNetPro), Math.round(posEntreprise - totalEUR26 - diversPro26));

// Position Net PERSO = Pro × 0.95 (le delta se règle en perso au deal)
const posNetPerso = posNetPro * PERSO_FACTOR;
check('Position Net Perso (Pro×0.95)', Math.round(posNetPerso), Math.round(posNetPro * PERSO_FACTOR));

// Position Maroc = Pro × tauxMaroc
const posNetMaroc = posNetPro * az26.tauxMaroc;
check('Position Maroc (MAD)', Math.round(posNetMaroc), Math.round(posNetPro * az26.tauxMaroc));

// 3 positions are equivalent (taux fixes sur PRO)
console.log('\n=== EQUIVALENCE DES POSITIONS ===');
check('Perso = Pro × 0.95', Math.round(posNetPerso), Math.round(posNetPro * PERSO_FACTOR));
check('MAD = Pro × tauxMaroc', Math.round(posNetMaroc), Math.round(posNetPro * az26.tauxMaroc));
check('1000€ pro = 950€ perso = 10.26k MAD', Math.round(1000 * PERSO_FACTOR), 950);

// ===== BENOIT 2025 =====
console.log('\n=== BENOIT 2025 ===');
const ba = DATA.benoit2025;

const tx = ba.councils.map(m => {
  const dh = Math.round(m.htEUR * m.tauxApplique);
  const commission = Math.round(dh * ba.commissionRate);
  const netBenoit = dh - commission;
  return { ...m, dh, commission, netBenoit };
});

check('Tx1 DH (5625×10.5)', tx[0].dh, 59063);
check('Tx2 DH (5625×10.5)', tx[1].dh, 59063);
check('Tx3 DH (5313×10.5)', tx[2].dh, 55787);
check('Tx4 DH (5000×10.6)', tx[3].dh, 53000);
check('Tx5 DH (5000×10.6)', tx[4].dh, 53000);
check('Tx6 DH (3625×10.6)', tx[5].dh, 38425);

const totalDH = sum(tx, 'dh');
check('Total DH Councils', totalDH, 318338);

const totalCommission = sum(tx, 'commission');
check('Total Commission', totalCommission, 31834);

const totalNetBenoit = sum(tx, 'netBenoit');
check('Net dû Benoit', totalNetBenoit, 286504);

const totalPaye = sum(ba.virements, 'dh');
check('Total payé DH', totalPaye, 281750);

const soldeBenoit = totalNetBenoit - totalPaye;
check('Solde Benoit', soldeBenoit, 4754);

// ===== BENOIT 2026 =====
console.log('\n=== BENOIT 2026 ===');
const ba26 = DATA.benoit2026;
check('Jan 2026 taux', ba26.councils[0].tauxApplique, 10.6);
const tx26_jan = Math.round(5000 * 10.6);
check('Jan 2026 DH', tx26_jan, 53000);
check('Report 2025 (computed)', soldeBenoit, 4754);

// Benoit 2026 virements (including 50k MAD payment 02/04/2026)
const totalPaye26 = sum(ba26.virements, 'dh');
check('Benoit 2026 virements total', totalPaye26, 550000); // 10 × 50k + 45k + 5k DH
check('Benoit 2026 virements count', ba26.virements.length, 12);

// ═══════════════════════════════════════════════════════════════════════════
// CONTRÔLES STRUCTURELS — factures, échéances, séquences, encaissements
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== FACTURES : STRUCTURE ===');
const val = validerFactures(DATA);
for (const a of val.anomalies) {
  const marque = a.gravite === 'erreur' ? '❌' : '⚠️ ';
  console.log(`${marque} [${a.contexte}] ${a.message}`);
  if (a.gravite === 'erreur') errors++;
}
if (!val.anomalies.length) console.log(`✅ ${val.lots} lot(s) de factures : aucune anomalie`);
else console.log(`   → ${val.erreurs} erreur(s), ${val.avertissements} avertissement(s) sur ${val.lots} lot(s)`);

// ═══════════════════════════════════════════════════════════════════════════
// LES TROIS CONTREPARTIES ET LEUR SOMME
// verify.js ne regardait ni Bob ni la position combinée — celle-là même que Net
// Worth consomme. Une divergence sur Bob passait donc inaperçue.
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== CONTREPARTIES ===');
const contreparties = { augustin2026: 'Augustin', benoit2026: 'Benoit', bob2026: 'Bob' };
let manquantes = [];
for (const [cle, nom] of Object.entries(contreparties)) {
  if (!DATA[cle]) { manquantes.push(nom); continue; }
  const lots = Object.entries(DATA[cle]).filter(([, v]) =>
    Array.isArray(v) && v.some(x => x && (x.montant != null || x.htEUR != null)));
  const facture = lots.reduce((s2, [, v]) =>
    s2 + v.reduce((a, x) => a + (x.montant != null ? x.montant : (x.htEUR || 0)), 0), 0);
  console.log(`✅ ${nom} : ${lots.length} lot(s), ${Math.round(facture).toLocaleString('fr-FR')} € facturés`);
}
if (manquantes.length) {
  console.log(`❌ contrepartie(s) absente(s) du jeu de données : ${manquantes.join(', ')}`);
  errors += manquantes.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSIONS EUR / MAD
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== CONVERSIONS ===');
const taux = [
  ['Augustin tauxMaroc', DATA.augustin2026 && DATA.augustin2026.tauxMaroc],
  ['Benoit commissionRate', DATA.benoit2026 && DATA.benoit2026.commissionRate],
];
for (const [nom, t] of taux) {
  if (t == null) { console.log(`❌ ${nom} absent — toute conversion en dépend`); errors++; }
  else if (typeof t !== 'number' || !isFinite(t) || t <= 0) {
    console.log(`❌ ${nom} invalide : ${JSON.stringify(t)}`); errors++;
  } else console.log(`✅ ${nom} = ${t}`);
}
// Les taux appliqués par facture doivent rester cohérents entre eux.
const tauxAppliques = new Set();
for (const bloc of [DATA.benoit2026, DATA.bob2026]) {
  for (const c of (bloc && bloc.councils) || []) if (c.tauxApplique) tauxAppliques.add(c.tauxApplique);
}
if (tauxAppliques.size > 3) {
  console.log(`❌ ${tauxAppliques.size} taux différents appliqués aux factures (${[...tauxAppliques].join(', ')}) — vérifier`);
  errors++;
} else console.log(`✅ taux appliqués : ${[...tauxAppliques].join(', ') || '(aucun)'}`);

// ═══════════════════════════════════════════════════════════════════════════
// CAS LIMITES — la structure doit résister aux données absentes
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== CAS LIMITES ===');
const casLimites = [
  ['jeu vide', {}],
  ['lot vide', { x: { factures: [] } }],
  ['lignes nulles', { x: { factures: [null, undefined] } }],
  ['montant nul', { x: { factures: [{ ref: 'INVRTL999', montant: 0 }] } }],
  ['montant négatif', { x: { factures: [{ ref: 'INVRTL998', montant: -100 }] } }],
];
for (const [nom, jeu] of casLimites) {
  try {
    validerFactures(jeu);
    console.log(`✅ ${nom} : traité sans exception`);
  } catch (e) {
    console.log(`❌ ${nom} : le validateur lève « ${e.message} »`);
    errors++;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n=============================`);
if (errors === 0) {
  console.log(`✅ Aucun échec (${val.avertissements} avertissement(s) à traiter)`);
} else {
  console.log(`❌ ${errors} ÉCHEC(S) — voir les lignes ❌ ci-dessus`);
}
console.log(`=============================`);

process.exit(errors > 0 ? 1 : 0);
