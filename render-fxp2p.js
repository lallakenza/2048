// ============================================================
// RENDER-FXP2P.JS — Rendering function for FX P2P pipeline analysis
// ============================================================

function renderFXP2P() {
  if (!window.PRIV) return '<div style="padding:40px;text-align:center;color:var(--muted)"><p style="font-size:1.1rem">🔒 Section réservée</p></div>';
  const d = DATA.fxP2P;
  const fy = window.fxYear || 0;
  const yearFilter = fy ? (t => t.date.startsWith(String(fy))) : null;

  // ===== LEG 1: EUR → AED (IFX spread = perte) =====
  const leg1raw = d.leg1.transactions;
  const leg1 = (yearFilter ? leg1raw.filter(yearFilter) : leg1raw).map(t => {
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
  const leg2raw = d.leg2.transactions;
  const leg2 = (yearFilter ? leg2raw.filter(yearFilter) : leg2raw).map(t => {
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
  const leg3raw = d.leg3.transactions;
  const leg3 = (yearFilter ? leg3raw.filter(yearFilter) : leg3raw).map(t => {
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
  const yearLabel = fy ? ` — ${fy}` : '';
  let html = yearToggle3('Fx', fy);
  html += `<h2 style="font-size:1.05rem;margin-bottom:6px">${d.title}${yearLabel}</h2>`;
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

  // ===== COMPUTE PERIODS =====
  const all = computePeriodStats(leg1, leg2, leg3);
  let r3m = null;
  if (!fy) {
    const cutoff3m = '2025-12-01';
    r3m = computePeriodStats(leg1.filter(t => t.date >= cutoff3m), leg2.filter(t => t.date >= cutoff3m), leg3.filter(t => t.date >= cutoff3m));
  }

  // ===== CARDS =====
  const periodLabel = fy ? String(fy) : 'total';
  html += `<div class="cards">
    <div class="card"><div class="l">Spread EUR→MAD (${periodLabel})</div><div class="v ${all.spreadEURMAD >= 0 ? 'green' : 'red'}">${all.spreadEURMAD >= 0 ? '+' : ''}${all.spreadEURMADpct.toFixed(2)}%</div></div>
    ${r3m ? `<div class="card"><div class="l">Spread EUR→MAD (3 mois)</div><div class="v ${r3m.spreadEURMAD >= 0 ? 'green' : 'red'}">${r3m.spreadEURMAD >= 0 ? '+' : ''}${r3m.spreadEURMADpct.toFixed(2)}%</div></div>` : ''}
    <div class="card"><div class="l">Taux effectif (${periodLabel})</div><div class="v blue">${all.effEURMAD.toFixed(2)}</div></div>
    ${r3m ? `<div class="card"><div class="l">Taux effectif (3 mois)</div><div class="v blue">${r3m.effEURMAD.toFixed(2)}</div></div>` : ''}
    <div class="card"><div class="l">Impact sur 10k€ (${periodLabel})</div><div class="v ${all.impEURMAD >= 0 ? 'green' : 'red'}">${all.impEURMAD >= 0 ? '+' : ''}${Math.round(all.impEURMAD)}€</div></div>
    ${r3m ? `<div class="card"><div class="l">Impact sur 10k€ (3 mois)</div><div class="v ${r3m.impEURMAD >= 0 ? 'green' : 'red'}">${r3m.impEURMAD >= 0 ? '+' : ''}${Math.round(r3m.impEURMAD)}€</div></div>` : ''}
    <div class="card"><div class="l">Transactions</div><div class="v">${leg1.length} / ${leg2.length} / ${leg3.length}</div></div>
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

  // ===== RENDER TABLES =====
  const synthLabel = fy ? `Synthèse — ${fy}` : 'Synthèse — Période totale (depuis mars 2025)';
  html += renderSynthTable(synthLabel, all, 'total');
  if (r3m) {
    const l1_3m = leg1.filter(t => t.date >= '2025-12-01');
    const l2_3m = leg2.filter(t => t.date >= '2025-12-01');
    const l3_3m = leg3.filter(t => t.date >= '2025-12-01');
    html += renderSynthTable(`Synthèse — 3 derniers mois (depuis déc. 2025) — ${l1_3m.length} / ${l2_3m.length} / ${l3_3m.length} tx`, r3m, '3m');
  }

  html += `<div class="n"><strong>Impact (10k€)</strong> = pour chaque leg, combien tu gagnes ou perds en EUR sur une transaction de 10 000€. Les spreads s'additionnent : −89€ (IFX) − 21€ (buy) + 484€ (sell) = net. Le <strong>taux effectif EUR→MAD</strong> = chaîne de taux pondérés : taux IFX × prix vente P2P ÷ prix achat P2P.</div>`;

  // ===== LEG 1 DETAIL =====
  html += `<div class="s"><div class="st">Leg 1 — EUR → AED (conversions IFX) — ${leg1.length} transactions</div><table>
    <thead><tr><th>#</th><th data-sort="date">Date</th><th>Source</th><th data-sort="num" style="text-align:right">EUR</th><th data-sort="num" style="text-align:right">AED reçu</th><th data-sort="num" style="text-align:right">Taux IFX</th><th data-sort="num" style="text-align:right">Taux marché</th><th data-sort="num" style="text-align:right">Spread</th><th data-sort="num" style="text-align:right">Perte AED</th></tr></thead><tbody>`;
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
    <thead><tr><th>#</th><th data-sort="date">Date</th><th data-sort="num" style="text-align:right">AED</th><th data-sort="num" style="text-align:right">USDT</th><th data-sort="num" style="text-align:right">Prix P2P</th><th style="text-align:right">Peg (3,6725)</th><th data-sort="num" style="text-align:right">Spread</th><th data-sort="num" style="text-align:right">Premium AED</th></tr></thead><tbody>`;
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
    <thead><tr><th>#</th><th data-sort="date">Date</th><th data-sort="num" style="text-align:right">USDT</th><th data-sort="num" style="text-align:right">MAD</th><th data-sort="num" style="text-align:right">Prix P2P</th><th data-sort="num" style="text-align:right">USD/MAD marché</th><th data-sort="num" style="text-align:right">Spread</th><th data-sort="num" style="text-align:right">Gain MAD</th></tr></thead><tbody>`;
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

  // ==========================================================
  // QUALITÉ DES DEALS USDT — bon ou mauvais deal ?
  // ==========================================================
  // Per-transaction verdict. For AED→USDT, the peg is fixed,
  // so the verdict depends only on spread vs 3,6725. For
  // USDT→MAD, the verdict depends on the USD/MAD market rate
  // which drifts over time — so we compute two columns:
  //   • "à l'époque"  — vs the historical rate of the tx date
  //   • "si refait ajd" — vs a user-editable "today" rate
  //     (default = most recent historical entry, since we have
  //     no live FX feed on this static site).

  // Default today's rate: most recent entry from leg3.tauxMarche
  const todayRateEntries = Object.entries(d.leg3.tauxMarche)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const defaultTodayDate = todayRateEntries[0] ? todayRateEntries[0][0] : '—';
  const defaultTodayRate = todayRateEntries[0] ? todayRateEntries[0][1] : 9.12;

  // Thresholds calibrated on the observed distribution of
  // historical spreads (Leg 2: ~0 to +1.3%, Leg 3: ~2 to +6%).
  function buyVerdict(pct) {
    if (pct <= 0.10) return { label: 'Excellent', cls: 'ok', em: '✅' };
    if (pct <= 0.35) return { label: 'Bon',       cls: 'ok', em: '👍' };
    if (pct <= 0.70) return { label: 'Moyen',     cls: 'w',  em: '⚠️' };
    return                  { label: 'Mauvais',   cls: 'e',  em: '❌' };
  }
  function sellVerdict(pct) {
    if (pct >= 5.0) return { label: 'Excellent', cls: 'ok', em: '✅' };
    if (pct >= 3.0) return { label: 'Bon',       cls: 'ok', em: '👍' };
    if (pct >= 1.0) return { label: 'Moyen',     cls: 'w',  em: '⚠️' };
    return                  { label: 'Faible',    cls: 'e',  em: '❌' };
  }

  // ----- Buys quality (static: peg is fixed) --------------
  const leg2sorted = [...leg2].sort((a, b) => (a.date < b.date ? 1 : -1));
  const buyCounts = { Excellent: 0, Bon: 0, Moyen: 0, Mauvais: 0 };
  let buyQualityRows = '';
  leg2sorted.forEach(t => {
    const v = buyVerdict(t.spreadPct);
    buyCounts[v.label] = (buyCounts[v.label] || 0) + 1;
    buyQualityRows += `<tr>
      <td>${t.date}</td>
      <td class="a">${fmtPlain(Math.round(t.aed))}</td>
      <td class="a">${t.usdt.toFixed(2).replace('.', ',')}</td>
      <td class="a">${t.prix.toFixed(4).replace('.', ',')}</td>
      <td class="a" style="color:${t.spreadPct > 0.35 ? 'var(--red)' : 'var(--green)'}">${t.spreadPct >= 0 ? '+' : ''}${t.spreadPct.toFixed(2)}%</td>
      <td class="a">${badge(v.cls, v.em + ' ' + v.label)}</td>
    </tr>`;
  });
  const nbBuyGood  = (buyCounts.Excellent || 0) + (buyCounts.Bon || 0);
  const nbBuyTotal = leg2.length;

  // ----- Sells quality (dynamic: depends on today's rate) -
  function buildSellsQuality(todayRate) {
    const leg3sorted = [...leg3].sort((a, b) => (a.date < b.date ? 1 : -1));
    const nowCounts = { Excellent: 0, Bon: 0, Moyen: 0, Faible: 0 };
    let rows = '';
    leg3sorted.forEach(t => {
      const pctThen = t.spreadPct;
      const vThen = sellVerdict(pctThen);
      const pctNow = todayRate > 0 ? ((t.prix - todayRate) / todayRate) * 100 : 0;
      const vNow = sellVerdict(pctNow);
      nowCounts[vNow.label] = (nowCounts[vNow.label] || 0) + 1;
      rows += `<tr>
        <td>${t.date}</td>
        <td class="a">${t.usdt.toFixed(0)}</td>
        <td class="a">${t.prix.toFixed(3).replace('.', ',')}</td>
        <td class="a">${t.mktRate.toFixed(4).replace('.', ',')}</td>
        <td class="a" style="color:${pctThen >= 1 ? 'var(--green)' : 'var(--red)'}">${pctThen >= 0 ? '+' : ''}${pctThen.toFixed(2)}%</td>
        <td class="a">${badge(vThen.cls, vThen.em + ' ' + vThen.label)}</td>
        <td class="a">${todayRate.toFixed(4).replace('.', ',')}</td>
        <td class="a" style="color:${pctNow >= 1 ? 'var(--green)' : 'var(--red)'}">${pctNow >= 0 ? '+' : ''}${pctNow.toFixed(2)}%</td>
        <td class="a">${badge(vNow.cls, vNow.em + ' ' + vNow.label)}</td>
      </tr>`;
    });
    const nbGoodNow = (nowCounts.Excellent || 0) + (nowCounts.Bon || 0);
    return {
      rows: rows,
      cibleVente: (todayRate * 1.03).toFixed(3).replace('.', ','),
      countSummary: `(${nbGoodNow}/${leg3.length} seraient bons à ce taux)`,
    };
  }

  const initialSells = buildSellsQuality(defaultTodayRate);

  // Re-render handler wired to the today-rate input via inline
  // oninput (innerHTML-set scripts don't execute, so we stash
  // the closure-bound helper on window each time renderFXP2P
  // is called — older assignment is simply replaced).
  window._fxpQualityRebuild = function(rawVal) {
    const parsed = parseFloat(String(rawVal || '').replace(',', '.'));
    if (!isFinite(parsed) || parsed <= 0) return;
    const out = buildSellsQuality(parsed);
    const body = document.getElementById('fxp-sells-body');
    const cible = document.getElementById('fxp-cible-vente');
    const summary = document.getElementById('fxp-sells-summary');
    if (body) body.innerHTML = out.rows;
    if (cible) cible.textContent = out.cibleVente;
    if (summary) summary.textContent = out.countSummary;
  };

  html += `<div class="s">
    <div class="st">Qualité des deals USDT — bon ou mauvais deal ?</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;padding:12px 14px;background:var(--blue-bg);border-radius:6px;margin-bottom:14px">
      <div style="min-width:170px">
        <div style="font-size:.7rem;color:var(--muted);margin-bottom:4px">Peg AED/USD (fixe)</div>
        <div style="font-size:1rem;font-weight:700;font-variant-numeric:tabular-nums">${peg.toFixed(4).replace('.', ',')}</div>
        <div style="font-size:.65rem;color:var(--muted);margin-top:4px">dirham peggé au dollar</div>
      </div>
      <div style="min-width:200px">
        <div style="font-size:.7rem;color:var(--muted);margin-bottom:4px">USD/MAD <em>aujourd'hui</em></div>
        <input type="text" id="fxp-today-input" value="${defaultTodayRate.toFixed(4).replace('.', ',')}" oninput="window._fxpQualityRebuild(this.value)" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:.95rem;font-weight:700;font-variant-numeric:tabular-nums;width:110px;outline:none" />
        <div style="font-size:.65rem;color:var(--muted);margin-top:4px">défaut : dernier historique (${defaultTodayDate}) — modifie avec le taux réel du jour</div>
      </div>
      <div style="min-width:170px">
        <div style="font-size:.7rem;color:var(--muted);margin-bottom:4px">Cible achat (AED→USDT)</div>
        <div style="font-size:1rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--green)">≤ ${(peg * 1.0035).toFixed(4).replace('.', ',')}</div>
        <div style="font-size:.65rem;color:var(--muted);margin-top:4px">peg +0,35 % max → deal "bon"</div>
      </div>
      <div style="min-width:170px">
        <div style="font-size:.7rem;color:var(--muted);margin-bottom:4px">Cible vente (USDT→MAD)</div>
        <div style="font-size:1rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--green)">≥ <span id="fxp-cible-vente">${initialSells.cibleVente}</span></div>
        <div style="font-size:.65rem;color:var(--muted);margin-top:4px">marché +3 % min → deal "bon"</div>
      </div>
    </div>

    <div class="st" style="font-size:.85rem;margin-top:16px;margin-bottom:8px">Achats AED → USDT — ${leg2.length} tx <span style="font-weight:400;color:var(--muted)">(${nbBuyGood}/${nbBuyTotal} excellents ou bons)</span></div>
    <table>
      <thead><tr>
        <th data-sort="date">Date</th>
        <th data-sort="num" style="text-align:right">AED</th>
        <th data-sort="num" style="text-align:right">USDT</th>
        <th data-sort="num" style="text-align:right">Prix</th>
        <th data-sort="num" style="text-align:right">Spread vs peg</th>
        <th>Verdict</th>
      </tr></thead>
      <tbody>${buyQualityRows}</tbody>
    </table>

    <div class="st" style="font-size:.85rem;margin-top:16px;margin-bottom:8px">Ventes USDT → MAD — ${leg3.length} tx <span style="font-weight:400;color:var(--muted)" id="fxp-sells-summary">${initialSells.countSummary}</span></div>
    <table>
      <thead><tr>
        <th data-sort="date">Date</th>
        <th data-sort="num" style="text-align:right">USDT</th>
        <th data-sort="num" style="text-align:right">Prix</th>
        <th data-sort="num" style="text-align:right">USD/MAD jour</th>
        <th data-sort="num" style="text-align:right">Spread (jour)</th>
        <th>Verdict (à l'époque)</th>
        <th data-sort="num" style="text-align:right">USD/MAD ajd</th>
        <th data-sort="num" style="text-align:right">Spread (ajd)</th>
        <th>Verdict (si ajd)</th>
      </tr></thead>
      <tbody id="fxp-sells-body">${initialSells.rows}</tbody>
    </table>

    <div class="n">
      <strong>Méthode</strong> — <strong>Achats AED→USDT</strong> : premium vs peg AED/USD 3,6725 (fixe). Seuils : ≤ 0,10 % excellent, ≤ 0,35 % bon, ≤ 0,70 % moyen, &gt; 0,70 % mauvais. <strong>Ventes USDT→MAD</strong> : premium vs USD/MAD marché. Deux colonnes : <em>à l'époque</em> utilise le taux marché du jour de la transaction ; <em>si ajd</em> utilise le taux saisi en haut (par défaut, le dernier historique connu — modifie-le avec le taux Google du jour pour une évaluation live). Seuils vente : ≥ 5 % excellent, ≥ 3 % bon, ≥ 1 % moyen, &lt; 1 % faible.
    </div>
  </div>`;

  // ===== INSIGHTS =====
  html += `<div class="s"><div class="st">Insights — Analyse du circuit P2P</div>`;

  // Insight 1: Effective EUR→MAD spread comparison
  const r3mStr1 = r3m ? ` / ${r3m.spreadEURMAD >= 0 ? '+' : ''}${r3m.spreadEURMADpct.toFixed(2)}% (3 mois)` : '';
  html += `<div class="insight ${all.spreadEURMAD >= 0 ? 'pass' : 'fail'}"><div class="t">${all.spreadEURMAD >= 0 ? '✅' : '❌'} Spread effectif EUR→MAD : ${all.spreadEURMAD >= 0 ? '+' : ''}${all.spreadEURMADpct.toFixed(2)}% (${periodLabel})${r3mStr1}</div><div class="d">
    <strong>${fy ? fy : 'Période totale'} :</strong> taux effectif <strong>${all.effEURMAD.toFixed(2)} MAD/EUR</strong> vs marché ${all.mktEURMAD.toFixed(2)} → sur 10k€ : <strong>${fmtImpact(all.impEURMAD)}</strong>.${r3m ? `<br><strong>3 derniers mois :</strong> taux effectif <strong>${r3m.effEURMAD.toFixed(2)} MAD/EUR</strong> vs marché ${r3m.mktEURMAD.toFixed(2)} → sur 10k€ : <strong>${fmtImpact(r3m.impEURMAD)}</strong>. ${r3m.spreadEURMADpct > all.spreadEURMADpct ? 'Le spread s\'améliore sur les 3 derniers mois.' : 'Le spread se dégrade légèrement sur les 3 derniers mois.'}` : ''}
  </div></div>`;

  // Insight 2: Net gain per period
  const r3mStr2 = r3m ? ` / ${fmtImpact(r3m.impNet)} (3 mois)` : '';
  html += `<div class="insight ${all.impNet >= 0 ? 'pass' : 'warn'}"><div class="t">${all.impNet >= 0 ? '✅' : '⚠️'} Bilan net P2P par 10k€ : ${fmtImpact(all.impNet)} (${periodLabel})${r3mStr2}</div><div class="d">
    Le gain du Leg 3 (vente USDT→MAD à +${all.l3.pct.toFixed(1)}%) ${all.impNet >= 0 ? 'compense' : 'ne compense pas totalement'} les pertes des Legs 1 et 2.${r3m ? ` Sur les 3 derniers mois, le premium MAD est de <strong>+${r3m.l3.pct.toFixed(1)}%</strong> (vs ${all.l3.pct.toFixed(1)}% sur la période totale).` : ''}
  </div></div>`;

  // Insight 3: Leg 3 dominance
  const leg3VsPertes = Math.abs(all.l3.impact) / (Math.abs(all.l1.impact) + Math.abs(all.l2.impact));
  html += `<div class="insight pass"><div class="t">📊 Le Leg 3 (USDT→MAD) est le moteur du gain — ratio ${leg3VsPertes.toFixed(1)}x les pertes</div><div class="d">
    Sur 10k€ : Leg 3 rapporte <strong>${fmtImpact(all.l3.impact)}</strong>, soit <strong>${leg3VsPertes.toFixed(1)}x</strong> les pertes combinées Leg 1 (${fmtImpact(all.l1.impact)}) + Leg 2 (${fmtImpact(all.l2.impact)}). La forte demande de MAD au Maroc via P2P crée un premium structurel en ta faveur.
  </div></div>`;

  // Insight 4: Leg 1 IFX spread
  const r3mStr4 = r3m ? ` / −${r3m.l1.pct.toFixed(2)}% (3 mois)` : '';
  const r3mDetail4 = r3m ? ` ${r3m.l1.pct < all.l1.pct ? 'Le spread IFX s\'améliore sur les 3 derniers mois (' + r3m.l1.pct.toFixed(2) + '%).' : 'Le spread IFX est stable sur les 3 derniers mois.'}` : '';
  html += `<div class="insight warn"><div class="t">🏦 Spread IFX (Leg 1) : −${all.l1.pct.toFixed(2)}% (${periodLabel})${r3mStr4} → ${fmtImpact(all.l1.impact)} sur 10k€</div><div class="d">
    IFX prend en moyenne <strong>${all.l1.pct.toFixed(2)}%</strong> de spread sur la conversion EUR→AED, soit <strong>${fmtImpact(all.l1.impact)}</strong> par tranche de 10 000€.${r3mDetail4}
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
  const r3mStr7 = r3m ? ` et <strong>${r3m.effEURMAD.toFixed(2)}</strong> (3 mois)` : '';
  html += `<div class="insight pass"><div class="t">🌍 P2P vs banque : taux effectif ${all.effEURMAD.toFixed(2)} vs ~10,5–10,8 (banque classique)</div><div class="d">
    Le taux effectif EUR→MAD via P2P est de <strong>${all.effEURMAD.toFixed(2)}</strong> (${periodLabel})${r3mStr7}. Un virement classique EUR→MAD via banque donne environ 10,5–10,8. Le circuit P2P est donc <strong>${all.effEURMAD > 10.8 ? 'nettement plus avantageux' : all.effEURMAD > 10.5 ? 'comparable ou légèrement avantageux' : 'comparable'}</strong>.
  </div></div>`;

  // Insight 8: USDT remaining
  html += `<div class="insight"><div class="t">💰 ${d.usdtRemaining.toFixed(0)} USDT restants — gain potentiel non réalisé</div><div class="d">
    Il reste <strong>${d.usdtRemaining.toFixed(2)} USDT</strong> non vendus. Au prix moyen de vente actuel (${all.l3.prix.toFixed(2)} MAD/USDT), cela représente environ <strong>${fmtPlain(Math.round(d.usdtRemaining * all.l3.prix))} MAD</strong> potentiels.
  </div></div>`;

  html += `</div>`;

  // Method note
  html += `<div class="n ok">
    <strong>Méthode :</strong> <strong>Leg 1</strong> — données IFX vs taux marché EUR/AED du jour (fawazahmed0/currency-api). <strong>Leg 2</strong> — prix P2P Binance vs peg AED/USD (3,6725). <strong>Leg 3</strong> — prix P2P Binance vs USD/MAD marché. <strong>Taux effectif EUR→MAD</strong> = chaîne de taux pondérés (IFX × sell ÷ buy). <strong>Impact (10k€)</strong> = spread% × 10 000 EUR (approximation linéaire).${r3m ? ' <strong>3 derniers mois</strong> = transactions depuis déc. 2025.' : ''}
  </div>`;

  return html;
}
