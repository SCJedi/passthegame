// Procedural sprites for Pry — drawn straight on canvas (no PNGs yet).
// All sprites are draw-and-forget: each takes (ctx, ...) and writes pixels.

(() => {
  const PRY = window.PRY;

  // ---- Palettes / option lists ------------------------------------------
  const SKIN_COLORS = { light: '#f5cba7', dark:  '#6e3b1e' };
  const HAIR_COLORS = { blonde: '#f7d250', brown: '#3a2310' };

  const CLOTH_PALETTE = {
    red:    '#e63946',
    orange: '#f97316',
    yellow: '#facc15',
    green:  '#22c55e',
    blue:   '#1d4ed8',
    cyan:   '#06b6d4',
    purple: '#9333ea',
    pink:   '#ec4899',
    white:  '#f5f5f5',
    black:  '#2a2a2a',
  };
  const CLOTH_KEYS = Object.keys(CLOTH_PALETTE);

  const HAIR_STYLES = {
    boy:  ['short', 'shoulder'],
    girl: ['ponytail', 'down'],
  };

  function defaultAppearance() {
    return {
      gender:      'boy',
      skin:        'light',
      hairColor:   'brown',
      hairStyle:   'short',
      shirtColor:  'cyan',
      bottomColor: 'blue',
      jacketColor: 'none',     // 'none' or a CLOTH_PALETTE key
    };
  }

  // ---- drawCharacter -----------------------------------------------------
  // Draws a small front-facing character centered at (cx, cy) with overall
  // height of `size` pixels.
  function drawCharacter(ctx, cx, cy, size, app) {
    const skin = SKIN_COLORS[app.skin] || SKIN_COLORS.light;
    const hair = HAIR_COLORS[app.hairColor] || HAIR_COLORS.brown;
    const shirt = CLOTH_PALETTE[app.shirtColor] || '#888';
    const bottom = CLOTH_PALETTE[app.bottomColor] || '#444';
    const jacket = app.jacketColor && app.jacketColor !== 'none'
      ? CLOTH_PALETTE[app.jacketColor] : null;

    const headR  = size * 0.16;
    const headCy = cy - size * 0.30;
    const bodyTop = headCy + headR;
    const bodyW   = size * 0.32;
    const bodyH   = size * 0.28;
    const legH    = size * 0.28;
    const armW    = size * 0.07;
    const armH    = size * 0.22;

    // ---- back hair (drawn first so it sits behind head) ----
    if (app.gender === 'girl' && app.hairStyle === 'down') {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.ellipse(cx, headCy + headR * 0.4, headR * 1.25, headR * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // curly ends — small bumps at the bottom corners
      ctx.beginPath();
      ctx.arc(cx - headR * 1.15, headCy + headR * 1.7, headR * 0.32, 0, Math.PI * 2);
      ctx.arc(cx + headR * 1.15, headCy + headR * 1.7, headR * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
    if (app.gender === 'boy' && app.hairStyle === 'shoulder') {
      ctx.fillStyle = hair;
      ctx.fillRect(cx - headR * 1.05, headCy, headR * 0.30, headR * 1.6);
      ctx.fillRect(cx + headR * 0.75, headCy, headR * 0.30, headR * 1.6);
    }

    // ---- head (skin) ----
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
    ctx.fill();

    // ---- hair cap (on top of head) ----
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(cx, headCy - headR * 0.15, headR * 1.02, Math.PI, 0);
    ctx.fill();
    // small forehead fringe
    ctx.fillRect(cx - headR * 0.85, headCy - headR * 0.3, headR * 1.7, headR * 0.35);

    // ---- ponytail (drawn after head/cap so it pokes out the back-right) ----
    if (app.gender === 'girl' && app.hairStyle === 'ponytail') {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(cx + headR * 0.95, headCy + headR * 0.30, headR * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx + headR * 0.78, headCy + headR * 0.30, headR * 0.38, headR * 1.4);
    }

    // ---- eyes ----
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - headR * 0.46, headCy - headR * 0.08, headR * 0.18, headR * 0.18);
    ctx.fillRect(cx + headR * 0.28, headCy - headR * 0.08, headR * 0.18, headR * 0.18);

    // ---- arms (skin, exposed for t-shirt) ----
    ctx.fillStyle = skin;
    ctx.fillRect(cx - bodyW / 2 - armW * 0.95, bodyTop + bodyH * 0.18, armW, armH);
    ctx.fillRect(cx + bodyW / 2 + armW * 0.0,  bodyTop + bodyH * 0.18, armW, armH);

    // ---- torso (shirt) ----
    ctx.fillStyle = shirt;
    ctx.fillRect(cx - bodyW / 2, bodyTop, bodyW, bodyH);

    // ---- jacket overlay ----
    if (jacket) {
      ctx.fillStyle = jacket;
      // jacket sides (covers shoulders and outer edges of shirt)
      ctx.fillRect(cx - bodyW / 2 - armW * 0.4, bodyTop, bodyW + armW * 0.8, bodyH * 0.75);
      // jacket sleeves
      ctx.fillRect(cx - bodyW / 2 - armW * 1.05, bodyTop + bodyH * 0.15, armW, armH * 0.6);
      ctx.fillRect(cx + bodyW / 2 + armW * 0.05, bodyTop + bodyH * 0.15, armW, armH * 0.6);
      // open-front gap shows shirt underneath
      ctx.fillStyle = shirt;
      ctx.fillRect(cx - bodyW * 0.10, bodyTop, bodyW * 0.20, bodyH * 0.75);
    }

    // ---- bottoms ----
    const legTop = bodyTop + bodyH;
    if (app.gender === 'girl') {
      // skirt: trapezoid that flares outward
      ctx.fillStyle = bottom;
      ctx.beginPath();
      ctx.moveTo(cx - bodyW / 2,        legTop);
      ctx.lineTo(cx + bodyW / 2,        legTop);
      ctx.lineTo(cx + bodyW * 0.80,     legTop + legH * 0.55);
      ctx.lineTo(cx - bodyW * 0.80,     legTop + legH * 0.55);
      ctx.closePath();
      ctx.fill();
      // bare legs sticking out below the skirt
      ctx.fillStyle = skin;
      ctx.fillRect(cx - bodyW * 0.22, legTop + legH * 0.55, bodyW * 0.18, legH * 0.45);
      ctx.fillRect(cx + bodyW * 0.04, legTop + legH * 0.55, bodyW * 0.18, legH * 0.45);
    } else {
      // shorts — two stubby rects
      ctx.fillStyle = bottom;
      ctx.fillRect(cx - bodyW * 0.46, legTop, bodyW * 0.40, legH * 0.50);
      ctx.fillRect(cx + bodyW * 0.06, legTop, bodyW * 0.40, legH * 0.50);
      // bare legs below shorts
      ctx.fillStyle = skin;
      ctx.fillRect(cx - bodyW * 0.42, legTop + legH * 0.50, bodyW * 0.32, legH * 0.50);
      ctx.fillRect(cx + bodyW * 0.10, legTop + legH * 0.50, bodyW * 0.32, legH * 0.50);
    }
  }

  // ---- drawOgre (battle screen) -----------------------------------------
  function drawOgre(ctx, cx, cy, size, t = 0) {
    const bob = Math.sin(t * 0.06) * size * 0.02;
    const bodyY = cy + bob;

    // body (big lumpy oval, sickly green)
    ctx.fillStyle = '#5a8a3a';
    ctx.beginPath();
    ctx.ellipse(cx, bodyY + size * 0.15, size * 0.36, size * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();

    // head (slightly smaller, sits above)
    ctx.fillStyle = '#6da146';
    ctx.beginPath();
    ctx.ellipse(cx, bodyY - size * 0.10, size * 0.30, size * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();

    // eyes (small angry yellow dots)
    ctx.fillStyle = '#ffd400';
    ctx.shadowColor = '#ffd400'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(cx - size * 0.10, bodyY - size * 0.13, size * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + size * 0.10, bodyY - size * 0.13, size * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // pupils
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx - size * 0.10, bodyY - size * 0.13, size * 0.018, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + size * 0.10, bodyY - size * 0.13, size * 0.018, 0, Math.PI * 2); ctx.fill();

    // jagged mouth with two tusks
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.13, bodyY - size * 0.02);
    ctx.lineTo(cx + size * 0.13, bodyY - size * 0.02);
    ctx.lineTo(cx + size * 0.10, bodyY + size * 0.04);
    ctx.lineTo(cx - size * 0.10, bodyY + size * 0.04);
    ctx.closePath(); ctx.fill();
    // tusks
    ctx.fillStyle = '#f5e8c0';
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.09, bodyY - size * 0.02);
    ctx.lineTo(cx - size * 0.05, bodyY - size * 0.02);
    ctx.lineTo(cx - size * 0.07, bodyY + size * 0.05);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.09, bodyY - size * 0.02);
    ctx.lineTo(cx + size * 0.05, bodyY - size * 0.02);
    ctx.lineTo(cx + size * 0.07, bodyY + size * 0.05);
    ctx.closePath(); ctx.fill();

    // arms hanging
    ctx.fillStyle = '#5a8a3a';
    ctx.fillRect(cx - size * 0.40, bodyY + size * 0.00, size * 0.10, size * 0.32);
    ctx.fillRect(cx + size * 0.30, bodyY + size * 0.00, size * 0.10, size * 0.32);
    // hands
    ctx.beginPath(); ctx.arc(cx - size * 0.35, bodyY + size * 0.34, size * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + size * 0.35, bodyY + size * 0.34, size * 0.07, 0, Math.PI * 2); ctx.fill();
  }

  // ---- drawSword (small icon used as level pickup) ----------------------
  function drawSwordPickup(ctx, cx, cy, size, t = 0) {
    const pulse = 0.6 + 0.4 * Math.sin(t * 0.10);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 4);
    // blade
    ctx.fillStyle = '#cdd5e0';
    ctx.shadowColor = '#ffd400'; ctx.shadowBlur = 10 * pulse;
    ctx.fillRect(-size * 0.05, -size * 0.40, size * 0.10, size * 0.55);
    ctx.shadowBlur = 0;
    // crossguard
    ctx.fillStyle = '#ffd400';
    ctx.fillRect(-size * 0.18, size * 0.14, size * 0.36, size * 0.06);
    // handle
    ctx.fillStyle = '#3a2310';
    ctx.fillRect(-size * 0.05, size * 0.20, size * 0.10, size * 0.18);
    // green frog dot on pommel (it's a frog sword)
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(0, size * 0.40, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- drawWoodTile / drawHedgeTile (light texture passes) --------------
  function drawWoodTile(ctx, px, py, size) {
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(px, py, size - 1, size - 1);
    // plank lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py + size * 0.50); ctx.lineTo(px + size - 1, py + size * 0.50);
    ctx.stroke();
    // grain dots
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(px + size * 0.20, py + size * 0.20, 1, 1);
    ctx.fillRect(px + size * 0.70, py + size * 0.65, 1, 1);
  }

  function drawHedgeTile(ctx, px, py, size) {
    ctx.fillStyle = '#1c4a1c';
    ctx.fillRect(px, py, size - 1, size - 1);
    // leafy speckles
    ctx.fillStyle = '#2f6e2f';
    for (let i = 0; i < 5; i++) {
      const fx = px + ((i * 17) % size);
      const fy = py + ((i * 29) % size);
      ctx.fillRect(fx, fy, 2, 2);
    }
    ctx.fillStyle = '#0e3010';
    ctx.fillRect(px + size * 0.15, py + size * 0.65, 2, 2);
    ctx.fillRect(px + size * 0.65, py + size * 0.15, 2, 2);
  }

  // ---- Expose ------------------------------------------------------------
  PRY.SPRITES = {
    SKIN_COLORS,
    HAIR_COLORS,
    CLOTH_PALETTE,
    CLOTH_KEYS,
    HAIR_STYLES,
    defaultAppearance,
    drawCharacter,
    drawOgre,
    drawSwordPickup,
    drawWoodTile,
    drawHedgeTile,
  };
})();
