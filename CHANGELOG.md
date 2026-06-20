# Changelog

Toutes les versions substantielles du site. Le numéro de version est exposé
via `window.APP_VERSION` dans `index.html` et affiché dans le header après
login.

Le site a démarré sans versionnage ; l'introduction du système s'est faite en
`v1` (2026-04-19). Les entrées antérieures sont regroupées sous "pre-v1".

---

## `v7.18` — 2026-06-19

### 🇲🇦 3ème thème 2048 : « Hakimi » (couleurs de l'équipe du Maroc)

Ajout d'un 3ème thème au jeu 2048 (façade), à côté de Classique et Stitch :
**Hakimi** — rouge/vert/or aux couleurs des Lions de l'Atlas.
- Fond champ rouge (#6d0f16) + halo vert central (l'étoile du drapeau), boutons
  verts (#006233), tuiles sable → rouge (#c1272d) → vert (#006233) → étoile dorée
  pour la 2048. Étoile verte (pentagramme) + badge « 🇲🇦 Lions de l'Atlas » au-dessus
  du titre, visibles seulement dans ce thème.
- `applyTheme()` généralisé (3 thèmes), persistance `localStorage['fx_2048_theme']`
  = `classic|stitch|hakimi`. Switcher à 3 boutons (tient sur une ligne à 375px).
- Aucune image (pas de photo joueur — droits) : l'étoile est un caractère ★ stylé.
  Vérifié : lisibilité OK, Classique/Stitch intacts, 0 erreur console.

Bump v7.17 → v7.18.

---

## `v7.17` — 2026-06-19

### 🔒 SÉCURITÉ : zéro vrai nom dans les fichiers servis (NICK_MAP → blob chiffré)

Suite logique du fix v7.16. Les vrais noms n'apparaissent désormais **dans AUCUN
fichier servi publiquement** (vérifié : 0 occurrence).

**1. Table d'alias déplacée dans le blob chiffré.** `render-helpers.js` ne contient
plus le `NICK_MAP` (vrais noms ↔ alias). La table vit maintenant dans chaque blob
chiffré (`_nick`), injectée au runtime par `applyNick()` après déchiffrement.
**Isolement par contrepartie** : le blob Benoit (COUPA) ne contient QUE les alias
augustin+benoit (aucun Bob), le blob Bob (TESLA) que augustin+bob (aucun Benoit) —
une contrepartie authentifiée ne peut pas décoder l'identité des autres. Le blob
full (TIGRE/BINGA) a tout.

**2. Commentaires de code scrubés.** Tous les vrais noms dans les commentaires des
fichiers servis (render-amine/augustin/bob/gains/helpers, index.html) remplacés par
les alias (plusieurs étaient des « decoder rings » explicites type « Azarkan = alias
Augustin »).

**3. `commissionMohammedRate` → `commissionAugustinRate`** (le nom de propriété
exposait « Mohammed »). Renommé dans les données + les 5 lecteurs.

**4. Couverture `nickText()` complétée.** 2 chaînes rendues + plusieurs champs data
(insights/divers/commentaires Augustin, subtitle/notes Benoit) affichaient encore
les vrais noms dans le DOM post-login faute de `nickText()` ; corrigé. Vérifié dans
les 4 modes (TIGRE/COUPA/TESLA/BINGA) + bascules d'année : 0 vrai nom rendu.

**5. Alias société** : ZOR Consulting → « Molenbeck » désormais aussi dans la table
`_nick` (chiffrée) → toute occurrence « ZOR » dans les données s'affiche « Molenbeck ».

Reste exposés (acceptable) : les **alias** (Augustin/Benoit/Bob) et noms de sociétés
non anonymisés (Bridgevale/AZCS/Majalis). Fichiers : render-helpers/amine/augustin/
benoit/bob/gains.js, index.html, encrypt.js. Bump v7.16 → v7.17.

---

## `v7.16` — 2026-06-19

### 🔒 SÉCURITÉ : encrypt.js (base en clair) n'est plus servi publiquement + alias Molenbeck

**Faille corrigée** : GitHub Pages servait depuis `main:/` SANS exclusion → tous
les fichiers source étaient téléchargeables publiquement, dont **`encrypt.js`** qui
contient **toute la base en clair** (`FULL_DATA` + `PRIV_DATA` : montants, vrais
noms, transactions). Le chiffrement AES (TIGRE/COUPA/BINGA/TESLA) était donc
**entièrement contournable** par `lallakenza.github.io/2048/encrypt.js`. Idem pour
`verify.js` et les `*.md` (noms + montants en clair).

**Fix** : ajout d'un `_config.yml` (Jekyll) qui exclut du build Pages : `encrypt.js`,
`verify.js`, `render.js` (mort), `scripts/`, `content_escaped.json`, tous les `*.md`.
Fichiers gardés en version (repo) mais **plus publiés**. Vérifié post-déploiement :
`encrypt.js` → 404, fichiers runtime → 200, site fonctionnel. ⚠️ Ne JAMAIS ajouter
de `.nojekyll` (réexposerait tout).

**Reste à traiter (suivi)** : `render-helpers.js` (servi, runtime) expose encore le
`NICK_MAP` (mapping vrais noms ↔ alias). Le masquer nécessite de déplacer la map
dans le blob chiffré — chantier séparé.

**Anonymat Molenbeck** : la société de Hamza (réelle = ZOR Consulting) est désormais
nommée **« Molenbeck »** partout (alias, comme Augustin/Benoit/Bob pour les personnes).
ZOR n'apparaît dans aucun fichier servi ; le mapping ZOR↔Molenbeck reste local
(mémoire), jamais dans `NICK_MAP` public.

Bump v7.15 → v7.16.

---

## `v7.15` — 2026-06-19

### Bob : fusion colonnes commission + commission Augustin dans sa position + networth somme les 3 tiers

**Onglet Bob** : les 2 colonnes « Comm. Amine 10 % » et « Comm. Augustin 3 % »
fusionnées en une seule **« Commission 13 % »** (table + réconciliation). La
réconciliation précise que **c'est Amine qui paie Bob** (Amine encaisse l'argent).

**Commission Augustin sur le flux Bob** : modèle clarifié — Amine encaisse, retient
sa commission (10 %), **reverse à Augustin sa part (3 %)**, puis paie Bob (87 %).
La part Augustin est désormais **intégrée à la position Augustin** (dashboard « Ma
Position ») : ligne « Commission dispatch Bob », Amine doit **+108 € / +1 145 DH**
à Augustin → réduit ce qu'Augustin doit à Amine (ligne séparée, montants au taux
Bob, hors facteur 0,95). Augustin n'est plus présenté comme partie dans la
réconciliation Bob.

