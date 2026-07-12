// ============================================================
// RENDER-AMINE.JS — Tableau de bord personnel Amine
// Vue consolidée : combien je dois à chacun / on me doit
//
// LAYOUT (v7.24):
//   1. Position globale estimée — hero unique en DH (combinedMAD, sans toggle)
//   2. 3 cartes personnes (poids égal) en DH : Augustin, Benoit, Bob —
//      position DH + équivalent € + direction
//   3. Diagramme "Flux par personne" (DH perso) : barres Reçu/Envoyé,
//      bouton → vue Position (delta = Envoyé − Reçu). Toggle window.amFluxMode.
//   4. Détail des calculs (collapsible)
//
// CONVENTIONS:
//   azOwedPro/Perso/MAD = -posNet (positif = Augustin me doit)
//   baOwedDH = -soldeBenoit (positif = Benoit me doit)
//   *Tot = incl. commission dispatch Bob (3 % reversée à Augustin)
//
// BRIDGE: exporte les positions vers localStorage pour le dashboard networth.
//   La logique de calcul (lignes ~30-110) et l'export (bas de fichier) sont
//   load-bearing : ne change QUE la présentation entre les deux.
// ============================================================

// Toggle du diagramme "Flux par personne" : bascule entre la vue Reçu/Envoyé
// et la vue Position (delta). Global car le HTML est injecté via innerHTML.
window.amFluxMode = function (m) {
  var f = document.getElementById('fluxVarFlux'), p = document.getElementById('fluxVarPos');
  var bf = document.getElementById('fluxBtnFlux'), bp = document.getElementById('fluxBtnPos');
  if (!f || !p) return;
  f.style.display = m === 'flux' ? '' : 'none';
  p.style.display = m === 'pos' ? '' : 'none';
  if (bf && bp) {
    bf.style.background = m === 'flux' ? 'var(--accent)' : 'transparent';
    bf.style.color = m === 'flux' ? '#fff' : 'var(--muted)';
    bp.style.background = m === 'pos' ? 'var(--accent)' : 'transparent';
    bp.style.color = m === 'pos' ? '#fff' : 'var(--muted)';
  }
};

