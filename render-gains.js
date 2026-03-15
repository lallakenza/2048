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
    const tMADMkt3 = l3txs.reduce((s, t) => s + t.usdt * (d.leg3.tauxMarche[t.date] || 0), 0);
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

  // ===== 2. COMMISSION YCARRÉ (Oum Yakout) — 2025 only =====
  const ycarreTotal = DATA._ycarreTotal || sum(az25.ycarre, 'montant');
  const ycarreCommRate = DATA._ycarreCommission || 0;
  const commYcarréEUR = Math.round(ycarreTotal * ycarreCommRate);
  const commYcarréMAD = Math.round(commYcarréEUR * mkt25);

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
  const totalNetBenoit25 = b25.councils.reduce((s, m) => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    return s + dh - Math.round(dh * b25.commissionRate);
  }, 0);
  const totalNetBenoit26 = b26.councils.filter(m => m.statut === 'ok').reduce((s, m) => {
    const dh = Math.round(m.htEUR * b26.tauxApplique);
    return s + dh - Math.round(dh * b26.commissionRate);
  }, 0);
  // Year-specific P2P savings
  const p2pSavingBenoit25 = totalNetBenoit25 * (1 - mkt25 / eff25);
  const p2pSavingBenoit26 = totalNetBenoit26 * (1 - mkt26 / eff26);
  const p2pSavingBenoit = p2pSavingBenoit25 + p2pSavingBenoit26;

  // ===== YEAR TOTALS =====
  const gains2025 = gainMAD_az25 + commYcarréMAD + commBenoit25 + fxBenoit25 + Math.round(p2pSavingBenoit25);
  const gains2026 = gainMAD_az26 + commBenoit26 + fxBenoit26 + Math.round(p2pSavingBenoit26);
  const grandTotal = gains2025 + gains2026;

  // ===== YEAR FILTER =====
  const gy = window.gainsYear || 0;
  const show25 = !gy || gy === 2025;
  const show26 = !gy || gy === 2026;
  const filteredTotal = gy === 2025 ? gains2025 : gy === 2026 ? gains2026 : grandTotal;
  const periodLabel = gy ? String(gy) : '2025 / 2026';

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

  // ===== TABLE RÉCAPITULATIVE =====
  if (!gy) {
    // Full 2-year table
    html += `<div class="s"><div class="st">Récapitulatif des gains par source et année</div><table>
      <thead><tr><th>Source</th><th>Détail</th><th style="text-align:right">2025 (DH)</th><th style="text-align:right">2026 (DH)</th><th style="text-align:right">Total (DH)</th></tr></thead><tbody>`;
    html += `<tr><td><strong>Virements Augustin</strong></td><td>${fmtPlain(totalDH25 + totalDH26)} DH envoyés</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainMAD_az25), '')}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainMAD_az26), '')}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(totalGainAz), '')}</td></tr>`;
    html += `<tr><td><strong>Commission Ycarré 8%</strong></td><td>${fmtPlain(ycarreTotal)} € × 8%</td><td class="a" style="color:var(--green)">${fmtSigned(commYcarréMAD, '')}</td><td class="a">—</td><td class="a" style="color:var(--green)">${fmtSigned(commYcarréMAD, '')}</td></tr>`;
    html += `<tr><td><strong>Commission Benoit 10%</strong></td><td>Sur factures councils</td><td class="a" style="color:var(--green)">${fmtSigned(commBenoit25, '')}</td><td class="a" style="color:var(--green)">${fmtSigned(commBenoit26, '')}</td><td class="a" style="color:var(--green)">${fmtSigned(totalComm, '')}</td></tr>`;
    html += `<tr><td><strong>Écart taux Benoit</strong></td><td>Appliqué &lt; marché</td><td class="a" style="color:var(--green)">${fmtSigned(fxBenoit25, '')}</td><td class="a" style="color:var(--green)">${fmtSigned(fxBenoit26, '')}</td><td class="a" style="color:var(--green)">${fmtSigned(totalFxBenoit, '')}</td></tr>`;
    html += `<tr><td><strong>Spread P2P Benoit</strong></td><td>Binance vs banque</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(p2pSavingBenoit25), '')}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(p2pSavingBenoit26), '')}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(p2pSavingBenoit), '')}</td></tr>`;
    html += `<tr class="tr"><td><strong>SOUS-TOTAL 2025</strong></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(Math.round(gains2025), ' DH')}</strong></td><td></td><td></td></tr>`;
    html += `<tr class="tr"><td><strong>SOUS-TOTAL 2026</strong></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(Math.round(gains2026), ' DH')}</strong></td><td></td></tr>`;
    html += `<tr class="tr" style="background:rgba(76,175,80,.08)"><td><strong>TOTAL GAINS</strong></td><td></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(Math.round(grandTotal), ' DH')}</strong></td></tr>`;
    html += `</tbody></table></div>`;
  } else {
    // Single year table
    html += `<div class="s"><div class="st">Récapitulatif des gains — ${gy}</div><table>
      <thead><tr><th>Source</th><th>Détail</th><th style="text-align:right">Montant (DH)</th></tr></thead><tbody>`;
    html += `<tr><td><strong>Virements Augustin</strong></td><td>${fmtPlain(gy===2025 ? totalDH25 : totalDH26)} DH envoyés</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gy===2025 ? gainMAD_az25 : gainMAD_az26), '')}</td></tr>`;
    if (gy === 2025) html += `<tr><td><strong>Commission Ycarré 8%</strong></td><td>${fmtPlain(ycarreTotal)} € × 8%</td><td class="a" style="color:var(--green)">${fmtSigned(commYcarréMAD, '')}</td></tr>`;
    html += `<tr><td><strong>Commission Benoit 10%</strong></td><td>Sur factures councils</td><td class="a" style="color:var(--green)">${fmtSigned(gy===2025 ? commBenoit25 : commBenoit26, '')}</td></tr>`;
    html += `<tr><td><strong>Écart taux Benoit</strong></td><td>Appliqué &lt; marché</td><td class="a" style="color:var(--green)">${fmtSigned(gy===2025 ? fxBenoit25 : fxBenoit26, '')}</td></tr>`;
    html += `<tr><td><strong>Spread P2P Benoit</strong></td><td>Binance vs banque</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gy===2025 ? p2pSavingBenoit25 : p2pSavingBenoit26), '')}</td></tr>`;
    html += `<tr class="tr" style="background:rgba(76,175,80,.08)"><td><strong>TOTAL ${gy}</strong></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(Math.round(filteredTotal), ' DH')}</strong></td></tr>`;
    html += `</tbody></table></div>`;
  }

  // ===== BREAKDOWN AUGUSTIN =====
  html += `<div class="s"><div class="st">Détail — Virements Augustin (Maroc)</div>`;
  if (show25) html += `<div class="n ok"><strong>2025 :</strong> taux Augustin = <strong>${tauxAz25}</strong>, taux effectif P2P = <strong>${eff25.toFixed(3).replace('.',',')}</strong> → gain de <strong>${(eff25 - tauxAz25).toFixed(3).replace('.',',')}</strong> MAD/EUR.</div>`;
  if (show26) html += `<div class="n ok"><strong>2026 :</strong> taux Augustin = <strong>${tauxAz26}</strong>, taux effectif P2P = <strong>${eff26.toFixed(3).replace('.',',')}</strong> → gain de <strong>${(eff26 - tauxAz26).toFixed(3).replace('.',',')}</strong> MAD/EUR.</div>`;

  html += `<table><thead><tr><th>Période</th><th style="text-align:right">Taux eff. P2P</th><th style="text-align:right">DH envoyés</th><th style="text-align:right">EUR crédités</th><th style="text-align:right">Coût réel EUR</th><th style="text-align:right">Gain EUR</th><th style="text-align:right">Gain MAD</th></tr></thead><tbody>`;
  if (show25) html += `<tr><td>2025 (Fév-Déc)</td><td class="a">${eff25.toFixed(3).replace('.',',')}</td><td class="a">${fmtPlain(totalDH25)}</td><td class="a">${fmtPlain(eurCredite25)}</td><td class="a">${fmtPlain(Math.round(eurCoutP2P25))}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainEUR_az25), '')}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainMAD_az25), '')}</td></tr>`;
  if (show26) html += `<tr><td>2026 (Jan-Fév)</td><td class="a">${eff26.toFixed(3).replace('.',',')}</td><td class="a">${fmtPlain(totalDH26)}</td><td class="a">${fmtPlain(eurCredite26)}</td><td class="a">${fmtPlain(Math.round(eurCoutP2P26))}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainEUR_az26), '')}</td><td class="a" style="color:var(--green)">${fmtSigned(Math.round(gainMAD_az26), '')}</td></tr>`;
  if (!gy) html += `<tr class="tr"><td><strong>Total</strong></td><td></td><td class="a"><strong>${fmtPlain(totalDH25 + totalDH26)}</strong></td><td class="a"><strong>${fmtPlain(eurCredite25 + eurCredite26)}</strong></td><td class="a"><strong>${fmtPlain(Math.round(eurCoutP2P25 + eurCoutP2P26))}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(Math.round(gainEUR_az25 + gainEUR_az26), '')}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(Math.round(gainMAD_az25 + gainMAD_az26), '')}</strong></td></tr>`;
  html += `</tbody></table></div>`;

  // ===== BREAKDOWN BENOIT =====
  html += `<div class="s"><div class="st">Détail — Gains Benoit (Commission + Taux + P2P)</div>`;

  html += `<table><thead><tr><th>Date</th><th style="text-align:right">HT (€)</th><th style="text-align:right">Taux appliqué</th><th style="text-align:right">Taux marché</th><th style="text-align:right">Commission 10% (DH)</th><th style="text-align:right">Gain taux (DH)</th></tr></thead><tbody>`;
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
      const dh = Math.round(m.htEUR * b26.tauxApplique);
      const comm = Math.round(dh * b26.commissionRate);
      const fx = m.tauxMarche ? Math.round(m.htEUR * (m.tauxMarche - b26.tauxApplique)) : 0;
      sumComm += comm; sumFxB += fx;
      html += `<tr><td>${m.mois} 2026</td><td class="a">${fmtPlain(m.htEUR)}</td><td class="a">${fmtRate(b26.tauxApplique)}</td><td class="a">${m.tauxMarche ? fmtRate(m.tauxMarche) : '—'}</td><td class="a" style="color:var(--green)">${fmtPlain(comm)}</td><td class="a" style="color:var(--green)">${m.tauxMarche ? fmtSigned(fx, '') : '—'}</td></tr>`;
    });
    html += `<tr class="tr"><td><strong>S/T 2026</strong></td><td></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtPlain(commBenoit26)}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(fxBenoit26, '')}</strong></td></tr>`;
  }
  if (!gy) html += `<tr class="tr"><td><strong>Total</strong></td><td></td><td></td><td></td><td class="a" style="color:var(--green)"><strong>${fmtPlain(sumComm)}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(sumFxB, '')}</strong></td></tr>`;
  html += `</tbody></table></div>`;

  // ===== INSIGHTS =====
  html += `<div class="s"><div class="st">Insights${gy ? ' — ' + gy : ''}</div>`;

  if (!gy) {
    // Insight 1: Year comparison (Tout only)
    html += `<div class="insight pass"><div class="t">📊 2025 vs 2026 : ${fmtPlain(Math.round(gains2025))} DH vs ${fmtPlain(Math.round(gains2026))} DH</div><div class="d">2025 représente <strong>${(gains2025/grandTotal*100).toFixed(1)}%</strong> des gains (${Math.round(gains2025/11)} DH/mois sur 11 mois). 2026 a généré <strong>${fmtPlain(Math.round(gains2026))} DH</strong> en seulement 2 mois (${Math.round(gains2026/2)} DH/mois).</div></div>`;
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
  if (show25) html += `<div class="insight pass"><div class="t">👩 Ycarré (Oum Yakout) : ${fmtPlain(commYcarréEUR)} € de commission (2025)</div><div class="d">${fmtPlain(ycarreTotal)} € payés en 2025 (6 paiements EBS). Commission 8% = <strong>${fmtPlain(commYcarréEUR)} €</strong> (≈ ${fmtPlain(commYcarréMAD)} DH).</div></div>`;

  // Benoit
  const fBenoit25 = commBenoit25 + fxBenoit25 + Math.round(p2pSavingBenoit25);
  const fBenoit26 = commBenoit26 + fxBenoit26 + Math.round(p2pSavingBenoit26);
  const totalGainsBenoit = totalComm + totalFxBenoit + Math.round(p2pSavingBenoit);
  const benoitDisplay = gy === 2025 ? fBenoit25 : gy === 2026 ? fBenoit26 : totalGainsBenoit;
  html += `<div class="insight pass"><div class="t">🤝 Benoit : ${fmtPlain(benoitDisplay)} DH ${gy ? '(' + gy + ')' : 'cumulés'}</div><div class="d">${gy === 2025 ? `Commission 10% : <strong>${fmtPlain(commBenoit25)} DH</strong> · Écart taux : <strong>${fmtPlain(fxBenoit25)} DH</strong> · P2P : <strong>${fmtPlain(Math.round(p2pSavingBenoit25))} DH</strong>.` : gy === 2026 ? `Commission 10% : <strong>${fmtPlain(commBenoit26)} DH</strong> · Écart taux : <strong>${fmtPlain(fxBenoit26)} DH</strong> · P2P : <strong>${fmtPlain(Math.round(p2pSavingBenoit26))} DH</strong>.` : `Commission 10% : <strong>${fmtPlain(totalComm)} DH</strong> (${fmtPlain(commBenoit25)} + ${fmtPlain(commBenoit26)}) · Écart taux : <strong>${fmtPlain(totalFxBenoit)} DH</strong> · P2P spread : <strong>${fmtPlain(Math.round(p2pSavingBenoit))} DH</strong>.`}</div></div>`;

  // Répartition
  const refTotal = filteredTotal || 1;
  const fAz = gy === 2025 ? gainMAD_az25 : gy === 2026 ? gainMAD_az26 : totalGainAz;
  const fYsq = show25 ? commYcarréMAD : 0;
  const fComm = gy === 2025 ? commBenoit25 : gy === 2026 ? commBenoit26 : totalComm;
  const fFx = gy === 2025 ? fxBenoit25 : gy === 2026 ? fxBenoit26 : totalFxBenoit;
  const fP2P = gy === 2025 ? p2pSavingBenoit25 : gy === 2026 ? p2pSavingBenoit26 : p2pSavingBenoit;
  html += `<div class="insight"><div class="t">📊 Répartition ${gy || 'globale'}</div><div class="d">Augustin : <strong>${(fAz/refTotal*100).toFixed(1)}%</strong>${fYsq ? ` · Ycarré 8% : <strong>${(fYsq/refTotal*100).toFixed(1)}%</strong>` : ''} · Commission Benoit : <strong>${(fComm/refTotal*100).toFixed(1)}%</strong> · Écart taux : <strong>${(fFx/refTotal*100).toFixed(1)}%</strong> · P2P Benoit : <strong>${(fP2P/refTotal*100).toFixed(1)}%</strong></div></div>`;

  // Monthly average
  const months = gy === 2025 ? 11 : gy === 2026 ? 2 : 13;
  const monthlyAvg = filteredTotal / months;
  html += `<div class="insight"><div class="t">📅 Moyenne : ${fmtPlain(Math.round(monthlyAvg))} DH/mois</div><div class="d">Sur ${months} mois d'activité${gy ? ' (' + gy + ')' : ' (Fév 2025 – Fév 2026)'}, soit ~${fmtPlain(Math.round(monthlyAvg / effEURMAD))} €/mois.</div></div>`;

  html += `</div>`;

  return html;
}
