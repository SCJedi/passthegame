# BUILDLOG

Append-only record of every turn. One line per turn. Claude maintains this.

Format:
```
Turn N (Step X) — [person]: [prompt summary] → [what got built]
  └ correction: [what was wrong] → [what got fixed]   (only if used)
```

---

<!-- Turns go below this line. Newest at the bottom. -->
