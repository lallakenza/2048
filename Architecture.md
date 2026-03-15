# Architecture — Réconciliation Facturation

## Vue d'ensemble

Site statique déployé sur GitHub Pages (`lallakenza/facturation`).
3 fichiers principaux + 1 fichier chiffré :

```
index.html          → UI (gate, tabs, crypto, events)
data.js             → Données publiques (counterparts, transactions)
data-priv.enc.js    → Données privées chiffrées (AES-256-GCM)
render.js           → Toute la logique de rendu HTML
encrypt.js          → Script Node pour (re)chiffrer les données privées
verify.js           → Script de vérification des données
```

## Accès & sécurité

### 3 niveaux d'accès

| Code        | Variable              | Accès                                                    |
|-------------|----------------------|----------------------------------------------------------|
| `BRIDGEVALE`| `ACCESS_MODE='full'` | Tous les onglets (Augustin + Benoit)                     |
| `COUPA`     | `ACCESS_MODE='benoit'`| Onglet Benoit uniquement (vue client)                    |
| `BINGA`     | `window.PRIV=true`   | Mode pro : dark theme + FX P2P + Mes Gains + taux marché |

### Chiffrement

Les données sensibles (taux marché, commissions PRIV, FX P2P) sont chiffrées dans `data-priv.enc.js` via AES-256-GCM (PBKDF2, 100k itérations, sel `facturation-augustin-2025`). Le déchiffrement se fait côté navigateur quand on tape `BINGA` dans le champ "Réf. dossier".

## Structure des données (`data.js`)

### Objet global `DATA`

```javascript
const DATA = {
  augustin2025: { ... },   // Counterpart Augustin — année clôturée
  augustin2026: { ... },   // Counterpart Augustin — année en cours
  benoit2025:   { ... },   // Counterpart Benoit — année clôturée
  benoit2026:   { ... },   // Counterpart Benoit — année en cours
  // fxP2P: ENCRYPTED      // Pipeline FX (BINGA only)
};
```

### Convention de nommage

Les clés suivent le format `{counterpart}{année}` (ex: `benoit2025`, `augustin2026`).

---

## Modèle Augustin (EUR → DH via virements Maroc)

Augustin est un counterpart de type **gestion de revenus** : Amine reçoit des revenus (RTL), paie des sous-traitants (Ycarré, Baraka, Councils), et envoie de l'argent au Maroc.

### Données clé d'une année Augustin

```javascript
augustin2025: {
  title: "...",
  subtitle: "...",
  tauxMaroc: 10,                    // Taux fixe EUR/MAD (10 000 DH = 1 000€)
  report2025: -1683,                // (2026 only) Report de l'année précédente

  // Revenus
  rtl: [
    { ref: "INVRTL001", periode: "Jan", jours: 12, montant: 10200,
      datePaiement: "20/03", recu: 10200,
      statut: "ok"|"w"|"i", statutText: "..." }   // (2026: statut au lieu de recu)
  ],

  // Dépenses mensuelles (CLÔTURE ONLY — pas dans les années en cours)
  mois: [
    { nom: "Janvier", actuals: 18700, bym: 0, maroc: 0, divers: 0,
      commentaire: "...", badge: "ok"|"i"|"e", badgeText: "...",
      bymHighlight: false, marocCorrige: false, diversVerifie: false }
  ],

  // Sous-catégories de paiements (CLÔTURE ONLY)
  ycarre: [{ date: "02/06/2025", montant: 5400 }],
  councils: [{ date: "18/08/2025", excelHT: 5625, ebsHT: 5625 }],
  baraka: [{ date: "14/03/2025", montant: 10000 }],

  // Virements Maroc
  virementsMaroc: [
    // Clôture format:
    { mois: "Février", excelEUR: 1000, detail: "...", totalDH: 10000, corrige: false },
    // En cours format:
    { date: "02/01/2026", beneficiaire: "Jean Augustin", dh: 10000 }
  ],

  // Cash direct / divers
  divers: [
    // Clôture format:
    { mois: "Février", date: "—", montant: 400, label: "Vol pour Augustin",
      preuve: "ok", preuveText: "✓ EBS" },
    // En cours format:
    { label: "Augustin → Amine (via Zakaria)", montant: -1200 }
  ],
  diversVerifie: 9170,              // (CLÔTURE ONLY) Total vérifications en valeur absolue
  diversNonVerifie: 0,

  // Insights (analyses clés affichées en bas)
  insights: [
    { type: "pass"|"warn"|"fail"|"neutral",
      titre: "✅ Titre de l'insight",
      desc: "Description HTML avec <strong> etc." }
  ]
}
```

