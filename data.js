// ============================================================
// DATA.JS — Données publiques de réconciliation
// Les données privées (commissions, spreads, FX P2P) sont chiffrées
// dans data-priv.enc.js et déchiffrées uniquement avec le bon mot de passe.
// ============================================================

const DATA = {

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
      { nom: "Novembre", actuals: 17000, bym: 14600, maroc: 1000, divers: 300, commentaire: "B+Y+M = 14 600 (Councils 5k + Ycarré 9.6k EBS). Maroc ✓ (10k DH le 03/11). Divers net 300€ (1 800 − 1 500). <strong>−1 500€ = Prêt EBS 15/12 ✓</strong>. Reste 1 800€ sans preuve.", badge: "ok", badgeText: "✓ OK" },
      { nom: "Décembre", actuals: 17425, bym: 13225, maroc: 6000, divers: -1900, commentaire: "Augustin a corrigé Maroc 1k→6k et B+Y+M 12 725→13 225 (+500€ Councils). Matche les 60k DH (10k le 03/12 + 50k le 19/12). Divers net −1 900€ (600 − 2 500). <strong>−2 500€ = Prêt EBS 04/12 ✓</strong>. Reste 600€ sans preuve.", badge: "ok", badgeText: "✓ Corrigé v2", marocCorrige: true },
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
      { mois: "Février", montant: 400, label: "Vol pour Augustin", preuve: "ok", preuveText: "✓ EBS" },
      { mois: "Juin", montant: 1240, label: "Vol pour Augustin", preuve: "ok", preuveText: "✓ EBS" },
      { mois: "Septembre", montant: 1130, label: "iPhone 1 305,41 USD", preuve: "ok", preuveText: "✓ EBS 09/10" },
      { mois: "Novembre", montant: 1800, label: "Divers", preuve: "w", preuveText: "Aucune" },
      { mois: "Novembre", montant: -1500, label: "Prêt (Seq.1404)", preuve: "ok", preuveText: "✓ EBS 15/12" },
      { mois: "Décembre", montant: 600, label: "Divers", preuve: "w", preuveText: "Aucune" },
      { mois: "Décembre", montant: -2500, label: "Prêt (Seq.1362)", preuve: "ok", preuveText: "✓ EBS 04/12" },
    ],
    diversVerifie: 6770,
    diversNonVerifie: 2400,

    insights: [
      { type: "pass", titre: "✅ Augustin a corrigé 4 erreurs MAD entre v1 et v2", desc: "Août (1k→3k ✓), Septembre (3k→1k ✓), Octobre (1k→6k + suppression 2×5k Divers ✓), Décembre (1k→6k ✓). Cela montre qu'Augustin reconnaît les écarts quand confronté aux preuves bancaires. Le Maroc passe de 13 000€ → 23 000€, match parfait avec les virements réels (23 000€ Fév-Déc)." },
      { type: "pass", titre: "✅ Councils HT : écart de 500€ corrigé (v1 → v2)", desc: "Augustin a corrigé le B+Y+M de Décembre de 12 725€ → 13 225€, intégrant les 500€ Councils HT manquants du 31/12. Les 6 paiements Councils matchent désormais 100% l'EBS." },
      { type: "pass", titre: "✅ Virements Maroc : 23 000€ — match parfait Excel = Réel", desc: "Tous les virements Maroc Fév-Déc matchent parfaitement l'Excel (23 000€). Pas de virement en Janvier. 11 mois sur 11 vérifiés, 0€ d'écart." },
      { type: "pass", titre: "✅ Divers : 6 770€ de transactions EBS vérifiées (vols + iPhone + prêts)", desc: "<strong>Fév 400€</strong> = vol ✓. <strong>Juin 1 240€</strong> = vol ✓. <strong>Sep 1 130€</strong> = iPhone ✓. <strong>Nov −1 500€</strong> = Prêt EBS 15/12 ✓. <strong>Déc −2 500€</strong> = Prêt EBS 04/12 ✓. Total vérifié EBS : 6 770€ (en valeur absolue). Restent seulement Nov 1 800€ et Déc 600€ sans preuve (net 2 400€)." },
      { type: "neutral", titre: "📊 Ycarré + Baraka + Councils : 157 288€ — 100% vérifié EBS", desc: "Les 3 catégories avec preuves EBS (18 paiements au total) matchent parfaitement. Ycarré 54 300€ (6/6), Baraka 72 800€ (6/6), Councils HT 30 188€ (6/6 après correction v2)." },
      { type: "pass", titre: "✅ Factures RTL 2025 : 198 475€ — 12/12 rapprochées, 0€ d'écart", desc: "Les 12 factures RTL (INVRTL001 à INVRTL012) sont toutes confirmées dans le CSV IFX. Les paiements combinés (INVRTL004+005 en Juillet, INVRTL010+011 en Janvier 2026) sont correctement identifiés. Aucun revenu manquant." },
    ],
  },

  // ==================== AUGUSTIN 2026 ====================
  augustin2026: {
    title: "Augustin 2026 — En cours",
    report2025: -1683,
    tauxMaroc: 10,

    virementsMaroc: [
      { date: "02/01/2026", beneficiaire: "Jean Augustin", dh: 10000 },
      { date: "03/02/2026", beneficiaire: "Jean Augustin", dh: 10000 },
      { date: "03/03/2026", beneficiaire: "Jean Augustin", dh: 30000 },
    ],

    rtl: [
      { ref: "INVRTL013", periode: "Janvier", jours: 11, montant: 9350, statut: "w", statutText: "Pas encore reçu" },
      { ref: "INVRTL014", periode: "Février", jours: 20, montant: 17000, statut: "w", statutText: "Pas encore reçu" },
      { ref: "—", periode: "Mars", jours: 20, montant: 17000, statut: "i", statutText: "À facturer" },
    ],
  },

  // ==================== BENOIT 2025 (PUBLIC — sans taux marché ni commission) ====================
  benoit2025: {
    title: "Clôture Benoit 2025 — Tracking en DH",
    subtitle: "Tout est comptabilisé en DH. Les paiements Councils (en EUR) sont convertis en DH au taux EUR/MAD du jour de chaque transaction.",
    // commissionRate: ENCRYPTED — injected at runtime
    // tauxMarche per transaction: ENCRYPTED — injected at runtime

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

  // ==================== BENOIT 2026 (PUBLIC — sans taux ni commission) ====================
  benoit2026: {
    title: "Benoit 2026 — En cours (tracking en DH)",
    // tauxApplique: ENCRYPTED
    // commissionRate: ENCRYPTED

    councils: [
      { mois: "Janvier", htEUR: 5000, statut: "ok", statutText: "Paid 11/02" },
      { mois: "Février", htEUR: 5000, statut: "w", statutText: "Invoiced" },
    ],

    virements: [
      { date: "09/03/2026", beneficiaire: "Benoit Chevalier", dh: 50000, motif: "Remboursement" },
    ],
  },

  // ==================== FX P2P — ENCRYPTED ====================
  // fxP2P: entirely encrypted — only available in BINGA mode
};
