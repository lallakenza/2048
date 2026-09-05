// ============================================================
// RENDER-GAINS.JS — Rendering function for gains summary and breakdown
// ============================================================

// ---- MES GAINS (Binga only) ----
function renderMesGains() {
  if (!window.PRIV) return '<div style="padding:40px;text-align:center;color:var(--muted)"><p style="font-size:1.1rem">🔒 Section réservée</p></div>';

  const d = DATA.fxP2P;
  const peg = d.leg2.tauxMarche; // 3.6725

  // ===== Compute effective & market EUR/MAD from P2P pipeline =====
  // Helper: compute rates for a set of filtered transactions
  function computeRates(l1txs, l2txs, l3txs) {
    const tEUR1 = l1txs.reduce((s, t) => s + t.eur, 0);
    const tAED1 = l1txs.reduce((s, t) => s + t.aed, 0);
    const tAEDMkt1 = l1txs.reduce((s, t) => s + t.eur * t.tauxMarche, 0);
    const tAED2 = l2txs.reduce((s, t) => s + t.aed, 0);
    const tUSDT2 = l2txs.reduce((s, t) => s + t.usdt, 0);
    const tUSDT3 = l3txs.reduce((s, t) => s + t.usdt, 0);
    const tMAD3 = l3txs.reduce((s, t) => s + t.mad, 0);
    // Same rate resolution as render-fxp2p.js: hourly rate on the transaction first.
    const tMADMkt3 = l3txs.reduce((s, t) => s + t.usdt * (t.tauxMarche || d.leg3.tauxMarche[t.date] || 0), 0);
    if (!tEUR1 || !tUSDT2 || !tUSDT3) return null;
    const wIFX = tAED1 / tEUR1;
    const wMkt1 = tAEDMkt1 / tEUR1;
    const wBuy = tAED2 / tUSDT2;
    const wSell = tMAD3 / tUSDT3;
    const wMktSell = tMADMkt3 / tUSDT3;
    return {
      effEURMAD: wIFX * wSell / wBuy,
      mktEURMAD: wMkt1 * wMktSell / peg,
      spread: ((wIFX * wSell / wBuy) / (wMkt1 * wMktSell / peg) - 1) * 100,
      tEUR1, tAED1, tUSDT2, tUSDT3, tMAD3,
    };
  }

  const is2025 = t => t.date.startsWith('2025');
  const is2026 = t => t.date.startsWith('2026');

  // ALL
  const rAll = computeRates(d.leg1.transactions, d.leg2.transactions, d.leg3.transactions);
  const effEURMAD = rAll.effEURMAD;
  const mktEURMAD = rAll.mktEURMAD;

  // 2025 only
  const r2025 = computeRates(
    d.leg1.transactions.filter(is2025),
    d.leg2.transactions.filter(is2025),
    d.leg3.transactions.filter(is2025)
  );

  // 2026 only
  const r2026 = computeRates(
    d.leg1.transactions.filter(is2026),
    d.leg2.transactions.filter(is2026),
    d.leg3.transactions.filter(is2026)
  );

  // ===== 1. VIREMENTS AUGUSTIN — Rate arbitrage + P2P spread =====
  const az25 = DATA.augustin2025;
  const az26 = DATA.augustin2026;
  const tauxAz25 = az25.tauxMaroc; // 10
  const tauxAz26 = az26.tauxMaroc;

  // Use year-specific effective rates (fallback to global if year data incomplete)
  const eff25 = (r2025 && r2025.effEURMAD) ? r2025.effEURMAD : effEURMAD;
  const mkt25 = (r2025 && r2025.mktEURMAD) ? r2025.mktEURMAD : mktEURMAD;
  const eff26 = (r2026 && r2026.effEURMAD) ? r2026.effEURMAD : effEURMAD;
  const mkt26 = (r2026 && r2026.mktEURMAD) ? r2026.mktEURMAD : mktEURMAD;

  // 2025 virements
  const totalDH25 = sum(az25.virementsMaroc, 'totalDH');
  const eurCredite25 = totalDH25 / tauxAz25;
  const eurCoutP2P25 = totalDH25 / eff25;
  const gainEUR_az25 = eurCredite25 - eurCoutP2P25;
  const gainMAD_az25 = gainEUR_az25 * eff25;

  const eurCoutMarche25 = totalDH25 / mkt25;
  const gainRateArb25 = (eurCredite25 - eurCoutMarche25) * mkt25;
  const gainP2PSpread25 = (eurCoutMarche25 - eurCoutP2P25) * eff25;

  // 2026 virements
  const totalDH26 = sum(az26.virementsMaroc, 'dh');
  const eurCredite26 = totalDH26 / tauxAz26;
  const eurCoutP2P26 = totalDH26 / eff26;
  const gainEUR_az26 = eurCredite26 - eurCoutP2P26;
  const gainMAD_az26 = gainEUR_az26 * eff26;

  const eurCoutMarche26 = totalDH26 / mkt26;
  const gainRateArb26 = (eurCredite26 - eurCoutMarche26) * mkt26;
  const gainP2PSpread26 = (eurCoutMarche26 - eurCoutP2P26) * eff26;

  const totalGainAz = gainMAD_az25 + gainMAD_az26;

  // ===== 2. BENOIT DATA =====
  const b25 = DATA.benoit2025;
  const b26 = DATA.benoit2026;

  // ===== 3. COMMISSION YCARRÉ (Oum Yakout) — 2025 only =====
  const ycarreTotal = DATA._ycarreTotal || sum(az25.ycarre, 'montant');
  const ycarreCommRate = DATA._ycarreCommission || 0;
  const ycarrePct = Math.round(ycarreCommRate * 100);
  const benoitPct25 = Math.round((b25.commissionRate || 0) * 100);
  const benoitPct26 = Math.round((b26.commissionRate || 0) * 100);
  const commYcarréEUR = Math.round(ycarreTotal * ycarreCommRate);
  const commYcarréMAD = Math.round(commYcarréEUR * mkt25);

  // ===== 4. COMMISSION BENOIT =====

  const commBenoit25 = b25.councils.reduce((s, m) => s + Math.round(m.htEUR * m.tauxApplique * b25.commissionRate), 0);
  const commBenoit26 = b26.councils.filter(m => m.statut === 'ok').reduce((s, m) => s + Math.round(m.htEUR * m.tauxApplique * b26.commissionRate), 0);
  const totalComm = commBenoit25 + commBenoit26;

  // ===== 5. ÉCART TAUX BENOIT (appliqué vs marché) =====
  const fxBenoit25 = b25.councils.reduce((s, m) => s + Math.round(m.htEUR * (m.tauxMarche - m.tauxApplique)), 0);
  const fxBenoit26 = b26.councils.filter(m => m.statut === 'ok' && m.tauxMarche).reduce((s, m) => s + Math.round(m.htEUR * (m.tauxMarche - m.tauxApplique)), 0);
  const totalFxBenoit = fxBenoit25 + fxBenoit26;

  // ===== 6. P2P SPREAD on Benoit payments =====
  const totalNetBenoit25 = b25.councils.reduce((s, m) => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    return s + dh - Math.round(dh * b25.commissionRate);
  }, 0);
  const totalNetBenoit26 = b26.councils.filter(m => m.statut === 'ok').reduce((s, m) => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    return s + dh - Math.round(dh * b26.commissionRate);
  }, 0);
  // Year-specific P2P savings
  const p2pSavingBenoit25 = totalNetBenoit25 * (1 - mkt25 / eff25);
  const p2pSavingBenoit26 = totalNetBenoit26 * (1 - mkt26 / eff26);
  const p2pSavingBenoit = p2pSavingBenoit25 + p2pSavingBenoit26;

  // ===== 7. BOB (Bob) — gain Amine = commission 10 % + écart taux (2026) =====
  // Le 3 % Augustin (dispatch) n'est PAS un gain Amine → exclu du calcul.
  const bobData = DATA.bob2026;
  const bobRateA = bobData ? (bobData.commissionAmineRate || 0) : 0;
  const bobPctA = Math.round(bobRateA * 100);
  const bobPaid = bobData ? (bobData.councils || []).filter(m => m.statut === 'ok') : [];
  const commBob26 = bobPaid.reduce((s, m) => s + Math.round(m.htEUR * (m.tauxApplique || 0) * bobRateA), 0);
  const fxBob26 = bobPaid.filter(m => m.tauxMarche).reduce((s, m) => s + Math.round(m.htEUR * (m.tauxMarche - (m.tauxApplique || 0))), 0);
  const totalBob = commBob26 + fxBob26;

  // ===== YEAR TOTALS =====
  // ARRONDI UNE SEULE FOIS, À L'AFFICHAGE.
  // Les agrégats arrondissaient `p2pSavingBenoit25/26` AVANT de sommer, alors que
  // d'autres blocs arrondissaient la somme. Les deux chemins divergeaient d'une unité
  // et le total oscillait entre 233 219, 233 220 et 233 221 DH selon l'endroit lu.
  // On garde donc la pleine précision jusqu'au rendu.
  const gains2025 = gainMAD_az25 + commYcarréMAD + commBenoit25 + fxBenoit25 + p2pSavingBenoit25;
  const gains2026 = gainMAD_az26 + commBenoit26 + fxBenoit26 + p2pSavingBenoit26 + commBob26 + fxBob26;
  const grandTotal = gains2025 + gains2026;

  // ===== YEAR FILTER =====
  const gy = window.gainsYear || 0;
  const show25 = !gy || gy === 2025;
  const show26 = !gy || gy === 2026;
  const filteredTotal = gy === 2025 ? gains2025 : gy === 2026 ? gains2026 : grandTotal;
  const periodLabel = gy ? String(gy) : '2025 / 2026';

  // ── ALLOCATION D'ARRONDI UNIQUE POUR TOUTE LA PAGE ───────────────────────
  // Le récapitulatif répartissait les restes sur la colonne entière (Augustin 2025 →
  // 17 858) tandis que le détail les répartissait sur la seule paire Augustin
  // (17 857). Deux allocations légitimes, deux chiffres — donc deux totaux.
  // Il n'y a désormais QU'UNE allocation, calculée ici, et tous les tableaux la lisent.
  const SOURCES = [
    { cle: 'augustin', lib: `<strong>Virements Augustin</strong>`, det: () => `${fmtPlain(totalDH25 + totalDH26)} DH envoyés`, v25: gainMAD_az25, v26: gainMAD_az26 },
    { cle: 'ycarre',   lib: `<strong>Commission Ycarré ${ycarrePct}%</strong>`, det: () => `${fmtPlain(ycarreTotal)} € × ${ycarrePct}%`, v25: commYcarréMAD, v26: null },
    { cle: 'commBen',  lib: `<strong>Commission Benoit ${benoitPct25}%</strong>`, det: () => 'Sur factures councils', v25: commBenoit25, v26: commBenoit26 },
    { cle: 'fxBen',    lib: `<strong>Écart taux Benoit</strong>`, det: () => 'Appliqué &lt; marché', v25: fxBenoit25, v26: fxBenoit26 },
    { cle: 'p2pBen',   lib: `<strong>Spread P2P Benoit</strong>`, det: () => 'Binance vs banque', v25: p2pSavingBenoit25, v26: p2pSavingBenoit26 },
    { cle: 'bob',      lib: `<strong>Bob ${bobPctA}% + taux</strong>`, det: () => 'Bridgevale · part Amine (hors 3% Augustin)', v25: null, v26: totalBob },
  ];
  const A25 = repartirArrondi(SOURCES.map(r => r.v25 || 0));
  const A26 = repartirArrondi(SOURCES.map(r => r.v26 || 0));
  const idx = (cle) => SOURCES.findIndex(r => r.cle === cle);
  const ST25 = A25.reduce((s, v) => s + v, 0);
  const ST26 = A26.reduce((s, v) => s + v, 0);
  const TOTAL_AFFICHE = ST25 + ST26;
  // Valeurs Augustin exposées PARTOUT (récap, détail, insight) — jamais recalculées.
  const AZ25 = A25[idx('augustin')], AZ26 = A26[idx('augustin')], AZTOT = AZ25 + AZ26;

  // ===== BUILD HTML =====
  let html = yearToggle3('Gains', gy);
  html += `<h2 style="font-size:1.05rem;margin-bottom:6px">Mes Gains — Synthèse ${periodLabel}</h2>`;
  html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">Gains générés par l'activité de facturation et le pipeline FX P2P${gy ? ` (${gy})` : ', ventilés par année'}. Tous les montants en MAD.</p>`;

  // Grand total + year cards
  html += `<div class="cards">
    <div class="card"><div class="l">Total gains ${gy || ''} (MAD)</div><div class="v green">${fmtPlain(Math.round(filteredTotal))} DH</div></div>
    ${show25 ? `<div class="card"><div class="l">Gains 2025</div><div class="v green">${fmtPlain(Math.round(gains2025))} DH</div></div>` : ''}
    ${show26 ? `<div class="card"><div class="l">Gains 2026</div><div class="v green">${fmtPlain(Math.round(gains2026))} DH</div></div>` : ''}
    <div class="card"><div class="l">≈ Total en EUR</div><div class="v green">${fmtPlain(Math.round(filteredTotal / effEURMAD))} €</div></div>
  </div>`;

  // Spread cards
  html += `<div class="cards">
    ${!gy ? `<div class="card"><div class="l">Spread global</div><div class="v blue">${rAll.spread.toFixed(2).replace('.',',')}%</div></div>` : ''}
    ${show25 ? `<div class="card"><div class="l">Spread 2025</div><div class="v blue">${r2025 ? r2025.spread.toFixed(2).replace('.',',') + '%' : '—'}</div></div>` : ''}
    ${show26 ? `<div class="card"><div class="l">Spread 2026</div><div class="v blue">${r2026 ? r2026.spread.toFixed(2).replace('.',',') + '%' : '—'}</div></div>` : ''}
    <div class="card"><div class="l">Taux effectif ${gy || 'global'}</div><div class="v yellow">${(gy === 2025 ? eff25 : gy === 2026 ? eff26 : effEURMAD).toFixed(3).replace('.',',')} MAD/€</div></div>
  </div>`;

  // Taux effectif per year
  html += `<div class="cards">
    ${show25 ? `<div class="card"><div class="l">Taux eff. 2025</div><div class="v yellow">${r2025 ? eff25.toFixed(3).replace('.',',') : '—'} MAD/€</div></div>
    <div class="card"><div class="l">Taux marché 2025</div><div class="v">${r2025 ? mkt25.toFixed(3).replace('.',',') : '—'} MAD/€</div></div>` : ''}
    ${show26 ? `<div class="card"><div class="l">Taux eff. 2026</div><div class="v yellow">${r2026 ? eff26.toFixed(3).replace('.',',') : '—'} MAD/€</div></div>
    <div class="card"><div class="l">Taux marché 2026</div><div class="v">${r2026 ? mkt26.toFixed(3).replace('.',',') : '—'} MAD/€</div></div>` : ''}
  </div>`;

  // ===== TABLE RÉCAPITULATIVE (with DH/% toggle) =====
  const showPct = window.gainsShowPct || false;
  const fmtV = (v, base) => showPct ? (base ? (v / base * 100).toFixed(1).replace('.', ',') + '%' : '—') : fmtSigned(Math.round(v), '');
  const fmtVb = (v, base, suffix) => showPct ? (base ? '<strong>' + (v / base * 100).toFixed(1).replace('.', ',') + '%</strong>' : '—') : '<strong>' + fmtSigned(Math.round(v), suffix || '') + '</strong>';
  const toggleBtn = `<span class="year-toggle" style="margin-left:12px;display:inline-flex;vertical-align:middle"><span class="year-btn ${!showPct?'active':''}" onclick="window.gainsShowPct=false;document.getElementById('gains').innerHTML=renderMesGains()">DH</span><span class="year-btn ${showPct?'active':''}" onclick="window.gainsShowPct=true;document.getElementById('gains').innerHTML=renderMesGains()">%</span></span>`;

  if (!gy) {
    const colSuffix = showPct ? '%' : 'DH';
    // ── Tableau 2 ans, arrondi À SOMME CONSERVÉE ─────────────────────────────
    // Chaque colonne est arrondie par la méthode des plus forts restes : les cellules
    // affichées d'une année totalisent EXACTEMENT le sous-total affiché, et le total
    // de chaque ligne est la somme de ses deux cellules. Un lecteur qui additionne la
    // colonne — ou la ligne — retrouve le chiffre annoncé.
    const sources = SOURCES.map(r => ({ ...r, det: r.det() }));
    const a25 = A25, a26 = A26, st25 = ST25, st26 = ST26, totalAffiche = TOTAL_AFFICHE;

    const cell = (val, aff, base) => val === null ? '<td class="a">—</td>'
      : `<td class="a" style="color:var(--green)">${showPct ? (base ? (val / base * 100).toFixed(1).replace('.', ',') + '%' : '—') : fmtSigned(aff, '')}</td>`;

    html += `<div class="s"><div class="st">Récapitulatif des gains par source et année ${toggleBtn}</div><table>
      <thead><tr><th>Source</th><th>Détail</th><th style="text-align:right">2025 (${colSuffix})</th><th style="text-align:right">2026 (${colSuffix})</th><th style="text-align:right">Total (${colSuffix})</th></tr></thead><tbody>`;
    sources.forEach((r, i) => {
      const t = (r.v25 === null ? 0 : a25[i]) + (r.v26 === null ? 0 : a26[i]);
      html += `<tr><td>${r.lib}</td><td>${r.det}</td>${cell(r.v25, a25[i], gains2025)}${cell(r.v26, a26[i], gains2026)}`
            + `<td class="a" style="color:var(--green)">${showPct ? ((r.v25 || 0) + (r.v26 || 0)) / grandTotal * 100 >= 0 ? (((r.v25 || 0) + (r.v26 || 0)) / grandTotal * 100).toFixed(1).replace('.', ',') + '%' : '—' : fmtSigned(t, '')}</td></tr>`;
    });
    html += `<tr class="tr"><td><strong>SOUS-TOTAL 2025</strong></td><td></td><td class="a" style="color:var(--green)"><strong>${showPct ? '100,0%' : fmtSigned(st25, ' DH')}</strong></td><td></td><td></td></tr>`;
    html += `<tr class="tr"><td><strong>SOUS-TOTAL 2026</strong></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${showPct ? '100,0%' : fmtSigned(st26, ' DH')}</strong></td><td></td></tr>`;
    html += `<tr class="tr" style="background:rgba(76,175,80,.08)"><td><strong>TOTAL GAINS</strong></td><td></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${showPct ? '100,0%' : fmtSigned(totalAffiche, ' DH')}</strong></td></tr>`;
    html += `</tbody></table></div>`;
  } else {
    const colSuffix = showPct ? '%' : 'DH';
    const base = filteredTotal;
    // Single year table
    html += `<div class="s"><div class="st">Récapitulatif des gains — ${gy} ${toggleBtn}</div><table>
      <thead><tr><th>Source</th><th>Détail</th><th style="text-align:right">Montant (${colSuffix})</th></tr></thead><tbody>`;
    html += `<tr><td><strong>Virements Augustin</strong></td><td>${fmtPlain(gy===2025 ? totalDH25 : totalDH26)} DH envoyés</td><td class="a" style="color:var(--green)">${fmtV(gy===2025 ? gainMAD_az25 : gainMAD_az26, base)}</td></tr>`;
    if (gy === 2025) html += `<tr><td><strong>Commission Ycarré ${ycarrePct}%</strong></td><td>${fmtPlain(ycarreTotal)} € × ${ycarrePct}%</td><td class="a" style="color:var(--green)">${fmtV(commYcarréMAD, base)}</td></tr>`;
    html += `<tr><td><strong>Commission Benoit ${benoitPct25}%</strong></td><td>Sur factures councils</td><td class="a" style="color:var(--green)">${fmtV(gy===2025 ? commBenoit25 : commBenoit26, base)}</td></tr>`;
    html += `<tr><td><strong>Écart taux Benoit</strong></td><td>Appliqué &lt; marché</td><td class="a" style="color:var(--green)">${fmtV(gy===2025 ? fxBenoit25 : fxBenoit26, base)}</td></tr>`;
    html += `<tr><td><strong>Spread P2P Benoit</strong></td><td>Binance vs banque</td><td class="a" style="color:var(--green)">${fmtV(gy===2025 ? p2pSavingBenoit25 : p2pSavingBenoit26, base)}</td></tr>`;
    if (gy === 2026) html += `<tr><td><strong>Bob ${bobPctA}% + taux</strong></td><td>Bridgevale · part Amine (hors 3% Augustin)</td><td class="a" style="color:var(--green)">${fmtV(totalBob, base)}</td></tr>`;
    html += `<tr class="tr" style="background:rgba(76,175,80,.08)"><td><strong>TOTAL ${gy}</strong></td><td></td><td class="a" style="color:var(--green)">${fmtVb(filteredTotal, base, ' DH')}</td></tr>`;
    html += `</tbody></table></div>`;
  }

  // ===== BREAKDOWN AUGUSTIN =====
  html += `<div class="s"><div class="st">Détail — Virements Augustin (Maroc)</div>`;
  if (show25) html += `<div class="n ok"><strong>2025 :</strong> taux Augustin = <strong>${tauxAz25}</strong>, taux effectif P2P = <strong>${eff25.toFixed(3).replace('.',',')}</strong> → gain de <strong>${(eff25 - tauxAz25).toFixed(3).replace('.',',')}</strong> MAD/EUR.</div>`;
  if (show26) html += `<div class="n ok"><strong>2026 :</strong> taux Augustin = <strong>${tauxAz26}</strong>, taux effectif P2P = <strong>${eff26.toFixed(3).replace('.',',')}</strong> → gain de <strong>${(eff26 - tauxAz26).toFixed(3).replace('.',',')}</strong> MAD/EUR.</div>`;

  // ── Arrondi UNIQUE, partagé avec le récapitulatif ────────────────────────
  // Ce tableau arrondissait la somme (48 638) tandis que le récapitulatif répartissait
  // les restes (48 639) : deux politiques d'arrondi sur la même donnée, donc deux
  // totaux. Les valeurs affichées sont désormais calculées une seule fois, par la même
  // fonction, et le total N'EST PLUS RECALCULÉ : c'est la somme des cellules affichées.
  const azCoutP2P  = repartirArrondi([eurCoutP2P25, eurCoutP2P26]);
  const azGainEUR  = repartirArrondi([gainEUR_az25, gainEUR_az26]);
  const azGainMAD  = [AZ25, AZ26];   // ← allocation unique de la page, pas un recalcul
  const azCredite  = repartirArrondi([eurCredite25, eurCredite26]);
  const azDH       = [totalDH25, totalDH26];

  html += `<table><thead><tr><th>Période</th><th data-sort="num" style="text-align:right">Taux eff. P2P</th><th data-sort="num" style="text-align:right">DH envoyés</th><th data-sort="num" style="text-align:right">EUR crédités</th><th data-sort="num" style="text-align:right">Coût réel EUR</th><th data-sort="num" style="text-align:right">Gain EUR</th><th data-sort="num" style="text-align:right">Gain MAD</th></tr></thead><tbody>`;
  if (show25) html += `<tr><td>2025 (Fév-Déc)</td><td class="a">${eff25.toFixed(3).replace('.',',')}</td><td class="a">${fmtPlain(azDH[0])}</td><td class="a">${fmtPlain(azCredite[0])}</td><td class="a">${fmtPlain(azCoutP2P[0])}</td><td class="a" style="color:var(--green)">${fmtSigned(azGainEUR[0], '')}</td><td class="a" style="color:var(--green)">${fmtSigned(azGainMAD[0], '')}</td></tr>`;
  if (show26) html += `<tr><td>2026 (Jan-Sep)</td><td class="a">${eff26.toFixed(3).replace('.',',')}</td><td class="a">${fmtPlain(azDH[1])}</td><td class="a">${fmtPlain(azCredite[1])}</td><td class="a">${fmtPlain(azCoutP2P[1])}</td><td class="a" style="color:var(--green)">${fmtSigned(azGainEUR[1], '')}</td><td class="a" style="color:var(--green)">${fmtSigned(azGainMAD[1], '')}</td></tr>`;
  if (!gy) html += `<tr class="tr"><td><strong>Total</strong></td><td></td><td class="a"><strong>${fmtPlain(azDH[0] + azDH[1])}</strong></td><td class="a"><strong>${fmtPlain(azCredite[0] + azCredite[1])}</strong></td><td class="a"><strong>${fmtPlain(azCoutP2P[0] + azCoutP2P[1])}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(azGainEUR[0] + azGainEUR[1], '')}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(azGainMAD[0] + azGainMAD[1], '')}</strong></td></tr>`;
  html += `</tbody></table></div>`;

  // ===== BREAKDOWN BENOIT =====
  html += `<div class="s"><div class="st">Détail — Gains Benoit (Commission + Taux + P2P)</div>`;

  html += `<table><thead><tr><th data-sort="date">Date</th><th data-sort="num" style="text-align:right">HT (€)</th><th data-sort="num" style="text-align:right">Taux appliqué</th><th data-sort="num" style="text-align:right">Taux marché</th><th data-sort="num" style="text-align:right">Commission ${benoitPct25}% (DH)</th><th data-sort="num" style="text-align:right">Gain taux (DH)</th></tr></thead><tbody>`;
  let sumComm = 0, sumFxB = 0;
  if (show25) {
    html += `<tr style="background:rgba(33,150,243,.06)"><td colspan="6"><strong>— 2025 —</strong></td></tr>`;
    b25.councils.forEach(m => {
      const dh = Math.round(m.htEUR * m.tauxApplique);
      const comm = Math.round(dh * b25.commissionRate);
      const fx = Math.round(m.htEUR * (m.tauxMarche - m.tauxApplique));
      sumComm += comm; sumFxB += fx;
      html += `<tr><td>${m.date}</td><td class="a">${fmtPlain(m.htEUR)}</td><td class="a">${fmtRate(m.tauxApplique)}</td><td class="a">${fmtRate(m.tauxMarche)}</td><td class="a" style="color:var(--green)">${fmtPlain(comm)}</td><td class="a" style="color:var(--green)">${fmtSigned(fx, '')}</td></tr>`;
    });
    html += `<tr class="tr"><td><strong>S/T 2025</strong></td><td></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtPlain(commBenoit25)}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(fxBenoit25, '')}</strong></td></tr>`;
  }
  if (show26) {
    html += `<tr style="background:rgba(33,150,243,.06)"><td colspan="6"><strong>— 2026 —</strong></td></tr>`;
    b26.councils.filter(m => m.statut === 'ok').forEach(m => {
      const dh = Math.round(m.htEUR * m.tauxApplique);
      const comm = Math.round(dh * b26.commissionRate);
      const fx = m.tauxMarche ? Math.round(m.htEUR * (m.tauxMarche - m.tauxApplique)) : 0;
      sumComm += comm; sumFxB += fx;
      html += `<tr><td>${m.mois} 2026</td><td class="a">${fmtPlain(m.htEUR)}</td><td class="a">${fmtRate(m.tauxApplique)}</td><td class="a">${m.tauxMarche ? fmtRate(m.tauxMarche) : '—'}</td><td class="a" style="color:var(--green)">${fmtPlain(comm)}</td><td class="a" style="color:var(--green)">${m.tauxMarche ? fmtSigned(fx, '') : '—'}</td></tr>`;
    });
    html += `<tr class="tr"><td><strong>S/T 2026</strong></td><td></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtPlain(commBenoit26)}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(fxBenoit26, '')}</strong></td></tr>`;
  }
  if (!gy) html += `<tr class="tr"><td><strong>Total</strong></td><td></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtPlain(sumComm)}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(sumFxB, '')}</strong></td></tr>`;
  html += `</tbody></table></div>`;

  // ===== BREAKDOWN BOB (guarded — only once Bob a des factures payées) =====
  if (bobPaid.length > 0 && (show26 || !gy)) {
    html += `<div class="s"><div class="st">Détail — Gains Bob · part Amine ${bobPctA}% + écart taux</div>`;
    html += `<table><thead><tr><th data-sort="date">Mois</th><th data-sort="num" style="text-align:right">HT (€)</th><th data-sort="num" style="text-align:right">Taux appliqué</th><th data-sort="num" style="text-align:right">Taux marché</th><th data-sort="num" style="text-align:right">Commission ${bobPctA}% (DH)</th><th data-sort="num" style="text-align:right">Gain taux (DH)</th></tr></thead><tbody>`;
    bobPaid.forEach(m => {
      const dh = Math.round(m.htEUR * (m.tauxApplique || 0));
      const comm = Math.round(dh * bobRateA);
      const fx = m.tauxMarche ? Math.round(m.htEUR * (m.tauxMarche - (m.tauxApplique || 0))) : 0;
      html += `<tr><td>${m.mois || m.date || ''}</td><td class="a">${fmtPlain(m.htEUR)}</td><td class="a">${fmtRate(m.tauxApplique)}</td><td class="a">${m.tauxMarche ? fmtRate(m.tauxMarche) : '—'}</td><td class="a" style="color:var(--green)">${fmtPlain(comm)}</td><td class="a" style="color:var(--green)">${m.tauxMarche ? fmtSigned(fx, '') : '—'}</td></tr>`;
    });
    html += `<tr class="tr"><td><strong>Total 2026</strong></td><td></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtPlain(commBob26)}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(fxBob26, '')}</strong></td></tr>`;
    html += `</tbody></table>`;
    html += `<div class="n">Le 3 % Augustin (dispatch) n'est pas un gain Amine — exclu de ce tableau.</div></div>`;
  }

  // Activity span in months — derived so it auto-updates instead of stale literals.
  // 2025 is closed (Fév–Déc = 11) ; current-year & 'all' grow with the calendar.
  const _now = new Date();
  const monthsCur = _now.getFullYear() > 2026 ? 12 : (_now.getFullYear() === 2026 ? _now.getMonth() + 1 : 0);
  const months2025 = 11;
  const monthsAll = months2025 + monthsCur;

  // ===== INSIGHTS =====
  html += `<div class="s"><div class="st">Insights${gy ? ' — ' + gy : ''}</div>`;

  if (!gy) {
    // Insight 1: Year comparison (Tout only)
    html += `<div class="insight pass"><div class="t">📊 2025 vs 2026 : ${fmtPlain(Math.round(gains2025))} DH vs ${fmtPlain(Math.round(gains2026))} DH</div><div class="d">2025 représente <strong>${(gains2025/grandTotal*100).toFixed(1)}%</strong> des gains (${Math.round(gains2025/months2025)} DH/mois sur ${months2025} mois). 2026 a généré <strong>${fmtPlain(Math.round(gains2026))} DH</strong> en ${monthsCur} mois (${Math.round(gains2026/Math.max(monthsCur,1))} DH/mois).</div></div>`;
    // Insight 2: Spread comparison
    html += `<div class="insight pass"><div class="t">📈 Spread P2P : ${r2025 ? r2025.spread.toFixed(2).replace('.',',') + '% (2025)' : '—'} vs ${r2026 ? r2026.spread.toFixed(2).replace('.',',') + '% (2026)' : '—'}</div><div class="d">Taux effectif 2025 : <strong>${eff25.toFixed(3).replace('.',',')}</strong> MAD/€ (marché ${mkt25.toFixed(3).replace('.',',')}). Taux effectif 2026 : <strong>${eff26.toFixed(3).replace('.',',')}</strong> MAD/€ (marché ${mkt26.toFixed(3).replace('.',',')}).</div></div>`;
  }

  // Gain per EUR (adapted for year filter)
  const gainPerEUR25 = eff25 - tauxAz25;
  const gainPerEUR26 = eff26 - tauxAz26;
  if (gy === 2025) {
    html += `<div class="insight pass"><div class="t">💰 Gain par EUR crédité 2025 : ${gainPerEUR25.toFixed(2).replace('.',',')} MAD/€</div><div class="d">Chaque EUR crédité chez Augustin rapporte <strong>${fmtPlain(Math.round(gainPerEUR25 * 1000))} DH/1000€</strong>. Taux effectif P2P : ${eff25.toFixed(3).replace('.',',')} vs taux Augustin : ${tauxAz25}.</div></div>`;
  } else if (gy === 2026) {
    html += `<div class="insight pass"><div class="t">💰 Gain par EUR crédité 2026 : ${gainPerEUR26.toFixed(2).replace('.',',')} MAD/€</div><div class="d">Chaque EUR crédité chez Augustin rapporte <strong>${fmtPlain(Math.round(gainPerEUR26 * 1000))} DH/1000€</strong>. Taux effectif P2P : ${eff26.toFixed(3).replace('.',',')} vs taux Augustin : ${tauxAz26}.</div></div>`;
  } else {
    html += `<div class="insight pass"><div class="t">💰 Gain par EUR crédité : ${gainPerEUR25.toFixed(2).replace('.',',')} (2025) vs ${gainPerEUR26.toFixed(2).replace('.',',')} (2026)</div><div class="d">En 2025, chaque EUR crédité chez Augustin rapporte <strong>${fmtPlain(Math.round(gainPerEUR25 * 1000))} DH/1000€</strong>. En 2026 : <strong>${fmtPlain(Math.round(gainPerEUR26 * 1000))} DH/1000€</strong>.</div></div>`;
  }

  // Ycarré (2025 only)
  if (show25) html += `<div class="insight pass"><div class="t">👩 Ycarré (Oum Yakout) : ${fmtPlain(commYcarréEUR)} € de commission (2025)</div><div class="d">${fmtPlain(ycarreTotal)} € payés en 2025 (6 paiements EBS). Commission ${ycarrePct}% = <strong>${fmtPlain(commYcarréEUR)} €</strong> (≈ ${fmtPlain(commYcarréMAD)} DH).</div></div>`;

  // Benoit
  const fBenoit25 = commBenoit25 + fxBenoit25 + p2pSavingBenoit25;
  const fBenoit26 = commBenoit26 + fxBenoit26 + p2pSavingBenoit26;
  const totalGainsBenoit = totalComm + totalFxBenoit + p2pSavingBenoit;
  const benoitDisplay = gy === 2025 ? fBenoit25 : gy === 2026 ? fBenoit26 : totalGainsBenoit;
  html += `<div class="insight pass"><div class="t">🤝 Benoit : ${fmtPlain(benoitDisplay)} DH ${gy ? '(' + gy + ')' : 'cumulés'}</div><div class="d">${gy === 2025 ? `Commission ${benoitPct25}% : <strong>${fmtPlain(commBenoit25)} DH</strong> · Écart taux : <strong>${fmtPlain(fxBenoit25)} DH</strong> · P2P : <strong>${fmtPlain(Math.round(p2pSavingBenoit25))} DH</strong>.` : gy === 2026 ? `Commission ${benoitPct25}% : <strong>${fmtPlain(commBenoit26)} DH</strong> · Écart taux : <strong>${fmtPlain(fxBenoit26)} DH</strong> · P2P : <strong>${fmtPlain(Math.round(p2pSavingBenoit26))} DH</strong>.` : `Commission ${benoitPct25}% : <strong>${fmtPlain(totalComm)} DH</strong> (${fmtPlain(commBenoit25)} + ${fmtPlain(commBenoit26)}) · Écart taux : <strong>${fmtPlain(totalFxBenoit)} DH</strong> · P2P spread : <strong>${fmtPlain(Math.round(p2pSavingBenoit))} DH</strong>.`}</div></div>`;

  // Répartition
  const refTotal = filteredTotal || 1;
  const fAz = gy === 2025 ? gainMAD_az25 : gy === 2026 ? gainMAD_az26 : totalGainAz;
  const fYsq = show25 ? commYcarréMAD : 0;
  const fComm = gy === 2025 ? commBenoit25 : gy === 2026 ? commBenoit26 : totalComm;
  const fFx = gy === 2025 ? fxBenoit25 : gy === 2026 ? fxBenoit26 : totalFxBenoit;
  const fP2P = gy === 2025 ? p2pSavingBenoit25 : gy === 2026 ? p2pSavingBenoit26 : p2pSavingBenoit;
  const fBob = gy === 2025 ? 0 : totalBob; // Bob = 2026 only
  html += `<div class="insight"><div class="t">📊 Répartition ${gy || 'globale'}</div><div class="d">Augustin : <strong>${(fAz/refTotal*100).toFixed(1)}%</strong>${fYsq ? ` · Ycarré 8% : <strong>${(fYsq/refTotal*100).toFixed(1)}%</strong>` : ''} · Commission Benoit : <strong>${(fComm/refTotal*100).toFixed(1)}%</strong> · Écart taux : <strong>${(fFx/refTotal*100).toFixed(1)}%</strong> · P2P Benoit : <strong>${(fP2P/refTotal*100).toFixed(1)}%</strong>${fBob ? ` · Bob : <strong>${(fBob/refTotal*100).toFixed(1)}%</strong>` : ''}</div></div>`;

  // Monthly average
  const months = gy === 2025 ? months2025 : gy === 2026 ? Math.max(monthsCur, 1) : monthsAll;
  const monthlyAvg = filteredTotal / months;
  const _spanLabel = gy ? ' (' + gy + ')' : ` (Fév 2025 – ${_now.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })})`;
  html += `<div class="insight"><div class="t">📅 Moyenne : ${fmtPlain(Math.round(monthlyAvg))} DH/mois</div><div class="d">Sur ${months} mois d'activité${_spanLabel}, soit ~${fmtPlain(Math.round(monthlyAvg / effEURMAD))} €/mois.</div></div>`;

  html += `</div>`;

  return html;
}
