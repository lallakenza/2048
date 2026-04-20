# Guide de mise à jour

Procédures étape par étape pour les tâches courantes. Toutes commencent par
éditer **`encrypt.js`** (c'est le seul fichier de données à toucher) et se
terminent par un `node encrypt.js` + commit + push.

## 🎯 Workflow général

```bash
# 1. Cloner / pull
git clone git@github.com:lallakenza/facturation.git    # une seule fois
cd facturation
git pull origin main                                   # à chaque session

# 2. Éditer encrypt.js (modifier les données)
vim encrypt.js

# 3. Re-chiffrer
node encrypt.js
# Output attendu :
#   FULL (BRIDGEVALE): N bytes → M base64 chars
#   BENOIT (COUPA): N bytes → M base64 chars
#   PRIV (BINGA): N bytes → M base64 chars
#   → Written to data-enc.js
#   → Written to data-priv.enc.js

# 4. (Optionnel) Bumper la version dans index.html
vim index.html   # window.APP_VERSION = 'vN+1'; APP_VERSION_DATE = 'YYYY-MM-DD';

# 5. Commit + push
git add encrypt.js data-enc.js data-priv.enc.js index.html
git -c user.name="Amine" -c user.email="amine.koraibi@gmail.com" \
  commit -m "vN: Description"
git push origin main

# 6. Vérifier le déploiement (~60s)
open "https://lallakenza.github.io/facturation/?t=$(date +%s)"
```

**NE JAMAIS** éditer manuellement `data-enc.js` ou `data-priv.enc.js` — ils
sont régénérés par `node encrypt.js` à chaque exécution.

---

## 💼 Cas d'usage courants

### 1) Ajouter une facture RTL payée (Augustin 2026)

**Fichier** : `encrypt.js` → `FULL_DATA.augustin2026.rtl`

```js
rtl: [
  // ... entrées existantes
  {
    ref:          "INVRTL015",          // Numéro de facture
    periode:      "Avril",              // Mois long
    jours:        20,
    montant:      17000,                // EUR HT
    dateFacture:  "01/04/2026",
    dateDue:      "01/05/2026",
    statut:       "ok",                 // "ok" = Paid, "w" = Invoiced, "i" = À facturer, "e" = Problème
    statutText:   "Paid 05/05",
  },
],
```

### 2) Ajouter un virement Maroc (Augustin 2026)

**Fichier** : `encrypt.js` → `FULL_DATA.augustin2026.virementsMaroc`

```js
virementsMaroc: [
  // ... entrées existantes
  {
    date:         "15/04/2026",
    beneficiaire: "Jean Augustin",       // nickname 'Augustin' affiché via nick()
    dh:           10000,                 // MAD
  },
],
```

### 3) Ajouter un paiement Councils (Benoit 2026)

**Fichier** : `encrypt.js` → `FULL_DATA.benoit2026.councils`

```js
councils: [
  // ... entrées existantes
  {
    mois:       "Avril",                 // Nom du mois (pas une date)
    htEUR:      5000,
    statut:     "w",                     // "w" = Invoiced (en attente paiement)
    statutText: "Invoiced",
  },
],
```

Quand le paiement est confirmé, changer :
```js
{ mois: "Avril", htEUR: 5000, statut: "ok", statutText: "Paid 10/04" }
```

**Si le paiement n'est pas encore facturé** :
```js
{ mois: "Avril", htEUR: 5000, statut: "i", statutText: "À facturer" }
```

### 4) Ajouter un virement DH à Benoit

**Fichier** : `encrypt.js` → `FULL_DATA.benoit2026.virements`

```js
virements: [
  // ...
  {
    date:         "15/04/2026",
    beneficiaire: "Benoit Chevalier",   // ou "Badrecheikh Elmouksit" — nick() les mappe à "Benoit"
    dh:           50000,
    motif:        "Remboursement",
  },
],
```

### 5) Mettre à jour les taux marché (mode BINGA)

**Fichier** : `encrypt.js` → `PRIV_DATA.benoit2026.councilsTauxMarche`

```js
councilsTauxMarche: [
  { mois: "Janvier",  tauxMarche: 10.836 },
  { mois: "Février",  tauxMarche: 10.920 },    // ← remplir quand on a le cours
  { mois: "Mars",     tauxMarche: null },       // null = pas encore connu
  { mois: "Avril",    tauxMarche: null },
],
```

L'ordre doit matcher celui de `FULL_DATA.benoit2026.councils`. Le `render-benoit.js`
zippe les deux listes en parallèle.

### 6) Ajouter une transaction FX P2P (Leg 2 : AED → USDT)

**Fichier** : `encrypt.js` → `PRIV_DATA.fxP2P.leg2.transactions`

```js
transactions: [
  // ... entrées existantes
  {
    date: "2026-05-01",
    aed:  10000.00,        // AED dépensés
    usdt: 2719.52,         // USDT reçus
    prix: 3.677,           // = aed / usdt (peut être légèrement différent arrondi)
  },
],
```

### 7) Ajouter une transaction FX P2P (Leg 3 : USDT → MAD)

**Fichier** : `encrypt.js` → `PRIV_DATA.fxP2P.leg3.transactions`

```js
transactions: [
  // ...
  {
    date: "2026-05-02",
    usdt: 1000.00,         // USDT vendus
    mad:  9550.00,         // MAD reçus
    prix: 9.550,           // = mad / usdt
  },
],
```

**ET** — ajouter le cours USD/MAD marché pour cette date dans la map :

```js
tauxMarche: {
  // ... entrées existantes
  "2026-05-02": 9.270,    // Cours USD/MAD du jour (xe.com, Google, fawazahmed0)
},
```

Sans l'entrée dans `tauxMarche`, le spread de la transaction sera calculé
à 0 % (pas de référence). Toujours ajouter les deux ensemble.

### 8) Mettre à jour les USDT restants

**Fichier** : `encrypt.js` → `PRIV_DATA.fxP2P.usdtRemaining`

```js
usdtRemaining: 319.71,     // Nombre de USDT pas encore vendus
```

À calculer après chaque Leg 3 : `ancien − usdt vendus`.

### 9) Mettre à jour les marchands P2P connus (export Binance)

Le Radar USDT classe chaque marchand P2P en 3 niveaux :
- **⭐ Confirmé** — au moins une transaction *Completed*
- **🔸 RIB validé** — orders passés (même cancellés) — RIB probablement déjà ajouté à la banque
- **🆕 Nouveau** — jamais interagi → 4h de validation RIB nécessaire

La source canonique de ces listes : **`encrypt.js` → `PRIV_DATA.fxP2P`** :
- `merchantsAED` / `merchantsMAD` — tous les marchands (any status)
- `confirmedMerchantsAED` / `confirmedMerchantsMAD` — sous-ensemble Completed

#### Procédure d'update (après une session de trading P2P)

1. **Exporter l'historique Binance**
   1. Se connecter à Binance
   2. *Account → P2P → Order History*
   3. Cliquer sur **Export** → choisir la plage (ex: depuis le dernier export)
   4. Télécharger le fichier Excel (ex:
      `Binance-C2C-Order-History-YYYYMMDD_*.xlsx`)

2. **Extraire les marchands avec Python**
   ```bash
   # Depuis le repo facturation/
   python3 <<'PY'
   import openpyxl
   from collections import defaultdict

   path = "/Users/amine/Downloads/Binance-C2C-Order-History-YYYYMMDD_*.xlsx"
   # Replace with the actual file path

   wb = openpyxl.load_workbook(path)
   ws = wb.active
   # Header at row 10, data from row 11
   HEADERS = [ws.cell(10, c).value for c in range(1, ws.max_column+1)]
   idx = {h: i+1 for i, h in enumerate(HEADERS) if h}

   merchants = defaultdict(lambda: {'fiats': set(), 'completed': 0, 'total': 0})
   for r in range(11, ws.max_row + 1):
       c = ws.cell(r, idx['Counterparty']).value
       if not c:
           continue
       m = merchants[c.strip()]
       m['fiats'].add(ws.cell(r, idx['Fiat Type']).value)
       m['total'] += 1
       if (ws.cell(r, idx['Status']).value or '').lower() == 'completed':
           m['completed'] += 1

   for fiat in ['AED', 'MAD']:
       allList  = sorted([n for n, d in merchants.items() if fiat in d['fiats']])
       confList = sorted([n for n, d in merchants.items() if fiat in d['fiats'] and d['completed'] > 0])
       print(f"\n=== {fiat} ({len(allList)} all, {len(confList)} confirmed) ===")
       print(f"  merchants{fiat}:")
       for n in allList:   print(f'    "{n}",')
       print(f"  confirmedMerchants{fiat}:")
       for n in confList:  print(f'    "{n}",')
   PY
   ```

3. **Mettre à jour `encrypt.js`**
   Remplacer les arrays `merchantsAED`, `confirmedMerchantsAED`, `merchantsMAD`,
   `confirmedMerchantsMAD` dans `PRIV_DATA.fxP2P` avec le résultat du script.

4. **Re-chiffrer + deploy**
   ```bash
   node encrypt.js
   git add encrypt.js data-priv.enc.js
   git commit -m "vN: Update P2P merchants (Binance export YYYY-MM-DD)"
   git push origin main
   ```

#### Ajout rapide sans re-chiffrement (localStorage, temporaire)

Sur le site, dans Radar USDT, tu peux cliquer sur l'icône à gauche d'un marchand
pour cycler entre les 3 niveaux :
- Nouveau (☆) → RIB validé (🔸) → Confirmé (⭐) → Nouveau

Persisté dans `localStorage.radar_known_merchants` (structure
`{AED: {all:[...], confirmed:[...]}, MAD: {...}}`). Fusionné avec les listes
canoniques d'`encrypt.js` au runtime.

**Important** : le localStorage est par-device. Pour une persistance
cross-device, il faut toujours passer par l'export Binance + `encrypt.js`.

### 10) Passer à une nouvelle année (ex: 2027)

Beaucoup plus lourd — mini-refactoring :

1. **`encrypt.js`** : ajouter deux nouveaux objets
```js
augustin2027: {
  title: "Augustin 2027 — En cours",
  report2025: <to_compute>,              // Dériver de augustin2026 fermé
  tauxMaroc: 10.26,                      // Ou nouveau taux si renégocié
  virementsMaroc: [],
  rtl: [],
  divers: [],
  insights: [],
},
benoit2027: {
  title: "Benoit 2027 — En cours",
  tauxApplique: 10.7,
  commissionRate: 0.10,
  tvaRate: 0.21,
  councils: [],
  virements: [],
},
```

2. **`render-main.js`** : le yearToggle gère automatiquement 2025/2026/Tout. Pour
   ajouter 2027, modifier `yearToggle3()` dans `render-helpers.js`.

3. **`render-augustin.js`** : ajouter `renderAugustin2027()` (copier-coller
   de `renderAugustin2026`).

4. **`render-benoit.js`** : le renderer est générique — juste appeler
   `renderBenoitYear('benoit2027', { year: 2027 })`. Wrapper :
```js
function renderBenoit2027() { return renderBenoitYear('benoit2027', { year: 2027 }); }
```

5. **`render-main.js`** : dans le `switch` de `renderPanel`, router `benoit`
   vers le bon renderer selon `window.baYear`.

6. **`index.html`** : dans `switchBaYear(y)` et `switchAzYear(y)`, ajouter
   le cas `y === 2027`.

Carryforward 2026→2027 se calcule automatiquement via la logique partagée de
`computeBenoitSolde()` (lit les deux années consécutives).

### 11) Ajouter un nouveau counterpart (ex: un nouveau client)

1. **`encrypt.js`** : ajouter `nouveauClient2026: { ... }`
2. **Créer** `render-nouveauClient.js` avec :
```js
function renderNouveauClient() {
  const d = DATA.nouveauClient2026;
  // ... format HTML
  return html;
}
```
3. **`render-main.js`** : ajouter à `TAB_CONFIG` :
```js
{ id: 'nouveauClient', label: 'Nouveau Client', access: 'full' },
```
4. **`render-main.js`** : ajouter un `case 'nouveauClient': el.innerHTML = renderNouveauClient(); break;` dans `renderPanel()`.
5. **`index.html`** : ajouter `'render-nouveauClient.js'` à l'array de scripts du dynamic loader.

### 12) Changer un mot de passe d'accès

**`index.html`** : modifier la fonction `tryAccess` — l'UPPERCASE est appliqué
automatiquement, donc taper le nouveau mot de passe en minuscules marchera.

**`encrypt.js`** : modifier la variable du password correspondant dans `main()`,
puis re-exécuter `node encrypt.js`.

**Attention** : changer un mot de passe invalide tous les anciens accès. Avant
de push, partager le nouveau mdp avec les personnes concernées (pour COUPA :
Benoit).

---

## 🧪 Vérifications avant push

### Checks à faire systématiquement

1. **Syntaxe JS** — le script `verify.js` existe, ou via osascript :
```bash
osascript -l JavaScript -e "
  var fs = $.NSFileManager.defaultManager;
  ['render-amine.js','render-augustin.js','render-benoit.js',
   'render-fxp2p.js','render-gains.js','render-main.js','render-radar.js'].forEach(f => {
    var c = $.NSString.alloc.initWithContentsOfFileEncoding(f, 4).js;
    try { new Function(c); console.log(f + ' OK'); } catch(e) { console.log(f + ' ERR: '+e.message); }
  });
"
```

2. **Chiffrement réussi** — `node encrypt.js` doit afficher 3 blocs OK et
   générer `data-enc.js` + `data-priv.enc.js`.

3. **Local preview** — ouvrir `index.html` dans le navigateur et tester les
   3 pseudos (BRIDGEVALE, COUPA, BINGA). Les montants doivent matcher ton
   calcul manuel.

4. **Position Amine cohérente** — ouvrir le tab "Ma Position" et vérifier
   que les 4 hero cards (Pro, Perso, MAD Augustin, DH Benoit) matchent tes
   attentes. Le `localStorage.facturation_positions` est updated
   automatiquement.

5. **Bridge networth** — si networth est ouvert dans un autre onglet, refresh
   après avoir ouvert facturation → les positions Augustin/Benoit doivent
   matcher.

### Erreurs fréquentes

| Erreur | Cause probable |
|---|---|
| "Échec de connexion. Réessaie." | `encrypt.js` modifié sans `node encrypt.js` → blobs out-of-sync |
| Page blanche après login | Erreur JS — ouvrir la console (Cmd+Opt+I) |
| Ancien code servi | Cache navigateur → hard-refresh Cmd+Shift+R, ou `?t=timestamp` dans l'URL |
| Spread Leg 3 = 0 % | Manque l'entrée correspondante dans `leg3.tauxMarche` (map) |
| Position Augustin fausse | `divers[].proOrigin` mal réglé — montant doit être PERSO par défaut |
| Benoit solde != attendu | `commissionRate` ou `tauxApplique` pas overridé par BINGA (absent de PRIV_DATA) |

---

## 📦 Déploiement

GitHub Pages auto-deploy depuis `main`. Délai : 30–90 secondes après `git push`.

### Forcer un refresh de cache

Le site utilise `?t=${Date.now()}` pour chaque script importé donc le cache
est automatiquement contourné à chaque chargement. MAIS le CDN GitHub Pages
(fastly) met en cache les réponses HTTP pour ~10 min. Pour forcer :

```bash
# URL avec query unique
open "https://lallakenza.github.io/facturation/?t=$(date +%s)"

# Hard refresh dans le navigateur
# Mac : Cmd+Shift+R
# Windows/Linux : Ctrl+Shift+R
```

### Vérifier qu'une nouvelle version est bien déployée

```bash
curl -sI "https://lallakenza.github.io/facturation/render-radar.js" | grep last-modified
```

Si `last-modified` est ancien, attendre 1 min puis refaire. GitHub Pages est
parfois lent.

Ou directement dans la console du navigateur après login :
```js
window.APP_VERSION      // Doit être la version que tu viens de pusher
window.APP_VERSION_DATE // Doit être aujourd'hui
```

---

## 🔁 Re-encrypter sans changer les données

Parfois utile pour régénérer avec un IV différent (les IV sont aléatoires) :

```bash
node encrypt.js         # Régénère data-enc.js et data-priv.enc.js
git add data-enc.js data-priv.enc.js
git commit -m "Re-encrypt (new IVs)"
git push origin main
```

Pas de changement fonctionnel, juste un nouveau ciphertext. Utile si tu veux
éviter une corrélation temporelle entre commits.
