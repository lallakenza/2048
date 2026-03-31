// ============================================================
// RENDER-BENOIT.JS — Generic Benoit rendering (2025 & 2026)
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

// ---- Convenience wrappers ----
function renderBenoit2025(embedded) {
  return renderBenoitYear('benoit2025', { embedded, year: 2025, report: 0 });
}

function renderBenoit2026(embedded) {
  // Compute report dynamically from 2025
  const b25 = DATA.benoit2025;
  const rate25 = b25.commissionRate || 0;
  const net25 = b25.councils.reduce((s, m) => {
    const dh = Math.round(m.htEUR * m.tauxApplique);
    return s + dh - Math.round(dh * rate25);
  }, 0);
  const paye25 = sum(b25.virements, 'dh');
  const report = net25 - paye25;
  return renderBenoitYear('benoit2026', { embedded, year: 2026, report });
}

// ============================================================
// GENERIC BENOIT YEAR RENDERER
// ============================================================
function renderBenoitYear(dataKey, opts = {}) {
  const { embedded = false, year = 2025, report = 0 } = opts;
  const d = DATA[dataKey];
  const rate = d.commissionRate || 0;
  const ratePct = Math.round(rate * 100);  // e.g. 10 for 0.10
  const netPct = 100 - ratePct;            // e.g. 90
  const tvaRate = d.tvaRate || 0;
  const tvaPct = Math.round(tvaRate * 100); // e.g. 21

  // Detect if this is a clôture year (no statut field) or en-cours
  const isClotured = !d.councils[0]?.statut;
  const dateField = isClotured ? 'date' : 'mois';
  const dateLabel = isClotured ? 'Date EBS' : 'Mois';
  const hasRef = d.councils.some(m => m.ref);

  // ---- Compute per-transaction ----
  const transactions = d.councils.map(m => {
    const taux = m.tauxApplique || 0;
    const dh = taux ? Math.round(m.htEUR * taux) : 0;
    const delta = m.tauxMarche && taux ? taux - m.tauxMarche : null;
    const gainFX = m.tauxMarche && taux ? Math.round(m.htEUR * (m.tauxMarche - taux)) : (m.tauxMarche ? 0 : null);
    const commission = Math.round(dh * rate);
    const netBenoit = dh - commission;
    return { ...m, dh, delta, gainFX, commission, netBenoit };
  });

  // ---- Totals ----
  const totalHTEUR = sum(transactions, 'htEUR');
  const totalDH = sum(transactions, 'dh');
  const totalCommission = sum(transactions, 'commission');
  const totalNetBenoit = sum(transactions, 'netBenoit');
  const totalGainFX = sum(transactions, t => t.gainFX || 0);
  const totalPaye = sum(d.virements, 'dh');

  // For en-cours: only paid transactions count in reconciliation
  const paidTransactions = isClotured ? transactions : transactions.filter(t => t.statut === 'ok');
  const totalDHPaid = sum(paidTransactions, 'dh');
  const totalNetPaid = sum(paidTransactions, 'netBenoit');
  const totalCommPaid = sum(paidTransactions, 'commission');
  const totalGainFXPaid = sum(paidTransactions, t => t.gainFX || 0);

  // Reconciliation
  const soldeDu = report + totalNetPaid;
  const solde = soldeDu - totalPaye;
  const totalGains = totalCommission + totalGainFX;

  // ---- HTML BUILD ----
  let html = embedded ? '' : yearToggle3('Ba', year);

  // Title
  html += `<h2 style="font-size:1.05rem;margin-bottom:6px">${d.title}</h2>`;
  if (!isClotured) {
    // En-cours: show report in subtitle
    const subtitleExtra = window.PRIV
      ? `Report ${year - 1} : ${fmtSigned(report, 'DH')} (dû à Benoit). Réconciliation sur paiements Councils reçus uniquement.`
      : `Report ${year - 1} : ${fmtSigned(report, 'DH')} (dû à Benoit).`;
    html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">${subtitleExtra}</p>`;
  } else {
    html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">${d.subtitle}</p>`;
  }

  // ---- Cards ----
  // Who owes whom helper for Benoit
  const benoitWhoOwes = solde > 0
    ? `<div style="font-size:.7rem;margin-top:4px;color:var(--yellow);font-weight:600">→ Amine doit payer Benoit</div>`
    : solde < 0
    ? `<div style="font-size:.7rem;margin-top:4px;color:var(--green);font-weight:600">→ Benoit a un excédent</div>`
    : `<div style="font-size:.7rem;margin-top:4px;color:var(--green);font-weight:600">→ Soldé</div>`;

  if (isClotured) {
    // Clôture: Dû / Payé / Solde (+ Gains in PRIV)
    if (window.PRIV) {
      html += `<div class="cards">
        <div class="card"><div class="l">Dû à Benoit (${netPct}%)</div><div class="v blue">${fmtPlain(totalNetBenoit)} DH</div><div style="font-size:.65rem;color:var(--muted)">Councils HT − commission</div></div>
        <div class="card"><div class="l">Payé en DH</div><div class="v green">${fmtPlain(totalPaye)} DH</div><div style="font-size:.65rem;color:var(--muted)">${d.virements.length} virement(s)</div></div>
        <div class="card" style="border:2px solid ${solde > 0 ? 'var(--yellow)' : 'var(--green)'}"><div class="l">Position</div><div class="v ${solde > 0 ? 'yellow' : 'green'}">${fmtSigned(solde, 'DH')}</div>${benoitWhoOwes}</div>
        <div class="card"><div class="l">Total gains Amine</div><div class="v green">${fmtPlain(totalGains)} DH</div><div style="font-size:.65rem;color:var(--muted)">FX + Commission</div></div>
      </div>`;
    } else {
      html += `<div class="cards">
        <div class="card"><div class="l">Dû à Benoit (${netPct}%)</div><div class="v blue">${fmtPlain(totalNetBenoit)} DH</div><div style="font-size:.65rem;color:var(--muted)">Councils HT − commission</div></div>
        <div class="card"><div class="l">Payé en DH</div><div class="v green">${fmtPlain(totalPaye)} DH</div><div style="font-size:.65rem;color:var(--muted)">${d.virements.length} virement(s)</div></div>
        <div class="card" style="border:2px solid ${solde > 0 ? 'var(--yellow)' : 'var(--green)'}"><div class="l">Position</div><div class="v ${solde > 0 ? 'yellow' : 'green'}">${fmtSigned(solde, 'DH')}</div>${benoitWhoOwes}</div>
      </div>`;
    }
  } else {
    // En-cours: Report / Net paid / Payé / Solde
    if (window.PRIV) {
      html += `<div class="cards">
        <div class="card"><div class="l">Report ${year - 1}</div><div class="v yellow">${fmtSigned(report, 'DH')}</div><div style="font-size:.65rem;color:var(--muted)">Reste dû de ${year - 1}</div></div>
        <div class="card"><div class="l">Councils payé ${year} (net −${ratePct}%)</div><div class="v blue">${fmtPlain(totalNetPaid)} DH</div><div style="font-size:.65rem;color:var(--muted)">${paidTransactions.length} factures reçues</div></div>
        <div class="card"><div class="l">Payé DH ${year}</div><div class="v green">${fmtPlain(totalPaye)} DH</div><div style="font-size:.65rem;color:var(--muted)">${d.virements.length} virement(s) envoyé(s)</div></div>
        <div class="card" style="border:2px solid ${solde > 0 ? 'var(--yellow)' : 'var(--green)'}"><div class="l">Position actuelle</div><div class="v ${solde > 0 ? 'yellow' : 'green'}">${fmtSigned(solde, 'DH')}</div>${benoitWhoOwes}</div>
      </div>`;
    } else {
      html += `<div class="cards">
        <div class="card"><div class="l">Report ${year - 1}</div><div class="v yellow">${fmtSigned(report, 'DH')}</div><div style="font-size:.65rem;color:var(--muted)">Reste dû de ${year - 1}</div></div>
        <div class="card"><div class="l">Councils payé ${year} (net −${ratePct}%)</div><div class="v blue">${fmtPlain(totalNetPaid)} DH</div><div style="font-size:.65rem;color:var(--muted)">${paidTransactions.length} factures reçues</div></div>
        <div class="card"><div class="l">Payé DH ${year}</div><div class="v green">${fmtPlain(totalPaye)} DH</div><div style="font-size:.65rem;color:var(--muted)">${d.virements.length} virement(s) envoyé(s)</div></div>
        <div class="card" style="border:2px solid ${solde > 0 ? 'var(--yellow)' : 'var(--green)'}"><div class="l">Position actuelle</div><div class="v ${solde > 0 ? 'yellow' : 'green'}">${fmtSigned(solde, 'DH')}</div>${benoitWhoOwes}</div>
      </div>`;
    }
  }

  // ---- Councils table ----
  const tableTitle = isClotured
    ? `Paiements Councils HT ${year} — convertis en DH`
    : `Paiements Councils ${year} — convertis en DH`;

  if (window.PRIV) {
    const privTitle = tableTitle.replace('convertis en DH', 'convertis en DH (taux appliqué vs marché)');
    const ttcHeader = tvaRate ? `<th data-sort="num" style="text-align:right">TTC (€)</th>` : '';
    const refHeader = hasRef ? '<th>Ref</th>' : '';
    html += `<div class="s"><div class="st">${privTitle}</div>`;
    if (tvaRate) html += `<div class="n" style="margin-bottom:8px">AZCS → Majalis. Azarkan reçoit les paiements <strong>TTC</strong> (TVA ${tvaPct}%) en Belgique — on comptabilise en <strong>HT</strong>.</div>`;
    html += `<table>
      <thead><tr>${isClotured ? '<th>#</th>' : ''}${refHeader}<th data-sort="date">${dateLabel}</th><th data-sort="num" style="text-align:right">HT (€)</th>${ttcHeader}<th data-sort="num" style="text-align:right">Taux appliqué</th><th data-sort="num" style="text-align:right">Taux marché</th><th data-sort="num" style="text-align:right">Δ taux</th><th data-sort="num" style="text-align:right">= DH</th><th data-sort="num" style="text-align:right">Gain FX (DH)</th><th data-sort="num" style="text-align:right">Commission ${ratePct}%</th><th data-sort="num" style="text-align:right">Net Benoit (DH)</th><th></th></tr></thead><tbody>`;
    transactions.forEach((t, i) => {
      const dateVal = t[dateField];
      const ttc = tvaRate ? Math.round(t.htEUR * (1 + tvaRate) * 100) / 100 : null;
      const ttcCell = tvaRate ? `<td class="a" style="color:var(--muted)">${fmtPlain(Math.round(ttc))}</td>` : '';
      const refCell = hasRef ? `<td style="font-size:.72rem">${t.ref || ''}${t.backlog ? ' <span style="color:var(--yellow)">(backlog)</span>' : ''}</td>` : '';
      const statusCell = isClotured
        ? badge('ok', '✓ EBS')
        : badge(t.statut, t.statutText);
      html += `<tr>${isClotured ? `<td>${i+1}</td>` : ''}${refCell}<td>${dateVal}</td><td class="a">${fmtPlain(t.htEUR)}</td>${ttcCell}<td class="a">${fmtRate(t.tauxApplique)}</td><td class="a">${t.tauxMarche ? fmtRate(t.tauxMarche) : '—'}</td><td class="a"${t.delta !== null ? ' style="color:var(--green)"' : ''}>${t.delta !== null ? fmtDelta(t.delta) : '—'}</td><td class="a">${fmtPlain(t.dh)}</td><td class="a"${t.gainFX !== null ? ' style="color:var(--green)"' : ''}>${t.gainFX !== null ? fmtSigned(t.gainFX, '') : '—'}</td><td class="a">${fmtPlain(t.commission)}</td><td class="a">${fmtPlain(t.netBenoit)}</td><td>${statusCell}</td></tr>`;
    });
    if (isClotured) {
      const totalTTC = tvaRate ? Math.round(totalHTEUR * (1 + tvaRate)) : null;
      const ttcTotalCell = tvaRate ? `<td class="a" style="color:var(--muted)"><strong>${fmtPlain(totalTTC)}</strong></td>` : '';
      html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalHTEUR)}</strong></td>${ttcTotalCell}<td></td><td></td><td></td><td class="a"><strong>${fmtPlain(totalDH)}</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(totalGainFX, '')}</strong></td><td class="a"><strong>${fmtPlain(totalCommission)}</strong></td><td class="a"><strong>${fmtPlain(totalNetBenoit)}</strong></td><td></td></tr>`;
    }
    html += `</tbody></table></div>`;
  } else {
    const ttcHeader2 = tvaRate ? `<th data-sort="num" style="text-align:right">TTC (€)</th>` : '';
    const refHeader2 = hasRef ? '<th>Ref</th>' : '';
    html += `<div class="s"><div class="st">${tableTitle}</div>`;
    if (tvaRate) html += `<div class="n" style="margin-bottom:8px">AZCS → Majalis. Azarkan reçoit les paiements <strong>TTC</strong> (TVA ${tvaPct}%) en Belgique — on comptabilise en <strong>HT</strong>.</div>`;
    html += `<table>
      <thead><tr>${isClotured ? '<th>#</th>' : ''}${refHeader2}<th data-sort="date">${dateLabel}</th><th data-sort="num" style="text-align:right">HT (€)</th>${ttcHeader2}<th data-sort="num" style="text-align:right">Taux appliqué</th><th data-sort="num" style="text-align:right">= DH</th><th data-sort="num" style="text-align:right">Commission ${ratePct}%</th><th data-sort="num" style="text-align:right">Net Benoit (DH)</th><th></th></tr></thead><tbody>`;
    transactions.forEach((t, i) => {
      const dateVal = t[dateField];
      const ttc2 = tvaRate ? Math.round(t.htEUR * (1 + tvaRate) * 100) / 100 : null;
      const ttcCell2 = tvaRate ? `<td class="a" style="color:var(--muted)">${fmtPlain(Math.round(ttc2))}</td>` : '';
      const refCell2 = hasRef ? `<td style="font-size:.72rem">${t.ref || ''}${t.backlog ? ' <span style="color:var(--yellow)">(backlog)</span>' : ''}</td>` : '';
      const statusCell = isClotured
        ? badge('ok', '✓ EBS')
        : badge(t.statut, t.statutText);
      html += `<tr>${isClotured ? `<td>${i+1}</td>` : ''}${refCell2}<td>${dateVal}</td><td class="a">${fmtPlain(t.htEUR)}</td>${ttcCell2}<td class="a">${fmtRate(t.tauxApplique)}</td><td class="a">${fmtPlain(t.dh)}</td><td class="a">${fmtPlain(t.commission)}</td><td class="a">${fmtPlain(t.netBenoit)}</td><td>${statusCell}</td></tr>`;
    });
    if (isClotured) {
      const totalTTC2 = tvaRate ? Math.round(totalHTEUR * (1 + tvaRate)) : null;
      const ttcTotalCell2 = tvaRate ? `<td class="a" style="color:var(--muted)"><strong>${fmtPlain(totalTTC2)}</strong></td>` : '';
      html += `<tr class="tr"><td></td><td><strong>Total</strong></td><td class="a"><strong>${fmtPlain(totalHTEUR)}</strong></td>${ttcTotalCell2}<td></td><td class="a"><strong>${fmtPlain(totalDH)}</strong></td><td class="a"><strong>${fmtPlain(totalCommission)}</strong></td><td class="a"><strong>${fmtPlain(totalNetBenoit)}</strong></td><td></td></tr>`;
    }
    html += `</tbody></table></div>`;
  }

  // ---- Virements ----
  if (d.virements.length > 0) {
    html += `<div class="s"><div class="st">Virements DH → Benoit ${year}</div><table>
      <thead><tr><th>#</th><th data-sort="date">Date</th><th>Bénéficiaire</th><th data-sort="num" style="text-align:right">DH</th><th>Motif</th></tr></thead><tbody>`;
    d.virements.forEach((v, i) => {
      html += `<tr><td>${i+1}</td><td>${v.date}</td><td>${v.beneficiaire}</td><td class="a">${fmtPlain(v.dh)}</td><td>${v.motif}</td></tr>`;
    });
    html += `<tr class="tr"><td></td><td colspan="2"><strong>Total payé ${year}</strong></td><td class="a"><strong>${fmtPlain(totalPaye)}</strong></td><td></td></tr></tbody></table></div>`;
  }

  // ---- Réconciliation ----
  if (isClotured) {
    html += `<div class="s"><div class="st">Réconciliation Benoit ${year}</div><table>
      <thead><tr><th>Ligne</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
      <tr><td>Councils HT total (taux appliqué)</td><td class="a">${fmtPlain(totalDH)}</td><td>${transactions.length} paiements EBS × taux appliqué</td></tr>
      <tr><td>Commission ${ratePct}%</td><td class="a" style="color:var(--yellow)">−${fmtPlain(totalCommission)}</td><td>Retenue par Amine</td></tr>
      <tr><td><strong>Net dû à Benoit</strong></td><td class="a"><strong>${fmtPlain(totalNetBenoit)}</strong></td><td></td></tr>
      <tr><td>Total virements DH</td><td class="a" style="color:var(--green)">−${fmtPlain(totalPaye)}</td><td>${d.virements.length} virement(s)</td></tr>
      <tr class="tr"><td><strong>Solde → Report ${year + 1}</strong></td><td class="a" style="color:var(--yellow)"><strong>${fmtSigned(solde, 'DH')}</strong></td><td>${solde > 0 ? 'Amine doit encore ' + fmtPlain(solde) + ' DH à Benoit → carryforward ' + (year + 1) : 'Soldé'}</td></tr>
      </tbody></table></div>`;
  } else {
    html += `<div class="s"><div class="st">Réconciliation Benoit ${year} (payé uniquement)</div><table>
      <thead><tr><th>Ligne</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
      <tr><td>Report ${year - 1}</td><td class="a" style="color:var(--yellow)">${fmtSigned(report, '')}</td><td>Solde clôture ${year - 1} (dû à Benoit)</td></tr>
      <tr><td>Councils HT payé ${year}</td><td class="a">${fmtPlain(totalDHPaid)}</td><td>${paidTransactions.length} paiement(s) reçu(s)</td></tr>
      <tr><td>Commission ${ratePct}%</td><td class="a" style="color:var(--yellow)">−${fmtPlain(totalCommPaid)}</td><td>Retenue par Amine</td></tr>
      <tr><td><strong>Total dû à Benoit</strong></td><td class="a"><strong>${fmtPlain(soldeDu)}</strong></td><td>Report + net Councils payé</td></tr>
      <tr><td>Virements DH ${year}</td><td class="a" style="color:var(--green)">−${fmtPlain(totalPaye)}</td><td>${d.virements.length} virement(s)</td></tr>
      <tr class="tr"><td><strong>Solde ${year}</strong></td><td class="a" style="color:${solde > 0 ? 'var(--yellow)' : 'var(--green)'}"><strong>${fmtSigned(solde, '')}</strong></td><td>${solde > 0 ? 'Amine doit encore ' + fmtPlain(solde) + ' DH à Benoit' : solde < 0 ? 'Benoit a un excédent de ' + fmtPlain(Math.abs(solde)) + ' DH' : 'Soldé'}</td></tr>
      </tbody></table></div>`;
    // Footer notes from data (if any)
    if (d.notes) {
      d.notes.forEach(n => { html += `<div class="n">${n}</div>`; });
    }
  }

  // ---- PRIV: Consolidation gains (clôture only) ----
  if (window.PRIV && isClotured) {
    html += `<div class="s"><div class="st">Consolidation des gains Amine — Benoit ${year}</div><table>
      <thead><tr><th>Source du gain</th><th data-sort="num" style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
      <tr><td><strong>Commission ${ratePct}%</strong></td><td class="a" style="color:var(--green)">${fmtSigned(totalCommission, '')}</td><td>${ratePct}% sur ${fmtPlain(totalDH)} DH de Councils HT</td></tr>
      <tr><td><strong>Gain FX (Δ taux)</strong></td><td class="a" style="color:var(--green)">${fmtSigned(totalGainFX, '')}</td><td>Taux appliqué inférieur au marché sur ${transactions.length} transactions</td></tr>
      <tr class="tr"><td><strong>Total gains Amine</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(totalGains, '')}</strong></td><td></td></tr>
      </tbody></table>`;

    const gainDetails = transactions.map((t, i) => `#${i+1} ${fmtSigned(t.gainFX || 0, '')} DH (Δ ${fmtDelta(t.delta)})`).join(' · ');
    html += `<div class="n ok"><strong>Gains FX par transaction :</strong> ${gainDetails}. Le taux appliqué est systématiquement inférieur au taux marché, générant un gain FX de <strong>${fmtPlain(totalGainFX)} DH</strong> en plus de la commission.</div></div>`;
  }

  return html;
}
