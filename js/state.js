// State module for Pry — defines every data shape and builds the initial world.
// Pure data + catalogs. No rendering, no input, no battle logic.
//
// Anything ambiguous in Sofia's spec was resolved with a tasteful default and noted inline.

(() => {
  // ---- Tile types --------------------------------------------------------
  const TILE = Object.freeze({
    WOOD:  'wood',    // brown wooden floor (safe)
    CRACK: 'crack',   // cracked wood — stepping here triggers a pit fall
    HEDGE: 'hedge',   // wall (looks like a hedge when rendered)
    TUBE:  'tube',    // post-victory exit tube (appears after ogre defeat)
  });

  // ---- Enemy catalog -----------------------------------------------------
  const ENEMIES = {
    ogre: {
      id: 'ogre',
      name: 'Bridge Ogre',
      hp: 30, attack: 8,
      intro: '"Always heard of an ogre under a bridge — well, this is an ogre under some wood. Hahahaha!"',
      onDefeat: { spawnTube: true },  // funny suck-up-to-land cutscene
      isFirstBattle: true,
    },
    spider_stones: {
      id: 'spider_stones',
      name: 'Spider Stones',
      hp: 20, attack: 5,
      onDefeat: { dropChest: true },
    },
    helpful_hedgehog: {
      id: 'helpful_hedgehog',
      name: 'Helpful Hedgehog',
      hp: 40, attack: 10,
      twist: 'Cute on approach. Huge on engagement.',
    },
    gentle_gorilla: {
      id: 'gentle_gorilla',
      name: 'Gentle Gorilla',
      hp: 50, attack: 12,
      twist: 'Name is a lie.',
    },
  };

  // ---- Item catalog ------------------------------------------------------
  // Frog Sword: damage = frogCount * 2. Start with 2 frogs; max 15.
  // "+1 frog per level, with half-frog levels mixed in" → simple deterministic curve:
  function frogsAtLevel(level) {
    return Math.min(15, 2 + Math.floor((level - 1) / 2));
  }

  const ITEMS = {
    frog_sword: {
      id: 'frog_sword',
      type: 'weapon',
      name: 'Frog Sword',
      damagePerFrog: 2,
      maxFrogs: 15,
      // current damage = state.player.frogCount * damagePerFrog
    },
    force_shield: {
      id: 'force_shield',
      type: 'defense',
      name: 'Force Shield',
      rarity: 'rare',                  // only found at high player level
      blockDamage: 5,                  // reduces each incoming hit by 5
      blocksEnemyTurns: 2,             // lasts 2 enemy turns
      usesPerBattle: 1,
      attackAllowedWhileActive: true,
    },
    poopoo: {
      id: 'poopoo',
      type: 'attack_consumable',
      name: 'Poopoo',
      stunRounds: 1,
      usesPerRound: 1,
      cutscene: 'poopoo_transform',    // cute → violent (funny, not scary). Enter skips.
    },
    peach_drop: {
      id: 'peach_drop',
      type: 'heal_consumable',
      name: 'Tiny Peach',
      heal: 5,
    },
    blueberry: {
      id: 'blueberry',
      type: 'heal_consumable',
      name: 'Blueberry',
      heal: 10,
    },
    redberry: {
      id: 'redberry',
      type: 'cursed_consumable',
      name: 'Redberry',
      effectIfEaten: {
        cutscene: 'redberry_bumps',    // red bumps + balloon puff + dazed look
        attackDamageDebuff: 3,
        durationRounds: 'rest_of_battle', // tasteful default — spec didn't say
      },
      tradeable: true,
    },
  };

  // ---- Power-ups (player transformations) --------------------------------
  const POWERUPS = {
    mario: {
      id: 'mario',
      name: 'Mario',
      effect: 'Player resembles and behaves like the Mario character (jump, stomp, etc.).',
    },
    peach: {
      id: 'peach',
      name: 'Giant Peach',
      effect: 'Player becomes a literal giant peach.',
      attack: 'bulldoze',
      onKillExplodeIntoPeaches: { min: 4, max: 5 }, // tiny peaches drop; each heals 5 hp
    },
  };

  // ---- Trade economy (acorn-guy NPCs) ------------------------------------
  const ACORN_TRADES = {
    blueberry:  { cost: { redberry: 5 } },
    peach_drop: { cost: { redberry: 3 } },
  };

  // ---- Levels ------------------------------------------------------------
  // Level 1 is the wood-floor room. Hedge walls all around, one cracked tile
  // that triggers the ogre (first-battle "just kidding" cutscene applies).
  // Frog Sword pickup sits right next to player start — "very easy to spot."
  function buildLevel1() {
    const W = 10, H = 8;
    const tiles = Array.from({ length: H }, (_, y) =>
      Array.from({ length: W }, (_, x) => {
        if (y === 0 || y === H - 1 || x === 0 || x === W - 1) return TILE.HEDGE;
        return TILE.WOOD;
      })
    );
    tiles[4][5] = TILE.CRACK;   // the trap floor

    return {
      id: 1,
      name: 'The Wooden Floor',
      width: W,
      height: H,
      tiles,
      playerStart: { x: 1, y: 1 },
      pickups: [
        { x: 2, y: 1, item: 'frog_sword' },
      ],
      npcs: [],     // acorn vendors arrive in later levels
    };
  }

  // ---- Initial state factory ---------------------------------------------
  function initialState() {
    return {
      mode: 'attract',  // 'attract' | 'explore' | 'battle' | 'cutscene' | 'gameover'
      player: {
        x: 1, y: 1,
        hp: 100, maxHp: 100,
        level: 1, xp: 0,
        frogCount: frogsAtLevel(1),   // 2 frogs at start
        transform: null,               // null | 'mario' | 'peach'
        inventory: {
          frog_sword: false,           // becomes true on pickup
          force_shield: 0,
          poopoo: 0,
          peach_drop: 0,
          blueberry: 0,
          redberry: 0,
        },
        flags: {
          firstBattleSeen: false,      // gates the "just kidding!" rainbow cutscene
        },
      },
      level: buildLevel1(),
      battle: null,
      // battle shape (when active):
      // { enemyId, enemyHp, enemyMaxHp, turn: 'player'|'enemy',
      //   shieldRoundsLeft, stunRoundsLeft, debuffs: { attackMinus: 0 } }
      cutscene: null,
      // cutscene shape: { kind, frame, skippable: true }
      ui: {
        skipCutsceneKey: 'Enter',
      },
    };
  }

  // ---- Expose to the rest of the app -------------------------------------
  window.PRY = {
    TILE,
    ENEMIES,
    ITEMS,
    POWERUPS,
    ACORN_TRADES,
    frogsAtLevel,
    initialState,
    state: initialState(),
  };

  // Sanity log — proves the world loaded. Render will replace this in step 8.
  const s = window.PRY.state;
  console.log(
    '[Pry] world loaded:',
    `level ${s.level.id} "${s.level.name}" (${s.level.width}x${s.level.height})`,
    `/ player @ (${s.player.x},${s.player.y}) hp ${s.player.hp}/${s.player.maxHp}`,
    `/ frog sword dmg ${s.player.frogCount * ITEMS.frog_sword.damagePerFrog}`,
    `/ enemies: ${Object.keys(ENEMIES).length}`,
    `/ items: ${Object.keys(ITEMS).length}`,
  );
})();
