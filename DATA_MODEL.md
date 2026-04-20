# Data model

Toutes les données du site vivent dans **`encrypt.js`** — le seul fichier source
à éditer. Les fichiers `data-enc.js` et `data-priv.enc.js` sont générés par
`node encrypt.js` et déployés sur GitHub Pages.

## 🏗 Vue d'ensemble

```
encrypt.js
├── FULL_DATA       ← chiffré avec BRIDGEVALE → ENCRYPTED_FULL (dans data-enc.js)
│   ├── augustin2025, augustin2026
│   └── benoit2025, benoit2026
│
├── BENOIT_DATA     ← chiffré avec COUPA → ENCRYPTED_BENOIT (dans data-enc.js)
│   └── benoit2025, benoit2026   (sous-ensemble de FULL_DATA)
│
└── PRIV_DATA       ← chiffré avec BINGA → ENCRYPTED_PRIV (dans data-priv.enc.js)
    ├── benoit2025.commissionRate, councilsTaux[]
    ├── benoit2026.tauxApplique, commissionRate, councilsTauxMarche[]
    ├── fxP2P       (pipeline FX complet — leg1/leg2/leg3)
    ├── ycarreCommission, ycarreTotal
    └── (v4) fxP2P.knownMerchantsAED/MAD (optionnel)
```

Au runtime, quand l'utilisateur s'authentifie :

| Pseudo | Déchiffre | Effet |
|---|---|---|
| `BRIDGEVALE` | `ENCRYPTED_FULL` | `window.DATA = FULL_DATA` |
| `COUPA` | `ENCRYPTED_BENOIT` | `window.DATA = BENOIT_DATA` (uniquement `benoit2025` + `benoit2026`) |
| `BINGA` | `ENCRYPTED_FULL` + `ENCRYPTED_PRIV` | `window.DATA = FULL_DATA` + overlay PRIV injecté champ par champ |

L'overlay PRIV ne **remplace pas** `DATA` — il **injecte** des champs dans les
objets existants (voir `injectPrivData()` dans `index.html`).

---

## 📦 FULL_DATA — données publiques

### Top-level keys

```js
const FULL_DATA = {
  augustin2025: { ... },   // Clôture 2025 Augustin
  augustin2026: { ... },   // En cours 2026 Augustin
  benoit2025:   { ... },   // Clôture 2025 Benoit
  benoit2026:   { ... },   // En cours 2026 Benoit
};
```

### `augustin2025` — clôture complète

```js
{
  title:    "Clôture Augustin 2025 — Réconciliation mois par mois",
  subtitle: "...",
  tauxMaroc: 10,                       // EUR/MAD fixe (10 000 DH = 1 000 €)

  // Revenus mensuels (factures RTL clôturées)
  rtl: [
    {
      ref:           "INVRTL001",
      periode:       "Jan",             // mois court
      jours:         12,
      montant:       10200,             // EUR HT
      datePaiement:  "20/03",
      recu:          10200,             // EUR réellement reçu (clôture)
    },
    // ...
  ],

  // Dépenses déclarées par Augustin mois par mois
  mois: [
    {
      nom:            "Janvier",
      actuals:        18700,           // EUR facturé ce mois
      bym:            0,               // EUR dépenses B+Y+M (Baraka/Ycarré/Councils)
      maroc:          1000,            // EUR virements Maroc
      divers:         400,             // EUR autres (vols, iPhone, etc.)
      commentaire:    "...",           // HTML autorisé (<strong>, etc.)
      badge:          "ok"|"i"|"e"|"w", // Couleur: vert/info/rouge/warning
      badgeText:      "✓ OK",
      bymHighlight:   false,           // Optionnel: highlight special (gros mois)
      marocCorrige:   false,           // Augustin a corrigé après v1
      diversVerifie:  false,           // Toutes preuves EBS trouvées
    },
    // 12 entrées (Jan-Déc)
  ],

  // Preuves détaillées par catégorie (mise en regard avec `mois[]`)
  ycarre:   [ { date: "02/06/2025", montant: 5400 }, /* ... */ ],
  councils: [ { date: "18/08/2025", excelHT: 5625, ebsHT: 5625, note?: "..." }, /* ... */ ],
  baraka:   [ { date: "14/03/2025", montant: 10000 }, /* ... */ ],

  virementsMaroc: [
    {
      mois:      "Février",           // Nom du mois (fr)
      excelEUR:  1000,                // EUR dans l'Excel d'Augustin
      detail:    "28/03 — Mère (L'Hajja) → Augustin",
      totalDH:   10000,               // MAD réellement envoyés
      corrige:   false,               // Augustin a corrigé après v1
    },
    // ...
  ],

  divers: [
    {
      mois:      "Février",
      date:      "—" | "12/11/2025",  // ISO court, ou "—" si non daté
      montant:   400,                 // EUR — signé (+ si Amine→Augustin, − si prêt remboursé)
      label:     "Vol pour Augustin",
      preuve:    "ok"|"w"|"e",        // Badge couleur
      preuveText:"✓ EBS",
    },
    // ...
  ],
  diversVerifie:    9170,             // Total vérifié (valeur absolue)
  diversNonVerifie: 0,

  insights: [                         // Analyses clés affichées tout en bas
    {
      type:  "pass"|"warn"|"fail"|"neutral",
      titre: "✅ Titre court",
      desc:  "Description HTML (<strong>, <br>, etc.)",
    },
    // ...
  ],
}
```

