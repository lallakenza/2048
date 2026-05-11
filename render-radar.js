// ============================================================
// RENDER-RADAR.JS — Live Radar USDT — real-time P2P opportunity judge
//
// Purpose
//   Amine always BUYS USDT with AED (Dubai) and SELLS USDT for MAD
//   (Morocco). This page answers a single question for each side:
//   "à cet instant, est-ce un bon moment pour trader ?"
//
// Live data sources
//   • Binance P2P — public unauth endpoint
//       POST https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search
//     body: { fiat, tradeType, asset:'USDT', rows:20, page:1, ... }
//   • USD/MAD live FX — fawazahmed0/currency-api (jsdelivr CDN)
//       GET https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json
//     → json.usd.mad
//
// Reference rates
//   • AED/USD peg = 3.6725 (fixed by UAE central bank)
//     → buy verdict = spread vs peg
//   • USD/MAD = market rate (drifts daily)
//     → sell verdict = spread vs live USD/MAD
//
// Thresholds (calibrated on Amine's historical distribution)
//   BUY  (spread vs peg 3.6725, lower is better):
//     ≤ 0,10%  Excellent  | ≤ 0,35%  Bon
//     ≤ 0,70%  Moyen      | >  0,70%  Mauvais
//   SELL (spread vs USD/MAD, higher is better):
//     ≥ 5,0%   Excellent  | ≥ 3,0%   Bon
//     ≥ 1,0%   Moyen      | <  1,0%   Faible
//
// Refresh behavior
//   • Manual: button in the refresh bar
//   • Auto: setInterval every 60s, paused if the radar panel is
//     not the active tab (offsetParent check).
//
// Graceful degradation
//   If Binance P2P is unreachable (CORS/rate-limit/outage), we show
//   a soft offline state with the last-known historical averages so
//   the page is still useful.
// ============================================================

// Singleton state (module-level so we can drive auto-refresh)
window._radarState = window._radarState || {
  timer: null,
  lastLoadAt: 0,
  inFlight: false,
};

function renderRadar() {
  if (!window.PRIV) {
    return '<div style="padding:40px;text-align:center;color:var(--muted)"><p style="font-size:1.1rem">🔒 Section réservée</p></div>';
  }

  // Skeleton — every live value has an id so radarLoad() can inject.
  const skeleton = `
    <h2 style="font-size:1.1rem;margin-bottom:4px">Radar USDT — opportunités P2P live</h2>
    <p style="color:var(--muted);font-size:.82rem;margin-bottom:16px">
      Jugement temps réel du marché Binance P2P : bon moment pour <strong>acheter (AED→USDT)</strong> ou <strong>vendre (USDT→MAD)</strong> ?
    </p>

    <div class="radar-refresh-bar" id="radarRefreshBar">
      <button id="radarRefreshBtn" onclick="window.radarLoad(true)" title="Raccourci : R" style="appearance:none;background:var(--accent);color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px">🔄 Rafraîchir <span class="radar-kbd" style="color:rgba(255,255,255,.8);border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.12)">R</span></button>
      <div style="font-size:.72rem;color:var(--muted);line-height:1.5">
        Dernière MAJ : <span id="radarLastUpdate" style="color:var(--text);font-weight:600">—</span>
        <span class="countdown" id="radarCountdown">auto 60s</span>
      </div>
      <div id="radarStatus" style="margin-left:auto;font-size:.72rem;color:var(--muted)">⏳ Chargement…</div>
    </div>

    <div id="radarBody">
      <div style="padding:40px;text-align:center;color:var(--muted)">
        <div style="font-size:1.4rem;margin-bottom:6px">⏳</div>
        <div style="font-size:.88rem">Chargement des taux live Binance P2P + USD/MAD…</div>
      </div>
    </div>

    <div class="n" style="margin-top:22px">
      <strong>Comment ça marche</strong> — on interroge l'API publique Binance P2P pour récupérer le prix médian des top marchands (achat AED→USDT à Dubai, vente USDT→MAD au Maroc), on compare au peg AED/USD (3,6725) et au taux USD/MAD du jour (fawazahmed0/currency-api). Le verdict compare le spread actuel à tes seuils calibrés sur ton historique.
    </div>
  `;

  // Kick off the first load as soon as the DOM is parsed, and
  // start the 60s auto-refresh + 5s freshness ticker. renderRadar()
  // is called by renderAll() which injects via innerHTML — scripts
  // inside innerHTML don't execute, so we hook via setTimeout outside
  // the returned string.
  setTimeout(function(){ radarLoad(false); }, 20);
  radarStartAutoRefresh();
  radarStartFreshnessTick();
  radarStartCountdownTick();
  radarInstallKeyboardShortcut();

  return skeleton;
}

// Auto-refresh countdown pill — live "auto dans 34s" so the user knows
// when the next fetch will happen. Recomputed every 1s from lastLoadAt.
function radarStartCountdownTick() {
  if (window._radarState.cdTimer) return;
  window._radarState.cdTimer = setInterval(function(){
    const panel = document.getElementById('radar');
    if (!panel || panel.offsetParent === null) return;
    const el = document.getElementById('radarCountdown');
    if (!el) return;
    const t = window._radarState.lastLoadAt;
    if (!t) { el.textContent = 'auto 60s'; return; }
    const elapsed = Math.floor((Date.now() - t) / 1000);
    const remaining = Math.max(0, 60 - elapsed);
    el.textContent = remaining > 0 ? `auto dans ${remaining}s` : 'auto imminent…';
  }, 1000);
}

// Keyboard shortcut: press "R" while the radar tab is active to refresh.
// Ignored when focus is inside an input/textarea so typing price values
// doesn't trigger refreshes.
function radarInstallKeyboardShortcut() {
  if (window._radarState.kbInstalled) return;
  window._radarState.kbInstalled = true;
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'r' && e.key !== 'R') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const panel = document.getElementById('radar');
    if (!panel || panel.offsetParent === null) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    radarLoad(true);
  });
}

// ---- AUTO REFRESH --------------------------------------------------
function radarStartAutoRefresh() {
  if (window._radarState.timer) return;
  window._radarState.timer = setInterval(function(){
    const panel = document.getElementById('radar');
    // offsetParent === null when the panel is display:none, i.e. not
    // the active tab. No point hammering the API for a hidden page.
    if (!panel || panel.offsetParent === null) return;
    if (window._radarState.inFlight) return;
    radarLoad(false);
  }, 60000);
}

// ---- MAIN LOAD -----------------------------------------------------
// manual: true when the user clicked "Rafraîchir" — forces a render
// of the "loading" state even if a previous load succeeded.
async function radarLoad(manual) {
  if (window._radarState.inFlight) return;
  window._radarState.inFlight = true;

  const statusEl = document.getElementById('radarStatus');
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent)">⏳ Fetch en cours…</span>';
  const btn = document.getElementById('radarRefreshBtn');
  if (btn) btn.disabled = true;

  try {
    const [buyRes, sellRes, fxRes] = await Promise.allSettled([
      radarFetchBinanceP2P('AED', 'BUY',  RADAR_CFG.BUY),
      radarFetchBinanceP2P('MAD', 'SELL', RADAR_CFG.SELL),
      radarFetchUsdMad(),
    ]);

    const buy  = buyRes.status  === 'fulfilled' ? buyRes.value  : null;
    const sell = sellRes.status === 'fulfilled' ? sellRes.value : null;
    const fx   = fxRes.status   === 'fulfilled' ? fxRes.value   : null;

    // ALWAYS render — gauges don't depend on Binance, only on reference
    // rates (peg = constant, USD/MAD = live or editable). Binance just
    // pre-fills the "observed price" input so the gauge starts on the
    // live market. If Binance fails, user can type the price they see.
    radarRenderContent(buy, sell, fx);

    // Per-source status for the header (transparent about what's live
    // and what's falling back to manual input).
    const parts = [];
    parts.push(fx   ? '<span style="color:var(--green)">USD/MAD ✓</span>'   : '<span style="color:var(--yellow)">USD/MAD ⚠</span>');
    parts.push(buy  ? '<span style="color:var(--green)">Binance AED ✓</span>'  : '<span style="color:var(--yellow)">Binance AED ⚠</span>');
    parts.push(sell ? '<span style="color:var(--green)">Binance MAD ✓</span>' : '<span style="color:var(--yellow)">Binance MAD ⚠</span>');

    window._radarState.lastLoadAt = Date.now();
    const lastEl = document.getElementById('radarLastUpdate');
    if (lastEl) lastEl.textContent = radarFmtTime(new Date());
    if (statusEl) statusEl.innerHTML = parts.join(' · ');
  } catch (e) {
    console.error('[radar] load failed:', e);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">✗ Échec global</span>';
    // Even on full failure, render the manual-input form so the gauges
    // are visible and the user can still use the tool.
    radarRenderContent(null, null, null);
  } finally {
    window._radarState.inFlight = false;
    if (btn) btn.disabled = false;
  }
}
window.radarLoad = radarLoad;

