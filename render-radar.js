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

    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:18px">
      <button id="radarRefreshBtn" onclick="window.radarLoad(true)" style="appearance:none;background:var(--accent);color:#fff;border:none;border-radius:6px;padding:8px 16px;font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit">🔄 Rafraîchir</button>
      <div style="font-size:.72rem;color:var(--muted)">
        Dernière mise à jour : <span id="radarLastUpdate" style="color:var(--text);font-weight:600">—</span>
        <span id="radarAutoInfo" style="margin-left:8px">· auto toutes les 60s</span>
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

  return skeleton;
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
      radarFetchBinanceP2P('AED', 'BUY',  RADAR_MIN_AMOUNT.AED),
      radarFetchBinanceP2P('MAD', 'SELL', RADAR_MIN_AMOUNT.MAD),
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
async function radarFetchBinanceP2P(fiat, tradeType, transAmount) {
  // transAmount = volume minimum souhaité dans la fiat. Filtre les offres
  // "parasites" à très faible montant qui affichent un meilleur prix mais
  // ne permettent pas de trader des sommes utiles. Binance applique le
  // filtre côté serveur et ne renvoie que les offres qui acceptent ce
  // volume — donc topPrice / medianPrice reflètent un prix réellement
  // exécutable.
  const body = {
    proMerchantAds: false,
    page: 1,
    rows: 20,
    payTypes: [],
    countries: [],
    publisherType: null,
    fiat: fiat,
    tradeType: tradeType,
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

  // Belt-and-suspenders: even when we pass transAmount to Binance, the
  // API still returns offers whose displayed max < transAmount (probably
  // counts the offer as "available at any volume the merchant accepts"
  // rather than "covers transAmount"). Reject any offer that can't
  // actually accommodate our threshold — these are the "parasitic" tiny
  // offers (e.g., max 101 AED) that show artificially great prices but
  // are useless for real volume. This filter is what makes medianPrice
  // / topPrice reflect a price you can really execute at.
  if (transAmount) {
    offers = offers.filter(o =>
      isFinite(o.maxSingleTransAmount) && o.maxSingleTransAmount >= transAmount &&
      (!isFinite(o.minSingleTransAmount) || o.minSingleTransAmount <= transAmount)
    );
    if (!offers.length) throw new Error(`Binance P2P ${fiat} ${tradeType}: no offers ≥ ${transAmount}`);
  }

  offers.sort((a, b) => tradeType === 'BUY' ? a.price - b.price : b.price - a.price);

  const prices = offers.map(o => o.price);
  const topPrice = prices[0];
  // Median of top 10 — avoids outlier noise from stale ads.
  const top10 = prices.slice(0, 10);
  const sorted = [...top10].sort((a,b) => a-b);
  const mid = Math.floor(sorted.length/2);
  const medianPrice = sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
  const avgPrice = top10.reduce((s,x) => s+x, 0) / top10.length;

  return { fiat, tradeType, transAmount, topPrice, medianPrice, avgPrice, offers: offers.slice(0, 10) };
}

// Volume minimum considéré pour l'évaluation P2P — au-dessous, ce sont
// souvent des offres parasites avec un prix attractif mais inactionnables.
const RADAR_MIN_AMOUNT = { AED: 10000, MAD: 20000 };

// ---- USD/MAD LIVE -------------------------------------------------
async function radarFetchUsdMad() {
  const urls = [
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

  const binanceLine = s.buyData
    ? `<span style="color:var(--muted)">Marché Binance <span style="font-size:.65rem;opacity:.7">(offres ≥ ${RADAR_MIN_AMOUNT.AED.toLocaleString('fr-FR')} AED)</span> : </span><button type="button" onclick="radarUpdateBuy(${s.buyData.medianPrice})" style="background:none;border:none;color:var(--accent);cursor:pointer;padding:0;font-weight:700;font-variant-numeric:tabular-nums;font-family:inherit;text-decoration:underline dotted" title="Cliquer pour synchroniser">${s.buyData.medianPrice.toFixed(4).replace('.', ',')}</button> <span style="color:var(--muted)">· meilleure ${s.buyData.topPrice.toFixed(4).replace('.', ',')}</span> ${radarLiveBadge('buy', s.lastLoadAt)}`
    : `<span style="color:var(--yellow)">⚠ Binance indisponible — saisis le prix observé</span>`;

  const priceStr = price.toFixed(4).replace('.', ',');

  return `
    <div style="background:var(--surface);border:2px solid ${v.color};border-radius:12px;padding:18px 20px;transition:border-color .25s">
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

  const binanceLine = s.sellData
    ? `<span style="color:var(--muted)">Marché Binance <span style="font-size:.65rem;opacity:.7">(offres ≥ ${RADAR_MIN_AMOUNT.MAD.toLocaleString('fr-FR')} MAD)</span> : </span><button type="button" onclick="radarUpdateSell(${s.sellData.medianPrice})" style="background:none;border:none;color:var(--accent);cursor:pointer;padding:0;font-weight:700;font-variant-numeric:tabular-nums;font-family:inherit;text-decoration:underline dotted" title="Cliquer pour synchroniser">${s.sellData.medianPrice.toFixed(3).replace('.', ',')}</button> <span style="color:var(--muted)">· meilleure ${s.sellData.topPrice.toFixed(3).replace('.', ',')}</span> ${radarLiveBadge('sell', s.lastLoadAt)}`
    : `<span style="color:var(--yellow)">⚠ Binance indisponible — saisis le prix observé</span>`;

  const fxStatus = s.usdMadIsLive
    ? `<span style="color:var(--green);font-size:.65rem">● live${s.usdMadDate ? ` ${s.usdMadDate}` : ''}</span>`
    : `<span style="color:var(--yellow);font-size:.65rem">● manuel</span>`;

  const priceStr = price.toFixed(3).replace('.', ',');
  const usdMadStr = usdMad.toFixed(4).replace('.', ',');

  return `
    <div style="background:var(--surface);border:2px solid ${v.color};border-radius:12px;padding:18px 20px;transition:border-color .25s">
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

  // Sparkline SVG
  const W = 320, H = 80, PAD = 6;
  const tMin = series[0].ts, tMax = series[series.length-1].ts || (tMin + 1);
  const tRange = Math.max(1, tMax - tMin);
  // Pour buy: low values en haut (vert) → on inverse Y. Pour sell: high values en haut (vert) → standard.
  const vMin = Math.min(min, isBuy ? 0 : 0);
  const vMax = Math.max(max, isBuy ? goodThreshold * 1.5 : goodThreshold * 1.5);
  const vRange = Math.max(0.0001, vMax - vMin);
  const xOf = ts => PAD + ((ts - tMin) / tRange) * (W - 2*PAD);
  // Pour buy: bas spread = bonne valeur → on veut HAUT du graph → invert
  // Pour sell: haut spread = bonne valeur → standard
  const yOf = v => {
    const norm = (v - vMin) / vRange; // 0 = vMin (bas), 1 = vMax (haut)
    return isBuy
      ? PAD + norm * (H - 2*PAD)              // buy: bon = haut
      : PAD + (1 - norm) * (H - 2*PAD);       // sell: bon = haut
  };

  // Polyline points
  const pts = series.map(p => `${xOf(p.ts).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(' ');
  // Threshold line (zone "bon")
  const yThresh = yOf(goodThreshold);

  // Last point marker
  const lastP = series[series.length - 1];
  const lx = xOf(lastP.ts), ly = yOf(lastP.v);

  const lineColor = goodLast ? '#16a34a' : (isBuy ? (last > 0.7 ? '#dc2626' : '#eab308') : (last < 1.0 ? '#dc2626' : '#eab308'));
  const fillColor = lineColor + '22'; // alpha pour la zone sous la courbe

  // Polyline avec fill (zone) — pour le fill on ajoute des points en bas
  const fillPts = pts + ` ${xOf(tMax).toFixed(1)},${(H-PAD).toFixed(1)} ${PAD.toFixed(1)},${(H-PAD).toFixed(1)}`;

  const svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="display:block;border-radius:6px;background:var(--surface2)">
    <!-- Threshold line -->
    <line x1="${PAD}" y1="${yThresh.toFixed(1)}" x2="${W-PAD}" y2="${yThresh.toFixed(1)}" stroke="rgba(34,197,94,.4)" stroke-width="1" stroke-dasharray="3 3" />
    <text x="${W-PAD}" y="${(yThresh-3).toFixed(1)}" text-anchor="end" fill="rgba(34,197,94,.7)" font-size="9" font-family="sans-serif">≥ ${goodThreshold}% bon</text>
    <!-- Filled area -->
    <polygon points="${fillPts}" fill="${fillColor}" />
    <!-- Line -->
    <polyline points="${pts}" fill="none" stroke="${lineColor}" stroke-width="1.5" />
    <!-- Last point -->
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3" fill="${lineColor}" stroke="#fff" stroke-width="1.5" />
  </svg>`;

  // Stats grid
  const fmt = v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  const trendIcon = lastVsAvg === 0 ? '→' : (lastVsAvg > 0 ? '↑' : '↓');
  const trendColor = (isBuy ? lastVsAvg < 0 : lastVsAvg > 0) ? 'var(--green)' : 'var(--red)';

  return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">
      <div style="font-size:.78rem;font-weight:700">${title}</div>
      <div style="font-size:.6rem;color:var(--muted)">${directionTag}</div>
    </div>
    ${svg}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;font-size:.7rem">
      <div><div style="color:var(--muted);font-size:.62rem;text-transform:uppercase">Dernier</div><div style="font-weight:700;color:${goodLast?'var(--green)':'var(--red)'}">${fmt(last)}</div></div>
      <div><div style="color:var(--muted);font-size:.62rem;text-transform:uppercase">Moyenne</div><div style="font-weight:700;color:${goodAvg?'var(--green)':'var(--yellow)'}">${fmt(avg)}</div></div>
      <div><div style="color:var(--muted);font-size:.62rem;text-transform:uppercase">${isBuy?'Min (bon)':'Max (bon)'}</div><div style="font-weight:700;color:var(--green)">${fmt(isBuy?min:max)}</div></div>
      <div><div style="color:var(--muted);font-size:.62rem;text-transform:uppercase">Tendance</div><div style="font-weight:700;color:${trendColor}">${trendIcon} ${fmt(lastVsAvg)}</div></div>
    </div>
  </div>`;
}

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
  const minLabel = data.transAmount
    ? ` <span style="font-size:.65rem;font-weight:500;color:var(--muted);text-transform:none;letter-spacing:0">(filtré ≥ ${data.transAmount.toLocaleString('fr-FR')} ${data.fiat})</span>`
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

  return `<div class="s"><div class="st">${title}${knownSummary}</div>${helperNote}<table>
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
