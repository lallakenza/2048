# Facturation — Réconciliation Amine / Augustin / Benoit

Site statique de réconciliation bancaire et de suivi des flux multi-devises
(EUR, MAD, AED, USDT). Déployé sur GitHub Pages, **zéro backend**, données
chiffrées AES-256-GCM côté repo.

**URL live** : https://lallakenza.github.io/2048/
**Repo** : `lallakenza/2048` (branche `main` déploie automatiquement)
**Version actuelle** : `v7.6` (voir badge dans le header après login)

---

## 📚 Documentation

| Fichier | Quoi |
|---|---|
| [`Architecture.md`](./Architecture.md) | Architecture technique : modules, data flow, encryption, tab system |
| [`DATA_MODEL.md`](./DATA_MODEL.md) | Schémas complets de `FULL_DATA`, `PRIV_DATA`, `fxP2P`, localStorage bridge |
| [`UPDATE_GUIDE.md`](./UPDATE_GUIDE.md) | Comment ajouter/mettre à jour virements, Councils, RTL, FX P2P, etc. |
| [`BUG_TRACKER.md`](./BUG_TRACKER.md) | Bugs connus, root cause, fix, tests de régression |
| [`CHANGELOG.md`](./CHANGELOG.md) | Historique des versions v1 → v7.6 |

---

## 🚀 Quick start

## ⚠ Sécurité — état réel, à lire avant toute chose

**Ce dépôt est public et le chiffrement des données n'y protège rien.** Trois faits mesurés :

1. **Les clés sont livrées au navigateur.** `index.html` contient
   `decryptBlob(ENCRYPTED_PRIV, 'BINGA')` et `decryptBlob(blob, isBinga ? 'TIGRE' : upper)`.
   Le fichier est servi en HTTP 200 : n'importe qui le télécharge et lit les mots de passe.
   Un chiffrement dont le client embarque la clé n'est pas une authentification — c'est une
   porte fermée avec la clé sur la serrure.
2. **Les codes étaient aussi publiés dans ce README** et apparaissent encore dans les
   commentaires de fichiers servis. Les en retirer serait cosmétique tant que le point 1 tient.
3. **`encrypt.js` contenait toutes les données en clair** — montants, numéros de facture,
   références bancaires, et la table de correspondance des vrais noms derrière les alias, ce qui
   annulait l'intérêt du système d'alias. Corrigé : les données vivent hors du dépôt
   (`~/facturation-data/source.js`), ce script n'en garde que la logique.

### Ce qui ne peut PAS être corrigé dans le code

Tant que le site est servi publiquement, tout ce que le navigateur peut lire, un visiteur le
peut aussi. Deux issues, au choix :

