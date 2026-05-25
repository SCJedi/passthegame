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
      enterBattle('ogre', { x: nx, y: ny });
    } else if (tile === PRY.TILE.TUBE) {
      finishRun('win');
    }
  }

  function collectPickup(itemId) {
    const inv = state.player.inventory;
    if (itemId === 'frog_sword') inv.frog_sword = true;
    else if (itemId in inv) inv[itemId] += 1;
  }

  // ====================================================================
  // BATTLE — initialize + resolution (sword damage, enemy turn, win/lose)
  // ====================================================================

  function enterBattle(enemyId, triggerXY) {
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
      lastAction: null,
      lastEnemyAction: null,
      lastPlayerDmg: 0,
      lastEnemyDmg: 0,
      turnsTaken: 0,
      triggerXY: triggerXY || null,   // where on the map this battle came from
    };
    state.mode = 'battle';
  }

  function fleeBattle() {
    // Per rules: leaving the level forfeits everything. No rewards.
    finishRun('forfeit');
  }

  function useSword() {
    const b = state.battle;
    if (!b || b.turn !== 'player') return;
    const dmg = Math.max(0,
      state.player.frogCount * PRY.ITEMS.frog_sword.damagePerFrog - b.debuffs.attackMinus
    );
    b.enemyHp = Math.max(0, b.enemyHp - dmg);
    b.lastAction = 'sword';
    b.lastPlayerDmg = dmg;
    b.attackMenuOpen = false;
    b.turnsTaken += 1;
    afterPlayerAction();
  }

  function useShield() {
    const b = state.battle;
    if (!b || b.turn !== 'player') return;
    const sh = PRY.ITEMS.force_shield;
    b.shieldRoundsLeft = sh.blocksEnemyTurns;
    b.lastAction = 'shield';
    b.lastPlayerDmg = 0;
    b.attackMenuOpen = false;
    b.turnsTaken += 1;
    afterPlayerAction();
  }

  function afterPlayerAction() {
    const b = state.battle;
    if (!b) return;
    if (b.enemyHp <= 0) { onEnemyDefeated(); return; }
    b.turn = 'enemy';
    enemyTurn();
  }

  function enemyTurn() {
    const b = state.battle;
    if (!b) return;
    if (b.stunRoundsLeft > 0) {
      b.stunRoundsLeft -= 1;
      b.lastEnemyAction = 'stunned (skips turn)';
      b.lastEnemyDmg = 0;
    } else {
      const enemy = PRY.ENEMIES[b.enemyId];
      let dmg = enemy.attack;
      if (b.shieldRoundsLeft > 0) {
        dmg = Math.max(0, dmg - PRY.ITEMS.force_shield.blockDamage);
        b.shieldRoundsLeft -= 1;
        b.lastEnemyAction = `attacks (shield -5)`;
      } else {
        b.lastEnemyAction = `attacks`;
      }
      b.lastEnemyDmg = dmg;
      state.player.hp = Math.max(0, state.player.hp - dmg);
    }
    if (state.player.hp <= 0) { onPlayerDefeated(); return; }
    b.turn = 'player';
  }

  function onEnemyDefeated() {
    const b = state.battle;
    if (!b) return;
    const enemy = PRY.ENEMIES[b.enemyId];
    if (state.run) state.run.enemiesDefeated = (state.run.enemiesDefeated || 0) + 1;

    // Replace the crack with a tube exit at the tile that triggered the battle.
    if (enemy.onDefeat?.spawnTube && b.triggerXY) {
      const { x, y } = b.triggerXY;
      state.level.tiles[y][x] = PRY.TILE.TUBE;
    }
    state.battle = null;
    state.mode = 'explore';
    // Eject the player off the tube tile so they can choose to step back on
    // (otherwise they'd instantly clear). Place at the level start.
    state.player.x = state.level.playerStart.x;
    state.player.y = state.level.playerStart.y;
  }

  function onPlayerDefeated() {
    // HP hit zero in battle. Forfeit run, no reward.
    state.battle = null;
    finishRun('lose');
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
  // CHARACTER CREATOR
  // ====================================================================

  const SPR = PRY.SPRITES;
  const SECTIONS = [
    { key: 'gender',      label: 'GENDER',  opts: ['boy', 'girl'] },
    { key: 'skin',        label: 'SKIN',    opts: ['light', 'dark'] },
    { key: 'hairColor',   label: 'HAIR',    opts: ['blonde', 'brown'] },
    { key: 'hairStyle',   label: 'STYLE',   opts: null },  // gender-dependent
    { key: 'shirtColor',  label: 'SHIRT',   opts: SPR.CLOTH_KEYS },
    { key: 'bottomColor', label: 'BOTTOM',  opts: SPR.CLOTH_KEYS },
    { key: 'jacketColor', label: 'JACKET',  opts: ['none', ...SPR.CLOTH_KEYS] },
  ];

  // Where to go after the player confirms the character creator (e.g. 'attract'
  // on first run, 'store' when remaking from level select).
  let creatorReturnAction = 'startRun1';

  function optionsFor(section, appearance) {
    if (section.key === 'hairStyle') return SPR.HAIR_STYLES[appearance.gender];
    return section.opts;
  }

  function openCharacterCreator(returnAction) {
    creatorReturnAction = returnAction;
    if (!state.player.appearance) {
      state.player.appearance = SPR.defaultAppearance();
    }
    state.character = { selectedSection: 0 };
    state.mode = 'character';
  }

  function cycleOption(dir) {
    const c = state.character;
    const sec = SECTIONS[c.selectedSection];
    const app = state.player.appearance;
    const opts = optionsFor(sec, app);
    const cur = app[sec.key];
    let i = opts.indexOf(cur);
    if (i === -1) i = 0;
    i = (i + dir + opts.length) % opts.length;
    app[sec.key] = opts[i];
    // If gender changed, hairStyle may now be invalid — reset to first.
    if (sec.key === 'gender') {
      app.hairStyle = SPR.HAIR_STYLES[app.gender][0];
    }
  }

  function confirmCharacter() {
    if (creatorReturnAction === 'startRun1') startRun(1);
    else if (creatorReturnAction === 'store') state.mode = 'store';
    else state.mode = 'attract';
  }

  // ====================================================================
  // META-LOOP — mode transitions (attract/explore/reward/store)
  // ====================================================================

  function startRun(levelId) {
    const lvl = PRY.LEVELS[levelId];
    if (!lvl) return;
    // Free until you clear the level; paid replays after that.
    const hasCleared = !!(state.player.levelRecords[levelId]?.bestScore);
    const cost = hasCleared ? lvl.replayCost : lvl.playCost;
    if (state.player.cash < cost) return;
    state.player.cash -= cost;

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
      enemiesDefeated: 0,
      // Snapshot inventory so forfeit/lose can roll back what was collected mid-run.
      // (Loadout-from-bank arrives in step 9; for now nothing is "brought in" beyond
      // what's already in inventory from previous wins.)
      inventoryAtStart: JSON.parse(JSON.stringify(state.player.inventory)),
    };
  }

  function finishRun(outcome) {
    const r = state.run;
    if (!r) return;
    const lvl = PRY.LEVELS[r.levelId];
    const timeSec = r.timeElapsed / 1000;
    const win = outcome === 'win';
    const baseReward = win ? Math.floor(lvl.baseReward * lvl.difficulty) : 0;
    const timeBonus  = win ? Math.max(0, Math.floor((lvl.parTime - timeSec) * lvl.timeBonusPer)) : 0;
    const itemReward = win ? r.itemsCollected * 5 : 0;
    const killReward = win ? (r.enemiesDefeated || 0) * lvl.enemyKillReward : 0;
    const total = baseReward + timeBonus + r.cashCollected + itemReward + killReward;
    state.player.cash += total;

    // Forfeit / lose: revert items collected this run.
    if (!win) {
      state.player.inventory = r.inventoryAtStart;
    }

    // Update per-level record on win (best time, best score, best tier).
    let tier = null;
    if (win) {
      tier = PRY.tierFor(total, lvl);
      const rec = state.player.levelRecords[r.levelId] || {};
      const better = (rec.bestScore === undefined) || total > rec.bestScore;
      const faster = (rec.bestTime  === undefined) || timeSec < rec.bestTime;
      state.player.levelRecords[r.levelId] = {
        bestTime:  faster ? timeSec : rec.bestTime,
        bestScore: better ? total   : rec.bestScore,
        bestTier:  PRY.tierFor(Math.max(total, rec.bestScore || 0), lvl),
        clears:    (rec.clears || 0) + 1,
        lastEnemiesDefeated: r.enemiesDefeated || 0,
        lastItemsFound:      r.itemsCollected,
      };
    }

    state.lastRun = {
      ...r, outcome, timeSec, tier,
      breakdown: {
        baseReward, timeBonus, itemReward, killReward,
        cashCollected: r.cashCollected, total,
      },
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
        if (!state.player.appearance) openCharacterCreator('startRun1');
        else startRun(1);
        return;

      case 'character': {
        const c = state.character;
        if      (key === 'ArrowUp')    c.selectedSection = (c.selectedSection - 1 + SECTIONS.length) % SECTIONS.length;
        else if (key === 'ArrowDown')  c.selectedSection = (c.selectedSection + 1) % SECTIONS.length;
        else if (key === 'ArrowLeft')  cycleOption(-1);
        else if (key === 'ArrowRight') cycleOption(+1);
        else if (key === 'z' || key === 'Enter') confirmCharacter();
        else if (key === 'x')          state.mode = 'attract';
        return;
      }

      case 'explore':
        if      (key === 'ArrowUp')    tryMove( 0, -1);
        else if (key === 'ArrowDown')  tryMove( 0,  1);
        else if (key === 'ArrowLeft')  tryMove(-1,  0);
        else if (key === 'ArrowRight') tryMove( 1,  0);
        else if (key === 'x')          openBag('explore');
        else if (key === 'Enter')      finishRun('forfeit');   // leave any time = forfeit
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
        else if (key === 'Enter') fleeBattle();   // skippable = forfeit
        return;
      }

      case 'bag':
        if (key === 'x' || key === 'Enter') closeBag();
        return;

      case 'reward':
        state.mode = 'store'; return;

      case 'store':
        if      (key === 'ArrowUp')              buyStoreItem('bank_upgrade_1');
        else if (key === 'c' || key === 'C')     openCharacterCreator('store');
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
        if (tile === PRY.TILE.WOOD) {
          SPR.drawWoodTile(ctx, px, py, tileSize);
        } else if (tile === PRY.TILE.HEDGE) {
          SPR.drawHedgeTile(ctx, px, py, tileSize);
        } else if (tile === PRY.TILE.CRACK) {
          SPR.drawWoodTile(ctx, px, py, tileSize);
          // crack lines: a few jagged dark strokes overlaid
          ctx.strokeStyle = '#1a0a04';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + tileSize * 0.15, py + tileSize * 0.20);
          ctx.lineTo(px + tileSize * 0.55, py + tileSize * 0.45);
          ctx.lineTo(px + tileSize * 0.30, py + tileSize * 0.75);
          ctx.lineTo(px + tileSize * 0.80, py + tileSize * 0.85);
          ctx.stroke();
          // dashed red warning border
          ctx.strokeStyle = '#ff2b2b';
          ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
          ctx.strokeRect(px + 2, py + 2, tileSize - 5, tileSize - 5);
          ctx.setLineDash([]);
        } else if (tile === PRY.TILE.TUBE) {
          SPR.drawWoodTile(ctx, px, py, tileSize);
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.15);
          // dark hole
          ctx.fillStyle = '#001418';
          ctx.beginPath();
          ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.36, 0, Math.PI * 2);
          ctx.fill();
          // cyan rim
          ctx.strokeStyle = '#00f0ff';
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 14 * pulse;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.34, 0, Math.PI * 2);
          ctx.stroke();
          // upward arrows inside
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.moveTo(px + tileSize / 2, py + tileSize * 0.30);
          ctx.lineTo(px + tileSize * 0.62, py + tileSize * 0.50);
          ctx.lineTo(px + tileSize * 0.38, py + tileSize * 0.50);
          ctx.closePath(); ctx.fill();
        }
      }
    }
    // pickups
    for (const pk of lvl.pickups) {
      const px = originX + pk.x * tileSize;
      const py = originY + pk.y * tileSize;
      if (pk.item === 'frog_sword') {
        SPR.drawSwordPickup(ctx, px + tileSize / 2, py + tileSize / 2, tileSize * 0.8, t);
      } else {
        ctx.fillStyle = '#ffd400';
        ctx.fillRect(px + tileSize * 0.30, py + tileSize * 0.30, tileSize * 0.40, tileSize * 0.40);
      }
    }
    // player
    const p = state.player;
    const pcx = originX + p.x * tileSize + tileSize / 2;
    const pcy = originY + p.y * tileSize + tileSize / 2;
    if (state.player.appearance) {
      SPR.drawCharacter(ctx, pcx, pcy, tileSize * 1.05, state.player.appearance);
    } else {
      ctx.fillStyle = '#ff2bd6';
      ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(pcx, pcy, tileSize * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
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
    neonText(w * 0.20, h * 0.93, `Sword: ${sword}`, h * 0.020, '#ffd400', 6);
    neonText(w * 0.55, h * 0.93, 'B = bag   arrows = walk', h * 0.020, '#888', 6);
    neonText(w * 0.85, h * 0.93, '[ENTER] leave', h * 0.018, '#555', 4);
  }

  function drawBattle(w, h) {
    const b = state.battle;
    if (!b) return;
    const enemy = PRY.ENEMIES[b.enemyId];

    neonText(w / 2, h * 0.08, 'BATTLE', h * 0.05, '#ff2bd6');
    neonText(w / 2, h * 0.16, enemy.name, h * 0.030, '#ffd400');

    // floor strip
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(w * 0.05, h * 0.55, w * 0.90, h * 0.03);

    // enemy sprite (ogre)
    SPR.drawOgre(ctx, w * 0.70, h * 0.42, Math.min(w, h) * 0.45, t);
    neonText(w * 0.70, h * 0.61, `HP ${b.enemyHp}/${b.enemyMaxHp}`, h * 0.022, '#ff2b2b', 8);

    // player sprite (character)
    if (state.player.appearance) {
      SPR.drawCharacter(ctx, w * 0.28, h * 0.42, Math.min(w, h) * 0.40, state.player.appearance);
    }
    neonText(w * 0.28, h * 0.61, `HP ${state.player.hp}/${state.player.maxHp}`, h * 0.022, '#ff2bd6', 8);

    if (b.shieldRoundsLeft > 0) {
      neonText(w / 2, h * 0.64, `▸ shield: ${b.shieldRoundsLeft} enemy turns`, h * 0.022, '#00f0ff', 8);
    }
    // turn log
    const youLine = b.lastAction
      ? (b.lastAction === 'sword' ? `YOU swing for ${b.lastPlayerDmg}` : 'YOU raise shield')
      : '';
    const enemyLine = b.lastEnemyAction
      ? `${enemy.name.toUpperCase()} ${b.lastEnemyAction}${b.lastEnemyDmg ? ` for ${b.lastEnemyDmg}` : ''}`
      : '';
    if (youLine)   neonText(w / 2, h * 0.70, youLine,   h * 0.022, '#ff2bd6', 6);
    if (enemyLine) neonText(w / 2, h * 0.75, enemyLine, h * 0.022, '#ff2b2b', 6);

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
    let title, titleColor;
    if      (r.outcome === 'win')     { title = 'LEVEL CLEAR';   titleColor = '#ff2bd6'; }
    else if (r.outcome === 'lose')    { title = 'YOU DIED';      titleColor = '#ff2b2b'; }
    else                              { title = 'RUN FORFEITED'; titleColor = '#666';    }
    neonText(w / 2, h * 0.12, title, h * 0.055, titleColor);
    neonText(w / 2, h * 0.20, `time  ${r.timeSec.toFixed(1)}s`, h * 0.024, '#666');

    if (r.tier) {
      const tierColors = { gold: '#ffd400', silver: '#cccccc', bronze: '#cd7f32' };
      neonText(w / 2, h * 0.29, `★ ${r.tier.toUpperCase()} ★`, h * 0.042, tierColors[r.tier]);
    }

    let y = h * 0.40; const dy = h * 0.055;
    rowText('BASE',       `$${b.baseReward}`,    y,          w, h, '#00f0ff');
    rowText('TIME BONUS', `$${b.timeBonus}`,     y + dy,     w, h, '#ffd400');
    rowText('KILLS',      `$${b.killReward}`,    y + dy * 2, w, h, '#ff2b2b');
    rowText('CASH FOUND', `$${b.cashCollected}`, y + dy * 3, w, h, '#00f0ff');
    rowText('ITEMS',      `$${b.itemReward}`,    y + dy * 4, w, h, '#ff2bd6');
    rowText('TOTAL',      `$${b.total}`,         y + dy * 5, w, h, '#fff');

    if (r.outcome !== 'win') {
      neonText(w / 2, h * 0.85, 'items collected mid-run were lost', h * 0.018, '#666');
    }
    neonText(w / 2, h * 0.93, 'any key  →  store', h * 0.020, '#888', 8);
  }

  function drawCharacterCreator(w, h) {
    const app = state.player.appearance;
    const c = state.character;
    neonText(w / 2, h * 0.07, 'CHARACTER', h * 0.045, '#ffd400');

    // preview pane (left half)
    // floor under feet
    ctx.fillStyle = '#1c4a1c';
    ctx.fillRect(w * 0.05, h * 0.78, w * 0.40, h * 0.04);
    SPR.drawCharacter(ctx, w * 0.25, h * 0.50, h * 0.58, app);

    // options list (right half)
    const x0 = w * 0.52;
    const x1 = w * 0.95;
    const y0 = h * 0.16;
    const dy = h * 0.085;
    for (let i = 0; i < SECTIONS.length; i++) {
      const sec = SECTIONS[i];
      const opts = optionsFor(sec, app);
      const cur = app[sec.key];
      const y = y0 + dy * i;
      const selected = (i === c.selectedSection);
      // row backdrop when selected
      if (selected) {
        ctx.fillStyle = 'rgba(255, 43, 214, 0.10)';
        ctx.fillRect(x0 - 6, y - h * 0.030, (x1 - x0) + 12, h * 0.058);
        ctx.strokeStyle = '#ff2bd6';
        ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 10;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 - 6, y - h * 0.030, (x1 - x0) + 12, h * 0.058);
        ctx.shadowBlur = 0;
      }
      ctx.font = `${Math.floor(h * 0.022)}px 'Press Start 2P', monospace`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = selected ? '#ff2bd6' : '#888';
      ctx.fillText(sec.label, x0, y);
      ctx.textAlign = 'right';
      // color swatch for color options
      const isCloth = SPR.CLOTH_PALETTE[cur];
      if (isCloth) {
        ctx.fillStyle = isCloth;
        ctx.fillRect(x1 - h * 0.055, y - h * 0.015, h * 0.03, h * 0.03);
        ctx.fillStyle = selected ? '#fff' : '#aaa';
        ctx.fillText(`◂ ${cur.toUpperCase()} ▸`, x1 - h * 0.075, y);
      } else {
        ctx.fillStyle = selected ? '#fff' : '#aaa';
        ctx.fillText(`◂ ${String(cur).toUpperCase()} ▸`, x1, y);
      }
    }

    neonText(w / 2, h * 0.93, '▲▼ section   ◂▸ change   A = play   B = back',
      h * 0.020, '#888', 6);
  }

  function drawStore(w, h) {
    const p = state.player;
    neonText(w / 2, h * 0.08, 'STORE  /  LEVEL SELECT', h * 0.040, '#ffd400');
    neonText(w / 2, h * 0.16, `Wallet  $${p.cash}    Bank slots  ${p.bank.capacity}`,
      h * 0.025, '#00f0ff');

    // ----- level record card (level 1 only for now) -----
    const lvl = PRY.LEVELS[state.lastRun?.levelId ?? 1];
    const rec = p.levelRecords[lvl.id];
    const maxR = PRY.maxPossibleReward(lvl);
    neonText(w / 2, h * 0.27, `Lv ${lvl.id}  ${lvl.name}`, h * 0.030, '#ff2bd6');

    const recColor = rec ? '#fff' : '#555';
    const tierStr  = rec?.bestTier ? `★ ${rec.bestTier.toUpperCase()}` : 'incomplete';
    const tierColor = rec?.bestTier
      ? ({ gold: '#ffd400', silver: '#cccccc', bronze: '#cd7f32' })[rec.bestTier]
      : '#555';
    neonText(w / 2, h * 0.34, tierStr, h * 0.026, tierColor);

    const bestTimeStr  = rec?.bestTime  ? `${rec.bestTime.toFixed(1)}s` : '—';
    const bestScoreStr = rec?.bestScore !== undefined ? `$${rec.bestScore}` : '—';
    const enemiesStr   = rec ? `${rec.lastEnemiesDefeated || 0}/${lvl.enemiesInLevel}` : `0/${lvl.enemiesInLevel}`;
    const itemsStr     = rec ? `${rec.lastItemsFound || 0}/${lvl.itemsInLevel}`         : `0/${lvl.itemsInLevel}`;

    let y = h * 0.43; const dy = h * 0.045;
    rowText('record time',     bestTimeStr,    y,          w, h, recColor);
    rowText('best score',      bestScoreStr,   y + dy,     w, h, recColor);
    rowText('max possible',    `$${maxR}`,     y + dy * 2, w, h, '#666');
    rowText('enemies (last)',  enemiesStr,     y + dy * 3, w, h, recColor);
    rowText('items (last)',    itemsStr,       y + dy * 4, w, h, recColor);

    // ----- store + actions -----
    const item = PRY.STORE.bank_upgrade_1;
    const affordable = p.cash >= item.cost;
    neonText(w / 2, h * 0.75, `▲  ${item.name}  ($${item.cost})`,
      h * 0.024, affordable ? '#ff2bd6' : '#555');

    const hasCleared = !!(rec?.bestScore);
    const playCost = hasCleared ? lvl.replayCost : lvl.playCost;
    const canPlay = p.cash >= playCost;
    const costStr = playCost === 0 ? 'FREE' : `$${playCost}`;
    neonText(w / 2, h * 0.84, `A / Enter  =  play (${costStr})`,
      h * 0.022, canPlay ? '#00f0ff' : '#555');
    neonText(w / 2, h * 0.90, 'B = attract    C = remake character', h * 0.020, '#ff2bd6');
  }

  function render() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    drawScanlines(w, h);
    switch (state.mode) {
      case 'attract':   drawAttract(w, h);          break;
      case 'character': drawCharacterCreator(w, h); break;
      case 'explore':   drawExplore(w, h);          break;
      case 'battle':    drawBattle(w, h);           break;
      case 'bag':       drawBag(w, h);              break;
      case 'reward':    drawReward(w, h);           break;
      case 'store':     drawStore(w, h);            break;
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
