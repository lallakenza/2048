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

  // Hero card
  const solde25Color = soldeCorrige < 0 ? 'red' : 'green';
  const solde25Msg = soldeCorrige < 0 ? 'Augustin doit à Amine' : 'Amine doit à Augustin';
  html += `<div class="hero-card" style="border-color:var(--${solde25Color})">
    <div class="hero-label">Clôture 2025</div>
    <div class="hero-value ${solde25Color}">${fmtSigned(soldeCorrige)}</div>
    <div class="hero-who" style="color:var(--${solde25Color})">${solde25Msg}</div>
    <div class="hero-detail">Réconciliation 100% complète · 0€ sans preuve</div>
  </div>`;
  html += `<div class="summary-row">
    <div class="summary-item"><div class="sl">Actuals Jan–Déc</div><div class="sv" style="color:var(--accent)">${fmtPlain(totalActuals)} €</div></div>
    <div class="summary-item"><div class="sl">Total dépenses</div><div class="sv" style="color:var(--yellow)">${fmtPlain(totalDepenses)} €</div></div>
    <div class="summary-item"><div class="sl">RTL 2025</div><div class="sv" style="color:var(--green)">${fmtPlain(totalRTL)} €</div><div class="sd">${d.rtl.length} factures payées</div></div>
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

  let synthHtml = `<table>
    <thead><tr><th>Catégorie</th><th style="text-align:right">Excel v2 (€)</th><th style="text-align:right">Vérifié EBS/Banque (€)</th><th style="text-align:right">Écart (€)</th><th>Statut</th></tr></thead><tbody>`;

  categories.forEach(c => {
    const ecart = c.ecartOverride !== undefined ? -(c.verifie - c.excel) : c.excel - c.verifie;
    const ecartColor = ecart === 0 ? 'var(--green)' : 'var(--yellow)';
    synthHtml += `<tr><td><strong>${c.nom}</strong></td><td class="a">${fmtPlain(c.excel)}</td><td class="a">${fmtPlain(c.verifie)}</td><td class="a" style="color:${ecartColor}">${ecart === 0 ? '0' : fmtSigned(ecart, '')}</td><td>${badge('ok', c.statut)}</td></tr>`;
  });

  const ecartTotal = totalExcelCat - totalVerifieCat;
  synthHtml += `<tr class="tr"><td><strong>Total dépenses</strong></td><td class="a"><strong>${fmtPlain(totalExcelCat)}</strong></td><td class="a"><strong>${fmtPlain(totalVerifieCat)}</strong></td><td class="a" style="color:var(--yellow)"><strong>${fmtSigned(ecartTotal, '')}</strong></td><td></td></tr>`;
  synthHtml += `</tbody></table>`;

  // Note synthèse
  synthHtml += `<div class="n">
    <strong>Résultat (Excel v2) :</strong> Augustin a largement corrigé son fichier. <strong>Les 5 catégories sont désormais 100% vérifiées par EBS/Banque.</strong> Ycarré, Councils, Baraka matchent à 100%. Le Maroc Fév-Déc matche parfaitement (${fmtPlain(totalMarocExcel)}€ Excel = ${fmtPlain(totalMarocReel)}€ réel). Les Divers (${d.divers.length} opérations, ${fmtPlain(d.diversVerifie)}€ en valeur absolue) sont intégralement confirmés par EBS.<br><br>
    Solde Excel = Solde corrigé : <strong>${fmtSigned(soldeExcel)}</strong> (Augustin te doit).<br>
    <strong style="color:var(--green)">0€ sans preuve — Réconciliation complète.</strong>
  </div>`;

  html += collapsible('Synthèse des 5 catégories (Excel v2)', synthHtml);

  // Mois par mois
  let moisHtml = `<table>
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

    moisHtml += `<tr><td><strong>${m.nom}</strong></td>
      <td class="a">${fmtPlain(m.actuals)}</td>
      <td class="a"${bymStyle}>${m.bym === 0 ? '—' : fmtPlain(m.bym)}</td>
      <td class="a"${marocStyle}>${m.maroc === 0 ? '—' : fmtPlain(m.maroc)}</td>
      <td class="a"${diversStyle}>${m.divers === 0 ? '—' : (m.divers < 0 ? '−' + fmtPlain(Math.abs(m.divers)) : fmtPlain(m.divers))}</td>
      <td class="a">${fmtPlain(dep)}</td>
      <td class="a" style="color:${soldeColor}">${fmtSigned(solde, '')}</td>
      <td style="font-size:.7rem;color:var(--muted)">${badge(m.badge, m.badgeText)} ${m.commentaire}</td></tr>`;
  });

  moisHtml += `<tr class="tr"><td><strong>Total</strong></td>
    <td class="a"><strong>${fmtPlain(totalActuals)}</strong></td>
    <td class="a"><strong>${fmtPlain(totalBYM)}</strong></td>
    <td class="a"><strong>${fmtPlain(totalMaroc)}</strong></td>
    <td class="a"><strong>${fmtPlain(totalDivers)}</strong></td>
    <td class="a"><strong>${fmtPlain(totalDepenses)}</strong></td>
    <td class="a"><strong>${fmtSigned(totalSoldeMois, '')}</strong></td>
    <td style="font-size:.7rem;color:var(--muted)">Maroc Fév-Déc = Excel (${fmtPlain(totalMarocExcel)}€)</td></tr>`;
  moisHtml += `</tbody></table>`;
  moisHtml += `<div class="n"><strong>Note :</strong> Le solde cumulé (${fmtSigned(totalSoldeMois, '€')}) inclut Janvier (${fmtPlain(mois[0].actuals)}€ d'Actuals sans dépenses). Le solde "Balance" d'Augustin (${fmtSigned(soldeExcel)}) est calculé <strong>sans Janvier</strong> (Fév-Déc uniquement) : ${fmtPlain(actualsFevDec)} − ${fmtPlain(depFevDec)} = ${fmtSigned(soldeExcel)}. Maroc réel = Excel (${fmtPlain(totalMarocExcel)}€) — parfait match.</div>`;

  html += collapsible('Réconciliation mois par mois (Janvier → Décembre 2025)', moisHtml);

  // Insights
  let insightsHtml = '';
  d.insights.forEach(ins => {
    const cls = ins.type === 'pass' ? 'pass' : ins.type === 'warn' ? 'warn' : ins.type === 'fail' ? 'fail' : '';
    insightsHtml += `<div class="insight ${cls}"><div class="t">${ins.titre}</div><div class="d">${ins.desc}</div></div>`;
  });
  html += collapsible('Insights clés — Fichier v2 vs v1', insightsHtml);

  // Cat 1: Ycarré
  let ycarreHtml = `<table>
    <thead><tr><th>#</th><th data-sort="date">Date EBS</th><th data-sort="num" style="text-align:right">EBS (€)</th><th></th></tr></thead><tbody>`;
  d.ycarre.forEach((y, i) => {
    ycarreHtml += `<tr><td>${i+1}</td><td>${y.date}</td><td class="a">${fmtPlain(y.montant)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  ycarreHtml += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalYcarré)}</strong></td><td></td></tr></tbody></table>`;
  html += collapsible('1. Ycarré (Oum Yakout) — ' + fmtPlain(totalYcarré) + '€ ✓', ycarreHtml);

  // Cat 2: Councils
  let councilsHtml = `<table>
    <thead><tr><th>#</th><th data-sort="date">Date EBS</th><th data-sort="num" style="text-align:right">Excel HT (€)</th><th data-sort="num" style="text-align:right">EBS HT (€)</th><th data-sort="num" style="text-align:right">Écart</th><th></th></tr></thead><tbody>`;
  d.councils.forEach((m, i) => {
    const ecart = m.excelHT - m.ebsHT;
    councilsHtml += `<tr><td>${i+1}</td><td>${m.date}</td><td class="a">${fmtPlain(m.excelHT)}</td><td class="a">${fmtPlain(m.ebsHT)}</td><td class="a">${ecart}</td><td>${badge('ok', m.note ? '✓ ' + m.note : '✓')}</td></tr>`;
  });
  const totalMajExcel = sum(d.councils, 'excelHT');
  councilsHtml += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalMajExcel)}</strong></td><td class="a"><strong>${fmtPlain(totalCouncils)}</strong></td><td class="a" style="color:var(--green)"><strong>0</strong></td><td></td></tr></tbody></table>`;
  html += collapsible('2. Councils HT (Benoit) — ' + fmtPlain(totalCouncils) + '€ ✓ (corrigé v2)', councilsHtml);

  // Cat 3: Baraka
  let barakaHtml = `<table>
    <thead><tr><th>#</th><th data-sort="date">Date EBS</th><th data-sort="num" style="text-align:right">Montant (€)</th><th></th></tr></thead><tbody>`;
  d.baraka.forEach((b, i) => {
    barakaHtml += `<tr><td>${i+1}</td><td>${b.date}</td><td class="a">${fmtPlain(b.montant)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  barakaHtml += `<tr class="tr"><td></td><td><strong>Total 2025</strong></td><td class="a"><strong>${fmtPlain(totalBaraka)}</strong></td><td></td></tr></tbody></table>`;
  barakaHtml += `<div class="n ok">${d.baraka.length}/${d.baraka.length} paiements 2025 vérifiés. Les 4 autres résultats EBS sont de 2024, hors périmètre.</div>`;
  html += collapsible('3. Baraka EUR (→ Augustin) — ' + fmtPlain(totalBaraka) + '€ ✓', barakaHtml);

  // Cat 4: Virements Maroc
  let virementsHtml = `<table>
    <thead><tr><th data-sort="date">Mois</th><th data-sort="num" style="text-align:right">Excel v2 (€)</th><th>Virements réels</th><th data-sort="num" style="text-align:right">Total DH</th><th data-sort="num" style="text-align:right">= EUR (÷10)</th><th data-sort="num" style="text-align:right">Écart (€)</th><th></th></tr></thead><tbody>`;
  d.virementsMaroc.forEach(v => {
    const eurEquiv = v.totalDH / d.tauxMaroc;
    const ecart = v.excelEUR - eurEquiv;
    const excelStyle = v.corrige ? ' style="color:var(--green)"' : '';
    virementsHtml += `<tr><td><strong>${v.mois}</strong></td><td class="a"${excelStyle}>${fmtPlain(v.excelEUR)}</td><td style="font-size:.72rem;color:var(--muted)">${v.detail}</td><td class="a">${fmtPlain(v.totalDH)}</td><td class="a">${fmtPlain(eurEquiv)}</td><td class="a" style="color:var(--green)">${ecart}</td><td>${badge('ok', v.corrige ? '✓ corrigé v2' : '✓')}</td></tr>`;
  });
  virementsHtml += `<tr class="tr"><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalMarocExcel)}</strong></td><td></td><td class="a"><strong>${fmtPlain(totalMarocDH)}</strong></td><td class="a"><strong>${fmtPlain(totalMarocReel)}</strong></td><td class="a" style="color:var(--green)"><strong>0</strong></td><td></td></tr></tbody></table>`;
  virementsHtml += `<div class="n ok"><strong>Match parfait</strong> : ${fmtPlain(totalMarocExcel)}€ Excel = ${fmtPlain(totalMarocReel)}€ réel (${fmtPlain(totalMarocDH)} DH). ${d.virementsMaroc.length} mois vérifiés, 0€ d'écart.</div>`;
  html += collapsible('4. Virements Maroc → Augustin (DH) — ' + fmtPlain(totalMarocExcel) + '€ ✓ match parfait', virementsHtml);

  // Cat 5: Divers
  let diversHtml = `<table>
    <thead><tr><th data-sort="date">Mois</th><th data-sort="date">Date EBS</th><th>Libellé</th><th data-sort="num" style="text-align:right">Montant (€)</th><th>Preuve</th></tr></thead><tbody>`;
  d.divers.forEach(dv => {
    const rowStyle = dv.preuve === 'ok' ? ' style="background:var(--green-bg)"' : '';
    const montantStr = dv.montant < 0 ? '−' + fmtPlain(Math.abs(dv.montant)) : fmtPlain(dv.montant);
    diversHtml += `<tr${rowStyle}><td>${dv.mois}</td><td>${dv.date || '—'}</td><td>${dv.label}</td><td class="a">${montantStr}</td><td>${badge(dv.preuve, dv.preuveText)}</td></tr>`;
  });
  diversHtml += `<tr class="tr"><td colspan="3"><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalDiversCalc)}</strong></td><td><strong style="color:var(--green)">✓ 100% vérifié EBS</strong></td></tr></tbody></table>`;
  diversHtml += `<div class="n ok"><strong>100% vérifié EBS</strong> — ${d.divers.length} opérations, ${fmtPlain(d.diversVerifie)}€ en valeur absolue. Vols ✓, iPhone ✓, virements Nov/Déc ✓, prêts ✓. <strong>0€ sans preuve.</strong></div>`;
  html += collapsible('5. Autre (Divers) — ' + fmtPlain(totalDiversCalc) + '€ net · 100% vérifié EBS (' + d.divers.length + ' opérations)', diversHtml);

  // RTL Factures
  let rtlHtml = `<table>
    <thead><tr><th>Facture</th><th data-sort="date">Période</th><th data-sort="num">Jours</th><th data-sort="num" style="text-align:right">Facturé (€)</th><th data-sort="date">Date paiement</th><th data-sort="num" style="text-align:right">Reçu (€)</th><th></th></tr></thead><tbody>`;
  d.rtl.forEach(r => {
    rtlHtml += `<tr><td>${r.ref}</td><td>${r.periode}</td><td>${r.jours}</td><td class="a">${fmtPlain(r.montant)}</td><td>${r.datePaiement}</td><td class="a">${fmtPlain(r.recu)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
  });
  rtlHtml += `<tr class="tr"><td colspan="3"><strong>Total 2025</strong></td><td class="a"><strong>${fmtPlain(totalRTL)}</strong></td><td></td><td class="a"><strong>${fmtPlain(totalRecuRTL)}</strong></td><td></td></tr></tbody></table>`;
  html += collapsible('Factures RTL 2025 — Revenus (' + fmtPlain(totalRTL) + '€ ✓)', rtlHtml);

  return html;
}

// ---- AUGUSTIN 2026 ----
function renderAugustin2026(embedded) {
  const d = DATA.augustin2026;

  // =====================================================
  // CALCULS — 3 montants par flux : TTC / HT (Pro) / Perso
  // =====================================================
  const b26 = DATA.benoit2026;
  const tvaAZCS = (b26 && b26.tvaRate) ? b26.tvaRate : 0.21;

  // --- RTL (Bairok, TVA 0%) : TTC = HT = Perso ---
  const totalFacture = sum(d.rtl, 'montant');        // toutes factures
  const paidRTL = d.rtl.filter(r => r.statut === 'ok');
  const amineRecu = sum(paidRTL, 'montant');          // paid only
  const pendingRTL = d.rtl.filter(r => r.statut !== 'ok');
  const totalPending = sum(pendingRTL, 'montant');
  // RTL: TTC = HT = Perso (TVA 0%)
  const rtlPaidHT = amineRecu;
  const rtlPaidTTC = amineRecu;
  const rtlPaidPerso = amineRecu;

  // --- AZCS (Majalis→AZCS via Badre, 21% TVA belge) : TTC = HT×1.21, Perso = HT ---
  const azcsAll = (b26 && b26.councils) ? b26.councils : [];
  const azcsPaid = azcsAll.filter(c => c.statut === 'ok');
  const azcsInvoiced = azcsAll.filter(c => c.statut === 'ok' || c.statut === 'w');
  const azcsRecuPaid = sum(azcsPaid, 'htEUR');
  const azcsRecuInvoiced = sum(azcsInvoiced, 'htEUR');
  const azcsRecuAll = sum(azcsAll, 'htEUR');
  const azcsPaidTTC = Math.round(azcsRecuPaid * (1 + tvaAZCS));
  const azcsInvoicedTTC = Math.round(azcsRecuInvoiced * (1 + tvaAZCS));
  const azcsAllTTC = Math.round(azcsRecuAll * (1 + tvaAZCS));

  // --- TAUX DE CHANGE PRO → PERSO (commission 5% Amine) ---
  // Règle universelle : Perso = Pro × 0.95 (comme un taux de change fixe)
  // Chaque transaction est postée en TTC / Pro / Perso avec cette règle
  const PERSO_FACTOR = 0.95; // 1€ Pro = 0.95€ Perso

  // --- Virements Maroc ---
  const totalMAD = sum(d.virementsMaroc, 'dh');
  const virementsProEUR = totalMAD / d.tauxMaroc;

  // --- Divers : montant = PERSO (cash réel donné). Pro = montant / PERSO_FACTOR ---
  // Exception: proOrigin = true → montant IS Pro. Perso = montant × PERSO_FACTOR
  //   (remboursement prêt : dette en pro, display montant* en perso)
  const diversPerso = d.divers ? d.divers.reduce((s, x) => {
    if (x.proOrigin) return s + Math.round(x.montant * PERSO_FACTOR * 100) / 100;
    return s + x.montant;
  }, 0) : 0;
  const diversPro = d.divers ? d.divers.reduce((s, x) => {
    if (x.proOrigin) return s + x.montant; // montant IS pro
    return s + Math.round(x.montant / PERSO_FACTOR * 100) / 100;
  }, 0) : 0;

  // --- Itemized divers for table display ---
  const diversItems = d.divers ? d.divers.map(x => {
    if (x.proOrigin) {
      // montant = PRO. Perso = Pro × 0.95. Display: montant* in perso col
      const pro = x.montant;
      const perso = Math.round(pro * PERSO_FACTOR * 100) / 100;
      return { ...x, pro, perso, displayPerso: x.montant, commission: 0 };
    }
    const perso = x.montant; // montant IS perso (cash réel)
    const pro = Math.round(perso / PERSO_FACTOR * 100) / 100;
    return { ...x, pro, perso, commission: Math.round((pro - perso) * 100) / 100 };
  }) : [];

  // =====================================================
  // POSITIONS — Entreprise + Net (Pro & Perso)
  // =====================================================

  // Position Entreprise
  const deltaEntreprisePaid = rtlPaidHT - azcsRecuPaid + d.report2025;
  const deltaEntreprisePaidTTC = rtlPaidTTC - azcsPaidTTC + d.report2025;

  // Position Net PRO = entreprise − virements_pro − divers_pro
  const deltaNetPro = deltaEntreprisePaid - virementsProEUR - diversPro;
  // Position Net PERSO = Pro × 0.95 (règle universelle)
  const deltaNetPerso = deltaNetPro * PERSO_FACTOR;
  // Commission Amine globale (5% sur position Pro)
  const commissionAmine = Math.round((deltaNetPro - deltaNetPerso) * 100) / 100;

  // Invoiced
  const invoicedRTL = d.rtl.filter(r => r.ref !== '—');
  const totalInvoiced = sum(invoicedRTL, 'montant');
  const deltaEntrepriseInvoiced = totalInvoiced - azcsRecuInvoiced + d.report2025;
  const deltaInvoicedPro = deltaEntrepriseInvoiced - virementsProEUR - diversPro;
  const deltaInvoicedPerso = deltaInvoicedPro * PERSO_FACTOR;

  // Accrued
  const deltaEntrepriseAccrued = totalFacture - azcsRecuAll + d.report2025;
  const deltaAccruedPro = deltaEntrepriseAccrued - virementsProEUR - diversPro;
  const deltaAccruedPerso = deltaAccruedPro * PERSO_FACTOR;

  let html = embedded ? '' : yearToggle3('Az', 2026);
  html += `<h2 style="font-size:1.05rem;margin-bottom:16px">${d.title}</h2>`;

  // ---- HERO CARDS: 3 options de règlement équivalentes ----
  // Taux fixe : 1 000€ PRO = 10 000 MAD → Maroc = deltaNetPro × tauxMaroc
  const absNetPro = Math.abs(Math.round(deltaNetPro));
  const absNetPerso = Math.abs(Math.round(deltaNetPerso));
  const absNetMAD = Math.abs(Math.round(deltaNetPro * d.tauxMaroc));
  const whoOwes = deltaNetPro >= 0 ? 'Amine doit à Augustin' : 'Augustin doit à Amine';
  const heroColor = deltaNetPro >= 0 ? 'var(--green)' : 'var(--red)';
  const heroCls = deltaNetPro >= 0 ? 'green' : 'red';

  html += `<div style="font-size:.7rem;color:var(--muted);margin-bottom:6px">Position Entreprise : <strong style="color:${deltaEntreprisePaid >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtSigned(deltaEntreprisePaid)}</strong> (RTL − Majalis→AZCS + Report) · <strong>${whoOwes}</strong></div>`;
  html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
    <div class="hero-card" style="border-color:${heroColor}">
      <div class="hero-label">Si paiement France (pro)</div>
      <div class="hero-value ${heroCls}" style="font-size:1.3rem">${fmtSigned(Math.round(deltaNetPro))}</div>
      <div class="hero-who" style="color:${heroColor}">→ ${whoOwes}</div>
      <div class="hero-detail">Virement entreprise · montant brut</div>
    </div>
    <div class="hero-card" style="border-color:${heroColor}">
      <div class="hero-label">Si paiement France (perso)</div>
      <div class="hero-value ${heroCls}" style="font-size:1.3rem">${fmtSigned(Math.round(deltaNetPerso))}</div>
      <div class="hero-who" style="color:${heroColor}">→ ${whoOwes}</div>
      <div class="hero-detail">Cash EUR · Perso = Pro × 0.95</div>
    </div>
    <div class="hero-card" style="border-color:${heroColor}">
      <div class="hero-label">Si paiement Maroc</div>
      <div class="hero-value ${heroCls}" style="font-size:1.3rem">${deltaNetPro >= 0 ? '+' : '−'}${absNetMAD.toLocaleString('fr-FR')} MAD</div>
      <div class="hero-who" style="color:${heroColor}">→ ${whoOwes}</div>
      <div class="hero-detail">Taux fixe : 1 000€ pro = ${(d.tauxMaroc * 1000).toLocaleString('fr-FR')} MAD</div>
    </div>
  </div>`;

  // ---- Summary row ----
  html += `<div style="font-size:.7rem;font-weight:600;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Flux entreprise (TTC / HT identiques car TVA 0% sur RTL)</div>`;
  html += `<div class="summary-row" style="margin-bottom:8px">
    <div class="summary-item"><div class="sl">RTL reçu (Bairok)</div><div class="sv" style="color:var(--green)">${fmtPlain(rtlPaidHT)} €</div><div class="sd">HT = TTC (TVA 0%)</div></div>
    <div class="summary-item"><div class="sl">Majalis → AZCS (via Benoit)</div><div class="sv" style="color:var(--blue,#60a5fa)">${fmtPlain(azcsRecuPaid)} €</div><div class="sd">TTC : ${fmtPlain(azcsPaidTTC)}€ (21% TVA)</div></div>
    <div class="summary-item"><div class="sl">Report 2025</div><div class="sv" style="color:var(--red)">${fmtSigned(d.report2025)}</div><div class="sd">Solde clôture 2025</div></div>
    <div class="summary-item"><div class="sl">En attente RTL</div><div class="sv" style="color:var(--yellow)">${fmtPlain(totalPending)} €</div><div class="sd">Pas encore payé</div></div>
  </div>`;
  html += `<div style="font-size:.7rem;font-weight:600;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Flux personnel (Pro vs Perso)</div>`;
  html += `<div class="summary-row">
    <div class="summary-item"><div class="sl">Virements Maroc</div><div class="sv" style="color:var(--accent)">${fmtPlain(virementsProEUR)} €</div><div class="sd">${fmtPlain(totalMAD)} MAD · Pro = Perso</div></div>
    <div class="summary-item"><div class="sl">Cash divers (perso)</div><div class="sv" style="color:var(--accent)">${fmtPlain(Math.round(diversPerso))} €</div><div class="sd">Cash réel donné</div></div>
    <div class="summary-item"><div class="sl">Cash divers (pro)</div><div class="sv" style="color:var(--accent)">${fmtPlain(Math.round(diversPro))} €</div><div class="sd">= Perso ÷ 0.95</div></div>
  </div>`;

  // View toggle (secondary)
  html += `<div style="display:flex;gap:0;margin-bottom:16px;background:var(--surface2);border-radius:8px;padding:3px;width:fit-content">
    <button onclick="switchRecoView('paid')" id="reco-btn-paid" style="padding:5px 14px;border:none;border-radius:6px;cursor:pointer;font-size:.7rem;font-weight:600;background:var(--accent);color:#fff;transition:all .2s">Cash réel</button>
    <button onclick="switchRecoView('invoiced')" id="reco-btn-invoiced" style="padding:5px 14px;border:none;border-radius:6px;cursor:pointer;font-size:.7rem;font-weight:600;background:transparent;color:var(--muted);transition:all .2s">Facturé</button>
    <button onclick="switchRecoView('accrued')" id="reco-btn-accrued" style="padding:5px 14px;border:none;border-radius:6px;cursor:pointer;font-size:.7rem;font-weight:600;background:transparent;color:var(--muted);transition:all .2s">Projection</button>
  </div>`;

  // =====================================================
  // HELPER: Build a reconciliation table with TTC / Pro / Perso columns
  // =====================================================
  function recoTable(id, title, display, cfg) {
    const { rtlLabel, rtlHT, rtlTTC, azcsHT, azcsTTC, azcsLabel, azcsCount,
            rtlCount, deltaE, deltaEtc,
            deltaNetPro: dnPro, deltaNetPerso: dnPerso } = cfg;
    const s = display === 'none' ? ' style="display:none"' : '';
    const thStyle = 'style="text-align:right;font-size:.7rem"';
    const secHdr = (n, label, bg) => `<tr style="background:${bg}"><td colspan="7" style="font-size:.72rem;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted)">${n} ${label}</td></tr>`;
    // Pill badge for native currency highlighting
    const pill = (val, type) => {
      const styles = {
        pro:  'background:rgba(99,102,241,.13);color:#6366f1;border-radius:4px;padding:1px 6px;font-weight:700',
        eur:  'background:rgba(16,185,129,.13);color:#059669;border-radius:4px;padding:1px 6px;font-weight:700',
        mad:  'background:rgba(245,158,11,.13);color:#d97706;border-radius:4px;padding:1px 6px;font-weight:700',
      };
      return `<span style="${styles[type] || styles.pro};display:inline-block;white-space:nowrap">${val}</span>`;
    };

    let t = `<div id="reco-table-${id}" class="s"${s}><div class="st">${title}</div><table style="font-size:.8rem">
    <thead><tr><th>Ligne</th><th ${thStyle}>TTC</th><th ${thStyle}>HT (Pro)</th><th ${thStyle}>Perso €</th><th ${thStyle}>Perso MAD</th><th>Détail</th></tr></thead><tbody>`;

    // Section 1: Position Entreprise
    const PF = PERSO_FACTOR;
    t += secHdr('①', 'Position Entreprise (sociétés)', 'var(--green-bg,rgba(34,197,94,.07))');
    const TX = d.tauxMaroc;
    // RTL = money IN → positive (green)
    t += `<tr style="background:var(--green-bg,rgba(34,197,94,.07))">
      <td><strong>${rtlLabel}</strong></td>
      <td class="a" style="color:var(--green)">${fmtSigned(rtlTTC, '')}</td>
      <td class="a">${pill(fmtSigned(rtlHT, ''), 'pro')}</td>
      <td class="a" style="color:var(--green)">${fmtSigned(Math.round(rtlHT * PF), '')}</td>
      <td class="a" style="color:var(--green)">${fmtSigned(Math.round(rtlHT * TX), '')}</td>
      <td style="font-size:.72rem">${rtlCount} facture(s) · TVA 0%</td></tr>`;
    // AZCS = money OUT → negative (blue)
    t += `<tr>
      <td>${azcsLabel}</td>
      <td class="a" style="color:var(--blue,#60a5fa)">${fmtSigned(-azcsTTC, '')}</td>
      <td class="a">${pill(fmtSigned(-azcsHT, ''), 'pro')}</td>
      <td class="a" style="color:var(--blue,#60a5fa)">${fmtSigned(-Math.round(azcsHT * PF), '')}</td>
      <td class="a" style="color:var(--blue,#60a5fa)">${fmtSigned(-Math.round(azcsHT * TX), '')}</td>
      <td style="font-size:.72rem">${azcsCount} facture(s) · TVA 21%</td></tr>`;
    // Report = carried forward (already signed correctly)
    t += `<tr>
      <td>Report 2025</td>
      <td class="a" style="color:var(--red)">${fmtSigned(d.report2025, '')}</td>
      <td class="a">${pill(fmtSigned(d.report2025, ''), 'pro')}</td>
      <td class="a" style="color:var(--red)">${fmtSigned(Math.round(d.report2025 * PF), '')}</td>
      <td class="a" style="color:var(--red)">${fmtSigned(Math.round(d.report2025 * TX), '')}</td>
      <td style="font-size:.72rem">Clôture 2025</td></tr>`;
    const eColor = deltaE >= 0 ? 'var(--green)' : 'var(--red)';
    const ePerso = Math.round(deltaE * PF);
    const eMAD = Math.round(deltaE * TX);
    const eMsg = deltaE >= 0 ? 'Amine doit' : 'Augustin doit';
    t += `<tr class="tr" style="background:rgba(99,102,241,.06)">
      <td><strong>= Pos. Entreprise</strong></td>
      <td class="a" style="color:${eColor}">${fmtSigned(deltaEtc)}</td>
      <td class="a" style="color:${eColor}"><strong>${fmtSigned(deltaE)}</strong></td>
      <td class="a" style="color:${eColor}"><strong>${fmtSigned(ePerso)}</strong></td>
      <td class="a" style="color:${eColor}"><strong>${fmtSigned(eMAD, 'MAD')}</strong></td>
      <td style="font-size:.72rem">${eMsg} ${fmtPlain(Math.abs(deltaE))}€ pro</td></tr>`;

    // Spacer
    t += `<tr><td colspan="7" style="padding:6px 0"></td></tr>`;

    // Section 2: Position Net
    const virementsPerso = Math.round(virementsProEUR * PF);
    const virementsMAD = Math.round(virementsProEUR * TX);
    t += secHdr('②', 'Position Net (entreprise + personnel)', 'var(--yellow-bg,rgba(202,138,4,.07))');
    t += `<tr>
      <td>Pos. Entreprise</td>
      <td class="a" style="color:var(--muted)">—</td>
      <td class="a" style="color:${eColor}">${fmtSigned(deltaE)}</td>
      <td class="a" style="color:${eColor}">${fmtSigned(ePerso)}</td>
      <td class="a" style="color:${eColor}">${fmtSigned(eMAD, 'MAD')}</td>
      <td></td></tr>`;
    // Virements Maroc = money OUT → negative
    t += `<tr>
      <td>Virements Maroc</td>
      <td class="a" style="color:var(--muted)">—</td>
      <td class="a" style="color:var(--blue,#60a5fa)">${fmtSigned(-Math.round(virementsProEUR), '')}</td>
      <td class="a" style="color:var(--blue,#60a5fa)">${fmtSigned(-virementsPerso, '')}</td>
      <td class="a">${pill(fmtSigned(-totalMAD, ''), 'mad')}</td>
      <td style="font-size:.72rem">${fmtPlain(totalMAD)} MAD · Pro = MAD ÷ ${TX}</td></tr>`;

    // Divers itemized — negate for additive display: positive data (money to Azarkan) → negative display
    diversItems.forEach(x => {
      const dp = -Math.round(x.pro);
      const dpe = -Math.round(x.perso);
      const dm = -Math.round(x.pro * TX);
      const c = dpe > 0 ? 'var(--green)' : 'var(--blue,#60a5fa)';
      const truncLabel = ((l) => l.length > 45 ? l.substring(0, 45) + '…' : l)(nickText(x.label));
      t += `<tr>
        <td style="font-size:.75rem">${truncLabel}</td>
        <td class="a" style="color:var(--muted)">—</td>
        <td class="a" style="color:${c}">${fmtSigned(dp, '')}</td>
        <td class="a">${pill(fmtSigned(dpe, ''), 'eur')}</td>
        <td class="a" style="color:${c}">${fmtSigned(dm, '')}</td>
        <td style="font-size:.72rem;color:var(--muted)">cash perso</td></tr>`;
    });

    // Net totals
    const proColor = dnPro >= 0 ? 'var(--green)' : 'var(--red)';
    const proMsg = dnPro >= 0 ? 'Amine doit' : 'Augustin doit';
    const dnPersoCalc = Math.round(dnPro * PF);
    const dnMADCalc = Math.round(dnPro * TX);
    const commGlobal = Math.round(dnPro * (1 - PF));
    t += `<tr class="tr" style="background:rgba(99,102,241,.06)">
      <td><strong>= Pos. Net</strong></td>
      <td class="a" style="color:var(--muted)">—</td>
      <td class="a" style="color:${proColor}"><strong>${fmtSigned(Math.round(dnPro))}</strong></td>
      <td class="a" style="color:${proColor}"><strong>${fmtSigned(dnPersoCalc)}</strong></td>
      <td class="a" style="color:${proColor}"><strong>${fmtSigned(dnMADCalc, 'MAD')}</strong></td>
      <td style="font-size:.72rem">${proMsg}</td></tr>`;

    t += `</tbody></table>
    <div class="n" style="margin-top:8px;font-size:.72rem;color:var(--muted)"><strong>TTC</strong> = cash réel (TVA incluse). <strong>Pro</strong> = valeur business. <strong>Perso € = Pro × ${PF}</strong>. <strong>Perso MAD = Pro × ${TX}</strong> (taux fixe). Donc 1 000€ pro = ${(PF * 1000).toLocaleString('fr-FR')}€ perso = ${(TX * 1000).toLocaleString('fr-FR')} MAD.</div>
    <div class="n" style="margin-top:6px;font-size:.7rem;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span style="color:var(--muted)">Devise d'origine :</span> ${pill('Pro', 'pro')} <span style="color:var(--muted)">factures / prêts</span> ${pill('Perso €', 'eur')} <span style="color:var(--muted)">cash EUR</span> ${pill('MAD', 'mad')} <span style="color:var(--muted)">virements DH</span> <span style="color:var(--muted)">· * = montant virement perso (calcul : Perso = Pro × ${PF})</span></div></div>`;
    return t;
  }

  // 3 reconciliation tables
  html += recoTable('paid', 'Réconciliation 2026 — Cash réel (paid)', 'block', {
    rtlLabel: 'RTL paid (Bairok)', rtlHT: rtlPaidHT, rtlTTC: rtlPaidTTC, rtlCount: paidRTL.length,
    azcsLabel: 'Majalis → AZCS paid (via Benoit)', azcsHT: azcsRecuPaid, azcsTTC: azcsPaidTTC, azcsCount: azcsPaid.length,
    deltaE: deltaEntreprisePaid, deltaEtc: deltaEntreprisePaidTTC,
    deltaNetPro: deltaNetPro, deltaNetPerso: deltaNetPerso
  });

  html += recoTable('invoiced', 'Réconciliation 2026 — Facturé (invoiced)', 'none', {
    rtlLabel: 'RTL facturé (Bairok)', rtlHT: totalInvoiced, rtlTTC: totalInvoiced, rtlCount: invoicedRTL.length,
    azcsLabel: 'Majalis → AZCS invoiced (via Benoit)', azcsHT: azcsRecuInvoiced, azcsTTC: azcsInvoicedTTC, azcsCount: azcsInvoiced.length,
    deltaE: deltaEntrepriseInvoiced, deltaEtc: totalInvoiced - azcsInvoicedTTC + d.report2025,
    deltaNetPro: deltaInvoicedPro, deltaNetPerso: deltaInvoicedPerso
  });

  html += recoTable('accrued', 'Réconciliation 2026 — Projection (accrued)', 'none', {
    rtlLabel: 'RTL total (Bairok)', rtlHT: totalFacture, rtlTTC: totalFacture, rtlCount: d.rtl.length,
    azcsLabel: 'Majalis → AZCS total (via Benoit)', azcsHT: azcsRecuAll, azcsTTC: azcsAllTTC, azcsCount: azcsAll.length,
    deltaE: deltaEntrepriseAccrued, deltaEtc: totalFacture - azcsAllTTC + d.report2025,
    deltaNetPro: deltaAccruedPro, deltaNetPerso: deltaAccruedPerso
  });

  // Factures RTL 2026
  let rtlTableHtml = `<table>
    <thead><tr><th>Facture</th><th data-sort="date">Période</th><th data-sort="num">Jours</th><th data-sort="num" style="text-align:right">HT (€)</th><th data-sort="date">Date facture</th><th data-sort="date">Échéance</th><th>Statut</th></tr></thead><tbody>`;
  d.rtl.forEach(r => {
    rtlTableHtml += `<tr><td>${r.ref}</td><td>${r.periode}</td><td>${r.jours}</td><td class="a">${fmtPlain(r.montant)}</td><td>${r.dateFacture || '—'}</td><td>${r.dateDue || '—'}</td><td>${badge(r.statut, r.statutText)}</td></tr>`;
  });
  rtlTableHtml += `<tr class="tr"><td colspan="3"><strong>Total facturé HT</strong></td><td class="a"><strong>${fmtPlain(totalFacture)}</strong></td><td></td><td></td><td></td></tr></tbody></table>`;
  html += collapsible('Factures RTL 2026 (HT — TVA 0% Bairok LLC / EAU)', rtlTableHtml);

  // Virements Maroc
  let virementsMarocHtml = `<table>
    <thead><tr><th>#</th><th data-sort="date">Date</th><th>Bénéficiaire</th><th data-sort="num" style="text-align:right">DH</th><th data-sort="num" style="text-align:right">= EUR (÷${d.tauxMaroc})</th></tr></thead><tbody>`;
  d.virementsMaroc.forEach((v, i) => {
    virementsMarocHtml += `<tr><td>${i+1}</td><td>${v.date}</td><td>${nick(v.beneficiaire)}</td><td class="a">${fmtPlain(v.dh)}</td><td class="a">${fmtPlain(v.dh / d.tauxMaroc)}</td></tr>`;
  });
  virementsMarocHtml += `<tr class="tr"><td></td><td colspan="2"><strong>Total 2026</strong></td><td class="a"><strong>${fmtPlain(totalMAD)}</strong></td><td class="a"><strong>${fmtPlain(virementsProEUR)}</strong></td></tr></tbody></table>`;

  virementsMarocHtml += `<div class="n"><strong>Règle :</strong> 1 000€ pro = ${(PERSO_FACTOR * 1000).toLocaleString('fr-FR')}€ perso = ${(d.tauxMaroc * 1000).toLocaleString('fr-FR')} MAD. Total : ${fmtPlain(totalMAD)} MAD = ${fmtPlain(virementsProEUR)}€ pro = ${fmtPlain(Math.round(virementsProEUR * PERSO_FACTOR))}€ perso.</div>`;

  html += collapsible('Virements Maroc 2026', virementsMarocHtml);

  // Divers 2026 (cash direct) — avec Pro vs Perso
  if (d.divers && d.divers.length) {
    const totalDiversPerso = diversItems.reduce((s, x) => s + x.perso, 0);
    let diversTable = `<table>
      <thead><tr><th>Opération</th><th data-sort="num" style="text-align:right">Pro (€)</th><th data-sort="num" style="text-align:right">Perso (€)</th><th>Règle</th></tr></thead><tbody>`;
    diversItems.forEach(x => {
      const color = x.pro > 0 ? 'var(--green)' : 'var(--red)';
      diversTable += `<tr><td>${nickText(x.label)}</td><td class="a" style="color:${color}">${fmtSigned(Math.round(x.pro), '')}</td><td class="a" style="color:${color}">${fmtSigned(Math.round(x.perso), '')}</td><td style="font-size:.72rem;color:var(--muted)">Pro = Perso ÷ ${PERSO_FACTOR}</td></tr>`;
      // Breakdown sub-rows (if present)
      if (x.breakdown && x.breakdown.length) {
        x.breakdown.forEach(b => {
          const bColor = b.montant >= 0 ? 'var(--muted)' : 'var(--green)';
          const sign = b.montant >= 0 ? '+' : '−';
          diversTable += `<tr style="background:rgba(99,102,241,.04)"><td style="padding-left:28px;font-size:.72rem;color:var(--muted)">${sign} ${nickText(b.label)}</td><td class="a" style="color:var(--muted);font-size:.72rem">—</td><td class="a" style="color:${bColor};font-size:.72rem">${sign}${fmtPlain(Math.abs(b.montant))}</td><td style="font-size:.68rem;color:var(--muted)">composant</td></tr>`;
        });
      }
    });
    diversTable += `<tr class="tr"><td><strong>Total</strong></td><td class="a"><strong>${fmtSigned(Math.round(diversPro), '')}</strong></td><td class="a" style="color:var(--accent)"><strong>${fmtSigned(Math.round(totalDiversPerso), '')}</strong></td><td style="font-size:.72rem;color:var(--muted)">Pro = Perso ÷ ${PERSO_FACTOR}</td></tr>`;
    diversTable += `</tbody></table>`;
    diversTable += `<div class="n" style="margin-top:6px"><strong>Règle :</strong> Les montants sont en <strong>Perso</strong> (cash réel donné). Pro = Perso ÷ ${PERSO_FACTOR}. Donc 950€ perso = 1 000€ pro = ${(d.tauxMaroc * 1000).toLocaleString('fr-FR')} MAD.</div>`;
    html += collapsible('Divers — Cash direct 2026 (Pro vs Perso)', diversTable);
  }

  // Facturation AZCS → Majalis (Benoit)
  if (b26 && b26.councils) {
    const tjm = b26.tjm || 625;
    const tva = b26.tvaRate || 0.21;
    const tvaPctAz = Math.round(tva * 100);
    const totalHTBadre = sum(b26.councils, 'htEUR');
    const totalTTCBadre = Math.round(totalHTBadre * (1 + tva));
    const paidBadre = b26.councils.filter(c => c.statut === 'ok');
    const totalHTpaid = sum(paidBadre, 'htEUR');
    let azcsHtml = `<div class="n" style="margin-bottom:8px">TJM ${tjm}€ HT + TVA ${tvaPctAz}%. ${paidBadre.length}/${b26.councils.length} factures payées (${fmtPlain(totalHTpaid)}€ HT reçus).</div>`;
    azcsHtml += `<table><thead><tr><th>Ref</th><th data-sort="date">Période</th><th data-sort="num">Jours</th><th data-sort="num" style="text-align:right">HT (€)</th><th data-sort="num" style="text-align:right">TTC (€)</th><th data-sort="date">Date facture</th><th data-sort="date">Échéance</th><th>Statut</th></tr></thead><tbody>`;
    b26.councils.forEach(c => {
      const ttcVal = Math.round(c.htEUR * (1 + tva) * 100) / 100;
      const bl = c.backlog ? ' <span style="color:var(--yellow)">(backlog)</span>' : '';
      azcsHtml += `<tr><td style="font-size:.72rem">${c.ref || '—'}${bl}</td><td>${c.mois}</td><td>${c.jours || '—'}</td><td class="a">${fmtPlain(c.htEUR)}</td><td class="a" style="color:var(--muted)">${fmtPlain(Math.round(ttcVal))}</td><td>${c.dateFacture || '—'}</td><td>${c.dateDue || '—'}</td><td>${badge(c.statut, c.statutText)}</td></tr>`;
    });
    azcsHtml += `<tr class="tr"><td colspan="3"><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalHTBadre)}</strong></td><td class="a" style="color:var(--muted)"><strong>${fmtPlain(totalTTCBadre)}</strong></td><td></td><td></td><td></td></tr></tbody></table>`;
    html += collapsible('Facturation AZCS → Majalis (Benoit) — ' + fmtPlain(totalHTBadre) + '€ HT (' + fmtPlain(totalTTCBadre) + '€ TTC)', azcsHtml);
  }

  // Insights 2026
  if (d.insights) {
    let insightsHtml2026 = '';
    d.insights.forEach(ins => {
      const cls = ins.type === 'pass' ? 'pass' : ins.type === 'warn' ? 'warn' : ins.type === 'fail' ? 'fail' : '';
      insightsHtml2026 += `<div class="insight ${cls}"><div class="t">${ins.titre}</div><div class="d">${ins.desc}</div></div>`;
    });
    html += collapsible('Insights', insightsHtml2026);
  }

  return html;
}
