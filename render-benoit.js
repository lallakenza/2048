// ============================================================
// RENDER-BENOIT.JS — Rendering functions for Benoit reconciliation (2025 and 2026)
// ============================================================

// ---- BENOIT ALL ----
function renderBenoitAll() {
  let html = yearToggle3('Ba', 0);
  html += `<h2 style="font-size:1.05rem;margin-bottom:18px">Benoit — Vue combinée 2025 / 2026</h2>`;
  html += `<div style="margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid var(--border)">`;
  html += renderBenoit2026(true);
  html += `</div>`;
  html += renderBenoit2025(true);
  return html;
}

// ---- BENOIT 2025 ----
function renderBenoit2025(embedded) {
  const d = DATA.benoit2025;
  const rate = d.commissionRate || 0; // from data (public or decrypted)

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

  let html = embedded ? '' : yearToggle3('Ba', 2025);
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
      <div class="card"><div class="l">Dû à Benoit (90% Councils)</div><div class="v blue">${fmtPlain(totalNetBenoit)} DH</div></div>
      <div class="card"><div class="l">Payé en DH</div><div class="v green">${fmtPlain(totalPaye)} DH</div></div>
      <div class="card"><div class="l">Solde (dû − payé)</div><div class="v yellow">${fmtSigned(solde, 'DH')}</div></div>
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
      <thead><tr><th>#</th><th>Date EBS</th><th style="text-align:right">HT (€)</th><th style="text-align:right">Taux appliqué</th><th style="text-align:right">= DH</th><th style="text-align:right">Commission 10%</th><th style="text-align:right">Net Benoit (DH)</th><th></th></tr></thead><tbody>`;
    transactions.forEach((t, i) => {
      html += `<tr><td>${i+1}</td><td>${t.date}</td><td class="a">${fmtPlain(t.htEUR)}</td><td class="a">${fmtRate(t.tauxApplique)}</td><td class="a">${fmtPlain(t.dh)}</td><td class="a">${fmtPlain(t.commission)}</td><td class="a">${fmtPlain(t.netBenoit)}</td><td>${badge('ok','✓ EBS')}</td></tr>`;
    });
    html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalHTEUR)}</strong></td><td></td><td class="a"><strong>${fmtPlain(totalDH)}</strong></td><td class="a"><strong>${fmtPlain(totalCommission)}</strong></td><td class="a"><strong>${fmtPlain(totalNetBenoit)}</strong></td><td></td></tr></tbody></table></div>`;
  }

  // Virements
  html += `<div class="s"><div class="st">Virements DH → Benoit 2025</div><table>
    <thead><tr><th>#</th><th>Date</th><th>Bénéficiaire</th><th style="text-align:right">DH</th><th>Motif</th></tr></thead><tbody>`;
  d.virements.forEach((v, i) => {
    html += `<tr><td>${i+1}</td><td>${v.date}</td><td>${v.beneficiaire}</td><td class="a">${fmtPlain(v.dh)}</td><td>${v.motif}</td></tr>`;
  });
  html += `<tr class="tr"><td></td><td colspan="2"><strong>Total payé 2025</strong></td><td class="a"><strong>${fmtPlain(totalPaye)}</strong></td><td></td></tr></tbody></table></div>`;

  // Réconciliation (always visible now)
  html += `<div class="s"><div class="st">Réconciliation Benoit 2025</div><table>
    <thead><tr><th>Ligne</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
    <tr><td>Councils HT total (taux appliqué)</td><td class="a">${fmtPlain(totalDH)}</td><td>${transactions.length} paiements EBS × taux appliqué</td></tr>
    <tr><td>Commission 10%</td><td class="a" style="color:var(--yellow)">−${fmtPlain(totalCommission)}</td><td>Retenue par Amine</td></tr>
    <tr><td><strong>Net dû à Benoit</strong></td><td class="a"><strong>${fmtPlain(totalNetBenoit)}</strong></td><td></td></tr>
    <tr><td>Total virements DH</td><td class="a" style="color:var(--green)">−${fmtPlain(totalPaye)}</td><td>${d.virements.length} virements (Jul-Mar)</td></tr>
    <tr class="tr"><td><strong>Solde → Report 2026</strong></td><td class="a" style="color:var(--yellow)"><strong>${fmtSigned(solde, 'DH')}</strong></td><td>${solde > 0 ? 'Amine doit encore ' + fmtPlain(solde) + ' DH à Benoit → carryforward 2026' : 'Soldé'}</td></tr>
    </tbody></table></div>`;

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
function renderBenoit2026(embedded) {
  const d = DATA.benoit2026;
  const rate = d.commissionRate || 0;

  // Get report from Benoit 2025 computed
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

  // Compute 2026 transactions (per-transaction tauxApplique)
  const transactions = d.councils.map(m => {
    const taux = m.tauxApplique || 0;
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

  let html = embedded ? '' : yearToggle3('Ba', 2026);
  html += `<h2 style="font-size:1.05rem;margin-bottom:6px">${d.title}</h2>`;
  if (window.PRIV) {
    html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">Report 2025 : ${fmtSigned(report, 'DH')} (dû à Benoit). Réconciliation sur paiements Councils reçus uniquement.</p>`;
    html += `<div class="cards">
      <div class="card"><div class="l">Report 2025</div><div class="v yellow">${fmtSigned(report, 'DH')}</div></div>
      <div class="card"><div class="l">Councils payé 2026 (brut)</div><div class="v blue">${fmtPlain(totalDHPaid)} DH</div></div>
      <div class="card"><div class="l">Councils payé 2026 (net −10%)</div><div class="v blue">${fmtPlain(totalNetBenoitPaid)} DH</div></div>
      <div class="card"><div class="l">Payé DH 2026</div><div class="v green">${fmtPlain(totalPaye)} DH</div></div>
      <div class="card"><div class="l">Solde (report + dû − payé)</div><div class="v ${solde2026 > 0 ? 'yellow' : solde2026 < 0 ? 'green' : 'green'}">${fmtSigned(solde2026, 'DH')}</div></div>
    </div>`;
  } else {
    html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">Report 2025 : ${fmtSigned(report, 'DH')} (dû à Benoit).</p>`;
    html += `<div class="cards">
      <div class="card"><div class="l">Report 2025</div><div class="v yellow">${fmtSigned(report, 'DH')}</div></div>
      <div class="card"><div class="l">Councils payé 2026 (net −10%)</div><div class="v blue">${fmtPlain(totalNetBenoitPaid)} DH</div></div>
      <div class="card"><div class="l">Payé DH 2026</div><div class="v green">${fmtPlain(totalPaye)} DH</div></div>
      <div class="card"><div class="l">Solde (report + dû − payé)</div><div class="v ${solde2026 > 0 ? 'yellow' : 'green'}">${fmtSigned(solde2026, 'DH')}</div></div>
    </div>`;
  }

  // Councils table
  if (window.PRIV) {
    html += `<div class="s"><div class="st">Paiements Councils 2026 — convertis en DH (taux appliqué vs marché)</div><table>
      <thead><tr><th>Mois</th><th style="text-align:right">HT (€)</th><th style="text-align:right">Taux appliqué</th><th style="text-align:right">Taux marché</th><th style="text-align:right">Δ taux</th><th style="text-align:right">= DH</th><th style="text-align:right">Gain FX (DH)</th><th style="text-align:right">Commission 10%</th><th style="text-align:right">Net Benoit (DH)</th><th>Statut</th></tr></thead><tbody>`;
    transactions.forEach(t => {
      html += `<tr><td>${t.mois}</td><td class="a">${fmtPlain(t.htEUR)}</td><td class="a">${fmtRate(t.tauxApplique)}</td><td class="a">${t.tauxMarche ? fmtRate(t.tauxMarche) : '—'}</td><td class="a"${t.delta !== null ? ' style="color:var(--green)"' : ''}>${t.delta !== null ? fmtDelta(t.delta) : '—'}</td><td class="a">${fmtPlain(t.dh)}</td><td class="a"${t.gainFX !== null ? ' style="color:var(--green)"' : ''}>${t.gainFX !== null ? fmtSigned(t.gainFX, '') : '—'}</td><td class="a">${fmtPlain(t.commission)}</td><td class="a">${fmtPlain(t.netBenoit)}</td><td>${badge(t.statut, t.statutText)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  } else {
    html += `<div class="s"><div class="st">Paiements Councils 2026 — convertis en DH</div><table>
      <thead><tr><th>Mois</th><th style="text-align:right">HT (€)</th><th style="text-align:right">Taux appliqué</th><th style="text-align:right">= DH</th><th style="text-align:right">Commission 10%</th><th style="text-align:right">Net Benoit (DH)</th><th>Statut</th></tr></thead><tbody>`;
    transactions.forEach(t => {
      html += `<tr><td>${t.mois}</td><td class="a">${fmtPlain(t.htEUR)}</td><td class="a">${fmtRate(t.tauxApplique)}</td><td class="a">${fmtPlain(t.dh)}</td><td class="a">${fmtPlain(t.commission)}</td><td class="a">${fmtPlain(t.netBenoit)}</td><td>${badge(t.statut, t.statutText)}</td></tr>`;
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

  // Réconciliation 2026 (always visible)
  html += `<div class="s"><div class="st">Réconciliation Benoit 2026 (payé uniquement)</div><table>
    <thead><tr><th>Ligne</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
    <tr><td>Report 2025</td><td class="a" style="color:var(--yellow)">${fmtSigned(report, '')}</td><td>Solde clôture 2025 (dû à Benoit)</td></tr>
    <tr><td>Councils HT payé 2026</td><td class="a">${fmtPlain(totalDHPaid)}</td><td>${paidTransactions.length} paiement(s) reçu(s)</td></tr>
    <tr><td>Commission 10%</td><td class="a" style="color:var(--yellow)">−${fmtPlain(totalCommissionPaid)}</td><td>Retenue par Amine</td></tr>
    <tr><td><strong>Total dû à Benoit</strong></td><td class="a"><strong>${fmtPlain(soldeDu)}</strong></td><td>Report + net Councils payé</td></tr>
    <tr><td>Virements DH 2026</td><td class="a" style="color:var(--green)">−${fmtPlain(totalPaye)}</td><td>${d.virements.length} virement(s)</td></tr>
    <tr class="tr"><td><strong>Solde 2026</strong></td><td class="a" style="color:${solde2026 > 0 ? 'var(--yellow)' : 'var(--green)'}"><strong>${fmtSigned(solde2026, '')}</strong></td><td>${solde2026 > 0 ? 'Amine doit encore ' + fmtPlain(solde2026) + ' DH à Benoit' : solde2026 < 0 ? 'Benoit a un excédent de ' + fmtPlain(Math.abs(solde2026)) + ' DH' : 'Soldé'}</td></tr>
    </tbody></table></div>`;
  html += `<div class="n">Le virement du 06/03/2026 (31 750 DH) a été comptabilisé dans la clôture 2025. La réconciliation ne prend en compte que les Councils effectivement payés.</div>`;

  return html;
}
