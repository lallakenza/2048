// ============================================================
// RENDER-AMINE.JS — Tableau de bord personnel Amine
// Vue consolidée : combien je dois à chacun / on me doit
//
// SECTIONS:
//   1. Augustin (Augustin) — 3 hero cards: Pro / Perso / MAD
//      Calcul local: posNetPro = posEntreprise − virementsEUR − diversPro
//   2. Benoit (Benoit) — 1 hero card: DH
//      Utilise computeBenoitSolde() (render-helpers.js) — même calcul que tab Benoit
//   3. Position globale — 4 colonnes: vs Augustin, vs Benoit, Total EUR, Total MAD
//      MAD combiné = Augustin MAD + Benoit DH (somme directe)
//
// CONVENTIONS:
//   azOwedPro/Perso/MAD = -posNet (positif = Augustin me doit)
//   baOwedDH = -soldeBadre (positif = Benoit me doit)
// ============================================================

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
  const posEntreprise = rtlPaidHT - azcsRecuPaid + az.report2025;
  const posNetPro = posEntreprise - virementsEUR - diversPro - bridgevaleEUR;
  const posNetPerso = posNetPro * PERSO_FACTOR; // Règle universelle
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
  // HERO SECTION — Position globale
  // ============================================================

  // Augustin card
  const azSign = azOwedPro >= 0;
  const azColor = azSign ? 'var(--green)' : 'var(--red)';
  const azCls = azSign ? 'green' : 'red';
  const azLabel = azSign ? 'Augustin me doit' : 'Je dois à Augustin';

  // Benoit card
  const baSign = baOwedDH >= 0;
  const baColor = baSign ? 'var(--green)' : 'var(--red)';
  const baCls = baSign ? 'green' : 'red';
  const baLabel = baSign ? 'Benoit me doit' : 'Je dois à Benoit';

  html += `<div style="font-size:.7rem;font-weight:600;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Situation par personne</div>`;

  // ---- Augustin SECTION ----
  html += `<div style="margin-bottom:20px">`;
  html += `<div style="font-size:.82rem;font-weight:700;margin-bottom:8px;color:var(--text)">Augustin</div>`;
  html += `<div style="font-size:.7rem;color:var(--muted);margin-bottom:8px">Pro → EUR perso = Pro × 0.95 (−5% commission Amine) · Pro → MAD = Pro × ${az.tauxMaroc} (taux fixe)</div>`;

  html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
    <div class="hero-card" style="border-color:${azColor}">
      <div class="hero-label">Si je paye en Pro</div>
      <div class="hero-value ${azCls}" style="font-size:1.2rem">${fmtSigned(Math.round(-posNetPro))}</div>
      <div class="hero-who" style="color:${azColor}">${azLabel}</div>
      <div class="hero-detail">Virement entreprise · montant brut</div>
    </div>
    <div class="hero-card" style="border-color:${azColor}">
      <div class="hero-label">Si je paye en Perso</div>
      <div class="hero-value ${azCls}" style="font-size:1.2rem">${fmtSigned(Math.round(-posNetPerso))}</div>
      <div class="hero-who" style="color:${azColor}">${azLabel}</div>
      <div class="hero-detail">Cash EUR · −5% commission Amine (Pro × 0.95)</div>
    </div>
    <div class="hero-card" style="border-color:${azColor}">
      <div class="hero-label">Si je paye au Maroc</div>
      <div class="hero-value ${azCls}" style="font-size:1.2rem">${posNetPro >= 0 ? '−' : '+'}${Math.abs(Math.round(posNetMAD)).toLocaleString('fr-FR')} MAD</div>
      <div class="hero-who" style="color:${azColor}">${azLabel}</div>
      <div class="hero-detail">Taux fixe : 1 000€ pro = ${(az.tauxMaroc * 1000).toLocaleString('fr-FR')} MAD</div>
    </div>
  </div>`;

  // Augustin breakdown
  html += `<div style="font-size:.72rem;color:var(--muted);padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px">
    <strong>Détail :</strong> Pos. Entreprise = ${fmtSigned(posEntreprise)} (RTL ${fmtPlain(rtlPaidHT)} − AZCS ${fmtPlain(azcsRecuPaid)} + Report ${fmtSigned(az.report2025)}).
    Maroc = ${fmtPlain(Math.round(virementsEUR))}€ pro (${fmtPlain(totalMAD_az)} MAD).
    Divers = ${fmtPlain(Math.round(diversPerso))}€ perso (= ${fmtPlain(Math.round(diversPro))}€ pro).${bridgevaleEUR ? ` Bridgevale = ${fmtPlain(Math.round(bridgevaleEUR))}€ (EUR direct, hors Maroc).` : ''}
    <strong>Net Pro = ${fmtSigned(Math.round(posNetPro))} · Perso = Pro × ${PERSO_FACTOR} = ${fmtSigned(Math.round(posNetPerso))} · MAD = Pro × ${az.tauxMaroc} = ${fmtSigned(Math.round(posNetMAD), 'MAD')}</strong>
  </div>`;
  if (bobCommAugDH > 0) {
    html += `<div style="font-size:.72rem;color:var(--muted);padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px">
      <strong>+ Commission dispatch Bob (3 %) :</strong> Amine reverse à Augustin sa part de la commission Bob → Amine doit <strong>${fmtPlain(Math.round(bobCommAugEUR))} €</strong> / <strong>${fmtPlain(bobCommAugDH)} DH</strong> à Augustin. <strong>Position Augustin totale : ${fmtSigned(Math.round(azOwedPersoTot))} (perso) · ${fmtSigned(Math.round(azOwedMADTot), 'MAD')}.</strong>
    </div>`;
  }
  html += `</div>`;

  // ---- Benoit SECTION ----
  html += `<div style="margin-bottom:20px">`;
  html += `<div style="font-size:.82rem;font-weight:700;margin-bottom:8px;color:var(--text)">Benoit</div>`;
  html += `<div style="font-size:.7rem;color:var(--muted);margin-bottom:8px">Pro × taux appliqué → DH − 10% commission Amine. Taux fixe 2026 : 10.6. Paiement cash DH uniquement.</div>`;

  html += `<div style="display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:10px;max-width:340px">
    <div class="hero-card" style="border-color:${baColor}">
      <div class="hero-label">Position Benoit</div>
      <div class="hero-value ${baCls}" style="font-size:1.3rem">${fmtSigned(-soldeBadre, 'DH')}</div>
      <div class="hero-who" style="color:${baColor}">${baLabel}</div>
      <div class="hero-detail">En cours 2026 · ${paidCouncils26.length} Councils payés</div>
    </div>
  </div>`;

  // Benoit breakdown
  html += `<div style="font-size:.72rem;color:var(--muted);padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px">
    <strong>Détail :</strong> Report 2025 = ${fmtSigned(badrePos.report25, 'DH')}.
    Councils payés 2026 (net −10%) = ${fmtPlain(badrePos.netPaid26)} DH (${badrePos.paidCount} factures).
    Total dû = ${fmtPlain(badrePos.report25 + badrePos.netPaid26)} DH.
    Payé = ${fmtPlain(badrePos.totalPaye26)} DH (${b26.virements.length} virements).
    Solde = ${fmtSigned(soldeBadre, 'DH')}.
  </div>`;
  html += `</div>`;

  // ---- VIREMENTS TABLE ----
  html += `<div style="font-size:.7rem;font-weight:600;color:var(--muted);margin-bottom:6px;margin-top:20px;text-transform:uppercase;letter-spacing:.5px">Historique virements Benoit 2026</div>`;
  html += `<table style="font-size:.8rem"><thead><tr><th>Date</th><th>Bénéficiaire</th><th style="text-align:right">Montant (DH)</th><th>Motif</th></tr></thead><tbody>`;
  b26.virements.forEach(v => {
    html += `<tr><td>${v.date}</td><td>${nick(v.beneficiaire)}</td><td class="a" style="color:var(--green)">${fmtPlain(v.dh)}</td><td style="font-size:.72rem">${v.motif}</td></tr>`;
  });
  html += `<tr class="tr"><td colspan="2"><strong>Total</strong></td><td class="a"><strong>${fmtPlain(badrePos.totalPaye26)} DH</strong></td><td></td></tr></tbody></table>`;

  // ---- BOB SECTION ----
  const bobSign = bobOwedDH >= 0;
  const bobColor = bobSign ? 'var(--green)' : 'var(--red)';
  const bobCls = bobSign ? 'green' : 'red';
  const bobLabel = bobSign ? 'Bob me doit' : 'Je dois à Bob';

  html += `<div style="margin:24px 0 20px">`;
  html += `<div style="font-size:.82rem;font-weight:700;margin-bottom:8px;color:var(--text)">Bob</div>`;
  html += `<div style="font-size:.7rem;color:var(--muted);margin-bottom:8px">Facturé via Bridgevale (UK) · flux international HT (pas de TVA) · commission 13 % (10 % Amine + 3 % Augustin) · dispatch des fonds via Augustin · paiement DH.</div>`;

  html += `<div style="display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:10px;max-width:340px">
    <div class="hero-card" style="border-color:${bobColor}">
      <div class="hero-label">Position Bob</div>
      <div class="hero-value ${bobCls}" style="font-size:1.3rem">${fmtSigned(bobOwedDH, 'DH')}</div>
      <div class="hero-who" style="color:${bobColor}">${bobLabel}</div>
      <div class="hero-detail">En cours 2026 · ${bobPos.paidCount} Councils payés</div>
    </div>
  </div>`;

  html += `<div style="font-size:.72rem;color:var(--muted);padding:8px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px">
    <strong>Détail :</strong> Report 2025 = ${fmtSigned(bobPos.report, 'DH')}.
    Councils payés 2026 (net −13 %) = ${fmtPlain(bobPos.netPaid)} DH (${bobPos.paidCount} factures).
    Payé = ${fmtPlain(bobPos.totalPaye)} DH.
    Solde = ${fmtSigned(soldeBob, 'DH')}.
  </div>`;
  html += `</div>`;

  // ---- COMBINED POSITION ----
  // Convert Benoit DH to EUR — taux fixe Benoit = 10.6 (différent d'Augustin)
  const tauxBadre = 10.6;
  const baOwedEUR = baOwedDH / tauxBadre;
  // Bob : factures € HT converties en DH (~10.6 comme Benoit)
  const tauxBob = 10.6;
  const bobOwedEUR = bobOwedDH / tauxBob;
  const combinedEUR = azOwedPersoTot + baOwedEUR + bobOwedEUR;
  // Combined in MAD: Augustin (incl. commission Bob) + Benoit DH + Bob DH
  const combinedMAD = azOwedMADTot + baOwedDH + bobOwedDH;
  const combSign = combinedEUR >= 0;
  const combColor = combSign ? 'var(--green)' : 'var(--red)';
  const combLabel = combSign ? 'On me doit au total' : 'Je dois au total';

  html += `<div style="margin-top:24px;padding:16px;background:var(--surface2);border-radius:12px;border:1px solid var(--border)">
    <div style="font-size:.7rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Position globale estimée</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:12px;align-items:center">
      <div style="text-align:center">
        <div style="font-size:.72rem;color:var(--muted)">vs Augustin (perso)</div>
        <div style="font-size:1.1rem;font-weight:700;color:${azColor}">${fmtSigned(Math.round(azOwedPersoTot))}</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:.72rem;color:var(--muted)">vs Benoit (DH)</div>
        <div style="font-size:1.1rem;font-weight:700;color:${baColor}">${fmtSigned(-soldeBadre, 'DH')}</div>
        <div style="font-size:.65rem;color:var(--muted)">≈ ${fmtSigned(Math.round(baOwedEUR))} (÷ ${tauxBadre})</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:.72rem;color:var(--muted)">vs Bob (DH)</div>
        <div style="font-size:1.1rem;font-weight:700;color:${bobColor}">${fmtSigned(bobOwedDH, 'DH')}</div>
        <div style="font-size:.65rem;color:var(--muted)">≈ ${fmtSigned(Math.round(bobOwedEUR))} (÷ ${tauxBob})</div>
      </div>
      <div style="text-align:center;padding:10px;border-radius:8px;background:${combSign ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)'}">
        <div style="font-size:.72rem;color:var(--muted)">${combLabel} (EUR)</div>
        <div style="font-size:1.3rem;font-weight:900;color:${combColor}">${fmtSigned(Math.round(combinedEUR))}</div>
      </div>
      <div style="text-align:center;padding:10px;border-radius:8px;background:${combSign ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)'}">
        <div style="font-size:.72rem;color:var(--muted)">${combLabel} (MAD)</div>
        <div style="font-size:1.3rem;font-weight:900;color:${combColor}">${fmtSigned(Math.round(combinedMAD), 'MAD')}</div>
      </div>
    </div>
    <div style="font-size:.65rem;color:var(--muted);margin-top:8px;text-align:center">Position Augustin : taux ${az.tauxMaroc} · Benoit : taux ${tauxBadre} · Bob : taux ${tauxBob}. EUR = base perso (cash).</div>
  </div>`;

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
