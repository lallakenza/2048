#!/usr/bin/env node
// ============================================================
// ENCRYPT.JS — Build script: chiffre TOUTES les données
// Usage: node encrypt.js
// Produit:
//   data-enc.js      → ENCRYPTED_FULL (BRIDGEVALE) + ENCRYPTED_BENOIT (COUPA)
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
// FULL PUBLIC DATA (replaces data.js — now encrypted)
// ============================================================
const FULL_DATA = {

  // ==================== AUGUSTIN 2025 ====================
  augustin2025: {
    title: "Clôture Augustin 2025 — Réconciliation mois par mois",
    subtitle: "Basé sur le fichier Excel Augustin v2 (mis à jour). Pour chaque mois : revenus RTL, dépenses déclarées (B+Y+M, Maroc, Divers), virements réels, et commentaires.",
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
    tauxMaroc: 10.26,
    virementsMaroc: [
      { date: "02/01/2026", beneficiaire: "Jean Augustin", dh: 10000 },
      { date: "03/02/2026", beneficiaire: "Jean Augustin", dh: 10000 },
      { date: "03/03/2026", beneficiaire: "Jean Augustin", dh: 30000 },
      { date: "02/04/2026", beneficiaire: "Jean Augustin", dh: 10000 },
    ],
    rtl: [
      { ref: "INVRTL013", periode: "Janvier", jours: 11, montant: 9350, dateFacture: "31/12/2025", dateDue: "01/03/2026", statut: "ok", statutText: "Paid" },
      { ref: "INVRTL014", periode: "Février", jours: 20, montant: 17000, dateFacture: "01/03/2026", dateDue: "01/04/2026", statut: "ok", statutText: "Paid 01/04" },
      { ref: "—", periode: "Mars", jours: 20, montant: 17000, statut: "i", statutText: "À facturer" },
    ],
    divers: [
      { label: "Oumaima → Azarkan (remboursement reçu 2026)", montant: 800 },
      { label: "Azarkan → Amine (via Zakaria — avance 2026)", montant: -1200 },
      { label: "Amine → Azarkan (via Nezha → Hanane) — virement perso", montant: 6000 },
    ],
    insights: [
      { type: "neutral", titre: "💸 Flux cash 2026 : 3 transactions Amine ↔ Azarkan", desc: "<strong>Reçu d'Azarkan :</strong> Oumaima +800€ · Zakaria −1 200€ = <strong>−400€ net</strong>.<br><strong>Envoyé à Azarkan :</strong> 6 000€ via Nezha → Hanane (virement perso).<br><strong>Net perso :</strong> +800 − 1 200 + 6 000 = <strong>5 600€</strong>." },
      { type: "pass", titre: "📄 Factures RTL 2026 : 2 payées, 1 à facturer", desc: "INVRTL013 (Jan, 11j, 9 350€ HT) payée. INVRTL014 (Fév, 20j, 17 000€ HT) payée le 01/04/2026 (payment advice CLT-UFA 26 350€ couvrant les 2 factures). Mars (20j, 17 000€ HT) à facturer. <strong>Toutes les factures RTL sont HT (TVA 0% — Bairok LLC est basée aux EAU).</strong>" },
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
      { ref: "AZCS0002", mois: "Février 2026", jours: 8, htEUR: 5000, dateFacture: "27/02/2026", dateDue: "13/04/2026", tauxApplique: 10.600, statut: "w", statutText: "Invoiced" },
      { ref: "AZCS0003", mois: "Octobre 2025", jours: 9, htEUR: 5625, dateFacture: "27/03/2026", dateDue: "11/05/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 27/03", backlog: true },
      { ref: "AZCS0004", mois: "Novembre 2025", jours: 10, htEUR: 6250, dateFacture: "27/03/2026", dateDue: "11/05/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 27/03", backlog: true },
      { ref: "AZCS0005", mois: "Décembre 2025", jours: 13, htEUR: 8125, dateFacture: "27/03/2026", dateDue: "11/05/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 27/03", backlog: true },
      { ref: "AZCS0006", mois: "Mars 2026", jours: 9, htEUR: 5625, dateFacture: "27/03/2026", dateDue: "11/05/2026", tauxApplique: 10.600, statut: "ok", statutText: "Paid 27/03" },
    ],
    virements: [
      { date: "09/03/2026", beneficiaire: "Benoit Chevalier", dh: 50000, motif: "Remboursement" },
      { date: "02/04/2026", beneficiaire: "Badrecheikh Elmouksit", dh: 50000, motif: "Virement" },
    ],
    notes: [
      "Le virement du 06/03/2026 (31 750 DH) a été comptabilisé dans la clôture 2025. La réconciliation ne prend en compte que les Councils effectivement payés.",
      "Factures AZCS0003/0004/0005 = backlog 2025 (Oct/Nov/Déc) facturées et payées en mars 2026.",
    ],
  },
};