**Bridge networth — somme des 3 tiers** : le bridge localStorage émet désormais le
schéma **`counterparts`** (Augustin incl. commission Bob + Benoit + Bob, chacun en
`signedMAD`). networth (déjà conçu pour ce schéma) somme automatiquement les 3 dans
les créances/dettes, et le NW via `combined.mad` (Σ = −123 410 DH). **Aucune
modification côté networth nécessaire.**

Fichiers : `render-bob.js`, `render-amine.js`, `index.html`. Bump v7.14 → v7.15.

---

## `v7.14` — 2026-06-19

### Bob : mot de passe `EPONGE` → `TESLA` + 1er versement Hamza

**Mot de passe** : la porte dédiée de Bob passe de `EPONGE` à `TESLA` (demande
d'Amine). Changé dans `index.html` (`tryAccess`) ET `encrypt.js` (chiffrement du
blob `ENCRYPTED_BOB`) — les deux doivent rester synchrones. `EPONGE` ne décrypte
plus rien (vérifié). Bump v7.13 → v7.14 (changement de code dans l'inline script).

**1er versement Bob (data)** : Molenbeck (société de Hamza) a payé
**3 600 € HT** à Bridgevale (reçu via Wise). Enregistré comme council payé dans
`bob2026` :
- HT 3 600 € × taux 10,6 = **38 160 DH** brut.
- Commission 13 % : 3 816 DH (Amine 10 %) + 1 145 DH (Augustin 3 %).
- **Net Bob = 33 199 DH** → Amine doit dispatcher ce montant à Hamza (via Azarkan).
- Solde Bob 2026 : **+33 199 DH** (Amine doit Bob). Visible dashboard + Mes Gains
  (part Amine 3 816 DH).
- **À préciser** (non fournis) : période exacte de la prestation, réf facture
  Bridgevale, date de paiement. Libellé provisoire « Versement 1 ». tauxMarche =
  10,6 par défaut (0 gain FX tant qu'aucun cours réel daté n'est disponible).

Bump : v7.13 → v7.14

---

## `v7.13` — 2026-06-19

### Nouveau tiers : Bob (Hamza El Azzouzi) — onglet + porte dédiée

Introduction d'un 3ème tiers à côté d'Augustin (Azarkan) et Benoit (Badre).
Alias **Bob** (= Hamza El Azzouzi), suivant la convention d'obfuscation : les
vrais noms n'apparaissent jamais en clair (id `bob`, clé `bob2026`,
`render-bob.js`) ; `nick()`/`nickText()` traduisent à l'affichage.

**Modèle comptable (`bob2026`, 2026 uniquement, en-cours)** :
- Amine facture Hamza via **Bridgevale Consulting** (société UK) → flux
  international **HT, pas de TVA** (Hamza en BE, Bridgevale au UK).
