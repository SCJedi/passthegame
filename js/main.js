(() => {
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');

  // WASD aliases for arrows; space for A; (B has no keyboard alias to avoid Shift edge cases)
  const KEY_ALIASES = {
    'w': 'ArrowUp', 'W': 'ArrowUp',
    'a': 'ArrowLeft', 'A': 'ArrowLeft',
    's': 'ArrowDown', 'S': 'ArrowDown',
    'd': 'ArrowRight', 'D': 'ArrowRight',
    ' ': 'z', 'Z': 'z',
    'X': 'x'
  };
  const canonical = (k) => KEY_ALIASES[k] || k;

  const buttons = Array.from(document.querySelectorAll('.btn'));
  const btnByKey = new Map();
  buttons.forEach(b => btnByKey.set(b.dataset.key, b));

  function setActive(key, on) {
    const btn = btnByKey.get(canonical(key));
    if (btn) btn.classList.toggle('active', on);
  }

  // Keyboard
  const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);
  window.addEventListener('keydown', (e) => {
    setActive(e.key, true);
    if (PREVENT.has(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => setActive(e.key, false));

  // Pointer events cover mouse + touch + pen
  buttons.forEach(b => {
    const press   = (e) => { e.preventDefault(); b.classList.add('active'); };
    const release = (e) => { e.preventDefault(); b.classList.remove('active'); };
    b.addEventListener('pointerdown',   press);
    b.addEventListener('pointerup',     release);
    b.addEventListener('pointerleave',  release);
    b.addEventListener('pointercancel', release);
  });

  // ---- Canvas attract screen ----
  function fitCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.floor(rect.width  * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  let t = 0;
  function frame() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    // Subtle scanlines for arcade vibe
    ctx.strokeStyle = 'rgba(255, 43, 214, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Title — neon "PRY" with flicker
    const cx = w / 2;
    const cy = h * 0.42;
    ctx.font = `${Math.floor(h * 0.22)}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const flicker = 0.85 + Math.sin(t * 0.08) * 0.08 + (Math.random() < 0.02 ? -0.3 : 0);
    ctx.shadowColor = '#ff2bd6';
    ctx.shadowBlur  = 28 * Math.max(0.2, flicker);
    ctx.fillStyle   = '#ff2bd6';
    ctx.fillText('PRY', cx, cy);

    // Bright inner pass
    ctx.shadowBlur = 0;
    ctx.fillStyle  = 'rgba(255, 255, 255, 0.65)';
    ctx.fillText('PRY', cx, cy);

    // Blinking subtitle
    ctx.font = `${Math.floor(h * 0.035)}px 'Press Start 2P', monospace`;
    if (Math.floor(t / 30) % 2 === 0) {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = '#00f0ff';
      ctx.fillText('PRESS ANY KEY', cx, h * 0.78);
      ctx.shadowBlur = 0;
    }

    t++;
    requestAnimationFrame(frame);
  }
  frame();
})();