### Calculs Augustin

| Calcul | Formule |
|--------|---------|
| Total actuals | `Σ mois[].actuals` |
| Total dépenses | `Σ mois[].bym + mois[].maroc + mois[].divers` |
| Solde Excel | `actuals(Fév-Déc) − dépenses(Fév-Déc)` (exclut Janvier) |
| Delta 2026 | `Amine reçu(RTL payé) − Augustin reçu(virements÷taux) + report2025` |

---

## Modèle Benoit (Councils EUR → DH avec commission)

Benoit est un counterpart de type **sous-traitance** : il facture des Councils en EUR, Amine les convertit en DH au taux appliqué, retient 10% de commission, et paie le net en DH.

### Données clé d'une année Benoit

```javascript
benoit2025: {
  title: "...",
  subtitle: "...",
  commissionRate: 0.10,             // Taux de commission (10%)

  // Factures Councils
  councils: [
    { date: "18/08/2025",           // ou mois: "Janvier" (2026)
      htEUR: 5625,                  // Montant HT en EUR
      tauxApplique: 10.500,         // Taux EUR/MAD appliqué (par transaction)
      // tauxMarche: ENCRYPTED      // Taux marché (injecté par BINGA)
      statut: "ok"|"w",             // (2026 only) Statut du paiement
      statutText: "Paid 11/02"      // (2026 only)
    }
  ],

  // Virements DH envoyés à Benoit
  virements: [
    { date: "28/07/2025", beneficiaire: "Benoit Chevalier",
      dh: 50000, motif: "Prêt personnel" }
  ]
}
```

### Calculs Benoit

| Calcul | Formule |
|--------|---------|
| DH brut par transaction | `htEUR × tauxApplique` (arrondi) |
| Commission par transaction | `DH brut × commissionRate` (arrondi) |
| Net Benoit par transaction | `DH brut − commission` |
| Total net dû | `Σ netBenoit` |
| Total payé | `Σ virements[].dh` |
| Solde / Carryforward | `total net dû − total payé` |
| Report N+1 (2026) | `solde 2025` (calculé dynamiquement depuis `benoit2025`) |

#### Carryforward automatique

Le report 2025→2026 n'est **pas stocké dans les données**. Il est **calculé dynamiquement** dans `renderBenoit2026()` à partir des données de `benoit2025` :

```javascript
const b25 = DATA.benoit2025;
const tx25 = b25.councils.map(m => {
  const dh = Math.round(m.htEUR * m.tauxApplique);
  const commission = Math.round(dh * b25.commissionRate);
  return dh - commission;
});
const netBenoit25 = tx25.reduce((s, n) => s + n, 0);
const paye25 = sum(b25.virements, 'dh');
const report = netBenoit25 - paye25;  // Carryforward automatique
```

#### Réconciliation 2026

```
Solde 2026 = report2025 + netCouncilsPayé2026 − virementsDH2026
```

Seuls les councils avec `statut: "ok"` comptent dans la réconciliation.

---

## Mode PRIV (BINGA) — Données supplémentaires

Quand `window.PRIV = true`, les données privées sont déchiffrées et injectées :

| Donnée | Description |
|--------|-------------|
| `benoit2025.commissionRate` | Écrasé par la valeur encryptée (backup) |
| `benoit2025.councils[].tauxMarche` | Taux marché EUR/MAD par transaction |
| `benoit2026.tauxApplique` | Taux appliqué 2026 (écrasé) |
| `benoit2026.commissionRate` | Commission 2026 (écrasé) |
| `benoit2026.councils[].tauxMarche` | Taux marché par transaction |
| `DATA.fxP2P` | Pipeline FX complète (3 legs) |
| `DATA._ycarreCommission` | Commissions Ycarré |

### Colonnes additionnelles en PRIV

- **Benoit** : Taux marché, Δ taux, Gain FX, Consolidation gains Amine
- **FX P2P** : 3 legs (EUR→AED→USDT→MAD), spreads, taux effectif
- **Mes Gains** : Consolidation de tous les gains (commission + FX + P2P)

---

## Rendering (`render.js`)

### Fonctions principales

| Fonction | Description |
|----------|-------------|
| `renderAugustin2025(embedded)` | Clôture Augustin 2025 complète |
| `renderAugustin2026(embedded)` | Augustin 2026 en cours |
| `renderAugustinAll()` | Vue combinée (2026 + 2025 stacked) |
| `renderBenoit2025(embedded)` | Clôture Benoit 2025 |
| `renderBenoit2026(embedded)` | Benoit 2026 en cours |
| `renderBenoitAll()` | Vue combinée Benoit |
| `renderFXP2P()` | Pipeline FX P2P (PRIV only) |
| `renderMesGains()` | Consolidation gains (PRIV only) |
| `renderAll()` | Orchestre le rendu de tous les panels |

