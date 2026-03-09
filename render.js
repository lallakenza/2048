// ============================================================
// RENDER.JS — Génère tout le HTML à partir de DATA (data.js)
// Ne pas modifier ce fichier pour changer les chiffres
// ============================================================

// ---- MODE ----
window.PRIV = false;

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

// ---- YEAR TOGGLE HELPER ----
function yearToggle(section, activeYear) {
  return `<div class="year-toggle">
    <div class="year-btn ${activeYear===2025?'active':''}" data-year="2025" onclick="switch${section}Year(2025)">2025</div>
    <div class="year-btn ${activeYear===2026?'active':''}" data-year="2026" onclick="switch${section}Year(2026)">2026</div>
  </div>`;
}

// ---- AUGUSTIN 2025 ----
function renderAugustin2025() {
  const d = DATA.augustin2025;
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

  // Ycarré total
  const totalYcarré = sum(d.ycarre, 'montant');
  // Councils total
  const totalCouncils = sum(d.councils, 'ebsHT');
  // Baraka total
  const totalBaraka = sum(d.baraka, 'montant');
  // Maroc total (from virements)
  const totalMarocExcel = sum(d.virementsMaroc, 'excelEUR');
  const totalMarocDH = sum(d.virementsMaroc, 'totalDH');
  const totalMarocReel = totalMarocDH / d.tauxMaroc;
  // Divers total
  const totalDiversCalc = sum(d.divers, x => (x.d1 || 0) + (x.d2 || 0));
  // RTL total
  const totalRTL = sum(d.rtl, 'montant');
  const totalRecuRTL = sum(d.rtl, 'recu');

  let html = yearToggle('Az', 2025);

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
    { nom: "1. Ycarré (Oum Yakout)", excel: totalYcarré, verifie: totalYcarré, statut: `✓ ${d.ycarre.length}/${d.ycarre.length} match` },
    { nom: "2. Councils HT (Benoit)", excel: totalCouncils, verifie: totalCouncils, statut: `✓ ${d.councils.length}/${d.councils.length} corrigé` },
    { nom: "3. Baraka (→ Augustin EUR)", excel: totalBaraka, verifie: totalBaraka, statut: `✓ ${d.baraka.length}/${d.baraka.length} match` },
    { nom: "4. Virements Maroc (→ Augustin DH)", excel: totalMarocExcel, verifie: totalMarocReel, statut: `✓ ${d.virementsMaroc.length}/${d.virementsMaroc.length} match` },
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
    <strong>Résultat (Excel v2) :</strong> Augustin a largement corrigé son fichier. Les 3 catégories EBS (Ycarré, Councils, Baraka) matchent à 100%. Le Maroc Fév-Déc matche parfaitement (${fmtPlain(totalMarocExcel)}€ Excel = ${fmtPlain(totalMarocReel)}€ réel). Les Divers sont maintenant largement vérifiés : <strong>Fév 400€ + Juin 1 240€ = vols pour Augustin</strong>, <strong>Sep 1 130€ = iPhone 1 305,41 USD (EBS)</strong>. Il reste seulement Nov 300€ et Déc −1 900€ sans preuve (net ${fmtSigned(d.diversNonVerifie, '€')}).<br><br>
    Solde Excel = Solde corrigé : <strong>${fmtSigned(soldeExcel)}</strong> (Augustin te doit).<br>
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
  html += `<div class="n"><strong>Note :</strong> Le solde cumulé (${fmtSigned(totalSoldeMois, '€')}) inclut Janvier (${fmtPlain(mois[0].actuals)}€ d'Actuals sans dépenses). Le solde "Balance" d'Augustin (${fmtSigned(soldeExcel)}) est calculé <strong>sans Janvier</strong> (Fév-Déc uniquement) : ${fmtPlain(actualsFevDec)} − ${fmtPlain(depFevDec)} = ${fmtSigned(soldeExcel)}. Maroc réel = Excel (${fmtPlain(totalMarocExcel)}€) — parfait match.</div></div>`;

  // Insights
  html += `<div class="s"><div class="st">Insights clés — Fichier v2 vs v1</div>`;
  d.insights.forEach(ins => {
    const cls = ins.type === 'pass' ? 'pass' : ins.type === 'warn' ? 'warn' : ins.type === 'fail' ? 'fail' : '';
    html += `<div class="insight ${cls}"><div class="t">${ins.titre}</div><div class="d">${ins.desc}</div></div>`;
  });
  html += `</div>`;

  // Cat 1: Ycarré
  html += `<div class="s"><div class="st">1. Ycarré (Oum Yakout) — ${fmtPlain(totalYcarré)}€ ✓</div><table>
    <thead><tr><th>#</th><th>Date EBS</th><th style="text-align:right">EBS (€)</th><th></th></tr></thead><tbody>`;
  d.ycarre.forEach((y, i) => {
    html += `<tr><td>${i+1}</td><td>${y.date}</td><td class="a">${fmtPlain(y.montant)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalYcarré)}</strong></td><td></td></tr></tbody></table></div>`;

  // Cat 2: Councils
  html += `<div class="s"><div class="st">2. Councils HT (Benoit) — ${fmtPlain(totalCouncils)}€ ✓ (corrigé v2)</div><table>
    <thead><tr><th>#</th><th>Date EBS</th><th style="text-align:right">Excel HT (€)</th><th style="text-align:right">EBS HT (€)</th><th style="text-align:right">Écart</th><th></th></tr></thead><tbody>`;
  d.councils.forEach((m, i) => {
    const ecart = m.excelHT - m.ebsHT;
    html += `<tr><td>${i+1}</td><td>${m.date}</td><td class="a">${fmtPlain(m.excelHT)}</td><td class="a">${fmtPlain(m.ebsHT)}</td><td class="a">${ecart}</td><td>${badge('ok', m.note ? '✓ ' + m.note : '✓')}</td></tr>`;
  });
  const totalMajExcel = sum(d.councils, 'excelHT');
  html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalMajExcel)}</strong></td><td class="a"><strong>${fmtPlain(totalCouncils)}</strong></td><td class="a" style="color:var(--green)"><strong>0</strong></td><td></td></tr></tbody></table></div>`;

  // Cat 3: Baraka
  html += `<div class="s"><div class="st">3. Baraka EUR (→ Augustin) — ${fmtPlain(totalBaraka)}€ ✓</div><table>
    <thead><tr><th>#</th><th>Date EBS</th><th style="text-align:right">Montant (€)</th><th></th></tr></thead><tbody>`;
  d.baraka.forEach((b, i) => {
    html += `<tr><td>${i+1}</td><td>${b.date}</td><td class="a">${fmtPlain(b.montant)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td><strong>Total 2025</strong></td><td class="a"><strong>${fmtPlain(totalBaraka)}</strong></td><td></td></tr></tbody></table>`;
  html += `<div class="n ok">${d.baraka.length}/${d.baraka.length} paiements 2025 vérifiés. Les 4 autres résultats EBS sont de 2024, hors périmètre.</div></div>`;

  // Cat 4: Virements Maroc
  html += `<div class="s"><div class="st">4. Virements Maroc → Augustin (DH) — ${fmtPlain(totalMarocExcel)}€ ✓ match parfait</div><table>
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
  html += `<div class="n ok"><strong>Fév 400€</strong> + <strong>Juin 1 240€</strong> = vols payés pour Augustin ✓. <strong>Sep 1 130€</strong> = iPhone 1 305,41 USD (EBS 09/10, taux 0,8648) ✓. Reste Nov 300€ et Déc −1 900€ sans preuve (net ${fmtSigned(d.diversNonVerifie, '€')}). Le crédit Déc est en ta faveur.</div></div>`;

  // RTL Factures
  html += `<div class="s"><div class="st">Factures RTL 2025 — Revenus (${fmtPlain(totalRTL)}€ ✓)</div><table>
    <thead><tr><th>Facture</th><th>Période</th><th>Jours</th><th style="text-align:right">Facturé (€)</th><th>Date paiement</th><th style="text-align:right">Reçu (€)</th><th></th></tr></thead><tbody>`;
  d.rtl.forEach(r => {
    html += `<tr><td>${r.ref}</td><td>${r.periode}</td><td>${r.jours}</td><td class="a">${fmtPlain(r.montant)}</td><td>${r.datePaiement}</td><td class="a">${fmtPlain(r.recu)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  html += `<tr class="tr"><td colspan="3"><strong>Total 2025</strong></td><td class="a"><strong>${fmtPlain(totalRTL)}</strong></td><td></td><td class="a"><strong>${fmtPlain(totalRecuRTL)}</strong></td><td></td></tr></tbody></table></div>`;

  return html;
}

// ---- AUGUSTIN 2026 ----
function renderAugustin2026() {
  const d = DATA.augustin2026;

  const totalMAD = sum(d.virementsMaroc, 'dh');
  const totalEUR = totalMAD / d.tauxMaroc;

  // Facturé (accrual) = toutes les factures RTL 2026 (émises + à facturer)
  const totalFacture = sum(d.rtl, 'montant');
  // Facturé mais pas encore payé = factures émises (ref !== '—') pas encore reçues
  const totalFactureEmis = sum(d.rtl.filter(r => r.ref !== '—'), 'montant');
  // Amine a reçu = factures RTL effectivement payées (statut 'ok')
  const amineRecu = sum(d.rtl.filter(r => r.statut === 'ok'), 'montant');
  // Augustin a reçu = virements Maroc en EUR
  const augustinRecuEUR = totalEUR;
  // Delta = Amine reçu − Augustin reçu + report 2025
  const delta = amineRecu - augustinRecuEUR + d.report2025;

  let html = yearToggle('Az', 2026);
  html += `<h2 style="font-size:1.05rem;margin-bottom:16px">${d.title}</h2>`;

  html += `<div class="cards">
    <div class="card"><div class="l">Facturé (accrual)</div><div class="v yellow">${fmtPlain(totalFacture)} €</div></div>
    <div class="card"><div class="l">Amine a reçu</div><div class="v ${amineRecu > 0 ? 'green' : 'red'}">${fmtPlain(amineRecu)} €</div></div>
    <div class="card"><div class="l">Augustin a reçu</div><div class="v blue">${fmtPlain(augustinRecuEUR)} €</div></div>
    <div class="card"><div class="l">Delta (Amine − Augustin)</div><div class="v ${delta >= 0 ? 'green' : 'red'}">${fmtSigned(delta)}</div></div>
  </div>`;

  // Réconciliation résumé
  html += `<div class="s"><div class="st">Réconciliation 2026 — Facturé vs Reçu</div><table>
    <thead><tr><th>Ligne</th><th style="text-align:right">EUR</th><th>Détail</th></tr></thead><tbody>
    <tr><td>Facturé RTL (accrual)</td><td class="a" style="color:var(--yellow)">${fmtPlain(totalFacture)}</td><td>${d.rtl.length} factures (Jan–Mar 2026)</td></tr>
    <tr><td>dont émises (en attente paiement)</td><td class="a">${fmtPlain(totalFactureEmis)}</td><td>${d.rtl.filter(r => r.ref !== '—').length} factures émises</td></tr>
    <tr><td>Amine a reçu (cash in)</td><td class="a" style="color:var(--green)">${fmtPlain(amineRecu)}</td><td>Factures RTL payées à ce jour</td></tr>
    <tr><td>Augustin a reçu (cash out)</td><td class="a" style="color:var(--blue,#60a5fa)">${fmtPlain(augustinRecuEUR)}</td><td>${fmtPlain(totalMAD)} DH ÷ ${d.tauxMaroc}</td></tr>
    <tr><td>Report 2025</td><td class="a" style="color:var(--red)">${fmtSigned(d.report2025)}</td><td>Solde clôture 2025</td></tr>
    <tr class="tr"><td><strong>Delta net</strong></td><td class="a" style="color:${delta >= 0 ? 'var(--green)' : 'var(--red)'}"><strong>${fmtSigned(delta)}</strong></td><td>${delta < 0 ? 'Amine a avancé ' + fmtPlain(Math.abs(delta)) + '€ de plus' : 'Augustin doit ' + fmtPlain(delta) + '€'}</td></tr>
    </tbody></table></div>`;

  // Factures RTL 2026
  html += `<div class="s"><div class="st">Factures RTL 2026</div><table>
    <thead><tr><th>Facture</th><th>Période</th><th>Jours</th><th style="text-align:right">Montant (€)</th><th>Statut</th></tr></thead><tbody>`;
  d.rtl.forEach(r => {
    html += `<tr><td>${r.ref}</td><td>${r.periode}</td><td>${r.jours}</td><td class="a">${fmtPlain(r.montant)}</td><td>${badge(r.statut, r.statutText)}</td></tr>`;
  });
  html += `<tr class="tr"><td colspan="3"><strong>Total facturé</strong></td><td class="a"><strong>${fmtPlain(totalFacture)}</strong></td><td></td></tr></tbody></table></div>`;

  // Virements Maroc
  html += `<div class="s"><div class="st">Augustin a reçu — Virements Maroc 2026</div><table>
    <thead><tr><th>#</th><th>Date</th><th>Bénéficiaire</th><th style="text-align:right">DH</th><th style="text-align:right">= EUR (÷${d.tauxMaroc})</th></tr></thead><tbody>`;
  d.virementsMaroc.forEach((v, i) => {
    html += `<tr><td>${i+1}</td><td>${v.date}</td><td>${v.beneficiaire}</td><td class="a">${fmtPlain(v.dh)}</td><td class="a">${fmtPlain(v.dh / d.tauxMaroc)}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td colspan="2"><strong>Total 2026</strong></td><td class="a"><strong>${fmtPlain(totalMAD)}</strong></td><td class="a"><strong>${fmtPlain(totalEUR)}</strong></td></tr></tbody></table></div>`;

  html += `<div class="n">${delta < 0
    ? `<strong>Amine a avancé ${fmtPlain(Math.abs(delta))}€</strong> de plus qu'il n'a reçu. Les ${totalFactureEmis > 0 ? fmtPlain(totalFactureEmis) + '€ de factures RTL en attente' : 'factures RTL'} couvriront ce delta une fois payées.`
    : `Le solde est positif : Augustin doit ${fmtPlain(delta)}€ à Amine.`
  } Report 2025 : <strong>${fmtSigned(d.report2025)}</strong>.</div>`;

  return html;
}

// ---- BENOIT 2025 ----
function renderBenoit2025() {
  const d = DATA.benoit2025;
  const rate = d.commissionRate || 0; // 0 in public mode (encrypted)

  // Computed per transaction
  const transactions = d.councils.map(m => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    const delta = m.tauxMarche ? m.tauxApplique - m.tauxMarche : null;
    const gainFX = m.tauxMarche ? Math.round(m.htEUR * (m.tauxMarche - m.tauxApplique)) : 0;
    const commission = Math.round(dh * rate);
    const netBenoit = dh - commission;
    return { ...m, dh, delta, gainFX, commission, netBenoit };
  });

  const totalHTEUR = sum(transactions, 'htEUR');
  const totalDH = sum(transactions, 'dh');
  const totalGainFX = sum(transactions, 'gainFX');
  const totalCommission = sum(transactions, 'commission');
  const totalNetBenoit = sum(transactions, 'netBenoit');
  const totalPaye = sum(d.virements, 'dh');
  const solde = totalNetBenoit - totalPaye;
  const totalGains = totalCommission + totalGainFX;

  let html = yearToggle('Ba', 2025);
  html += `<h2 style="font-size:1.05rem;margin-bottom:6px">${d.title}</h2>`;
  html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">${d.subtitle}</p>`;

  // Cards
  if (window.PRIV) {
    html += `<div class="cards">
      <div class="card"><div class="l">Dû à Benoit (90% Councils)</div><div class="v blue">${fmtPlain(totalNetBenoit)} DH</div></div>
      <div class="card"><div class="l">Payé en DH</div><div class="v green">${fmtPlain(totalPaye)} DH</div></div>
      <div class="card"><div class="l">Solde (dû − payé)</div><div class="v yellow">${fmtSigned(solde, 'DH')}</div></div>
      <div class="card"><div class="l">Total gains (FX + Commission)</div><div class="v green">${fmtPlain(totalGains)} DH</div></div>
    </div>`;
  } else {
    html += `<div class="cards">
      <div class="card"><div class="l">Total Councils HT</div><div class="v blue">${fmtPlain(totalDH)} DH</div></div>
      <div class="card"><div class="l">Payé en DH</div><div class="v green">${fmtPlain(totalPaye)} DH</div></div>
    </div>`;
  }

  // Councils table
  if (window.PRIV) {
    html += `<div class="s"><div class="st">Paiements Councils HT 2025 — convertis en DH (taux appliqué vs marché)</div><table>
      <thead><tr><th>#</th><th>Date EBS</th><th style="text-align:right">HT (€)</th><th style="text-align:right">Taux appliqué</th><th style="text-align:right">Taux marché</th><th style="text-align:right">Δ taux</th><th style="text-align:right">= DH</th><th style="text-align:right">Gain FX (DH)</th><th style="text-align:right">Commission 10%</th><th style="text-align:right">Net Benoit (DH)</th><th></th></tr></thead><tbody>`;
    transactions.forEach((t, i) => {
      html += `<tr><td>${i+1}</td><td>${t.date}</td><td class="a">${fmtPlain(t.htEUR)}</td><td class="a">${fmtRate(t.tauxApplique)}</td><td class="a">${fmtRate(t.tauxMarche)}</td><td class="a" style="color:var(--green)">${fmtDelta(t.delta)}</td><td class="a">${fmtPlain(t.dh)}</td><td class="a" style="color:var(--green)">${fmtSigned(t.gainFX, '')}</td><td class="a">${fmtPlain(t.commission)}</td><td class="a">${fmtPlain(t.netBenoit)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
    });
    html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalHTEUR)}</strong></td><td></td><td></td><td></td><td class="a"><strong>${fmtPlain(totalDH)}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(totalGainFX, '')}</strong></td><td class="a"><strong>${fmtPlain(totalCommission)}</strong></td><td class="a"><strong>${fmtPlain(totalNetBenoit)}</strong></td><td></td></tr></tbody></table></div>`;
  } else {
    html += `<div class="s"><div class="st">Paiements Councils HT 2025 — convertis en DH</div><table>
      <thead><tr><th>#</th><th>Date EBS</th><th style="text-align:right">HT (€)</th><th style="text-align:right">Taux appliqué</th><th style="text-align:right">= DH</th><th></th></tr></thead><tbody>`;
    transactions.forEach((t, i) => {
      html += `<tr><td>${i+1}</td><td>${t.date}</td><td class="a">${fmtPlain(t.htEUR)}</td><td class="a">${fmtRate(t.tauxApplique)}</td><td class="a">${fmtPlain(t.dh)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
    });
    html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalHTEUR)}</strong></td><td></td><td class="a"><strong>${fmtPlain(totalDH)}</strong></td><td></td></tr></tbody></table></div>`;
  }

  // Virements
  html += `<div class="s"><div class="st">Virements DH → Benoit 2025</div><table>
    <thead><tr><th>#</th><th>Date</th><th>Bénéficiaire</th><th style="text-align:right">DH</th><th>Motif</th></tr></thead><tbody>`;
  d.virements.forEach((v, i) => {
    html += `<tr><td>${i+1}</td><td>${v.date}</td><td>${v.beneficiaire}</td><td class="a">${fmtPlain(v.dh)}</td><td>${v.motif}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td colspan="2"><strong>Total payé 2025</strong></td><td class="a"><strong>${fmtPlain(totalPaye)}</strong></td><td></td></tr></tbody></table></div>`;

  // Réconciliation
  if (window.PRIV) {
    html += `<div class="s"><div class="st">Réconciliation Benoit 2025</div><table>
      <thead><tr><th>Ligne</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
      <tr><td>Councils HT total (taux appliqué)</td><td class="a">${fmtPlain(totalDH)}</td><td>${transactions.length} paiements EBS × taux Amine</td></tr>
      <tr><td>Commission 10%</td><td class="a" style="color:var(--yellow)">−${fmtPlain(totalCommission)}</td><td>Retenue par Amine</td></tr>
      <tr><td><strong>Net dû à Benoit</strong></td><td class="a"><strong>${fmtPlain(totalNetBenoit)}</strong></td><td></td></tr>
      <tr><td>Total virements DH</td><td class="a" style="color:var(--green)">−${fmtPlain(totalPaye)}</td><td>${d.virements.length} virements (Jul-Mar)</td></tr>
      <tr class="tr"><td><strong>Solde restant dû</strong></td><td class="a" style="color:var(--yellow)"><strong>${fmtSigned(solde, '')}</strong></td><td>Amine doit encore ${fmtPlain(solde)} DH à Benoit</td></tr>
      </tbody></table></div>`;
  }

  // Consolidation gains (private only)
  if (window.PRIV) {
    html += `<div class="s"><div class="st">Consolidation des gains Amine — Benoit 2025</div><table>
      <thead><tr><th>Source du gain</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
      <tr><td><strong>Commission 10%</strong></td><td class="a" style="color:var(--green)">${fmtSigned(totalCommission, '')}</td><td>10% sur ${fmtPlain(totalDH)} DH de Councils HT</td></tr>
      <tr><td><strong>Gain FX (Δ taux)</strong></td><td class="a" style="color:var(--green)">${fmtSigned(totalGainFX, '')}</td><td>Taux appliqué inférieur au marché sur ${transactions.length} transactions</td></tr>
      <tr class="tr"><td><strong>Total gains Amine</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(totalGains, '')}</strong></td><td></td></tr>
      </tbody></table>`;

    const gainDetails = transactions.map((t, i) => `#${i+1} ${fmtSigned(t.gainFX, '')} DH (Δ ${fmtDelta(t.delta)})`).join(' · ');
    html += `<div class="n ok"><strong>Gains FX par transaction :</strong> ${gainDetails}. Le taux appliqué est systématiquement inférieur au taux marché, générant un gain FX de <strong>${fmtPlain(totalGainFX)} DH</strong> en plus de la commission.</div></div>`;
  }

  return html;
}

// ---- BENOIT 2026 ----
function renderBenoit2026() {
  const d = DATA.benoit2026;
  const taux = d.tauxApplique || 0;
  const rate = d.commissionRate || 0;

  // Get report from Benoit 2025 computed (only if PRIV data available)
  const b25 = DATA.benoit2025;
  const b25rate = b25.commissionRate || 0;
  const tx25 = b25.councils.map(m => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    const commission = Math.round(dh * b25rate);
    return dh - commission;
  });
  const netBenoit25 = tx25.reduce((s, n) => s + n, 0);
  const paye25 = sum(b25.virements, 'dh');
  const report = netBenoit25 - paye25;

  // Compute 2026 transactions
  const transactions = d.councils.map(m => {
    const dh = taux ? Math.round(m.htEUR * taux) : 0;
    const delta = m.tauxMarche && taux ? taux - m.tauxMarche : null;
    const gainFX = m.tauxMarche && taux ? Math.round(m.htEUR * (m.tauxMarche - taux)) : null;
    const commission = Math.round(dh * rate);
    const netBenoit = dh - commission;
    return { ...m, dh, delta, gainFX, commission, netBenoit };
  });

  // Only paid transactions count for reconciliation
  const paidTransactions = transactions.filter(t => t.statut === 'ok');
  const totalDHPaid = sum(paidTransactions, 'dh');
  const totalNetBenoitPaid = sum(paidTransactions, 'netBenoit');
  const totalCommissionPaid = sum(paidTransactions, 'commission');
  const totalGainFXPaid = sum(paidTransactions, t => t.gainFX || 0);
  const totalPaye = sum(d.virements, 'dh');

  // Solde = report 2025 + net dû 2026 (paid only) − payé 2026
  const soldeDu = report + totalNetBenoitPaid;
  const solde2026 = soldeDu - totalPaye;

  let html = yearToggle('Ba', 2026);
  html += `<h2 style="font-size:1.05rem;margin-bottom:6px">${d.title}</h2>`;
  if (window.PRIV) {
    html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">Report 2025 : ${fmtSigned(report, 'DH')} (dû à Benoit). Taux appliqué 2026 : <strong>${fmtRate(taux)}</strong>. Réconciliation sur paiements Councils reçus uniquement.</p>`;
    html += `<div class="cards">
      <div class="card"><div class="l">Report 2025</div><div class="v yellow">${fmtSigned(report, 'DH')}</div></div>
      <div class="card"><div class="l">Councils payé 2026 (brut)</div><div class="v blue">${fmtPlain(totalDHPaid)} DH</div></div>
      <div class="card"><div class="l">Councils payé 2026 (net −10%)</div><div class="v blue">${fmtPlain(totalNetBenoitPaid)} DH</div></div>
      <div class="card"><div class="l">Payé DH 2026</div><div class="v green">${fmtPlain(totalPaye)} DH</div></div>
      <div class="card"><div class="l">Solde (report + dû − payé)</div><div class="v ${solde2026 > 0 ? 'yellow' : solde2026 < 0 ? 'green' : 'green'}">${fmtSigned(solde2026, 'DH')}</div></div>
    </div>`;
  } else {
    html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">Paiements Councils 2026 en cours.</p>`;
    html += `<div class="cards">
      <div class="card"><div class="l">Paiements Councils</div><div class="v blue">${d.councils.length} factures</div></div>
      <div class="card"><div class="l">Payé DH 2026</div><div class="v green">${fmtPlain(totalPaye)} DH</div></div>
    </div>`;
  }

  // Councils table
  if (window.PRIV) {
    html += `<div class="s"><div class="st">Paiements Councils 2026 — convertis en DH (taux appliqué ${fmtRate(taux)} vs marché)</div><table>
      <thead><tr><th>Mois</th><th style="text-align:right">HT (€)</th><th style="text-align:right">Taux appliqué</th><th style="text-align:right">Taux marché</th><th style="text-align:right">Δ taux</th><th style="text-align:right">= DH</th><th style="text-align:right">Gain FX (DH)</th><th style="text-align:right">Commission 10%</th><th style="text-align:right">Net Benoit (DH)</th><th>Statut</th></tr></thead><tbody>`;
    transactions.forEach(t => {
      html += `<tr><td>${t.mois}</td><td class="a">${fmtPlain(t.htEUR)}</td><td class="a">${fmtRate(taux)}</td><td class="a">${t.tauxMarche ? fmtRate(t.tauxMarche) : '—'}</td><td class="a"${t.delta !== null ? ' style="color:var(--green)"' : ''}>${t.delta !== null ? fmtDelta(t.delta) : '—'}</td><td class="a">${fmtPlain(t.dh)}</td><td class="a"${t.gainFX !== null ? ' style="color:var(--green)"' : ''}>${t.gainFX !== null ? fmtSigned(t.gainFX, '') : '—'}</td><td class="a">${fmtPlain(t.commission)}</td><td class="a">${fmtPlain(t.netBenoit)}</td><td>${badge(t.statut, t.statutText)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  } else {
    html += `<div class="s"><div class="st">Paiements Councils 2026</div><table>
      <thead><tr><th>Mois</th><th style="text-align:right">HT (€)</th><th>Statut</th></tr></thead><tbody>`;
    transactions.forEach(t => {
      html += `<tr><td>${t.mois}</td><td class="a">${fmtPlain(t.htEUR)}</td><td>${badge(t.statut, t.statutText)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Virements 2026
  if (d.virements.length > 0) {
    html += `<div class="s"><div class="st">Virements DH → Benoit 2026</div><table>
      <thead><tr><th>#</th><th>Date</th><th>Bénéficiaire</th><th style="text-align:right">DH</th><th>Motif</th></tr></thead><tbody>`;
    d.virements.forEach((v, i) => {
      html += `<tr><td>${i+1}</td><td>${v.date}</td><td>${v.beneficiaire}</td><td class="a">${fmtPlain(v.dh)}</td><td>${v.motif}</td></tr>`;
    });
    html += `<tr class="tr"><td></td><td colspan="2"><strong>Total payé 2026</strong></td><td class="a"><strong>${fmtPlain(totalPaye)}</strong></td><td></td></tr></tbody></table></div>`;
  }

  // Réconciliation 2026 (PRIV only)
  if (window.PRIV) {
    html += `<div class="s"><div class="st">Réconciliation Benoit 2026 (payé uniquement)</div><table>
      <thead><tr><th>Ligne</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
      <tr><td>Report 2025</td><td class="a" style="color:var(--yellow)">${fmtSigned(report, '')}</td><td>Solde clôture 2025 (dû à Benoit)</td></tr>
      <tr><td>Councils HT payé 2026 (taux ${fmtRate(taux)})</td><td class="a">${fmtPlain(totalDHPaid)}</td><td>${paidTransactions.length} paiement(s) reçu(s)</td></tr>
      <tr><td>Commission 10%</td><td class="a" style="color:var(--yellow)">−${fmtPlain(totalCommissionPaid)}</td><td>Retenue par Amine</td></tr>
      <tr><td><strong>Total dû à Benoit</strong></td><td class="a"><strong>${fmtPlain(soldeDu)}</strong></td><td>Report + net Councils payé</td></tr>
      <tr><td>Virements DH 2026</td><td class="a" style="color:var(--green)">−${fmtPlain(totalPaye)}</td><td>${d.virements.length} virement(s)</td></tr>
      <tr class="tr"><td><strong>Solde 2026</strong></td><td class="a" style="color:${solde2026 > 0 ? 'var(--yellow)' : 'var(--green)'}"><strong>${fmtSigned(solde2026, '')}</strong></td><td>${solde2026 > 0 ? 'Amine doit encore ' + fmtPlain(solde2026) + ' DH à Benoit' : solde2026 < 0 ? 'Benoit a un excédent de ' + fmtPlain(Math.abs(solde2026)) + ' DH' : 'Soldé'}</td></tr>
      </tbody></table></div>`;
    html += `<div class="n">Le virement du 06/03/2026 (31 750 DH) a été comptabilisé dans la clôture 2025. Taux appliqué 2026 : <strong>${fmtRate(taux)}</strong> (fixe). La réconciliation ne prend en compte que les Councils effectivement payés.</div>`;
  }

  return html;
}

// ---- FX P2P ----
function renderFXP2P() {
  if (!window.PRIV) return '<div style="padding:40px;text-align:center;color:var(--muted)"><p style="font-size:1.1rem">🔒 Section réservée</p></div>';
  const d = DATA.fxP2P;

  // ===== LEG 1: EUR → AED (IFX spread = perte) =====
  const leg1 = d.leg1.transactions.map(t => {
    const aedMarche = t.eur * t.tauxMarche;
    const spreadAED = aedMarche - t.aed; // AED perdus (positif = perte)
    const spreadPct = ((t.tauxMarche - t.tauxIFX) / t.tauxMarche) * 100;
    return { ...t, aedMarche, spreadAED, spreadPct };
  });
  const totalEURleg1 = sum(leg1, 'eur');
  const totalAEDleg1 = sum(leg1, 'aed');
  const totalAEDMarcheLeg1 = sum(leg1, 'aedMarche');
  const totalSpreadLeg1 = totalAEDMarcheLeg1 - totalAEDleg1;
  const avgSpreadPctLeg1 = ((totalAEDMarcheLeg1 - totalAEDleg1) / totalAEDMarcheLeg1) * 100;
  const wavgTauxIFX = totalAEDleg1 / totalEURleg1;
  const wavgTauxMarcheLeg1 = totalAEDMarcheLeg1 / totalEURleg1;

  // ===== LEG 2: AED → USDT (P2P premium = perte) =====
  const peg = d.leg2.tauxMarche; // 3.6725
  const leg2 = d.leg2.transactions.map(t => {
    const usdtMarche = t.aed / peg;
    const spreadUSDT = usdtMarche - t.usdt; // USDT perdus (positif = perte car on paie plus cher)
    const spreadAED = t.aed - (t.usdt * peg); // premium AED payé
    const spreadPct = ((t.prix - peg) / peg) * 100;
    return { ...t, usdtMarche, spreadUSDT, spreadAED, spreadPct };
  });
  const totalAEDleg2 = sum(leg2, 'aed');
  const totalUSDTleg2 = sum(leg2, 'usdt');
  const totalUSDTMarcheLeg2 = sum(leg2, 'usdtMarche');
  const totalSpreadAEDLeg2 = totalAEDleg2 - (totalUSDTleg2 * peg);
  const wavgPrixLeg2 = totalAEDleg2 / totalUSDTleg2;
  const avgSpreadPctLeg2 = ((wavgPrixLeg2 - peg) / peg) * 100;

  // ===== LEG 3: USDT → MAD (P2P premium = gain) =====
  const leg3 = d.leg3.transactions.map(t => {
    const mktRate = d.leg3.tauxMarche[t.date] || 0;
    const madMarche = t.usdt * mktRate;
    const spreadMAD = t.mad - madMarche; // MAD gagnés (positif = gain)
    const spreadPct = mktRate > 0 ? ((t.prix - mktRate) / mktRate) * 100 : 0;
    return { ...t, mktRate, madMarche, spreadMAD, spreadPct };
  });
  const totalUSDTleg3 = sum(leg3, 'usdt');
  const totalMADleg3 = sum(leg3, 'mad');
  const totalMADMarcheLeg3 = sum(leg3, 'madMarche');
  const totalSpreadMADLeg3 = totalMADleg3 - totalMADMarcheLeg3;
  const wavgPrixLeg3 = totalMADleg3 / totalUSDTleg3;
  const wavgMktLeg3 = totalMADMarcheLeg3 / totalUSDTleg3;
  const avgSpreadPctLeg3 = ((wavgPrixLeg3 - wavgMktLeg3) / wavgMktLeg3) * 100;

  // ===== CONSOLIDATION : tout en MAD =====
  // Taux effectif AED→MAD via P2P = prix vente MAD / prix achat USDT en AED
  const tauxAEDtoMAD = wavgPrixLeg3 / wavgPrixLeg2;

  // Leg 1 : TOUTES les conversions IFX (pas seulement P2P)
  const leg1PerteTotaleAED = totalSpreadLeg1;
  const leg1PerteTotaleMAD = leg1PerteTotaleAED * tauxAEDtoMAD;

  // Leg 1 proratisé : seulement la part AED qui a transité par P2P
  const ratioP2P = totalAEDleg2 / totalAEDleg1; // part de l'AED qui est allée en P2P
  const leg1PerteP2PAED = totalSpreadLeg1 * ratioP2P;
  const leg1PerteP2PMAD = leg1PerteP2PAED * tauxAEDtoMAD;

  // Leg 2 perte en AED → convertir en MAD
  const leg2PerteMAD = totalSpreadAEDLeg2 * tauxAEDtoMAD;

  // Leg 3 gain déjà en MAD
  const leg3GainMAD = totalSpreadMADLeg3;

  // Net P2P (proratisé Leg 1 + Leg 2 + Leg 3)
  const netGainMAD = leg3GainMAD - leg1PerteP2PMAD - leg2PerteMAD;

  // Taux effectif EUR→MAD pour la portion P2P
  // EUR utilisé pour P2P = AED P2P / taux IFX moyen pondéré
  let html = `<h2 style="font-size:1.05rem;margin-bottom:6px">${d.title}</h2>`;
  html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">${d.subtitle}</p>`;

  // ===== HELPER: compute stats for a subset of transactions =====
  function computePeriodStats(l1, l2, l3) {
    const s1EUR = sum(l1, 'eur'), s1AED = sum(l1, 'aed'), s1AEDm = sum(l1, 'aedMarche');
    const s1spread = s1AEDm - s1AED;
    const s1pct = s1AEDm > 0 ? (s1spread / s1AEDm) * 100 : 0;
    const s1tIFX = s1EUR > 0 ? s1AED / s1EUR : 0;
    const s1tMkt = s1EUR > 0 ? s1AEDm / s1EUR : 0;

    const s2AED = sum(l2, 'aed'), s2USDT = sum(l2, 'usdt');
    const s2prix = s2USDT > 0 ? s2AED / s2USDT : 0;
    const s2pct = s2prix > 0 ? ((s2prix - peg) / peg) * 100 : 0;

    const s3USDT = sum(l3, 'usdt'), s3MAD = sum(l3, 'mad'), s3MADm = sum(l3, 'madMarche');
    const s3spread = s3MAD - s3MADm;
    const s3prix = s3USDT > 0 ? s3MAD / s3USDT : 0;
    const s3mkt = s3USDT > 0 ? s3MADm / s3USDT : 0;
    const s3pct = s3mkt > 0 ? ((s3prix - s3mkt) / s3mkt) * 100 : 0;

    const ratio = s1AED > 0 ? s2AED / s1AED : 0;

    // Effective EUR→MAD via rate chain (works for any period, no volume matching needed)
    // 1 EUR → tIFX AED → tIFX/buyPrice USDT → tIFX/buyPrice × sellPrice MAD
    const effEURMAD = s2prix > 0 ? s1tIFX * s3prix / s2prix : 0;
    // Market: 1 EUR → tMkt AED → tMkt/peg USD → tMkt/peg × mktUSDMAD MAD
    const mktEURMAD = s1tMkt * s3mkt / peg;
    const spreadEURMAD = effEURMAD - mktEURMAD;
    const spreadEURMADpct = mktEURMAD > 0 ? (spreadEURMAD / mktEURMAD) * 100 : 0;

    // Impact per 10 000 EUR (in EUR) — approximation linéaire (valid for small spreads)
    const REF = 10000;
    const impL1 = -(s1pct / 100) * REF;   // loss from IFX spread
    const impL2 = -(s2pct / 100) * REF;   // loss from P2P buy premium
    const impL3 = (s3pct / 100) * REF;    // gain from P2P sell premium
    const impNet = impL1 + impL2 + impL3;
    const impEURMAD = (spreadEURMADpct / 100) * REF;

    return {
      l1: { eur: s1EUR, aed: s1AED, aedM: s1AEDm, spread: s1spread, pct: s1pct, tIFX: s1tIFX, tMkt: s1tMkt, impact: impL1 },
      l2: { aed: s2AED, usdt: s2USDT, prix: s2prix, pct: s2pct, impact: impL2 },
      l3: { usdt: s3USDT, mad: s3MAD, madM: s3MADm, spread: s3spread, prix: s3prix, mkt: s3mkt, pct: s3pct, impact: impL3 },
      ratio, impNet, effEURMAD, mktEURMAD, spreadEURMAD, spreadEURMADpct, impEURMAD,
    };
  }

  // ===== COMPUTE BOTH PERIODS =====
  const cutoff3m = '2025-12-01'; // 3 derniers mois = Déc 2025+
  const all = computePeriodStats(leg1, leg2, leg3);
  const leg1_3m = leg1.filter(t => t.date >= cutoff3m);
  const leg2_3m = leg2.filter(t => t.date >= cutoff3m);
  const leg3_3m = leg3.filter(t => t.date >= cutoff3m);
  const r3m = computePeriodStats(leg1_3m, leg2_3m, leg3_3m);

  // ===== CARDS =====
  html += `<div class="cards">
    <div class="card"><div class="l">Spread EUR→MAD (total)</div><div class="v ${all.spreadEURMAD >= 0 ? 'green' : 'red'}">${all.spreadEURMAD >= 0 ? '+' : ''}${all.spreadEURMADpct.toFixed(2)}%</div></div>
    <div class="card"><div class="l">Spread EUR→MAD (3 mois)</div><div class="v ${r3m.spreadEURMAD >= 0 ? 'green' : 'red'}">${r3m.spreadEURMAD >= 0 ? '+' : ''}${r3m.spreadEURMADpct.toFixed(2)}%</div></div>
    <div class="card"><div class="l">Taux effectif (total)</div><div class="v blue">${all.effEURMAD.toFixed(2)}</div></div>
    <div class="card"><div class="l">Taux effectif (3 mois)</div><div class="v blue">${r3m.effEURMAD.toFixed(2)}</div></div>
    <div class="card"><div class="l">Impact sur 10k€ (total)</div><div class="v ${all.impEURMAD >= 0 ? 'green' : 'red'}">${all.impEURMAD >= 0 ? '+' : ''}${Math.round(all.impEURMAD)}€</div></div>
    <div class="card"><div class="l">Impact sur 10k€ (3 mois)</div><div class="v ${r3m.impEURMAD >= 0 ? 'green' : 'red'}">${r3m.impEURMAD >= 0 ? '+' : ''}${Math.round(r3m.impEURMAD)}€</div></div>
  </div>`;

  // ===== Helper: format EUR impact =====
  const fmtImpact = (v) => {
    const sign = v >= 0 ? '+' : '−';
    return sign + Math.abs(Math.round(v)).toLocaleString('fr-FR') + '€';
  };

  // ===== Helper to render synthesis table for a period =====
  function renderSynthTable(label, s, period) {
    let h = `<div class="s"><div class="st">${label}</div><table>
      <thead><tr><th>Étape</th><th>Volume</th><th style="text-align:right">Taux pondéré</th><th style="text-align:right">Taux marché</th><th style="text-align:right">Spread</th><th style="text-align:right">Impact (10k€)</th><th>Type</th></tr></thead><tbody>`;

    h += `<tr>
      <td><strong>1. EUR → AED</strong> (IFX)</td>
      <td>${fmtPlain(Math.round(s.l1.eur))} EUR <span style="font-size:.65rem;color:var(--muted)">(${(s.ratio*100).toFixed(0)}% P2P)</span></td>
      <td class="a">${s.l1.tIFX.toFixed(4).replace('.', ',')}</td>
      <td class="a">${s.l1.tMkt.toFixed(4).replace('.', ',')}</td>
      <td class="a" style="color:var(--red)">−${s.l1.pct.toFixed(2)}%</td>
      <td class="a" style="color:var(--red)">${fmtImpact(s.l1.impact)}</td>
      <td>${badge('e', 'Perte')}</td></tr>`;

    h += `<tr>
      <td><strong>2. AED → USDT</strong> (Binance P2P)</td>
      <td>${fmtPlain(Math.round(s.l2.aed))} AED</td>
      <td class="a">${s.l2.prix.toFixed(4).replace('.', ',')}</td>
      <td class="a">${peg.toFixed(4).replace('.', ',')}</td>
      <td class="a" style="color:var(--red)">+${s.l2.pct.toFixed(2)}%</td>
      <td class="a" style="color:var(--red)">${fmtImpact(s.l2.impact)}</td>
      <td>${badge('e', 'Perte')}</td></tr>`;

    h += `<tr>
      <td><strong>3. USDT → MAD</strong> (Binance P2P)</td>
      <td>${fmtPlain(Math.round(s.l3.usdt))} USDT</td>
      <td class="a">${s.l3.prix.toFixed(4).replace('.', ',')}</td>
      <td class="a">${s.l3.mkt.toFixed(4).replace('.', ',')}</td>
      <td class="a" style="color:var(--green)">+${s.l3.pct.toFixed(2)}%</td>
      <td class="a" style="color:var(--green)">${fmtImpact(s.l3.impact)}</td>
      <td>${badge('ok', 'Gain')}</td></tr>`;

    h += `<tr class="tr">
      <td><strong>Net P2P</strong></td><td></td><td></td><td></td><td></td>
      <td class="a" style="color:${s.impNet >= 0 ? 'var(--green)' : 'var(--red)'}"><strong>${fmtImpact(s.impNet)}</strong></td>
      <td>${s.impNet >= 0 ? badge('ok', 'Gain net') : badge('e', 'Perte nette')}</td></tr>`;

    // Effective EUR→MAD row
    h += `<tr style="background:var(--blue-bg)">
      <td colspan="2"><strong>Taux effectif EUR → MAD</strong></td>
      <td class="a" style="color:var(--accent)"><strong>${s.effEURMAD.toFixed(2)}</strong></td>
      <td class="a">${s.mktEURMAD.toFixed(2)}</td>
      <td class="a" style="color:${s.spreadEURMAD >= 0 ? 'var(--green)' : 'var(--red)'}"><strong>${s.spreadEURMAD >= 0 ? '+' : ''}${s.spreadEURMADpct.toFixed(2)}%</strong></td>
      <td class="a" style="color:${s.spreadEURMAD >= 0 ? 'var(--green)' : 'var(--red)'}"><strong>${fmtImpact(s.impEURMAD)}</strong></td>
      <td>${s.spreadEURMAD >= 0 ? badge('ok', 'Gain') : badge('e', 'Perte')}</td></tr>`;

    h += `</tbody></table></div>`;
    return h;
  }

  // ===== RENDER BOTH TABLES =====
  html += renderSynthTable('Synthèse — Période totale (depuis mars 2025)', all, 'total');
  html += renderSynthTable(`Synthèse — 3 derniers mois (depuis déc. 2025) — ${leg1_3m.length} / ${leg2_3m.length} / ${leg3_3m.length} tx`, r3m, '3m');

  html += `<div class="n"><strong>Impact (10k€)</strong> = pour chaque leg, combien tu gagnes ou perds en EUR sur une transaction de 10 000€. Les spreads s'additionnent : −89€ (IFX) − 21€ (buy) + 484€ (sell) = net. Le <strong>taux effectif EUR→MAD</strong> = chaîne de taux pondérés : taux IFX × prix vente P2P ÷ prix achat P2P.</div>`;

  // ===== LEG 1 DETAIL =====
  html += `<div class="s"><div class="st">Leg 1 — EUR → AED (conversions IFX) — ${leg1.length} transactions</div><table>
    <thead><tr><th>#</th><th>Date</th><th>Source</th><th style="text-align:right">EUR</th><th style="text-align:right">AED reçu</th><th style="text-align:right">Taux IFX</th><th style="text-align:right">Taux marché</th><th style="text-align:right">Spread</th><th style="text-align:right">Perte AED</th></tr></thead><tbody>`;
  leg1.forEach((t, i) => {
    html += `<tr><td>${i+1}</td><td>${t.date}</td><td style="font-size:.72rem">${t.source}</td>
      <td class="a">${fmtPlain(Math.round(t.eur))}</td>
      <td class="a">${fmtPlain(Math.round(t.aed))}</td>
      <td class="a">${t.tauxIFX.toFixed(4).replace('.', ',')}</td>
      <td class="a">${t.tauxMarche.toFixed(4).replace('.', ',')}</td>
      <td class="a" style="color:var(--red)">−${t.spreadPct.toFixed(2)}%</td>
      <td class="a" style="color:var(--red)">−${fmtPlain(Math.round(t.spreadAED))}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td colspan="2"><strong>Total</strong></td>
    <td class="a"><strong>${fmtPlain(Math.round(totalEURleg1))}</strong></td>
    <td class="a"><strong>${fmtPlain(Math.round(totalAEDleg1))}</strong></td>
    <td class="a"><strong>${wavgTauxIFX.toFixed(4).replace('.', ',')}</strong></td>
    <td class="a"><strong>${wavgTauxMarcheLeg1.toFixed(4).replace('.', ',')}</strong></td>
    <td class="a" style="color:var(--red)"><strong>−${avgSpreadPctLeg1.toFixed(2)}%</strong></td>
    <td class="a" style="color:var(--red)"><strong>−${fmtPlain(Math.round(totalSpreadLeg1))}</strong></td></tr>`;
  html += `</tbody></table></div>`;

  // ===== LEG 2 DETAIL =====
  html += `<div class="s"><div class="st">Leg 2 — AED → USDT (Binance P2P Buy) — ${leg2.length} transactions</div><table>
    <thead><tr><th>#</th><th>Date</th><th style="text-align:right">AED</th><th style="text-align:right">USDT</th><th style="text-align:right">Prix P2P</th><th style="text-align:right">Peg (3,6725)</th><th style="text-align:right">Spread</th><th style="text-align:right">Premium AED</th></tr></thead><tbody>`;
  leg2.forEach((t, i) => {
    html += `<tr><td>${i+1}</td><td>${t.date}</td>
      <td class="a">${fmtPlain(Math.round(t.aed))}</td>
      <td class="a">${t.usdt.toFixed(2).replace('.', ',')}</td>
      <td class="a">${t.prix.toFixed(3).replace('.', ',')}</td>
      <td class="a">${peg.toFixed(4).replace('.', ',')}</td>
      <td class="a" style="color:${t.spreadPct > 0 ? 'var(--red)' : 'var(--green)'}">${t.spreadPct > 0 ? '+' : ''}${t.spreadPct.toFixed(2)}%</td>
      <td class="a" style="color:var(--red)">${Math.round(t.spreadAED) > 0 ? '−' : '+'}${fmtPlain(Math.abs(Math.round(t.spreadAED)))}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td><strong>Total</strong></td>
    <td class="a"><strong>${fmtPlain(Math.round(totalAEDleg2))}</strong></td>
    <td class="a"><strong>${totalUSDTleg2.toFixed(2).replace('.', ',')}</strong></td>
    <td class="a"><strong>${wavgPrixLeg2.toFixed(4).replace('.', ',')}</strong></td>
    <td class="a"><strong>${peg.toFixed(4).replace('.', ',')}</strong></td>
    <td class="a" style="color:var(--red)"><strong>+${avgSpreadPctLeg2.toFixed(2)}%</strong></td>
    <td class="a" style="color:var(--red)"><strong>−${fmtPlain(Math.round(totalSpreadAEDLeg2))}</strong></td></tr>`;
  html += `</tbody></table></div>`;

  // ===== LEG 3 DETAIL =====
  html += `<div class="s"><div class="st">Leg 3 — USDT → MAD (Binance P2P Sell) — ${leg3.length} transactions</div><table>
    <thead><tr><th>#</th><th>Date</th><th style="text-align:right">USDT</th><th style="text-align:right">MAD</th><th style="text-align:right">Prix P2P</th><th style="text-align:right">USD/MAD marché</th><th style="text-align:right">Spread</th><th style="text-align:right">Gain MAD</th></tr></thead><tbody>`;
  leg3.forEach((t, i) => {
    html += `<tr><td>${i+1}</td><td>${t.date}</td>
      <td class="a">${t.usdt.toFixed(2).replace('.', ',')}</td>
      <td class="a">${fmtPlain(Math.round(t.mad))}</td>
      <td class="a">${t.prix.toFixed(3).replace('.', ',')}</td>
      <td class="a">${t.mktRate.toFixed(4).replace('.', ',')}</td>
      <td class="a" style="color:var(--green)">+${t.spreadPct.toFixed(2)}%</td>
      <td class="a" style="color:var(--green)">+${fmtPlain(Math.round(t.spreadMAD))}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td><strong>Total</strong></td>
    <td class="a"><strong>${totalUSDTleg3.toFixed(2).replace('.', ',')}</strong></td>
    <td class="a"><strong>${fmtPlain(Math.round(totalMADleg3))}</strong></td>
    <td class="a"><strong>${wavgPrixLeg3.toFixed(4).replace('.', ',')}</strong></td>
    <td class="a"><strong>${wavgMktLeg3.toFixed(4).replace('.', ',')}</strong></td>
    <td class="a" style="color:var(--green)"><strong>+${avgSpreadPctLeg3.toFixed(2)}%</strong></td>
    <td class="a" style="color:var(--green)"><strong>+${fmtPlain(Math.round(totalSpreadMADLeg3))}</strong></td></tr>`;
  html += `</tbody></table></div>`;

  // ===== INSIGHTS =====
  html += `<div class="s"><div class="st">Insights — Analyse du circuit P2P</div>`;

  // Insight 1: Effective EUR→MAD spread comparison
  html += `<div class="insight ${all.spreadEURMAD >= 0 ? 'pass' : 'fail'}"><div class="t">${all.spreadEURMAD >= 0 ? '✅' : '❌'} Spread effectif EUR→MAD : ${all.spreadEURMAD >= 0 ? '+' : ''}${all.spreadEURMADpct.toFixed(2)}% (total) / ${r3m.spreadEURMAD >= 0 ? '+' : ''}${r3m.spreadEURMADpct.toFixed(2)}% (3 mois)</div><div class="d">
    <strong>Période totale :</strong> taux effectif <strong>${all.effEURMAD.toFixed(2)} MAD/EUR</strong> vs marché ${all.mktEURMAD.toFixed(2)} → sur 10k€ : <strong>${fmtImpact(all.impEURMAD)}</strong>.<br>
    <strong>3 derniers mois :</strong> taux effectif <strong>${r3m.effEURMAD.toFixed(2)} MAD/EUR</strong> vs marché ${r3m.mktEURMAD.toFixed(2)} → sur 10k€ : <strong>${fmtImpact(r3m.impEURMAD)}</strong>. ${r3m.spreadEURMADpct > all.spreadEURMADpct ? 'Le spread s\'améliore sur les 3 derniers mois.' : 'Le spread se dégrade légèrement sur les 3 derniers mois.'}
  </div></div>`;

  // Insight 2: Net gain per period
  html += `<div class="insight ${all.impNet >= 0 ? 'pass' : 'warn'}"><div class="t">${all.impNet >= 0 ? '✅' : '⚠️'} Bilan net P2P par 10k€ : ${fmtImpact(all.impNet)} (total) / ${fmtImpact(r3m.impNet)} (3 mois)</div><div class="d">
    Le gain du Leg 3 (vente USDT→MAD à +${all.l3.pct.toFixed(1)}%) ${all.impNet >= 0 ? 'compense' : 'ne compense pas totalement'} les pertes des Legs 1 et 2. Sur les 3 derniers mois, le premium MAD est de <strong>+${r3m.l3.pct.toFixed(1)}%</strong> (vs ${all.l3.pct.toFixed(1)}% sur la période totale).
  </div></div>`;

  // Insight 3: Leg 3 dominance
  const leg3VsPertes = Math.abs(all.l3.impact) / (Math.abs(all.l1.impact) + Math.abs(all.l2.impact));
  html += `<div class="insight pass"><div class="t">📊 Le Leg 3 (USDT→MAD) est le moteur du gain — ratio ${leg3VsPertes.toFixed(1)}x les pertes</div><div class="d">
    Sur 10k€ : Leg 3 rapporte <strong>${fmtImpact(all.l3.impact)}</strong>, soit <strong>${leg3VsPertes.toFixed(1)}x</strong> les pertes combinées Leg 1 (${fmtImpact(all.l1.impact)}) + Leg 2 (${fmtImpact(all.l2.impact)}). La forte demande de MAD au Maroc via P2P crée un premium structurel en ta faveur.
  </div></div>`;

  // Insight 4: Leg 1 IFX spread
  html += `<div class="insight warn"><div class="t">🏦 Spread IFX (Leg 1) : −${all.l1.pct.toFixed(2)}% (total) / −${r3m.l1.pct.toFixed(2)}% (3 mois) → ${fmtImpact(all.l1.impact)} sur 10k€</div><div class="d">
    IFX prend en moyenne <strong>${all.l1.pct.toFixed(2)}%</strong> de spread sur la conversion EUR→AED, soit <strong>${fmtImpact(all.l1.impact)}</strong> par tranche de 10 000€. ${r3m.l1.pct < all.l1.pct ? 'Le spread IFX s\'améliore sur les 3 derniers mois (' + r3m.l1.pct.toFixed(2) + '%).' : 'Le spread IFX est stable sur les 3 derniers mois.'}
  </div></div>`;

  // Insight 5: Leg 2 minimal
  html += `<div class="insight"><div class="t">💱 Premium P2P Buy (Leg 2) : +${all.l2.pct.toFixed(2)}% → ${fmtImpact(all.l2.impact)} sur 10k€</div><div class="d">
    L'achat USDT sur Binance P2P coûte en moyenne <strong>${all.l2.prix.toFixed(4)} AED/USDT</strong> vs le peg officiel de ${peg} (+${all.l2.pct.toFixed(2)}%). Impact faible grâce à la liquidité AED/USDT aux Émirats : seulement <strong>${fmtImpact(all.l2.impact)}</strong> par 10k€.
  </div></div>`;

  // Insight 6: Best/worst leg 3 dates
  const bestLeg3 = leg3.reduce((a, b) => a.spreadPct > b.spreadPct ? a : b);
  const worstLeg3 = leg3.reduce((a, b) => a.spreadPct < b.spreadPct ? a : b);
  html += `<div class="insight"><div class="t">📅 Meilleur spread USDT→MAD : ${bestLeg3.date} (+${bestLeg3.spreadPct.toFixed(1)}%) / Pire : ${worstLeg3.date} (+${worstLeg3.spreadPct.toFixed(1)}%)</div><div class="d">
    Le spread varie de <strong>+${worstLeg3.spreadPct.toFixed(1)}%</strong> à <strong>+${bestLeg3.spreadPct.toFixed(1)}%</strong> selon la demande P2P au Maroc. Le premium est systématiquement positif — aucune transaction n'est en dessous du taux marché.
  </div></div>`;

  // Insight 7: EUR→MAD comparison with bank
  html += `<div class="insight pass"><div class="t">🌍 P2P vs banque : taux effectif ${all.effEURMAD.toFixed(2)} vs ~10,5–10,8 (banque classique)</div><div class="d">
    Le taux effectif EUR→MAD via P2P est de <strong>${all.effEURMAD.toFixed(2)}</strong> (total) et <strong>${r3m.effEURMAD.toFixed(2)}</strong> (3 mois). Un virement classique EUR→MAD via banque donne environ 10,5–10,8. Le circuit P2P est donc <strong>${all.effEURMAD > 10.8 ? 'nettement plus avantageux' : all.effEURMAD > 10.5 ? 'comparable ou légèrement avantageux' : 'comparable'}</strong>.
  </div></div>`;

  // Insight 8: USDT remaining
  html += `<div class="insight"><div class="t">💰 ${d.usdtRemaining.toFixed(0)} USDT restants — gain potentiel non réalisé</div><div class="d">
    Il reste <strong>${d.usdtRemaining.toFixed(2)} USDT</strong> non vendus. Au prix moyen de vente actuel (${all.l3.prix.toFixed(2)} MAD/USDT), cela représente environ <strong>${fmtPlain(Math.round(d.usdtRemaining * all.l3.prix))} MAD</strong> potentiels.
  </div></div>`;

  html += `</div>`;

  // Method note
  html += `<div class="n ok">
    <strong>Méthode :</strong> <strong>Leg 1</strong> — données IFX vs taux marché EUR/AED du jour (fawazahmed0/currency-api). <strong>Leg 2</strong> — prix P2P Binance vs peg AED/USD (3,6725). <strong>Leg 3</strong> — prix P2P Binance vs USD/MAD marché. <strong>Taux effectif EUR→MAD</strong> = chaîne de taux pondérés (IFX × sell ÷ buy). <strong>Impact (10k€)</strong> = spread% × 10 000 EUR (approximation linéaire). <strong>3 derniers mois</strong> = transactions depuis déc. 2025.
  </div>`;

  return html;
}

// ---- MES GAINS (Binga only) ----
function renderMesGains() {
  if (!window.PRIV) return '<div style="padding:40px;text-align:center;color:var(--muted)"><p style="font-size:1.1rem">🔒 Section réservée</p></div>';

  const d = DATA.fxP2P;
  const peg = d.leg2.tauxMarche; // 3.6725

  // ===== Compute effective & market EUR/MAD from P2P pipeline =====
  const totalEURleg1 = sum(d.leg1.transactions, 'eur');
  const totalAEDleg1 = sum(d.leg1.transactions, 'aed');
  const totalAEDMktLeg1 = d.leg1.transactions.reduce((s, t) => s + t.eur * t.tauxMarche, 0);
  const wavgTauxIFX = totalAEDleg1 / totalEURleg1;
  const wavgTauxMkt1 = totalAEDMktLeg1 / totalEURleg1;

  const totalAEDleg2 = sum(d.leg2.transactions, 'aed');
  const totalUSDTleg2 = sum(d.leg2.transactions, 'usdt');
  const wavgPrixBuy = totalAEDleg2 / totalUSDTleg2;

  const totalUSDTleg3 = sum(d.leg3.transactions, 'usdt');
  const totalMADleg3 = sum(d.leg3.transactions, 'mad');
  const totalMADMktLeg3 = d.leg3.transactions.reduce((s, t) => s + t.usdt * (d.leg3.tauxMarche[t.date] || 0), 0);
  const wavgPrixSell = totalMADleg3 / totalUSDTleg3;
  const wavgMktSell = totalMADMktLeg3 / totalUSDTleg3;

  // Rate chain: 1 EUR → tIFX AED → tIFX/buyPrice USDT → tIFX/buyPrice × sellPrice MAD
  const effEURMAD = wavgTauxIFX * wavgPrixSell / wavgPrixBuy;
  const mktEURMAD = wavgTauxMkt1 * wavgMktSell / peg;

  // ===== 1. VIREMENTS AUGUSTIN — Rate arbitrage + P2P spread =====
  const az25 = DATA.augustin2025;
  const az26 = DATA.augustin2026;
  const tauxAz = az25.tauxMaroc; // 10

  // 2025 virements
  const totalDH25 = sum(az25.virementsMaroc, 'totalDH'); // 230000
  const eurCredite25 = totalDH25 / tauxAz; // 23000
  const eurCoutP2P25 = totalDH25 / effEURMAD;
  const gainEUR_az25 = eurCredite25 - eurCoutP2P25;
  const gainMAD_az25 = gainEUR_az25 * effEURMAD; // = totalDH25 * (effEURMAD/tauxAz - 1) ... simplified

  // Decompose: rate arbitrage (tauxAz vs market) + P2P spread (market vs effective)
  const eurCoutMarche25 = totalDH25 / mktEURMAD;
  const gainRateArb25 = (eurCredite25 - eurCoutMarche25) * mktEURMAD; // Augustin rate vs market, in MAD
  const gainP2PSpread25 = (eurCoutMarche25 - eurCoutP2P25) * effEURMAD; // P2P vs market, in MAD

  // 2026 virements
  const totalDH26 = sum(az26.virementsMaroc, 'dh'); // 50000
  const eurCredite26 = totalDH26 / az26.tauxMaroc;
  const eurCoutP2P26 = totalDH26 / effEURMAD;
  const gainEUR_az26 = eurCredite26 - eurCoutP2P26;
  const gainMAD_az26 = gainEUR_az26 * effEURMAD;

  const eurCoutMarche26 = totalDH26 / mktEURMAD;
  const gainRateArb26 = (eurCredite26 - eurCoutMarche26) * mktEURMAD;
  const gainP2PSpread26 = (eurCoutMarche26 - eurCoutP2P26) * effEURMAD;

  const totalGainAz = gainMAD_az25 + gainMAD_az26;

  // ===== 2. COMMISSION YCARRÉ (Oum Yakout) =====
  const ycarreTotal = DATA._ycarreTotal || sum(az25.ycarre, 'montant');
  const ycarreCommRate = DATA._ycarreCommission || 0;
  const commYcarréEUR = Math.round(ycarreTotal * ycarreCommRate);
  const commYcarréMAD = Math.round(commYcarréEUR * mktEURMAD);

  // ===== 3. COMMISSION BENOIT 10% =====
  const b25 = DATA.benoit2025;
  const b26 = DATA.benoit2026;

  const commBenoit25 = b25.councils.reduce((s, m) => s + Math.round(m.htEUR * m.tauxApplique * b25.commissionRate), 0);
  const commBenoit26 = b26.councils.filter(m => m.statut === 'ok').reduce((s, m) => s + Math.round(m.htEUR * b26.tauxApplique * b26.commissionRate), 0);
  const totalComm = commBenoit25 + commBenoit26;

  // ===== 4. ÉCART TAUX BENOIT (appliqué vs marché) =====
  const fxBenoit25 = b25.councils.reduce((s, m) => s + Math.round(m.htEUR * (m.tauxMarche - m.tauxApplique)), 0);
  const fxBenoit26 = b26.councils.filter(m => m.statut === 'ok' && m.tauxMarche).reduce((s, m) => s + Math.round(m.htEUR * (m.tauxMarche - b26.tauxApplique)), 0);
  const totalFxBenoit = fxBenoit25 + fxBenoit26;

  // ===== 5. P2P SPREAD on Benoit payments =====
  // The MAD paid to Benoit via P2P costs less EUR than at bank rate
  const totalNetBenoit25 = b25.councils.reduce((s, m) => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    return s + dh - Math.round(dh * b25.commissionRate);
  }, 0);
  const totalNetBenoit26 = b26.councils.filter(m => m.statut === 'ok').reduce((s, m) => {
    const dh = Math.round(m.htEUR * b26.tauxApplique);
    return s + dh - Math.round(dh * b26.commissionRate);
  }, 0);
  const totalNetBenoitDH = totalNetBenoit25 + totalNetBenoit26;
  // P2P saving: cost at market - cost at P2P (in EUR) * effRate
  const p2pSavingBenoit = totalNetBenoitDH * (1 - mktEURMAD / effEURMAD);

  // ===== GRAND TOTAL =====
  const grandTotal = totalGainAz + commYcarréMAD + totalComm + totalFxBenoit + p2pSavingBenoit;

  // ===== BUILD HTML =====
  let html = `<h2 style="font-size:1.05rem;margin-bottom:6px">Mes Gains — Synthèse complète</h2>`;
  html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">Calcul de tous les gains générés par l'activité de facturation et le pipeline FX P2P. Tous les montants en MAD.</p>`;

  // Grand total card
  html += `<div class="cards">
    <div class="card"><div class="l">Total gains (MAD)</div><div class="v green">${fmtPlain(Math.round(grandTotal))} DH</div></div>
    <div class="card"><div class="l">≈ en EUR</div><div class="v green">${fmtPlain(Math.round(grandTotal / effEURMAD))} €</div></div>
    <div class="card"><div class="l">Taux effectif P2P</div><div class="v blue">${effEURMAD.toFixed(3).replace('.',',')}</div></div>
    <div class="card"><div class="l">Taux marché moyen</div><div class="v yellow">${mktEURMAD.toFixed(3).replace('.',',')}</div></div>
  </div>`;

  // ===== TABLE RÉCAPITULATIVE =====
  html += `<div class="s"><div class="st">Récapitulatif des gains par source</div><table>
    <thead><tr><th>Source</th><th>Détail</th><th style="text-align:right">Gain (DH)</th></tr></thead><tbody>`;

  // Augustin 2025
  html += `<tr><td><strong>Virements Augustin 2025</strong></td><td>${fmtPlain(totalDH25)} DH envoyés, crédités ${fmtPlain(eurCredite25)} € (taux ${tauxAz}), coût réel ${fmtPlain(Math.round(eurCoutP2P25))} € via P2P</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainMAD_az25), '')}</td></tr>`;

  // Augustin 2026
  html += `<tr><td><strong>Virements Augustin 2026</strong></td><td>${fmtPlain(totalDH26)} DH envoyés, crédités ${fmtPlain(eurCredite26)} € (taux ${az26.tauxMaroc}), coût réel ${fmtPlain(Math.round(eurCoutP2P26))} € via P2P</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainMAD_az26), '')}</td></tr>`;

  // Commission Ycarré
  html += `<tr><td><strong>Commission Ycarré (Oum Yakout) 8%</strong></td><td>${fmtPlain(ycarreTotal)} € × 8% = ${fmtPlain(commYcarréEUR)} € (≈ ${fmtPlain(commYcarréMAD)} DH au taux marché)</td><td class="a" style="color:var(--green)">${fmtSigned(commYcarréMAD, '')}</td></tr>`;

  // Commission Benoit
  html += `<tr><td><strong>Commission Benoit 10%</strong></td><td>2025 : ${fmtPlain(commBenoit25)} DH · 2026 : ${fmtPlain(commBenoit26)} DH</td><td class="a" style="color:var(--green)">${fmtSigned(totalComm, '')}</td></tr>`;

  // FX Benoit
  html += `<tr><td><strong>Écart taux Benoit</strong></td><td>Taux appliqué &lt; taux marché (2025 : ${fmtPlain(fxBenoit25)} DH · 2026 : ${fmtPlain(fxBenoit26)} DH)</td><td class="a" style="color:var(--green)">${fmtSigned(totalFxBenoit, '')}</td></tr>`;

  // P2P spread on Benoit
  html += `<tr><td><strong>Spread P2P (paiements Benoit)</strong></td><td>Envoi de ${fmtPlain(totalNetBenoitDH)} DH via Binance au lieu de banque</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(p2pSavingBenoit), '')}</td></tr>`;

  // Total
  html += `<tr class="tr"><td><strong>TOTAL GAINS</strong></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(Math.round(grandTotal), ' DH')}</strong></td></tr>`;
  html += `</tbody></table></div>`;

  // ===== BREAKDOWN AUGUSTIN =====
  html += `<div class="s"><div class="st">Détail — Virements Augustin (Maroc)</div>`;
  html += `<div class="n ok">Quand tu envoies des MAD à Augustin via Binance P2P, le taux appliqué par Augustin est <strong>${tauxAz} MAD/EUR</strong>. Ton taux effectif P2P est <strong>${effEURMAD.toFixed(3).replace('.',',')} MAD/EUR</strong>. La différence (${(effEURMAD - tauxAz).toFixed(3).replace('.',',')} MAD/EUR) est ton gain pour chaque EUR crédité.</div>`;

  html += `<table><thead><tr><th>Période</th><th style="text-align:right">DH envoyés</th><th style="text-align:right">EUR crédités (÷${tauxAz})</th><th style="text-align:right">Coût réel EUR (P2P)</th><th style="text-align:right">Gain EUR</th><th style="text-align:right">Gain MAD</th></tr></thead><tbody>`;
  html += `<tr><td>2025 (Fév-Déc)</td><td class="a">${fmtPlain(totalDH25)}</td><td class="a">${fmtPlain(eurCredite25)}</td><td class="a">${fmtPlain(Math.round(eurCoutP2P25))}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainEUR_az25), '')}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainMAD_az25), '')}</td></tr>`;
  html += `<tr><td>2026 (Jan-Mar)</td><td class="a">${fmtPlain(totalDH26)}</td><td class="a">${fmtPlain(eurCredite26)}</td><td class="a">${fmtPlain(Math.round(eurCoutP2P26))}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainEUR_az26), '')}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainMAD_az26), '')}</td></tr>`;
  html += `<tr class="tr"><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalDH25 + totalDH26)}</strong></td><td class="a"><strong>${fmtPlain(eurCredite25 + eurCredite26)}</strong></td><td class="a"><strong>${fmtPlain(Math.round(eurCoutP2P25 + eurCoutP2P26))}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(Math.round(gainEUR_az25 + gainEUR_az26), '')}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(Math.round(gainMAD_az25 + gainMAD_az26), '')}</strong></td></tr>`;
  html += `</tbody></table></div>`;

  // ===== BREAKDOWN BENOIT =====
  html += `<div class="s"><div class="st">Détail — Gains Benoit (Commission + Taux + P2P)</div>`;

  // Per-transaction table for Benoit 2025
  html += `<table><thead><tr><th>Date</th><th style="text-align:right">HT (€)</th><th style="text-align:right">Taux appliqué</th><th style="text-align:right">Taux marché</th><th style="text-align:right">Commission 10% (DH)</th><th style="text-align:right">Gain taux (DH)</th></tr></thead><tbody>`;
  let sumComm = 0, sumFxB = 0;
  b25.councils.forEach(m => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    const comm = Math.round(dh * b25.commissionRate);
    const fx = Math.round(m.htEUR * (m.tauxMarche - m.tauxApplique));
    sumComm += comm; sumFxB += fx;
    html += `<tr><td>${m.date}</td><td class="a">${fmtPlain(m.htEUR)}</td><td class="a">${fmtRate(m.tauxApplique)}</td><td class="a">${fmtRate(m.tauxMarche)}</td><td class="a" style="color:var(--green)">${fmtPlain(comm)}</td><td class="a" style="color:var(--green)">${fmtSigned(fx, '')}</td></tr>`;
  });
  // Benoit 2026 paid
  b26.councils.filter(m => m.statut === 'ok').forEach(m => {
    const dh = Math.round(m.htEUR * b26.tauxApplique);
    const comm = Math.round(dh * b26.commissionRate);
    const fx = m.tauxMarche ? Math.round(m.htEUR * (m.tauxMarche - b26.tauxApplique)) : 0;
    sumComm += comm; sumFxB += fx;
    html += `<tr><td>${m.mois} 2026</td><td class="a">${fmtPlain(m.htEUR)}</td><td class="a">${fmtRate(b26.tauxApplique)}</td><td class="a">${m.tauxMarche ? fmtRate(m.tauxMarche) : '—'}</td><td class="a" style="color:var(--green)">${fmtPlain(comm)}</td><td class="a" style="color:var(--green)">${m.tauxMarche ? fmtSigned(fx, '') : '—'}</td></tr>`;
  });
  html += `<tr class="tr"><td><strong>Total</strong></td><td></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtPlain(sumComm)}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(sumFxB, '')}</strong></td></tr>`;
  html += `</tbody></table></div>`;

  // ===== INSIGHTS =====
  html += `<div class="s"><div class="st">Insights</div>`;

  // Insight 1: effective vs Augustin rate
  const gainPerEUR_az = effEURMAD - tauxAz;
  html += `<div class="insight pass"><div class="t">💰 Gain de ${gainPerEUR_az.toFixed(2).replace('.',',')} DH par EUR crédité chez Augustin</div><div class="d">Le taux Augustin est ${tauxAz} MAD/EUR. Ton taux effectif via Binance P2P est ${effEURMAD.toFixed(3).replace('.',',')} MAD/EUR. Pour chaque 1 000€ crédité, tu gagnes <strong>${fmtPlain(Math.round(gainPerEUR_az * 1000))} DH</strong>.</div></div>`;

  // Insight 2: P2P vs market
  const p2pAdvantage = effEURMAD - mktEURMAD;
  html += `<div class="insight pass"><div class="t">📈 Avantage P2P : +${p2pAdvantage.toFixed(3).replace('.',',')} MAD/EUR vs marché</div><div class="d">Le taux marché EUR/MAD moyen est ${mktEURMAD.toFixed(3).replace('.',',')}. Le P2P te donne ${effEURMAD.toFixed(3).replace('.',',')}. Ce premium de ${((p2pAdvantage/mktEURMAD)*100).toFixed(2).replace('.',',')}% vient de la vente USDT→MAD sur Binance (marché parallèle).</div></div>`;

  // Insight 3: Ycarré commission
  html += `<div class="insight pass"><div class="t">👩 Ycarré (Oum Yakout) : ${fmtPlain(commYcarréEUR)} € de commission</div><div class="d">${fmtPlain(ycarreTotal)} € payés à Oum Yakout en 2025 (6 paiements EBS). Commission moyenne de 8% retenue = <strong>${fmtPlain(commYcarréEUR)} €</strong> (≈ ${fmtPlain(commYcarréMAD)} DH).</div></div>`;

  // Insight 4: Benoit commission total
  const totalGainsBenoit = totalComm + totalFxBenoit + Math.round(p2pSavingBenoit);
  html += `<div class="insight pass"><div class="t">🤝 Benoit génère ${fmtPlain(totalGainsBenoit)} DH de gains cumulés</div><div class="d">Commission 10% : <strong>${fmtPlain(totalComm)} DH</strong> · Écart taux : <strong>${fmtPlain(totalFxBenoit)} DH</strong> · P2P spread : <strong>${fmtPlain(Math.round(p2pSavingBenoit))} DH</strong>. La commission reste la source principale.</div></div>`;

  // Insight 5: breakdown percentage
  const pctAz = (totalGainAz / grandTotal * 100).toFixed(1);
  const pctYsq = (commYcarréMAD / grandTotal * 100).toFixed(1);
  const pctComm = (totalComm / grandTotal * 100).toFixed(1);
  const pctFx = (totalFxBenoit / grandTotal * 100).toFixed(1);
  const pctP2P = (p2pSavingBenoit / grandTotal * 100).toFixed(1);
  html += `<div class="insight"><div class="t">📊 Répartition des gains</div><div class="d">Virements Augustin : <strong>${pctAz}%</strong> · Ycarré 8% : <strong>${pctYsq}%</strong> · Commission Benoit : <strong>${pctComm}%</strong> · Écart taux Benoit : <strong>${pctFx}%</strong> · Spread P2P Benoit : <strong>${pctP2P}%</strong></div></div>`;

  // Insight 6: monthly average
  const months = 13; // Feb 2025 to Mar 2026
  const monthlyAvg = grandTotal / months;
  html += `<div class="insight"><div class="t">📅 Moyenne mensuelle : ${fmtPlain(Math.round(monthlyAvg))} DH/mois</div><div class="d">Sur ${months} mois d'activité (Fév 2025 – Mar 2026), soit ~${fmtPlain(Math.round(monthlyAvg / effEURMAD))} €/mois.</div></div>`;

  html += `</div>`;

  return html;
}

// ---- INIT ----
function renderAll() {
  const azY = window.azYear || 2026;
  const baY = window.baYear || 2026;
  document.getElementById('augustin').innerHTML = (azY === 2025) ? renderAugustin2025() : renderAugustin2026();
  document.getElementById('benoit').innerHTML = (baY === 2025) ? renderBenoit2025() : renderBenoit2026();
  document.getElementById('fxp2p').innerHTML = renderFXP2P();
  document.getElementById('gains').innerHTML = renderMesGains();
}

// renderAll() is called after gate validation in index.html