function radarFmtTime(d) {
  const h = String(d.getHours()).padStart(2,'0');
  const m = String(d.getMinutes()).padStart(2,'0');
  const s = String(d.getSeconds()).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

// Small colored "● live HH:MM:SS" badge to make it instantly clear that
// the Binance price next to it is fresh (just fetched). Goes yellow if
// older than the auto-refresh window (60s + 15s slack) — that signals
// either a failed refresh, a hidden tab pause, or a network hiccup.
// Returns '' when we have no timestamp yet.
// Pure inner content of the badge (no wrapping span). The wrapper has
// a stable id so radarTickFreshness() can update only this DOM node
// every few seconds without re-rendering the whole card (which would
// destroy the focus of any active input).
function radarLiveBadgeInner(loadedAt) {
  if (!loadedAt) return '';
  const ageMs = Date.now() - loadedAt;
  const fresh = ageMs <= 75000;
  const color = fresh ? 'var(--green)' : 'var(--yellow)';
  const label = fresh ? 'live' : 'stale';
  let when;
  if (fresh) {
    when = radarFmtTime(new Date(loadedAt));
  } else {
    const mins = Math.floor(ageMs / 60000);
    when = mins >= 1 ? `il y a ${mins}\u202fmin` : `il y a ${Math.floor(ageMs/1000)}\u202fs`;
  }
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:.65rem;color:${color};font-weight:600;white-space:nowrap"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 5px ${color}"></span>${label} · ${when}</span>`;
}

// Wrapper with stable id, used by both initial render and the ticker.
function radarLiveBadge(side, loadedAt) {
  return `<span id="radarBadge-${side}" style="margin-left:4px">${radarLiveBadgeInner(loadedAt)}</span>`;
}

// Tick every 5s to keep "live · HH:MM:SS" → "stale · il y a 2 min"
// transition responsive. Skipped when the Radar panel isn't visible.
function radarStartFreshnessTick() {
  if (window._radarState.tickTimer) return;
  window._radarState.tickTimer = setInterval(function(){
    const panel = document.getElementById('radar');
    if (!panel || panel.offsetParent === null) return;
    const t = window._radarState.lastLoadAt;
    if (!t) return;
    const sides = ['buy', 'sell'];
    sides.forEach(function(side) {
      const el = document.getElementById('radarBadge-' + side);
      if (el) el.innerHTML = radarLiveBadgeInner(t);
    });
  }, 5000);
}

// ---- BINANCE P2P FETCH --------------------------------------------
// CORS workaround: Binance P2P's /bapi endpoint doesn't set CORS headers,
// so direct fetch from github.io fails with "TypeError: Failed to fetch".
// Route through corsproxy.io (verified working with POST body and JSON).
// Tried: corsproxy.io ✓, allorigins ✗ (POST body dropped),
//        thingproxy ✗ (unreliable). Direct-fetch fallback kept for cases
// where the page is opened from a permissive origin (e.g. localhost).
async function radarFetchBinanceP2P(fiat, userSide, cfg) {
  // userSide: 'BUY' (user achète USDT, ex: AED) | 'SELL' (user vend USDT, ex: MAD)
  //
  // ⚠️ Note importante sur la sémantique des SELL ads pour MAD :
  // Le user ne CHERCHE pas une annonce où acheter — il publie SA PROPRE ANNONCE
  // de vente. Donc ses concurrents sont les AUTRES SELL ads. Pour les obtenir,
  // on query Binance avec tradeType='BUY' (qui renvoie les SELL ads). Pour AED
  // c'est pareil (le user achète, donc regarde les SELL ads = ses sources).
  // → DANS LES DEUX CAS : Binance tradeType='BUY', sort ASC (cheapest first).
  //
  // cfg = { transAmount, minMax, maxMax, takeTop, agg, label, payMethodFilter }
  //   payMethodFilter : substring case-insensitive (ex: 'attijari') pour
  //   filtrer client-side sur tradeMethods. null = pas de filtre.
  const c = cfg || {};
  const { transAmount = 0, minMax = 0, maxMax = Infinity,
          takeTop = 10, agg = 'median', label = '', payMethodFilter = null } = c;

  const body = {
    proMerchantAds: false,
    page: 1,
    rows: 20,
    payTypes: [],
    countries: [],
    publisherType: null,
    fiat: fiat,
    tradeType: 'BUY',  // ← always BUY: returns SELL ads (sources for buyer / competitors for seller)
    asset: 'USDT',
    merchantCheck: false,
  };
  if (transAmount) body.transAmount = String(transAmount);
  const target = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  const endpoints = [
    'https://corsproxy.io/?' + encodeURIComponent(target),
    target, // direct — only works if CORS is permissive for the origin
  ];
  let res = null, lastErr = null;
  for (const url of endpoints) {
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) break;
      lastErr = new Error(`HTTP ${res.status}`);
      res = null;
    } catch (e) {
      lastErr = e;
      res = null;
    }
  }
  if (!res) throw lastErr || new Error(`Binance P2P ${fiat} ${tradeType}: all endpoints failed`);
  const j = await res.json();
  const ads = (j.data || []).filter(a => a && a.adv && a.advertiser);
  if (!ads.length) throw new Error(`Binance P2P ${fiat} ${tradeType}: no ads`);

  let offers = ads.map(a => ({
    merchant: a.advertiser.nickName || '—',
    price: parseFloat(a.adv.price),
    minSingleTransAmount: parseFloat(a.adv.minSingleTransAmount),
    maxSingleTransAmount: parseFloat(a.adv.dynamicMaxSingleTransAmount || a.adv.maxSingleTransAmount),
    payMethods: (a.adv.tradeMethods || []).map(m => m.tradeMethodName || m.identifier).filter(Boolean),
    finishRate: a.advertiser.monthFinishRate != null ? parseFloat(a.advertiser.monthFinishRate) : null,
    monthOrderCount: a.advertiser.monthOrderCount != null ? parseInt(a.advertiser.monthOrderCount, 10) : null,
    userType: a.advertiser.userType || '',
  })).filter(o => isFinite(o.price) && o.price > 0);

  // Filtre client-side sur maxSingleTransAmount. Toujours appliqué.
  // - minMax : rejette les offres parasites (max < seuil bas)
  // - maxMax : rejette les très gros marchands (max > seuil haut)
  //   utilisé pour SELL où on veut éviter les whales hors marché perso.
  offers = offers.filter(o =>
    isFinite(o.maxSingleTransAmount) &&
    o.maxSingleTransAmount >= minMax &&
    o.maxSingleTransAmount <= maxMax
  );
  if (!offers.length) throw new Error(`Binance P2P ${fiat} ${userSide}: no offers in range [${minMax}, ${maxMax}]`);

  // Filtre par moyen de paiement (substring case-insensitive sur tradeMethods).
  // Ex: 'attijari' matche 'Attijariwafa National Bank'. Pour MAD c'est crucial
  // car on ne tradera qu'avec des marchands qui acceptent ta banque.
  if (payMethodFilter) {
    const needle = String(payMethodFilter).toLowerCase();
    offers = offers.filter(o =>
      (o.payMethods || []).some(pm => String(pm).toLowerCase().includes(needle))
    );
    if (!offers.length) throw new Error(`Binance P2P ${fiat} ${userSide}: no offers with payment method "${payMethodFilter}"`);
  }

  // Sort ASC : cheapest first.
  // - userSide=BUY : on cherche le moins cher (ce qu'on achète au minimum)
  // - userSide=SELL : on cherche le floor des concurrents (ce qu'on doit
  //   matcher / undercut pour capter des clients en publiant son ad)
  offers.sort((a, b) => a.price - b.price);

  // Pour le verdict on agrège les top N — le reste reste affiché dans le table.
  const topN = offers.slice(0, takeTop);
  const topPrices = topN.map(o => o.price);
  const topPrice = topPrices[0];
  let medianPrice;
  if (agg === 'avg') {
    medianPrice = topPrices.reduce((s,x) => s+x, 0) / topPrices.length;
  } else {
    const sorted = [...topPrices].sort((a,b) => a-b);
    const mid = Math.floor(sorted.length/2);
    medianPrice = sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
  }
  const avgPrice = topPrices.reduce((s,x) => s+x, 0) / topPrices.length;

  return {
    fiat,
    userSide,
    tradeType: userSide,  // backward-compat: certaines fonctions lisent encore data.tradeType
    transAmount,
    topPrice, medianPrice, avgPrice,
    medianBasisLabel: label,
    aggregator: agg,
    takeTop,
    offers: offers.slice(0, 10),       // table display (full filtered set)
    offersForMedian: topN,             // les N que la médiane utilise
  };
}

// Filtres par côté — single source of truth (matche scripts/poll-p2p.js).
//
// BUY  AED → USDT (Dubai) : le user achète l'USDT à des SELL ads.
//   - max ≥ 10k AED (rejette les parasites)
//   - médiane des top 10 cheapest = prix typique d'achat
//
// SELL USDT → MAD (Maroc) : le user PUBLIE SA PROPRE ANNONCE de vente.
//   Donc ses concurrents = autres SELL ads. Pour les obtenir, query Binance
//   avec tradeType='BUY' (c'est fait dans la fonction). On filtre :
//   - max ∈ [5k, 50k] MAD (mid-volume — pas les whales, pas les parasites)
//   - banque Attijari obligatoire (= clients potentiels payent par Attijari)
//   - moyenne des 3 cheapest = floor des concurrents = prix max où on peut
//     poster son ad et rester compétitif
const RADAR_CFG = {
  BUY:  { transAmount: 10000, minMax: 10000, maxMax: Infinity,
          takeTop: 10, agg: 'median',
          payMethodFilter: null,
          label: 'max ≥ 10\u202fk AED' },
  SELL: { transAmount: 5000,  minMax: 5000,  maxMax: 50000,
          takeTop: 3,  agg: 'avg',
          payMethodFilter: 'attijari',
          label: 'max ∈ 5\u202fk–50\u202fk MAD · banque Attijari · moyenne top 3' },
};

// Compat ancien code (encore référencé par certains labels)
const RADAR_MIN_AMOUNT = { AED: 10000, MAD: 5000 };

// ---- USD/MAD LIVE -------------------------------------------------
// jsdelivr cache @latest aggressivement :
//   cache-control: public, max-age=604800, s-maxage=43200
//   → 7 jours navigateur + 12h CDN. Conséquence : une fois que le browser
//   a tapé @latest une fois, il sert la même réponse pendant 7j même si
//   le snapshot quotidien a été mis à jour entre temps.
// Fix : on tape les URLs **date-pinnées** `@YYYY-MM-DD/...` qui sont
// immuables (cache TTL inoffensif puisque l'URL change chaque jour).
// Cascade : today → yesterday (au cas où today pas encore publié, vers
// 16h UTC) → @latest (filet) → pages.dev (miroir).
async function radarFetchUsdMad() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${today}/v1/currencies/usd.json`,
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${yesterday}/v1/currencies/usd.json`,
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
  ];
  let lastErr = null;
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) { lastErr = new Error(`HTTP ${r.status}`); continue; }
      const j = await r.json();
      const rate = j && j.usd && j.usd.mad;
      if (rate && isFinite(rate)) return { usdMad: rate, date: j.date || null };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('USD/MAD fetch failed');
}

// ---- VERDICT HELPERS ----------------------------------------------
function radarBuyVerdict(pct) {
  // Lower premium over peg = better deal for buyer.
  if (pct <= 0.10) return { label: 'Excellent', cls: 'ok',   em: '✅', color: 'var(--green)' };
  if (pct <= 0.35) return { label: 'Bon',       cls: 'ok',   em: '👍', color: 'var(--green)' };
  if (pct <= 0.70) return { label: 'Moyen',     cls: 'w',    em: '⚠️', color: 'var(--yellow)' };
  return                  { label: 'Mauvais',   cls: 'e',    em: '❌', color: 'var(--red)' };
}
function radarSellVerdict(pct) {
  // Higher premium over market = better deal for seller.
  if (pct >= 5.0) return { label: 'Excellent', cls: 'ok',   em: '✅', color: 'var(--green)' };
  if (pct >= 3.0) return { label: 'Bon',       cls: 'ok',   em: '👍', color: 'var(--green)' };
  if (pct >= 1.0) return { label: 'Moyen',     cls: 'w',    em: '⚠️', color: 'var(--yellow)' };
  return                  { label: 'Faible',    cls: 'e',    em: '❌', color: 'var(--red)' };
}

// ---- GAUGE COMPONENT ----------------------------------------------
// Visual horizontal gauge, banded by the 4 verdict zones, with a
// floating bubble that points to the current spread position.
//
// BUY (lower spread = better) — gauge axis: 0% → +1.2% (left to right).
// SELL (higher spread = better) — flipped: 7% → 0% (left = good).
//
// Anatomy:
//   ┌─────────────────────────────────────┐
//   │            ┌──────────┐             │
//   │            │ +0,33%   │   ← bubble  │
//   │            └─────┬────┘             │
//   │                  ▼                   │
//   │ ██████░░░░▒▒▒▒▒▒████████████████   │ ← bar (4 zones)
//   │  Excel.  Bon    Moyen   Mauvais     │ ← zone labels
//   └─────────────────────────────────────┘
// The bar uses hard band transitions so each zone is unambiguously
// identifiable — plus subtle 2% fade between bands for visual polish.
// Tick marks at boundaries help locate zone edges.
function radarGaugeHTML(side, spread, opts) {
  opts = opts || {};
  const price = opts.price;         // display price (AED/USDT or MAD/USDT)
  const refRate = opts.refRate;     // peg (buy) or usd/mad (sell)

  // ---- Zone config ---------------------------------------------
  let scaleMin, scaleMax, zones, reverseDir;
  if (side === 'buy') {
    scaleMin = 0;
    scaleMax = 1.2; // leave visual room past the +0.70% Mauvais edge
    // Left = good, right = bad, in ascending spread order.
    zones = [
      { cut: 0.10, label: 'Excellent', color: '#16a34a' }, // green
      { cut: 0.35, label: 'Bon',       color: '#84cc16' }, // lime
      { cut: 0.70, label: 'Moyen',     color: '#eab308' }, // amber
      { cut: 1.20, label: 'Mauvais',   color: '#dc2626' }, // red
    ];
    reverseDir = false;
  } else {
    scaleMin = 0;
    scaleMax = 7;
    // Sell: zone cuts are lower-bounds (≥). Left = good (high spread).
    zones = [
      { cut: 5.0, label: 'Excellent', color: '#16a34a' },
      { cut: 3.0, label: 'Bon',       color: '#84cc16' },
      { cut: 1.0, label: 'Moyen',     color: '#eab308' },
      { cut: 0.0, label: 'Faible',    color: '#dc2626' },
    ];
    reverseDir = true;
  }

  // ---- Current position (0..100) ------------------------------
  let posPct;
  if (reverseDir) {
    posPct = ((scaleMax - spread) / (scaleMax - scaleMin)) * 100;
  } else {
    posPct = ((spread - scaleMin) / (scaleMax - scaleMin)) * 100;
  }
  const posClamped = Math.max(0, Math.min(100, posPct));

  // ---- Compute zone bands as [from%, to%] slices of the gauge -
  const bands = []; // { from, to, label, color }
  if (!reverseDir) {
    // BUY: zones in ascending order, left=good
    let prev = 0;
    zones.forEach(z => {
      const to = Math.min(100, ((z.cut - scaleMin) / (scaleMax - scaleMin)) * 100);
      bands.push({ from: prev, to: to, label: z.label, color: z.color });
      prev = to;
    });
  } else {
    // SELL: zones given in descending good-to-bad order. Left=good.
    let prev = 0;
    zones.forEach(z => {
      const to = Math.min(100, ((scaleMax - z.cut) / (scaleMax - scaleMin)) * 100);
      bands.push({ from: prev, to: to, label: z.label, color: z.color });
      prev = to;
    });
  }

  // Clamp last band to 100%
  if (bands.length) bands[bands.length - 1].to = 100;

  // Determine which zone the current position is in (for bubble color)
  const curBand = bands.find(b => posClamped <= b.to + 0.0001) || bands[bands.length - 1];

  // ---- Build gradient (hard bands with micro-fades) -----------
  // Each band uses its own color flat, with a 1.5% blend to next band.
  const FADE = 1.5;
  const gradStops = [];
  bands.forEach((b, i) => {
    const endFade = i < bands.length - 1 ? Math.max(b.to - FADE, b.from) : b.to;
    gradStops.push(`${b.color} ${b.from}%`, `${b.color} ${endFade}%`);
  });
  const gradient = `linear-gradient(to right, ${gradStops.join(', ')})`;

  // ---- Tick marks at boundaries (between-band) ----------------
  const tickHTML = bands
    .slice(0, -1)
    .map(b => `<div style="position:absolute;left:${b.to}%;top:-3px;bottom:-3px;width:2px;background:rgba(255,255,255,.85);transform:translateX(-50%);border-radius:2px"></div>`)
    .join('');

  // ---- Zone labels below --------------------------------------
  const zoneLabels = bands.map(b => {
    const mid = (b.from + b.to) / 2;
    const isCurrent = posClamped >= b.from && posClamped <= b.to + 0.0001;
    return `<div style="position:absolute;left:${mid}%;transform:translateX(-50%);font-size:.62rem;font-weight:${isCurrent ? 700 : 500};color:${isCurrent ? b.color : 'var(--muted)'};text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">${b.label}</div>`;
  }).join('');

  // ---- Bubble -------------------------------------------------
  const spreadSign = spread >= 0 ? '+' : '';
  const spreadStr  = spreadSign + spread.toFixed(2) + '%';
  const priceStr   = price != null ? price.toFixed(side === 'buy' ? 4 : 3).replace('.', ',') : '';
  // Keep bubble within container visually — anchor the tail to the
  // exact position, but bias the bubble 1-2px inward at extremes.
  const bubbleHTML = `
    <div style="position:absolute;left:${posClamped}%;top:-48px;transform:translateX(-50%);pointer-events:none;z-index:3">
      <div style="background:${curBand.color};color:#fff;padding:5px 11px;border-radius:7px;font-size:.82rem;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.25);font-variant-numeric:tabular-nums;display:flex;align-items:center;gap:6px">
        ${priceStr ? `<span style="opacity:.85;font-weight:600;font-size:.72rem">${priceStr}</span><span style="opacity:.5">·</span>` : ''}
        <span>${spreadStr}</span>
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${curBand.color};margin:-1px auto 0;filter:drop-shadow(0 2px 2px rgba(0,0,0,.15))"></div>
    </div>
  `;

  // ---- End scale labels ---------------------------------------
  const leftLabel  = side === 'buy' ? `peg ${(refRate||0).toFixed(4).replace('.', ',')}` : `marché ${(refRate||0).toFixed(4).replace('.', ',')} +${scaleMax}%`;
  const rightLabel = side === 'buy' ? `peg +${scaleMax}%` : `marché`;

  return `
    <div style="position:relative;margin:54px 6px 30px">
      ${bubbleHTML}
      <div style="position:relative;height:16px;border-radius:8px;background:${gradient};box-shadow:inset 0 1px 2px rgba(0,0,0,.18),0 1px 0 rgba(255,255,255,.1);overflow:visible">
        ${tickHTML}
      </div>
      <div style="position:relative;height:14px;margin-top:7px">${zoneLabels}</div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:.58rem;color:var(--muted);font-variant-numeric:tabular-nums">
        <span>${leftLabel}</span>
        <span>${rightLabel}</span>
      </div>
    </div>
  `;
}

// ---- CONTENT RENDERER ---------------------------------------------
// Always renders both cards + gauges. Binance data is OPTIONAL — when
// present, it seeds the "observed price" inputs and adds a market-position
// marker on the gauge. When absent, the user types the price manually.
// The gauge + verdict update live on each keystroke (oninput handlers).
function radarRenderContent(buy, sell, fx) {
  const peg = (DATA.fxP2P && DATA.fxP2P.leg2 && DATA.fxP2P.leg2.tauxMarche) || 3.6725;

  // ---- Pick sensible defaults for the price inputs ----------
  // Priority: Binance live median → user's historical average → neutral
  // reference (peg for buy, mkt*1.035 for sell = middle of "Bon" zone).
  const l2 = (DATA.fxP2P && DATA.fxP2P.leg2 && DATA.fxP2P.leg2.transactions) || [];
  const l3 = (DATA.fxP2P && DATA.fxP2P.leg3 && DATA.fxP2P.leg3.transactions) || [];
  const histBuyAvg  = l2.length ? l2.reduce((s,t) => s+t.prix, 0) / l2.length : peg * 1.003;
  const histSellAvg = l3.length ? l3.reduce((s,t) => s+t.prix, 0) / l3.length : 0;

  const defaultUsdMad = fx ? fx.usdMad : (l3.length && DATA.fxP2P.leg3.tauxMarche
    ? (function() {
        const entries = Object.entries(DATA.fxP2P.leg3.tauxMarche).sort((a,b) => a[0]<b[0]?1:-1);
        return entries[0] ? entries[0][1] : 9.2;
      })()
    : 9.2);
  const defaultBuyPrice  = buy  ? buy.medianPrice  : histBuyAvg;
  const defaultSellPrice = sell ? sell.medianPrice : (histSellAvg || defaultUsdMad * 1.035);

  // ---- Seed state so the update handlers can read it --------
  // PRESERVE USER OVERRIDES: once the user types in an input or clicks
  // "Marché Binance live" to sync, that field becomes "user-set" and
  // subsequent auto-refreshes won't clobber it. The live market value
  // still updates in the "Marché Binance" link so the user can re-sync
  // by clicking it. Without this, typing 3.69 would get overwritten 60s
  // later when the auto-refresh fires.
  const s = window._radarState;
  s.peg          = peg;
  s.usdMadDate   = fx && fx.date || null;
  s.buyData      = buy;   // always update — this is the "live market" line
  s.sellData     = sell;
  if (!s.buyPriceUserSet)  s.buyPrice  = defaultBuyPrice;
  if (!s.sellPriceUserSet) s.sellPrice = defaultSellPrice;
  if (!s.usdMadUserSet) {
    s.usdMad       = defaultUsdMad;
    s.usdMadIsLive = !!fx;
  }
  // lastLoadAt is set by radarLoad() right before calling us, but if
  // we were called from the offline branch before any successful load,
  // fall back to "now" so the freshness badge shows current time.
  if (!s.lastLoadAt) s.lastLoadAt = Date.now();

  const body = document.getElementById('radarBody');
  if (!body) return;
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;margin-bottom:22px">
      <div id="buyCardMount">${radarBuyCardHTML()}</div>
      <div id="sellCardMount">${radarSellCardHTML()}</div>
    </div>
    ${radarSpreadHistorySection()}
    ${radarHistoricalContext(buy, sell, fx, peg)}
    ${buy  ? radarOffersTable(buy,  'BUY',  peg) : ''}
    ${sell && fx ? radarOffersTable(sell, 'SELL', fx.usdMad) : ''}
  `;
}

// ---- MES STATS PERSO (depuis leg2/leg3 transactions) --------------
// Sur hover de la gauge, on montre 3 chiffres clés calculés depuis
// l'historique de l'utilisateur lui-même (pas l'historique market):
//   • Dernière tx : spread de la transaction la plus récente
//   • Moyenne 30j : spread moyen sur les tx des 30 derniers jours
//   • Moyenne globale : spread moyen sur toutes les tx historiques
// Pour BUY (leg2): spread = (prix - peg) / peg × 100 (peg fixe 3.6725)
// Pour SELL (leg3): spread = (prix - mkt) / mkt × 100 (mkt = leg3.tauxMarche[date])
function radarComputeMyStats(side) {
  const fx = DATA.fxP2P;
  if (!fx) return null;
  const peg = (fx.leg2 && fx.leg2.tauxMarche) || 3.6725;

  let txs = [];
  if (side === 'buy') {
    const raw = (fx.leg2 && fx.leg2.transactions) || [];
    txs = raw.map(t => ({
      date: t.date,
      ts: new Date(t.date).getTime(),
      spread: ((t.prix - peg) / peg) * 100,
    }));
  } else {
    const raw = (fx.leg3 && fx.leg3.transactions) || [];
    const mktMap = (fx.leg3 && fx.leg3.tauxMarche) || {};
    txs = raw.map(t => {
      const mkt = mktMap[t.date] || 0;
      return {
        date: t.date,
        ts: new Date(t.date).getTime(),
        spread: mkt > 0 ? ((t.prix - mkt) / mkt) * 100 : null,
      };
    }).filter(t => t.spread != null);
  }
  if (!txs.length) return null;

  // Tri chronologique pour identifier la dernière tx
  txs.sort((a, b) => a.ts - b.ts);
  const last = txs[txs.length - 1];

  const now = Date.now();
  const cutoff30d = now - 30 * 24 * 3600 * 1000;
  const last30 = txs.filter(t => t.ts >= cutoff30d);
  const avg30 = last30.length ? last30.reduce((s,t) => s + t.spread, 0) / last30.length : null;
  const avgAll = txs.reduce((s,t) => s + t.spread, 0) / txs.length;

  return {
    last:  { date: last.date, spread: last.spread },
    last30:{ count: last30.length, avg: avg30 },
    all:   { count: txs.length, avg: avgAll },
  };
}

// HTML helper: rend le tooltip "Mes stats" pour un côté donné
function radarMyStatsTooltip(side) {
  const s = radarComputeMyStats(side);
  if (!s) return '';
  const fmtSpread = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  const isBuy = side === 'buy';
  // Pour BUY (vs peg): bas spread = bon (vert si ≤ 0.35)
  // Pour SELL (vs marché): haut spread = bon (vert si ≥ 3)
  const goodFn = (v) => v == null ? false : (isBuy ? v <= 0.35 : v >= 3.0);
  const colorFn = (v) => v == null ? 'var(--muted)' : (goodFn(v) ? 'var(--green)' : 'var(--yellow)');
  return `<div class="radar-tip">
    <strong>Mes stats — ${isBuy ? 'achats AED→USDT' : 'ventes USDT→MAD'}</strong>
    <div style="height:6px"></div>
    <div class="tip-row"><span class="tip-key">Dernière tx (${s.last.date})</span><span class="tip-val" style="color:${colorFn(s.last.spread)}">${fmtSpread(s.last.spread)}</span></div>
    <div class="tip-row"><span class="tip-key">Moyenne 30j (${s.last30.count} tx)</span><span class="tip-val" style="color:${colorFn(s.last30.avg)}">${fmtSpread(s.last30.avg)}</span></div>
    <div class="tip-row"><span class="tip-key">Moyenne globale (${s.all.count} tx)</span><span class="tip-val" style="color:${colorFn(s.all.avg)}">${fmtSpread(s.all.avg)}</span></div>
  </div>`;
}

// ---- CARD BUILDERS (always render; handlers re-call these) --------
function radarBuyCardHTML() {
  const s = window._radarState;
  const price = s.buyPrice;
  const peg = s.peg;
  const spread = ((price - peg) / peg) * 100;
  const v = radarBuyVerdict(spread);
  const gauge = radarGaugeHTML('buy', spread, { price: price, refRate: peg });

  const buyLabel = s.buyData?.medianBasisLabel || `max ≥ 10\u202fk AED`;
  const binanceLine = s.buyData
    ? `<span style="color:var(--muted)">Marché Binance <span style="font-size:.65rem;opacity:.7">(${buyLabel})</span> : </span><button type="button" onclick="radarUpdateBuy(${s.buyData.medianPrice})" style="background:none;border:none;color:var(--accent);cursor:pointer;padding:0;font-weight:700;font-variant-numeric:tabular-nums;font-family:inherit;text-decoration:underline dotted" title="Cliquer pour synchroniser">${s.buyData.medianPrice.toFixed(4).replace('.', ',')}</button> <span style="color:var(--muted)">· meilleure ${s.buyData.topPrice.toFixed(4).replace('.', ',')}</span> ${radarLiveBadge('buy', s.lastLoadAt)}`
    : `<span style="color:var(--yellow)">⚠ Binance indisponible — saisis le prix observé</span>`;

  const priceStr = price.toFixed(4).replace('.', ',');

  return `
    <div class="radar-card" style="background:var(--surface);border:2px solid ${v.color};border-radius:12px;padding:18px 20px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px">
        <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">🇦🇪 Achat AED → USDT · Dubai</div>
        <div style="font-size:.8rem;font-weight:700;color:${v.color}" id="buyVerdictPill">${v.em} ${v.label}</div>
      </div>

      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <input type="text" inputmode="decimal" value="${priceStr}" oninput="radarUpdateBuy(this.value)"
               style="background:var(--surface2);border:2px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:1.6rem;font-weight:800;font-variant-numeric:tabular-nums;width:140px;outline:none;font-family:inherit" />
        <div>
          <div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Prix observé</div>
          <div style="font-size:.78rem;color:var(--muted)">AED/USDT</div>
        </div>
      </div>

      <div style="margin-top:10px;font-size:.78rem;line-height:1.5">
        <span style="color:var(--muted)">Peg AED/USD : </span><strong style="font-variant-numeric:tabular-nums">${peg.toFixed(4).replace('.', ',')}</strong><span style="color:var(--muted)"> (fixe)</span>
        <br>${binanceLine}
      </div>

      <div class="radar-tip-wrap" style="margin-top:6px">
        ${gauge}
        ${radarMyStatsTooltip('buy')}
      </div>
      <div style="font-size:.75rem;color:var(--muted);line-height:1.5" id="buyAdvice">${radarBuyAdvice(v.label, spread)}</div>
    </div>
  `;
}

function radarSellCardHTML() {
  const s = window._radarState;
  const price = s.sellPrice;
  const usdMad = s.usdMad;
  const spread = ((price - usdMad) / usdMad) * 100;
  const v = radarSellVerdict(spread);
  const gauge = radarGaugeHTML('sell', spread, { price: price, refRate: usdMad });

  const sellLabel = s.sellData?.medianBasisLabel || `max ∈ 5\u202fk–50\u202fk MAD · moyenne top 3`;
  const binanceLine = s.sellData
    ? `<span style="color:var(--muted)">Marché Binance <span style="font-size:.65rem;opacity:.7">(${sellLabel})</span> : </span><button type="button" onclick="radarUpdateSell(${s.sellData.medianPrice})" style="background:none;border:none;color:var(--accent);cursor:pointer;padding:0;font-weight:700;font-variant-numeric:tabular-nums;font-family:inherit;text-decoration:underline dotted" title="Cliquer pour synchroniser">${s.sellData.medianPrice.toFixed(3).replace('.', ',')}</button> <span style="color:var(--muted)">· meilleure ${s.sellData.topPrice.toFixed(3).replace('.', ',')}</span> ${radarLiveBadge('sell', s.lastLoadAt)}`
    : `<span style="color:var(--yellow)">⚠ Binance indisponible — saisis le prix observé</span>`;

  const fxStatus = s.usdMadIsLive
    ? `<span style="color:var(--green);font-size:.65rem">● live${s.usdMadDate ? ` ${s.usdMadDate}` : ''}</span>`
    : `<span style="color:var(--yellow);font-size:.65rem">● manuel</span>`;

  const priceStr = price.toFixed(3).replace('.', ',');
  const usdMadStr = usdMad.toFixed(4).replace('.', ',');

  return `
    <div class="radar-card" style="background:var(--surface);border:2px solid ${v.color};border-radius:12px;padding:18px 20px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px">
        <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">🇲🇦 Vente USDT → MAD · Maroc</div>
        <div style="font-size:.8rem;font-weight:700;color:${v.color}" id="sellVerdictPill">${v.em} ${v.label}</div>
      </div>

      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <input type="text" inputmode="decimal" value="${priceStr}" oninput="radarUpdateSell(this.value)"
               style="background:var(--surface2);border:2px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:1.6rem;font-weight:800;font-variant-numeric:tabular-nums;width:140px;outline:none;font-family:inherit" />
        <div>
          <div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Prix observé</div>
          <div style="font-size:.78rem;color:var(--muted)">MAD/USDT</div>
        </div>
      </div>

      <div style="margin-top:10px;font-size:.78rem;line-height:1.6;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="color:var(--muted)">USD/MAD :</span>
        <input type="text" inputmode="decimal" value="${usdMadStr}" oninput="radarUpdateUsdMad(this.value)"
               style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:3px 7px;color:var(--text);font-size:.82rem;font-weight:700;font-variant-numeric:tabular-nums;width:80px;outline:none;font-family:inherit" />
        ${fxStatus}
      </div>
      <div style="margin-top:4px;font-size:.78rem;line-height:1.5">${binanceLine}</div>

      <div class="radar-tip-wrap" style="margin-top:6px">
        ${gauge}
        ${radarMyStatsTooltip('sell')}
      </div>
      <div style="font-size:.75rem;color:var(--muted);line-height:1.5" id="sellAdvice">${radarSellAdvice(v.label, spread)}</div>
    </div>
  `;
}

// ---- LIVE UPDATE HANDLERS (called from inline oninput) ------------
// Parse a user-entered value that may use comma or dot as decimal
// separator. Silently ignore invalid input (keeps the last valid state).
function radarParseNum(raw) {
  const n = parseFloat(String(raw || '').replace(',', '.'));
  return (isFinite(n) && n > 0) ? n : null;
}

window.radarUpdateBuy = function(raw) {
  const n = radarParseNum(raw);
  if (n == null) return;
  window._radarState.buyPrice = n;
  const mount = document.getElementById('buyCardMount');
  if (mount) mount.innerHTML = radarBuyCardHTML();
  // Move focus back to the input so the user can keep typing without
  // the cursor jumping (re-rendering via innerHTML loses focus). Also
  // place the cursor at the end.
  radarRestoreFocus(mount, 'input', String(raw));
};

window.radarUpdateSell = function(raw) {
  const n = radarParseNum(raw);
  if (n == null) return;
  window._radarState.sellPrice = n;
  const mount = document.getElementById('sellCardMount');
  if (mount) mount.innerHTML = radarSellCardHTML();
  radarRestoreFocus(mount, 'input:first-of-type', String(raw));
};

window.radarUpdateUsdMad = function(raw) {
  const n = radarParseNum(raw);
  if (n == null) return;
  window._radarState.usdMad = n;
  window._radarState.usdMadIsLive = false; // user manual override
  const mount = document.getElementById('sellCardMount');
  if (mount) mount.innerHTML = radarSellCardHTML();
  // Focus the USD/MAD input (second input in the sell card)
  radarRestoreFocus(mount, 'input:nth-of-type(2)', String(raw));
};

// ---- MERCHANT KNOWLEDGE (3 levels) ---------------------------------
// Sémantique des 3 niveaux (cf. PRIV_DATA.fxP2P dans encrypt.js):
//
//   1. ⭐ CONFIRMÉ  — au moins une transaction "Completed" (issue du
//                     Binance C2C Order History). Fiable + RIB validé.
//   2. 🔸 RIB VALIDÉ — orders passés (même cancellés). Le RIB a été
//                     ajouté à la banque à un moment donné.
//   3. 🆕 NOUVEAU   — jamais interagi. RIB à ajouter + 4h de validation.
//
// Sources (fusionnées, case-insensitive):
//   - encrypt.js (canonique): merchantsAED/MAD + confirmedMerchantsAED/MAD
//   - localStorage (live UI): radar_known_merchants = {
//       AED: { all: [...], confirmed: [...] },
//       MAD: { all: [...], confirmed: [...] }
//     }
// Un clic sur ☆/🔸/⭐ dans la table cycle entre les 3 niveaux:
//   nouveau → RIB validé → confirmé → nouveau...
function radarClassifyMerchant(side, nickname) {
  const fiat = side === 'BUY' ? 'AED' : 'MAD';
  const name = String(nickname || '').trim().toLowerCase();
  if (!name) return 'new';
  const fx = DATA.fxP2P || {};
  const encAll       = (fx['merchants' + fiat] || []).map(s => String(s).toLowerCase());
  const encConfirmed = (fx['confirmedMerchants' + fiat] || []).map(s => String(s).toLowerCase());
  // Backward compat with v4 data that used knownMerchantsAED/MAD (single list)
  const encLegacy    = (fx['knownMerchants' + fiat] || []).map(s => String(s).toLowerCase());
  let lsAll = [], lsConfirmed = [];
  try {
    const raw = localStorage.getItem('radar_known_merchants');
    if (raw) {
      const obj = JSON.parse(raw);
      const entry = obj && obj[fiat] || {};
      // New schema {all:[], confirmed:[]} OR legacy v4 schema [flat array]
      if (Array.isArray(entry)) { lsAll = entry.map(s => String(s).toLowerCase()); }
      else {
        lsAll       = (entry.all       || []).map(s => String(s).toLowerCase());
        lsConfirmed = (entry.confirmed || []).map(s => String(s).toLowerCase());
      }
    }
  } catch (e) { /* ignore */ }
  const confirmedSet = new Set([...encConfirmed, ...lsConfirmed]);
  const allSet       = new Set([...encAll, ...encLegacy, ...encConfirmed, ...lsAll, ...lsConfirmed]);
  if (confirmedSet.has(name)) return 'confirmed';
  if (allSet.has(name))       return 'known';
  return 'new';
}

// Cycle un marchand: new → known → confirmed → new ...
// On ne touche qu'à localStorage — les listes encrypt.js sont canoniques
// (à maintenir via export Binance + `node encrypt.js`, voir UPDATE_GUIDE).
function radarToggleKnownMerchant(side, nickname) {
  const fiat = side === 'BUY' ? 'AED' : 'MAD';
  const key = String(nickname || '').trim();
  if (!key) return;
  const lower = key.toLowerCase();
  const cur = radarClassifyMerchant(side, key);

  // Ensure localStorage object with the new schema
  let obj = {};
  try { obj = JSON.parse(localStorage.getItem('radar_known_merchants') || '{}'); } catch (e) {}
  if (!obj[fiat] || Array.isArray(obj[fiat])) {
    obj[fiat] = { all: Array.isArray(obj[fiat]) ? obj[fiat] : [], confirmed: [] };
  }
  const all = obj[fiat].all       || (obj[fiat].all = []);
  const cnf = obj[fiat].confirmed || (obj[fiat].confirmed = []);
  const rem = (arr) => { const i = arr.findIndex(n => n.toLowerCase() === lower); if (i >= 0) arr.splice(i, 1); };
  const add = (arr) => { if (!arr.some(n => n.toLowerCase() === lower)) arr.push(key); };

  if (cur === 'new') {
    // new → known
    add(all);
  } else if (cur === 'known') {
    // known → confirmed (add to confirmed; leave in all implicitly via add)
    add(cnf);
  } else {
    // confirmed → new (remove from both localStorage lists; note: we can't
    // remove from encrypt.js at runtime — cycling a canonical-confirmed
    // merchant effectively won't downgrade it; that's a feature since those
    // are derived from your Binance export)
    rem(all); rem(cnf);
  }
  try { localStorage.setItem('radar_known_merchants', JSON.stringify(obj)); } catch (e) {}

  // Ne re-render QUE les deux tables d'offres (laisse les cards intactes
  // pour ne pas perdre le focus des inputs).
  const s = window._radarState;
  const body = document.getElementById('radarBody');
  if (!body) return;
  const buyOffers  = s.buyData  ? radarOffersTable(s.buyData,  'BUY',  s.peg)    : '';
  const sellOffers = (s.sellData && s.usdMad) ? radarOffersTable(s.sellData, 'SELL', s.usdMad) : '';
  body.querySelectorAll('.s').forEach(sec => {
    const st = sec.querySelector('.st');
    if (!st) return;
    const label = st.textContent || '';
    if (label.includes('Top 10 offres Binance P2P — Achat AED') && buyOffers) {
      const tmp = document.createElement('div'); tmp.innerHTML = buyOffers;
      sec.replaceWith(tmp.firstElementChild);
    } else if (label.includes('Top 10 offres Binance P2P — Vente USDT') && sellOffers) {
      const tmp = document.createElement('div'); tmp.innerHTML = sellOffers;
      sec.replaceWith(tmp.firstElementChild);
    }
  });
}
window.radarToggleKnownMerchant = radarToggleKnownMerchant;

// innerHTML destroys focus; re-find the target input and re-seat caret.
function radarRestoreFocus(container, selector, displayValue) {
  if (!container) return;
  const el = container.querySelector(selector);
  if (!el) return;
  try {
    el.focus();
    // Put cursor at end of the input so typing continues naturally.
    const len = (el.value || '').length;
    el.setSelectionRange(len, len);
  } catch (e) { /* some browsers/inputs don't support setSelectionRange */ }
}

function radarBuyAdvice(label, pct) {
  if (label === 'Excellent') return 'Fonce : prix très proche du peg, quasiment pas de premium payé.';
  if (label === 'Bon')       return 'OK pour acheter — premium acceptable (< 0,35 % au-dessus du peg).';
  if (label === 'Moyen')     return 'Surveille — si tu dois absolument acheter, passe par la meilleure offre. Sinon, attends.';
  return 'Attends — premium > 0,70 % au-dessus du peg, le marché est tendu côté buy.';
}
function radarSellAdvice(label, pct) {
  if (label === 'Excellent') return 'Vends maintenant — premium > 5 % au-dessus du marché, très rare.';
  if (label === 'Bon')       return 'Bon moment pour vendre — premium > 3 %, dans ta zone historique de confort.';
  if (label === 'Moyen')     return 'Acceptable mais pas optimal — vends si tu as besoin de cash, sinon patiente un peu.';
  return 'N\'urge pas — premium < 1 %, attends une meilleure fenêtre (demande MAD variable selon les jours).';
}

function radarCardOffline(title, msg) {
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;opacity:.85">
      <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${title}</div>
      <div style="font-size:1.1rem;color:var(--muted);margin-top:10px">—</div>
      <div style="margin-top:12px;padding:10px 12px;background:var(--red-bg);border-radius:8px;font-size:.78rem;color:var(--red)">
        ✗ ${msg}
      </div>
    </div>
  `;
}

// ---- SPREAD HISTORY (poller GitHub Actions, toutes les 6h) --------
// Sparklines SVG inline (pas de Chart.js). Affiche l'évolution sur
// 7j / 30j / 90j (sélectionnable) du spread BUY (vs peg) et SELL
// (vs USD/MAD), plus quelques stats (min, max, avg, dernier vs avg).
//
// Source: window.DATA.fxP2P.history = [{ts, spreads:{buy,sell}, ...}]
// Rempli par scripts/poll-p2p.js → .github/workflows/poll-p2p.yml.
//
// Si pas d'historique (déploiement initial), affiche un placeholder.
function radarSpreadHistorySection() {
  const hist = (DATA.fxP2P && DATA.fxP2P.history) || [];
  if (!hist.length) {
    return `<div class="s">
      <div class="st">Historique du spread P2P</div>
      <div class="n">Aucun historique encore disponible. Le poller GitHub Actions tourne toutes les 6h et accumulera les entrées au fil du temps. Reviens dans quelques heures !</div>
    </div>`;
  }

  // État de la sélection de période (in-memory, pas persisté)
  if (!window._radarHistRange) window._radarHistRange = '30';
  const range = window._radarHistRange;

  const now = Date.now();
  const cutoffs = { '7': 7, '30': 30, '90': 90, 'all': null };
  const days = cutoffs[range];
  const cutoffTs = days != null ? now - days * 24 * 3600 * 1000 : 0;
  const window_ = hist.filter(e => new Date(e.ts).getTime() >= cutoffTs);

  // Boutons de range
  const rangeBtn = (val, label) => {
    const active = range === val;
    return `<button type="button" onclick="window.radarSetHistRange('${val}')" style="appearance:none;background:${active?'var(--accent)':'transparent'};color:${active?'#fff':'var(--muted)'};border:1px solid var(--border);border-radius:6px;padding:4px 12px;font-size:.72rem;font-weight:600;cursor:pointer;font-family:inherit">${label}</button>`;
  };
  const rangeBar = `<div style="display:flex;gap:6px;margin-bottom:14px">
    ${rangeBtn('7', '7 jours')}${rangeBtn('30', '30 jours')}${rangeBtn('90', '90 jours')}${rangeBtn('all', 'Tout')}
    <span style="margin-left:auto;font-size:.7rem;color:var(--muted);align-self:center">${window_.length} points · poll toutes les 6h</span>
  </div>`;

  // Une mini-carte par côté avec sparkline + stats
  const buyChart  = radarSparklineCard('buy',  window_);
  const sellChart = radarSparklineCard('sell', window_);

  return `<div class="s">
    <div class="st">Historique du spread P2P</div>
    ${rangeBar}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:14px">
      ${buyChart}
      ${sellChart}
    </div>
    <div class="n" style="margin-top:10px;font-size:.7rem">Auto-collecté toutes les 6h par GitHub Actions (cf. <code>.github/workflows/poll-p2p.yml</code>). Median sur les 10 meilleures offres ≥ 10k AED / 20k MAD. Spread BUY = vs peg 3,6725. Spread SELL = vs USD/MAD live (fawazahmed0).</div>
  </div>`;
}

window.radarSetHistRange = function(val) {
  window._radarHistRange = val;
  const body = document.getElementById('radarBody');
  if (!body) return;
  // Re-render only the spread history section
  const sections = body.querySelectorAll('.s');
  for (const sec of sections) {
    const st = sec.querySelector('.st');
    if (st && st.textContent.trim().startsWith('Historique du spread')) {
      const tmp = document.createElement('div');
      tmp.innerHTML = radarSpreadHistorySection();
      sec.replaceWith(tmp.firstElementChild);
      break;
    }
  }
};

// Store series on the window so the hover handler — invoked from inline
// pointermove via onmousemove — can resolve index → {ts, v} in O(1) without
// re-fetching. Keyed by side ('buy' | 'sell'). Re-written on each render.
window._radarChartData = window._radarChartData || {};

function radarSparklineCard(side, entries) {
  const isBuy = side === 'buy';
  const title = isBuy ? '🇦🇪 Achat AED → USDT (spread vs peg)'
                      : '🇲🇦 Vente USDT → MAD (spread vs marché)';
  // Spread "bon" : pour buy = bas (vert si ≤ 0.35), pour sell = haut (vert si ≥ 3.0)
  const goodThreshold = isBuy ? 0.35 : 3.0;
  const directionTag  = isBuy ? '↓ bon' : '↑ bon';

  // Filtre les entrées valides (non-null pour ce côté)
  const series = entries
    .map(e => ({ ts: new Date(e.ts).getTime(), v: e.spreads ? e.spreads[side] : null }))
    .filter(p => p.v != null && isFinite(p.v));

  if (!series.length) {
    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
      <div style="font-size:.78rem;font-weight:700;margin-bottom:8px">${title}</div>
      <div style="font-size:.75rem;color:var(--muted)">Pas de données pour cette période.</div>
    </div>`;
  }

  // Stats
  const vals = series.map(p => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const avg = vals.reduce((s,x) => s+x, 0) / vals.length;
  const last = vals[vals.length - 1];
  const lastVsAvg = last - avg;
  const goodLast = isBuy ? (last <= goodThreshold) : (last >= goodThreshold);
  const goodAvg  = isBuy ? (avg  <= goodThreshold) : (avg  >= goodThreshold);

  // Sparkline SVG — taller than before (140px) to fit axis + grid
  const W = 320, H = 140;
  const PL = 32, PR = 10, PT = 10, PB = 22; // left / right / top / bottom padding
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const tMin = series[0].ts, tMax = series[series.length-1].ts || (tMin + 1);
  const tRange = Math.max(1, tMax - tMin);
  const vMin = Math.min(min, 0);
  const vMax = Math.max(max, goodThreshold * 1.4);
  const vRange = Math.max(0.0001, vMax - vMin);
  const xOf = ts => PL + ((ts - tMin) / tRange) * plotW;
  // Pour buy: bas spread = bon → on veut HAUT du graph → invert Y
  // Pour sell: haut spread = bon → standard (haut = haut)
  const yOf = v => {
    const norm = (v - vMin) / vRange; // 0 = vMin (bas), 1 = vMax (haut)
    return isBuy
      ? PT + norm * plotH              // buy: bon (bas spread) = haut du graph
      : PT + (1 - norm) * plotH;       // sell: bon (haut spread) = haut du graph
  };

  const yThresh = yOf(goodThreshold);
  const lineColor = goodLast ? '#16a34a' : (isBuy ? (last > 0.7 ? '#dc2626' : '#eab308') : (last < 1.0 ? '#dc2626' : '#eab308'));
  const fillColor = lineColor + '22';

  // Polyline
  const pts = series.map(p => `${xOf(p.ts).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(' ');
  const fillPts = pts + ` ${xOf(tMax).toFixed(1)},${(H-PB).toFixed(1)} ${PL.toFixed(1)},${(H-PB).toFixed(1)}`;

  // Last point marker
  const lastP = series[series.length - 1];
  const lx = xOf(lastP.ts), ly = yOf(lastP.v);

  // ---- Grid & axes --------------------------------------------
  // Y-axis: 3 labels (min, threshold, max) aligned with gridlines
  const yTicks = [vMin, goodThreshold, vMax].filter((v, i, arr) => arr.indexOf(v) === i);
  const yAxisHTML = yTicks.map(v => {
    const y = yOf(v);
    const isThreshold = Math.abs(v - goodThreshold) < 0.001;
    const color = isThreshold ? 'rgba(34,197,94,.7)' : 'var(--muted)';
    const stroke = isThreshold ? 'rgba(34,197,94,.35)' : 'rgba(148,163,184,.18)';
    const dash = isThreshold ? 'stroke-dasharray="3 3"' : '';
    const label = `${v >= 0 ? '+' : ''}${v.toFixed(v === goodThreshold ? 2 : 1)}%`;
    return `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W-PR}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-width="1" ${dash} />
            <text x="${PL-4}" y="${(y+3).toFixed(1)}" text-anchor="end" fill="${color}" font-size="9" font-family="ui-monospace,Menlo,monospace">${label}</text>`;
  }).join('');

  // X-axis: 3 date labels (start, middle, end)
  const fmtShortDate = (ts) => {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  };
  const xTicks = [tMin, (tMin + tMax) / 2, tMax];
  const xAxisHTML = xTicks.map((ts, i) => {
    const x = xOf(ts);
    const anchor = i === 0 ? 'start' : (i === xTicks.length - 1 ? 'end' : 'middle');
    return `<text x="${x.toFixed(1)}" y="${(H-6).toFixed(1)}" text-anchor="${anchor}" fill="var(--muted)" font-size="9" font-family="ui-monospace,Menlo,monospace">${fmtShortDate(ts)}</text>`;
  }).join('');

  // Data dots — subtle by default, highlighted by the hover handler
  const dotsHTML = series.map((p, i) =>
    `<circle cx="${xOf(p.ts).toFixed(1)}" cy="${yOf(p.v).toFixed(1)}" r="2" fill="${lineColor}" opacity="0.35" data-idx="${i}" />`
  ).join('');

  // Stash coords + series in a module map so the inline pointermove
  // handler can find the nearest point in O(log n).
  window._radarChartData[side] = {
    series, W, H, PL, PR, PT, PB, tMin, tMax, tRange, vMin, vMax, vRange,
    isBuy, goodThreshold, lineColor,
  };

  const svgId = `radarChart-${side}`;
  const tooltipId = `radarChartTooltip-${side}`;
  const crosshairId = `radarCrosshair-${side}`;
  const hoverDotId = `radarHoverDot-${side}`;
  const threshLabel = isBuy ? `≤ ${goodThreshold}% bon` : `≥ ${goodThreshold}% bon`;

  const svg = `<svg id="${svgId}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
    style="width:100%;height:140px"
    onmousemove="window.radarChartHover(event,'${side}')"
    onmouseleave="window.radarChartHoverEnd('${side}')"
    ontouchmove="window.radarChartHover(event.touches[0],'${side}');event.preventDefault()"
    ontouchend="window.radarChartHoverEnd('${side}')">
    <!-- Grid + Y-axis labels -->
    ${yAxisHTML}
    <!-- Threshold hint text (aligned right) -->
    <text x="${(W-PR-2).toFixed(1)}" y="${(yThresh-4).toFixed(1)}" text-anchor="end" fill="rgba(34,197,94,.7)" font-size="9" font-family="sans-serif">${threshLabel}</text>
    <!-- Filled area -->
    <polygon points="${fillPts}" fill="${fillColor}" />
    <!-- Line -->
    <polyline points="${pts}" fill="none" stroke="${lineColor}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />
    <!-- All data dots -->
    ${dotsHTML}
    <!-- Last point marker -->
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5" fill="${lineColor}" stroke="#fff" stroke-width="1.5" />
    <!-- X-axis date labels -->
    ${xAxisHTML}
    <!-- Crosshair (hidden by default, moved by hover handler) -->
    <g id="${crosshairId}" style="display:none;pointer-events:none">
      <line x1="0" y1="${PT}" x2="0" y2="${(H-PB).toFixed(1)}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3" opacity="0.7" />
    </g>
    <!-- Hover dot (hidden by default) -->
    <circle id="${hoverDotId}" cx="0" cy="0" r="5" fill="${lineColor}" stroke="#fff" stroke-width="2" style="display:none;pointer-events:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))" />
  </svg>`;

  // Stats grid
  const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  const trendIcon = lastVsAvg === 0 ? '→' : (lastVsAvg > 0 ? '↑' : '↓');
  const trendColor = (isBuy ? lastVsAvg < 0 : lastVsAvg > 0) ? 'var(--green)' : 'var(--red)';

  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">
      <div style="font-size:.78rem;font-weight:700">${title}</div>
      <div style="font-size:.6rem;color:var(--muted)">${directionTag} · ${series.length} pts</div>
    </div>
    <div class="radar-chart-wrap">
      ${svg}
      <div class="chart-tooltip" id="${tooltipId}">
        <div class="tt-date">—</div>
        <div class="tt-val">—</div>
        <div class="tt-extra">—</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;font-size:.7rem">
      <div><div style="color:var(--muted);font-size:.62rem;text-transform:uppercase">Dernier</div><div style="font-weight:700;color:${goodLast?'var(--green)':'var(--red)'}">${fmt(last)}</div></div>
      <div><div style="color:var(--muted);font-size:.62rem;text-transform:uppercase">Moyenne</div><div style="font-weight:700;color:${goodAvg?'var(--green)':'var(--yellow)'}">${fmt(avg)}</div></div>
      <div><div style="color:var(--muted);font-size:.62rem;text-transform:uppercase">${isBuy?'Min (bon)':'Max (bon)'}</div><div style="font-weight:700;color:var(--green)">${fmt(isBuy?min:max)}</div></div>
      <div><div style="color:var(--muted);font-size:.62rem;text-transform:uppercase">Tendance</div><div style="font-weight:700;color:${trendColor}">${trendIcon} ${fmt(lastVsAvg)}</div></div>
    </div>
  </div>`;
}

// ---- CHART HOVER HANDLERS ------------------------------------------
// Pointer moves across the sparkline SVG → compute nearest data point,
// position the crosshair + hover dot in SVG user-coords (0..W, 0..H),
// and position the HTML tooltip in pixel-coords relative to the chart
// wrap. The SVG uses preserveAspectRatio=none, so user-coords map
// proportionally to the rendered pixel box — we can rescale with
// getBoundingClientRect().
window.radarChartHover = function(evt, side) {
  const st = window._radarChartData && window._radarChartData[side];
  if (!st || !st.series.length) return;
  const svg = document.getElementById('radarChart-' + side);
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  // Support both mouse and touch events (touch has clientX directly on the Touch obj)
  const clientX = evt.clientX;
  const xPx = clientX - rect.left;
  // Map px → SVG user-coord on X axis
  const xUser = (xPx / rect.width) * st.W;
  // Binary search for nearest point by timestamp (xUser → ts back-projected)
  let targetTs;
  if (xUser <= st.PL)            targetTs = st.tMin;
  else if (xUser >= st.W - st.PR) targetTs = st.tMax;
  else targetTs = st.tMin + ((xUser - st.PL) / (st.W - st.PL - st.PR)) * st.tRange;

  // Find nearest index
  let lo = 0, hi = st.series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (st.series[mid].ts < targetTs) lo = mid + 1;
    else hi = mid;
  }
  // Check lo-1 too (closer to left)
  let idx = lo;
  if (lo > 0 && Math.abs(st.series[lo-1].ts - targetTs) < Math.abs(st.series[lo].ts - targetTs)) {
    idx = lo - 1;
  }
  const p = st.series[idx];

  // Project to SVG coords
  const cxU = st.PL + ((p.ts - st.tMin) / st.tRange) * (st.W - st.PL - st.PR);
  const normV = (p.v - st.vMin) / st.vRange;
  const cyU = st.isBuy
    ? st.PT + normV * (st.H - st.PT - st.PB)
    : st.PT + (1 - normV) * (st.H - st.PT - st.PB);

  // Update crosshair (SVG user-coords)
  const cross = document.getElementById('radarCrosshair-' + side);
  if (cross) {
    cross.style.display = '';
    const line = cross.querySelector('line');
    if (line) {
      line.setAttribute('x1', cxU.toFixed(1));
      line.setAttribute('x2', cxU.toFixed(1));
    }
  }
  // Update hover dot
  const dot = document.getElementById('radarHoverDot-' + side);
  if (dot) {
    dot.setAttribute('cx', cxU.toFixed(1));
    dot.setAttribute('cy', cyU.toFixed(1));
    dot.style.display = '';
  }

  // Update HTML tooltip — position in px relative to the chart wrap
  const tip = document.getElementById('radarChartTooltip-' + side);
  if (tip) {
    const scaleX = rect.width / st.W, scaleY = rect.height / st.H;
    const cxPx = cxU * scaleX;
    const cyPx = cyU * scaleY;
    // Place tooltip above the dot; flip below if too close to top.
    // Threshold is the tooltip's own height budget (~60px for 3 rows),
    // so we avoid clipping the title when the dot is near the chart top.
    const above = cyPx > 60;
    tip.style.left = cxPx + 'px';
    tip.style.top  = (above ? (cyPx - 8) : (cyPx + 18)) + 'px';
    tip.style.transform = above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';
    const d = new Date(p.ts);
    const dStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const spreadStr = `${p.v >= 0 ? '+' : ''}${p.v.toFixed(2)}%`;
    const good = st.isBuy ? p.v <= st.goodThreshold : p.v >= st.goodThreshold;
    const color = good ? 'var(--green)' : (st.isBuy ? (p.v > 0.7 ? 'var(--red)' : 'var(--yellow)') : (p.v < 1.0 ? 'var(--red)' : 'var(--yellow)'));
    const verdictEmoji = good ? '✅' : (st.isBuy ? (p.v > 0.7 ? '❌' : '⚠️') : (p.v < 1.0 ? '❌' : '⚠️'));
    const diffVsAvg = p.v - (st.series.reduce((s,x)=>s+x.v,0) / st.series.length);
    tip.querySelector('.tt-date').textContent = dStr;
    const valEl = tip.querySelector('.tt-val');
    valEl.textContent = `${verdictEmoji} ${spreadStr}`;
    valEl.style.color = color;
    tip.querySelector('.tt-extra').textContent = `${diffVsAvg >= 0 ? '+' : ''}${diffVsAvg.toFixed(2)}% vs moyenne`;
    tip.classList.add('show');
  }
};

