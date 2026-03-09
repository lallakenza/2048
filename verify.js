// Verification script - run with Node.js to check all amounts
// Usage: node verify.js

// Load data
const dataCode = require('fs').readFileSync('data.js', 'utf8');
const fn = new Function(dataCode + '; return DATA;');
const DATA = fn();

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

// Actuals
const totalActuals = sum(az.mois, 'actuals');
check('Total Actuals', totalActuals, 198475);

// B+Y+M
const totalBYM = sum(az.mois, 'bym');
check('Total B+Y+M', totalBYM, 157288);

// Maroc
const totalMaroc = sum(az.mois, 'maroc');
check('Total Maroc', totalMaroc, 23000);

// Divers
const totalDivers = sum(az.mois, 'divers');
check('Total Divers', totalDivers, 1170);

// Total dépenses
const totalDep = totalBYM + totalMaroc + totalDivers;
check('Total dépenses', totalDep, 181458);

// Balance Fév-Déc
const moisFevDec = az.mois.slice(1);
const actualsFevDec = sum(moisFevDec, 'actuals');
const depFevDec = sum(moisFevDec, m => m.bym + m.maroc + m.divers);
const solde = actualsFevDec - depFevDec;
check('Actuals Fév-Déc', actualsFevDec, 179775);
check('Dépenses Fév-Déc', depFevDec, 181458);
check('Solde (balance)', solde, -1683);

// Ycarré
const totalYcarré = sum(az.ycarre, 'montant');
check('Total Ycarré', totalYcarré, 54300);

// Councils (Augustin view)
const totalCouncils = sum(az.councils, 'ebsHT');
check('Total Councils HT', totalCouncils, 30188);

// Baraka
const totalBaraka = sum(az.baraka, 'montant');
check('Total Baraka', totalBaraka, 72800);

// Virements Maroc
const totalMarocExcel = sum(az.virementsMaroc, 'excelEUR');
check('Maroc Excel', totalMarocExcel, 23000);
const totalMarocDH = sum(az.virementsMaroc, 'totalDH');
check('Maroc DH', totalMarocDH, 230000);
check('Maroc EUR réel', totalMarocDH / az.tauxMaroc, 23000);

// Divers detailed
const totalDiversCalc = sum(az.divers, x => (x.d1 || 0) + (x.d2 || 0));
check('Divers total calc', totalDiversCalc, 1170);
check('Divers vérifié', az.diversVerifie, 2770);

// RTL
const totalRTL = sum(az.rtl, 'montant');
check('Total RTL', totalRTL, 198475);

// ===== AUGUSTIN 2026 =====
console.log('\n=== AUGUSTIN 2026 ===');
const az26 = DATA.augustin2026;
check('Report 2025', az26.report2025, -1683);
const totalMAD26 = sum(az26.virementsMaroc, 'dh');
check('Total MAD 2026', totalMAD26, 50000);
const totalRTL26 = sum(az26.rtl.filter(r => r.ref !== '—'), 'montant');
check('Total RTL facturé 2026', totalRTL26, 26350);

// ===== BENOIT 2025 =====
console.log('\n=== BENOIT 2025 ===');
const ba = DATA.benoit2025;

// Per-transaction verification
const tx = ba.councils.map(m => {
  const dh = Math.round(m.htEUR * m.tauxApplique);
  const gainFX = Math.round(m.htEUR * (m.tauxMarche - m.tauxApplique));
  const commission = Math.round(dh * ba.commissionRate);
  const netBenoit = dh - commission;
  return { ...m, dh, gainFX, commission, netBenoit };
});

// Check individual DH amounts
check('Tx1 DH (5625×10.5)', tx[0].dh, 59063); // 5625 × 10.5 = 59062.5 → 59063
check('Tx2 DH (5625×10.5)', tx[1].dh, 59063);
check('Tx3 DH (5313×10.5)', tx[2].dh, 55787); // 5313 × 10.5 = 55786.5 → 55787
check('Tx4 DH (5000×10.6)', tx[3].dh, 53000);
check('Tx5 DH (5000×10.6)', tx[4].dh, 53000);
check('Tx6 DH (3625×10.6)', tx[5].dh, 38425);

const totalDH = sum(tx, 'dh');
check('Total DH Councils', totalDH, 318338);

// Gain FX per transaction
check('GainFX #1', tx[0].gainFX, 28);
check('GainFX #2', tx[1].gainFX, 433);
check('GainFX #3', tx[2].gainFX, 159);
check('GainFX #4', tx[3].gainFX, 840);
check('GainFX #5', tx[4].gainFX, 985);
check('GainFX #6', tx[5].gainFX, 384);

const totalGainFX = sum(tx, 'gainFX');
check('Total Gain FX', totalGainFX, 2829);

// Commission
const totalCommission = sum(tx, 'commission');
check('Total Commission', totalCommission, 31834);

// Net Benoit
const totalNetBenoit = sum(tx, 'netBenoit');
check('Net dû Benoit', totalNetBenoit, 286504);

// Virements
const totalPaye = sum(ba.virements, 'dh');
check('Total payé DH', totalPaye, 281750);

// Solde
const soldeBenoit = totalNetBenoit - totalPaye;
check('Solde Benoit', soldeBenoit, 4754);

// Total gains
const totalGains = totalCommission + totalGainFX;
check('Total gains', totalGains, 34663);

// ===== BENOIT 2026 =====
console.log('\n=== BENOIT 2026 ===');
const ba26 = DATA.benoit2026;
check('Taux appliqué 2026', ba26.tauxApplique, 10.7);

const tx26_jan = Math.round(5000 * 10.7);
check('Jan 2026 DH', tx26_jan, 53500);
const gainFX_jan = Math.round(5000 * (10.836 - 10.7));
check('Jan 2026 Gain FX', gainFX_jan, 680);

// Report
check('Report 2025 (computed)', soldeBenoit, 4754);

// Summary
console.log(`\n=============================`);
console.log(`Total: ${errors === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${errors} ERROR(S) FOUND`}`);
console.log(`=============================`);

process.exit(errors > 0 ? 1 : 0);