- **Dépôt et site privés.** Le plus simple. GitHub Pages sur dépôt privé exige un plan payant ;
  sinon, héberger derrière une porte réelle (Cloudflare Access, gratuit jusqu'à 50 utilisateurs).
- **Données côté serveur avec authentification.** Le navigateur ne reçoit que ce à quoi le
  compte connecté a droit, et aucune clé.

### Actions manuelles indispensables

- **Changer les quatre codes** (`TIGRE`, `COUPA`, `BINGA`, `EPONGE`) : ils sont publics.
  Les changer sans traiter le point 1 ne fait que gagner du temps.
- **Décider de la visibilité** du dépôt et du site.
- **Purger l'historique Git** si les anciennes valeurs doivent disparaître — opération
  destructive, à valider explicitement, et qui casse tous les clones existants.

---

### Lire le site
1. https://lallakenza.github.io/2048/
2. Saisir le pseudo correspondant à la vue voulue.

> **Les pseudos ne sont pas écrits ici, et ne doivent l'être nulle part dans ce dépôt.**
> Ils étaient publiés dans ce README alors que `data-enc.js` est servi publiquement :
> n'importe qui pouvait lire le code, télécharger le blob et tout déchiffrer. Le
> chiffrement ne protégeait donc rien. Les pseudos vivent dans un gestionnaire de mots
> de passe ; les retirer d'ici ne suffit pas — **ils doivent être changés**, l'historique
> Git conservant les anciennes valeurs.

### Modifier les données
```bash
git clone git@github.com:lallakenza/2048.git
cd 2048

# 1. Éditer encrypt.js (c'est là que vivent TOUTES les données en clair)
vim encrypt.js

# 2. Re-chiffrer
node encrypt.js          # produit data-enc.js + data-priv.enc.js

# 3. Commit + push
git add encrypt.js data-enc.js data-priv.enc.js
git commit -m "vN: description"
git push origin main

# 4. Bumper window.APP_VERSION dans index.html (1 ligne)
```

Le site se met à jour en ~30–60 s après le push.

Procédures détaillées → [`UPDATE_GUIDE.md`](./UPDATE_GUIDE.md).

---

## 🗂 Structure du repo

```
2048/                       # repo local, clone de lallakenza/2048
├── index.html              — UI, CSS, login gate, crypto, event wiring
├── game-2048.js            — Jeu 2048 (façade de camouflage sur la cover)
│
├── encrypt.js              — ⭐ SOURCE DE VÉRITÉ des données (à éditer)
├── data-enc.js             — Auto-généré par encrypt.js (TIGRE + COUPA)
├── data-priv.enc.js        — Auto-généré par encrypt.js (BINGA)
│
├── render-main.js          — TAB_CONFIG, buildTabs, showTab, renderPanel
├── render-helpers.js       — Formatage (fmt, badge, sum, yearToggle), computeBenoitSolde
│
├── render-amine.js         — Onglet "Ma Position" (hero cards + bridge localStorage)
├── render-augustin.js      — Onglet "Augustin" (2025, 2026, Tout)
├── render-benoit.js        — Onglet "Benoit" (2025, 2026, Tout, générique)
├── render-fxp2p.js         — Onglet "FX P2P" (pipeline EUR→AED→USDT→MAD)
├── render-gains.js         — Onglet "Mes Gains" (consolidation 5 sources)
├── render-radar.js         — Onglet "Radar USDT" (Binance P2P live, gauges)
│
├── verify.js               — Script de vérification (optionnel)
│
├── README.md               — 👈 ici
├── Architecture.md         — Architecture détaillée
├── DATA_MODEL.md           — Schémas des données
├── UPDATE_GUIDE.md         — Procédures d'édition
├── BUG_TRACKER.md          — Bugs identifiés + fixes
└── CHANGELOG.md            — Historique des versions
```

---

## 🔑 Principes clés

### 1. Un seul fichier source pour les données
**`encrypt.js`** contient TOUT en clair dans les constantes `FULL_DATA`,
`BENOIT_DATA`, `PRIV_DATA`. C'est le seul fichier à éditer pour mettre à jour
quoi que ce soit. Le script lui-même le chiffre en `data-enc.js` et
`data-priv.enc.js` qui sont déployés sur GitHub Pages.

**Règle d'or** : on n'édite JAMAIS `data-enc.js` ou `data-priv.enc.js`
manuellement — ils sont régénérés par `node encrypt.js`.

### 2. Trois niveaux d'accès via 3 mots de passe
| Vue | Déchiffre quoi | Usage |
|---|---|---|
| Vue complète | `ENCRYPTED_FULL` | Amine (tous les onglets publics) |
| Vue Benoit | `ENCRYPTED_BENOIT` | à partager avec Benoit |
| Mode pro | `ENCRYPTED_FULL` + `ENCRYPTED_PRIV` | + taux marché, commissions, FX P2P, Radar |

Les pseudos correspondants ne figurent pas dans ce dépôt (voir l'avertissement plus haut).

Saisir un pseudo INVALIDE → on tombe sur le **jeu 2048** (façade). Rien ne
laisse penser qu'on vient de tomber sur une gate protégée — c'est voulu.

### 3. Multi-devise natif
Toutes les transactions sont stockées dans leur devise native :
- **EUR** — RTL, Malt, virements IFX
- **MAD** — virements Maroc (Augustin), paiements Benoit
- **AED** — virements Émirats (IFX)
- **USDT** — pipeline P2P
- **USD** — iPhones, virements

Les conversions se font au moment du rendu, avec les taux stockés
explicitement par transaction (jamais de taux global hardcodé).

### 4. Zéro backend, tout client-side
- Déchiffrement dans le navigateur (Web Crypto API)
- Pas d'API server → aucune fuite possible côté infra
- Cache-busting automatique (`?t=${Date.now()}` sur chaque script)
- Auto-deploy GitHub Pages (push = prod en ~60 s)

### 5. Bridge vers le dashboard networth
Même origine (`lallakenza.github.io`) → `localStorage` partagé.
`render-amine.js` écrit `facturation_positions` avec les soldes Augustin/Benoit
qui sont lus par `networth/js/engine.js` pour auto-updater les créances/dettes
dans le dashboard patrimonial. Voir [`DATA_MODEL.md`](./DATA_MODEL.md) §Bridge.

---

## 🎯 Versioning du site

Source de vérité : `index.html` (en-tête)
```html
<script>
  window.APP_VERSION = 'v7.6';
  window.APP_VERSION_DATE = '2026-05-06';
</script>
```

Le badge visible dans le header après login est auto-rempli depuis ces deux
variables. À bumper sur chaque commit substantiel. Voir [`CHANGELOG.md`](./CHANGELOG.md).

---

## 🤝 Conventions

### Nicknames (jamais de vrais noms sur le site)
| Vrai nom | Nickname |
|---|---|
| Jean Augustin / Augustin | **Augustin** |
| Benoit Chevalier / Benoit / Badre | **Benoit** |

Gérés dans `render-helpers.js` (`NICK_MAP`, `nick()`, `nickText()`).

### Commits
```bash
git -c user.name="Amine" -c user.email="amine.koraibi@gmail.com" \
  commit -m "vN: Short description"
```
Messages en français OK. Toujours mentionner la version bumpée si applicable.

### Signes & display
- `+` = reçu, `−` = sorti (convention universelle dans le site)
- Nombres : `198 475` (espace = séparateur milliers), `10,500` (virgule = décimale)
- Taux : 3 décimales (`10,600`), spreads : 2 décimales (`+0,29 %`)

---

## 🧩 Tech stack

- Pure HTML/CSS/JS (pas de framework, pas de bundler)
- **Web Crypto API** (AES-256-GCM, PBKDF2 100k iters, salt fixe)
- **GitHub Pages** (branche `main`, deploy auto)
- **Binance P2P public API** (via `corsproxy.io` pour contourner le CORS)
- **fawazahmed0/currency-api** (USD/MAD live)
- Chart.js : aucune dépendance (tableaux HTML natifs)

---

## 🆘 Troubleshooting rapide

| Symptôme | Première piste |
|---|---|
| Page qui reste sur le 2048 | Pseudo faux (vérifier casse : UPPERCASE auto) |
| « Échec de connexion » | `encrypt.js` modifié sans re-chiffrement → refaire `node encrypt.js` |
| Radar : « Binance inatteignable » | CORS proxy down → saisir le prix manuellement |
| Ancien code servi | Cache navigateur → hard-refresh (Cmd+Shift+R) |
| networth n'a pas mes positions | Ouvrir ce site d'abord → `localStorage` se remplit |

Bugs détaillés → [`BUG_TRACKER.md`](./BUG_TRACKER.md).
