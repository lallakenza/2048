#!/usr/bin/env node
// ============================================================
// POLL-P2P.JS — Background poller Binance P2P + USD/MAD + alerte
// Usage: node scripts/poll-p2p.js [--force-alert]
// Env:
//   BINGA_PASSWORD (obligatoire — secret GitHub Actions)
//   FORCE_ALERT=1   (test : simule une alerte avec données fictives)
//
// Fonctionnement:
// 1. Fetch Binance P2P AED BUY (max ≥ 10k AED, médiane top 10)
//    → on regarde les SELL ads (Binance tradeType='BUY') = sources d'achat
// 2. Fetch Binance P2P MAD SELL (max ∈ [5k, 50k] MAD, banque Attijari,
//    moyenne des 3 cheapest) → SELL ads = mes concurrents (j'aligne mon
//    propre ad sur le floor pour capter des clients)
// 3. Fetch USD/MAD live (fawazahmed0/currency-api)
// 4. Calcule les spreads (buy vs peg 3.6725, sell vs USD/MAD)
// 5. Lit data-history.enc.js, append nouvelle entrée (cap FIFO ~ 1 mois)
// 6. Re-chiffre et écrit data-history.enc.js
// 7. Si sellSpread > ALERT_SELL_THRESHOLD (4%) ET cooldown passé,
//    génère ALERT.md (consommé par le workflow → gh issue create)
//
// Cadence : run TOUTES LES HEURES via le workflow GitHub Actions.
// L'alerte garde un cooldown séparé (6h) pour ne pas spammer même si
// le check est plus fréquent.
//
// Robustesse:
//   - Si Binance échoue: on log et on SKIP l'entrée (pas de commit vide)
//   - Si USD/MAD échoue: on garde le buy spread (peg fixe), sellSpread null
//
// Node natif seulement (crypto built-in, fetch global v18+). Zero dep.
// ============================================================

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// ---- CONFIG ---------------------------------------------------------
const SALT = 'facturation-augustin-2025';     // doit matcher encrypt.js
const PEG_AED_USD = 3.6725;                   // peg UAE central bank
const HISTORY_FILE = path.join(__dirname, '..', 'data-history.enc.js');
const ALERT_FILE   = path.join(__dirname, '..', 'ALERT.md');
const HISTORY_CAP = 8760;                     // 24 × 365 ≈ 1 an au rythme 1/h

// Filtres par côté — SINGLE SOURCE OF TRUTH (matche RADAR_CFG dans render-radar.js)
//
// SELL : le user PUBLIE SA PROPRE ANNONCE → ses concurrents sont les autres
// SELL ads (= autres gens vendant USDT). On query Binance tradeType='BUY' qui
// renvoie les SELL ads. Filtres : max ∈ [5k, 50k] MAD + banque Attijari.
// Moyenne top 3 cheapest = floor des concurrents = prix max compétitif pour
// son ad (au-delà → pas de clients, en-deçà → laisse de la marge sur la table).
const CFG = {
  BUY:  { transAmount: 10000, minMax: 10000, maxMax: Infinity,
          takeTop: 10, agg: 'median', payMethodFilter: null },
  SELL: { transAmount: 5000,  minMax: 5000,  maxMax: 50000,
          takeTop: 3,  agg: 'avg',    payMethodFilter: 'attijari' },
};

// Alerte SELL : déclenche une notif si la moyenne top 3 dépasse ce %.
const ALERT_SELL_THRESHOLD_PCT = 4.0;
const ALERT_COOLDOWN_HOURS     = 6;     // pas de re-notif avant N heures

