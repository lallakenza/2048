#!/usr/bin/env node
// ============================================================
// ENCRYPT.JS — Build script: chiffre TOUTES les données
// Usage: node encrypt.js
// Produit:
//   data-enc.js      → ENCRYPTED_FULL (TIGRE) + ENCRYPTED_BENOIT (COUPA)
//   data-priv.enc.js → ENCRYPTED_PRIV (BINGA private overlay)
//
// ARCHITECTURE & CONVENTIONS:
// ---------------------------
// Azarkan (Augustin) 2026:
//   - tauxMaroc = 10.26 (= PERSO_FACTOR × 10.8 = 0.95 × 10.8)
//   - PERSO_FACTOR = 0.95 → 1000€ pro = 950€ perso = 10 260 MAD
//   - Positions: Pro → Perso = Pro × 0.95 → MAD = Pro × 10.26
//   - report2025 = -1683 (carryforward clôture 2025)
//   - Divers: montant = PERSO (cash réel). Pro = montant ÷ 0.95
//     Si proOrigin: true → montant = PRO, Perso = montant × 0.95
//     (actuellement aucun item n'a proOrigin)
//
// Benoit (Badre) 2026:
//   - commissionRate = 0.10 (10% Amine), tvaRate = 0.21
//   - Tracking en DH. Taux appliqué = 10.6 (fixe 2026)
//   - Position = report2025 + netPaid26 - totalPaye26
//   - Fonction partagée: computeBenoitSolde() dans render-helpers.js
//
// Divers 2026 (3 transactions perso):
//   1. Oumaima → Azarkan: +800€ (remboursement reçu)
//   2. Azarkan → Amine (via Zakaria): -1200€ (avance)
//   3. Amine → Azarkan (via Nezha → Hanane): +6000€ (virement perso)
//   Net = 5 600€ perso
// ============================================================

const crypto = require('crypto');
const fs = require('fs');

const SALT = 'facturation-augustin-2025'; // fixed salt for reproducibility

// ============================================================
// NICK — real→alias mapping. Lives ONLY inside the encrypted blobs (injected at
// runtime by render-helpers.applyNick). NEVER hardcode real names in the public
// served JS. Each blob carries ONLY the aliases its tab needs (isolation): the
// Benoit blob has no Bob entries and vice-versa, so an authenticated counterparty
// can't decode the others' identities.
//   map     = exact-match lookup for nick(beneficiaire)
//   replace = ordered free-text patterns for nickText() (LONGEST match first)
// Family first-names (Amine/Nezha/Hanane) pass through unchanged (no entry needed).
// ============================================================
const _NICK_AUG_MAP = { 'jean augustin': 'Augustin', 'mohammed azarkan': 'Augustin', 'mohammed': 'Augustin', 'azarkan': 'Augustin' };
const _NICK_BEN_MAP = { 'benoit chevalier': 'Benoit', 'badrecheikh elmouksit': 'Benoit', 'badre': 'Benoit' };
const _NICK_BOB_MAP = { 'hamza el azzouzi': 'Bob', 'hamza': 'Bob', 'zor consulting srl': 'Molenbeck', 'zor consulting': 'Molenbeck', 'zor': 'Molenbeck' };
const _NICK_AUG_REP = [['Mohammed Azarkan', 'Augustin'], ['Azarkan', 'Augustin'], ['Mohammed', 'Augustin']];
const _NICK_BEN_REP = [['Badrecheikh Elmouksit', 'Benoit'], ['Badrecheikh', 'Benoit'], ['Badre', 'Benoit']];
const _NICK_BOB_REP = [['Hamza El Azzouzi', 'Bob'], ['Hamza', 'Bob'], ['ZOR Consulting SRL', 'Molenbeck'], ['ZOR Consulting', 'Molenbeck'], ['ZOR', 'Molenbeck']];
const _byLenDesc = (a, b) => b[0].length - a[0].length;
const NICK_FULL = {
  map: Object.assign({}, _NICK_AUG_MAP, _NICK_BEN_MAP, _NICK_BOB_MAP),
  replace: [].concat(_NICK_BEN_REP, _NICK_BOB_REP, _NICK_AUG_REP).sort(_byLenDesc),
};
const NICK_BEN = { map: Object.assign({}, _NICK_AUG_MAP, _NICK_BEN_MAP), replace: [].concat(_NICK_BEN_REP, _NICK_AUG_REP).sort(_byLenDesc) };
const NICK_BOB = { map: Object.assign({}, _NICK_AUG_MAP, _NICK_BOB_MAP), replace: [].concat(_NICK_BOB_REP, _NICK_AUG_REP).sort(_byLenDesc) };