- **Azarkan (Augustin)** récupère et dispatche temporairement les fonds à
  Hamza (en attendant qu'il ait son propre compte).
- **Commission 13 % = 10 % Amine + 3 % Augustin** (dispatch). Net Hamza = brut
  − 13 %. Le 3 % Augustin n'est PAS un gain Amine (exclu de "Mes Gains").
- Tracking multidevise comme Badre : factures HT en €, converties en DH au
  `tauxApplique` de chaque ligne, payées en DH. `report2025 = 0`.
- Données initiales vides — scaffold prêt à recevoir Councils/virements.

**Accès & isolement (refactor visibilité)** :
- Nouvelle **porte `EPONGE`** → blob `ENCRYPTED_BOB` (chiffré AES-256-GCM),
  mode `bob` : Hamza ne voit QUE son onglet.
- `isTabVisible` refactoré avec `soloMode` : `COUPA`→Benoit seul,
  `EPONGE`→Bob seul (plus de fuite croisée entre tiers). Vérifié : EPONGE ne
  décrypte pas Benoit, COUPA ne décrypte pas Bob.
- `TIGRE`/`BINGA` (Amine) voient Bob avec les autres. PRIV (`BINGA`) injecte
  les taux marché Bob (`bob2026.councilsTauxMarche`) → gain FX, masqué à Bob.

**Intégrations** :
- Dashboard "Ma Position" : section Bob + colonne "vs Bob" (grille 5 colonnes)
  + Bob inclus dans le total combiné EUR/MAD affiché.
- "Mes Gains" : ligne Bob (commission 10 % Amine + écart taux) dans le récap
  2026 ; détail par facture quand des données existent.
- Bridge localStorage : nouvelle clé `bob` (additive). **networth inchangé**
  (il agrège `augustin.mad` + `benoit.dh`, ne lit pas `combined`) → Bob reste
  hors NW tant qu'on ne le câble pas explicitement côté networth.

Fichiers : `encrypt.js`, `render-bob.js` (nouveau), `render-helpers.js`,
`render-main.js`, `render-amine.js`, `render-gains.js`, `index.html`.

Bump : v7.12 → v7.13

---

## `v7.12` — 2026-05-14

### Augustin 2026 — INVRTL015 payé + INVRTL016 facturé

Source : 2 PDFs reçus de RTL/Bairok.

**INVRTL015 (Mars, 20j, 17 000€ HT)** :
- Précédemment placeholder `ref: "—" / statut: "à facturer"`
- Confirmée : facturée 01/04/2026, due 01/05/2026
- **Payée 13/05/2026** (payment advice CLT-UFA 17 000€, doc 1700001468)
- `statut: "ok", statutText: "Paid 13/05"`

**INVRTL016 (Avril, 15j, 12 750€ HT)** : **NOUVELLE FACTURE**
- Period: April 2026 invoicing from 16/03 to 10/04
- 15j × 850€ = 12 750€ HT (TVA 0%)
- Facturée 04/05/2026, due 04/06/2026 (30 jours)
- `statut: "w", statutText: "Invoiced"` — paiement attendu sous ~30j

**Récap RTL 2026** :
- Total facturé : 9350 + 17000 + 17000 + 12750 = **56 100€ HT**
- Total reçu : 9350 + 17000 + 17000 = **43 350€** (INVRTL013/014/015)
- En attente : 12 750€ (INVRTL016)

L'insight Factures RTL 2026 mis à jour : "3 payées, 1 en attente".

Bump : v7.11 → v7.12

---

## `v7.11` — 2026-05-14

### Backfill — taux marché par défaut pour Badre
Les 4 placeholders `null` dans `PRIV_DATA.benoit2026.councilsTauxMarche`
(AZCS0003-6, backlog 2025 paid en mars 2026) sont remplis avec **10,6**
— le taux deal Amine-Badre par défaut.

Conséquence : pas de gain FX comptabilisé sur ces 4 transactions (tauxMarche
== tauxApplique → diff = 0). Si un cours marché réel devient disponible
pour ces dates, il pourra remplacer la valeur 10,6.

Convention documentée en commentaire dans `encrypt.js` :
> Pour Badre, tauxMarche par défaut = 10,6 (= taux deal Amine-Badre,
> identique à tauxApplique → 0 gain FX sur ces lignes). On ne met un
> autre tauxMarche QUE quand un cours marché réel est disponible.

Pour Azarkan (`augustin2026.tauxMaroc: 10.26`) : rien à changer, déjà
correct par convention deal annuel (v7.6).

Bump : v7.10 → v7.11

---

## `v7.10` — 2026-05-14

### Benoit 2026 — paiement AZCS0002 + nouvelle facture AZCS0007

Trois PDFs reçus de Badre : 1 facture Azarkan + 2 reçus de paiement
BNP Paribas Fortis (Majalis → AZCS, pay-on-behalf model).

**AZCS0002 — passé à PAYÉ** :
- 5 000 € HT (8j × 625) — invoicée 27/02/2026
- Payée par Majalis le **13/05/2026** (6 050 € TTC = 5000 × 1,21)
- `statut: "w" → "ok"`, `statutText: "Invoiced" → "Paid 13/05"`

**AZCS0007 — nouvelle facture (Avril 2026), DIRECTEMENT PAYÉE** :
- 8,5 jours × 625€ = **5 312,50 € HT** (TTC 6 428,13 €)
- Invoicée 30/04/2026, échéance 14/06/2026
- Payée par Majalis le **13/05/2026** (same-day après AZCS0002)
- Tauxapplique : 10,600 (conv. EUR/MAD interne Amine-Badre, inchangée)

**`tauxMarche` PRIV** :
- AZCS0002 : `null → 10,7214` (EUR/MAD du 13/05/2026 via fawazahmed0)
- AZCS0007 : `10,7214` (même date de paiement)
- Backlog AZCS0003-6 : entrées explicites avec `null` (placeholder pour
  backfill futur). Le rendu Mes Gains montrera `—` jusqu'à backfill.

**Impact** :
- Benoit councils 2026 passe de **6 → 7 entrées**
- AZCS payés 2026 : 5 → **7** (sur 7) — Fév + Avril sont les nouveaux paid
- HT total payé : 30 625 € → **40 937,50 €** (+5000 + 5312,50)
- Net dû Benoit (90%) augmente, virements Amine→Badre inchangés (250k DH)

Bump : v7.9 → v7.10 (2026-05-14)

---

## `v7.9` — 2026-05-12

### Données FX P2P — import export Binance C2C
Import des transactions Completed 2026 depuis l'export Binance C2C
(file UTC+10, dates converties en Morocco time UTC+1).

**Leg 2 (AED → USDT) — +4 transactions** :
- 2026-04-20 — RMK LTD — 10 000 AED → 2 713,70 USDT @ 3,685
- 2026-05-11 — Abdulla_Saif_Mohamme — 5 000 AED → 1 357,22 USDT @ 3,684
- 2026-05-11 — Abdulla_Saif_Mohamme — 14 400 AED → 3 908,79 USDT @ 3,684
- 2026-05-11 — amro_sd — 13 250 AED → 3 597,61 USDT @ 3,683

**Leg 3 (USDT → MAD) — +8 transactions** :
- 2026-04-22 — User-859a0 — 2 085,50 USDT → 20 000 MAD @ 9,59
- 2026-05-11 — 7 ventes (5k, 20k, 6k, 9k, 8k, 24k, 13,5k MAD) @ 9,63–9,64

**Cours USD/MAD marché (fawazahmed0)** :
- 2026-04-22 : 9,2545
- 2026-05-11 : 9,1214

**`usdtRemaining`** : 319,71 → **937,10 USDT**
  (+11 577,32 leg2 / −10 959,93 leg3 = +617,39 net)

**Marchands P2P** :
- AED `merchants` +8 (-Pro-Merchant, abdullah_trader2, Abdulla_Saif_Mohamme,
  amro_sd, M7usdt, Mooddy, OFFICIAL__MERCHANT, SalimCapital)
- AED `confirmedMerchants` +2 (Abdulla_Saif_Mohamme, amro_sd)
- MAD `merchants` +8 (P2P-59dbaepc, P2P-76c3f3dh, P2P-fc2d6fbv, R-A-H-I-L,
  Rachid_Erin, User-35404, User-732eb, User-859a0)
- MAD `confirmedMerchants` +7 (tous sauf P2P-fc2d6fbv qui est Cancelled)

Bump : v7.8 → v7.9

---

## `v7.8` — 2026-05-12

### Données — Augustin + Benoit (rapprochement banque)

**Correction date Augustin** : le virement 20 000 DH à Jean Augustin
était daté `23/04/2026` (v7.5). Le commit ayant été fait le 6 mai mais
avec un system date erroné (snapshot Apr 23 dans le contexte session),
la date a été figée 13 jours trop tôt. La banque confirme exécution
**06/05/2026** — date corrigée pour matcher.

**Ajout 3 virements Benoit (Badrecheikh Elmouksit)** :
- 11/05/2026 — 50 000 DH (remboursement)
- 11/05/2026 — 50 000 DH (remboursement)
- 12/05/2026 — 50 000 DH (remboursement)

Cumul Benoit 2026 passe de **100 000 DH → 250 000 DH** payés.
Cumul Augustin 2026 reste 80 000 DH (date corrigée, montant inchangé).

Bump : v7.7 → v7.8

---

## `v7.7` — 2026-05-11

### Bug fix — USD/MAD stale date sur le Radar (cache jsdelivr)
**Symptôme** : le badge `live YYYY-MM-DD` à côté du taux USD/MAD sur le
Radar pouvait afficher une date vieille de plusieurs jours, même après
hard-refresh, sans aucun signal d'erreur.

**Root cause** : l'API `fawazahmed0/currency-api` est servie via jsdelivr
avec le header `cache-control: public, max-age=604800, s-maxage=43200`
— donc **7 jours en cache navigateur** + 12h au CDN edge sur le tag
`@latest`. Une fois `@latest` mis en cache localement, le browser sert
la même réponse pendant une semaine sans rappeler l'API, et la date
`j.date` retournée est figée à celle du premier fetch.

**Fix** : pointer vers des URLs **date-pinnées** `@YYYY-MM-DD/...` (donc
immuables, le cache TTL est inoffensif puisque l'URL change chaque jour).
Cascade : `today` → `yesterday` (au cas où le snapshot du jour n'est pas
encore publié vers 16h UTC) → `@latest` (filet) → mirror `pages.dev`.

Appliqué dans :
- `render-radar.js` (`radarFetchUsdMad`) — affichage live sur le Radar
- `scripts/poll-p2p.js` (`fetchUsdMad`) — cron horaire qui alimente
  l'historique du spread (le CDN edge `s-maxage=43200`/12h pouvait aussi
  fausser la date dans `data-history.enc.js`)

**Vérif manuelle** :
- `@2026-05-09/.../usd.json` → `date: 2026-05-09, usd.mad: 9.1204`
- `@2026-05-11/.../usd.json` → `date: 2026-05-11, usd.mad: 9.1214`
- `@latest/.../usd.json` (réponse fresh) → `date: 2026-05-11, usd.mad: 9.1214`

Bump : v7.6 → v7.7

---

## `v7.6` — 2026-05-06

### Doc refresh + clarification deal Augustin
Suite à un audit complet du site, plusieurs incohérences documentaires ont
été corrigées (le runtime n'a pas changé) :

**`encrypt.js` — clarification `tauxMaroc`** :
Commentaires ajoutés sur `augustin2025.tauxMaroc: 10` et
`augustin2026.tauxMaroc: 10.26` pour expliquer que ce ratio est un **deal
contractuel négocié annuellement avec Augustin**, pas un taux marché EUR/MAD.

**`Architecture.md` — refresh majeur** :
- Mention du repo `lallakenza/2048` (et non plus `lallakenza/facturation`)
- Façade : jeu 2048 (et non plus "portail Riad Anwar" — supprimé en v6.1)
- Passwords : `TIGRE` (remplace `BRIDGEVALE` depuis v6), `COUPA`, `BINGA`,
  `BINANCE` (mode radar-only, ajouté en v6)
- TAB_CONFIG mis à jour avec `radar`
- Section "Fonctionnalités UI" : ajout Radar USDT, cover 2048 avec thème
  Stitch, cron P2P horaire avec alerte mail
- Cache-busting : auto via `<script>`-loader (suppression mention `?v=N`)
- Structure des fichiers : ajout `assets/`, `data-history.enc.js`, `scripts/`,
  `.github/workflows/`
- `tauxMaroc` documenté comme deal annuel (10 en 2025 → 10,26 en 2026)

**`README.md`** : version actuelle bumpée v3 → v7.6.

### Pas de changement runtime
Aucun `.js` ni `.html` modifié hors le bump version + commentaires data.
Le déploiement reste identique fonctionnellement.

Bump : v7.5 → v7.6

---

## `v7.5` — 2026-04-23

### Données — Augustin 2026
- Nouveau virement Maroc : **20 000 DH** envoyés à Jean Augustin le 23/04/2026.
  → Total 2026 : 80 000 DH (5 virements depuis janvier).

### Header — fix sous-titre incorrect
Le sous-titre claimait "Taux de conversion : 10 000 DH = 1 000 €", ce qui
implique un taux fixe 10:1 inexistant. Les vrais taux varient (10,26 pour
Augustin 2026, 10,5–10,6 pour les Councils Benoit, etc.).
Remplacé par : "Suivi des paiements et positions multi-devises ·
EUR · MAD · USDT (taux du jour)".

Bump : v7.4 → v7.5

---

## `v7.4` — 2026-04-23

### 2048 cover — Thème Stitch
Nouveau thème alternatif pour la façade 2048 : **👾 Stitch** (inspiré de
Lilo & Stitch). Toggle classic/stitch persisté dans
`localStorage.fx_2048_theme`.

**Palette Stitch** (override des `--g-*` CSS vars + `.g-v2..v8192`) :
- Fond aurora sky-blue → lavande (radial-gradient multi-couches)
- Tuiles pale-blue → teal → pink → purple → midnight
- Chrome bleu/rose-magenta, inputs pâles
- Message overlays roses (win) / bleu-pâle (lose)

**Mascotte Stitch** : vraie image PNG du perso (pngimg.com, transparente)
affichée au-dessus du titre "2048", avec animations :
- Bob idle 3.6s (-2° / +2° oscillation)
- Wiggle au hover (rotation +8° / -8° + scale 1.04)
- Masquée en thème classique

**Badge "👾 Experiment 626"** : pill décorative rose au-dessus du Stitch.

**Toggle** : pill segmentée "🟫 Classique" / "👾 Stitch", gradient
bleu→magenta sur le bouton actif en Stitch mode.

Bump : v7.3 → v7.4 (2026-04-23)

---

## `v7.3` — 2026-04-23

### Radar USDT — Graphs interactifs
- **Sparklines BUY + SELL devenus interactifs** : crosshair vertical + dot
  plus large au hover, tooltip flottant qui affiche date/heure, spread,
  verdict coloré (✅/⚠️/❌) et diff vs moyenne.
- **Hauteur passée de 80px → 140px** avec padding pour accueillir axes.
- **Axe Y** : 3 ticks labelled (min, threshold, max) avec gridlines subtiles
  et highlight vert sur la ligne du seuil "bon".
- **Axe X** : 3 dates (début / milieu / fin) en monospace.
- **Tous les points visibles** comme dots subtils (opacity .35), le dernier
  point mis en évidence avec bordure blanche.
- **Auto-flip du tooltip** : si le dot est près du haut du graph, le tooltip
  passe en-dessous pour éviter de chevaucher le titre de la card.
- Support tactile (touchmove + touchend) pour mobile.
- Hover handler utilise une binary search O(log n) pour trouver le point
  le plus proche du curseur.

### Radar USDT — UX polish
- **Countdown live vers le prochain auto-refresh** : pill "auto dans 34s"
  qui décompte chaque seconde (cohérent avec les cycles de 60s).
- **Raccourci clavier `R`** pour rafraîchir (quand le tab radar est actif
  et qu'aucun input n'est focus). Hint visible dans le bouton Rafraîchir.
- **Cards avec hover elevation** : shadow + translate(-1px) pour feedback.
- **Rows des tables d'offres** : hover highlight bleu-ciel.
- **Transitions fluides** sur les éléments interactifs (border-color,
  box-shadow, transform).
- **Responsive mobile** : tooltips plus compacts < 480px.

Bump : v7.2 → v7.3 (2026-04-23)

---

## `v7.2` — 2026-04-20

### Refonte sémantique SELL (Maroc)
**Avant** : on regardait les BUY ads (gens voulant acheter notre USDT) et
on calculait "à quel prix ils nous payaient" (sort DESC, médiane top 10).
**Maintenant** : on suppose que tu PUBLIES TA PROPRE ANNONCE de vente.
Tes vrais concurrents sont les autres SELL ads, donc :
- Query Binance avec `tradeType='BUY'` (qui renvoie les SELL ads)
- Filtres : max ∈ [5k, 50k] MAD + **banque Attijari obligatoire**
- Sort ASC (cheapest first = floor des concurrents)
- Moyenne top 3 cheapest = prix max où tu peux poster ton ad et capter
  des clients

**Validation live** au moment du commit :
- Ancienne méthode : spread +3,27%
- Nouvelle méthode : spread **+4,03%** → gain **+0,76%** par tx
- L'alerte se déclenche immédiatement (4,03% > seuil 4%)

### Alerte email > 4%
Le poller (cron 6h) génère `ALERT.md` dès que la moyenne SELL > 4%.
Le workflow lit ce fichier et crée une GitHub Issue → notification email
auto à `amine.koraibi@gmail.com` (config notif GitHub).

Contenu de l'alerte :
- Spread moyen + cours USD/MAD live
- Tableau top 3 utilisées pour le calcul
- Tableau de TOUTES les offres avec spread > 4% (jusqu'à 20)
- Lien direct vers le Radar

Anti-spam : cooldown 6h entre alertes (stocké dans `data-history.enc.js`).

Mode test : `FORCE_ALERT=1` (env) ou input `force_alert: true` dans
workflow_dispatch UI → simule une alerte avec données fictives.

### Historique
- Old data-history.enc.js (calculé en ancienne méthode) reset.
- Nouvelle entrée bootstrap générée en live (réelle, méthode v2).

### Cadence
- **Cron passé de 6h → 1h** (`'0 * * * *'`) : check toutes les heures.
- Cooldown alerte reste à **6h** pour ne pas spammer même si check 1/h.
- HISTORY_CAP bumped 1500 → 8760 (≈ 1 an de polling à 1/h).

### Setup user requis
1. Créer secret GitHub `BINGA_PASSWORD = BINGA`
2. Activer write permissions Actions (`contents: write` + `issues: write`)
3. Créer le fichier workflow `.github/workflows/poll-p2p.yml` via UI
   (PAT actuel n'a pas le scope `workflow`)
4. Trigger manuel via UI Actions pour valider

Bump : v7.1 → v7.2 (2026-04-20)

---

## `v7.1` — 2026-04-20

### Radar USDT
- Tooltip "Mes stats" au hover des gauges (BUY + SELL).
  Affiche : dernière tx, moyenne 30j, moyenne globale.
- Stats calculées depuis `DATA.fxP2P.leg2/leg3.transactions` (tes tx
  historiques).

Bump : v7 → v7.1

---

## `v7` — 2026-04-20

### Background polling P2P (GitHub Actions, cron 6h)
- Nouveau workflow `.github/workflows/poll-p2p.yml` qui tourne 4× par jour
  (00h, 06h, 12h, 18h UTC) sur l'infra GitHub Actions (gratuit pour repos
  publics).
- Script `scripts/poll-p2p.js` (Node natif, zero dep) qui :
  1. Fetch Binance P2P AED BUY (transAmount=10000) + MAD SELL (20000)
  2. Fetch USD/MAD live (fawazahmed0)
  3. Calcule les spreads (vs peg / vs marché)
  4. Append au fichier `data-history.enc.js` (chiffré BINGA, AES-256-GCM)
  5. Cap à 1500 entrées (≈ 1 an d'historique)
- Workflow commit + push automatique du fichier mis à jour.
- Robustesse : si une source échoue, les autres restent enregistrées
  (sellSpread = null si USD/MAD down, etc.). Aucun commit vide.

### Radar USDT — Section "Historique du spread"
- Sparklines SVG inline (pas de Chart.js, zero dep) pour BUY et SELL.
- Toggle de période : 7j / 30j / 90j / Tout.
- Stats par côté : dernier, moyenne, min/max bon, tendance vs moyenne.
- Ligne pointillée verte = seuil "bon" (0.35% pour BUY, 3% pour SELL).
- Zone fillée sous la courbe colorée selon le verdict en cours.
- Re-render seulement la section sur changement de période (pas de
  re-fetch live).

### Setup nécessaire (manuel, une seule fois)
1. Créer secret GitHub `BINGA_PASSWORD = BINGA` :
   https://github.com/lallakenza/2048/settings/secrets/actions
2. Activer write permissions Actions :
   https://github.com/lallakenza/2048/settings/actions
3. Trigger un premier run manuel via UI Actions (workflow_dispatch)

Voir `UPDATE_GUIDE.md` §12 pour les détails complets.

Bump : v6.1 → v7 (2026-04-20)

---

## `v6.1` — 2026-04-20

### Login
- **Mode radar-only (BINANCE) sans dark theme ni overlay BINGA** : le mode
  radar-only doit visuellement matcher TIGRE/COUPA. Le décryptage PRIV
  reste actif (Radar a besoin des données privées) — c'est juste
  l'apparence qui change. Plus de fanfare au login BINANCE.

Bump : v6 → v6.1

---

## `v6` — 2026-04-20

### Login
- **Mot de passe `TIGRE` remplace `BRIDGEVALE`** pour la vue full Amine.
  Même comportement, juste un nouveau mdp. Re-chiffrement complet du
  `ENCRYPTED_FULL` blob — l'ancien mdp ne marche plus.
- **Mode radar-only pour `BINANCE`** : auth identique à BINGA (full data +
  PRIV décrypté) MAIS l'UI est restreinte au seul tab Radar USDT — les
  autres tabs (Ma Position, Augustin, Benoit, FX P2P, Mes Gains) sont
  cachés. Le champ "Réf. dossier" est aussi masqué. Pour avoir l'accès
  complet, taper BINGA à la place. Implémenté via `window.RADAR_ONLY`
  consommé par `isTabVisible()` dans `render-main.js`.

### Refactor
- `render-main.js` : extraction de `isTabVisible(t)` comme single source
  of truth pour la visibilité des tabs (utilisée par `buildTabs`,
  `refreshTabVisibility`, `renderAll`).

### Docs
- Toutes les références BRIDGEVALE → TIGRE (8 fichiers : README,
  Architecture, DATA_MODEL, UPDATE_GUIDE, BUG_TRACKER, CHANGELOG,
  encrypt.js, index.html, verify.js, game-2048.js).

Bump : v5 → v6 (2026-04-20)

---

## Rename repo `facturation` → `2048` — 2026-04-20

- Repo GitHub renommé `lallakenza/facturation` → `lallakenza/2048`
- URL live: `https://lallakenza.github.io/facturation/` → `https://lallakenza.github.io/2048/`
- Motivation : cohérence avec la façade 2048 côté cover — l'URL elle-même
  ne trahit plus l'usage réel du site.
- `localStorage.facturation_positions` (bridge vers networth) **inchangé** —
  c'est une clé de localStorage partagée par origine (`lallakenza.github.io`),
  le path ne joue pas. Pas de migration nécessaire côté networth.
- ⚠️ **GitHub Pages NE redirige PAS** : `https://lallakenza.github.io/facturation/`
  renvoie désormais 404. Seul le repo (`github.com/lallakenza/facturation`)
  redirige automatiquement vers `lallakenza/2048`. Si tu as bookmarké
  l'ancienne URL, à updater. (Le `git remote` continue à fonctionner aussi
  via redirect — mais bonne pratique de l'updater.)
- Toutes les docs mises à jour (README, Architecture, UPDATE_GUIDE,
  BUG_TRACKER) avec la nouvelle URL + nouveaux clones.

---

## `v5` — 2026-04-20

### Radar USDT
- **3 niveaux de marchands** (au lieu de 2 précédemment) :
  - ⭐ **Confirmé** — transaction *Completed* dans l'historique Binance
  - 🔸 **RIB validé** — orders passés (même cancellés) → RIB déjà enregistré
  - 🆕 **Nouveau** — jamais interagi → 4h de validation RIB nécessaire
- Extraction initiale depuis le Binance C2C Order History export :
  - AED : 29 marchands dont 9 confirmés
  - MAD : 42 marchands dont 38 confirmés
- Clic sur l'icône à gauche d'un marchand cycle : nouveau → RIB → confirmé
- Résumé en en-tête de table : `· 3 ⭐ confirmés · 2 🔸 RIB ok`
- Surlignage de ligne par niveau (vert pour confirmé, bleu pour RIB validé)

### Login
- **Shortcut `BINANCE`** dans le champ pseudo — même auth que BINGA
  mais navigue directement vers l'onglet Radar USDT après le unlock
  (au lieu de "Ma Position" par défaut).

### Données
- Réencryption complète (PRIV blob passe de 7.8k → 8.7k chars base64 à
  cause des listes de marchands).

### Docs
- `UPDATE_GUIDE.md` §9 : procédure complète d'extraction des marchands
  depuis l'export Excel Binance (script Python inclus).
- `DATA_MODEL.md` : schémas des 4 nouvelles arrays dans `PRIV_DATA.fxP2P`.

Commit : `6187c66`

---

## `v4` — 2026-04-20

### Radar USDT
- **Distinction marchands connus vs nouveaux** (version 2 niveaux).
  - ⭐ Connu = RIB validé → transaction rapide possible
  - 🆕 Nouveau = RIB à ajouter → ~4h de validation
  - Toggle ☆ ↔ ⭐ par clic, persisté dans `localStorage.radar_known_merchants`
  - Seed canonique possible via `PRIV_DATA.fxP2P.knownMerchantsAED/MAD`
- Note explicative affichée au-dessus de chaque table.
- Surlignage vert discret pour les lignes "connues".

### Docs
- Création de **README.md** : entry point, quick-start, structure repo,
  principes clés, conventions commits/signes/nicknames, tech stack,
  troubleshooting.

Commit : `76b8d20`

---

## `v3` — 2026-04-20

### Radar USDT
- **Filtre des offres parasites** (BUG-011) : `transAmount=10000` AED /
  `20000` MAD envoyé à Binance + filtre client-side en double sécurité
  (rejette toute offre dont `maxSingleTransAmount < seuil`).
- **Indicateur live/stale par carte** : `● live · 15:43:54` (vert, < 75s)
  ou `● stale · il y a 2 min` (jaune, > 75s). Tick toutes les 5s qui
  rafraîchit JUSTE le badge (pas la carte → pas de perte de focus
  dans les inputs).
- **Préservation des saisies utilisateur** (BUG-010) : flag user-set
  posé dès qu'on tape. L'auto-refresh continue à mettre à jour le lien
  "Marché Binance live" mais ne touche plus à l'input. Click sur le lien
  pour re-sync manuellement.
- Titres de tables : `(filtré ≥ 10 000 AED)` affiché explicitement.
- Résumé offres parasites : 10/10 offres filtrées valides (avant le fix,
  7/10 étaient des micro-offres à 100 AED max).

Commit : `ad85c52`

---

## `v2` — 2026-04-20

### Radar USDT
- **Fix CORS** (BUG-009) : routage des requêtes Binance P2P via
  `corsproxy.io`. Testé : direct fetch `Failed to fetch` → via proxy,
  200 OK. Fallback direct gardé pour localhost dev. Autres proxies
  testés (allorigins, thingproxy) rejetés car ne forwardent pas le POST
  body.
- **Gauges toujours visibles** (BUG-008) : refactor `radarRenderContent`
  — les cards sont rendues même si Binance échoue. Inputs éditables pour
  "Prix observé" (AED/USDT ou MAD/USDT) et USD/MAD. Accept virgule ou
  point comme séparateur décimal.
- **Binance en bonus** : lien cliquable "Marché Binance live: 3,6830"
  qui sync l'input à la médiane d'un clic.
- **Status per-source** : remplacement du "✓ À jour" global par 3 badges
  (USD/MAD ✓ · Binance AED ✓ · Binance MAD ✓).
- Focus préservé pendant le re-render via `setSelectionRange`.

Commit : `72618b0`

---

## `v1` — 2026-04-19

### Nouveau : Radar USDT (page dédiée BINGA only)
- Fetch live Binance P2P (AED BUY + MAD SELL) + USD/MAD live
  (fawazahmed0/currency-api).
- Verdicts automatiques avec seuils calibrés sur l'historique Amine
  (BUY ≤0.35% = bon ; SELL ≥3% = bon).
- Gauge visuel banded (Excellent / Bon / Moyen / Mauvais-Faible) avec
  bulle flottante indiquant le spread courant, pour chaque côté.
- Top 10 offres live par côté (marchand, prix, spread, min-max, paiement,
  taux 30j).
- Contexte historique : meilleur/moyen/pire de tes trades + positioning
  vs la distribution historique.
- Auto-refresh 60s (paused si onglet inactif) + bouton manuel Rafraîchir.
- Fallback offline gracieux si Binance P2P rejette (CORS/rate-limit).

### Nouveau : Site versioning
- `window.APP_VERSION = 'v1'` + `APP_VERSION_DATE` (single source of truth).
- Badge visible dans le header après unlock : point vert pulsant + `v1 · 2026-04-19`.

### Nettoyage
- Section inline "Qualité des deals USDT" retirée de `render-fxp2p.js`
  (remplacée par la page Radar, plus complète).

Commit : `176bb04`

---

## pre-v1 (non versionné)

Historique des commits substantiels avant le système de versioning formel.

### Cover 2048 fixes (`0fe06e3`)
- Score live qui s'actualise (BUG-005)
- Bouton restart renommé "Nouvelle partie", hint "Retour à l'écran de pseudo"
  supprimé (BUG-006)
- Flash "Pseudo refusé" supprimé (BUG-007)

### Cover : 2048 au lieu de Riad Anwar (`bc6c82c`)
Remplacement de la façade — un jeu 2048 plausible comme fallback quand
un pseudo invalide est saisi. Les scores sont sauvegardés en localStorage
par taille de grille.

### Bridge facturation → networth (`963038d`)
`render-amine.js` écrit `localStorage.facturation_positions` pour que le
dashboard patrimonial `networth` récupère les valeurs en live au lieu de
les hardcoder (BUG-004).

### Documentation initiale (`3041ae1`)
En-têtes détaillés dans tous les modules `render-*.js` + extraction de
`computeBenoitSolde()` dans `render-helpers.js` pour éviter la duplication
entre dashboard et onglet Benoit (BUG-002).

### Initial encryption (commits plus anciens)
Passage de `data.js` en clair à `data-enc.js` + `data-priv.enc.js` chiffrés
AES-256-GCM avec 3 couches (TIGRE / COUPA / BINGA). Suppression de
`data.js` du repo.

---

## Format des versions

- **Version** : `vN` (incrément entier simple — pas de semver, trop d'overhead
  pour un site statique 1-dev).
- **Bumper** quand : changement fonctionnel visible, refactor significatif,
  nouvelle data encryptée, nouvelle page.
- **Ne PAS bumper** quand : typos doc, correction de commit message, rebase.
- **Toujours** :
  - Mettre `APP_VERSION` + `APP_VERSION_DATE` dans `index.html`
  - Ajouter une entrée ici dans `CHANGELOG.md`
  - Mentionner la version dans le message de commit (`vN: …`)