// ---- ENCRYPTION (même scheme que encrypt.js) -----------------------
function encryptData(data, password) {
  const plaintext = JSON.stringify(data);
  const pwd = password.toUpperCase();
  const key = crypto.pbkdf2Sync(pwd, SALT, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(plaintext, 'utf8');
  enc = Buffer.concat([enc, cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
function decryptData(b64, password) {
  const pwd = password.toUpperCase();
  const key = crypto.pbkdf2Sync(pwd, SALT, 100000, 32, 'sha256');
  const raw = Buffer.from(b64, 'base64');
  const iv = raw.slice(0, 12);
  const tag = raw.slice(12, 28);
  const ct = raw.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let dec = decipher.update(ct, null, 'utf8');
  dec += decipher.final('utf8');
  return JSON.parse(dec);
}

// ---- FETCHERS (server-side, pas de CORS) ---------------------------
// fiat='AED'|'MAD', userSide='BUY'|'SELL', cfg = CFG.BUY|CFG.SELL
//
// Both sides query Binance with tradeType='BUY' which returns SELL ads :
// - userSide=BUY (AED) : SELL ads = sources où acheter l'USDT
// - userSide=SELL (MAD) : SELL ads = concurrents qui vendent comme moi
//   (je publie ma propre annonce, je m'aligne sur leur floor)
// Sort ASC dans les 2 cas (cheapest first).
async function fetchBinanceP2P(fiat, userSide, cfg) {
  const body = {
    proMerchantAds: false,
    page: 1,
    rows: 20,
    payTypes: [],
    countries: [],
    publisherType: null,
    fiat,
    tradeType: 'BUY',  // ← always BUY : returns SELL ads
    asset: 'USDT',
    merchantCheck: false,
    transAmount: String(cfg.transAmount),
  };
  const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Binance ${fiat} ${userSide}: HTTP ${res.status}`);
  const j = await res.json();
  const ads = (j.data || []).filter(a => a?.adv?.price);
  if (!ads.length) throw new Error(`Binance ${fiat} ${userSide}: 0 ads`);

  // Map → filtre minMax/maxMax (toujours appliqué client-side, cf BUG-011)
  let offers = ads
    .map(a => ({
      price: parseFloat(a.adv.price),
      min: parseFloat(a.adv.minSingleTransAmount),
      max: parseFloat(a.adv.dynamicMaxSingleTransAmount || a.adv.maxSingleTransAmount),
      merchant: a.advertiser?.nickName || '—',
      payMethods: (a.adv.tradeMethods || []).map(m => m.tradeMethodName || m.identifier).filter(Boolean),
    }))
    .filter(o =>
      isFinite(o.price) && o.price > 0 &&
      isFinite(o.max) && o.max >= cfg.minMax && o.max <= cfg.maxMax
    );
  if (!offers.length) throw new Error(`Binance ${fiat} ${userSide}: no offers in range [${cfg.minMax}, ${cfg.maxMax}]`);

  // Filtre par moyen de paiement (substring case-insensitive)
  if (cfg.payMethodFilter) {
    const needle = String(cfg.payMethodFilter).toLowerCase();
    offers = offers.filter(o =>
      (o.payMethods || []).some(pm => String(pm).toLowerCase().includes(needle))
    );
    if (!offers.length) throw new Error(`Binance ${fiat} ${userSide}: no offers with payment method "${cfg.payMethodFilter}"`);
  }

  // Sort ASC : cheapest first (the floor for SELL, the lowest cost for BUY)
  offers.sort((a, b) => a.price - b.price);

  const topN = offers.slice(0, cfg.takeTop);
  const topPrices = topN.map(o => o.price);

  let medianPrice;
  if (cfg.agg === 'avg') {
    medianPrice = topPrices.reduce((s,x) => s+x, 0) / topPrices.length;
  } else {
    const sorted = [...topPrices].sort((a,b) => a-b);
    const mid = Math.floor(sorted.length / 2);
    medianPrice = sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
  }

  return {
    topPrice:    topPrices[0],
    medianPrice,
    offerCount:  offers.length,
    transAmount: cfg.transAmount,
    aggregator:  cfg.agg,
    takeTop:     cfg.takeTop,
    payMethodFilter: cfg.payMethodFilter || null,
    // On garde TOUTES les offres filtrées (jusqu'à 20) pour l'alerte (lister celles > 4%)
    offers:      offers.slice(0, 20),
    medianBasis: topN, // pour le calcul d'alerte (top 3 utilisés)
  };
}

async function fetchUsdMad() {
  const urls = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
  ];
  let lastErr;
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) { lastErr = new Error(`HTTP ${r.status}`); continue; }
      const j = await r.json();
      const rate = j?.usd?.mad;
      if (rate && isFinite(rate)) return { usdMad: rate, date: j.date || null };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('USD/MAD fetch failed');
}

// ---- HISTORY IO -----------------------------------------------------
function readHistory(password) {
  if (!fs.existsSync(HISTORY_FILE)) return { entries: [], lastAlertTs: null };
  try {
    const src = fs.readFileSync(HISTORY_FILE, 'utf8');
    const m = src.match(/ENCRYPTED_HISTORY\s*=\s*"([^"]+)"/);
    if (!m) return { entries: [], lastAlertTs: null };
    const data = decryptData(m[1], password);
    return {
      entries: Array.isArray(data.entries) ? data.entries : [],
      lastAlertTs: data.lastAlertTs || null,
    };
  } catch (e) {
    console.warn(`[poll] Lecture historique failed: ${e.message}. Starting fresh.`);
    return { entries: [], lastAlertTs: null };
  }
}

function writeHistory({ entries, lastAlertTs }, password) {
  const b64 = encryptData({ entries, lastAlertTs }, password);
  const content =
    `// Auto-generated by scripts/poll-p2p.js (GitHub Actions cron)\n` +
    `// Historique P2P chiffré (AES-256-GCM, BINGA password). DO NOT EDIT.\n` +
    `const ENCRYPTED_HISTORY = "${b64}";\n`;
  fs.writeFileSync(HISTORY_FILE, content);
}

// ---- ALERTE ---------------------------------------------------------
// Compute spread for a single SELL offer vs USD/MAD live rate.
function offerSpreadPct(offerPrice, usdMad) {
  if (!usdMad || !isFinite(usdMad)) return null;
  return ((offerPrice - usdMad) / usdMad) * 100;
}

// Génère le markdown body de l'issue + le titre. Renvoie {title, body}.
function buildAlertContent(sell, fx, sellSpread) {
  const title = `🚨 Spread USDT→MAD ${sellSpread.toFixed(2)}% > ${ALERT_SELL_THRESHOLD_PCT}%`;

  const fmt = (n, dec=4) => Number(n).toFixed(dec).replace('.', ',');
  const sign = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  // Top 3 utilisées pour le calcul (notre "moyenne")
  const top3Rows = sell.medianBasis.map((o, i) => {
    const sp = offerSpreadPct(o.price, fx.usdMad);
    return `| ${i+1} | \`${o.merchant}\` | ${fmt(o.price, 3)} | ${sign(sp)} | ${o.min.toLocaleString('fr-FR')}–${o.max.toLocaleString('fr-FR')} |`;
  }).join('\n');

  // Toutes les offres (jusqu'à 20) avec spread > seuil
  const overThreshold = sell.offers
    .map(o => ({ ...o, spread: offerSpreadPct(o.price, fx.usdMad) }))
    .filter(o => o.spread != null && o.spread > ALERT_SELL_THRESHOLD_PCT)
    .sort((a, b) => b.spread - a.spread); // les + hauts en premier

  const overRows = overThreshold.length
    ? overThreshold.map((o, i) =>
        `| ${i+1} | \`${o.merchant}\` | ${fmt(o.price, 3)} | ${sign(o.spread)} | ${o.min.toLocaleString('fr-FR')}–${o.max.toLocaleString('fr-FR')} |`
      ).join('\n')
    : '_Aucune offre n\'a un spread > seuil — c\'est juste la **moyenne** top 3 qui dépasse._';

  const body = `**Moyenne top 3 (max ∈ 5k–50k MAD) : ${sign(sellSpread)}** au-dessus du marché.

- Cours USD/MAD live : **${fmt(fx.usdMad, 4)}** ${fx.date ? `(${fx.date})` : ''}
- Seuil d'alerte : ${ALERT_SELL_THRESHOLD_PCT}%
- Détecté à : ${new Date().toISOString()}

## Top 3 offres prises pour le calcul

| # | Marchand | Prix MAD/USDT | Spread | Min–Max MAD |
|---|---|---:|---:|---:|
${top3Rows}

## Toutes les offres avec spread > ${ALERT_SELL_THRESHOLD_PCT}%

${overThreshold.length ? `| # | Marchand | Prix MAD/USDT | Spread | Min–Max MAD |
|---|---|---:|---:|---:|
${overRows}` : overRows}

---

🌐 [Voir le Radar live](https://lallakenza.github.io/2048/) (entrer **\`BINANCE\`** comme pseudo).

🤖 Auto-généré par \`scripts/poll-p2p.js\` via le cron GitHub Actions toutes les 6h. Cooldown anti-spam : ${ALERT_COOLDOWN_HOURS}h entre alertes.
`;
  return { title, body };
}

function writeAlertFile(content) {
  // Le workflow lit ce fichier puis le supprime. Format simple :
  // 1ère ligne = titre, reste = body (séparés par \n---\n).
  const out = `${content.title}\n---\n${content.body}`;
  fs.writeFileSync(ALERT_FILE, out);
  console.log(`[alert] Wrote ${ALERT_FILE} (${out.length} chars).`);
}

// ---- MAIN -----------------------------------------------------------
async function main() {
  const pwd = process.env.BINGA_PASSWORD;
  if (!pwd) {
    console.error('✗ BINGA_PASSWORD env variable is required.');
    process.exit(2);
  }
  const forceAlert = process.env.FORCE_ALERT === '1' || process.argv.includes('--force-alert');

  // Nettoie un éventuel ALERT.md résiduel d'un précédent run
  if (fs.existsSync(ALERT_FILE)) fs.unlinkSync(ALERT_FILE);

  const ts = new Date().toISOString();
  console.log(`[poll] ${ts} — Fetching live P2P + FX${forceAlert ? ' (FORCE_ALERT mode)' : ''}…`);

  let buy, sell, fx;

  if (forceAlert) {
    // ===== Mode test : données fictives qui déclenchent une alerte =====
    console.log('[poll] Generating fake data for FORCE_ALERT test…');
    buy = {
      topPrice: 3.682, medianPrice: 3.6855, offerCount: 12,
      transAmount: 10000, aggregator: 'median', takeTop: 10,
      offers: [], medianBasis: [],
    };
    fx = { usdMad: 9.20, date: '2026-04-20' };
    // Top 3 fake: prix élevés → spread moyen ~5.4% > 4%
    const fakeMedianBasis = [
      { merchant: 'ELAOUNI-P2P-TEST',  price: 9.730, min: 10000, max: 42839 },
      { merchant: 'Zack-Crypto-TEST',  price: 9.700, min: 10000, max: 24000 },
      { merchant: 'Hero_buy_sell-TEST', price: 9.690, min: 16000, max: 40000 },
    ];
    // Liste plus large: certaines > 4%, certaines pas
    const fakeAllOffers = [
      ...fakeMedianBasis,
      { merchant: 'p2p_maroc-TEST',     price: 9.680, min: 10000, max: 43000 },
      { merchant: 'SMILE_CRYPTO-TEST',  price: 9.660, min: 5000,  max: 20509 },
      { merchant: 'COIN_FLIP-TEST',     price: 9.620, min: 5000,  max: 15000 },
      { merchant: 'F-13-TEST',          price: 9.600, min: 5000,  max: 12000 },
      { merchant: 'low-spread-TEST',    price: 9.500, min: 5000,  max: 30000 },
    ];
    sell = {
      topPrice: 9.730, medianPrice: 9.706667, offerCount: 8,
      transAmount: 5000, aggregator: 'avg', takeTop: 3,
      offers: fakeAllOffers, medianBasis: fakeMedianBasis,
    };
  } else {
    const [buyR, sellR, fxR] = await Promise.allSettled([
      fetchBinanceP2P('AED', 'BUY',  CFG.BUY),
      fetchBinanceP2P('MAD', 'SELL', CFG.SELL),  // SELL = userSide; query Binance avec BUY interne
      fetchUsdMad(),
    ]);
    buy  = buyR.status  === 'fulfilled' ? buyR.value  : null;
    sell = sellR.status === 'fulfilled' ? sellR.value : null;
    fx   = fxR.status   === 'fulfilled' ? fxR.value   : null;
    console.log('[poll] buy  =', buyR.status,  buy  ? `median ${buy.medianPrice}`  : buyR.reason?.message);
    console.log('[poll] sell =', sellR.status, sell ? `median ${sell.medianPrice} (avg top 3)` : sellR.reason?.message);
    console.log('[poll] fx   =', fxR.status,   fx   ? `usd/mad ${fx.usdMad}`       : fxR.reason?.message);
  }

  if (!buy && !sell && !fx) {
    console.error('✗ All sources failed. Skipping entry.');
    process.exit(1);
  }

  // Spreads (null si donnée manquante)
  const buySpread  = buy  ? ((buy.medianPrice  - PEG_AED_USD) / PEG_AED_USD) * 100 : null;
  const sellSpread = (sell && fx) ? ((sell.medianPrice - fx.usdMad) / fx.usdMad) * 100 : null;

  // Entrée à persister (légère — pas les 20 offres détaillées)
  const entry = {
    ts,
    buy:  buy ? {
      topPrice: buy.topPrice, medianPrice: buy.medianPrice,
      offerCount: buy.offerCount, transAmount: buy.transAmount,
    } : null,
    sell: sell ? {
      topPrice: sell.topPrice, medianPrice: sell.medianPrice,
      offerCount: sell.offerCount, transAmount: sell.transAmount,
      aggregator: sell.aggregator, takeTop: sell.takeTop,
    } : null,
    fx,
    spreads: {
      buy:  buySpread  != null ? Math.round(buySpread  * 10000) / 10000 : null,
      sell: sellSpread != null ? Math.round(sellSpread * 10000) / 10000 : null,
    },
  };

  // ALERT logic — sellSpread > seuil + cooldown.
  // FORCE_ALERT bypasse le cooldown (utile pour tester depuis l'UI).
  const histStore = readHistory(pwd);
  let alertFired = false;
  if (forceAlert || (sellSpread != null && sellSpread > ALERT_SELL_THRESHOLD_PCT)) {
    const cooldownMs = ALERT_COOLDOWN_HOURS * 3600 * 1000;
    const cooldownPassed = !histStore.lastAlertTs ||
      (Date.now() - new Date(histStore.lastAlertTs).getTime()) > cooldownMs;
    if (forceAlert || cooldownPassed) {
      const { title, body } = buildAlertContent(sell, fx, sellSpread);
      writeAlertFile({ title, body });
      histStore.lastAlertTs = ts;
      alertFired = true;
      const reason = forceAlert && !cooldownPassed ? ' (cooldown bypassed by FORCE_ALERT)' : '';
      console.log(`[alert] FIRED — sellSpread ${sellSpread.toFixed(2)}% > ${ALERT_SELL_THRESHOLD_PCT}%${reason}`);
    } else {
      const next = new Date(new Date(histStore.lastAlertTs).getTime() + cooldownMs).toISOString();
      console.log(`[alert] Cooldown active (last ${histStore.lastAlertTs}, next ${next}). Skipping.`);
    }
  }

  // Append + cap FIFO
  histStore.entries.push(entry);
  if (histStore.entries.length > HISTORY_CAP) {
    histStore.entries.splice(0, histStore.entries.length - HISTORY_CAP);
  }

  writeHistory(histStore, pwd);
  console.log(`[poll] Entry added. Total: ${histStore.entries.length} (cap ${HISTORY_CAP}).`);
  console.log(`[poll] Spreads: buy=${entry.spreads.buy}%, sell=${entry.spreads.sell}%${alertFired ? ' [ALERT]' : ''}`);
}

main().catch(e => {
  console.error('✗ Fatal:', e.message);
  process.exit(1);
});
