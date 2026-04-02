# Facturation — Architecture & Mode d'emploi

## Vue d'ensemble

Site statique hébergé sur GitHub Pages (lallakenza/facturation) permettant la réconciliation de facturation entre plusieurs parties. Données chiffrées AES-256-GCM côté client (Web Crypto API). Façade hôtelière "Riad Anwar" (riad fictif à Casablanca, quartier Habous).

---

## Personnes & Nicknames

| Nickname (site) | Personne réelle | Rôle |
|---|---|---|
| **Augustin** | Mohammed Azarkan | Consultant SAP chez RTL via Bairok Consulting LLC (EAU) |
| **Benoit** / **Benoit Chevalier** / **Badrecheikh Elmouksit** | Badre | Bénéficiaire des paiements Councils, tracking en DH |
| **Amine** | Amine (propriétaire du site) | Gestionnaire facturation, retient commissions |
| **Jean Augustin** | Bénéficiaire virements Maroc | Azarkan côté DH |
| **Nezha** | Femme d'Amine | Émettrice des virements perso EUR |
| **Hanane** | Femme d'Azarkan | Réceptrice des virements perso EUR |

**Règle absolue** : on n'affiche JAMAIS les vrais noms sur le site, uniquement les nicknames. Deux fonctions assurent ça :
- `nick(name)` : mapping exact (champs bénéficiaire, etc.)
- `nickText(text)` : remplacement regex dans les textes libres (labels, descriptions)

## Entités de facturation

| Entité | Propriétaire | Description |
|---|---|---|
| **Bridgevale** | **Amine** | Société d'Amine. |
| **Bairok Consulting LLC** | **Amine** | Société d'Amine aux EAU (Sharjah). Facture RTL en HT (TVA 0%). IBAN IFX Payments (GB). |
| **AZCS (Azarkan Consulting Services)** | **Azarkan (Augustin)** | Société d'Azarkan en Belgique. Facture Councils/Majalis en TTC (21% TVA belge). |
| **Majalis** | **Badre (Benoit)** | Société de Badre. Paie les factures AZCS pour le compte d'Amine (pay-on-behalf). |
| **CLT-UFA S.A. (RTL Group)** | Client externe | Client final au Luxembourg. Paie les factures Bairok. |

**Pas d'entreprises au Maroc** — tous les virements Maroc sont des virements personnels (cash DH entre particuliers).

---

## Règles métier — Commission & Conversion (modèle SAP multi-currency)

