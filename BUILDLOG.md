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
Turn 4 (Step 4) — Sofia: wood floors w/ cracked-tile pit, ogre first-battle w/ rainbow "just kidding" cutscene, enemies (spider stones, helpful hedgehog, gentle gorilla), power-ups (mario, giant peach), items (frog sword scaling w/ level, force shield, poopoo, blueberries, redberries, peach drops), 100 hp, acorn-guy trade economy → wrote js/state.js with full catalogs (TILE, ENEMIES, ITEMS, POWERUPS, ACORN_TRADES), level 1 tile grid (hedge walls + cracked-floor trap + frog-sword pickup at start), initial player state, battle/cutscene state shape stubs. Exposed as window.PRY. Console logs world summary on load. No render/battle/cutscene logic yet — comes in later steps.
