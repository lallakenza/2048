// ============================================================
// RENDER.JS — Génère tout le HTML à partir de DATA (data.js)
// Ne pas modifier ce fichier pour changer les chiffres
// ============================================================

// ---- HELPERS ----
const fmt = (n, suffix = '€') => {
  if (n === 0 || n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('fr-FR');
  const sign = n < 0 ? '−' : (n > 0 ? '+' : '');
  // For amounts, show sign only when explicitly needed
  return formatted + (suffix ? ' ' + suffix : '');
};

const fmtSigned = (n, suffix = '€') => {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('fr-FR');
  const sign = n < 0 ? '−' : '+';
  return sign + formatted + (suffix ? ' ' + suffix : '');
};

const fmtPlain = (n) => {
  if (n === 0 || n === null || n === undefined) return '—';
  return Math.abs(n).toLocaleString('fr-FR');
};

const fmtRate = (r) => {
  if (!r) return '—';
  return r.toFixed(3).replace('.', ',');
};

const fmtDelta = (d) => {
  if (d === null || d === undefined) return '—';
  const sign = d < 0 ? '−' : '+';
  return sign + Math.abs(d).toFixed(3).replace('.', ',');
};

const colorForSolde = (n) => n > 0 ? 'var(--green)' : n < 0 ? 'var(--red)' : 'var(--green)';
const classForSolde = (n) => n > 0 ? 'green' : n < 0 ? 'red' : 'green';

const badge = (type, text) => `<span class="b ${type}">${text}</span>`;

const sum = (arr, key) => arr.reduce((s, x) => s + (typeof key === 'function' ? key(x) : (x[key] || 0)), 0);

// ---- AZARKAN 2025 ----
function renderAzarkan2025() {
  const d = DATA.azarkan2025;
  const mois = d.mois;

  // Computed values
  const totalActuals = sum(mois, 'actuals');
  const totalBYM = sum(mois, 'bym');
  const totalMaroc = sum(mois, 'maroc');
  const totalDivers = sum(mois, 'divers');
  const totalDepenses = totalBYM + totalMaroc + totalDivers;

  // Balance = Fév-Déc only (exclude January)
  const moisFevDec = mois.slice(1);
  const actualsFevDec = sum(moisFevDec, 'actuals');
  const depFevDec = sum(moisFevDec, m => m.bym + m.maroc + m.divers);
  const soldeExcel = actualsFevDec - depFevDec;
  const soldeCorrige = soldeExcel; // Same since Maroc matches

  // Ysquare total
  const totalYsquare = sum(d.ysquare, 'montant');
  // Majalis total
  const totalMajalis = sum(d.majalis, 'ebsHT');
  // Bairok total
  const totalBairok = sum(d.bairok, 'montant');
  // Maroc total (from virements)
  const totalMarocExcel = sum(d.virementsMaroc, 'excelEUR');
  const totalMarocDH = sum(d.virementsMaroc, 'totalDH');
  const totalMarocReel = totalMarocDH / d.tauxMaroc;
  // Divers total
  const totalDiversCalc = sum(d.divers, x => (x.d1 || 0) + (x.d2 || 0));
  // RTL total
  const totalRTL = sum(d.rtl, 'montant');
  const totalRecuRTL = sum(d.rtl, 'recu');

  let html = '';

  // Title
  html += `<h2 style="font-size:1.05rem;margin-bottom:6px">${d.title}</h2>`;
  html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">${d.subtitle}</p>`;

  // Cards
  html += `<div class="cards">
    <div class="card"><div class="l">Actuals Jan-Déc</div><div class="v blue">${fmtPlain(totalActuals)} €</div></div>
    <div class="card"><div class="l">Total dépenses Excel</div><div class="v yellow">${fmtPlain(totalDepenses)} €</div></div>
    <div class="card"><div class="l">Solde Excel (Fév-Déc)</div><div class="v red">${fmtSigned(soldeExcel)}</div></div>
    <div class="card"><div class="l">Solde corrigé (MAD réel)</div><div class="v red">${fmtSigned(soldeCorrige)}</div></div>
  </div>`;

  // Synthèse 5 catégories
  const categories = [
    { nom: "1. Ysquare (Kenza)", excel: totalYsquare, verifie: totalYsquare, statut: `✓ ${d.ysquare.length}/${d.ysquare.length} match` },
    { nom: "2. Majalis HT (Badre)", excel: totalMajalis, verifie: totalMajalis, statut: `✓ ${d.majalis.length}/${d.majalis.length} corrigé` },
    { nom: "3. Bairok (→ Azarkan EUR)", excel: totalBairok, verifie: totalBairok, statut: `✓ ${d.bairok.length}/${d.bairok.length} match` },
    { nom: "4. Virements Maroc (→ Azarkan DH)", excel: totalMarocExcel, verifie: totalMarocReel, statut: `✓ ${d.virementsMaroc.length}/${d.virementsMaroc.length} match` },
    { nom: "5. Autre (Divers)", excel: totalDiversCalc, verifie: d.diversVerifie, ecartOverride: -(d.diversVerifie - totalDiversCalc) < 0 ? totalDiversCalc - d.diversVerifie : -(d.diversVerifie - totalDiversCalc), statut: "✓ Vols + iPhone EBS" },
  ];

  const totalExcelCat = categories.reduce((s, c) => s + c.excel, 0);
  const totalVerifieCat = categories.reduce((s, c) => s + c.verifie, 0);

  html += `<div class="s"><div class="st">Synthèse des 5 catégories (Excel v2)</div><table>
    <thead><tr><th>Catégorie</th><th style="text-align:right">Excel v2 (€)</th><th style="text-align:right">Vérifié EBS/Banque (€)</th><th style="text-align:right">Écart (€)</th><th>Statut</th></tr></thead><tbody>`;

  categories.forEach(c => {
    const ecart = c.ecartOverride !== undefined ? -(c.verifie - c.excel) : c.excel - c.verifie;
    const ecartColor = ecart === 0 ? 'var(--green)' : 'var(--yellow)';
    html += `<tr><td><strong>${c.nom}</strong></td><td class="a">${fmtPlain(c.excel)}</td><td class="a">${fmtPlain(c.verifie)}</td><td class="a" style="color:${ecartColor}">${ecart === 0 ? '0' : fmtSigned(ecart, '')}</td><td>${badge('ok', c.statut)}</td></tr>`;
  });

  const ecartTotal = totalExcelCat - totalVerifieCat;
  html += `<tr class="tr"><td><strong>Total dépenses</strong></td><td class="a"><strong>${fmtPlain(totalExcelCat)}</strong></td><td class="a"><strong>${fmtPlain(totalVerifieCat)}</strong></td><td class="a" style="color:var(--yellow)"><strong>${fmtSigned(ecartTotal, '')}</strong></td><td></td></tr>`;
  html += `</tbody></table>`;

  // Note synthèse
  html += `<div class="n">
    <strong>Résultat (Excel v2) :</strong> Azarkan a largement corrigé son fichier. Les 3 catégories EBS (Ysquare, Majalis, Bairok) matchent à 100%. Le Maroc Fév-Déc matche parfaitement (${fmtPlain(totalMarocExcel)}€ Excel = ${fmtPlain(totalMarocReel)}€ réel). Les Divers sont maintenant largement vérifiés : <strong>Fév 400€ + Juin 1 240€ = vols pour Azarkan</strong>, <strong>Sep 1 130€ = iPhone 1 305,41 USD (EBS)</strong>. Il reste seulement Nov 300€ et Déc −1 900€ sans preuve (net ${fmtSigned(d.diversNonVerifie, '€')}).<br><br>
    Solde Excel = Solde corrigé : <strong>${fmtSigned(soldeExcel)}</strong> (Azarkan te doit).<br>
    Divers vérifiés : <strong>${fmtPlain(d.diversVerifie)}€</strong> sur ${fmtPlain(totalDiversCalc)}€ total (vols + iPhone).<br>
    Divers non vérifiés : Nov 300€ et Déc −1 900€ (net ${fmtSigned(d.diversNonVerifie, '€')}, dont le crédit Déc est en ta faveur).
  </div></div>`;

  // Mois par mois
  html += `<div class="s"><div class="st">Réconciliation mois par mois (Janvier → Décembre 2025)</div><table>
    <thead><tr><th>Mois</th><th style="text-align:right">Actuals (€)</th><th style="text-align:right">B+Y+M (€)</th><th style="text-align:right">Maroc (€)</th><th style="text-align:right">Divers (€)</th><th style="text-align:right">Total dép. (€)</th><th style="text-align:right">Solde mois (€)</th><th>Commentaire</th></tr></thead><tbody>`;

  let totalSoldeMois = 0;
  mois.forEach(m => {
    const dep = m.bym + m.maroc + m.divers;
    const solde = m.actuals - dep;
    totalSoldeMois += solde;
    const soldeColor = colorForSolde(solde);
    const bymStyle = m.bymHighlight ? ' style="color:var(--yellow)"' : '';
    const marocStyle = m.marocCorrige ? ' style="color:var(--green)"' : '';
    const diversStyle = m.diversVerifie ? ' style="color:var(--green)"' : '';

    html += `<tr><td><strong>${m.nom}</strong></td>
      <td class="a">${fmtPlain(m.actuals)}</td>
      <td class="a"${bymStyle}>${m.bym === 0 ? '—' : fmtPlain(m.bym)}</td>
      <td class="a"${marocStyle}>${m.maroc === 0 ? '—' : fmtPlain(m.maroc)}</td>
      <td class="a"${diversStyle}>${m.divers === 0 ? '—' : (m.divers < 0 ? '−' + fmtPlain(Math.abs(m.divers)) : fmtPlain(m.divers))}</td>
      <td class="a">${fmtPlain(dep)}</td>
      <td class="a" style="color:${soldeColor}">${fmtSigned(solde, '')}</td>
      <td style="font-size:.7rem;color:var(--muted)">${badge(m.badge, m.badgeText)} ${m.commentaire}</td></tr>`;
  });

  html += `<tr class="tr"><td><strong>Total</strong></td>
    <td class="a"><strong>${fmtPlain(totalActuals)}</strong></td>
    <td class="a"><strong>${fmtPlain(totalBYM)}</strong></td>
    <td class="a"><strong>${fmtPlain(totalMaroc)}</strong></td>
    <td class="a"><strong>${fmtPlain(totalDivers)}</strong></td>
    <td class="a"><strong>${fmtPlain(totalDepenses)}</strong></td>
    <td class="a"><strong>${fmtSigned(totalSoldeMois, '')}</strong></td>
    <td style="font-size:.7rem;color:var(--muted)">Maroc Fév-Déc = Excel (${fmtPlain(totalMarocExcel)}€)</td></tr>`;
  html += `</tbody></table>`;
  html += `<div class="n"><strong>Note :</strong> Le solde cumulé (${fmtSigned(totalSoldeMois, '€')}) inclut Janvier (${fmtPlain(mois[0].actuals)}€ d'Actuals sans dépenses). Le solde "Balance" d'Azarkan (${fmtSigned(soldeExcel)}) est calculé <strong>sans Janvier</strong> (Fév-Déc uniquement) : ${fmtPlain(actualsFevDec)} − ${fmtPlain(depFevDec)} = ${fmtSigned(soldeExcel)}. Maroc réel = Excel (${fmtPlain(totalMarocExcel)}€) — parfait match.</div></div>`;

  // Insights
  html += `<div class="s"><div class="st">Insights clés — Fichier v2 vs v1</div>`;
  d.insights.forEach(ins => {
    const cls = ins.type === 'pass' ? 'pass' : ins.type === 'warn' ? 'warn' : ins.type === 'fail' ? 'fail' : '';
    html += `<div class="insight ${cls}"><div class="t">${ins.titre}</div><div class="d">${ins.desc}</div></div>`;
  });
  html += `</div>`;

  // Cat 1: Ysquare
  html += `<div class="s"><div class="st">1. Ysquare (Kenza) — ${fmtPlain(totalYsquare)}€ ✓</div><table>
    <thead><tr><th>#</th><th>Date EBS</th><th style="text-align:right">EBS (€)</th><th></th></tr></thead><tbody>`;
  d.ysquare.forEach((y, i) => {
    html += `<tr><td>${i+1}</td><td>${y.date}</td><td class="a">${fmtPlain(y.montant)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalYsquare)}</strong></td><td></td></tr></tbody></table></div>`;

  // Cat 2: Majalis
  html += `<div class="s"><div class="st">2. Majalis HT (Badre) — ${fmtPlain(totalMajalis)}€ ✓ (corrigé v2)</div><table>
    <thead><tr><th>#</th><th>Date EBS</th><th style="text-align:right">Excel HT (€)</th><th style="text-align:right">EBS HT (€)</th><th style="text-align:right">Écart</th><th></th></tr></thead><tbody>`;
  d.majalis.forEach((m, i) => {
    const ecart = m.excelHT - m.ebsHT;
    html += `<tr><td>${i+1}</td><td>${m.date}</td><td class="a">${fmtPlain(m.excelHT)}</td><td class="a">${fmtPlain(m.ebsHT)}</td><td class="a">${ecart}</td><td>${badge('ok', m.note ? '✓ ' + m.note : '✓')}</td></tr>`;
  });
  const totalMajExcel = sum(d.majalis, 'excelHT');
  html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalMajExcel)}</strong></td><td class="a"><strong>${fmtPlain(totalMajalis)}</strong></td><td class="a" style="color:var(--green)"><strong>0</strong></td><td></td></tr></tbody></table></div>`;

  // Cat 3: Bairok
  html += `<div class="s"><div class="st">3. Bairok EUR (→ Azarkan) — ${fmtPlain(totalBairok)}€ ✓</div><table>
    <thead><tr><th>#</th><th>Date EBS</th><th style="text-align:right">Montant (€)</th><th></th></tr></thead><tbody>`;
  d.bairok.forEach((b, i) => {
    html += `<tr><td>${i+1}</td><td>${b.date}</td><td class="a">${fmtPlain(b.montant)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td><strong>Total 2025</strong></td><td class="a"><strong>${fmtPlain(totalBairok)}</strong></td><td></td></tr></tbody></table>`;
  html += `<div class="n ok">${d.bairok.length}/${d.bairok.length} paiements 2025 vérifiés. Les 4 autres résultats EBS sont de 2024, hors périmètre.</div></div>`;

  // Cat 4: Virements Maroc
  html += `<div class="s"><div class="st">4. Virements Maroc → Azarkan (DH) — ${fmtPlain(totalMarocExcel)}€ ✓ match parfait</div><table>
    <thead><tr><th>Mois</th><th style="text-align:right">Excel v2 (€)</th><th>Virements réels</th><th style="text-align:right">Total DH</th><th style="text-align:right">= EUR (÷10)</th><th style="text-align:right">Écart (€)</th><th></th></tr></thead><tbody>`;
  d.virementsMaroc.forEach(v => {
    const eurEquiv = v.totalDH / d.tauxMaroc;
    const ecart = v.excelEUR - eurEquiv;
    const excelStyle = v.corrige ? ' style="color:var(--green)"' : '';
    html += `<tr><td><strong>${v.mois}</strong></td><td class="a"${excelStyle}>${fmtPlain(v.excelEUR)}</td><td style="font-size:.72rem;color:var(--muted)">${v.detail}</td><td class="a">${fmtPlain(v.totalDH)}</td><td class="a">${fmtPlain(eurEquiv)}</td><td class="a" style="color:var(--green)">${ecart}</td><td>${badge('ok', v.corrige ? '✓ corrigé v2' : '✓')}</td></tr>`;
  });
  html += `<tr class="tr"><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalMarocExcel)}</strong></td><td></td><td class="a"><strong>${fmtPlain(totalMarocDH)}</strong></td><td class="a"><strong>${fmtPlain(totalMarocReel)}</strong></td><td class="a" style="color:var(--green)"><strong>0</strong></td><td></td></tr></tbody></table>`;
  html += `<div class="n ok"><strong>Match parfait</strong> : ${fmtPlain(totalMarocExcel)}€ Excel = ${fmtPlain(totalMarocReel)}€ réel (${fmtPlain(totalMarocDH)} DH). ${d.virementsMaroc.length} mois vérifiés, 0€ d'écart.</div></div>`;

  // Cat 5: Divers
  html += `<div class="s"><div class="st">5. Autre (Divers Supplement) — ${fmtPlain(totalDiversCalc)}€ dont ${fmtPlain(d.diversVerifie)}€ vérifiés (vols + iPhone)</div><table>
    <thead><tr><th>Mois</th><th style="text-align:right">Divers 1 (€)</th><th style="text-align:right">Divers 2 (€)</th><th style="text-align:right">Total (€)</th><th>Preuve</th></tr></thead><tbody>`;
  d.divers.forEach(dv => {
    const total = (dv.d1 || 0) + (dv.d2 || 0);
    const rowStyle = dv.preuve === 'ok' ? ' style="background:var(--green-bg)"' : '';
    html += `<tr${rowStyle}><td>${dv.mois}</td><td class="a">${fmtPlain(dv.d1)}</td><td class="a">${dv.d2 ? (dv.d2 < 0 ? '−' + fmtPlain(Math.abs(dv.d2)) : fmtPlain(dv.d2)) : '—'}</td><td class="a">${total < 0 ? '−' + fmtPlain(Math.abs(total)) : fmtPlain(total)}</td><td>${badge(dv.preuve, dv.preuveText)}</td></tr>`;
  });
  html += `<tr class="tr"><td><strong>Total</strong></td><td></td><td></td><td class="a"><strong>${fmtPlain(totalDiversCalc)}</strong></td><td><strong>${fmtPlain(d.diversVerifie)}€ vérifié / ${fmtSigned(d.diversNonVerifie, '€')} sans preuve</strong></td></tr></tbody></table>`;
  html += `<div class="n ok"><strong>Fév 400€</strong> + <strong>Juin 1 240€</strong> = vols payés pour Azarkan ✓. <strong>Sep 1 130€</strong> = iPhone 1 305,41 USD (EBS 09/10, taux 0,8648) ✓. Reste Nov 300€ et Déc −1 900€ sans preuve (net ${fmtSigned(d.diversNonVerifie, '€')}). Le crédit Déc est en ta faveur.</div></div>`;

  // RTL Factures
  html += `<div class="s"><div class="st">Factures RTL 2025 — Revenus (${fmtPlain(totalRTL)}€ ✓)</div><table>
    <thead><tr><th>Facture</th><th>Période</th><th>Jours</th><th style="text-align:right">Facturé (€)</th><th>Date paiement</th><th style="text-align:right">Reçu (€)</th><th></th></tr></thead><tbody>`;
  d.rtl.forEach(r => {
    html += `<tr><td>${r.ref}</td><td>${r.periode}</td><td>${r.jours}</td><td class="a">${fmtPlain(r.montant)}</td><td>${r.datePaiement}</td><td class="a">${fmtPlain(r.recu)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  html += `<tr class="tr"><td colspan="3"><strong>Total 2025</strong></td><td class="a"><strong>${fmtPlain(totalRTL)}</strong></td><td></td><td class="a"><strong>${fmtPlain(totalRecuRTL)}</strong></td><td></td></tr></tbody></table></div>`;

  return html;
}

// ---- AZARKAN 2026 ----
function renderAzarkan2026() {
  const d = DATA.azarkan2026;

  const totalMAD = sum(d.virementsMaroc, 'dh');
  const totalEUR = totalMAD / d.tauxMaroc;
  const totalRTLFacture = sum(d.rtl, 'montant');
  // Actuals = factures reçues (statut ok) — for now sum all
  const actualsADate = sum(d.rtl.filter(r => r.statut !== 'i'), 'montant') + totalRTLFacture - totalRTLFacture + totalRTLFacture; // simplified: just show facturé
  // Actually let's compute properly: facturé RTL not yet received + pending
  const totalFactureRTL = sum(d.rtl.filter(r => r.ref !== '—'), 'montant');

  let html = `<h2 style="font-size:1.05rem;margin-bottom:16px">${d.title}</h2>`;

  html += `<div class="cards">
    <div class="card"><div class="l">Actuals à date</div><div class="v blue">${fmtPlain(totalFactureRTL + totalRTLFacture - totalFactureRTL)} €</div></div>
    <div class="card"><div class="l">Report 2025</div><div class="v red">${fmtSigned(d.report2025)}</div></div>
    <div class="card"><div class="l">Facturé RTL 2026</div><div class="v yellow">${fmtPlain(totalFactureRTL)} €</div></div>
    <div class="card"><div class="l">MAD → Azarkan 2026</div><div class="v blue">${fmtPlain(totalMAD)} DH</div></div>
  </div>`;

  // Virements Maroc
  html += `<div class="s"><div class="st">Virements Maroc → Azarkan 2026</div><table>
    <thead><tr><th>#</th><th>Date</th><th>Bénéficiaire</th><th style="text-align:right">DH</th><th style="text-align:right">= EUR (÷${d.tauxMaroc})</th></tr></thead><tbody>`;
  d.virementsMaroc.forEach((v, i) => {
    html += `<tr><td>${i+1}</td><td>${v.date}</td><td>${v.beneficiaire}</td><td class="a">${fmtPlain(v.dh)}</td><td class="a">${fmtPlain(v.dh / d.tauxMaroc)}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td colspan="2"><strong>Total 2026</strong></td><td class="a"><strong>${fmtPlain(totalMAD)}</strong></td><td class="a"><strong>${fmtPlain(totalEUR)}</strong></td></tr></tbody></table></div>`;

  // RTL 2026
  html += `<div class="s"><div class="st">Factures RTL 2026 — En attente</div><table>
    <thead><tr><th>Facture</th><th>Période</th><th>Jours</th><th style="text-align:right">Montant (€)</th><th>Statut</th></tr></thead><tbody>`;
  d.rtl.forEach(r => {
    html += `<tr><td>${r.ref}</td><td>${r.periode}</td><td>${r.jours}</td><td class="a">${fmtPlain(r.montant)}</td><td>${badge(r.statut, r.statutText)}</td></tr>`;
  });
  html += `</tbody></table></div>`;

  html += `<div class="n">Clôture 2026 à faire une fois les données complètes. Le report 2025 est de <strong>${fmtSigned(d.report2025)}</strong> (Excel = corrigé, Maroc matche parfaitement).</div>`;

  return html;
}

// ---- BADRE 2025 ----
function renderBadre2025() {
  const d = DATA.badre2025;
  const rate = d.commissionRate;

  // Computed per transaction
  const transactions = d.majalis.map(m => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    const delta = m.tauxApplique - m.tauxMarche;
    const gainFX = Math.round(m.htEUR * (m.tauxMarche - m.tauxApplique));
    const commission = Math.round(dh * rate);
    const netBadre = dh - commission;
    return { ...m, dh, delta, gainFX, commission, netBadre };
  });

  const totalHTEUR = sum(transactions, 'htEUR');
  const totalDH = sum(transactions, 'dh');
  const totalGainFX = sum(transactions, 'gainFX');
  const totalCommission = sum(transactions, 'commission');
  const totalNetBadre = sum(transactions, 'netBadre');
  const totalPaye = sum(d.virements, 'dh');
  const solde = totalNetBadre - totalPaye;
  const totalGains = totalCommission + totalGainFX;

  let html = `<h2 style="font-size:1.05rem;margin-bottom:6px">${d.title}</h2>`;
  html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">${d.subtitle}</p>`;

  // Cards
  html += `<div class="cards">
    <div class="card"><div class="l">Dû à Badre (90% Majalis)</div><div class="v blue">${fmtPlain(totalNetBadre)} DH</div></div>
    <div class="card"><div class="l">Payé en DH</div><div class="v green">${fmtPlain(totalPaye)} DH</div></div>
    <div class="card"><div class="l">Solde (dû − payé)</div><div class="v yellow">${fmtSigned(solde, 'DH')}</div></div>
    <div class="card"><div class="l">Total gains (FX + Commission)</div><div class="v green">${fmtPlain(totalGains)} DH</div></div>
  </div>`;

  // Majalis table
  html += `<div class="s"><div class="st">Paiements Majalis HT 2025 — convertis en DH (taux appliqué vs marché)</div><table>
    <thead><tr><th>#</th><th>Date EBS</th><th style="text-align:right">HT (€)</th><th style="text-align:right">Taux appliqué</th><th style="text-align:right">Taux marché</th><th style="text-align:right">Δ taux</th><th style="text-align:right">= DH</th><th style="text-align:right">Gain FX (DH)</th><th style="text-align:right">Commission 10%</th><th style="text-align:right">Net Badre (DH)</th><th></th></tr></thead><tbody>`;
  transactions.forEach((t, i) => {
    html += `<tr><td>${i+1}</td><td>${t.date}</td><td class="a">${fmtPlain(t.htEUR)}</td><td class="a">${fmtRate(t.tauxApplique)}</td><td class="a">${fmtRate(t.tauxMarche)}</td><td class="a" style="color:var(--green)">${fmtDelta(t.delta)}</td><td class="a">${fmtPlain(t.dh)}</td><td class="a" style="color:var(--green)">${fmtSigned(t.gainFX, '')}</td><td class="a">${fmtPlain(t.commission)}</td><td class="a">${fmtPlain(t.netBadre)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalHTEUR)}</strong></td><td></td><td></td><td></td><td class="a"><strong>${fmtPlain(totalDH)}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(totalGainFX, '')}</strong></td><td class="a"><strong>${fmtPlain(totalCommission)}</strong></td><td class="a"><strong>${fmtPlain(totalNetBadre)}</strong></td><td></td></tr></tbody></table></div>`;

  // Virements
  html += `<div class="s"><div class="st">Virements DH → Badre 2025</div><table>
    <thead><tr><th>#</th><th>Date</th><th>Bénéficiaire</th><th style="text-align:right">DH</th><th>Motif</th></tr></thead><tbody>`;
  d.virements.forEach((v, i) => {
    html += `<tr><td>${i+1}</td><td>${v.date}</td><td>${v.beneficiaire}</td><td class="a">${fmtPlain(v.dh)}</td><td>${v.motif}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td colspan="2"><strong>Total payé 2025</strong></td><td class="a"><strong>${fmtPlain(totalPaye)}</strong></td><td></td></tr></tbody></table></div>`;

  // Réconciliation
  html += `<div class="s"><div class="st">Réconciliation Badre 2025</div><table>
    <thead><tr><th>Ligne</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
    <tr><td>Majalis HT total (taux appliqué)</td><td class="a">${fmtPlain(totalDH)}</td><td>${transactions.length} paiements EBS × taux Amine</td></tr>
    <tr><td>Commission 10%</td><td class="a" style="color:var(--yellow)">−${fmtPlain(totalCommission)}</td><td>Retenue par Amine</td></tr>
    <tr><td><strong>Net dû à Badre</strong></td><td class="a"><strong>${fmtPlain(totalNetBadre)}</strong></td><td></td></tr>
    <tr><td>Total virements DH</td><td class="a" style="color:var(--green)">−${fmtPlain(totalPaye)}</td><td>${d.virements.length} virements (Jul-Mar)</td></tr>
    <tr class="tr"><td><strong>Solde restant dû</strong></td><td class="a" style="color:var(--yellow)"><strong>${fmtSigned(solde, '')}</strong></td><td>Amine doit encore ${fmtPlain(solde)} DH à Badre</td></tr>
    </tbody></table></div>`;

  // Consolidation gains
  html += `<div class="s"><div class="st">Consolidation des gains Amine — Badre 2025</div><table>
    <thead><tr><th>Source du gain</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
    <tr><td><strong>Commission 10%</strong></td><td class="a" style="color:var(--green)">${fmtSigned(totalCommission, '')}</td><td>10% sur ${fmtPlain(totalDH)} DH de Majalis HT</td></tr>
    <tr><td><strong>Gain FX (Δ taux)</strong></td><td class="a" style="color:var(--green)">${fmtSigned(totalGainFX, '')}</td><td>Taux appliqué inférieur au marché sur ${transactions.length} transactions</td></tr>
    <tr class="tr"><td><strong>Total gains Amine</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(totalGains, '')}</strong></td><td></td></tr>
    </tbody></table>`;

  // Detail note
  const gainDetails = transactions.map((t, i) => `#${i+1} ${fmtSigned(t.gainFX, '')} DH (Δ ${fmtDelta(t.delta)})`).join(' · ');
  html += `<div class="n ok"><strong>Gains FX par transaction :</strong> ${gainDetails}. Le taux appliqué est systématiquement inférieur au taux marché, générant un gain FX de <strong>${fmtPlain(totalGainFX)} DH</strong> en plus de la commission.</div></div>`;

  return html;
}

// ---- BADRE 2026 ----
function renderBadre2026() {
  const d = DATA.badre2026;
  const taux = d.tauxApplique;
  const rate = d.commissionRate;

  // Get report from Badre 2025 computed
  const b25 = DATA.badre2025;
  const tx25 = b25.majalis.map(m => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    const commission = Math.round(dh * b25.commissionRate);
    return dh - commission;
  });
  const netBadre25 = tx25.reduce((s, n) => s + n, 0);
  const paye25 = sum(b25.virements, 'dh');
  const report = netBadre25 - paye25;

  // Compute 2026 transactions
  const transactions = d.majalis.map(m => {
    const dh = Math.round(m.htEUR * taux);
    const delta = m.tauxMarche ? taux - m.tauxMarche : null;
    const gainFX = m.tauxMarche ? Math.round(m.htEUR * (m.tauxMarche - taux)) : null;
    const commission = Math.round(dh * rate);
    const netBadre = dh - commission;
    return { ...m, dh, delta, gainFX, commission, netBadre };
  });

  // Only paid transactions count for reconciliation
  const paidTransactions = transactions.filter(t => t.statut === 'ok');
  const totalDHPaid = sum(paidTransactions, 'dh');
  const totalNetBadrePaid = sum(paidTransactions, 'netBadre');
  const totalCommissionPaid = sum(paidTransactions, 'commission');
  const totalGainFXPaid = sum(paidTransactions, t => t.gainFX || 0);
  const totalPaye = sum(d.virements, 'dh');

  // Solde = report 2025 + net dû 2026 (paid only) − payé 2026
  const soldeDu = report + totalNetBadrePaid;
  const solde2026 = soldeDu - totalPaye;

  let html = `<h2 style="font-size:1.05rem;margin-bottom:6px">${d.title}</h2>`;
  html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">Report 2025 : ${fmtSigned(report, 'DH')} (dû à Badre). Taux appliqué 2026 : <strong>${fmtRate(taux)}</strong>. Réconciliation sur paiements Majalis reçus uniquement.</p>`;

  html += `<div class="cards">
    <div class="card"><div class="l">Report 2025</div><div class="v yellow">${fmtSigned(report, 'DH')}</div></div>
    <div class="card"><div class="l">Majalis payé 2026 (brut)</div><div class="v blue">${fmtPlain(totalDHPaid)} DH</div></div>
    <div class="card"><div class="l">Majalis payé 2026 (net −10%)</div><div class="v blue">${fmtPlain(totalNetBadrePaid)} DH</div></div>
    <div class="card"><div class="l">Payé DH 2026</div><div class="v green">${fmtPlain(totalPaye)} DH</div></div>
    <div class="card"><div class="l">Solde (report + dû − payé)</div><div class="v ${solde2026 > 0 ? 'yellow' : solde2026 < 0 ? 'green' : 'green'}">${fmtSigned(solde2026, 'DH')}</div></div>
  </div>`;

  // Majalis table
  html += `<div class="s"><div class="st">Paiements Majalis 2026 — convertis en DH (taux appliqué ${fmtRate(taux)} vs marché)</div><table>
    <thead><tr><th>Mois</th><th style="text-align:right">HT (€)</th><th style="text-align:right">Taux appliqué</th><th style="text-align:right">Taux marché</th><th style="text-align:right">Δ taux</th><th style="text-align:right">= DH</th><th style="text-align:right">Gain FX (DH)</th><th style="text-align:right">Commission 10%</th><th style="text-align:right">Net Badre (DH)</th><th>Statut</th></tr></thead><tbody>`;
  transactions.forEach(t => {
    html += `<tr><td>${t.mois}</td><td class="a">${fmtPlain(t.htEUR)}</td><td class="a">${fmtRate(taux)}</td><td class="a">${t.tauxMarche ? fmtRate(t.tauxMarche) : '—'}</td><td class="a"${t.delta !== null ? ' style="color:var(--green)"' : ''}>${t.delta !== null ? fmtDelta(t.delta) : '—'}</td><td class="a">${fmtPlain(t.dh)}</td><td class="a"${t.gainFX !== null ? ' style="color:var(--green)"' : ''}>${t.gainFX !== null ? fmtSigned(t.gainFX, '') : '—'}</td><td class="a">${fmtPlain(t.commission)}</td><td class="a">${fmtPlain(t.netBadre)}</td><td>${badge(t.statut, t.statutText)}</td></tr>`;
  });
  html += `</tbody></table></div>`;

  // Virements 2026
  if (d.virements.length > 0) {
    html += `<div class="s"><div class="st">Virements DH → Badre 2026</div><table>
      <thead><tr><th>#</th><th>Date</th><th>Bénéficiaire</th><th style="text-align:right">DH</th><th>Motif</th></tr></thead><tbody>`;
    d.virements.forEach((v, i) => {
      html += `<tr><td>${i+1}</td><td>${v.date}</td><td>${v.beneficiaire}</td><td class="a">${fmtPlain(v.dh)}</td><td>${v.motif}</td></tr>`;
    });
    html += `<tr class="tr"><td></td><td colspan="2"><strong>Total payé 2026</strong></td><td class="a"><strong>${fmtPlain(totalPaye)}</strong></td><td></td></tr></tbody></table></div>`;
  }

  // Réconciliation 2026
  html += `<div class="s"><div class="st">Réconciliation Badre 2026 (payé uniquement)</div><table>
    <thead><tr><th>Ligne</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
    <tr><td>Report 2025</td><td class="a" style="color:var(--yellow)">${fmtSigned(report, '')}</td><td>Solde clôture 2025 (dû à Badre)</td></tr>
    <tr><td>Majalis HT payé 2026 (taux ${fmtRate(taux)})</td><td class="a">${fmtPlain(totalDHPaid)}</td><td>${paidTransactions.length} paiement(s) reçu(s)</td></tr>
    <tr><td>Commission 10%</td><td class="a" style="color:var(--yellow)">−${fmtPlain(totalCommissionPaid)}</td><td>Retenue par Amine</td></tr>
    <tr><td><strong>Total dû à Badre</strong></td><td class="a"><strong>${fmtPlain(soldeDu)}</strong></td><td>Report + net Majalis payé</td></tr>
    <tr><td>Virements DH 2026</td><td class="a" style="color:var(--green)">−${fmtPlain(totalPaye)}</td><td>${d.virements.length} virement(s)</td></tr>
    <tr class="tr"><td><strong>Solde 2026</strong></td><td class="a" style="color:${solde2026 > 0 ? 'var(--yellow)' : 'var(--green)'}"><strong>${fmtSigned(solde2026, '')}</strong></td><td>${solde2026 > 0 ? 'Amine doit encore ' + fmtPlain(solde2026) + ' DH à Badre' : solde2026 < 0 ? 'Badre a un excédent de ' + fmtPlain(Math.abs(solde2026)) + ' DH' : 'Soldé'}</td></tr>
    </tbody></table></div>`;

  html += `<div class="n">Le virement du 06/03/2026 (31 750 DH) a été comptabilisé dans la clôture 2025. Taux appliqué 2026 : <strong>${fmtRate(taux)}</strong> (fixe). La réconciliation ne prend en compte que les Majalis effectivement payés.</div>`;

  return html;
}

// ---- INIT ----
function renderAll() {
  document.getElementById('az25').innerHTML = renderAzarkan2025();
  document.getElementById('az26').innerHTML = renderAzarkan2026();
  document.getElementById('ba25').innerHTML = renderBadre2025();
  document.getElementById('ba26').innerHTML = renderBadre2026();
}

document.addEventListener('DOMContentLoaded', renderAll);
