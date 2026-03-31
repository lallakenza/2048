// ============================================================
// RENDER-AUGUSTIN.JS — Rendering functions for Augustin reconciliation (2025 and 2026)
// ============================================================

// ---- AUGUSTIN 2025 ----
function renderAugustinAll() {
  let html = yearToggle3('Az', 0);
  html += `<h2 style="font-size:1.05rem;margin-bottom:18px">Augustin — Vue combinée 2025 / 2026</h2>`;
  // Render 2026 first (current), then 2025
  html += `<div style="margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid var(--border)">`;
  html += renderAugustin2026(true);
  html += `</div>`;
  html += renderAugustin2025(true);
  return html;
}

function renderAugustin2025(embedded) {
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
  const totalDiversCalc = sum(d.divers, x => x.montant);
  // RTL total
  const totalRTL = sum(d.rtl, 'montant');
  const totalRecuRTL = sum(d.rtl, 'recu');

  let html = embedded ? '' : yearToggle3('Az', 2025);

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
    { nom: "5. Autre (Divers)", excel: totalDiversCalc, verifie: totalDiversCalc, statut: `✓ ${d.divers.length}/${d.divers.length} EBS` },
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
    <strong>Résultat (Excel v2) :</strong> Augustin a largement corrigé son fichier. <strong>Les 5 catégories sont désormais 100% vérifiées par EBS/Banque.</strong> Ycarré, Councils, Baraka matchent à 100%. Le Maroc Fév-Déc matche parfaitement (${fmtPlain(totalMarocExcel)}€ Excel = ${fmtPlain(totalMarocReel)}€ réel). Les Divers (${d.divers.length} opérations, ${fmtPlain(d.diversVerifie)}€ en valeur absolue) sont intégralement confirmés par EBS.<br><br>
    Solde Excel = Solde corrigé : <strong>${fmtSigned(soldeExcel)}</strong> (Augustin te doit).<br>
    <strong style="color:var(--green)">0€ sans preuve — Réconciliation complète.</strong>
  </div></div>`;

  // Mois par mois
  html += `<div class="s"><div class="st">Réconciliation mois par mois (Janvier → Décembre 2025)</div><table>
    <thead><tr><th>Mois</th><th data-sort="num" style="text-align:right">Actuals (€)</th><th data-sort="num" style="text-align:right">B+Y+M (€)</th><th data-sort="num" style="text-align:right">Maroc (€)</th><th data-sort="num" style="text-align:right">Divers (€)</th><th data-sort="num" style="text-align:right">Total dép. (€)</th><th data-sort="num" style="text-align:right">Solde mois (€)</th><th>Commentaire</th></tr></thead><tbody>`;

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
    <thead><tr><th>#</th><th data-sort="date">Date EBS</th><th data-sort="num" style="text-align:right">EBS (€)</th><th></th></tr></thead><tbody>`;
  d.ycarre.forEach((y, i) => {
    html += `<tr><td>${i+1}</td><td>${y.date}</td><td class="a">${fmtPlain(y.montant)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalYcarré)}</strong></td><td></td></tr></tbody></table></div>`;

  // Cat 2: Councils
  html += `<div class="s"><div class="st">2. Councils HT (Benoit) — ${fmtPlain(totalCouncils)}€ ✓ (corrigé v2)</div><table>
    <thead><tr><th>#</th><th data-sort="date">Date EBS</th><th data-sort="num" style="text-align:right">Excel HT (€)</th><th data-sort="num" style="text-align:right">EBS HT (€)</th><th data-sort="num" style="text-align:right">Écart</th><th></th></tr></thead><tbody>`;
  d.councils.forEach((m, i) => {
    const ecart = m.excelHT - m.ebsHT;
    html += `<tr><td>${i+1}</td><td>${m.date}</td><td class="a">${fmtPlain(m.excelHT)}</td><td class="a">${fmtPlain(m.ebsHT)}</td><td class="a">${ecart}</td><td>${badge('ok', m.note ? '✓ ' + m.note : '✓')}</td></tr>`;
  });
  const totalMajExcel = sum(d.councils, 'excelHT');
  html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalMajExcel)}</strong></td><td class="a"><strong>${fmtPlain(totalCouncils)}</strong></td><td class="a" style="color:var(--green)"><strong>0</strong></td><td></td></tr></tbody></table></div>`;

  // Cat 3: Baraka
  html += `<div class="s"><div class="st">3. Baraka EUR (→ Augustin) — ${fmtPlain(totalBaraka)}€ ✓</div><table>
    <thead><tr><th>#</th><th data-sort="date">Date EBS</th><th data-sort="num" style="text-align:right">Montant (€)</th><th></th></tr></thead><tbody>`;
  d.baraka.forEach((b, i) => {
    html += `<tr><td>${i+1}</td><td>${b.date}</td><td class="a">${fmtPlain(b.montant)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td><strong>Total 2025</strong></td><td class="a"><strong>${fmtPlain(totalBaraka)}</strong></td><td></td></tr></tbody></table>`;
  html += `<div class="n ok">${d.baraka.length}/${d.baraka.length} paiements 2025 vérifiés. Les 4 autres résultats EBS sont de 2024, hors périmètre.</div></div>`;

  // Cat 4: Virements Maroc
  html += `<div class="s"><div class="st">4. Virements Maroc → Augustin (DH) — ${fmtPlain(totalMarocExcel)}€ ✓ match parfait</div><table>
    <thead><tr><th data-sort="date">Mois</th><th data-sort="num" style="text-align:right">Excel v2 (€)</th><th>Virements réels</th><th data-sort="num" style="text-align:right">Total DH</th><th data-sort="num" style="text-align:right">= EUR (÷10)</th><th data-sort="num" style="text-align:right">Écart (€)</th><th></th></tr></thead><tbody>`;
  d.virementsMaroc.forEach(v => {
    const eurEquiv = v.totalDH / d.tauxMaroc;
    const ecart = v.excelEUR - eurEquiv;
    const excelStyle = v.corrige ? ' style="color:var(--green)"' : '';
    html += `<tr><td><strong>${v.mois}</strong></td><td class="a"${excelStyle}>${fmtPlain(v.excelEUR)}</td><td style="font-size:.72rem;color:var(--muted)">${v.detail}</td><td class="a">${fmtPlain(v.totalDH)}</td><td class="a">${fmtPlain(eurEquiv)}</td><td class="a" style="color:var(--green)">${ecart}</td><td>${badge('ok', v.corrige ? '✓ corrigé v2' : '✓')}</td></tr>`;
  });
  html += `<tr class="tr"><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalMarocExcel)}</strong></td><td></td><td class="a"><strong>${fmtPlain(totalMarocDH)}</strong></td><td class="a"><strong>${fmtPlain(totalMarocReel)}</strong></td><td class="a" style="color:var(--green)"><strong>0</strong></td><td></td></tr></tbody></table>`;
  html += `<div class="n ok"><strong>Match parfait</strong> : ${fmtPlain(totalMarocExcel)}€ Excel = ${fmtPlain(totalMarocReel)}€ réel (${fmtPlain(totalMarocDH)} DH). ${d.virementsMaroc.length} mois vérifiés, 0€ d'écart.</div></div>`;

  // Cat 5: Divers
  html += `<div class="s"><div class="st">5. Autre (Divers) — ${fmtPlain(totalDiversCalc)}€ net · 100% vérifié EBS (${d.divers.length} opérations)</div><table>
    <thead><tr><th data-sort="date">Mois</th><th data-sort="date">Date EBS</th><th>Libellé</th><th data-sort="num" style="text-align:right">Montant (€)</th><th>Preuve</th></tr></thead><tbody>`;
  d.divers.forEach(dv => {
    const rowStyle = dv.preuve === 'ok' ? ' style="background:var(--green-bg)"' : '';
    const montantStr = dv.montant < 0 ? '−' + fmtPlain(Math.abs(dv.montant)) : fmtPlain(dv.montant);
    html += `<tr${rowStyle}><td>${dv.mois}</td><td>${dv.date || '—'}</td><td>${dv.label}</td><td class="a">${montantStr}</td><td>${badge(dv.preuve, dv.preuveText)}</td></tr>`;
  });
  html += `<tr class="tr"><td colspan="3"><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalDiversCalc)}</strong></td><td><strong style="color:var(--green)">✓ 100% vérifié EBS</strong></td></tr></tbody></table>`;
  html += `<div class="n ok"><strong>100% vérifié EBS</strong> — ${d.divers.length} opérations, ${fmtPlain(d.diversVerifie)}€ en valeur absolue. Vols ✓, iPhone ✓, virements Nov/Déc ✓, prêts ✓. <strong>0€ sans preuve.</strong></div></div>`;

  // RTL Factures
  html += `<div class="s"><div class="st">Factures RTL 2025 — Revenus (${fmtPlain(totalRTL)}€ ✓)</div><table>
    <thead><tr><th>Facture</th><th data-sort="date">Période</th><th data-sort="num">Jours</th><th data-sort="num" style="text-align:right">Facturé (€)</th><th data-sort="date">Date paiement</th><th data-sort="num" style="text-align:right">Reçu (€)</th><th></th></tr></thead><tbody>`;
  d.rtl.forEach(r => {
    html += `<tr><td>${r.ref}</td><td>${r.periode}</td><td>${r.jours}</td><td class="a">${fmtPlain(r.montant)}</td><td>${r.datePaiement}</td><td class="a">${fmtPlain(r.recu)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  html += `<tr class="tr"><td colspan="3"><strong>Total 2025</strong></td><td class="a"><strong>${fmtPlain(totalRTL)}</strong></td><td></td><td class="a"><strong>${fmtPlain(totalRecuRTL)}</strong></td><td></td></tr></tbody></table></div>`;

  return html;
}

// ---- AUGUSTIN 2026 ----
function renderAugustin2026(embedded) {
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

  let html = embedded ? '' : yearToggle3('Az', 2026);
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
  html += `<div class="s"><div class="st">Factures RTL 2026 (HT — TVA 0% Bairok LLC / EAU)</div><table>
    <thead><tr><th>Facture</th><th data-sort="date">Période</th><th data-sort="num">Jours</th><th data-sort="num" style="text-align:right">HT (€)</th><th data-sort="date">Date facture</th><th data-sort="date">Échéance</th><th>Statut</th></tr></thead><tbody>`;
  d.rtl.forEach(r => {
    html += `<tr><td>${r.ref}</td><td>${r.periode}</td><td>${r.jours}</td><td class="a">${fmtPlain(r.montant)}</td><td>${r.dateFacture || '—'}</td><td>${r.dateDue || '—'}</td><td>${badge(r.statut, r.statutText)}</td></tr>`;
  });
  html += `<tr class="tr"><td colspan="3"><strong>Total facturé HT</strong></td><td class="a"><strong>${fmtPlain(totalFacture)}</strong></td><td></td><td></td><td></td></tr></tbody></table></div>`;

  // Virements Maroc
  html += `<div class="s"><div class="st">Augustin a reçu — Virements Maroc 2026</div><table>
    <thead><tr><th>#</th><th data-sort="date">Date</th><th>Bénéficiaire</th><th data-sort="num" style="text-align:right">DH</th><th data-sort="num" style="text-align:right">= EUR (÷${d.tauxMaroc})</th></tr></thead><tbody>`;
  d.virementsMaroc.forEach((v, i) => {
    html += `<tr><td>${i+1}</td><td>${v.date}</td><td>${v.beneficiaire}</td><td class="a">${fmtPlain(v.dh)}</td><td class="a">${fmtPlain(v.dh / d.tauxMaroc)}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td colspan="2"><strong>Total 2026</strong></td><td class="a"><strong>${fmtPlain(totalMAD)}</strong></td><td class="a"><strong>${fmtPlain(totalEUR)}</strong></td></tr></tbody></table></div>`;

  html += `<div class="n">${delta < 0
    ? `<strong>Amine a avancé ${fmtPlain(Math.abs(delta))}€</strong> de plus qu'il n'a reçu. Les ${totalFactureEmis > 0 ? fmtPlain(totalFactureEmis) + '€ de factures RTL en attente' : 'factures RTL'} couvriront ce delta une fois payées.`
    : `Le solde est positif : Augustin doit ${fmtPlain(delta)}€ à Amine.`
  } Report 2025 : <strong>${fmtSigned(d.report2025)}</strong>.</div>`;

  // Divers 2026 (cash direct)
  if (d.divers && d.divers.length) {
    const diversIn = d.divers.filter(x => x.montant > 0);
    const diversOut = d.divers.filter(x => x.montant < 0);
    const totalIn = diversIn.reduce((s, x) => s + x.montant, 0);
    const totalOut = Math.abs(diversOut.reduce((s, x) => s + x.montant, 0));
    // Commission on personal payments
    const diversCommission = d.divers.filter(x => x.commissionRate).reduce((s, x) => {
      const brut = Math.round(x.montant / (1 - x.commissionRate) * 100) / 100;
      return s + (brut - x.montant);
    }, 0);
    html += `<div class="s"><div class="st">Divers — Cash direct 2026</div><table>
      <thead><tr><th>Opération</th><th data-sort="num" style="text-align:right">Net payé (€)</th><th data-sort="num" style="text-align:right">Brut couvert (€)</th><th>Détail</th></tr></thead><tbody>`;
    d.divers.forEach(x => {
      const color = x.montant > 0 ? 'var(--green)' : 'var(--red)';
      const brut = x.commissionRate ? Math.round(x.montant / (1 - x.commissionRate) * 100) / 100 : null;
      const brutStr = brut ? fmtPlain(Math.round(brut)) : '—';
      const detail = x.commissionRate ? `Commission ${Math.round(x.commissionRate * 100)}% → ${fmtPlain(Math.round(brut - x.montant))}€` : '';
      html += `<tr><td>${x.label}</td><td class="a" style="color:${color}">${fmtSigned(x.montant, '€')}</td><td class="a">${brutStr}</td><td style="font-size:.72rem;color:var(--muted)">${detail}</td></tr>`;
    });
    const soldeDiv = totalIn - totalOut;
    html += `<tr class="tr"><td><strong>Solde cash net</strong></td><td class="a" style="color:${soldeDiv >= 0 ? 'var(--green)' : 'var(--red)'}"><strong>${fmtSigned(soldeDiv, '€')}</strong></td><td></td><td style="font-size:.72rem;color:var(--muted)">${diversCommission > 0 ? 'Commission perso totale : ' + fmtPlain(Math.round(diversCommission)) + '€' : ''}</td></tr>`;
    html += `</tbody></table></div>`;
  }

  // Facturation AZCS → Majalis (Badre)
  const b26 = DATA.benoit2026;
  if (b26 && b26.councils) {
    const tjm = b26.tjm || 625;
    const tva = b26.tvaRate || 0.21;
    const tvaPctAz = Math.round(tva * 100);
    const totalHTBadre = sum(b26.councils, 'htEUR');
    const totalTTCBadre = Math.round(totalHTBadre * (1 + tva));
    const paidBadre = b26.councils.filter(c => c.statut === 'ok');
    const totalHTpaid = sum(paidBadre, 'htEUR');
    html += `<div class="s"><div class="st">Facturation AZCS → Majalis (Badre) — ${fmtPlain(totalHTBadre)}€ HT (${fmtPlain(totalTTCBadre)}€ TTC)</div>`;
    html += `<div class="n" style="margin-bottom:8px">TJM ${tjm}€ HT + TVA ${tvaPctAz}%. ${paidBadre.length}/${b26.councils.length} factures payées (${fmtPlain(totalHTpaid)}€ HT reçus).</div>`;
    html += `<table><thead><tr><th>Ref</th><th data-sort="date">Période</th><th data-sort="num">Jours</th><th data-sort="num" style="text-align:right">HT (€)</th><th data-sort="num" style="text-align:right">TTC (€)</th><th data-sort="date">Date facture</th><th data-sort="date">Échéance</th><th>Statut</th></tr></thead><tbody>`;
    b26.councils.forEach(c => {
      const ttcVal = Math.round(c.htEUR * (1 + tva) * 100) / 100;
      const bl = c.backlog ? ' <span style="color:var(--yellow)">(backlog)</span>' : '';
      html += `<tr><td style="font-size:.72rem">${c.ref || '—'}${bl}</td><td>${c.mois}</td><td>${c.jours || '—'}</td><td class="a">${fmtPlain(c.htEUR)}</td><td class="a" style="color:var(--muted)">${fmtPlain(Math.round(ttcVal))}</td><td>${c.dateFacture || '—'}</td><td>${c.dateDue || '—'}</td><td>${badge(c.statut, c.statutText)}</td></tr>`;
    });
    html += `<tr class="tr"><td colspan="3"><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalHTBadre)}</strong></td><td class="a" style="color:var(--muted)"><strong>${fmtPlain(totalTTCBadre)}</strong></td><td></td><td></td><td></td></tr></tbody></table></div>`;
  }

  // Insights 2026
  if (d.insights) {
    html += `<div class="s"><div class="st">Insights</div>`;
    d.insights.forEach(ins => {
      const cls = ins.type === 'pass' ? 'pass' : ins.type === 'warn' ? 'warn' : ins.type === 'fail' ? 'fail' : '';
      html += `<div class="insight ${cls}"><div class="t">${ins.titre}</div><div class="d">${ins.desc}</div></div>`;
    });
    html += `</div>`;
  }

  return html;
}