### `augustin2026` — année en cours (format différent)

```js
{
  title: "Augustin 2026 — En cours",
  report2025:        -1683,           // EUR carryforward de 2025 (négatif = Amine doit à Augustin)
  tauxMaroc:         10.26,           // EUR/MAD pro 2026 (= 0.95 × 10.8)
                                      // 0.95 = PERSO_FACTOR (commission Amine)

  virementsMaroc: [                   // Format différent de 2025 !
    { date: "02/01/2026", beneficiaire: "Jean Augustin", dh: 10000 },
    // ...
  ],

  rtl: [                              // Format différent de 2025 (pas de `recu`, ajout de `statut`)
    {
      ref:          "INVRTL013",
      periode:      "Janvier",         // mois long
      jours:        11,
      montant:      9350,
      dateFacture:  "31/12/2025",
      dateDue:      "01/03/2026",
      statut:       "ok"|"w"|"i"|"e",  // État du paiement
      statutText:   "Paid" | "À facturer" | "Paid 01/04",
    },
    // ...
  ],

  divers: [                           // Format simplifié (pas de mois, juste label/montant)
    {
      label:     "Augustin → Amine (via Zakaria)",
      montant:   -1200,               // EUR, montant = PERSO (cash réel)
      proOrigin: false,               // Si true: montant IS pro, Perso = montant × 0.95
    },
    // ...
  ],

  insights: [ /* même structure que 2025 */ ],
}
```

### `benoit2025` — clôture

```js
{
  title:          "Clôture Benoit 2025",
  subtitle:       "...",
  commissionRate: 0.10,                // 10% — overridé par PRIV_DATA en mode BINGA

  councils: [
    {
      date:          "18/08/2025",    // Format clôture: date complète
      htEUR:         5625,            // EUR HT
      tauxApplique:  10.500,          // Taux EUR/MAD appliqué
      // tauxMarche: injecté par BINGA depuis PRIV_DATA
    },
    // ...
  ],

  virements: [
    {
      date:         "28/07/2025",
      beneficiaire: "Benoit Chevalier",
      dh:           50000,            // MAD
      motif:        "Prêt personnel",
    },
    // ...
  ],
}
```

### `benoit2026` — année en cours

```js
{
  title: "Benoit 2026 — En cours",
  tauxApplique:   10.6,                // Valeur overridée par PRIV_DATA (BINGA)
  commissionRate: 0.10,                // Overridé par PRIV_DATA
  tvaRate:        0.21,                // TVA France

  councils: [
    {
      mois:       "Janvier",           // Format en-cours: nom du mois
      htEUR:      5000,
      statut:     "ok"|"w"|"i",        // État (paid/invoiced/todo)
      statutText: "Paid 11/02" | "Invoiced" | "À facturer",
      // tauxApplique hérité du parent (ou override par transaction)
      // tauxMarche injecté par BINGA
    },
    // ...
  ],

  virements: [                        // Format identique à 2025
    { date: "09/03/2026", beneficiaire: "Benoit Chevalier", dh: 50000, motif: "Remboursement" },
  ],

  notes: [                            // Footer affichage optionnel
    "Le virement du 06/03/2026 (31 750 DH) a été comptabilisé...",
  ],
}
```

---

## 🔐 PRIV_DATA — données privées (BINGA only)

