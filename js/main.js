(() => {
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const PRY = window.PRY;
  const state = PRY.state;

  // ====================================================================
  // INPUT — keyboard + on-screen pointer
  // ====================================================================

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
    if (!e.repeat) handleInput(canonical(e.key));
  });
  window.addEventListener('keyup', (e) => setActive(e.key, false));

  buttons.forEach(b => {
    const k = b.dataset.key;
    const press   = (e) => { e.preventDefault(); b.classList.add('active'); handleInput(k); };
    const release = (e) => { e.preventDefault(); b.classList.remove('active'); };
    b.addEventListener('pointerdown',   press);
    b.addEventListener('pointerup',     release);
    b.addEventListener('pointerleave',  release);
    b.addEventListener('pointercancel', release);
  });

  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); handleInput('Enter'); });

  // ====================================================================
  // EXPLORE — movement, walls, pickups, crack-trigger
  // ====================================================================

  function tryMove(dx, dy) {
    const p = state.player;
    const lvl = state.level;
    const nx = p.x + dx, ny = p.y + dy;
    if (ny < 0 || ny >= lvl.height || nx < 0 || nx >= lvl.width) return;
    const tile = lvl.tiles[ny][nx];

    if (tile === PRY.TILE.HEDGE) return;  // blocked by wall

    // Move
    p.x = nx; p.y = ny;

    // Pickups
    const i = lvl.pickups.findIndex(pk => pk.x === nx && pk.y === ny);
    if (i !== -1) {
      const pk = lvl.pickups[i];
      collectPickup(pk.item);
      lvl.pickups.splice(i, 1);
      if (state.run) state.run.itemsCollected += 1;
    }

    // Tile effects
    if (tile === PRY.TILE.CRACK) {
      enterBattle('ogre');
    }
  }

  function collectPickup(itemId) {
    const inv = state.player.inventory;
    if (itemId === 'frog_sword') inv.frog_sword = true;
    else if (itemId in inv) inv[itemId] += 1;
  }

  // ====================================================================
  // BATTLE — initialize, action-menu wiring
  // (resolution / enemy turn / win-lose come in step 7)
  // ====================================================================

  function enterBattle(enemyId) {
    const e = PRY.ENEMIES[enemyId];
    state.battle = {
      enemyId,
      enemyHp: e.hp,
      enemyMaxHp: e.hp,
      turn: 'player',
      shieldRoundsLeft: 0,
      stunRoundsLeft: 0,
      debuffs: { attackMinus: 0 },
      attackMenuOpen: false,
      lastAction: null,        // 'sword' | 'shield' | null
      turnsTaken: 0,
    };
    state.mode = 'battle';
  }

  function fleeBattleDebug() {
    // TEMPORARY exit until step 7 wires real win/lose resolution
    state.battle = null;
    state.mode = 'explore';
    state.player.x = state.level.playerStart.x;
    state.player.y = state.level.playerStart.y;
  }

  function useSword() {
    const b = state.battle;
    if (!b) return;
    b.lastAction = 'sword';
    b.turnsTaken += 1;
    b.attackMenuOpen = false;
    // damage calc will land in step 7
  }
  function useShield() {
    const b = state.battle;
    if (!b) return;
    const sh = PRY.ITEMS.force_shield;
    b.lastAction = 'shield';
    b.shieldRoundsLeft = sh.blocksEnemyTurns;
    b.attackMenuOpen = false;
  }

  // ====================================================================
  // BAG — opens from explore or battle, closes back to source
  // ====================================================================

  function openBag(fromMode) {
    state.returnFromBag = fromMode;
    state.mode = 'bag';
  }
  function closeBag() {
    state.mode = state.returnFromBag || 'explore';
    state.returnFromBag = null;
  }

  // ====================================================================
  // META-LOOP — mode transitions (attract/explore/reward/store)
  // ====================================================================

  function startRun(levelId) {
    const lvl = PRY.LEVELS[levelId];
    if (!lvl) return;
    const isFirstPlay = !state.player.ownedUpgrades['played_' + levelId];
    const cost = isFirstPlay ? lvl.playCost : lvl.replayCost;
    if (state.player.cash < cost) return;
    state.player.cash -= cost;
    state.player.ownedUpgrades['played_' + levelId] = true;

    state.mode = 'explore';
    state.level = PRY.initialState().level;   // fresh tile copy (pickups respawn)
    state.player.hp = state.player.maxHp;
    state.player.x = state.level.playerStart.x;
    state.player.y = state.level.playerStart.y;
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
    const baseReward = outcome === 'win' ? Math.floor(lvl.baseReward * lvl.difficulty) : 0;
    const timeBonus  = outcome === 'win' ? Math.max(0, Math.floor((lvl.parTime - timeSec) * lvl.timeBonusPer)) : 0;
    const itemReward = r.itemsCollected * 5;
    const total = baseReward + timeBonus + r.cashCollected + itemReward;
    state.player.cash += total;
    state.lastRun = {
      ...r, outcome, timeSec,
      breakdown: { baseReward, timeBonus, itemReward, cashCollected: r.cashCollected, total },
    };
    state.run = null;
    state.mode = 'reward';
  }

  function buyStoreItem(id) {
    const item = PRY.STORE[id];
    if (!item || state.player.cash < item.cost) return;
    state.player.cash -= item.cost;
    item.apply(state.player);
  }

  // ====================================================================
  // INPUT DISPATCH
  // ====================================================================

  function handleInput(key) {
    switch (state.mode) {
      case 'attract':
        startRun(1); return;

      case 'explore':
        if      (key === 'ArrowUp')    tryMove( 0, -1);
        else if (key === 'ArrowDown')  tryMove( 0,  1);
        else if (key === 'ArrowLeft')  tryMove(-1,  0);
        else if (key === 'ArrowRight') tryMove( 1,  0);
        else if (key === 'x')          openBag('explore');
        return;

      case 'battle': {
        const b = state.battle;
        if (!b) return;
        if (b.attackMenuOpen) {
          if      (key === 'z') useSword();
          else if (key === 'x') useShield();
          return;
        }
        if      (key === 'z')     b.attackMenuOpen = true;
        else if (key === 'x')     openBag('battle');
        else if (key === 'Enter') fleeBattleDebug();   // temporary
        return;
      }

      case 'bag':
        if (key === 'x' || key === 'Enter') closeBag();
        return;

      case 'reward':
        state.mode = 'store'; return;

      case 'store':
        if      (key === 'ArrowUp')              buyStoreItem('bank_upgrade_1');
        else if (key === 'z' || key === 'Enter') startRun(state.lastRun?.levelId ?? 1);
        else if (key === 'x')                    state.mode = 'attract';
        return;
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

  function tick(now) {
    if (state.mode === 'explore' && state.run) {
      state.run.timeElapsed = now - state.run.startedAt;
    }
  }

  // ---- shared draw helpers ----
  function neonText(x, y, txt, fontSize, color, blur = 16) {
    ctx.font = `${Math.floor(fontSize)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = blur;
    ctx.fillStyle = color; ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0;
  }
  function rowText(label, value, y, w, h, color) {
    ctx.font = `${Math.floor(h * 0.028)}px 'Press Start 2P', monospace`;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillStyle = color;   ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';  ctx.fillText(label, w * 0.18, y);
    ctx.textAlign = 'right'; ctx.fillText(value, w * 0.82, y);
    ctx.shadowBlur = 0;
  }
  function drawScanlines(w, h) {
    ctx.strokeStyle = 'rgba(255, 43, 214, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  // ---- per-mode draw ----
  let t = 0;

  function drawAttract(w, h) {
    const cx = w / 2, cy = h * 0.42;
    ctx.font = `${Math.floor(h * 0.22)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const flicker = 0.85 + Math.sin(t * 0.08) * 0.08 + (Math.random() < 0.02 ? -0.3 : 0);
    ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 28 * Math.max(0.2, flicker);
    ctx.fillStyle = '#ff2bd6';    ctx.fillText('PRY', cx, cy);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'; ctx.fillText('PRY', cx, cy);
    if (Math.floor(t / 30) % 2 === 0) {
      neonText(cx, h * 0.78, 'PRESS ANY KEY', h * 0.035, '#00f0ff', 12);
    }
  }

  function drawLevelGrid(w, h, originX, originY, tileSize) {
    const lvl = state.level;
    for (let y = 0; y < lvl.height; y++) {
      for (let x = 0; x < lvl.width; x++) {
        const tile = lvl.tiles[y][x];
        const px = originX + x * tileSize;
        const py = originY + y * tileSize;
        let fill = '#000';
        if      (tile === PRY.TILE.WOOD)  fill = '#5a3a1a';
        else if (tile === PRY.TILE.HEDGE) fill = '#1c4a1c';
        else if (tile === PRY.TILE.CRACK) fill = '#3a2410';
        else if (tile === PRY.TILE.TUBE)  fill = '#00404a';
        ctx.fillStyle = fill;
        ctx.fillRect(px, py, tileSize - 1, tileSize - 1);
        if (tile === PRY.TILE.CRACK) {
          // dashed red "danger" border on the cracked tile
          ctx.strokeStyle = '#ff2b2b';
          ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
          ctx.strokeRect(px + 2, py + 2, tileSize - 5, tileSize - 5);
          ctx.setLineDash([]);
        }
      }
    }
    // pickups
    for (const pk of lvl.pickups) {
      const px = originX + pk.x * tileSize;
      const py = originY + pk.y * tileSize;
      ctx.fillStyle = '#ffd400';
      ctx.shadowColor = '#ffd400'; ctx.shadowBlur = 10;
      ctx.fillRect(px + tileSize * 0.30, py + tileSize * 0.30,
                   tileSize * 0.40, tileSize * 0.40);
      ctx.shadowBlur = 0;
    }
    // player
    const p = state.player;
    const cx = originX + p.x * tileSize + tileSize / 2;
    const cy = originY + p.y * tileSize + tileSize / 2;
    ctx.fillStyle = '#ff2bd6';
    ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(cx, cy, tileSize * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawExplore(w, h) {
    const lvl = state.level;
    // HUD strip top
    const hudTop = h * 0.10;
    const hudBot = h * 0.16;
    const gridH = h - hudTop - hudBot;
    const tileSize = Math.floor(Math.min(w / lvl.width, gridH / lvl.height));
    const gridW = tileSize * lvl.width;
    const gridHpx = tileSize * lvl.height;
    const ox = (w - gridW) / 2;
    const oy = hudTop + (gridH - gridHpx) / 2;

    drawLevelGrid(w, h, ox, oy, tileSize);

    const time = (state.run?.timeElapsed || 0) / 1000;
    neonText(w * 0.20, h * 0.05, `${lvl.name}`, h * 0.025, '#ff2bd6', 8);
    neonText(w * 0.50, h * 0.05, `Time ${time.toFixed(1)}s`, h * 0.025, '#ffd400', 8);
    neonText(w * 0.80, h * 0.05, `HP ${state.player.hp}/${state.player.maxHp}`, h * 0.025, '#00f0ff', 8);

    const inv = state.player.inventory;
    const sword = inv.frog_sword ? 'FROG SWORD' : '—';
    neonText(w * 0.30, h * 0.93, `Sword: ${sword}`, h * 0.020, '#ffd400', 6);
    neonText(w * 0.70, h * 0.93, 'B = bag   arrows = walk', h * 0.020, '#888', 6);
  }

  function drawBattle(w, h) {
    const b = state.battle;
    if (!b) return;
    const enemy = PRY.ENEMIES[b.enemyId];

    neonText(w / 2, h * 0.08, 'BATTLE', h * 0.05, '#ff2bd6');
    neonText(w / 2, h * 0.16, enemy.name, h * 0.035, '#ffd400');

    // enemy
    ctx.fillStyle = '#2a0a0a';
    ctx.fillRect(w * 0.55, h * 0.22, w * 0.30, h * 0.32);
    ctx.strokeStyle = '#ff2b2b';
    ctx.shadowColor = '#ff2b2b'; ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.55, h * 0.22, w * 0.30, h * 0.32);
    ctx.shadowBlur = 0;
    neonText(w * 0.70, h * 0.58, `HP ${b.enemyHp}/${b.enemyMaxHp}`, h * 0.022, '#ff2b2b', 8);

    // player
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(w * 0.15, h * 0.30, w * 0.25, h * 0.24);
    ctx.strokeStyle = '#ff2bd6';
    ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.15, h * 0.30, w * 0.25, h * 0.24);
    ctx.shadowBlur = 0;
    neonText(w * 0.275, h * 0.58, `HP ${state.player.hp}/${state.player.maxHp}`, h * 0.022, '#ff2bd6', 8);

    if (b.shieldRoundsLeft > 0) {
      neonText(w / 2, h * 0.65, `▸ shield: ${b.shieldRoundsLeft} enemy turns`, h * 0.022, '#00f0ff', 8);
    }
    if (b.lastAction) {
      neonText(w / 2, h * 0.71, `last: ${b.lastAction.toUpperCase()}`, h * 0.020, '#666', 4);
    }

    if (b.attackMenuOpen) {
      // overlay attack menu
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, h * 0.75, w, h * 0.25);
      neonText(w / 2, h * 0.80, 'ACTION', h * 0.028, '#ffd400');
      const dmg = state.player.frogCount * PRY.ITEMS.frog_sword.damagePerFrog;
      neonText(w * 0.30, h * 0.90, `A — Frog Sword (${dmg} dmg)`, h * 0.022, '#ff2bd6');
      neonText(w * 0.72, h * 0.90, 'B — Force Shield', h * 0.022, '#00f0ff');
    } else {
      neonText(w * 0.30, h * 0.90, 'A = attack', h * 0.022, '#ff2bd6');
      neonText(w * 0.55, h * 0.90, 'B = bag',    h * 0.022, '#00f0ff');
      neonText(w * 0.80, h * 0.90, '[ENTER] flee', h * 0.018, '#555', 4);
    }
  }

  function drawBag(w, h) {
    neonText(w / 2, h * 0.10, 'BAG', h * 0.06, '#ffd400');
    const inv = state.player.inventory;
    const lines = [
      `Frog Sword     ${inv.frog_sword ? 'equipped' : '—'}`,
      `Force Shield   ${inv.force_shield}`,
      `Poopoo         ${inv.poopoo}`,
      `Peach Drops    ${inv.peach_drop}`,
      `Blueberries    ${inv.blueberry}`,
      `Redberries     ${inv.redberry}`,
    ];
    let y = h * 0.28;
    for (const l of lines) {
      ctx.font = `${Math.floor(h * 0.025)}px 'Press Start 2P', monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 6;
      ctx.fillStyle = '#fff';
      ctx.fillText(l, w * 0.20, y);
      ctx.shadowBlur = 0;
      y += h * 0.06;
    }
    neonText(w / 2, h * 0.92, 'B / Enter = close', h * 0.022, '#888');
  }

  function drawReward(w, h) {
    const r = state.lastRun; if (!r) return;
    const b = r.breakdown;
    const title = r.outcome === 'win' ? 'LEVEL CLEAR' : 'RUN ENDED';
    const titleColor = r.outcome === 'win' ? '#ff2bd6' : '#555';
    neonText(w / 2, h * 0.14, title, h * 0.06, titleColor);
    neonText(w / 2, h * 0.24, `time  ${r.timeSec.toFixed(1)}s`, h * 0.028, '#666');
    let y = h * 0.36; const dy = h * 0.06;
    rowText('BASE',       `$${b.baseReward}`,    y,          w, h, '#00f0ff');
    rowText('TIME BONUS', `$${b.timeBonus}`,     y + dy,     w, h, '#ffd400');
    rowText('CASH FOUND', `$${b.cashCollected}`, y + dy * 2, w, h, '#00f0ff');
    rowText('ITEMS',      `$${b.itemReward}`,    y + dy * 3, w, h, '#ff2bd6');
    rowText('TOTAL',      `$${b.total}`,         y + dy * 4, w, h, '#fff');
    neonText(w / 2, h * 0.92, 'any key  →  store', h * 0.022, '#888', 8);
  }

  function drawStore(w, h) {
    const p = state.player;
    neonText(w / 2, h * 0.10, 'STORE', h * 0.065, '#ffd400');
    neonText(w / 2, h * 0.22, `Wallet  $${p.cash}`, h * 0.040, '#00f0ff');
    neonText(w / 2, h * 0.30, `Bank slots  ${p.bank.capacity}`, h * 0.028, '#fff');
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
  }

  function render() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    drawScanlines(w, h);
    switch (state.mode) {
      case 'attract': drawAttract(w, h); break;
      case 'explore': drawExplore(w, h); break;
      case 'battle':  drawBattle(w, h);  break;
      case 'bag':     drawBag(w, h);     break;
      case 'reward':  drawReward(w, h);  break;
      case 'store':   drawStore(w, h);   break;
    }
    t++;
  }

  let lastNow = performance.now();
  function frame(now) {
    lastNow = now;
    tick(now);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame((n) => { lastNow = n; frame(n); });
})();