window.radarChartHoverEnd = function(side) {
  const cross = document.getElementById('radarCrosshair-' + side);
  if (cross) cross.style.display = 'none';
  const dot = document.getElementById('radarHoverDot-' + side);
  if (dot) dot.style.display = 'none';
  const tip = document.getElementById('radarChartTooltip-' + side);
  if (tip) tip.classList.remove('show');
};

// ---- HISTORICAL CONTEXT -------------------------------------------
function radarHistoricalContext(buy, sell, fx, peg) {
  if (!DATA.fxP2P || !DATA.fxP2P.leg2 || !DATA.fxP2P.leg3) return '';
  const l2 = DATA.fxP2P.leg2.transactions || [];
  const l3 = DATA.fxP2P.leg3.transactions || [];
  if (!l2.length && !l3.length) return '';

  // Best historical buy = lowest price
  const bestBuy = l2.reduce((best, t) => (!best || t.prix < best.prix) ? t : best, null);
  const worstBuy = l2.reduce((w, t) => (!w || t.prix > w.prix) ? t : w, null);
  const avgBuy = l2.reduce((s, t) => s + t.prix, 0) / (l2.length || 1);

  // Best historical sell = highest premium (vs market of the day)
  const mktMap = (DATA.fxP2P.leg3.tauxMarche) || {};
  const l3withPct = l3.map(t => {
    const mkt = mktMap[t.date] || 0;
    const pct = mkt > 0 ? ((t.prix - mkt) / mkt) * 100 : 0;
    return { ...t, mkt, pct };
  });
  const bestSell = l3withPct.reduce((b, t) => (!b || t.pct > b.pct) ? t : b, null);
  const worstSell = l3withPct.reduce((w, t) => (!w || t.pct < w.pct) ? t : w, null);
  const avgSellPct = l3withPct.reduce((s, t) => s + t.pct, 0) / (l3withPct.length || 1);
  const avgSellPrice = l3.reduce((s, t) => s + t.prix, 0) / (l3.length || 1);

  // How does the current price compare to your historical distribution?
  let buyPositioning = '';
  if (buy && bestBuy && worstBuy) {
    const p = buy.medianPrice;
    if (p <= bestBuy.prix) buyPositioning = `<span style="color:var(--green)">🏆 Meilleur que ton record historique (${bestBuy.prix.toFixed(4).replace('.', ',')} le ${bestBuy.date}).</span>`;
    else if (p <= avgBuy) buyPositioning = `<span style="color:var(--green)">Meilleur que ta moyenne historique (${avgBuy.toFixed(4).replace('.', ',')}).</span>`;
    else if (p <= worstBuy.prix) buyPositioning = `<span style="color:var(--yellow)">Au-dessus de ta moyenne (${avgBuy.toFixed(4).replace('.', ',')}) mais en-dessous de ton pire achat (${worstBuy.prix.toFixed(4).replace('.', ',')}).</span>`;
    else buyPositioning = `<span style="color:var(--red)">⚠️ Pire que ton pire achat historique (${worstBuy.prix.toFixed(4).replace('.', ',')}).</span>`;
  }
  let sellPositioning = '';
  if (sell && fx && bestSell && worstSell) {
    const curPct = ((sell.medianPrice - fx.usdMad) / fx.usdMad) * 100;
    if (curPct >= bestSell.pct) sellPositioning = `<span style="color:var(--green)">🏆 Meilleur que ta meilleure vente historique (+${bestSell.pct.toFixed(2)}% le ${bestSell.date}).</span>`;
    else if (curPct >= avgSellPct) sellPositioning = `<span style="color:var(--green)">Meilleur que ton premium moyen (+${avgSellPct.toFixed(2)}%).</span>`;
    else if (curPct >= worstSell.pct) sellPositioning = `<span style="color:var(--yellow)">En-dessous de ta moyenne (+${avgSellPct.toFixed(2)}%) mais au-dessus de ta pire vente (+${worstSell.pct.toFixed(2)}%).</span>`;
    else sellPositioning = `<span style="color:var(--red)">⚠️ Pire que ta pire vente historique (+${worstSell.pct.toFixed(2)}%).</span>`;
  }

  return `
    <div class="s">
      <div class="st">Contexte historique</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div style="font-size:.78rem;font-weight:700;margin-bottom:8px">Achats AED → USDT (${l2.length} tx)</div>
          <div style="font-size:.78rem;line-height:1.7">
            <div>Meilleur : <strong>${bestBuy ? bestBuy.prix.toFixed(4).replace('.', ',') : '—'}</strong> ${bestBuy ? `<span style="color:var(--muted)">(${bestBuy.date})</span>` : ''}</div>
            <div>Moyenne : <strong>${avgBuy ? avgBuy.toFixed(4).replace('.', ',') : '—'}</strong></div>
            <div>Pire : <strong>${worstBuy ? worstBuy.prix.toFixed(4).replace('.', ',') : '—'}</strong> ${worstBuy ? `<span style="color:var(--muted)">(${worstBuy.date})</span>` : ''}</div>
          </div>
          ${buyPositioning ? `<div style="font-size:.76rem;margin-top:10px">${buyPositioning}</div>` : ''}
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div style="font-size:.78rem;font-weight:700;margin-bottom:8px">Ventes USDT → MAD (${l3.length} tx)</div>
          <div style="font-size:.78rem;line-height:1.7">
            <div>Meilleure : <strong>+${bestSell ? bestSell.pct.toFixed(2) : '—'}%</strong> ${bestSell ? `<span style="color:var(--muted)">(${bestSell.date}, prix ${bestSell.prix.toFixed(3).replace('.', ',')})</span>` : ''}</div>
            <div>Moyenne : <strong>+${avgSellPct ? avgSellPct.toFixed(2) : '—'}%</strong> <span style="color:var(--muted)">(prix ${avgSellPrice.toFixed(3).replace('.', ',')})</span></div>
            <div>Pire : <strong>+${worstSell ? worstSell.pct.toFixed(2) : '—'}%</strong> ${worstSell ? `<span style="color:var(--muted)">(${worstSell.date}, prix ${worstSell.prix.toFixed(3).replace('.', ',')})</span>` : ''}</div>
          </div>
          ${sellPositioning ? `<div style="font-size:.76rem;margin-top:10px">${sellPositioning}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ---- OFFERS TABLE --------------------------------------------------
function radarOffersTable(data, tradeType, refRate) {
  const minLabel = data.medianBasisLabel
    ? ` <span style="font-size:.65rem;font-weight:500;color:var(--muted);text-transform:none;letter-spacing:0">(${data.medianBasisLabel})</span>`
    : '';
  const title = tradeType === 'BUY'
    ? `🇦🇪 Top 10 offres Binance P2P — Achat AED → USDT${minLabel}`
    : `🇲🇦 Top 10 offres Binance P2P — Vente USDT → MAD${minLabel}`;
  const priceLabel = tradeType === 'BUY' ? 'Prix AED/USDT' : 'Prix MAD/USDT';
  const refLabel   = tradeType === 'BUY' ? 'Spread vs peg' : 'Spread vs marché';

  // Classifier chaque marchand en 3 niveaux (voir radarClassifyMerchant).
  const classifyFn = (name) => radarClassifyMerchant(tradeType, name);

  // Style par niveau
  const LEVEL = {
    confirmed: { icon: '⭐', label: 'Confirmé',  badgeCls: 'ok', badgeColor: 'var(--green)',  rowBg: 'rgba(34,197,94,.06)',  toggleOpacity: '1' },
    known:     { icon: '🔸', label: 'RIB validé', badgeCls: 'i',  badgeColor: 'var(--accent)', rowBg: 'rgba(59,130,246,.06)', toggleOpacity: '.85' },
    new:       { icon: '☆', label: 'Nouveau',   badgeCls: 'w',  badgeColor: 'var(--muted)',  rowBg: '',                     toggleOpacity: '.4' },
  };

  let rows = '';
  data.offers.forEach((o, i) => {
    const spread = ((o.price - refRate) / refRate) * 100;
    const isGood = tradeType === 'BUY' ? (spread <= 0.35) : (spread >= 3.0);
    const isBad  = tradeType === 'BUY' ? (spread >  0.70) : (spread <  1.0);
    const color  = isGood ? 'var(--green)' : isBad ? 'var(--red)' : 'var(--yellow)';
    const merchantName = o.merchant || '—';
    const level = classifyFn(merchantName);
    const lvl = LEVEL[level];
    const merchantType = o.userType === 'merchant' ? ' <span class="b i" style="font-size:.6rem">Merchant</span>' : '';
    // Base64 sidesteps HTML attribute escaping for nicknames with quotes.
    const safeArg = 'atob(\'' + btoa(unescape(encodeURIComponent(merchantName))) + '\')';
    const decodedCall = `radarToggleKnownMerchant('${tradeType}', decodeURIComponent(escape(${safeArg})))`;
    const toggleTitle = level === 'new'      ? 'Cliquer pour marquer comme RIB validé' :
                        level === 'known'    ? 'Cliquer pour marquer comme Confirmé (tx réussie)' :
                                               'Cliquer pour retirer (revient à Nouveau)';
    const toggleBtn = `<button type="button" onclick="${decodedCall}" title="${toggleTitle}" style="background:none;border:none;color:${lvl.badgeColor};cursor:pointer;padding:0 2px;font-size:.85rem;line-height:1;opacity:${lvl.toggleOpacity}">${lvl.icon}</button>`;
    const levelBadge = level === 'new'
      ? `<span class="b w" style="font-size:.6rem;margin-left:4px;opacity:.7" title="RIB à ajouter — 4h de validation avant de pouvoir trader">🆕 Nouveau</span>`
      : level === 'known'
        ? `<span class="b i" style="font-size:.6rem;margin-left:4px" title="Orders passés mais aucun Completed — RIB probablement déjà enregistré">🔸 RIB validé</span>`
        : `<span class="b ok" style="font-size:.6rem;margin-left:4px" title="Au moins une transaction Completed — fiable + RIB validé">⭐ Confirmé</span>`;
    const payShort = (o.payMethods || []).slice(0, 3).join(', ') + (o.payMethods.length > 3 ? ` +${o.payMethods.length - 3}` : '');
    const decimals = tradeType === 'BUY' ? 4 : 3;
    const rowStyle = lvl.rowBg ? ` style="background:${lvl.rowBg}"` : '';
    rows += `<tr${rowStyle}>
      <td>${i+1}</td>
      <td style="white-space:nowrap">${toggleBtn} <strong>${merchantName.substring(0, 24)}</strong>${merchantType}${levelBadge}</td>
      <td class="a" style="font-weight:700">${o.price.toFixed(decimals).replace('.', ',')}</td>
      <td class="a" style="color:${color}">${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%</td>
      <td class="a">${fmtPlain(Math.round(o.minSingleTransAmount))}–${fmtPlain(Math.round(o.maxSingleTransAmount))}</td>
      <td style="font-size:.7rem">${payShort || '—'}</td>
      <td class="a">${o.finishRate != null ? (o.finishRate * 100).toFixed(0) + '%' : '—'}${o.monthOrderCount != null ? ` <span style="color:var(--muted);font-size:.65rem">(${o.monthOrderCount})</span>` : ''}</td>
    </tr>`;
  });

  // Summary: how many confirmed / RIB-validated in this top 10
  const counts = { confirmed: 0, known: 0, new: 0 };
  data.offers.forEach(o => { counts[classifyFn(o.merchant || '')]++; });
  const parts = [];
  if (counts.confirmed > 0) parts.push(`<span style="color:var(--green)">${counts.confirmed} ⭐ confirmés</span>`);
  if (counts.known > 0)     parts.push(`<span style="color:var(--accent)">${counts.known} 🔸 RIB ok</span>`);
  if (parts.length === 0)   parts.push(`<span style="color:var(--muted)">0 connus</span>`);
  const knownSummary = ` <span style="font-size:.65rem;font-weight:500;text-transform:none;letter-spacing:0">· ${parts.join(' · ')}</span>`;

  const helperNote = `<div style="font-size:.7rem;color:var(--muted);margin-top:6px;margin-bottom:8px;line-height:1.5">
    <strong>⭐ Confirmé</strong> = au moins une tx <em>Completed</em> dans ton historique Binance (le + fiable, RIB validé).
    <strong>🔸 RIB validé</strong> = order passé (peut-être cancellé) — RIB probablement déjà ajouté à la banque.
    <strong>🆕 Nouveau</strong> = jamais interagi, nécessite ajout RIB + ~4h de validation.
    Clique sur l'icône à gauche d'un marchand pour le cycler (nouveau → RIB → confirmé → nouveau).
  </div>`;

  return `<div class="s"><div class="st">${title}${knownSummary}</div>${helperNote}<table class="radar-offers">
    <thead><tr>
      <th>#</th>
      <th>Marchand</th>
      <th style="text-align:right">${priceLabel}</th>
      <th style="text-align:right">${refLabel}</th>
      <th style="text-align:right">Min–Max ${data.fiat}</th>
      <th>Paiement</th>
      <th style="text-align:right">Taux (30j) / ordres</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ---- OFFLINE FALLBACK ---------------------------------------------
function radarRenderOffline(err, fx) {
  const peg = (DATA.fxP2P && DATA.fxP2P.leg2 && DATA.fxP2P.leg2.tauxMarche) || 3.6725;

  // Historical averages as fallback.
  const l2 = (DATA.fxP2P && DATA.fxP2P.leg2 && DATA.fxP2P.leg2.transactions) || [];
  const l3 = (DATA.fxP2P && DATA.fxP2P.leg3 && DATA.fxP2P.leg3.transactions) || [];
  const avgBuy  = l2.length ? l2.reduce((s,t) => s+t.prix, 0) / l2.length : null;
  const avgSell = l3.length ? l3.reduce((s,t) => s+t.prix, 0) / l3.length : null;

  const body = document.getElementById('radarBody');
  if (!body) return;
  body.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--red);border-radius:10px;padding:16px 20px;margin-bottom:16px">
      <div style="font-size:.88rem;font-weight:700;color:var(--red)">✗ Binance P2P inatteignable</div>
      <div style="font-size:.78rem;color:var(--muted);margin-top:6px">
        L'API publique Binance P2P n'a pas répondu (CORS, rate limit, ou panne temporaire). Le navigateur bloque peut-être la requête cross-origin.
        ${err ? `<br><code style="font-size:.7rem;opacity:.7">${(err.message || String(err)).substring(0, 140)}</code>` : ''}
        <br>Clique sur <strong>Rafraîchir</strong> dans quelques secondes — le service se rétablit généralement vite.
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase">🇦🇪 Achat AED → USDT — moyenne historique</div>
        <div style="font-size:1.4rem;font-weight:700;margin-top:6px">${avgBuy ? avgBuy.toFixed(4).replace('.', ',') : '—'}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:4px">peg ${peg.toFixed(4).replace('.', ',')} · cible ≤ ${(peg * 1.0035).toFixed(4).replace('.', ',')}</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase">🇲🇦 Vente USDT → MAD — moyenne historique</div>
        <div style="font-size:1.4rem;font-weight:700;margin-top:6px">${avgSell ? avgSell.toFixed(3).replace('.', ',') : '—'}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:4px">${fx ? `USD/MAD live ${fx.usdMad.toFixed(4).replace('.', ',')}` : 'USD/MAD live indisponible'}</div>
      </div>
    </div>
  `;
}