### Paramètre `embedded`

Quand `embedded = true`, la fonction skip le yearToggle header (utilisé dans les vues "Tout" qui empilent 2026 + 2025).

### Year toggle

Chaque onglet a un toggle **Tout / 2025 / 2026** :
- `switchAzYear(y)` → Augustin
- `switchBaYear(y)` → Benoit
- `switchFxYear(y)` → FX P2P
- `switchGainsYear(y)` → Mes Gains

---

## Guide de mise à jour

### Ajouter un nouveau paiement Councils (Benoit)

1. Ouvrir `data.js`
2. Trouver `benoit2026.councils`
3. Ajouter une ligne :
```javascript
{ mois: "Mars", htEUR: 5000, tauxApplique: 10.600, statut: "w", statutText: "Invoiced" },
```
4. Quand le paiement est confirmé, changer `statut: "ok"` et `statutText: "Paid DD/MM"`

### Ajouter un virement DH (Benoit)

1. Ouvrir `data.js`
2. Trouver `benoit2026.virements`
3. Ajouter :
```javascript
{ date: "15/04/2026", beneficiaire: "Benoit Chevalier", dh: 50000, motif: "Remboursement" },
```

### Passer à une nouvelle année (ex: Benoit 2027)

1. Dans `data.js`, ajouter `benoit2027: { ... }` avec la même structure que `benoit2026`
2. Dans `render.js`, créer `renderBenoit2027()` en copiant `renderBenoit2026()`
3. Le report 2026→2027 se calculera automatiquement comme le report 2025→2026
4. Mettre à jour le yearToggle pour inclure 2027

### Ajouter un nouveau counterpart

1. Dans `data.js`, ajouter `nouveauClient2026: { ... }` avec :
   - `title`, `subtitle`
   - `commissionRate` (si applicable)
   - `councils[]` ou équivalent (factures)
   - `virements[]` (paiements)
2. Dans `render.js`, créer `renderNouveauClient2026(embedded)` avec la logique de calcul
3. Dans `index.html` :
   - Ajouter un onglet : `<div class="tab" onclick="showTab('nouveauClient')">Nouveau Client</div>`
   - Ajouter un panel : `<div id="nouveauClient" class="panel"></div>`
   - Ajouter les fonctions de switch année
4. Mettre à jour `renderAll()` dans render.js

---

## Points d'attention architecture

### Ce qui est bien

- **Séparation claire** data / render / UI
- **Chiffrement** des données sensibles côté client
- **3 niveaux d'accès** (public, client, pro)
- **Carryforward dynamique** (pas de duplication de données)

### Ce qui pourrait être amélioré (futur)

1. **Duplication render Benoit 2025/2026** : Les fonctions renderBenoit2025 et renderBenoit2026 partagent ~70% de code. Un refactor vers une fonction générique `renderBenoitYear(year, data, report)` réduirait la maintenance.

2. **Formats de données inconsistants entre clôture et en-cours** : Augustin 2025 (clôturé) utilise `virementsMaroc[].excelEUR` alors que 2026 utilise `virementsMaroc[].dh`. Idem pour `divers[]`. Standardiser faciliterait l'ajout de nouvelles années.

3. **Noms de counterparts hardcodés partout** : Les fonctions `switchAzYear`, `switchBaYear`, `renderAugustin2025`, etc. sont nommées par counterpart. Un système générique `renderCounterpart(name, year)` permettrait d'ajouter des clients sans toucher à render.js.

4. **render.js monolithique (1194 lignes)** : Pourrait être séparé en modules par counterpart si le fichier continue de grossir.

---

## Déploiement

```bash
# Depuis /site
git add -A
git commit -m "Description du changement"
git push origin main

# Cache bust (IMPORTANT — GitHub Pages CDN)
# Incrémenter le ?v=N dans index.html pour data.js, data-priv.enc.js, render.js
sed -i 's/v=24/v=25/g' index.html
```

Le site se met à jour en ~30 secondes après le push. Si l'ancienne version persiste, ajouter un query param unique à l'URL (ex: `?deploy=v25`).

## Chiffrement des données privées

```bash
# Générer/mettre à jour data-priv.enc.js
node encrypt.js
# Le mot de passe est BINGA
# Le fichier de sortie est data-priv.enc.js
```
