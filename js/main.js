(() => {
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const PRY = window.PRY;
  const state = PRY.state;

  // ====================================================================
  // INPUT — keyboard + on-screen pointer
  // ====================================================================

  // WASD aliases for arrows; space for A; X for B. Shift not aliased (modifier edge cases).
  const KEY_ALIASES = {
    'w': 'ArrowUp', 'W': 'ArrowUp',
    'a': 'ArrowLeft', 'A': 'ArrowLeft',
    's': 'ArrowDown', 'S': 'ArrowDown',
    'd': 'ArrowRight', 'D': 'ArrowRight',
    ' ': 'z', 'Z': 'z',
    'X': 'x',
  };
  const canonical = (k) => KEY_ALIASES[k] || k;

  const buttons = Array.from(document.querySelectorAll('.btn'));
  const btnByKey = new Map();
  buttons.forEach(b => btnByKey.set(b.dataset.key, b));

  function setActive(key, on) {
    const btn = btnByKey.get(canonical(key));
    if (btn) btn.classList.toggle('active', on);
  }

  const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);
  window.addEventListener('keydown', (e) => {
    setActive(e.key, true);
    if (PREVENT.has(e.key)) e.preventDefault();
    if (!e.repeat) handleInput(canonical(e.key), e.key);
  });
  window.addEventListener('keyup', (e) => setActive(e.key, false));

  buttons.forEach(b => {
    const k = b.dataset.key;
    const press = (e) => { e.preventDefault(); b.classList.add('active'); handleInput(k, k); };
    const release = (e) => { e.preventDefault(); b.classList.remove('active'); };
    b.addEventListener('pointerdown',   press);
    b.addEventListener('pointerup',     release);
    b.addEventListener('pointerleave',  release);
    b.addEventListener('pointercancel', release);
  });

  // Tap the canvas itself = "any key" too — helpful on touch in attract/reward.
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); handleInput('Enter', 'Enter'); });

  // ====================================================================
  // META-LOOP — mode transitions + economy
  // ====================================================================

  function startRun(levelId) {
    const lvl = PRY.LEVELS[levelId];
    if (!lvl) return;

    // Pay to play (replays cost). First play of a level is free.
    const isFirstPlay = !state.player.ownedUpgrades['played_' + levelId];
    const cost = isFirstPlay ? lvl.playCost : lvl.replayCost;
    if (state.player.cash < cost) {
      // Can't afford — stay where you are. (UI will show this in store.)
      return;
    }
    state.player.cash -= cost;
    state.player.ownedUpgrades['played_' + levelId] = true;

    state.mode = 'explore';
    state.level = lvl;
    state.player.hp = state.player.maxHp;
    state.player.x = lvl.playerStart.x;
    state.player.y = lvl.playerStart.y;
    state.run = {
      levelId,
      startedAt: performance.now(),
      timeElapsed: 0,
      itemsCollected: 0,
      cashCollected: 0,
    };
  }

  function finishRun(outcome) {
    const r = state.run;
    if (!r) return;
    const lvl = PRY.LEVELS[r.levelId];
    const timeSec = r.timeElapsed / 1000;

    const baseReward = outcome === 'win'
      ? Math.floor(lvl.baseReward * lvl.difficulty)
      : 0;
    const timeBonus = outcome === 'win'
      ? Math.max(0, Math.floor((lvl.parTime - timeSec) * lvl.timeBonusPer))
      : 0;
    const itemReward = r.itemsCollected * 5;
    const total = baseReward + timeBonus + r.cashCollected + itemReward;
    state.player.cash += total;

    state.lastRun = {
      ...r,
      outcome,
      timeSec,
      breakdown: { baseReward, timeBonus, itemReward, cashCollected: r.cashCollected, total },
    };
    state.run = null;
    state.mode = 'reward';
  }

  function buyStoreItem(id) {
    const item = PRY.STORE[id];
    if (!item) return;
    if (state.player.cash < item.cost) return;
    state.player.cash -= item.cost;
    item.apply(state.player);
  }

  // ====================================================================
  // INPUT DISPATCH — what each (mode, key) does
  // ====================================================================

  function handleInput(key /*, rawKey */) {
    switch (state.mode) {
      case 'attract': {
        // any key/button/tap starts a run
        startRun(1);
        return;
      }
      case 'explore': {
        // Placeholder until step 6 wires movement:
        //   A (z/space) = "finish run as win"  •  B (x) = "quit run"
        if (key === 'z') finishRun('win');
        else if (key === 'x') finishRun('quit');
        return;
      }
      case 'reward': {
        // any input → store
        state.mode = 'store';
        return;
      }
      case 'store': {
        // A / Enter = replay current level   •   B = back to attract
        // 'u' (also bound to ArrowUp via D-pad) = buy bank upgrade
        if (key === 'ArrowUp') buyStoreItem('bank_upgrade_1');
        else if (key === 'z' || key === 'Enter') startRun(state.lastRun?.levelId ?? 1);
        else if (key === 'x') state.mode = 'attract';
        return;
      }
    }
  }

  // ====================================================================
  // TICK + RENDER
  // ====================================================================

  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.floor(rect.width  * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  function tick(dt, now) {
    if (state.mode === 'explore' && state.run) {
      state.run.timeElapsed = now - state.run.startedAt;
    }
    // Future modes wire here: battle turn timing, cutscene frames, etc.
  }

  // ---- per-mode draw ----

  function neonText(x, y, txt, fontSize, color, blur = 16) {
    ctx.font = `${Math.floor(fontSize)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0;
  }

  function rowText(label, value, y, w, h, color) {
    ctx.font = `${Math.floor(h * 0.028)}px 'Press Start 2P', monospace`;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(label, w * 0.18, y);
    ctx.textAlign = 'right';
    ctx.fillText(value, w * 0.82, y);
    ctx.shadowBlur = 0;
  }

  function drawScanlines(w, h) {
    ctx.strokeStyle = 'rgba(255, 43, 214, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  let t = 0;
  function drawAttract(w, h) {
    const cx = w / 2, cy = h * 0.42;
    ctx.font = `${Math.floor(h * 0.22)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const flicker = 0.85 + Math.sin(t * 0.08) * 0.08 + (Math.random() < 0.02 ? -0.3 : 0);
    ctx.shadowColor = '#ff2bd6';
    ctx.shadowBlur  = 28 * Math.max(0.2, flicker);
    ctx.fillStyle   = '#ff2bd6';
    ctx.fillText('PRY', cx, cy);
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText('PRY', cx, cy);

    if (Math.floor(t / 30) % 2 === 0) {
      neonText(cx, h * 0.78, 'PRESS ANY KEY', h * 0.035, '#00f0ff', 12);
    }
  }

  function drawExplore(w, h) {
    const time = (state.run?.timeElapsed || 0) / 1000;
    const lvl = state.level;
    neonText(w / 2, h * 0.18, 'EXPLORING', h * 0.06, '#00f0ff');
    neonText(w / 2, h * 0.32, `${lvl.name}`, h * 0.035, '#ff2bd6');
    neonText(w / 2, h * 0.46, `Time  ${time.toFixed(1)}s`, h * 0.05, '#ffd400');
    neonText(w / 2, h * 0.58, `Par   ${lvl.parTime}s`,    h * 0.030, '#666');
    neonText(w / 2, h * 0.72, 'A  =  finish run (win)',   h * 0.025, '#00f0ff');
    neonText(w / 2, h * 0.80, 'B  =  quit run (no $)',    h * 0.025, '#ff2bd6');
    neonText(w / 2, h * 0.92, '(real movement arrives in step 6)', h * 0.020, '#555');
  }

  function drawReward(w, h) {
    const r = state.lastRun;
    if (!r) return;
    const b = r.breakdown;
    const title = r.outcome === 'win' ? 'LEVEL CLEAR' : 'RUN ENDED';
    const titleColor = r.outcome === 'win' ? '#ff2bd6' : '#555';
    neonText(w / 2, h * 0.14, title, h * 0.06, titleColor);
    neonText(w / 2, h * 0.24, `time  ${r.timeSec.toFixed(1)}s`, h * 0.028, '#666');

    let y = h * 0.36;
    const dy = h * 0.06;
    rowText('BASE',       `$${b.baseReward}`,    y,         w, h, '#00f0ff');
    rowText('TIME BONUS', `$${b.timeBonus}`,     y + dy,    w, h, '#ffd400');
    rowText('CASH FOUND', `$${b.cashCollected}`, y + dy * 2,w, h, '#00f0ff');
    rowText('ITEMS',      `$${b.itemReward}`,    y + dy * 3,w, h, '#ff2bd6');
    rowText('TOTAL',      `$${b.total}`,         y + dy * 4,w, h, '#fff');

    neonText(w / 2, h * 0.92, 'any key  →  store', h * 0.022, '#888', 8);
  }

  function drawStore(w, h) {
    const p = state.player;
    neonText(w / 2, h * 0.10, 'STORE', h * 0.065, '#ffd400');
    neonText(w / 2, h * 0.22, `Wallet  $${p.cash}`, h * 0.040, '#00f0ff');
    neonText(w / 2, h * 0.30, `Bank slots  ${p.bank.capacity}`, h * 0.028, '#fff');

    // Single store item for now
    const item = PRY.STORE.bank_upgrade_1;
    const affordable = p.cash >= item.cost;
    neonText(w / 2, h * 0.46, `▲  ${item.name}  ($${item.cost})`,
      h * 0.028, affordable ? '#ff2bd6' : '#555');

    const lvl = PRY.LEVELS[state.lastRun?.levelId ?? 1];
    const replayCost = lvl.replayCost;
    const canReplay = p.cash >= replayCost;
    neonText(w / 2, h * 0.66, `A / Enter  =  replay ($${replayCost})`,
      h * 0.025, canReplay ? '#00f0ff' : '#555');
    neonText(w / 2, h * 0.74, 'B  =  back to attract', h * 0.025, '#ff2bd6');
    neonText(w / 2, h * 0.90, '(loadout + level-select arrive later)', h * 0.018, '#555');
  }

  function render() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    drawScanlines(w, h);

    switch (state.mode) {
      case 'attract': drawAttract(w, h); break;
      case 'explore': drawExplore(w, h); break;
      case 'reward':  drawReward(w, h);  break;
      case 'store':   drawStore(w, h);   break;
    }
    t++;
  }

  let lastNow = performance.now();
  function frame(now) {
    const dt = now - lastNow;
    lastNow = now;
    tick(dt, now);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame((n) => { lastNow = n; frame(n); });
})();
