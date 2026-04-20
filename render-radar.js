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
  // start the 60s auto-refresh. renderRadar() is called by
  // renderAll() which injects via innerHTML — scripts inside
  // innerHTML don't execute, so we hook via setTimeout outside
  // the returned string.
  setTimeout(function(){ radarLoad(false); }, 20);
  radarStartAutoRefresh();

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
      radarFetchBinanceP2P('AED', 'BUY'),
      radarFetchBinanceP2P('MAD', 'SELL'),
      radarFetchUsdMad(),
    ]);

    const buy  = buyRes.status  === 'fulfilled' ? buyRes.value  : null;
    const sell = sellRes.status === 'fulfilled' ? sellRes.value : null;
    const fx   = fxRes.status   === 'fulfilled' ? fxRes.value   : null;

    // If we got nothing at all from Binance, go offline mode.
    if (!buy && !sell) {
      const err = buyRes.reason || sellRes.reason;
      radarRenderOffline(err, fx);
    } else {
      radarRenderContent(buy, sell, fx);
    }

    window._radarState.lastLoadAt = Date.now();
    const lastEl = document.getElementById('radarLastUpdate');
    if (lastEl) lastEl.textContent = radarFmtTime(new Date());
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)">✓ À jour</span>';
  } catch (e) {
    console.error('[radar] load failed:', e);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">✗ Échec</span>';
    radarRenderOffline(e, null);
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

// ---- BINANCE P2P FETCH --------------------------------------------
// Returns { topPrice, medianPrice, avgPrice, offers: [{merchant, price, minSingleTransAmount, maxSingleTransAmount, payMethods, finishRate}] }
// or throws on network/CORS failure.
async function radarFetchBinanceP2P(fiat, tradeType) {
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
  const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Binance P2P ${fiat} ${tradeType}: HTTP ${res.status}`);
  const j = await res.json();
  const ads = (j.data || []).filter(a => a && a.adv && a.advertiser);
  if (!ads.length) throw new Error(`Binance P2P ${fiat} ${tradeType}: no ads`);

  const offers = ads.map(a => ({
    merchant: a.advertiser.nickName || '—',
    price: parseFloat(a.adv.price),
    minSingleTransAmount: parseFloat(a.adv.minSingleTransAmount),
    maxSingleTransAmount: parseFloat(a.adv.dynamicMaxSingleTransAmount || a.adv.maxSingleTransAmount),
    payMethods: (a.adv.tradeMethods || []).map(m => m.tradeMethodName || m.identifier).filter(Boolean),
    finishRate: a.advertiser.monthFinishRate != null ? parseFloat(a.advertiser.monthFinishRate) : null,
    monthOrderCount: a.advertiser.monthOrderCount != null ? parseInt(a.advertiser.monthOrderCount, 10) : null,
    userType: a.advertiser.userType || '',
  })).filter(o => isFinite(o.price) && o.price > 0);

  offers.sort((a, b) => tradeType === 'BUY' ? a.price - b.price : b.price - a.price);

  const prices = offers.map(o => o.price);
  const topPrice = prices[0];
  // Median of top 10 — avoids outlier noise from stale ads.
  const top10 = prices.slice(0, 10);
  const sorted = [...top10].sort((a,b) => a-b);
  const mid = Math.floor(sorted.length/2);
  const medianPrice = sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
  const avgPrice = top10.reduce((s,x) => s+x, 0) / top10.length;

  return { fiat, tradeType, topPrice, medianPrice, avgPrice, offers: offers.slice(0, 10) };
}

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
function radarRenderContent(buy, sell, fx) {
  const peg = (DATA.fxP2P && DATA.fxP2P.leg2 && DATA.fxP2P.leg2.tauxMarche) || 3.6725;

  // --- BUY side (AED → USDT) ---------------------------------
  let buyCard = '';
  if (buy) {
    const buyPrice = buy.medianPrice;
    const buySpread = ((buyPrice - peg) / peg) * 100;
    const buyV = radarBuyVerdict(buySpread);
    const buyGauge = radarGaugeHTML('buy', buySpread, { price: buyPrice, refRate: peg });
    buyCard = `
      <div style="background:var(--surface);border:2px solid ${buyV.color};border-radius:12px;padding:18px 20px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
          <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">🇦🇪 Achat AED → USDT · Dubai</div>
          <div style="font-size:.78rem;font-weight:700;color:${buyV.color}">${buyV.em} ${buyV.label}</div>
        </div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
          <div style="font-size:1.9rem;font-weight:800;font-variant-numeric:tabular-nums;color:${buyV.color}">${buyPrice.toFixed(4).replace('.', ',')}</div>
          <div style="font-size:.78rem;color:var(--muted)">AED/USDT · médiane top 10</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;font-size:.78rem">
          <div><span style="color:var(--muted)">Peg AED/USD</span><br><strong>${peg.toFixed(4).replace('.', ',')}</strong></div>
          <div><span style="color:var(--muted)">Meilleure offre</span><br><strong>${buy.topPrice.toFixed(4).replace('.', ',')}</strong></div>
        </div>
        ${buyGauge}
        <div style="font-size:.75rem;color:var(--muted);line-height:1.5">${radarBuyAdvice(buyV.label, buySpread)}</div>
      </div>
    `;
  } else {
    buyCard = radarCardOffline('🇦🇪 Achat AED → USDT', 'Binance P2P AED indisponible');
  }

  // --- SELL side (USDT → MAD) --------------------------------
  let sellCard = '';
  if (sell && fx) {
    const sellPrice = sell.medianPrice;
    const usdMad = fx.usdMad;
    const sellSpread = ((sellPrice - usdMad) / usdMad) * 100;
    const sellV = radarSellVerdict(sellSpread);
    const sellGauge = radarGaugeHTML('sell', sellSpread, { price: sellPrice, refRate: usdMad });
    sellCard = `
      <div style="background:var(--surface);border:2px solid ${sellV.color};border-radius:12px;padding:18px 20px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
          <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em">🇲🇦 Vente USDT → MAD · Maroc</div>
          <div style="font-size:.78rem;font-weight:700;color:${sellV.color}">${sellV.em} ${sellV.label}</div>
        </div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
          <div style="font-size:1.9rem;font-weight:800;font-variant-numeric:tabular-nums;color:${sellV.color}">${sellPrice.toFixed(3).replace('.', ',')}</div>
          <div style="font-size:.78rem;color:var(--muted)">MAD/USDT · médiane top 10</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;font-size:.78rem">
          <div><span style="color:var(--muted)">USD/MAD live</span><br><strong>${usdMad.toFixed(4).replace('.', ',')}</strong>${fx.date ? ` <span style="font-size:.65rem;color:var(--muted)">(${fx.date})</span>` : ''}</div>
          <div><span style="color:var(--muted)">Meilleure offre</span><br><strong>${sell.topPrice.toFixed(3).replace('.', ',')}</strong></div>
        </div>
        ${sellGauge}
        <div style="font-size:.75rem;color:var(--muted);line-height:1.5">${radarSellAdvice(sellV.label, sellSpread)}</div>
      </div>
    `;
  } else if (sell && !fx) {
    sellCard = `
      <div style="background:var(--surface);border:2px solid var(--yellow);border-radius:12px;padding:18px 20px">
        <div style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🇲🇦 Vente USDT → MAD · Maroc</div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
          <div style="font-size:1.9rem;font-weight:800;font-variant-numeric:tabular-nums">${sell.medianPrice.toFixed(3).replace('.', ',')}</div>
          <div style="font-size:.78rem;color:var(--muted)">MAD/USDT · médiane top 10</div>
        </div>
        <div style="margin-top:12px;padding:10px 12px;background:var(--yellow-bg);border-radius:8px;font-size:.78rem;color:var(--muted)">
          ⚠️ Flux USD/MAD live indisponible — pas de verdict automatique. Réessaie dans quelques secondes.
        </div>
      </div>
    `;
  } else {
    sellCard = radarCardOffline('🇲🇦 Vente USDT → MAD', 'Binance P2P MAD indisponible');
  }

  // --- Historical context -----------------------------------
  const histHtml = radarHistoricalContext(buy, sell, fx, peg);

  // --- Top offers tables ------------------------------------
  const buyTable  = buy  ? radarOffersTable(buy,  'BUY',  peg)      : '';
  const sellTable = (sell && fx) ? radarOffersTable(sell, 'SELL', fx.usdMad) : '';

  const body = document.getElementById('radarBody');
  if (!body) return;
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px;margin-bottom:22px">
      ${buyCard}
      ${sellCard}
    </div>
    ${histHtml}
    ${buyTable}
    ${sellTable}
  `;
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
  const title = tradeType === 'BUY' ? `🇦🇪 Top 10 offres Binance P2P — Achat AED → USDT` : `🇲🇦 Top 10 offres Binance P2P — Vente USDT → MAD`;
  const priceLabel = tradeType === 'BUY' ? 'Prix AED/USDT' : 'Prix MAD/USDT';
  const refLabel   = tradeType === 'BUY' ? 'Spread vs peg' : 'Spread vs marché';

  let rows = '';
  data.offers.forEach((o, i) => {
    const spread = ((o.price - refRate) / refRate) * 100;
    const isGood = tradeType === 'BUY' ? (spread <= 0.35) : (spread >= 3.0);
    const isBad  = tradeType === 'BUY' ? (spread >  0.70) : (spread <  1.0);
    const color  = isGood ? 'var(--green)' : isBad ? 'var(--red)' : 'var(--yellow)';
    const merchantType = o.userType === 'merchant' ? ' <span class="b i" style="font-size:.6rem">Merchant</span>' : '';
    const payShort = (o.payMethods || []).slice(0, 3).join(', ') + (o.payMethods.length > 3 ? ` +${o.payMethods.length - 3}` : '');
    const decimals = tradeType === 'BUY' ? 4 : 3;
    rows += `<tr>
      <td>${i+1}</td>
      <td>${(o.merchant || '—').substring(0, 24)}${merchantType}</td>
      <td class="a" style="font-weight:700">${o.price.toFixed(decimals).replace('.', ',')}</td>
      <td class="a" style="color:${color}">${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%</td>
      <td class="a">${fmtPlain(Math.round(o.minSingleTransAmount))}–${fmtPlain(Math.round(o.maxSingleTransAmount))}</td>
      <td style="font-size:.7rem">${payShort || '—'}</td>
      <td class="a">${o.finishRate != null ? (o.finishRate * 100).toFixed(0) + '%' : '—'}${o.monthOrderCount != null ? ` <span style="color:var(--muted);font-size:.65rem">(${o.monthOrderCount})</span>` : ''}</td>
    </tr>`;
  });

  return `<div class="s"><div class="st">${title}</div><table>
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