```js
const PRIV_DATA = {

  // Override Benoit 2025 (taux marché par Council, commission)
  benoit2025: {
    commissionRate: 0.10,
    councilsTaux: [
      { date: "18/08/2025", tauxMarche: 10.505 },  // Taux EUR/MAD réel du jour
      // Une entrée par council, ordre identique à FULL_DATA.benoit2025.councils
    ],
  },

  benoit2026: {
    tauxApplique:     10.700,                      // Override taux 2026
    commissionRate:   0.10,
    councilsTauxMarche: [
      { mois: "Janvier", tauxMarche: 10.836 },
      { mois: "Février", tauxMarche: null },       // null = pas encore connu
    ],
  },

  // Pipeline FX complet (EUR → AED → USDT → MAD)
  fxP2P: {
    title:    "Analyse FX — Spreads par étape (EUR → AED → USDT → MAD)",
    subtitle: "...",

    // ---- LEG 1 : EUR → AED (conversions IFX bancaire) ----
    leg1: {
      label:       "EUR → AED (IFX)",
      description: "Conversion bancaire IFX. Spread = taux marché EUR/AED − taux IFX.",
      transactions: [
        {
          date:         "2025-03-28",      // ISO
          eur:          10200,
          aed:          39949.32,
          tauxIFX:      3.91660,           // Taux réellement appliqué par IFX
          tauxMarche:   3.96465,           // Taux marché EUR/AED du jour
          source:       "RTL" | "Malt" | "RTL+Malt",
        },
        // ...
      ],
    },

    // ---- LEG 2 : AED → USDT (Binance P2P buy) ----
    leg2: {
      label:       "AED → USDT",
      description: "Achat USDT Binance P2P. Spread = premium P2P sur le peg AED/USD.",
      tauxMarche:  3.6725,                 // Peg fixe AED/USD (UAE central bank)
      transactions: [
        {
          date: "2025-06-15",
          aed:  184.68,                    // AED dépensés
          usdt: 50.05,                     // USDT reçus
          prix: 3.690,                     // Prix P2P = aed / usdt
        },
        // ...
      ],
    },

    // ---- LEG 3 : USDT → MAD (Binance P2P sell) ----
    leg3: {
      label:       "USDT → MAD",
      description: "Vente USDT Binance P2P Maroc. Spread = premium P2P sur USD/MAD.",
      tauxMarche: {                        // Map: date → cours USD/MAD marché du jour
        "2025-06-16": 9.1228,
        "2025-06-24": 9.1170,
        // ...
      },
      transactions: [
        {
          date: "2025-06-16",
          usdt: 104.49,                    // USDT vendus
          mad:  1000.00,                   // MAD reçus
          prix: 9.570,                     // Prix P2P = mad / usdt
        },
        // ...
      ],
    },

    usdtRemaining: 319.71,                 // USDT non encore vendus

    // ---- v4+ : marchands connus (RIB validé) ----
    knownMerchantsAED: [
      // "FastTrade24-7", "RMK LTD", ...
      // Match case-insensitive. Maintenu à la main par Amine au fil
      // des transactions (ajoute le nickname Binance une fois le RIB validé).
    ],
    knownMerchantsMAD: [
      // "ELAOUNI-P2P", "Zack-Crypto", ...
    ],
  },

  // Commission Ycarré (sous-traitant Augustin)
  ycarreCommission: 0.08,                  // 8%
  ycarreTotal:      54300,                 // EUR total Ycarré 2025
};
```

---

## 🌉 Bridge localStorage → networth

`render-amine.js` écrit dans `localStorage.facturation_positions` après chaque
rendu. Les deux sites partagent l'origine `lallakenza.github.io` donc le
localStorage est commun.

```js
localStorage.setItem('facturation_positions', JSON.stringify({
  updatedAt: "2026-04-20T14:32:00.000Z",   // ISO

  augustin: {
    proEUR:  181609,                       // EUR — positif = Augustin me doit (pro)
    persoEUR: 172528,                      // EUR — positif = Augustin me doit (perso/cash)
                                           //   persoEUR = proEUR × 0.95 (PERSO_FACTOR)
    mad:     1863302,                      // MAD — positif = Augustin me doit
    tauxMaroc: 10.26,
  },

  benoit: {
    dh:        -196915,                    // MAD — positif = Benoit me doit, négatif = je lui dois
    tauxBadre: 10.700,
  },

  combined: {
    eur: -24387,                           // EUR — net combiné perso (Augustin+Benoit)
    mad: 1666387,                          // MAD — net combiné
  },
}));
```