function renderAmine() {
  let html = '';
  html += `<h2 style="font-size:1.05rem;margin-bottom:6px">Ma Position — Amine</h2>`;
  html += `<p style="color:var(--muted);font-size:.8rem;margin-bottom:18px">Vue consolidée de mes dettes / créances avec chaque personne. Mis à jour en temps réel.</p>`;

  // ============================================================
  // 1. Augustin (Augustin 2026)
  // ============================================================
  const az = DATA.augustin2026;
  const b26 = DATA.benoit2026;

  // RTL paid
  const paidRTL = az.rtl.filter(r => r.statut === 'ok');
  const rtlPaidHT = sum(paidRTL, 'montant');

  // AZCS paid (Majalis → AZCS via Benoit)
  const azcsAll = (b26 && b26.councils) ? b26.councils : [];
  const azcsPaid = azcsAll.filter(c => c.statut === 'ok');
  const azcsRecuPaid = sum(azcsPaid, 'htEUR');

  // Virements Maroc
  const totalMAD_az = sum(az.virementsMaroc, 'dh');
  const virementsEUR = totalMAD_az / az.tauxMaroc;
  // Paiements à Augustin via Bridgevale (EUR direct, hors Maroc) — nouveau canal
  const bridgevaleEUR = sum(az.virementsBridgevale || [], 'eur');

  // Divers : montant = PERSO (cash réel). Pro = montant / PERSO_FACTOR
  // Exception: proOrigin = true → montant IS Pro. Perso = montant × PERSO_FACTOR
  const PERSO_FACTOR = 0.95;
  const diversPerso = az.divers ? az.divers.reduce((s, x) => {
    if (x.proOrigin) return s + Math.round(x.montant * PERSO_FACTOR * 100) / 100;
    return s + x.montant;
  }, 0) : 0;
  const diversPro = az.divers ? az.divers.reduce((s, x) => {
    if (x.proOrigin) return s + x.montant; // montant IS pro
    return s + Math.round(x.montant / PERSO_FACTOR * 100) / 100;
  }, 0) : 0;

  // Positions Augustin
  // Position Entreprise = ce qu'AZCS aurait dû recevoir (RTL) − ce qu'AZCS a
  // reçu (Majalis via Benoit + Bridgevale) + report. Bridgevale est un paiement
  // B2B à la société AZCS → dans l'Entreprise, pas dans le Net.
  const posEntreprise = rtlPaidHT - azcsRecuPaid - bridgevaleEUR + az.report2025;
  const posNetPro = posEntreprise - virementsEUR - diversPro;
  const posNetPerso = posNetPro * PERSO_FACTOR; // le delta se règle en perso au deal ×0.95
  const posNetMAD = posNetPro * az.tauxMaroc;

  // From Amine's perspective: negative delta = Augustin owes Amine
  // posNetPro = -17169 → Augustin doit 17169€ → Amine receivable
  const azOwedPro = -posNetPro;   // positive = Augustin me doit
  const azOwedPerso = -posNetPerso;
  const azOwedMAD = -posNetMAD;

  // Commission Augustin sur le flux Bob (dispatch 3 %) : Amine encaisse l'argent
  // de Bob, retient sa commission, puis VERSE à Augustin sa part de 3 %. Amine
  // doit donc ce montant à Augustin → réduit ce qu'Augustin doit à Amine.
  // Montants au taux Bob (ligne séparée, PAS soumise au facteur 0.95).
  const _bobAz = DATA.bob2026;
  const _bobMRate = _bobAz ? (_bobAz.commissionAugustinRate || 0) : 0;
  const _bobPaidAz = _bobAz ? (_bobAz.councils || []).filter(c => c.statut === 'ok') : [];
  const bobCommAugDH = _bobPaidAz.reduce((s, c) => s + Math.round(Math.round(c.htEUR * (c.tauxApplique || 0)) * _bobMRate), 0);
  const bobCommAugEUR = Math.round(_bobPaidAz.reduce((s, c) => s + c.htEUR * _bobMRate, 0) * 100) / 100;
  // Position Augustin TOTALE = RTL/AZCS + commission Bob due à Augustin
  const azOwedProTot   = azOwedPro   - bobCommAugEUR;
  const azOwedPersoTot = azOwedPerso - bobCommAugEUR;
  const azOwedMADTot   = azOwedMAD   - bobCommAugDH;

  // ============================================================
  // 2. Benoit (Benoit 2026) — uses shared computeBenoitSolde()
  // ============================================================
  const benoitPos = computeBenoitSolde();
  const soldeBenoit = benoitPos.solde;
  const paidCouncils26 = b26.councils.filter(c => c.statut === 'ok');
  // soldeBenoit > 0 → Amine doit à Benoit. From Amine's perspective: negative (I owe)
  const baOwedDH = -soldeBenoit; // positive = Benoit me doit

  // ============================================================
  // 3. BOB (Bob 2026) — uses shared computeBobSolde()
  // ============================================================
  const bobPos = computeBobSolde();
  const soldeBob = bobPos.solde;
  const bobOwedDH = -soldeBob; // positive = Bob me doit

  // ============================================================
  // POSITION NETTE TOTALE (les 3 réunis)
  // ============================================================
  // Chaque relation a sa devise/taux natif :
  //   Augustin  → taux fixe 10.26 (perso EUR = pro × 0.95)
  //   Benoit    → taux fixe 10.6 (cash DH)
  //   Bob       → taux fixe 10.6 (cash DH)
  // combinedMAD : somme MAD native (aucune conversion croisée → cohérent).
  // combinedEUR : Augustin en perso EUR + Benoit/Bob convertis à 10.6.
  const tauxBenoit = 10.6;
  const tauxBob = 10.6;
  const baOwedEUR = baOwedDH / tauxBenoit;
  const bobOwedEUR = bobOwedDH / tauxBob;
  const combinedEUR = azOwedPersoTot + baOwedEUR + bobOwedEUR;
  const combinedMAD = azOwedMADTot + baOwedDH + bobOwedDH;

  // Direction/couleur par personne (basé sur la position TOTALE, incl. dispatch)
  // Code couleur par ÉQUILIBRE : |valeur| en MAD, indépendant du sens (te doit / tu dois).
  //   ≤ 50k = vert (équilibré) · 50–100k = orange · > 100k = rouge.
  // Objectif : ramener chaque position ET le total vers 0 (pas de dettes).
  const balColor = (v) => { const a = Math.abs(v); return a <= 50000 ? 'var(--green)' : a <= 100000 ? '#f59e0b' : 'var(--red)'; };
  const dir = (v) => ({ pos: v >= 0, color: balColor(v) });
  const azD = dir(Math.round(azOwedMADTot)), baD = dir(baOwedDH), bobD = dir(bobOwedDH);
  const azLabel = azD.pos ? 'Augustin me doit' : 'Je dois à Augustin';
  const baLabel = baD.pos ? 'Benoit me doit' : 'Je dois à Benoit';
  const bobLabel = bobD.pos ? 'Bob me doit' : 'Je dois à Bob';

  // ---- HERO : Position nette totale — TOUT EN DIRHAM ----
  // Position globale estimée entièrement en MAD (somme des 3 positions en dirham
  // natif : Augustin ×tauxMaroc, Benoit + Bob en DH). Aucune conversion croisée.
  const madColor = balColor(combinedMAD);
  const madSub = combinedMAD >= 0 ? 'net en ta faveur · les 3 réunis' : 'je dois au total · les 3 réunis';
  const brkItem = (name, val, color) => `<span>${name} <span style="color:${color};font-weight:700">${fmtSigned(Math.round(val), 'MAD')}</span></span>`;
  const madBreak = brkItem('Augustin', azOwedMADTot, azD.color) + brkItem('Benoit', baOwedDH, baD.color) + brkItem('Bob', bobOwedDH, bobD.color);

  html += `<div style="margin-bottom:18px;padding:16px 18px;background:var(--surface2);border-radius:12px;border:1px solid var(--border);text-align:center">
    <div style="font-size:.7rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Position globale estimée — Augustin, Benoit, Bob réunis</div>
    <div style="font-size:2.1rem;font-weight:900;line-height:1.1;color:${madColor}">${fmtSigned(Math.round(combinedMAD), 'MAD')}</div>
    <div style="font-size:.75rem;color:var(--muted);margin-top:2px">${madSub}</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:.72rem;color:var(--muted);justify-content:center">${madBreak}</div>
  </div>`;

  // ---- DIAGRAMME : Flux par personne (reçu / envoyé) ⇄ Position (delta) ----
  // Reçu  = prestation nette de la personne (après commission Amine), en DH perso.
  // Envoyé = ce qu'Amine lui a versé / crédité sur son compte, en DH perso.
  // Position (delta) = Envoyé − Reçu  → + = te doit (trop-versé) · − = tu lui dois.
  // Réconcilie EXACTEMENT avec les positions canoniques (azOwedMADTot, baOwedDH, bobOwedDH).
  // Placé AVANT les cartes ; vue par défaut = Position (delta).
  const fluxRows = [
    { name: 'Augustin', recu: Math.round(rtlPaidHT * az.tauxMaroc) + bobCommAugDH, pos: Math.round(azOwedMADTot), color: azD.color },
    { name: 'Benoit',   recu: benoitPos.report25 + benoitPos.netPaid26,              pos: Math.round(baOwedDH),     color: baD.color },
    { name: 'Bob',      recu: bobPos.report + bobPos.netPaid,                       pos: Math.round(bobOwedDH),    color: bobD.color },
  ].map(r => ({ ...r, envoye: r.recu + r.pos })); // envoyé = reçu + position (delta exact)
  const fluxMax = Math.max(...fluxRows.map(r => Math.max(r.recu, r.envoye)), 1);
  const posMax = Math.max(...fluxRows.map(r => Math.abs(r.pos)), 1);

  const fluxBar = (tag, val, color) => {
    const pct = Math.max(2, Math.round(val / fluxMax * 100));
    return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
      <span style="width:52px;font-size:.66rem;color:var(--muted);flex-shrink:0">${tag}</span>
      <div style="flex:1;height:15px;background:var(--bg);border-radius:4px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};border-radius:4px"></div></div>
      <span style="width:82px;text-align:right;font-size:.68rem;font-variant-numeric:tabular-nums;flex-shrink:0">${fmtPlain(val)} DH</span>
    </div>`;
  };

  let fluxInner = `<div style="display:flex;gap:16px;margin-bottom:10px;font-size:.64rem;color:var(--muted)">
    <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--green);vertical-align:middle;margin-right:4px"></span>Reçu (sa prestation, nette)</span>
    <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#60a5fa;vertical-align:middle;margin-right:4px"></span>Envoyé (versé / crédité)</span>
  </div>`;
  fluxRows.forEach(r => {
    fluxInner += `<div style="margin-bottom:12px">
      <div style="font-size:.75rem;font-weight:700;margin-bottom:4px">${r.name}</div>
      ${fluxBar('Reçu', r.recu, 'var(--green)')}
      ${fluxBar('Envoyé', r.envoye, '#60a5fa')}
    </div>`;
  });

  let posInner = `<div style="font-size:.64rem;color:var(--muted);margin-bottom:10px">Delta = Envoyé − Reçu · <span style="color:var(--green)">+ = te doit</span> · <span style="color:var(--red)">− = tu lui dois</span> · survole une barre pour voir reçu / envoyé</div>`;
  fluxRows.forEach(r => {
    const isPos = r.pos >= 0;
    const w = Math.max(2, Math.round(Math.abs(r.pos) / posMax * 48));
    const barColor = balColor(r.pos);
    const lbl = isPos ? 'te doit' : 'tu lui dois';
    // Bulle au survol : détail reçu / envoyé de la personne (données déjà calculées).
    const tip = `<div class="flux-tip" style="display:none;position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:6px;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:.66rem;white-space:nowrap;z-index:20;box-shadow:0 4px 14px rgba(0,0,0,.4);pointer-events:none"><span style="color:var(--green);font-weight:700">Reçu ${fmtPlain(r.recu)} DH</span> · <span style="color:#60a5fa;font-weight:700">Envoyé ${fmtPlain(r.envoye)} DH</span></div>`;
    posInner += `<div style="margin-bottom:12px;position:relative;cursor:default" onmouseenter="var t=this.querySelector('.flux-tip');if(t)t.style.display='block'" onmouseleave="var t=this.querySelector('.flux-tip');if(t)t.style.display='none'">
      ${tip}
      <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:4px"><span style="font-weight:700">${r.name}</span><span style="color:${barColor};font-variant-numeric:tabular-nums">${fmtSigned(r.pos, 'DH')} · ${lbl}</span></div>
      <div style="position:relative;height:15px;background:var(--bg);border-radius:4px">
        <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--border)"></div>
        <div style="position:absolute;top:1px;bottom:1px;${isPos ? 'left:50%' : 'right:50%'};width:${w}%;background:${barColor};border-radius:3px"></div>
      </div>
    </div>`;
  });

  html += `<div style="margin-bottom:16px;padding:14px 16px;background:var(--surface2);border-radius:12px;border:1px solid var(--border)">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <div style="font-size:.7rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Flux par personne · DH perso (après commission)</div>
      <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;font-size:.7rem">
        <button id="fluxBtnFlux" onclick="amFluxMode('flux')" style="border:none;background:transparent;color:var(--muted);padding:5px 12px;cursor:pointer;font-weight:600">Reçu / Envoyé</button>
        <button id="fluxBtnPos" onclick="amFluxMode('pos')" style="border:none;background:var(--accent);color:#fff;padding:5px 12px;cursor:pointer;font-weight:600">Position (delta)</button>
      </div>
    </div>
    <div id="fluxVarFlux" style="display:none">${fluxInner}</div>
    <div id="fluxVarPos">${posInner}</div>
  </div>`;

  // ---- 3 CARTES PERSONNES (poids égal) ----
  html += `<div style="font-size:.7rem;font-weight:600;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Situation par personne</div>`;
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">`;

  // Augustin — position en DH (comme un virement Maroc, comme Benoit/Bob)
  html += `<div class="hero-card" style="border-color:${azD.color};text-align:left">
    <div class="hero-label">Augustin</div>
    <div class="hero-value" style="font-size:1.35rem;color:${azD.color}">${fmtSigned(Math.round(azOwedMADTot), 'DH')}</div>
    <div class="hero-who" style="color:${azD.color}">${azLabel}</div>
    <div class="hero-detail">≈ ${fmtSigned(Math.round(azOwedPersoTot))} perso · prestations RTL − reversé</div>
    <div style="font-size:.62rem;color:var(--muted);margin-top:8px">Pro ${fmtSigned(Math.round(azOwedProTot))} · Perso ${fmtSigned(Math.round(azOwedPersoTot))}</div>
  </div>`;

  // Benoit
  html += `<div class="hero-card" style="border-color:${baD.color};text-align:left">
    <div class="hero-label">Benoit</div>
    <div class="hero-value" style="font-size:1.35rem;color:${baD.color}">${fmtSigned(-soldeBenoit, 'DH')}</div>
    <div class="hero-who" style="color:${baD.color}">${baLabel}</div>
    <div class="hero-detail">≈ ${fmtSigned(Math.round(baOwedEUR))} · councils AZCS − payé</div>
    <div style="font-size:.62rem;color:var(--muted);margin-top:8px">${paidCouncils26.length} councils payés · report 2025 inclus</div>
  </div>`;

  // Bob
  html += `<div class="hero-card" style="border-color:${bobD.color};text-align:left">
    <div class="hero-label">Bob</div>
    <div class="hero-value" style="font-size:1.35rem;color:${bobD.color}">${fmtSigned(bobOwedDH, 'DH')}</div>
    <div class="hero-who" style="color:${bobD.color}">${bobLabel}</div>
    <div class="hero-detail">≈ ${fmtSigned(Math.round(bobOwedEUR))} · councils − trop-versé</div>
    <div style="font-size:.62rem;color:var(--muted);margin-top:8px">${bobPos.paidCount} council(s) payé(s) · dispatch via Augustin</div>
  </div>`;

  html += `</div>`;

  // ---- DÉTAIL DES CALCULS (collapsible) ----
  let detailHtml = '';
  detailHtml += `<div style="font-size:.72rem;color:var(--muted);padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px">
    <strong>Augustin :</strong> Pos. Entreprise = ${fmtSigned(posEntreprise)} (RTL ${fmtPlain(rtlPaidHT)} − AZCS ${fmtPlain(azcsRecuPaid)}${bridgevaleEUR ? ` − Bridgevale ${fmtPlain(Math.round(bridgevaleEUR))}` : ''} + Report ${fmtSigned(az.report2025)}).
    Maroc = ${fmtPlain(Math.round(virementsEUR))}€ pro (${fmtPlain(totalMAD_az)} MAD).
    Divers = ${fmtPlain(Math.round(diversPerso))}€ perso (= ${fmtPlain(Math.round(diversPro))}€ pro).
    <strong>Net Pro = ${fmtSigned(Math.round(posNetPro))} · Perso = Pro × ${PERSO_FACTOR} = ${fmtSigned(Math.round(posNetPerso))} · MAD = Pro × ${az.tauxMaroc} = ${fmtSigned(Math.round(posNetMAD), 'MAD')}</strong>
  </div>`;
  if (bobCommAugDH > 0) {
    detailHtml += `<div style="font-size:.72rem;color:var(--muted);padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px">
      <strong>+ Commission dispatch Bob (3 %) :</strong> Amine reverse à Augustin sa part de la commission Bob → Amine doit <strong>${fmtPlain(Math.round(bobCommAugEUR))} €</strong> / <strong>${fmtPlain(bobCommAugDH)} DH</strong> à Augustin. <strong>Position Augustin totale : ${fmtSigned(Math.round(azOwedPersoTot))} (perso) · ${fmtSigned(Math.round(azOwedMADTot), 'MAD')}.</strong>
    </div>`;
  }
  detailHtml += `<div style="font-size:.72rem;color:var(--muted);padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px">
    <strong>Benoit :</strong> Report 2025 = ${fmtSigned(benoitPos.report25, 'DH')}.
    Councils payés 2026 (net −10%) = ${fmtPlain(benoitPos.netPaid26)} DH (${benoitPos.paidCount} factures).
    Total dû = ${fmtPlain(benoitPos.report25 + benoitPos.netPaid26)} DH. Payé = ${fmtPlain(benoitPos.totalPaye26)} DH (${b26.virements.length} virements).
    <strong>Solde = ${fmtSigned(soldeBenoit, 'DH')}.</strong>
  </div>`;
  detailHtml += `<div style="font-size:.72rem;color:var(--muted);padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px">
    <strong>Bob :</strong> Report 2025 = ${fmtSigned(bobPos.report, 'DH')}.
    Councils payés 2026 (net −13%) = ${fmtPlain(bobPos.netPaid)} DH (${bobPos.paidCount} factures).
    Payé = ${fmtPlain(bobPos.totalPaye)} DH. <strong>Solde = ${fmtSigned(soldeBob, 'DH')}.</strong>
  </div>`;
  detailHtml += `<div style="font-size:.65rem;color:var(--muted);padding:2px 4px">Taux : Augustin ${az.tauxMaroc} · Benoit ${tauxBenoit} · Bob ${tauxBob}. Perso EUR = base cash ; MAD = somme native (sans conversion croisée).</div>`;
  html += collapsible('Détail des calculs par personne', detailHtml);

  // ── BRIDGE: Export positions to localStorage for networth dashboard ──
  // Both sites share lallakenza.github.io origin → same localStorage.
  // networth/js/engine.js reads 'facturation_positions' to auto-update
  // Amine's facturation créances/dettes instead of hardcoded values.
  try {
    localStorage.setItem('facturation_positions', JSON.stringify({
      updatedAt: new Date().toISOString(),
      // Schéma "counterparts" (préféré par networth) : 1 entrée par tiers,
      // signedMAD = position en MAD natif (+ = me doit / créance, − = je dois / dette).
      // Augustin inclut sa commission dispatch Bob. networth somme les 3
      // automatiquement (créances/dettes + NW via combined.mad).
      counterparts: {
        augustin: { label: 'Augustin', signedMAD: Math.round(azOwedMADTot) },
        benoit:   { label: 'Benoit',   signedMAD: Math.round(-soldeBenoit) },
        bob:      { label: 'Bob',      signedMAD: Math.round(bobOwedDH) },
      },
      augustin: {
        // Inclut la commission dispatch Bob (Amine doit sa part 3% à Augustin)
        // en plus de la position RTL/AZCS. Positif = Augustin me doit.
        proEUR: Math.round(azOwedProTot),
        persoEUR: Math.round(azOwedPersoTot),
        mad: Math.round(azOwedMADTot),
        tauxMaroc: az.tauxMaroc,
        bobCommissionDH: bobCommAugDH,           // part commission Bob reversée à Augustin (info)
      },
      benoit: {
        dh: Math.round(-soldeBenoit),             // positive = Benoit me doit, négatif = je lui dois
        tauxBenoit: tauxBenoit,
      },
      bob: {
        dh: Math.round(bobOwedDH),               // positive = Bob me doit, négatif = je lui dois
        tauxBob: tauxBob,
      },
      combined: {
        // 'combined.mad' = somme des 3 positions (Augustin incl. commission Bob
        // + Benoit + Bob). networth lit cette clé pour le NW (amineFacturationNet).
        eur: Math.round(combinedEUR),            // net position EUR (perso)
        mad: Math.round(combinedMAD),            // net position MAD
      },
    }));
  } catch(e) { /* localStorage unavailable — ignore silently */ }

  return html;
}
