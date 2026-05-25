# Pass The Game — Build Plan

A small game built collaboratively, one prompt at a time, through Claude Code.
Each step below is intentionally under-specified. The person whose turn it is makes the real call.

---

## Build Order

Each step is one human turn. Do them in order. Skip a step only if it truly doesn't apply.

1. **Concept** — name the game in 1–2 sentences. Genre, vibe, core verb.
2. **Stack** — pick language/runtime (Python CLI, HTML+JS, terminal curses, etc.). Smallest thing that fits step 1.
3. **Scaffold** — create the folder + entry file. It should run and print *something*.
4. **State** — define the data the game tracks (board, score, player, world).
5. **Loop** — wire the main tick/turn loop. Game advances but does nothing interesting yet.
6. **Input** — how the player acts (keypress, click, command). State must change in response.
7. **Rules** — win / lose / scoring. The game can now end.
8. **Render** — how state is shown to the player. Legible, not pretty.
9. **One feature** — add exactly ONE thing beyond minimum (enemy, level 2, sound, animation, anything).
10. **Playtest + fix one thing** — run it, find the most broken/awkward thing, fix only that. Done.

---

## Rules

- **One prompt per turn.** Whoever's up types one prompt. Claude builds. Done.
- **One correction allowed.** If the result has a real problem (broken, wrong direction, misread), the same person gets ONE follow-up prompt to fix it. Then turn passes regardless.
- **No reaching back.** Earlier steps are locked. If step 4 made a weird choice, step 5 lives with it. Build forward.
- **The turn-taker decides.** No consensus, no committee. The person prompting picks the direction. Others watch.
- **Skip is legal.** Say "skip" and pass the turn.
- **Stop at 10.** Don't extend past playtest. Ship the ugly thing.

---

## BUILDLOG Mechanism (baked in)

Every turn, Claude appends one line to `BUILDLOG.md`:

```
Turn N (Step X) — [person]: [prompt summary] → [what got built]
```

**This is non-negotiable.** Every prompt the human types should start with their name, e.g.:

> "Eric: let's make this a roguelike where you play as a librarian."

Claude reads that, builds the thing, then appends the log line at the end of the turn.

If a correction is used, log it as a sub-line:

```
Turn N (Step X) — [person]: [prompt summary] → [what got built]
  └ correction: [what was wrong] → [what got fixed]
```

The buildlog is the only durable record of who built what. It's how we see the chain afterward.

---

## Claude's job each turn

1. Read the human's prompt (which starts with their name).
2. Identify which step number we're on (check BUILDLOG.md for the last turn).
3. Build whatever the prompt asks — make tasteful default choices, don't ask questions unless truly blocked.
4. Append a line to BUILDLOG.md.
5. Tell the next person it's their turn and what step they're on.

If a step is being skipped, still log it: `Turn N (Step X) — [person]: SKIP → no change`.