**Côté networth** (`networth/js/engine.js`) :
- Lit `localStorage.facturation_positions`
- Si présent + récent → écrase les valeurs hardcodées Augustin/Benoit dans le
  calcul du Net Worth
- Si absent → fallback sur `portfolio.amine.facturation` (hardcodé)

**Important** : pour que networth voie les nouvelles valeurs, il faut d'abord
ouvrir le site facturation et passer par la vue Amine (qui écrit le localStorage).

---

## 🎮 Données hors-DATA

### Best score 2048 (`localStorage`, par taille de grille)

```js
localStorage.setItem('game2048_best_4', '2048');   // Grille 4×4
localStorage.setItem('game2048_best_5', '1024');   // Grille 5×5
localStorage.setItem('game2048_best_6', '512');    // Grille 6×6
```

### Marchands connus Radar (`localStorage`)

```js
localStorage.setItem('radar_known_merchants', JSON.stringify({
  AED: ['FastTrade24-7', 'RMK LTD', 'UAE-Digital-Exchange'],
  MAD: ['ELAOUNI-P2P', 'Zack-Crypto'],
}));
```

Fusionné au runtime avec `DATA.fxP2P.knownMerchantsAED/MAD` (seed canonique
depuis `encrypt.js`).

### État runtime Radar (`window._radarState`)

Pas persisté — purement in-memory pendant la session :

```js
window._radarState = {
  timer:           <setInterval id>,      // Auto-refresh 60s
  tickTimer:       <setInterval id>,      // Tick fraîcheur badge 5s
  lastLoadAt:      1713620400000,         // timestamp dernier fetch réussi
  inFlight:        false,
  peg:             3.6725,
  usdMad:          9.2572,
  usdMadDate:      "2026-04-20",
  usdMadIsLive:    true,
  buyPrice:        3.6855,                // Prix observé input (AED→USDT)
  sellPrice:       9.590,                 // Prix observé input (USDT→MAD)
  buyPriceUserSet: false,                 // true = user a tapé → auto-refresh ne touche plus
  sellPriceUserSet:false,
  usdMadUserSet:   false,
  buyData:         { /* Binance median, topPrice, offers[], transAmount */ },
  sellData:        { /* idem */ },
};
```

---

## 📊 Formules de calcul clés

### Position Augustin 2026 (EUR pro / perso / MAD)

```js
const PERSO_FACTOR = 0.95;   // 1 000€ pro = 950€ perso

// Solde entreprise (pro)
posEntreprise = Σ rtl.paid.montant              // RTL payées en EUR HT
              − Σ benoit2026.councils.paid.htEUR  // AZCS (Majalis) via Benoit
              + augustin2026.report2025;          // Carryforward 2025

// Divers (cash flows directs, signés)
diversPro  = Σ divers.montant ÷ PERSO_FACTOR   // Chaque montant est en perso par défaut
                                                // (proOrigin=true → montant est pro)
diversPerso = Σ divers.montant                  // (pour affichage)

// Position nette
posNetPro  = posEntreprise − virementsEUR − diversPro    // virementsEUR = Σ dh ÷ tauxMaroc
posNetPerso = posNetPro × PERSO_FACTOR
posNetMAD   = posNetPro × tauxMaroc
```

### Position Benoit (shared : `computeBenoitSolde()` dans `render-helpers.js`)

```js
// 2025 carryforward
net25    = Σ Math.round(council.htEUR × tauxApplique) × (1 − commissionRate)
paye25   = Σ virements.dh
report25 = net25 − paye25

// 2026 (en cours — seulement councils "paid")
netPaid26   = Σ paid_councils avec même formule que 2025
totalPaye26 = Σ benoit2026.virements.dh

// Solde global (positif = Benoit me doit, négatif = je lui dois)
solde = report25 + netPaid26 − totalPaye26;
```

### Spread P2P (pour le Radar)

```js
// BUY (AED → USDT) — vs peg fixe
buySpread = (observedPrice − 3.6725) ÷ 3.6725 × 100
// Verdict : ≤0.10 Excellent, ≤0.35 Bon, ≤0.70 Moyen, >0.70 Mauvais

// SELL (USDT → MAD) — vs USD/MAD live
sellSpread = (observedPrice − usdMadLive) ÷ usdMadLive × 100
// Verdict : ≥5.0 Excellent, ≥3.0 Bon, ≥1.0 Moyen, <1.0 Faible
```
