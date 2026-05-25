# passthegame

A small game, built one prompt at a time, by a group passing the keyboard around inside a single Claude Code session.

Like the game where each person says one word in a sentence until the sentence is done — but for building a game.

---

## How to start

1. **Clone the repo** into your local Projects folder:
   ```
   git clone https://github.com/SCJedi/passthegame.git
   cd passthegame
   ```

2. **Open it in Claude Code.**

3. **Read `PLAN.md`** — the build skeleton and rules.

4. **Person 1 starts Step 1: name the game.**
   Type something like:
   > "Eric: name the game. It's a tiny roguelike where you play as a librarian shushing demons."

5. Claude builds, appends to `BUILDLOG.md`, and announces the next person + next step.

6. Go around the room. One prompt per person. One correction allowed if something's broken. Then pass.

---

## Files

- `PLAN.md` — the 10-step skeleton + rules
- `BUILDLOG.md` — append-only record of every turn (Claude maintains this)
- `README.md` — you are here

---

## Rules in one paragraph

10 steps. One prompt per person per step. If the result is broken, the same person gets one correction. Then turn passes. No reaching back to redo earlier steps. The turn-taker decides; no committee. Stop at step 10.