Chaque transaction est postée en parallèle dans 3 "devises" (comme SAP qui maintient 2-3 currencies en //) avec des taux de conversion fixes.

### Azarkan (Augustin)

Le "Pro" est le montant de base (position entreprise nette des paiements).

**Taux de conversion universels (fixes, appliqués à TOUTE transaction) :**

| Mode de paiement | Formule | Exemple (Pro = 1 000€) |
|---|---|---|
| **Pro** (virement entreprise) | = montant brut | 1 000 € |
| **Perso** (cash EUR) | = Pro × 0.95 | 950 € (Amine garde 5% commission) |
| **Maroc** (MAD) | = Pro × 10 (taux fixe) | 10 000 MAD |

**Règle universelle** : `Perso = Pro × 0.95`. Toujours. Pour CHAQUE ligne du tableau de réconciliation. Ce n'est pas un calcul item par item — c'est une conversion de devise appliquée au résultat final.

**Équivalences** :
- 1 000€ pro = 950€ perso = 10 000 MAD
- Si Augustin paye 10 000 MAD perso → équivalent 1 000€ pro
- Si Augustin paye 950€ perso → équivalent 1 000€ pro → équivalent 10 000 MAD

**Position Entreprise** = RTL reçu (Bairok) − Majalis → AZCS payé (via Badre) + Report 2025
**Position Net Pro** = Entreprise − Virements Maroc EUR − Divers Pro
**Position Net Perso** = Position Net Pro × 0.95 ← règle universelle
**Position Maroc** = Position Net Pro × tauxMaroc (10)

Divers :
- Items avec `commissionRate` (ex: 0.05) : Pro = montant / (1 − 0.05) = montant / 0.95, Perso = montant réel
- Items sans commission (dettes) : Pro = Perso = montant

### Badre (Benoit) — et les autres bénéficiaires

Le "Pro" est le HT EUR des factures Councils (AZCS → Majalis).

| Étape | Formule |
|---|---|
| 1. Conversion EUR → DH | DH = HT_EUR × tauxApplique (par transaction, typiquement 10.5–10.7) |
| 2. Commission Amine (10%) | Commission = DH × 0.10 |
| 3. Net dû à Badre | Net = DH − Commission = DH × 0.90 |

**Taux appliqué** (`tauxApplique`) : variable par transaction, basé sur le taux marché EUR/MAD au moment du paiement. En 2026, toutes les transactions utilisent 10.6. En 2025, les taux varient entre 10.5 et 10.7.

**Taux fixe d'affichage** : 10.6 utilisé dans le dashboard Amine pour convertir la position DH en EUR (estimation). Ce n'est PAS le taux de calcul — chaque transaction utilise son propre `tauxApplique`.

**Position Badre** = Report 2025 + Councils payés (net −10%) − Virements DH payés par Amine

### Résumé des règles

| Personne | Commission Amine | Taux EUR/MAD | Monnaie de suivi |
|---|---|---|---|
| Azarkan (Augustin) | 5% sur cash EUR (Perso = Pro × 0.95) | 10 (fixe) | EUR (3 options : Pro, Perso, MAD) |
| Badre (Benoit) | 10% sur DH (après conversion) | Per-transaction (~10.6) | DH |

**Important** : un virement de 1 000€ fait par Badre à Azarkan aura un équivalent DH différent pour chacun d'eux car Amine a des deals différents avec eux (taux 10 pour Azarkan, taux 10.6 pour Badre).

---

## Modes d'accès

Le site a 3 niveaux d'accès contrôlés par un "gate" (mot de passe) :

| Mode | Code d'accès | Entrée | `ACCESS_MODE` | `PRIV` | Thème | Contenu visible |
|---|---|---|---|---|---|---|
| **BRIDGEVALE** | `BRIDGEVALE` | Portail hôtel | `full` | `false` | Clair | Ma Position, Azarkan, Badre |
| **COUPA** | `COUPA` | Portail hôtel | `benoit` | `false` | Clair | Badre uniquement |
| **BINGA** | `BINGA` | Portail hôtel OU champ `#dref` | `full` | `true` | Sombre | Tous : Ma Position, Azarkan, Badre, FX P2P, Mes Gains |

### Fonctionnement du gate
- Page d'accueil = portail facturation hôtelier "Riad Anwar" (façade, Casablanca quartier Habous)
- Le champ "N° de réservation" (`#resaSearch`) accepte BRIDGEVALE, COUPA ou BINGA (case-insensitive)
- BRIDGEVALE/COUPA : déchiffre `data-enc.js` → transition vers la réconciliation
- BINGA depuis le portail : déchiffre `data-enc.js` (avec clé BRIDGEVALE) + `data-priv.enc.js` (avec clé BINGA) → mode sombre + tous les onglets
- BINGA depuis `#dref` (après login BRIDGEVALE) : déchiffre `data-priv.enc.js` en overlay → bascule en mode sombre
- Tous les mots de passe sont normalisés en MAJUSCULE avant dérivation PBKDF2 (100k itérations, SHA-256)
- Codes erronés → faux messages d'erreur hôteliers ("Aucune réservation trouvée…")

---

## Structure des fichiers

```
site/
├── index.html            # HTML + CSS + gate + crypto + year toggles + BINGA animation
├── data-enc.js           # Données publiques chiffrées (ENCRYPTED_FULL + ENCRYPTED_BENOIT)
├── data-priv.enc.js      # Données privées chiffrées BINGA (FX P2P, taux marché, spreads)
├── encrypt.js            # Script Node.js : source de vérité des données, chiffre tout
├── verify.js             # Script Node.js : 40+ checks automatisés sur les données
├── render-helpers.js     # Fonctions utilitaires (fmt, nick, nickText, tri, collapsible, yearToggle)
├── render-amine.js       # Rendu onglet "Ma Position" (vue consolidée Amine)
├── render-augustin.js    # Rendu onglet Azarkan (2025 clôturé + 2026 en cours)
├── render-benoit.js      # Rendu onglet Badre (2025 clôturé + 2026 en cours)
├── render-fxp2p.js       # Rendu onglet FX P2P (3 legs : EUR→AED, AED→USDT, USDT→MAD)
├── render-gains.js       # Rendu onglet Mes Gains (consolidation commissions + FX)
├── render-main.js        # Système d'onglets (TAB_CONFIG, buildTabs, showTab, renderAll)
└── ARCHITECTURE.md       # Ce fichier
```

### TAB_CONFIG (render-main.js)
```javascript
{ id: 'amine',    label: 'Ma Position', access: 'full' }   // BRIDGEVALE + BINGA
{ id: 'augustin', label: 'Augustin',    access: 'full' }   // BRIDGEVALE + BINGA
{ id: 'benoit',   label: 'Benoit',      access: 'all' }    // Tous les modes
{ id: 'fxp2p',    label: 'FX P2P',      access: 'priv' }   // BINGA uniquement
{ id: 'gains',    label: 'Mes Gains',   access: 'priv' }   // BINGA uniquement
```

### Cache busting
Chaque `<script>` a un paramètre `?v=N`. Incrémenter N après chaque déploiement pour forcer le rafraîchissement CDN de GitHub Pages. Version actuelle : v=53.

---

## Structure des données (encrypt.js)

### augustin2025 (clôturé)
- `rtl[]` : Factures RTL 2025 (INVRTL001→012), toutes payées
- `mois[]` : Réconciliation mois par mois (actuals, B+Y+M, Maroc, divers)
- `ycarre[]`, `councils[]`, `baraka[]` : Paiements EBS par catégorie
- `virementsMaroc[]` : Virements DH vers Augustin
- `divers[]` : Transactions diverses (vols, iPhone, prêts, virements)
- `insights[]` : Analyses clés

### augustin2026 (en cours)
- `report2025` : −1 683 € (Augustin doit à Amine, clôture 2025)
- `tauxMaroc` : 10 (taux fixe EUR/MAD pour Azarkan)
- `rtl[]` : Factures RTL 2026 avec `dateFacture`, `dateDue`, `statut`
  - Statuts : `ok` = payé, `w` = invoiced/en attente, `i` = à facturer
- `virementsMaroc[]` : Virements DH (date, bénéficiaire, montant DH)
- `divers[]` : Cash direct + virements personnels
  - `commissionRate` : si présent (0.05), Perso = montant réel, Pro = montant / 0.95
  - Sans `commissionRate` : Pro = Perso = montant (dette, pas de commission)

### benoit2025 / benoit2026
- `commissionRate` : 0.10 (10% commission Amine)
- `tvaRate` : 0.21 (21% TVA belge). Azarkan reçoit TTC, on comptabilise HT
- `councils[]` : Factures AZCS → Majalis
  - `htEUR` : Montant hors taxes en EUR
  - `tauxApplique` : Taux EUR/MAD appliqué (variable par transaction : 10.5–10.7)
  - `tauxMarche` : (PRIV) Taux marché réel au moment du paiement
  - `statut` / `statutText` : (2026 only) état du paiement
- `virements[]` : Virements DH d'Amine vers Badre
- Le **report** (carryforward) est calculé dynamiquement depuis 2025, jamais stocké

### Données privées (data-priv.enc.js, chiffré BINGA)
- `fxP2P` : Pipeline FX en 3 étapes (EUR→AED via IFX, AED→USDT via Binance P2P, USDT→MAD via P2P)
- `tauxMarche` injecté dans les transactions Benoit au runtime
- Spreads, gains FX, taux effectifs

---

## Calculs clés

### Position Azarkan (render-augustin.js)
```
// Position Entreprise (identique Pro et Perso)
posEntreprise = RTL_paid_HT − AZCS_paid_HT + report2025

// Virements Maroc — virements PERSO (pas d'entreprises au Maroc)
virementsEUR = totalMAD / tauxMaroc(10)

// Divers Pro (brut, avant commission)
diversPro = Σ (commissionRate ? montant/(1−rate) : montant)

// 3 positions — modèle SAP multi-currency
posNetPro   = posEntreprise − virementsEUR − diversPro       // Base
posNetPerso = posNetPro × 0.95                               // Règle universelle : Perso = Pro × 0.95
posNetMAD   = posNetPro × tauxMaroc(10)                      // Maroc basé sur PRO

// Commission Amine = 5% du Pro
commissionAmine = posNetPro × 0.05 = posNetPro − posNetPerso
```

### Position Badre (render-benoit.js)
```
// Par transaction Councils
DH         = Math.round(htEUR × tauxApplique)     // tauxApplique variable par tx
commission = Math.round(DH × commissionRate(0.10))
netBenoit  = DH − commission

// Réconciliation
report2025 = net2025 − payé2025                   // calculé dynamiquement
soldeBadre = report2025 + Σ netBenoit_paid − Σ virements_DH

// Conversion DH → EUR (affichage seulement, dans render-amine.js)
posEUR = soldeBadre / tauxBadre(10.6)              // taux fixe d'affichage
```

### Report (carryforward)
```
report = netDûAnnéePrécédente − totalPayéAnnéePrécédente
```
Calculé dynamiquement dans `renderBenoit2026()` à partir des données 2025.

### HT / TTC (Councils en Belgique)
```
TTC = HT × (1 + tvaRate)    // Ex: 5000 × 1.21 = 6050€
```
Azarkan (AZCS) reçoit le TTC. Le site comptabilise en HT. La colonne TTC est affichée à titre indicatif.

---

## Chiffrement

### Méthode
- AES-256-GCM avec Web Crypto API (côté client)
- Dérivation clé : PBKDF2, 100 000 itérations, SHA-256, salt fixe
- Mot de passe normalisé `.toUpperCase()` avant dérivation → case-insensitive

### Blobs chiffrés
| Blob | Clé de chiffrement | Contenu |
|---|---|---|
| `ENCRYPTED_FULL` | `BRIDGEVALE` | Toutes les données (augustin + benoit) |
| `ENCRYPTED_BENOIT` | `COUPA` | Données Benoit uniquement |
| `ENCRYPTED_PRIV` | `BINGA` | Overlay privé (FX P2P, taux marché) |

### Processus
1. `node encrypt.js` → lit les données inline, chiffre avec 3 clés, écrit `data-enc.js` + `data-priv.enc.js`
2. Côté client : `decryptBlob(blob, password)` dans index.html

---

## Fonctionnalités UI

- **Onglet Ma Position** : Vue consolidée Amine — position vs Azarkan (3 options) + position vs Badre (DH) + total estimé EUR
- **Year toggle** : Tout / 2025 / 2026 par section (via `yearToggle3()`)
- **Tri des tableaux** : Clic sur les en-têtes `th[data-sort]` pour trier (asc/desc). Types : `num` (nombres) et `date` (dates FR)
- **Toggle DH / %** : Dans Mes Gains, bascule entre montants absolus et pourcentages
- **Badges** : `ok` (vert), `w` (jaune), `i` (bleu), `fail` (rouge)
- **Hero cards** : KPIs avec code couleur vert (créance) / rouge (dette)
- **Insights** : Analyses narratives avec classes `pass`, `warn`, `fail`, `neutral`
- **Collapsibles** : Sections détaillées (factures, virements, divers) repliables

---

## Déploiement

1. Modifier les données dans `encrypt.js` (source de vérité)
2. Lancer `node encrypt.js` pour régénérer les blobs chiffrés
3. Lancer `node verify.js` pour valider (40+ checks)
4. Incrémenter `?v=N` dans index.html pour tous les scripts
5. `git add` + `git commit` + `git push`
6. GitHub Pages déploie automatiquement (~30s)
7. Si CDN cache l'ancien HTML : changer le query param URL (`?deploy=vXXx`)

---

## Vérification (verify.js)

Le script vérifie automatiquement :
- Totaux 2025 (Actuals, B+Y+M, Maroc, Divers, RTL)
- Solde clôture 2025 (= report2025 pour 2026)
- Position Entreprise, Net Pro, Net Perso, Maroc 2026
- Équivalence des 3 positions (Pro ↔ Perso + commission, Pro × 10 = MAD)
- Totaux Benoit (DH, commission, net, virements)
- Report 2025 Benoit (calculé dynamiquement)
- Virements Badre 2026 (total + count)