// ============================================================
// FULL PUBLIC DATA (replaces data.js — now encrypted)
// ============================================================
const FULL_DATA = {
  _nick: NICK_FULL,

  // ==================== AUGUSTIN 2025 ====================
  augustin2025: {
    title: "Clôture Augustin 2025 — Réconciliation mois par mois",
    subtitle: "Basé sur le fichier Excel Augustin v2 (mis à jour). Pour chaque mois : revenus RTL, dépenses déclarées (B+Y+M, Maroc, Divers), virements réels, et commentaires.",
    // tauxMaroc = taux contractuel négocié avec Augustin (deal interne).
    // Ce N'EST PAS le taux marché EUR/MAD — c'est le ratio convenu entre
    // Amine et Augustin pour comptabiliser les virements Maroc côté pro.
    // Renégocié chaque année : 10,000 en 2025 → 10,260 en 2026.
    tauxMaroc: 10,
    rtl: [
      { ref: "INVRTL001", periode: "Jan", jours: 12, montant: 10200, datePaiement: "20/03", recu: 10200 },
      { ref: "INVRTL002", periode: "Fév", jours: 20, montant: 17000, datePaiement: "17/04", recu: 17000 },
      { ref: "INVRTL003", periode: "Mar", jours: 20, montant: 17000, datePaiement: "22/05", recu: 17000 },
      { ref: "INVRTL004+5", periode: "Avr+Mai", jours: 40, montant: 34000, datePaiement: "17/07", recu: 34000 },
      { ref: "INVRTL006", periode: "Jun", jours: 18, montant: 15300, datePaiement: "07/08", recu: 15300 },
      { ref: "INVRTL007", periode: "Jul", jours: 11, montant: 9350, datePaiement: "18/09", recu: 9350 },
      { ref: "INVRTL008", periode: "Aoû", jours: 24, montant: 20400, datePaiement: "23/10", recu: 20400 },
      { ref: "INVRTL009", periode: "Sep", jours: 13, montant: 11050, datePaiement: "27/11", recu: 11050 },
      { ref: "INVRTL010+11", periode: "Oct+Nov", jours: 45, montant: 38250, datePaiement: "08/01/26", recu: 38250 },
      { ref: "INVRTL012", periode: "Déc", jours: 30.5, montant: 25925, datePaiement: "29/01/26", recu: 25925 },
    ],
    mois: [
      { nom: "Janvier", actuals: 18700, bym: 0, maroc: 0, divers: 0, commentaire: "Actuals comptabilisés (facture RTL Janvier) mais aucune dépense dans l'Excel. Pas de virement Maroc ce mois-ci. Excédent reporté.", badge: "i", badgeText: "ℹ" },
      { nom: "Février", actuals: 17000, bym: 16000, maroc: 1000, divers: 400, commentaire: "Maroc 1 000€ ✓ (10 000 DH envoyés, confirmé). B+Y+M = 16 000 (Baraka 10k+6k EBS). <strong>Divers 400€ = vol pour Augustin ✓</strong>.", badge: "ok", badgeText: "✓ OK", diversVerifie: true },
      { nom: "Mars", actuals: 17850, bym: 17600, maroc: 1000, divers: 0, commentaire: "B+Y+M = 17 600 (Baraka 17.6k EBS). Maroc = 1 000€ ✓ (mère L'Hajja → Augustin 10k DH le 28/03). Mois légèrement déficitaire.", badge: "ok", badgeText: "✓ OK" },
      { nom: "Avril", actuals: 16150, bym: 39200, maroc: 1000, divers: 0, commentaire: "B+Y+M = 39 200 (Baraka 16.8k+3.2k+19.2k EBS). C'est un rattrapage de plusieurs factures Baraka payées en même temps. Maroc ✓ (mère 10k DH le 14/04). Gros déficit mensuel compensé par Jan+Mai.", badge: "i", badgeText: "⚡ Gros mois", bymHighlight: true },
      { nom: "Mai", actuals: 16150, bym: 5400, maroc: 1000, divers: 0, commentaire: "B+Y+M = 5 400 (Ycarré 5.4k EBS). Maroc ✓ (mère 10k DH le 20/05). Mois excédentaire, compense Avril.", badge: "ok", badgeText: "✓ OK" },
      { nom: "Juin", actuals: 16150, bym: 10800, maroc: 1000, divers: 1240, commentaire: "B+Y+M = 10 800 (Ycarré 5.4k+5.4k EBS remboursé en 2 paiements). Maroc ✓ (mère 10k DH le 13/06). <strong>Divers 1 240€ = vol pour Augustin ✓</strong>.", badge: "ok", badgeText: "✓ OK", diversVerifie: true },
      { nom: "Juillet", actuals: 12750, bym: 12000, maroc: 1000, divers: 0, commentaire: "B+Y+M = 12 000 (Ycarré 12k EBS). Maroc ✓ (perso 10k DH le 03/07). Léger déficit.", badge: "ok", badgeText: "✓ OK" },
      { nom: "Août", actuals: 11050, bym: 11250, maroc: 3000, divers: 0, commentaire: "Augustin a corrigé Maroc de 1k→3k. Matche les 30k DH (10k le 01/08 + 20k le 15/08). B+Y+M = 11 250 (Councils 5.625k×2 EBS).", badge: "ok", badgeText: "✓ Corrigé v2", marocCorrige: true },
      { nom: "Septembre", actuals: 18700, bym: 5313, maroc: 1000, divers: 1130, commentaire: "Augustin a corrigé Maroc de 3k→1k. Matche les 10k DH (05/09). B+Y+M = 5 312.5 (Councils 5.3125k EBS). <strong>Divers 1 130€ = iPhone 1 305,41 USD (09/10 EBS) au taux 0,8648 ✓</strong>. Gros excédent.", badge: "ok", badgeText: "✓ Corrigé v2", marocCorrige: true, diversVerifie: true },
      { nom: "Octobre", actuals: 19550, bym: 11900, maroc: 6000, divers: 0, commentaire: "Augustin a reclassé les 2×5k Divers → Maroc (1k→6k). Matche les 60k DH (10k le 03/10 + 50k le 15/10). B+Y+M = 11 900 (Councils 5k + Ycarré 6.9k EBS).", badge: "ok", badgeText: "✓ Corrigé v2", marocCorrige: true },
      { nom: "Novembre", actuals: 17000, bym: 14600, maroc: 1000, divers: 300, commentaire: "B+Y+M = 14 600 (Councils 5k + Ycarré 9.6k EBS). Maroc ✓ (10k DH le 03/11). <strong>Divers net 300€ = 1 800€ (3 virements EBS 09/11+12/11+18/11) − 1 500€ (Prêt EBS 15/12) ✓</strong>.", badge: "ok", badgeText: "✓ OK", diversVerifie: true },
      { nom: "Décembre", actuals: 17425, bym: 13225, maroc: 6000, divers: -1900, commentaire: "Augustin a corrigé Maroc 1k→6k et B+Y+M 12 725→13 225 (+500€ Councils). Matche les 60k DH (10k le 03/12 + 50k le 19/12). <strong>Divers net −1 900€ = 600€ (virement EBS 08/12) − 2 500€ (Prêt EBS 04/12) ✓</strong>.", badge: "ok", badgeText: "✓ Corrigé v2", marocCorrige: true, diversVerifie: true },
    ],
    ycarre: [
      { date: "02/06/2025", montant: 5400 },
      { date: "18/06/2025", montant: 10800 },
      { date: "06/08/2025", montant: 12000 },
      { date: "11/11/2025", montant: 6900 },
      { date: "04/12/2025", montant: 9600 },
      { date: "31/12/2025", montant: 9600 },
    ],
    councils: [
      { date: "18/08/2025", excelHT: 5625, ebsHT: 5625 },
      { date: "12/09/2025", excelHT: 5625, ebsHT: 5625 },
      { date: "29/09/2025", excelHT: 5313, ebsHT: 5313 },
      { date: "13/11/2025", excelHT: 5000, ebsHT: 5000 },
      { date: "11/12/2025", excelHT: 5000, ebsHT: 5000 },
      { date: "31/12/2025", excelHT: 3625, ebsHT: 3625, note: "corrigé v2" },
    ],
    baraka: [
      { date: "14/03/2025", montant: 10000 },
      { date: "27/03/2025", montant: 6000 },
      { date: "30/03/2025", montant: 17600 },
      { date: "04/05/2025", montant: 16800 },
      { date: "12/05/2025", montant: 3200 },
      { date: "19/05/2025", montant: 19200 },
    ],
    virementsMaroc: [
      { mois: "Février", excelEUR: 1000, detail: "Confirmé (hors historique)", totalDH: 10000 },
      { mois: "Mars", excelEUR: 1000, detail: "28/03 — Mère (L'Hajja) → Augustin", totalDH: 10000 },
      { mois: "Avril", excelEUR: 1000, detail: "14/04 — Mère (L'Hajja) → Augustin", totalDH: 10000 },
      { mois: "Mai", excelEUR: 1000, detail: "20/05 — Mère (L'Hajja) → Augustin", totalDH: 10000 },
      { mois: "Juin", excelEUR: 1000, detail: "13/06 — Mère (L'Hajja) → Augustin", totalDH: 10000 },
      { mois: "Juillet", excelEUR: 1000, detail: "03/07 → Augustin", totalDH: 10000 },
      { mois: "Août", excelEUR: 3000, detail: "01/08 → 10k + 15/08 → 20k", totalDH: 30000, corrige: true },
      { mois: "Septembre", excelEUR: 1000, detail: "05/09 → Augustin", totalDH: 10000, corrige: true },
      { mois: "Octobre", excelEUR: 6000, detail: "03/10 → 10k + 15/10 → 50k", totalDH: 60000, corrige: true },
      { mois: "Novembre", excelEUR: 1000, detail: "03/11 → Augustin", totalDH: 10000 },
      { mois: "Décembre", excelEUR: 6000, detail: "03/12 → 10k + 19/12 → 50k", totalDH: 60000, corrige: true },
    ],
    divers: [
      { mois: "Février", date: "—", montant: 400, label: "Vol pour Augustin", preuve: "ok", preuveText: "✓ EBS" },
      { mois: "Juin", date: "—", montant: 1240, label: "Vol pour Augustin", preuve: "ok", preuveText: "✓ EBS" },
      { mois: "Septembre", date: "09/10/2025", montant: 1130, label: "iPhone 1 305,41 USD", preuve: "ok", preuveText: "✓ EBS" },
      { mois: "Novembre", date: "12/11/2025", montant: 700, label: "Virement instantané", preuve: "ok", preuveText: "✓ EBS" },
      { mois: "Novembre", date: "18/11/2025", montant: 500, label: "Virement instantané", preuve: "ok", preuveText: "✓ EBS" },
      { mois: "Novembre", date: "09/11/2025", montant: 600, label: "Virement instantané (Seq.1229)", preuve: "ok", preuveText: "✓ EBS" },
      { mois: "Novembre", date: "15/12/2025", montant: -1500, label: "Prêt (Seq.1404)", preuve: "ok", preuveText: "✓ EBS" },
      { mois: "Décembre", date: "08/12/2025", montant: 600, label: "Virement instantané (Seq.1373)", preuve: "ok", preuveText: "✓ EBS" },
      { mois: "Décembre", date: "04/12/2025", montant: -2500, label: "Prêt (Seq.1362)", preuve: "ok", preuveText: "✓ EBS" },
    ],
    diversVerifie: 9170,
    diversNonVerifie: 0,
    insights: [
      { type: "pass", titre: "✅ Augustin a corrigé 4 erreurs MAD entre v1 et v2", desc: "Août (1k→3k ✓), Septembre (3k→1k ✓), Octobre (1k→6k + suppression 2×5k Divers ✓), Décembre (1k→6k ✓). Cela montre qu'Augustin reconnaît les écarts quand confronté aux preuves bancaires. Le Maroc passe de 13 000€ → 23 000€, match parfait avec les virements réels (23 000€ Fév-Déc)." },
      { type: "pass", titre: "✅ Councils HT : écart de 500€ corrigé (v1 → v2)", desc: "Augustin a corrigé le B+Y+M de Décembre de 12 725€ → 13 225€, intégrant les 500€ Councils HT manquants du 31/12. Les 6 paiements Councils matchent désormais 100% l'EBS." },
      { type: "pass", titre: "✅ Virements Maroc : 23 000€ — match parfait Excel = Réel", desc: "Tous les virements Maroc Fév-Déc matchent parfaitement l'Excel (23 000€). Pas de virement en Janvier. 11 mois sur 11 vérifiés, 0€ d'écart." },
      { type: "pass", titre: "✅ Divers : 100% vérifiés EBS — 9 170€ de transactions (9 opérations)", desc: "<strong>Fév 400€</strong> = vol ✓. <strong>Juin 1 240€</strong> = vol ✓. <strong>Sep 1 130€</strong> = iPhone ✓. <strong>Nov 1 800€</strong> = 3 virements EBS ✓. <strong>Nov −1 500€</strong> = Prêt EBS ✓. <strong>Déc 600€</strong> = virement EBS ✓. <strong>Déc −2 500€</strong> = Prêt EBS ✓. Net total : 1 170€. Zéro reste sans preuve." },
      { type: "neutral", titre: "💸 Flux cash direct 2025 : Amine 2 400€ → Augustin / Augustin 4 000€ → Amine", desc: "<strong>Amine → Augustin :</strong> 600€ (09/11) + 700€ (12/11) + 500€ (18/11) + 600€ (08/12) = <strong>2 400€</strong>.<br><strong>Augustin → Amine (prêts) :</strong> 2 500€ (04/12) + 1 500€ (15/12) = <strong>4 000€</strong>.<br>Solde cash : <strong>−1 600€</strong> (Augustin a envoyé 1 600€ de plus).<br><em>À part — achats pour Augustin :</em> vols 400€ (Fév) + 1 240€ (Jun) + iPhone 1 130€ (Sep) = <strong>2 770€</strong>." },
      { type: "neutral", titre: "📊 Ycarré + Baraka + Councils : 157 288€ — 100% vérifié EBS", desc: "Les 3 catégories avec preuves EBS (18 paiements au total) matchent parfaitement. Ycarré 54 300€ (6/6), Baraka 72 800€ (6/6), Councils HT 30 188€ (6/6 après correction v2)." },
      { type: "pass", titre: "✅ Factures RTL 2025 : 198 475€ — 12/12 rapprochées, 0€ d'écart", desc: "Les 12 factures RTL (INVRTL001 à INVRTL012) sont toutes confirmées dans le CSV IFX. Les paiements combinés (INVRTL004+005 en Juillet, INVRTL010+011 en Janvier 2026) sont correctement identifiés. Aucun revenu manquant." },
    ],
  },

  // ==================== AUGUSTIN 2026 ====================
  augustin2026: {
    title: "Augustin 2026 — En cours",
    report2025: -1683,
    // tauxMaroc = deal contractuel 2026 avec Augustin : 1 000€ pro = 10 260 MAD.
    // Différent du taux 2025 (10) — la deal est renégociée chaque année.
    // Le marché EUR/MAD est typiquement ~10,5–10,8 en 2026 ; ce ratio reflète
    // un accord interne, pas une conversion FX.
    tauxMaroc: 10.26,
    // ⚠️ DOUBLE-COMPTE : certains virements bancaires vers « Mohammed Azarkan » sont
    // en réalité des DISPATCH pour Hamza (Bob), PAS des virements Maroc d'Augustin.
    // Ils vivent dans bob2026.virements (dispatchFor:'bob'). Exclus connus (→ Hamza) :
    //   11/06/2026 20 000 + 11/06/2026 10 000 + 12/06/2026 15 000 = 45 000 DH.
    // NE PAS les ajouter ici. (Les virements Maroc d'Augustin vont à « Jean Augustin ».)
    virementsMaroc: [
      { date: "02/01/2026", beneficiaire: "Jean Augustin", dh: 10000 },
      { date: "03/02/2026", beneficiaire: "Jean Augustin", dh: 10000 },
      { date: "03/03/2026", beneficiaire: "Jean Augustin", dh: 30000 },
      { date: "02/04/2026", beneficiaire: "Jean Augustin", dh: 10000 },
      { date: "06/05/2026", beneficiaire: "Jean Augustin", dh: 20000 },
      { date: "05/06/2026", beneficiaire: "Jean Augustin", dh: 10000 },
      { date: "20/06/2026", beneficiaire: "Jean Augustin", dh: 50000 },
      { date: "12/07/2026", beneficiaire: "Jean Augustin", dh: 50000 },
      // Releve Attijarinet du 27/08/2026 : 2 virements « VIR.EMIS WEB VERS AZARKAN »
      // absents du suivi. Dates = dates de valeur bancaires (le releve accuse
      // 1 a 3 j de decalage sur la date d ordre, cf. les 6 autres lignes recoupees).
      { date: "17/07/2026", beneficiaire: "Jean Augustin", dh: 10000 },
      { date: "03/08/2026", beneficiaire: "Jean Augustin", dh: 50000 },
    ],
    // Paiements à Azarkan via Bridgevale (société UK d'Amine) — EN EUR, canal
    // distinct des virements Maroc (DH). Azarkan facture Bridgevale (AZCS####)
    // et Amine règle en EUR, car Azarkan refuse les paiements depuis Dubai
    // (Bairok). C'est Amine qui rend une partie du CA RTL à Azarkan, SANS
    // commission. Effet position : soustrait de posNetPro comme un virement
    // (mais montant EUR direct, PAS converti au tauxMaroc).
    virementsBridgevale: [
      { ref: "AZCS0010", date: "02/07/2026", eur: 2400, motif: "Prestation SAP Juin 2026 — paiement à Azarkan via Bridgevale" },
    ],
    rtl: [
      { ref: "INVRTL013", periode: "Janvier", jours: 11, montant: 9350,  dateFacture: "31/12/2025", dateDue: "01/03/2026", statut: "ok", statutText: "Paid" },
      { ref: "INVRTL014", periode: "Février", jours: 20, montant: 17000, dateFacture: "01/03/2026", dateDue: "01/04/2026", statut: "ok", statutText: "Paid 01/04" },
      { ref: "INVRTL015", periode: "Mars",    jours: 20, montant: 17000, dateFacture: "01/04/2026", dateDue: "01/05/2026", statut: "ok", statutText: "Paid 13/05" },
      { ref: "INVRTL016", periode: "Avril",   jours: 15, montant: 12750, dateFacture: "04/05/2026", dateDue: "04/06/2026", statut: "ok", statutText: "Paid 10/06" },
      // INVRTL017 : payée le 22/07/2026 — payment advice CLT-UFA 1700002285
      // (doc 1600001939, 15 300,00 EUR, reçu dans bairok.consulting le 17/07/2026).
      { ref: "INVRTL017", periode: "Mai",     jours: 18, montant: 15300, dateFacture: "04/06/2026", dateDue: "04/07/2026", statut: "ok", statutText: "Paid 22/07" },
      { ref: "INVRTL018", periode: "Juin",    jours: 19, montant: 16150, dateFacture: "03/07/2026", dateDue: "03/08/2026", statut: "ok", statutText: "Paid 26/08" },
      // INVRTL019 : facture émise le 05/08/2026 (PO 4500619649, 19 j × 850 €).
      // Période Juillet 2026 (mail « Material for invoicing July 2026 », 05/08).
      // Aucun payment advice à ce jour → en attente.
      { ref: "INVRTL019", periode: "Juillet", jours: 19, montant: 16150, dateFacture: "05/08/2026", dateDue: "05/09/2026", statut: "w",  statutText: "Invoiced" },
    ],
    divers: [
      { label: "Oumaima → Azarkan (remboursement reçu 2026)", montant: 800 },
      { label: "Azarkan → Amine (via Zakaria — avance 2026)", montant: -1200 },
      { label: "Amine → Azarkan (via Nezha → Hanane) — virement perso", montant: 6000 },
    ],
    insights: [
      { type: "neutral", titre: "💸 Flux cash 2026 : 3 transactions Amine ↔ Azarkan", desc: "<strong>Reçu d'Azarkan :</strong> Oumaima +800€ · Zakaria −1 200€ = <strong>−400€ net</strong>.<br><strong>Envoyé à Azarkan :</strong> 6 000€ via Nezha → Hanane (virement perso).<br><strong>Net perso :</strong> +800 − 1 200 + 6 000 = <strong>5 600€</strong>." },
      { type: "pass", titre: "📄 Factures RTL 2026 : 6 payées, 1 émise (en attente)", desc: "INVRTL013 (Jan, 11j, 9 350€ HT) payée. INVRTL014 (Fév, 20j, 17 000€ HT) payée le 01/04/2026 (payment advice CLT-UFA 26 350€ couvrant les 2 factures). INVRTL015 (Mars, 20j, 17 000€ HT) facturée 01/04/2026 payée 13/05/2026 (payment advice 17 000€). INVRTL016 (Avril, 15j, 12 750€ HT) facturée 04/05/2026, payée 10/06/2026 (payment advice CLT-UFA 1700001784, 12 750€). INVRTL017 (Mai, 18j, 15 300€ HT) facturée 04/06/2026, <strong>payée 22/07/2026</strong> (payment advice CLT-UFA 1700002285, doc 1600001939). INVRTL018 (Juin, 19j, 16 150€ HT) facturée 03/07/2026, <strong>payée 26/08/2026</strong> (payment advice CLT-UFA 1700002684, doc 1600002379). INVRTL019 (Juillet, 19j, 16 150€ HT) facturée 05/08/2026, due 05/09/2026 — en attente. <strong>Total RTL 2026 = 103 700€ HT (87 550€ encaissés + 16 150€ en attente [019]). Toutes les factures RTL sont HT (TVA 0% — Bairok LLC est basée aux EAU).</strong>" },
    ],
  },

  // ==================== BENOIT 2025 ====================
  benoit2025: {
    title: "Clôture Benoit 2025 — Tracking en DH",
    subtitle: "Tout est comptabilisé en DH. Les paiements Councils (en EUR) sont convertis en DH au taux EUR/MAD du jour de chaque transaction. Azarkan reçoit les paiements TTC en Belgique (21% TVA), mais on comptabilise en HT.",
    commissionRate: 0.10,
    tvaRate: 0.21,
    councils: [
      { date: "18/08/2025", htEUR: 5625, tauxApplique: 10.500 },
      { date: "12/09/2025", htEUR: 5625, tauxApplique: 10.500 },
      { date: "29/09/2025", htEUR: 5313, tauxApplique: 10.500 },
      { date: "13/11/2025", htEUR: 5000, tauxApplique: 10.600 },
      { date: "11/12/2025", htEUR: 5000, tauxApplique: 10.600 },
      { date: "31/12/2025", htEUR: 3625, tauxApplique: 10.600 },
    ],
    virements: [
      { date: "28/07/2025", beneficiaire: "Benoit Chevalier", dh: 50000, motif: "Prêt personnel" },
      { date: "28/07/2025", beneficiaire: "Benoit Chevalier", dh: 50000, motif: "Prêt perso 2" },
      { date: "30/07/2025", beneficiaire: "Benoit Chevalier", dh: 50000, motif: "Prêt familial" },
      { date: "26/11/2025", beneficiaire: "Benoit Chevalier", dh: 50000, motif: "Remboursement prêt" },
      { date: "21/12/2025", beneficiaire: "Benoit Chevalier", dh: 50000, motif: "Remboursement" },
      { date: "06/03/2026", beneficiaire: "Benoit Chevalier", dh: 31750, motif: "Clôture 2025" },
    ],
  },

  // ==================== BENOIT 2026 ====================
  benoit2026: {
    title: "Benoit 2026 — En cours (tracking en DH)",
    commissionRate: 0.10,
    tvaRate: 0.21,
    tjm: 625,
    councils: [
      { ref: "AZCS0001", mois: "Janvier 2026", jours: 8, htEUR: 5000, dateFacture: "30/01/2026", dateDue: "16/03/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 11/02" },
      { ref: "AZCS0002", mois: "Février 2026", jours: 8, htEUR: 5000, dateFacture: "27/02/2026", dateDue: "13/04/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 13/05" },
      { ref: "AZCS0003", mois: "Octobre 2025", jours: 9, htEUR: 5625, dateFacture: "27/03/2026", dateDue: "11/05/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 27/03", backlog: true },
      { ref: "AZCS0004", mois: "Novembre 2025", jours: 10, htEUR: 6250, dateFacture: "27/03/2026", dateDue: "11/05/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 27/03", backlog: true },
      { ref: "AZCS0005", mois: "Décembre 2025", jours: 13, htEUR: 8125, dateFacture: "27/03/2026", dateDue: "11/05/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 27/03", backlog: true },
      { ref: "AZCS0006", mois: "Mars 2026", jours: 9, htEUR: 5625, dateFacture: "27/03/2026", dateDue: "11/05/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 27/03" },
      { ref: "AZCS0007", mois: "Avril 2026", jours: 8.5, htEUR: 5312.50, dateFacture: "30/04/2026", dateDue: "14/06/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 13/05" },
      { ref: "AZCS0008", mois: "Mai 2026", jours: 9, htEUR: 5625, dateFacture: "29/05/2026", dateDue: "13/07/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid" },
      { ref: "AZCS0009", mois: "Juin 2026", jours: 6, htEUR: 3750, dateFacture: "29/05/2026", dateDue: "13/07/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 01/07" },
      // AZCS0010 n'est PAS ici : c'est la facture réglée via Bridgevale (2 400 €),
      // enregistrée dans augustin2026.virementsBridgevale. La série reprend à 0011.
      // AZCS0011 — facture PDF fournie 09/08/2026 (AZCS → Majalis) : « Prestation
      // SAP Juillet 2026 », réf. client « Prestation SAP 2026 / 07 », 8 j × 625 €
      // = 5 000 € HT, TVA 21 % → 6 050 € TTC. Confirme les valeurs qui avaient été
      // déduites du seul relevé bancaire (virement reçu 02/08/2026, communication
      // AZCS0011). Réglée 02/08, soit avant l'échéance du 12/09.
      { ref: "AZCS0011", mois: "Juillet 2026", jours: 8, htEUR: 5000, dateFacture: "29/07/2026", dateDue: "12/09/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 02/08" },
    ],
    virements: [
      { date: "09/03/2026", beneficiaire: "Benoit Chevalier", dh: 50000, motif: "Remboursement" },
      { date: "02/04/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 50000, motif: "Virement" },
      { date: "11/05/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 50000, motif: "Remboursement" },
      { date: "11/05/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 50000, motif: "Remboursement" },
      { date: "12/05/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 50000, motif: "Remboursement" },
      { date: "21/05/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 50000, motif: "Remboursement" },
      { date: "19/06/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 50000, motif: "Remboursement" },
      // Releve Attijarinet du 27/08/2026 : 3 « VIR.EMIS WEB VERS ELMOUKSIT » le meme
      // jour, chacun suivi de sa propre COMMISSION VIREMENT WEB (24,20 DH) -> 3 ordres
      // distincts, pas un doublon d affichage.
      { date: "24/08/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 50000, motif: "Virement (Attijari)" },
      { date: "24/08/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 50000, motif: "Virement (Attijari)" },
      { date: "24/08/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 50000, motif: "Virement (Attijari)" },
      // Second canal : compte CIH Bank (capture fournie le 27/08/2026).
      { date: "23/08/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 45000, motif: "Virement (CIH)" },
      { date: "24/08/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 5000, motif: "Virement (CIH)" },
    ],
    notes: [
      "Le virement du 06/03/2026 (31 750 DH) a été comptabilisé dans la clôture 2025. La réconciliation ne prend en compte que les Councils effectivement payés.",
      "Factures AZCS0003/0004/0005 = backlog 2025 (Oct/Nov/Déc) facturées et payées en mars 2026.",
    ],
  },

  // ==================== BOB 2026 (Hamza El Azzouzi) ====================
  // Amine facture Hamza via Bridgevale Consulting (société UK). Flux
  // international HT (Hamza est en Belgique, Bridgevale est UK) → PAS de TVA.
  // Azarkan (Mohammed = alias "Augustin") récupère les fonds et les dispatche
  // temporairement à Hamza, en attendant qu'il ait son propre compte.
  // Retenue Amine 10% = SEULE composante des soldes → net dû = brut DH − 10%.
  //   La commission de gestion de Mohammed ("Augustin") 3% est prélevée en aval,
  //   quand il retransmet en euros à Hamza : hors livres d'Amine, info seulement.
  // Tracking multidevise comme Badre : factures HT en €, converties en DH au
  // tauxApplique de chaque ligne, payées en DH (virements).
  // Relation récente → report2025 = 0.
  bob2026: {
    title: "Bob 2026 — En cours (facturé via Bridgevale Consulting)",
    report2025: 0,
    commissionAmineRate: 0.10,
    commissionAugustinRate: 0.03,
    councils: [
      // Molenbeck (société de Hamza) → Bridgevale. Versement 1 = 3 600 € HT,
      // déjà payé (reçu sur le compte Bridgevale via Wise). Période exacte / réf facture
      // Bridgevale / date de paiement : à préciser (non fournies). tauxApplique 10.6 (comme Badre).
      // Dates de paiement confirmées par les notifications Wise reçues sur le
      // compte Bridgevale (« Money received from ZOR CONSULTING SRL », 3 600 €
      // chacune) — relevées dans Apple Mail le 09/08/2026 :
      //   INZOR001 → encaissée le 01/06/2026
      //   INZOR002 → encaissée le 13/07/2026 (facture envoyée le 11/07, PJ « ZOR consulting Invoice 2.pdf »)
      //   INZOR003 → encaissée le 06/08/2026 (facture envoyée le 05/08, PJ « ZOR Consulting Invoice 3.pdf »)
      { ref: "INZOR001", mois: "Versement 1", htEUR: 3600, tauxApplique: 10.6, statut: "ok", statutText: "Paid" },
      { ref: "INZOR002", mois: "Juin 2026", htEUR: 3600, dateFacture: "30/06/2026", dateDue: "30/07/2026", tauxApplique: 10.6, statut: "ok", statutText: "Paid" },
      { ref: "INZOR003", mois: "Juillet 2026", htEUR: 3600, dateFacture: "05/08/2026", dateDue: "04/09/2026", tauxApplique: 10.6, statut: "ok", statutText: "Paid" },
    ],
    virements: [
      // Virements dispatchés à Hamza VIA Azarkan : le bénéficiaire bancaire est
      // « Mohammed Azarkan », mais c'est de l'argent destiné à Hamza. Le flag
      // dispatchFor:'bob' les marque explicitement → NE JAMAIS les recompter dans
      // augustin2026.virementsMaroc (même bénéficiaire bancaire = risque de double).
      { date: "11/06/2026", beneficiaire: "Mohammed Azarkan", dh: 20000, motif: "Dispatch Hamza (via Azarkan)", dispatchFor: "bob" },
      { date: "11/06/2026", beneficiaire: "Mohammed Azarkan", dh: 10000, motif: "Dispatch Hamza (via Azarkan)", dispatchFor: "bob" },
      { date: "12/06/2026", beneficiaire: "Mohammed Azarkan", dh: 15000, motif: "Dispatch Hamza (via Azarkan)", dispatchFor: "bob" },
    ],
    notes: [
      "Amine facture la société de Hamza (Molenbeck) via Bridgevale Consulting (société UK). Flux international HT — pas de TVA (Hamza en Belgique, Bridgevale au UK).",
      "Azarkan récupère et dispatche temporairement les fonds à Hamza, en attendant qu'il ait son propre compte.",
      "Retenue Amine : 10 % sur les montants reçus de ZOR. C'est la seule retenue qui entre dans les soldes — net dû par Amine = brut − 10 %.",
      "Amine verse ce net EN DIRHAMS à Azarkan, on behalf de Hamza. Azarkan prélève ensuite sa propre commission de gestion (3 %) en retransmettant en euros : cet étage est une affaire Azarkan↔Hamza et n'entre dans aucun solde d'Amine.",
    ],
  },
};

// ---- BENOIT-ONLY data (for COUPA mode) ----
const BENOIT_DATA = {
  _nick: NICK_BEN,   // benoit + augustin aliases only (no Bob — isolation)
  benoit2025: FULL_DATA.benoit2025,
  benoit2026: FULL_DATA.benoit2026,
};

// ---- BOB-ONLY data (for TESLA mode — Hamza logs in, sees only his tab) ----
const BOB_DATA = {
  _nick: NICK_BOB,   // bob + augustin aliases only (no Benoit — isolation)
  bob2026: FULL_DATA.bob2026,
};

// ---- Private data (BINGA overlay) ----
const PRIV_DATA = {
  benoit2025: {
    commissionRate: 0.10,
    councilsTaux: [
      { date: "18/08/2025", tauxMarche: 10.505 },
      { date: "12/09/2025", tauxMarche: 10.577 },
      { date: "29/09/2025", tauxMarche: 10.530 },
      { date: "13/11/2025", tauxMarche: 10.768 },
      { date: "11/12/2025", tauxMarche: 10.797 },
      { date: "31/12/2025", tauxMarche: 10.706 },
    ],
  },
  benoit2026: {
    tauxApplique: 10.700,
    commissionRate: 0.10,
    // Convention : pour Badre, tauxMarche par défaut = 10,6 (= taux deal
    // Amine-Badre, identique à tauxApplique → 0 gain FX sur ces lignes).
    // On ne met un autre tauxMarche QUE quand un cours marché réel est
    // disponible pour la date de paiement (ex: AZCS0001 / 0002 / 0007).
    councilsTauxMarche: [
      { mois: "Janvier 2026",          tauxMarche: 10.836  }, // index 0 → AZCS0001 (paid 11/02, taux marché réel)
      { mois: "Février 2026",          tauxMarche: 10.7214 }, // index 1 → AZCS0002 (paid 13/05/2026, EUR/MAD fawazahmed0)
      { mois: "Octobre 2025 backlog",  tauxMarche: 10.6    }, // index 2 → AZCS0003 (paid 27/03, default 10.6)
      { mois: "Novembre 2025 backlog", tauxMarche: 10.6    }, // index 3 → AZCS0004
      { mois: "Décembre 2025 backlog", tauxMarche: 10.6    }, // index 4 → AZCS0005
      { mois: "Mars 2026",             tauxMarche: 10.6    }, // index 5 → AZCS0006 (paid 27/03, default 10.6)
      { mois: "Avril 2026",            tauxMarche: 10.7214 }, // index 6 → AZCS0007 (payé 13/05/2026)
      { mois: "Mai 2026",              tauxMarche: 10.6    }, // index 7 → AZCS0008 (payé — date non fournie, default 10.6 → 0 gain FX)
      { mois: "Juin 2026",             tauxMarche: 10.6    }, // index 8 → AZCS0009 (payé 01/07 par Badre, default 10.6)
      { mois: "Juillet 2026",          tauxMarche: 10.6    }, // index 9 → AZCS0011 (payé 02/08 par Badre, default 10.6)
    ],
  },
  // Overlay privé Bob (Hamza) — taux marché réels par facture, masqués à Bob
  // (visibles seulement côté Amine/BINGA). councilsTauxMarche est aligné par
  // index sur bob2026.councils, exactement comme pour Benoit. Vide pour
  // l'instant : à remplir au fil des factures avec le cours EUR/MAD réel.
  bob2026: {
    commissionAmineRate: 0.10,
    commissionAugustinRate: 0.03,
    councilsTauxMarche: [
      { mois: "Versement 1",  tauxMarche: 10.6 }, // index 0 → councils[0] INZOR001 (default 10.6 → 0 gain FX)
      { mois: "Juin 2026",    tauxMarche: 10.6 }, // index 1 → councils[1] INZOR002 (encaissée 13/07/2026)
      { mois: "Juillet 2026", tauxMarche: 10.6 }, // index 2 → councils[2] INZOR003 (encaissée 06/08/2026)
    ],
  },
  fxP2P: {
    title: "Analyse FX — Spreads par étape (EUR → AED → USDT → MAD)",
    subtitle: "Chaque conversion a un spread par rapport au taux marché. L'analyse isole le coût/gain de chaque étape pour quantifier l'avantage du P2P crypto.",
    leg1: {
      label: "EUR → AED (IFX)",
      description: "Conversion bancaire IFX. Spread = taux marché EUR/AED − taux IFX (perte).",
      transactions: [
        { date: "2025-03-28", eur: 10200, aed: 39949.32, tauxIFX: 3.91660, tauxMarche: 3.96465, source: "RTL" },
        { date: "2025-04-17", eur: 17000, aed: 70176.00, tauxIFX: 4.12800, tauxMarche: 4.17329, source: "RTL" },
        { date: "2025-05-23", eur: 17000, aed: 69844.50, tauxIFX: 4.10850, tauxMarche: 4.15630, source: "RTL" },
        { date: "2025-06-16", eur: 19479.78, aed: 81939.75, tauxIFX: 4.20640, tauxMarche: 4.23479, source: "Malt" },
        { date: "2025-07-16", eur: 19479.78, aed: 82265.06, tauxIFX: 4.22310, tauxMarche: 4.26430, source: "Malt" },
        { date: "2025-07-17", eur: 34000, aed: 142922.40, tauxIFX: 4.20360, tauxMarche: 4.26901, source: "RTL" },
        { date: "2025-08-11", eur: 15300, aed: 64605.78, tauxIFX: 4.22260, tauxMarche: 4.28388, source: "RTL" },
        { date: "2025-09-18", eur: 27916.83, aed: 119789.56, tauxIFX: 4.29094, tauxMarche: 4.33766, source: "RTL+Malt" },
        { date: "2025-10-30", eur: 20400, aed: 86167.56, tauxIFX: 4.22390, tauxMarche: 4.26540, source: "RTL" },
        { date: "2025-11-10", eur: 18552.17, aed: 78143.60, tauxIFX: 4.21210, tauxMarche: 4.24469, source: "RTL+Malt" },
        { date: "2025-11-27", eur: 11050, aed: 46585.70, tauxIFX: 4.21590, tauxMarche: 4.26428, source: "RTL" },
        { date: "2025-12-08", eur: 20407.39, aed: 86739.57, tauxIFX: 4.25040, tauxMarche: 4.27929, source: "RTL+Malt" },
        { date: "2025-12-15", eur: 21335, aed: 91313.80, tauxIFX: 4.28000, tauxMarche: 4.31153, source: "RTL" },
        { date: "2026-01-09", eur: 38250, aed: 162658.13, tauxIFX: 4.25250, tauxMarche: 4.27819, source: "RTL" },
        { date: "2026-01-30", eur: 25925, aed: 113185.17, tauxIFX: 4.36587, tauxMarche: 4.37293, source: "RTL" },
        { date: "2026-02-10", eur: 33393.91, aed: 145147.54, tauxIFX: 4.34653, tauxMarche: 4.37533, source: "Malt" },
      ],
    },
    leg2: {
      label: "AED → USDT",
      description: "Achat USDT sur Binance P2P. Spread = premium P2P sur le peg AED/USD.",
      tauxMarche: 3.6725,
      transactions: [
        { date: "2025-06-15", aed: 184.68, usdt: 50.05, prix: 3.690 },
        { date: "2025-06-15", aed: 1000.00, usdt: 271.96, prix: 3.677 },
        { date: "2025-06-16", aed: 372.19, usdt: 100.05, prix: 3.720 },
        { date: "2025-06-16", aed: 2482.00, usdt: 672.62, prix: 3.690 },
        { date: "2025-06-16", aed: 10000.00, usdt: 2710.02, prix: 3.690 },
        { date: "2025-06-16", aed: 5000.00, usdt: 1359.80, prix: 3.677 },
        { date: "2025-06-16", aed: 9000.00, usdt: 2446.98, prix: 3.678 },
        { date: "2025-06-16", aed: 1600.00, usdt: 433.60, prix: 3.690 },
        { date: "2025-06-16", aed: 7500.00, usdt: 2032.52, prix: 3.690 },
        { date: "2025-06-16", aed: 10000.00, usdt: 2717.39, prix: 3.680 },
        { date: "2025-06-17", aed: 7800.00, usdt: 2113.82, prix: 3.690 },
        { date: "2025-06-18", aed: 4500.00, usdt: 1223.49, prix: 3.678 },
        { date: "2025-06-19", aed: 7451.00, usdt: 2019.24, prix: 3.690 },
        { date: "2025-06-20", aed: 6112.00, usdt: 1663.58, prix: 3.674 },
        { date: "2025-06-28", aed: 10000.00, usdt: 2710.76, prix: 3.689 },
        { date: "2025-06-28", aed: 40000.00, usdt: 10843.04, prix: 3.689 },
        { date: "2025-08-09", aed: 2500.00, usdt: 678.05, prix: 3.687 },
        { date: "2025-08-09", aed: 2000.00, usdt: 542.88, prix: 3.684 },
        { date: "2025-12-11", aed: 9334.00, usdt: 2546.09, prix: 3.666 },
        { date: "2026-01-22", aed: 40000.00, usdt: 10893.24, prix: 3.672 },
        { date: "2026-01-22", aed: 30000.00, usdt: 8172.16, prix: 3.671 },
        { date: "2026-04-20", aed: 10000.00, usdt: 2713.70, prix: 3.685 },
        { date: "2026-05-11", aed: 5000.00, usdt: 1357.22, prix: 3.684 },
        { date: "2026-05-11", aed: 14400.00, usdt: 3908.79, prix: 3.684 },
        { date: "2026-05-11", aed: 13250.00, usdt: 3597.61, prix: 3.683 },
        { date: "2026-05-12", aed: 20000.00, usdt: 5431.83, prix: 3.682 },
        { date: "2026-05-20", aed: 1000.00, usdt: 271.59, prix: 3.682 },
        { date: "2026-05-20", aed: 11000.00, usdt: 2986.69, prix: 3.683 },
        { date: "2026-05-21", aed: 10000.00, usdt: 2716.65, prix: 3.681 },
        { date: "2026-06-11", aed: 3900.00, usdt: 1060.07, prix: 3.679 },
        { date: "2026-06-11", aed: 7885.00, usdt: 2142.66, prix: 3.680 },
        { date: "2026-06-12", aed: 3850.00, usdt: 1046.48, prix: 3.679 },
        { date: "2026-06-18", aed: 4000.00, usdt: 1088.43, prix: 3.675 },
        { date: "2026-06-18", aed: 20000.00, usdt: 5439.21, prix: 3.677 },
        { date: "2026-06-18", aed: 19500.00, usdt: 5303.23, prix: 3.677 },
        { date: "2026-06-19", aed: 19000.00, usdt: 5174.29, prix: 3.672 },
        { date: "2026-06-19", aed: 1830.00, usdt: 498.23, prix: 3.673 },
        { date: "2026-06-20", aed: 4300.00, usdt: 1171.66, prix: 3.670 },
        { date: "2026-06-20", aed: 10200.00, usdt: 2780.04, prix: 3.669 },
        { date: "2026-06-20", aed: 5500.00, usdt: 1501.09, prix: 3.664 },
        { date: "2026-07-10", aed: 20000.00, usdt: 5442.17, prix: 3.675 },
        { date: "2026-07-11", aed: 5700.00, usdt: 1556.10, prix: 3.663 },
        { date: "2026-07-11", aed: 16483.21, usdt: 4499.92, prix: 3.663 },
        { date: "2026-07-31", aed: 14986.44, usdt: 4094.65, prix: 3.660 },
      ],
    },
    leg3: {
      label: "USDT → MAD",
      description: "Vente USDT sur Binance P2P Maroc. Spread = premium P2P sur le cours USD/MAD.",
      tauxMarche: {
        "2025-06-16": 9.1088, "2025-06-24": 9.1248, "2025-06-29": 9.0308,
        "2025-07-12": 8.9943, "2025-07-13": 8.9943, "2025-07-20": 9.0433,
        "2025-07-26": 8.9904, "2025-08-08": 9.0304, "2025-11-02": 9.2820,
        "2026-01-03": 9.1123, "2026-01-22": 9.1707, "2026-01-23": 9.1430,
        "2026-01-27": 9.0445, "2026-01-31": 9.1042, "2026-04-22": 9.2609,
        "2026-05-11": 9.0956, "2026-05-17": 9.2096, "2026-05-18": 9.2048,
        "2026-05-21": 9.2353, "2026-06-05": 9.2570, "2026-06-11": 9.2596,
        "2026-06-12": 9.2683, "2026-06-18": 9.3181, "2026-06-19": 9.3150,
        "2026-06-20": 9.2992, "2026-07-11": 9.3213, "2026-07-12": 9.3213,
        "2026-07-19": 9.3249
      },
      transactions: [
        { date: "2025-06-16", usdt: 104.49, mad: 1000.00, prix: 9.570, tauxMarche: 9.1168, hUTC: "00:39" },
        { date: "2025-06-16", usdt: 939.45, mad: 9000.00, prix: 9.580, tauxMarche: 9.1168, hUTC: "01:00" },
        { date: "2025-06-16", usdt: 2502.60, mad: 24000.00, prix: 9.590, tauxMarche: 9.0981, hUTC: "07:03" },
        { date: "2025-06-16", usdt: 521.92, mad: 5000.00, prix: 9.580, tauxMarche: 9.0981, hUTC: "07:35" },
        { date: "2025-06-16", usdt: 1094.89, mad: 10500.00, prix: 9.590, tauxMarche: 9.0981, hUTC: "07:39" },
        { date: "2025-06-16", usdt: 1356.99, mad: 13000.00, prix: 9.580, tauxMarche: 9.0996, hUTC: "13:47" },
        { date: "2025-06-16", usdt: 104.82, mad: 1000.00, prix: 9.540, tauxMarche: 9.1038, hUTC: "16:48" },
        { date: "2025-06-16", usdt: 62.89, mad: 600.00, prix: 9.540, tauxMarche: 9.1038, hUTC: "16:49" },
        { date: "2025-06-16", usdt: 157.06, mad: 1500.00, prix: 9.550, tauxMarche: 9.1088, hUTC: "17:21" },
        { date: "2025-06-16", usdt: 1048.21, mad: 10000.00, prix: 9.540, tauxMarche: 9.1088, hUTC: "17:27" },
        { date: "2025-06-16", usdt: 521.37, mad: 5000.00, prix: 9.590, tauxMarche: 9.1088, hUTC: "17:59" },
        { date: "2025-06-16", usdt: 1042.75, mad: 10000.00, prix: 9.590, tauxMarche: 9.1088, hUTC: "18:07" },
        { date: "2025-06-16", usdt: 631.05, mad: 6051.76, prix: 9.590, tauxMarche: 9.1088, hUTC: "18:11" },
        { date: "2025-06-16", usdt: 521.37, mad: 5000.00, prix: 9.590, tauxMarche: 9.1088, hUTC: "18:14" },
        { date: "2025-06-24", usdt: 2105.26, mad: 20000.00, prix: 9.500, tauxMarche: 9.1248, hUTC: "23:19" },
        { date: "2025-06-29", usdt: 710.49, mad: 6700.00, prix: 9.430, tauxMarche: 9.0308, hUTC: "15:40" },
        { date: "2025-07-12", usdt: 647.24, mad: 6000.00, prix: 9.270, tauxMarche: 8.9943, hUTC: "17:21" },
        { date: "2025-07-12", usdt: 1510.24, mad: 14000.00, prix: 9.270, tauxMarche: 8.9943, hUTC: "17:21" },
        { date: "2025-07-13", usdt: 1377.15, mad: 12780.00, prix: 9.280, tauxMarche: 8.9943, hUTC: "20:16" },
        { date: "2025-07-13", usdt: 2155.17, mad: 20000.00, prix: 9.280, tauxMarche: 8.9943, hUTC: "20:19" },
        { date: "2025-07-13", usdt: 1400.86, mad: 13000.00, prix: 9.280, tauxMarche: 8.9943, hUTC: "20:25" },
        { date: "2025-07-20", usdt: 2575.10, mad: 24000.00, prix: 9.320, tauxMarche: 9.0433, hUTC: "13:00" },
        { date: "2025-07-26", usdt: 2580.64, mad: 24000.00, prix: 9.300, tauxMarche: 8.9904, hUTC: "11:08" },
        { date: "2025-08-08", usdt: 1072.96, mad: 10000.00, prix: 9.320, tauxMarche: 9.0304, hUTC: "21:11" },
        { date: "2025-11-02", usdt: 527.42, mad: 5000.00, prix: 9.480, tauxMarche: 9.2820, hUTC: "09:58" },
        { date: "2025-11-02", usdt: 527.42, mad: 5000.00, prix: 9.480, tauxMarche: 9.2820, hUTC: "10:00" },
        { date: "2025-11-02", usdt: 1101.78, mad: 10500.00, prix: 9.530, tauxMarche: 9.2820, hUTC: "10:48" },
        { date: "2025-11-02", usdt: 550.05, mad: 5241.97, prix: 9.530, tauxMarche: 9.2820, hUTC: "10:55" },
        { date: "2025-11-02", usdt: 1888.77, mad: 18000.00, prix: 9.530, tauxMarche: 9.2820, hUTC: "11:00" },
        { date: "2026-01-03", usdt: 1546.39, mad: 15000.00, prix: 9.700, tauxMarche: 9.1123, hUTC: "20:16" },
        { date: "2026-01-03", usdt: 1030.92, mad: 10000.00, prix: 9.700, tauxMarche: 9.1123, hUTC: "20:17" },
        { date: "2026-01-22", usdt: 2481.90, mad: 24000.00, prix: 9.670, tauxMarche: 9.1707, hUTC: "19:05" },
        { date: "2026-01-22", usdt: 2068.25, mad: 20000.00, prix: 9.670, tauxMarche: 9.1707, hUTC: "19:06" },
        { date: "2026-01-23", usdt: 2061.85, mad: 20000.00, prix: 9.700, tauxMarche: 9.1552, hUTC: "08:06" },
        { date: "2026-01-23", usdt: 1381.44, mad: 13400.00, prix: 9.700, tauxMarche: 9.1552, hUTC: "08:26" },
        { date: "2026-01-23", usdt: 1134.02, mad: 11000.00, prix: 9.700, tauxMarche: 9.1673, hUTC: "10:11" },
        { date: "2026-01-23", usdt: 1853.75, mad: 18000.00, prix: 9.710, tauxMarche: 9.1430, hUTC: "16:42" },
        { date: "2026-01-27", usdt: 1380.08, mad: 13304.00, prix: 9.640, tauxMarche: 9.0445, hUTC: "19:45" },
        { date: "2026-01-31", usdt: 1948.71, mad: 19000.00, prix: 9.750, tauxMarche: 9.1042, hUTC: "15:43" },
        { date: "2026-01-31", usdt: 2051.28, mad: 20000.00, prix: 9.750, tauxMarche: 9.1042, hUTC: "16:01" },
        { date: "2026-01-31", usdt: 1641.02, mad: 16000.00, prix: 9.750, tauxMarche: 9.1042, hUTC: "16:05" },
        { date: "2026-01-31", usdt: 2461.53, mad: 24000.00, prix: 9.750, tauxMarche: 9.1042, hUTC: "16:05" },
        { date: "2026-01-31", usdt: 1500.08, mad: 14625.78, prix: 9.750, tauxMarche: 9.1042, hUTC: "16:13" },
        { date: "2026-04-22", usdt: 2085.50, mad: 20000.00, prix: 9.590, tauxMarche: 9.2609, hUTC: "20:08" },
        { date: "2026-05-11", usdt: 519.21, mad: 5000.00, prix: 9.630, tauxMarche: 9.0956, hUTC: "15:51" },
        { date: "2026-05-11", usdt: 2076.84, mad: 20000.00, prix: 9.630, tauxMarche: 9.0956, hUTC: "15:53" },
        { date: "2026-05-11", usdt: 623.05, mad: 6000.00, prix: 9.630, tauxMarche: 9.0956, hUTC: "15:56" },
        { date: "2026-05-11", usdt: 934.57, mad: 9000.00, prix: 9.630, tauxMarche: 9.0956, hUTC: "15:59" },
        { date: "2026-05-11", usdt: 830.73, mad: 8000.00, prix: 9.630, tauxMarche: 9.0956, hUTC: "16:01" },
        { date: "2026-05-11", usdt: 2489.62, mad: 24000.00, prix: 9.640, tauxMarche: 9.0956, hUTC: "16:36" },
        { date: "2026-05-11", usdt: 1400.41, mad: 13500.00, prix: 9.640, tauxMarche: 9.0956, hUTC: "16:45" },
        { date: "2026-05-17", usdt: 1037.34, mad: 10000.00, prix: 9.640, tauxMarche: 9.2096, hUTC: "16:55" },
        { date: "2026-05-17", usdt: 933.60, mad: 9000.00, prix: 9.640, tauxMarche: 9.2096, hUTC: "16:55" },
        { date: "2026-05-17", usdt: 1037.34, mad: 10000.00, prix: 9.640, tauxMarche: 9.2096, hUTC: "16:57" },
        { date: "2026-05-17", usdt: 1554.40, mad: 15000.00, prix: 9.650, tauxMarche: 9.2096, hUTC: "19:19" },
        { date: "2026-05-18", usdt: 621.76, mad: 6000.00, prix: 9.650, tauxMarche: 9.2048, hUTC: "09:13" },
        { date: "2026-05-18", usdt: 1036.26, mad: 10000.00, prix: 9.650, tauxMarche: 9.2048, hUTC: "09:23" },
        { date: "2026-05-21", usdt: 1034.12, mad: 10000.00, prix: 9.670, tauxMarche: 9.2386, hUTC: "08:56" },
        { date: "2026-05-21", usdt: 548.08, mad: 5300.00, prix: 9.670, tauxMarche: 9.2361, hUTC: "09:00" },
        { date: "2026-05-21", usdt: 1739.91, mad: 16825.00, prix: 9.670, tauxMarche: 9.2361, hUTC: "09:05" },
        { date: "2026-05-21", usdt: 1034.12, mad: 10000.00, prix: 9.670, tauxMarche: 9.2353, hUTC: "10:15" },
        { date: "2026-06-05", usdt: 1440.32, mad: 14000.00, prix: 9.720, tauxMarche: 9.2570, hUTC: "17:14" },
        { date: "2026-06-11", usdt: 1750.77, mad: 17000.00, prix: 9.710, tauxMarche: 9.2596, hUTC: "17:07" },
        { date: "2026-06-11", usdt: 1031.99, mad: 10000.00, prix: 9.690, tauxMarche: 9.2596, hUTC: "17:55" },
        { date: "2026-06-12", usdt: 1649.48, mad: 16000.00, prix: 9.700, tauxMarche: 9.2683, hUTC: "15:42" },
        { date: "2026-06-18", usdt: 2051.28, mad: 20000.00, prix: 9.750, tauxMarche: 9.3181, hUTC: "11:30" },
        { date: "2026-06-18", usdt: 2461.53, mad: 24000.00, prix: 9.750, tauxMarche: 9.3181, hUTC: "11:40" },
        { date: "2026-06-18", usdt: 1025.64, mad: 10000.00, prix: 9.750, tauxMarche: 9.3181, hUTC: "11:43" },
        { date: "2026-06-18", usdt: 1200.00, mad: 11700.00, prix: 9.750, tauxMarche: 9.3181, hUTC: "11:53" },
        { date: "2026-06-19", usdt: 1538.46, mad: 15000.00, prix: 9.750, tauxMarche: 9.3313, hUTC: "07:51" },
        { date: "2026-06-19", usdt: 1025.64, mad: 10000.00, prix: 9.750, tauxMarche: 9.3313, hUTC: "07:55" },
        { date: "2026-06-19", usdt: 2041.02, mad: 19900.00, prix: 9.750, tauxMarche: 9.3313, hUTC: "07:57" },
        { date: "2026-06-19", usdt: 2016.37, mad: 19700.00, prix: 9.770, tauxMarche: 9.3150, hUTC: "17:42" },
        { date: "2026-06-19", usdt: 2016.37, mad: 19700.00, prix: 9.770, tauxMarche: 9.3150, hUTC: "19:12" },
        { date: "2026-06-19", usdt: 1330.60, mad: 13000.00, prix: 9.770, tauxMarche: 9.3150, hUTC: "19:21" },
        { date: "2026-06-20", usdt: 2443.99, mad: 24000.00, prix: 9.820, tauxMarche: 9.2992, hUTC: "14:39" },
        { date: "2026-06-20", usdt: 1720.97, mad: 16900.00, prix: 9.820, tauxMarche: 9.2992, hUTC: "14:44" },
        { date: "2026-07-11", usdt: 2012.13, mad: 19900.00, prix: 9.890, tauxMarche: 9.3213, hUTC: "23:00" },
        { date: "2026-07-11", usdt: 1172.90, mad: 11600.00, prix: 9.890, tauxMarche: 9.3213, hUTC: "23:13" },
        { date: "2026-07-11", usdt: 990.89, mad: 9800.00, prix: 9.890, tauxMarche: 9.3213, hUTC: "23:45" },
        { date: "2026-07-11", usdt: 2022.24, mad: 20000.00, prix: 9.890, tauxMarche: 9.3213, hUTC: "00:35" },
        { date: "2026-07-11", usdt: 911.85, mad: 9000.00, prix: 9.870, tauxMarche: 9.3213, hUTC: "13:39" },
        { date: "2026-07-12", usdt: 911.85, mad: 9000.00, prix: 9.870, tauxMarche: 9.3213, hUTC: "23:51" },
        { date: "2026-07-12", usdt: 709.21, mad: 7000.00, prix: 9.870, tauxMarche: 9.3213, hUTC: "00:03" },
        { date: "2026-07-12", usdt: 1111.11, mad: 11000.00, prix: 9.900, tauxMarche: 9.3213, hUTC: "03:33" },
        { date: "2026-07-19", usdt: 1518.21, mad: 15000.00, prix: 9.880, tauxMarche: 9.3249, hUTC: "20:02" },
        { date: "2026-07-19", usdt: 1872.46, mad: 18500.00, prix: 9.880, tauxMarche: 9.3249, hUTC: "20:04" },
      ],
    },
    usdtRemaining: 4587.88,
    // ==================================================================
    // MARCHANDS P2P — extraction du Binance C2C Order History export
    // ==================================================================
    //   Source : Compte > P2P > Order History > Export (Excel)
    //   Extraction : voir UPDATE_GUIDE.md §Mettre à jour les marchands P2P
    //
    //   merchantsAED / merchantsMAD  → tous les marchands avec qui on
    //     a eu AU MOINS UN order (complété ou annulé). Pour eux, le
    //     RIB a été ajouté côté banque à un moment donné. Pour un
    //     annulé récent, la bank peut avoir gardé le RIB : transaction
    //     rapide possible SOUS RÉSERVE que la validation 4h soit passée.
    //
    //   confirmedMerchantsAED / confirmedMerchantsMAD  → sous-ensemble
    //     avec au moins une transaction "Completed". Ceux-là sont à la
    //     fois fiables (tx déjà réussie) ET leur RIB est validé.
    //
    //   UI (render-radar.js) affiche 3 niveaux:
    //     • ⭐ Connu (vert)     — dans confirmedMerchants* → prioritaire
    //     • 🔸 RIB validé (jaune) — dans merchants* mais pas confirmed
    //     • 🆕 Nouveau (gris)    — ni l'un ni l'autre → 4h validation
    // ==================================================================

    // ----- AED (buy USDT, Émirats) -----
    // Dernier export : 2026-08-09 — à re-exporter au fil des trades
    merchantsAED: [
      "_AliX_", "-Pro-Merchant", "8thfloormediafzco", "Abdulla_Saif_Mohamme",
      "abdullah_trader2", "Abu_Sultan_BTC", "AbuBakar_474",
      "AcodRemits_MBankAani", "AlaibanQ8", "Ameen7108", "Amorcrypto",
      "Amoun-AZ", "amro_sd", "ANSELEM_S_OJIKE", "AquaXchange",
      "AROH_FORREAL_MAN_VEN", "Aureus FZ", "Axa00", "Baasher", "Binance_Vet",
      "BLOCKSY", "CamelP2P", "Captain5aled", "daZyyy-",
      "Dubai_Mankhool_AANI_Mbank", "Emmachristo1", "Exchangify-Enterpris",
      "FAST__TRADE__DIGITAL", "Fast_PRO_ExVIP", "FBSTrader", "Fury-Ex",
      "hammadansa3535", "HappyCryptoAE", "ICEMAN-90210", "ISLAMIC_CRYPTO",
      "krisXchange", "LinkPay", "Loma_1", "M7usdt", "Maximilianthefirst",
      "MB52", "MBebars", "mgrabit", "Miami trader", "Mo-Mo9090", "Mooddy",
      "Muzamil2176", "OFFICIAL__MERCHANT", "P2P-1a5edebv", "P2P-82159eq4",
      "P2P-d921c7cn", "Real__Jay", "RMK LTD", "Saibo7", "SalimCapital",
      "Samana101", "ShefyZ_CryptO", "ShefyZ_CryptO_WorLD", "SwappyCrypto",
      "Takethiswave", "ThePenguin29", "Thomas_Shelby9", "TRUST__COMBANY",
      "tuansham172", "UAE_Ahmed", "UnitedCoinEmirates", "User-162c8",
      "User-fc09a", "WhiteMoney-UAEIND", "zahi",
    ],
    confirmedMerchantsAED: [
      "_AliX_", "Abdulla_Saif_Mohamme", "Abu_Sultan_BTC", "Ameen7108",
      "Amoun-AZ", "amro_sd", "AquaXchange", "Baasher", "CamelP2P",
      "Dubai_Mankhool_AANI_Mbank", "Emmachristo1", "FAST__TRADE__DIGITAL",
      "Fast_PRO_ExVIP", "ICEMAN-90210", "ISLAMIC_CRYPTO", "krisXchange",
      "Loma_1", "Mo-Mo9090", "P2P-1a5edebv", "Real__Jay", "RMK LTD",
      "ThePenguin29", "Thomas_Shelby9", "TRUST__COMBANY", "tuansham172",
      "UnitedCoinEmirates", "User-fc09a",
    ],

    // ----- MAD (sell USDT, Maroc) -----
    merchantsMAD: [
      "95Hamid95", "anass Ghanem", "ayoubboukdir", "Bitcoin_Art", "COIN_FLIP",
      "Cryptomande", "DrissLaz", "F-13", "fast--one", "FastOnlyP2P", "FATYFOX",
      "focalise27", "foyusdt", "GrandMarsterP2P", "hamadou belkhir",
      "Hamzasef", "HannibalHk", "II MAK_PAY II", "Imhere_welcome",
      "Issamabbouraada", "Itsjustme01", "khalid mechti", "liltax", "MAK_CASH",
      "meriem-service", "MostExpress", "nadia6341", "ogri_fast", "Osmorty",
      "Otomai", "P2P-12d218cg", "P2P-3caf35la", "P2P-4de193tz", "P2P-59dbaepc",
      "P2P-604a69za", "P2P-75bf28g3", "P2P-76c3f3dh", "P2P-84688af7",
      "P2P-c22d1fnt", "P2P-c487fbkq", "P2P-dfb52fdi", "P2P-e72004q4",
      "P2P-F2F", "P2P-fc2d6fbv", "P2P-Sped", "P2PFastMubarak", "pokito",
      "PROFESSIONNEL", "R-A-H-I-L", "Rachid_Erin", "reb7cCa", "Rocket_-_",
      "SafeCoinsExpress", "said rabede", "Salah060", "SALHICHRIF",
      "Sana_P2P_Trusted", "Sara224", "sethn11", "STALIIIIIIINE", "TecTac",
      "the_gentelman", "Transaction Rapide", "USDT0X", "User-00d34eg9",
      "User-040fe", "User-11a08", "User-23d2c", "User-35404", "User-382d6",
      "User-42cc0", "User-4ab13", "User-61fed", "User-6f66f", "User-72beb",
      "User-732eb", "User-7b67a", "User-7d0bb", "User-859a0", "User-8a278",
      "User-a765f", "User-a821a", "User-b1534", "User-b6c1b92h",
      "User-bc6e0bwn", "User-c86e6", "User-d02e6", "User-f38af",
      "Valeria Hones eD3a", "Youssef19932025", "Yusuf-Cryptomonnaie",
      "Zack-Crypto", "Zahya_Usdt", "Zak_hk",
    ],
    confirmedMerchantsMAD: [
      "95Hamid95", "anass Ghanem", "ayoubboukdir", "COIN_FLIP", "Cryptomande",
      "DrissLaz", "F-13", "fast--one", "FastOnlyP2P", "FATYFOX", "focalise27",
      "foyusdt", "GrandMarsterP2P", "hamadou belkhir", "Hamzasef",
      "HannibalHk", "II MAK_PAY II", "Imhere_welcome", "Issamabbouraada",
      "Itsjustme01", "khalid mechti", "liltax", "MAK_CASH", "meriem-service",
      "MostExpress", "nadia6341", "ogri_fast", "Osmorty", "Otomai",
      "P2P-12d218cg", "P2P-3caf35la", "P2P-4de193tz", "P2P-59dbaepc",
      "P2P-604a69za", "P2P-75bf28g3", "P2P-76c3f3dh", "P2P-c22d1fnt",
      "P2P-c487fbkq", "P2P-dfb52fdi", "P2P-e72004q4", "P2P-F2F", "P2P-Sped",
      "PROFESSIONNEL", "R-A-H-I-L", "Rachid_Erin", "reb7cCa", "Rocket_-_",
      "SafeCoinsExpress", "said rabede", "Salah060", "SALHICHRIF",
      "Sana_P2P_Trusted", "Sara224", "sethn11", "STALIIIIIIINE", "TecTac",
      "Transaction Rapide", "USDT0X", "User-00d34eg9", "User-040fe",
      "User-11a08", "User-23d2c", "User-35404", "User-382d6", "User-42cc0",
      "User-4ab13", "User-61fed", "User-6f66f", "User-732eb", "User-7b67a",
      "User-7d0bb", "User-859a0", "User-8a278", "User-a765f", "User-b1534",
      "User-c86e6", "User-d02e6", "User-f38af", "Valeria Hones eD3a",
      "Yusuf-Cryptomonnaie", "Zahya_Usdt", "Zak_hk",
    ],
  },
  ycarreCommission: 0.08,
  ycarreTotal: 54300,
};


// ============================================================
// Encryption helper — AES-256-GCM, PBKDF2
// Password is ALWAYS uppercased for case-insensitive matching
// ============================================================
function encryptData(data, password) {
  const plaintext = JSON.stringify(data);
  const normalizedPwd = password.toUpperCase();

  // Derive key
  const keyMaterial = crypto.pbkdf2Sync(normalizedPwd, SALT, 100000, 32, 'sha256');

  // Random IV
  const iv = crypto.randomBytes(12);

  // Encrypt
  const cipher = crypto.createCipheriv('aes-256-gcm', keyMaterial, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine: iv (12) + tag (16) + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64');
}

// ============================================================
// Main — Generate encrypted data files
// ============================================================
async function main() {
  console.log('Encrypting all data...\n');

  // 1) Full data → TIGRE
  const fullB64 = encryptData(FULL_DATA, 'TIGRE');
  console.log(`FULL (TIGRE): ${JSON.stringify(FULL_DATA).length} bytes → ${fullB64.length} base64 chars`);

  // 2) Benoit-only → COUPA
  const benoitB64 = encryptData(BENOIT_DATA, 'COUPA');
  console.log(`BENOIT (COUPA): ${JSON.stringify(BENOIT_DATA).length} bytes → ${benoitB64.length} base64 chars`);

  // 3) Bob-only → TESLA (Hamza logs in, sees only his own tab)
  const bobB64 = encryptData(BOB_DATA, 'TESLA');
  console.log(`BOB (TESLA): ${JSON.stringify(BOB_DATA).length} bytes → ${bobB64.length} base64 chars`);

  // 4) Private overlay → BINGA
  const privB64 = encryptData(PRIV_DATA, 'BINGA');
  console.log(`PRIV (BINGA): ${JSON.stringify(PRIV_DATA).length} bytes → ${privB64.length} base64 chars`);

  // Write data-enc.js (main encrypted blobs)
  const encOutput = `// Auto-generated — DO NOT EDIT
// Encrypted main data (AES-256-GCM, PBKDF2, password uppercased)
const ENCRYPTED_FULL = "${fullB64}";
const ENCRYPTED_BENOIT = "${benoitB64}";
const ENCRYPTED_BOB = "${bobB64}";
`;
  fs.writeFileSync('data-enc.js', encOutput);
  console.log('\n→ Written to data-enc.js');

  // Write data-priv.enc.js (private overlay)
  const privOutput = `// Auto-generated — DO NOT EDIT
// Encrypted private data (AES-256-GCM, PBKDF2, password uppercased)
const ENCRYPTED_PRIV = "${privB64}";
`;
  fs.writeFileSync('data-priv.enc.js', privOutput);
  console.log('→ Written to data-priv.enc.js');

  console.log('\nDone. Remember to remove data.js from the repo (data is now encrypted).');
}

main();
