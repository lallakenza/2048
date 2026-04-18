// ============================================================
// game-2048.js — Classic 2048 game module (cover/decoy)
// ============================================================
// Self-contained 2048 implementation used as a cover screen
// for the facturation portal. When a wrong "name" is entered
// in the auth gate, this game is unlocked so the page looks
// like a real game site. The real reconciliation UI is only
// reached by submitting one of the AES passwords (BRIDGEVALE
// / COUPA / BINGA).
//
// Difficulty:
//   - 4×4 grid, target 2048
//   - 5×5 grid, target 4096
//   - 6×6 grid, target 8192
//
// API (window.Game2048):
//   start({mountEl, gridSize, target, playerName, onRestart})
//     → builds DOM, attaches handlers, starts a new game
//   stop()
//     → detaches handlers, clears mount node
//
// All DOM created lives inside `mountEl`; styles live in
// index.html (selectors prefixed with .g- to avoid clashes).
// ============================================================

(function () {
  'use strict';

  // ---- module state ---------------------------------------
  var state = null;            // current game instance state
  var keyHandler = null;       // bound document keydown handler
  var touchHandlers = null;    // bound touchstart/touchend handlers
  var mountEl = null;          // root container provided by caller

  // ---- helpers --------------------------------------------
  function makeGrid(n) {
    var g = new Array(n);
    for (var i = 0; i < n; i++) {
      g[i] = new Array(n);
      for (var j = 0; j < n; j++) g[i][j] = 0;
    }
    return g;
  }

  function clone(g) {
    return g.map(function (row) { return row.slice(); });
  }

  function emptyCells(g) {
    var out = [];
    for (var i = 0; i < g.length; i++)
      for (var j = 0; j < g.length; j++)
        if (g[i][j] === 0) out.push([i, j]);
    return out;
  }

  function spawnTile(g) {
    var empties = emptyCells(g);
    if (empties.length === 0) return false;
    var pick = empties[Math.floor(Math.random() * empties.length)];
    g[pick[0]][pick[1]] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }

  // Slide a single row to the LEFT, merging adjacent equals once.
  // Returns { row: newRow, gained: scoreGain, moved: bool }
  function slideRowLeft(row) {
    var n = row.length;
    var compact = row.filter(function (v) { return v !== 0; });
    var merged = [];
    var gained = 0;
    var i = 0;
    while (i < compact.length) {
      if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
        var v = compact[i] * 2;
        merged.push(v);
        gained += v;
        i += 2;
      } else {
        merged.push(compact[i]);
        i += 1;
      }
    }
    while (merged.length < n) merged.push(0);
    var moved = false;
    for (var k = 0; k < n; k++) if (merged[k] !== row[k]) { moved = true; break; }
    return { row: merged, gained: gained, moved: moved };
  }

  // Move the whole grid in a direction by transposing/reversing
  // around the canonical "left slide" primitive.
  // dir ∈ {'left','right','up','down'}
  function move(g, dir) {
    var n = g.length;
    var totalGain = 0;
    var anyMoved = false;

    function transpose(m) {
      var t = makeGrid(n);
      for (var i = 0; i < n; i++)
        for (var j = 0; j < n; j++) t[j][i] = m[i][j];
      return t;
    }
    function reverseRows(m) {
      return m.map(function (r) { return r.slice().reverse(); });
    }

    var work = clone(g);
    if (dir === 'right') work = reverseRows(work);
    else if (dir === 'up') work = transpose(work);
    else if (dir === 'down') work = reverseRows(transpose(work));

    for (var i = 0; i < n; i++) {
      var res = slideRowLeft(work[i]);
      work[i] = res.row;
      totalGain += res.gained;
      if (res.moved) anyMoved = true;
    }

    if (dir === 'right') work = reverseRows(work);
    else if (dir === 'up') work = transpose(work);
    else if (dir === 'down') work = transpose(reverseRows(work));

    return { grid: work, gained: totalGain, moved: anyMoved };
  }

  function maxTile(g) {
    var m = 0;
    for (var i = 0; i < g.length; i++)
      for (var j = 0; j < g.length; j++)
        if (g[i][j] > m) m = g[i][j];
    return m;
  }

  function canMove(g) {
    if (emptyCells(g).length > 0) return true;
    var n = g.length;
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        var v = g[i][j];
        if (i + 1 < n && g[i + 1][j] === v) return true;
        if (j + 1 < n && g[i][j + 1] === v) return true;
      }
    }
    return false;
  }

  // ---- DOM ------------------------------------------------
  function buildDOM(n) {
    // Build a static n×n grid of empty backing cells, then a
    // separate tile layer that we redraw on each render.
    var html = '';
    html += '<div class="g-grid" data-size="' + n + '">';
    for (var i = 0; i < n * n; i++) {
      html += '<div class="g-cell"></div>';
    }
    html += '</div>';
    html += '<div class="g-tiles" data-size="' + n + '"></div>';
    return html;
  }

  function renderTiles(g, scoreEl, score, bestEl, best) {
    var n = g.length;
    var tilesLayer = mountEl.querySelector('.g-tiles');
    if (!tilesLayer) return;
    var html = '';
    for (var i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        var v = g[i][j];
        if (v === 0) continue;
        // value class clamped to 8192 for color palette; bigger
        // values reuse the highest tier so the page never breaks
        // on continued play past the target.
        var tier = Math.min(v, 8192);
        // Long values get a smaller font (1024+ is 4 digits)
        var size = v >= 1024 ? ' g-small' : (v >= 128 ? ' g-med' : '');
        html += '<div class="g-tile g-v' + tier + size + '"'
              + ' style="--gx:' + j + ';--gy:' + i + '">'
              + v + '</div>';
      }
    }
    tilesLayer.innerHTML = html;
    if (scoreEl) scoreEl.textContent = score;
    if (bestEl) bestEl.textContent = best;
  }

  // ---- best score (per-grid-size, localStorage) -----------
  function bestKey(n) { return 'g2048_best_' + n; }
  function readBest(n) {
    try {
      var raw = localStorage.getItem(bestKey(n));
      var v = raw ? parseInt(raw, 10) : 0;
      return isNaN(v) ? 0 : v;
    } catch (e) { return 0; }
  }
  function writeBest(n, v) {
    try { localStorage.setItem(bestKey(n), String(v)); } catch (e) {}
  }

  // ---- input ---------------------------------------------
  var KEY_MAP = {
    'ArrowLeft': 'left', 'ArrowRight': 'right',
    'ArrowUp': 'up', 'ArrowDown': 'down',
    'a': 'left', 'A': 'left', 'd': 'right', 'D': 'right',
    'w': 'up', 'W': 'up', 's': 'down', 'S': 'down',
    'h': 'left', 'l': 'right', 'k': 'up', 'j': 'down'
  };

  function attachInput() {
    keyHandler = function (e) {
      if (!state || state.over) return;
      var dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      doMove(dir);
    };
    document.addEventListener('keydown', keyHandler);

    var touchStart = null;
    function onStart(e) {
      if (!e.touches || e.touches.length === 0) return;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    function onEnd(e) {
      if (!touchStart || !e.changedTouches || e.changedTouches.length === 0) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - touchStart.x;
      var dy = t.clientY - touchStart.y;
      touchStart = null;
      var ax = Math.abs(dx), ay = Math.abs(dy);
      if (Math.max(ax, ay) < 24) return;  // dead zone
      var dir = ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      doMove(dir);
    }
    var grid = mountEl.querySelector('.g-grid');
    if (grid) {
      grid.addEventListener('touchstart', onStart, { passive: true });
      grid.addEventListener('touchend', onEnd, { passive: true });
      touchHandlers = { el: grid, onStart: onStart, onEnd: onEnd };
    }
  }

  function detachInput() {
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    if (touchHandlers) {
      touchHandlers.el.removeEventListener('touchstart', touchHandlers.onStart);
      touchHandlers.el.removeEventListener('touchend', touchHandlers.onEnd);
      touchHandlers = null;
    }
  }

  // ---- game loop ------------------------------------------
  function doMove(dir) {
    var res = move(state.grid, dir);
    if (!res.moved) return;
    state.grid = res.grid;
    state.score += res.gained;
    if (state.score > state.best) {
      state.best = state.score;
      writeBest(state.size, state.best);
    }
    spawnTile(state.grid);
    render();
    // Win: tile reached target. We allow continued play, so
    // we only fire the message once per game.
    if (!state.wonShown && maxTile(state.grid) >= state.target) {
      state.wonShown = true;
      showMessage('Tu as atteint ' + state.target + ' ! Bravo.', /*win=*/true);
      return;
    }
    // Loss: no possible moves left.
    if (!canMove(state.grid)) {
      state.over = true;
      showMessage('Game over — score ' + state.score, /*win=*/false);
    }
  }

  function showMessage(text, isWin) {
    var msg = mountEl.querySelector('.g-message');
    var msgText = mountEl.querySelector('.g-message-text');
    if (!msg || !msgText) return;
    msgText.textContent = text;
    msg.className = 'g-message show ' + (isWin ? 'g-win' : 'g-lose');
  }

  function hideMessage() {
    var msg = mountEl.querySelector('.g-message');
    if (msg) msg.className = 'g-message';
  }

  function render() {
    var scoreEl = mountEl.querySelector('.g-score-val');
    var bestEl = mountEl.querySelector('.g-best-val');
    renderTiles(state.grid, scoreEl, state.score, bestEl, state.best);
  }

  // ---- public API -----------------------------------------
  function start(opts) {
    opts = opts || {};
    var size = opts.gridSize || 4;
    var target = opts.target || 2048;
    var name = opts.playerName || 'Joueur';
    var mount = opts.mountEl;
    if (!mount) {
      console.error('[Game2048] start: missing mountEl');
      return;
    }
    stop();  // idempotent if not running
    mountEl = mount;

    // Header (player + mode + score + restart) is owned by the
    // outer cover; we only own the grid + tiles + message overlay.
    mount.innerHTML = ''
      + '<div class="g-board g-size-' + size + '">'
      +   buildDOM(size)
      +   '<div class="g-message">'
      +     '<p class="g-message-text"></p>'
      +     '<div class="g-message-actions">'
      +       '<button class="g-btn g-btn-keep" type="button">Continuer</button>'
      +       '<button class="g-btn g-btn-new" type="button">Nouvelle partie</button>'
      +     '</div>'
      +   '</div>'
      + '</div>';

    // Wire message buttons
    mount.querySelector('.g-btn-keep').addEventListener('click', hideMessage);
    mount.querySelector('.g-btn-new').addEventListener('click', function () {
      hideMessage();
      newGame();
    });

    state = {
      size: size,
      target: target,
      name: name,
      grid: makeGrid(size),
      score: 0,
      best: readBest(size),
      over: false,
      wonShown: false
    };

    spawnTile(state.grid);
    spawnTile(state.grid);
    attachInput();
    render();
  }

  function newGame() {
    if (!state) return;
    state.grid = makeGrid(state.size);
    state.score = 0;
    state.over = false;
    state.wonShown = false;
    spawnTile(state.grid);
    spawnTile(state.grid);
    render();
  }

  function stop() {
    detachInput();
    if (mountEl) mountEl.innerHTML = '';
    state = null;
    mountEl = null;
  }

  window.Game2048 = {
    start: start,
    stop: stop,
    newGame: newGame
  };
})();
