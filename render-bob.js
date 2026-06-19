// ============================================================
// RENDER-BOB.JS — Bob (Hamza El Azzouzi) rendering — 2026 en-cours
//
// MODÈLE :
//   Amine facture Hamza via Bridgevale Consulting (société UK). Flux
//   international HT (Hamza basé en Belgique, Bridgevale au UK) → PAS de TVA.
//   Azarkan (Mohammed = alias "Augustin") récupère les fonds et les dispatche
//   temporairement à Hamza, en attendant qu'il ait son propre compte.
//
//   Commission TOTALE 13 % = 10 % Amine + 3 % Augustin (dispatch).
//     net Hamza = brut DH − 13 %.
//
//   Tracking comme Badre : factures HT en €, converties en DH au tauxApplique
//   de chaque ligne, payées en DH (virements). Relation récente → report = 0.
//
//   PRIV (BINGA) injecte tauxMarche par facture → gain FX (visible Amine only).
//   En vue Bob (EPONGE) et en TIGRE, window.PRIV = false → pas de colonnes FX.
// ============================================================

function renderBob() {
  return renderBob2026();
}

function renderBob2026() {
  const d = DATA.bob2026;
  const year = 2026;
  const report = d.report2025 || 0;

  const rA = d.commissionAmineRate || 0;     // 0.10
  const rM = d.commissionMohammedRate || 0;  // 0.03
  const pctA = Math.round(rA * 100);
  const pctM = Math.round(rM * 100);
  const pctTot = Math.round((rA + rM) * 100);
  const netPct = 100 - pctTot;

  const councils = d.councils || [];
  const virements = d.virements || [];
  const hasRef = councils.some(m => m.ref);

  // ---- Per-transaction compute ----
  const transactions = councils.map(m => {
    const taux = m.tauxApplique || 0;
    const dh = taux ? Math.round(m.htEUR * taux) : 0;
    const delta = m.tauxMarche && taux ? taux - m.tauxMarche : null;
    const gainFX = m.tauxMarche && taux ? Math.round(m.htEUR * (m.tauxMarche - taux)) : (m.tauxMarche ? 0 : null);
    const commA = Math.round(dh * rA);
    const commM = Math.round(dh * rM);
    const netBob = dh - commA - commM;
    return { ...m, dh, delta, gainFX, commA, commM, netBob };
  });

  // Only paid councils count in the reconciliation
  const paid = transactions.filter(t => t.statut === 'ok');
  const totalDHPaid     = sum(paid, 'dh');
  const totalCommAPaid  = sum(paid, 'commA');
  const totalCommMPaid  = sum(paid, 'commM');
  const totalNetPaid    = sum(paid, 'netBob');
  const totalGainFXPaid = sum(paid, t => t.gainFX || 0);
  const totalPaye       = sum(virements, 'dh');

  const soldeDu = report + totalNetPaid;
  const solde   = soldeDu - totalPaye;

  // ---- HEADER ----
  let html = '';
  html += `<h2 style="font-size:1.05rem;margin-bottom:6px">${d.title}</h2>`;
  html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">Report ${year - 1} : ${fmtSigned(report, 'DH')} (relation récente). Facturé via Bridgevale Consulting — flux international HT (pas de TVA). Commission ${pctTot} % (${pctA} % Amine + ${pctM} % Augustin). Réconciliation sur Councils payés uniquement.</p>`;

  // ---- HERO CARD ----
  const heroColor = solde > 0 ? 'yellow' : 'green';
  const heroMsg = solde > 0 ? 'Amine doit payer Bob' : solde < 0 ? 'Bob a un excédent' : 'Soldé — aucune action';
  html += `<div class="hero-card" style="border-color:var(--${heroColor})">
    <div class="hero-label">Position actuelle</div>
    <div class="hero-value ${heroColor}">${fmtSigned(solde, 'DH')}</div>
    <div class="hero-who" style="color:var(--${heroColor})">${heroMsg}</div>
    <div class="hero-detail">En cours ${year} · Basé sur ${paid.length} facture(s) payée(s)</div>
  </div>`;

  // ---- EMPTY STATE ----
  if (councils.length === 0) {
    html += `<div class="n" style="margin-top:14px">Aucune facture enregistrée pour l'instant. La structure est en place — les Councils et virements s'afficheront ici dès qu'ils seront ajoutés dans <code>encrypt.js</code> (bloc <code>bob2026</code>).</div>`;
    if (d.notes) {
      let notesHtml = d.notes.map(n => `<div class="n">${nickText(n)}</div>`).join('');
      html += collapsible(`Notes — Bob ${year}`, notesHtml);
    }
    return html;
  }

  // ---- Summary row ----
  html += `<div class="summary-row">
    <div class="summary-item"><div class="sl">Report ${year - 1}</div><div class="sv" style="color:var(--yellow)">${fmtSigned(report, 'DH')}</div><div class="sd">Reste dû de ${year - 1}</div></div>
    <div class="summary-item"><div class="sl">Councils payé (net −${pctTot} %)</div><div class="sv" style="color:var(--accent)">${fmtPlain(totalNetPaid)} DH</div><div class="sd">${paid.length} facture(s)</div></div>
    <div class="summary-item"><div class="sl">Payé DH</div><div class="sv" style="color:var(--green)">${fmtPlain(totalPaye)} DH</div><div class="sd">${virements.length} virement(s)</div></div>
  </div>`;

  // ---- Councils table ----
  const refHeader = hasRef ? '<th>Ref</th>' : '';
  let councilsTableHtml = `<div class="n" style="margin-bottom:8px">Bridgevale Consulting facture Hamza en <strong>HT</strong> (flux international, pas de TVA). Conversion en DH au taux appliqué. Commission ${pctTot} % retenue : ${pctA} % Amine + ${pctM} % Augustin (dispatch).</div>`;
  councilsTableHtml += `<table>
    <thead><tr>${refHeader}<th data-sort="date">Mois</th><th data-sort="num" style="text-align:right">HT (€)</th><th data-sort="num" style="text-align:right">Taux appliqué</th>${window.PRIV ? '<th data-sort="num" style="text-align:right">Taux marché</th><th data-sort="num" style="text-align:right">Δ taux</th>' : ''}<th data-sort="num" style="text-align:right">= DH</th>${window.PRIV ? '<th data-sort="num" style="text-align:right">Gain FX (DH)</th>' : ''}<th data-sort="num" style="text-align:right">Comm. Amine ${pctA} %</th><th data-sort="num" style="text-align:right">Comm. Augustin ${pctM} %</th><th data-sort="num" style="text-align:right">Net Bob (DH)</th><th></th></tr></thead><tbody>`;
  transactions.forEach(t => {
    const refCell = hasRef ? `<td style="font-size:.72rem">${t.ref || ''}</td>` : '';
    const privCells1 = window.PRIV
      ? `<td class="a">${t.tauxMarche ? fmtRate(t.tauxMarche) : '—'}</td><td class="a"${t.delta !== null ? ' style="color:var(--green)"' : ''}>${t.delta !== null ? fmtDelta(t.delta) : '—'}</td>`
      : '';
    const privCells2 = window.PRIV
      ? `<td class="a"${t.gainFX !== null ? ' style="color:var(--green)"' : ''}>${t.gainFX !== null ? fmtSigned(t.gainFX, '') : '—'}</td>`
      : '';
    councilsTableHtml += `<tr>${refCell}<td>${t.mois || t.date || ''}</td><td class="a">${fmtPlain(t.htEUR)}</td><td class="a">${fmtRate(t.tauxApplique)}</td>${privCells1}<td class="a">${fmtPlain(t.dh)}</td>${privCells2}<td class="a">${fmtPlain(t.commA)}</td><td class="a">${fmtPlain(t.commM)}</td><td class="a">${fmtPlain(t.netBob)}</td><td>${badge(t.statut, t.statutText)}</td></tr>`;
  });
  councilsTableHtml += `</tbody></table>`;
  const tableTitle = window.PRIV
    ? `Paiements Councils ${year} — convertis en DH (taux appliqué vs marché)`
    : `Paiements Councils ${year} — convertis en DH`;
  html += collapsible(tableTitle, councilsTableHtml);

  // ---- Virements ----
  if (virements.length > 0) {
    let virementsHtml = `<table>
      <thead><tr><th>#</th><th data-sort="date">Date</th><th>Bénéficiaire</th><th data-sort="num" style="text-align:right">DH</th><th>Motif</th></tr></thead><tbody>`;
    virements.forEach((v, i) => {
      virementsHtml += `<tr><td>${i + 1}</td><td>${v.date}</td><td>${nick(v.beneficiaire)}</td><td class="a">${fmtPlain(v.dh)}</td><td>${nickText(v.motif || '')}</td></tr>`;
    });
    virementsHtml += `<tr class="tr"><td></td><td colspan="2"><strong>Total payé ${year}</strong></td><td class="a"><strong>${fmtPlain(totalPaye)}</strong></td><td></td></tr></tbody></table>`;
    html += collapsible(`Virements DH → Bob ${year}`, virementsHtml);
  }

  // ---- Réconciliation ----
  let recoHtml = `<table>
    <thead><tr><th>Ligne</th><th style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
    <tr><td>Report ${year - 1}</td><td class="a" style="color:var(--yellow)">${fmtSigned(report, '')}</td><td>Relation récente — aucun report</td></tr>
    <tr><td>Councils HT payé ${year}</td><td class="a">${fmtPlain(totalDHPaid)}</td><td>${paid.length} paiement(s) reçu(s)</td></tr>
    <tr><td>Commission Amine ${pctA} %</td><td class="a" style="color:var(--yellow)">−${fmtPlain(totalCommAPaid)}</td><td>Retenue par Amine</td></tr>
    <tr><td>Commission Augustin ${pctM} %</td><td class="a" style="color:var(--yellow)">−${fmtPlain(totalCommMPaid)}</td><td>Retenue dispatch (Augustin)</td></tr>
    <tr><td><strong>Total dû à Bob</strong></td><td class="a"><strong>${fmtPlain(soldeDu)}</strong></td><td>Report + net Councils payé (−${pctTot} %)</td></tr>
    <tr><td>Virements DH ${year}</td><td class="a" style="color:var(--green)">−${fmtPlain(totalPaye)}</td><td>${virements.length} virement(s)</td></tr>
    <tr class="tr"><td><strong>Solde ${year}</strong></td><td class="a" style="color:${solde > 0 ? 'var(--yellow)' : 'var(--green)'}"><strong>${fmtSigned(solde, '')}</strong></td><td>${solde > 0 ? 'Amine doit encore ' + fmtPlain(solde) + ' DH à Bob' : solde < 0 ? 'Bob a un excédent de ' + fmtPlain(Math.abs(solde)) + ' DH' : 'Soldé'}</td></tr>
    </tbody></table>`;
  if (d.notes) {
    d.notes.forEach(n => { recoHtml += `<div class="n">${nickText(n)}</div>`; });
  }
  html += collapsible(`Réconciliation Bob ${year} (payé uniquement)`, recoHtml);

  // ---- PRIV: Consolidation gains Amine (commission 10 % + FX seulement) ----
  // Le 3 % Augustin (dispatch) n'est PAS un gain Amine → exclu.
  if (window.PRIV) {
    let gainsHtml = `<table>
      <thead><tr><th>Source du gain Amine</th><th data-sort="num" style="text-align:right">DH</th><th>Détail</th></tr></thead><tbody>
      <tr><td><strong>Commission Amine ${pctA} %</strong></td><td class="a" style="color:var(--green)">${fmtSigned(totalCommAPaid, '')}</td><td>${pctA} % sur ${fmtPlain(totalDHPaid)} DH de Councils HT payés</td></tr>
      <tr><td><strong>Gain FX (Δ taux)</strong></td><td class="a" style="color:var(--green)">${fmtSigned(totalGainFXPaid, '')}</td><td>Taux appliqué inférieur au marché</td></tr>
      <tr class="tr"><td><strong>Total gains Amine</strong></td><td class="a" style="color:var(--green)"><strong>${fmtSigned(totalCommAPaid + totalGainFXPaid, '')}</strong></td><td></td></tr>
      <tr><td>Commission Augustin ${pctM} % (info)</td><td class="a" style="color:var(--muted)">${fmtSigned(totalCommMPaid, '')}</td><td>Dispatch — PAS un gain Amine</td></tr>
      </tbody></table>`;
    html += collapsible(`Consolidation des gains Amine — Bob ${year}`, gainsHtml);
  }

  return html;
}
