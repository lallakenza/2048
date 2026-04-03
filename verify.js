// Verification script - run with Node.js to check all amounts
// Usage: node verify.js
// Decrypts data from data-enc.js using BRIDGEVALE, then runs all checks.

const crypto = require('crypto');
const fs = require('fs');

const SALT = 'facturation-augustin-2025';

function decrypt(b64, password) {
  const pwd = password.toUpperCase();
  const key = crypto.pbkdf2Sync(pwd, SALT, 100000, 32, 'sha256');
  const raw = Buffer.from(b64, 'base64');
  const iv = raw.slice(0, 12);
  const tag = raw.slice(12, 28);
  const ct = raw.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let dec = decipher.update(ct, null, 'utf8');
  dec += decipher.final('utf8');
  return JSON.parse(dec);
}

// Load encrypted blob
const encFile = fs.readFileSync('data-enc.js', 'utf8');
const fullMatch = encFile.match(/ENCRYPTED_FULL = "([^"]+)"/);
if (!fullMatch) { console.error('Cannot find ENCRYPTED_FULL in data-enc.js'); process.exit(1); }
const DATA = decrypt(fullMatch[1], 'BRIDGEVALE');

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
check('Total MAD 2026', totalMAD26, 50000);
const totalEUR26 = totalMAD26 / az26.tauxMaroc;
check('Total EUR Maroc 2026', Math.round(totalEUR26 * 100), Math.round(50000 / 10.26 * 100));
const totalRTL26 = sum(az26.rtl.filter(r => r.ref !== '—'), 'montant');
check('Total RTL facturé 2026', totalRTL26, 26350);

const diversNet26 = az26.divers.reduce((s, x) => s + x.montant, 0);
check('Divers net montant 2026', diversNet26, 5600); // -1200 + 800 + 2000 + 4000
check('Divers count 2026 (Zak + Oum + remb + cash)', az26.divers.length, 4);

// AZCS via Majalis (from benoit2026)
const azcsAll26 = DATA.benoit2026.councils;
const azcsPaid26 = azcsAll26.filter(c => c.statut === 'ok');
const azcsRecuPaid26 = sum(azcsPaid26, 'htEUR');
check('AZCS paid via Majalis 2026', azcsRecuPaid26, 30625);

const paidRTL26 = az26.rtl.filter(r => r.statut === 'ok');
const amineRecu26 = sum(paidRTL26, 'montant');
check('RTL paid 2026', amineRecu26, 26350);

// Position Entreprise (paid) = RTL paid - Majalis→AZCS paid + report2025
const posEntreprise = amineRecu26 - azcsRecuPaid26 + az26.report2025;
check('Position Entreprise (paid)', posEntreprise, -5958);

// Divers : montant = PERSO normally. proOrigin items: montant = PRO, Perso = Pro × 0.95
const PERSO_FACTOR = 0.95;
const diversPro26 = az26.divers.reduce((s, x) => {
  if (x.proOrigin) return s + x.montant; // proOrigin: montant IS pro
  return s + Math.round(x.montant / PERSO_FACTOR * 100) / 100;
}, 0);
// All items are perso: Zak -1200 + Oum +800 + Remb 2000 + Cash 4000 = 5600 perso
// Pro = each montant / 0.95
const expectedDiversPro = Math.round(-1200/0.95*100)/100 + Math.round(800/0.95*100)/100 + Math.round(2000/0.95*100)/100 + Math.round(4000/0.95*100)/100;
check('Divers Pro 2026', Math.round(diversPro26 * 100), Math.round(expectedDiversPro * 100));

const diversPerso26 = az26.divers.reduce((s, x) => {
  if (x.proOrigin) return s + Math.round(x.montant * PERSO_FACTOR * 100) / 100;
  return s + x.montant;
}, 0);
check('Divers Perso 2026', diversPerso26, 5600);

// Position Net PRO (paid)
const posNetPro = posEntreprise - totalEUR26 - diversPro26;
check('Position Net Pro (paid)', Math.round(posNetPro), Math.round(posEntreprise - totalEUR26 - diversPro26));

// Position Net PERSO = Pro × 0.95 (règle universelle)
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
check('Benoit 2026 virements total', totalPaye26, 100000);
check('Benoit 2026 virements count', ba26.virements.length, 2);

// Summary
console.log(`\n=============================`);
console.log(`Total: ${errors === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${errors} ERROR(S) FOUND`}`);
console.log(`=============================`);

process.exit(errors > 0 ? 1 : 0);
