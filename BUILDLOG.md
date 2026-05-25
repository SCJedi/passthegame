# BUILDLOG

Append-only record of every turn. One line per turn. Claude maintains this.

Format:
```
Turn N (Step X) — [person]: [prompt summary] → [what got built]
  └ correction: [what was wrong] → [what got fixed]   (only if used)
```

---

<!-- Turns go below this line. Newest at the bottom. -->

Turn 1 (Step 1) — Eric: top-down 2D maze, power-ups, multi-solution levels, tutorial single-exit levels that teach item use → named the game **Pry**, wrote CONCEPT.md (genre: top-down 2D puzzle-maze; vibe: minimalist MacGyver-in-a-room; core verb: PRY)
Turn 2 (Step 2) — Sofia: HTML5 + vanilla JS + Canvas 2D + PNG spritesheets → wrote STACK.md (no build step; runs by opening index.html)
Turn 3 (Step 3) — Eric: dark mode, neon 80s arcade attract screen, on-screen touch/click arcade controls that light up when matching keys are pressed → scaffolded index.html + css/style.css + js/main.js. Neon "PRY" title with flicker + scanlines + blinking "PRESS ANY KEY". D-pad (arrows/WASD) and A/B buttons (Z/Space, X), keyboard + pointer (mouse/touch) both light the same buttons.