// ---- BENOIT-ONLY data (for COUPA mode) ----
const BENOIT_DATA = {
  benoit2025: FULL_DATA.benoit2025,
  benoit2026: FULL_DATA.benoit2026,
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
    councilsTauxMarche: [
      { mois: "Janvier", tauxMarche: 10.836 },
      { mois: "Février", tauxMarche: null },
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
        { date: "2025-06-18", aed: 7800.00, usdt: 2113.82, prix: 3.690 },
        { date: "2025-06-18", aed: 4500.00, usdt: 1223.49, prix: 3.678 },
        { date: "2025-06-19", aed: 7451.00, usdt: 2019.24, prix: 3.690 },
        { date: "2025-06-20", aed: 6112.00, usdt: 1663.58, prix: 3.674 },
        { date: "2025-06-28", aed: 10000.00, usdt: 2710.76, prix: 3.689 },
        { date: "2025-06-28", aed: 40000.00, usdt: 10843.04, prix: 3.689 },
        { date: "2025-08-09", aed: 2500.00, usdt: 678.05, prix: 3.687 },
        { date: "2025-08-10", aed: 2000.00, usdt: 542.88, prix: 3.684 },
        { date: "2025-12-11", aed: 9334.00, usdt: 2546.09, prix: 3.666 },
        { date: "2026-01-22", aed: 40000.00, usdt: 10893.24, prix: 3.672 },
        { date: "2026-01-22", aed: 30000.00, usdt: 8172.16, prix: 3.671 },
      ],
    },
    leg3: {
      label: "USDT → MAD",
      description: "Vente USDT sur Binance P2P Maroc. Spread = premium P2P sur le cours USD/MAD.",
      tauxMarche: {
        "2025-06-16": 9.1228, "2025-06-24": 9.1170, "2025-06-29": 9.0334,
        "2025-07-12": 9.0094, "2025-07-14": 9.0069, "2025-07-20": 9.0458,
        "2025-07-26": 8.9970, "2025-08-09": 9.0337, "2025-11-02": 9.2893,
        "2026-01-04": 9.1345, "2026-01-22": 9.1864, "2026-01-23": 9.1710,
        "2026-01-27": 9.0794, "2026-01-31": 9.1155,
      },
      transactions: [
        { date: "2025-06-16", usdt: 104.49, mad: 1000.00, prix: 9.570 },
        { date: "2025-06-16", usdt: 939.45, mad: 9000.00, prix: 9.580 },
        { date: "2025-06-16", usdt: 2502.60, mad: 24000.00, prix: 9.590 },
        { date: "2025-06-16", usdt: 521.92, mad: 5000.00, prix: 9.580 },
        { date: "2025-06-16", usdt: 1094.89, mad: 10500.00, prix: 9.590 },
        { date: "2025-06-16", usdt: 1356.99, mad: 13000.00, prix: 9.580 },
        { date: "2025-06-16", usdt: 104.82, mad: 1000.00, prix: 9.540 },
        { date: "2025-06-16", usdt: 62.89, mad: 600.00, prix: 9.540 },
        { date: "2025-06-16", usdt: 157.06, mad: 1500.00, prix: 9.550 },
        { date: "2025-06-16", usdt: 1048.21, mad: 10000.00, prix: 9.540 },
        { date: "2025-06-16", usdt: 521.37, mad: 5000.00, prix: 9.590 },
        { date: "2025-06-16", usdt: 1042.75, mad: 10000.00, prix: 9.590 },
        { date: "2025-06-16", usdt: 631.05, mad: 6051.76, prix: 9.590 },
        { date: "2025-06-16", usdt: 521.37, mad: 5000.00, prix: 9.590 },
        { date: "2025-06-24", usdt: 2105.26, mad: 20000.00, prix: 9.500 },
        { date: "2025-06-29", usdt: 710.49, mad: 6700.00, prix: 9.430 },
        { date: "2025-07-12", usdt: 647.24, mad: 6000.00, prix: 9.270 },
        { date: "2025-07-12", usdt: 1510.24, mad: 14000.00, prix: 9.270 },
        { date: "2025-07-14", usdt: 1377.15, mad: 12780.00, prix: 9.280 },
        { date: "2025-07-14", usdt: 2155.17, mad: 20000.00, prix: 9.280 },
        { date: "2025-07-14", usdt: 1400.86, mad: 13000.00, prix: 9.280 },
        { date: "2025-07-20", usdt: 2575.10, mad: 24000.00, prix: 9.320 },
        { date: "2025-07-26", usdt: 2580.64, mad: 24000.00, prix: 9.300 },
        { date: "2025-08-09", usdt: 1072.96, mad: 10000.00, prix: 9.320 },
        { date: "2025-11-02", usdt: 527.42, mad: 5000.00, prix: 9.480 },
        { date: "2025-11-02", usdt: 527.42, mad: 5000.00, prix: 9.480 },
        { date: "2025-11-02", usdt: 1101.78, mad: 10500.00, prix: 9.530 },
        { date: "2025-11-02", usdt: 550.05, mad: 5241.97, prix: 9.530 },
        { date: "2025-11-02", usdt: 1888.77, mad: 18000.00, prix: 9.530 },
        { date: "2026-01-04", usdt: 1546.39, mad: 15000.00, prix: 9.700 },
        { date: "2026-01-04", usdt: 1030.92, mad: 10000.00, prix: 9.700 },
        { date: "2026-01-22", usdt: 2481.90, mad: 24000.00, prix: 9.670 },
        { date: "2026-01-22", usdt: 2068.25, mad: 20000.00, prix: 9.670 },
        { date: "2026-01-23", usdt: 2061.85, mad: 20000.00, prix: 9.700 },
        { date: "2026-01-23", usdt: 1381.44, mad: 13400.00, prix: 9.700 },
        { date: "2026-01-23", usdt: 1134.02, mad: 11000.00, prix: 9.700 },
        { date: "2026-01-23", usdt: 1853.75, mad: 18000.00, prix: 9.710 },
        { date: "2026-01-27", usdt: 1380.08, mad: 13304.00, prix: 9.640 },
        { date: "2026-01-31", usdt: 1948.71, mad: 19000.00, prix: 9.750 },
        { date: "2026-01-31", usdt: 2051.28, mad: 20000.00, prix: 9.750 },
        { date: "2026-01-31", usdt: 1641.02, mad: 16000.00, prix: 9.750 },
        { date: "2026-01-31", usdt: 2461.53, mad: 24000.00, prix: 9.750 },
        { date: "2026-01-31", usdt: 1500.08, mad: 14625.78, prix: 9.750 },
      ],
    },
    usdtRemaining: 319.71,
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
    // Dernier export : 2026-03-09 — à re-exporter au fil des trades
    merchantsAED: [
      "Abu_Sultan_BTC", "AbuBakar_474", "AlaibanQ8", "Amoun-AZ", "AquaXchange",
      "Aureus FZ", "Axa00", "Baasher", "Captain5aled", "Exchangify-Enterpris",
      "FBSTrader", "ISLAMIC_CRYPTO", "LinkPay", "Loma_1", "Maximilianthefirst",
      "MBebars", "mgrabit", "Miami trader", "Muzamil2176", "P2P-82159eq4",
      "P2P-d921c7cn", "RMK LTD", "Saibo7", "ShefyZ_CryptO_WorLD", "SwappyCrypto",
      "Takethiswave", "ThePenguin29", "UnitedCoinEmirates", "WhiteMoney-UAEIND",
    ],
    confirmedMerchantsAED: [
      "Abu_Sultan_BTC", "Amoun-AZ", "AquaXchange", "Baasher", "ISLAMIC_CRYPTO",
      "Loma_1", "RMK LTD", "ThePenguin29", "UnitedCoinEmirates",
    ],

    // ----- MAD (sell USDT, Maroc) -----
    merchantsMAD: [
      "95Hamid95", "COIN_FLIP", "Cryptomande", "DrissLaz", "F-13",
      "FastOnlyP2P", "focalise27", "hamadou belkhir", "Hamzasef", "HannibalHk",
      "Imhere_welcome", "Itsjustme01", "khalid mechti", "liltax", "MAK_CASH",
      "meriem-service", "MostExpress", "Osmorty", "Otomai", "P2P-4de193tz",
      "P2P-604a69za", "P2P-84688af7", "P2P-c22d1fnt", "P2P-F2F", "pokito",
      "Rocket_-_", "SafeCoinsExpress", "said rabede", "SALHICHRIF",
      "Sana_P2P_Trusted", "sethn11", "TecTac", "Transaction Rapide",
      "User-040fe", "User-61fed", "User-72beb", "User-7b67a", "User-a765f",
      "User-c86e6", "User-f38af", "Yusuf-Cryptomonnaie", "Youssef19932025",
    ],
    confirmedMerchantsMAD: [
      "95Hamid95", "COIN_FLIP", "Cryptomande", "DrissLaz", "F-13",
      "FastOnlyP2P", "focalise27", "hamadou belkhir", "Hamzasef", "HannibalHk",
      "Imhere_welcome", "Itsjustme01", "khalid mechti", "liltax", "MAK_CASH",
      "meriem-service", "MostExpress", "Osmorty", "Otomai", "P2P-4de193tz",
      "P2P-604a69za", "P2P-c22d1fnt", "P2P-F2F", "Rocket_-_", "SafeCoinsExpress",
      "said rabede", "SALHICHRIF", "Sana_P2P_Trusted", "sethn11", "TecTac",
      "Transaction Rapide", "User-040fe", "User-61fed", "User-7b67a",
      "User-a765f", "User-c86e6", "User-f38af", "Yusuf-Cryptomonnaie",
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

  // 1) Full data → BRIDGEVALE
  const fullB64 = encryptData(FULL_DATA, 'BRIDGEVALE');
  console.log(`FULL (BRIDGEVALE): ${JSON.stringify(FULL_DATA).length} bytes → ${fullB64.length} base64 chars`);

  // 2) Benoit-only → COUPA
  const benoitB64 = encryptData(BENOIT_DATA, 'COUPA');
  console.log(`BENOIT (COUPA): ${JSON.stringify(BENOIT_DATA).length} bytes → ${benoitB64.length} base64 chars`);

  // 3) Private overlay → BINGA
  const privB64 = encryptData(PRIV_DATA, 'BINGA');
  console.log(`PRIV (BINGA): ${JSON.stringify(PRIV_DATA).length} bytes → ${privB64.length} base64 chars`);

  // Write data-enc.js (main encrypted blobs)
  const encOutput = `// Auto-generated — DO NOT EDIT
// Encrypted main data (AES-256-GCM, PBKDF2, password uppercased)
const ENCRYPTED_FULL = "${fullB64}";
const ENCRYPTED_BENOIT = "${benoitB64}";
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
