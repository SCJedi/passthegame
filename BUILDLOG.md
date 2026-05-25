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
