// ============================================================
// RENDER-AMINE.JS — Tableau de bord personnel Amine
// Vue consolidée : combien je dois à chacun / on me doit
//
// LAYOUT (v7.22 rebuild):
//   1. Position nette totale — hero + toggle Maroc(cash) / France(EUR)
//      combinedMAD = Σ positions MAD ; combinedEUR = Σ positions EUR
//   2. 3 cartes personnes (poids égal) : Augustin (chips Pro/Perso/Maroc),
//      Benoit, Bob — chacune : position native + équivalent + direction
//   3. Détail des calculs (collapsible) + historique virements Benoit
//
// CONVENTIONS:
//   azOwedPro/Perso/MAD = -posNet (positif = Augustin me doit)
//   baOwedDH = -soldeBadre (positif = Benoit me doit)
//   *Tot = incl. commission dispatch Bob (3 % reversée à Augustin)
//
// BRIDGE: exporte les positions vers localStorage pour le dashboard networth.
//   La logique de calcul (lignes ~30-110) et l'export (bas de fichier) sont
//   load-bearing : ne change QUE la présentation entre les deux.
// ============================================================

// Toggle Maroc/France du hero "Position nette totale" (défini globalement car
// le HTML est injecté via innerHTML → les <script> inline ne s'exécutent pas ;
// on passe donc par un onclick qui appelle cette fonction globale).
window.amPosMode = function (m) {
  var mad = document.getElementById('posVarMad'), eur = document.getElementById('posVarEur');
  var bm = document.getElementById('posBtnMad'), be = document.getElementById('posBtnEur');
  if (!mad || !eur) return;
  mad.style.display = m === 'mad' ? '' : 'none';
  eur.style.display = m === 'eur' ? '' : 'none';
  if (bm && be) {
    bm.style.background = m === 'mad' ? 'var(--accent)' : 'transparent';
    bm.style.color = m === 'mad' ? '#fff' : 'var(--muted)';
    be.style.background = m === 'eur' ? 'var(--accent)' : 'transparent';
    be.style.color = m === 'eur' ? '#fff' : 'var(--muted)';
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
  const tvaAZCS = (b26 && b26.tvaRate) ? b26.tvaRate : 0.21;

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
  // Paiements à Azarkan via Bridgevale (EUR direct, hors Maroc) — nouveau canal
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
  // reçu (Majalis via Badre + Bridgevale) + report. Bridgevale est un paiement
  // B2B à la société AZCS → dans l'Entreprise, pas dans le Net.
  const posEntreprise = rtlPaidHT - azcsRecuPaid - bridgevaleEUR + az.report2025;
  const posNetPro = posEntreprise - virementsEUR - diversPro;
  const posNetPerso = posNetPro * PERSO_FACTOR; // le delta se règle en perso au deal ×0.95
  const posNetMAD = posNetPro * az.tauxMaroc;
  const commissionAmine = Math.round(posNetPro * (1 - PERSO_FACTOR) * 100) / 100;

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
  const badrePos = computeBenoitSolde();
  const soldeBadre = badrePos.solde;
  const paidCouncils26 = b26.councils.filter(c => c.statut === 'ok');
  // soldeBadre > 0 → Amine doit à Benoit. From Amine's perspective: negative (I owe)
  const baOwedDH = -soldeBadre; // positive = Benoit me doit

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
  const tauxBadre = 10.6;
  const tauxBob = 10.6;
  const baOwedEUR = baOwedDH / tauxBadre;
  const bobOwedEUR = bobOwedDH / tauxBob;
  const combinedEUR = azOwedPersoTot + baOwedEUR + bobOwedEUR;
  const combinedMAD = azOwedMADTot + baOwedDH + bobOwedDH;

  // Direction/couleur par personne (basé sur la position TOTALE, incl. dispatch)
  const dir = (v) => ({ pos: v >= 0, color: v >= 0 ? 'var(--green)' : 'var(--red)', cls: v >= 0 ? 'green' : 'red' });
  const azD = dir(azOwedPersoTot), baD = dir(baOwedDH), bobD = dir(bobOwedDH);
  const azLabel = azD.pos ? 'Augustin me doit' : 'Je dois à Augustin';
  const baLabel = baD.pos ? 'Benoit me doit' : 'Je dois à Benoit';
  const bobLabel = bobD.pos ? 'Bob me doit' : 'Je dois à Bob';

  // ---- HERO : Position nette totale + toggle Maroc/France ----
  const madColor = combinedMAD >= 0 ? 'var(--green)' : 'var(--red)';
  const eurColor = combinedEUR >= 0 ? 'var(--green)' : 'var(--red)';
  const madSub = combinedMAD >= 0 ? 'net en ta faveur · si tout se règle en cash / Maroc' : 'je dois au total · si tout se règle en cash / Maroc';
  const eurSub = combinedEUR >= 0 ? 'net en ta faveur · si Augustin est réglé en France (perso)' : 'je dois au total · si Augustin est réglé en France (perso)';
  const brkItem = (name, val, color, suffix) => `<span>${name} <span style="color:${color};font-weight:700">${fmtSigned(Math.round(val), suffix)}</span></span>`;
  const madBreak = brkItem('Augustin', azOwedMADTot, azD.color, 'MAD') + brkItem('Benoit', baOwedDH, baD.color, 'MAD') + brkItem('Bob', bobOwedDH, bobD.color, 'MAD');
  const eurBreak = brkItem('Augustin', azOwedPersoTot, azD.color, '€') + brkItem('Benoit', baOwedEUR, baD.color, '€') + brkItem('Bob', bobOwedEUR, bobD.color, '€');

  html += `<div style="margin-bottom:18px;padding:16px 18px;background:var(--surface2);border-radius:12px;border:1px solid var(--border)">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <div style="font-size:.7rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Position nette — Augustin, Benoit, Bob réunis</div>
      <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;font-size:.7rem">
        <button id="posBtnMad" onclick="amPosMode('mad')" style="border:none;background:var(--accent);color:#fff;padding:5px 12px;cursor:pointer;font-weight:600">Maroc · cash</button>
        <button id="posBtnEur" onclick="amPosMode('eur')" style="border:none;background:transparent;color:var(--muted);padding:5px 12px;cursor:pointer;font-weight:600">France · EUR</button>
      </div>
    </div>
    <div id="posVarMad">
      <div style="font-size:2rem;font-weight:900;line-height:1.1;color:${madColor}">${fmtSigned(Math.round(combinedMAD), 'MAD')}</div>
      <div style="font-size:.75rem;color:var(--muted);margin-top:2px">${madSub}</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:.72rem;color:var(--muted)">${madBreak}</div>
    </div>
    <div id="posVarEur" style="display:none">
      <div style="font-size:2rem;font-weight:900;line-height:1.1;color:${eurColor}">${fmtSigned(Math.round(combinedEUR))}</div>
      <div style="font-size:.75rem;color:var(--muted);margin-top:2px">${eurSub}</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:.72rem;color:var(--muted)">${eurBreak}</div>
    </div>
  </div>`;

  // ---- 3 CARTES PERSONNES (poids égal) ----
  const chip = (txt) => `<span style="border:1px solid var(--border);border-radius:6px;padding:2px 7px;font-size:.62rem;color:var(--muted);white-space:nowrap">${txt}</span>`;

  html += `<div style="font-size:.7rem;font-weight:600;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Situation par personne</div>`;
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px">`;

  // Augustin
  html += `<div class="hero-card" style="border-color:${azD.color};text-align:left">
    <div class="hero-label">Augustin</div>
    <div class="hero-value ${azD.cls}" style="font-size:1.35rem">${fmtSigned(Math.round(azOwedPersoTot))}</div>
    <div class="hero-who" style="color:${azD.color}">${azLabel}</div>
    <div class="hero-detail">≈ ${fmtSigned(Math.round(azOwedMADTot), 'MAD')} · prestations RTL − reversé</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">
      ${chip('Pro ' + fmtSigned(Math.round(azOwedProTot)))}
      ${chip('Perso ' + fmtSigned(Math.round(azOwedPersoTot)))}
      ${chip('Maroc ' + fmtSigned(Math.round(azOwedMADTot), 'MAD'))}
    </div>
  </div>`;

  // Benoit
  html += `<div class="hero-card" style="border-color:${baD.color};text-align:left">
    <div class="hero-label">Benoit</div>
    <div class="hero-value ${baD.cls}" style="font-size:1.35rem">${fmtSigned(-soldeBadre, 'DH')}</div>
    <div class="hero-who" style="color:${baD.color}">${baLabel}</div>
    <div class="hero-detail">≈ ${fmtSigned(Math.round(baOwedEUR))} · councils AZCS − payé</div>
    <div style="font-size:.62rem;color:var(--muted);margin-top:8px">${paidCouncils26.length} councils payés · report 2025 inclus</div>
  </div>`;

  // Bob
  html += `<div class="hero-card" style="border-color:${bobD.color};text-align:left">
    <div class="hero-label">Bob</div>
    <div class="hero-value ${bobD.cls}" style="font-size:1.35rem">${fmtSigned(bobOwedDH, 'DH')}</div>
    <div class="hero-who" style="color:${bobD.color}">${bobLabel}</div>
    <div class="hero-detail">≈ ${fmtSigned(Math.round(bobOwedEUR))} · councils − trop-versé</div>
    <div style="font-size:.62rem;color:var(--muted);margin-top:8px">${bobPos.paidCount} council(s) payé(s) · dispatch via Azarkan</div>
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
    <strong>Benoit :</strong> Report 2025 = ${fmtSigned(badrePos.report25, 'DH')}.
    Councils payés 2026 (net −10%) = ${fmtPlain(badrePos.netPaid26)} DH (${badrePos.paidCount} factures).
    Total dû = ${fmtPlain(badrePos.report25 + badrePos.netPaid26)} DH. Payé = ${fmtPlain(badrePos.totalPaye26)} DH (${b26.virements.length} virements).
    <strong>Solde = ${fmtSigned(soldeBadre, 'DH')}.</strong>
  </div>`;
  detailHtml += `<div style="font-size:.72rem;color:var(--muted);padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px">
    <strong>Bob :</strong> Report 2025 = ${fmtSigned(bobPos.report, 'DH')}.
    Councils payés 2026 (net −13%) = ${fmtPlain(bobPos.netPaid)} DH (${bobPos.paidCount} factures).
    Payé = ${fmtPlain(bobPos.totalPaye)} DH. <strong>Solde = ${fmtSigned(soldeBob, 'DH')}.</strong>
  </div>`;
  detailHtml += `<div style="font-size:.65rem;color:var(--muted);padding:2px 4px">Taux : Augustin ${az.tauxMaroc} · Benoit ${tauxBadre} · Bob ${tauxBob}. Perso EUR = base cash ; MAD = somme native (sans conversion croisée).</div>`;
  html += collapsible('Détail des calculs par personne', detailHtml);

  // ---- HISTORIQUE VIREMENTS BENOIT 2026 ----
  html += `<div style="font-size:.7rem;font-weight:600;color:var(--muted);margin-bottom:6px;margin-top:20px;text-transform:uppercase;letter-spacing:.5px">Historique virements Benoit 2026</div>`;
  html += `<table style="font-size:.8rem"><thead><tr><th>Date</th><th>Bénéficiaire</th><th style="text-align:right">Montant (DH)</th><th>Motif</th></tr></thead><tbody>`;
  b26.virements.forEach(v => {
    html += `<tr><td>${v.date}</td><td>${nick(v.beneficiaire)}</td><td class="a" style="color:var(--green)">${fmtPlain(v.dh)}</td><td style="font-size:.72rem">${v.motif}</td></tr>`;
  });
  html += `<tr class="tr"><td colspan="2"><strong>Total</strong></td><td class="a"><strong>${fmtPlain(badrePos.totalPaye26)} DH</strong></td><td></td></tr></tbody></table>`;

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
        benoit:   { label: 'Benoit',   signedMAD: Math.round(-soldeBadre) },
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
        dh: Math.round(-soldeBadre),             // positive = Benoit me doit, négatif = je lui dois
        tauxBadre: tauxBadre,
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
