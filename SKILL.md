---
name: yalda-anar
description: A Yalda-night-themed Suika-style drop-and-merge PWA game (vanilla JS, custom circle physics, Persian RTL) that teaches how to build an installable offline fruit-merge game.
---

# یلدائنار (Yalda Anar)

## What this skill gives the model

After reading this skill, the model understands:

- the genre and core loop of **یلدائنار**: a 2D physics drop-and-merge game (Suika / watermelon style) with a Persian winter-solstice (شب یلدا) theme
- the exact mechanics: dropper, gravity, custom circle-circle collision resolution, same-size merging, danger-line game-over, scoring
- the controls (touch + keyboard + mouse) and how they unify through Pointer Events
- the PWA structure required (manifest, service worker, icon) and the file layout
- that the physics is implemented from scratch — **no Matter.js, no Box2D, no CDN** — so the file is fully self-contained and offline-first

## Game design

یلدائنار is a Persian festive re-imagining of the Suika fruit-drop genre. The board is a wooden bowl sitting under a deep purple Yalda-night sky dusted with gold stars and a faint crescent moon. The player drops Persian fruits from a dropper that slides above the bowl; when two fruits of the same size touch, they merge into the next-larger fruit and the player scores points. The seven-step chain runs from pistachio to pomegranate, and the pomegranate (انار) is the symbolic climax of Yalda — reaching it triggers a celebratory "انار!" pop, but the game continues so the player can keep stacking.

The visual identity is built entirely from canvas primitives — radial gradients for shading, four-point gold crosses for stars, brown arcs and a rim ellipse for the wooden bowl, and per-fruit detail (a slit on the pistachio, a pointed oval inside the almond, a textured seam on the walnut, a rounded-rectangle date body, segment lines and a leaf on the tangerine, and a crown of gold triangles plus seed dots on the pomegranate). No external images and no external fonts are used; the UI is Persian, laid out right-to-left, and rendered with `system-ui, "Segoe UI", Tahoma, sans-serif`.

The objective is to grow fruits toward the pomegranate and rack up the highest score before the bowl overflows. The danger is a dashed gold line near the rim: if any settled fruit pokes above it for more than 1.5 seconds, the game ends. Best score persists in `localStorage` under the key `yaldaAnar.best`. Difficulty ramps gently — the drop cooldown shortens as the score climbs, so drops come a little faster the better the player is doing.

The art direction favours a deep night-blue/purple vertical gradient (`#0a0420 → #2a0f4a`), gold (`#e8b73c`) for accents, the danger line, stars and the pomegranate crown, warm browns for the wooden bowl, and a saturated red (`#c8102e`) for the pomegranate itself. Particle pops on merges use the merged fruit's highlight colour and gold.

## Mechanics in detail

- **Fruit chain (7 sizes, 0-indexed 0–6):** پسته (pistachio, r≈13) → بادام (almond, r≈18) → گردو (walnut, r≈24) → انجیر (fig, r≈31) → خرما (date, r≈39) → نارنگی (tangerine, r≈48) → انار (pomegranate, r≈58). Mass is proportional to radius.
- **Spawning:** the dropper only ever spawns sizes 0–4 (pistachio … خرما), weighted toward smaller fruits. A "next" preview shows the fruit queued after the current one.
- **Physics (custom, in `main.js`):** each frame applies gravity (`vy += GRAVITY*dt`), velocity damping, integration, then wall resolution against the bowl's left/right/floor lines with restitution and floor friction. Circle-circle collisions run for `ITER` iterations per sub-step: positional correction pushes pairs apart along the contact normal weighted by inverse mass, and an impulse along the normal (restitution `FRUIT_E`) plus a small tangent friction impulse dampens relative motion. Two physics sub-steps per frame keep it stable.
- **Merging:** after resolution, any pair of same-size fruits whose centres are within `r1+r2+1` px merge into a single fruit of `size+1` at the midpoint, with a small upward pop velocity, a particle burst, and `+score` where `score = (newSizeIndex+1)*10`. So two نارنگی (size 6) → انار (size 7) awards 70. Two انار merge into nothing with a `+200` gold burst.
- **Scoring & best:** `score` accumulates; `best` is loaded from / saved to `localStorage['yaldaAnar.best']` whenever `score` exceeds it.
- **Danger line:** at `BOWL.top` (≈150 px). Any fruit older than ~1.2 s that is nearly at rest (`|vy| < 2.2`) and whose top edge rises above the danger line adds to an `overTimer`; if it stays above for more than 1500 ms continuously, game over. Freshly dropped fruits get a grace window so a fruit still in flight never ends the game.
- **Difficulty ramp:** `currentCooldown = max(MIN, BASE - score/8)` — drops accelerate gently as the score grows (BASE≈620 ms, MIN≈360 ms).
- **Celebration:** the first time an انار is created, a fading "انار!" banner appears with an extra gold particle burst.

## Controls

- **Touch (375 px portrait):** drag horizontally anywhere over the board to slide the dropper; a quick tap (small movement, short duration) drops the current fruit. `touch-action: none` on the canvas prevents page scroll.
- **Keyboard:** Left / Right arrows slide the dropper; Space / Enter / ArrowDown drops; Esc or P pauses/resumes; Space/Enter also starts and retries.
- **Mouse:** mouse-move positions the dropper; click drops (a click is treated as a zero-movement tap). Buttons in the HUD and overlays work with both mouse and touch.

## File layout

- `index.html` — Persian RTL entry point (`lang="fa" dir="rtl"`), links the manifest, stylesheet and `main.js`, registers `sw.js`, holds the HUD and overlay screens.
- `styles.css` — responsive layout (flex column, `100dvh`, safe-area insets, `max-width: 480px`), deep-purple theme, overlay styling.
- `main.js` — the whole game: setup, drawing, custom physics, input (Pointer Events + keyboard), screens, loop. No dependencies.
- `manifest.json` — PWA manifest with `start_url: "./"`, `scope: "./"`, `orientation: "portrait"`, an `icon.svg` icon entry.
- `sw.js` — service worker that precaches the shell (`./`, `index.html`, `styles.css`, `main.js`, `manifest.json`, `icon.svg`) and serves them cache-first.
- `icon.svg` — a red pomegranate with a gold crown on a deep-purple background, also used as the maskable icon.

## How to run / deploy

1. Open `index.html` directly in a browser, OR
2. Push the folder to a GitHub repo and enable Pages — the game runs from the repo root or a subfolder because every path is relative.

## PWA install

The manifest + service worker make the game installable on Android, iOS and desktop. After the first load the shell is cached, so the game runs fully offline.

## Customization hooks

All tunables live at the top of `main.js`:

- `GRAVITY`, `WALL_E`, `FRUIT_E`, `DAMP`, `FLOOR_FRICTION`, `ITER`, `POS_CORR` — physics feel.
- `DROP_COOLDOWN_BASE`, `DROP_COOLDOWN_MIN` — drop pacing / difficulty.
- `DANGER_GRACE`, `DANGER_LIMIT` — how forgiving the overflow rule is.
- `FRUITS` array — each fruit's `name`, radius (`r`) and colour palette (`fill`/`dark`/`hi`); add or reorder to change the chain.
- `BOWL` (`left`, `right`, `floor`, `top`, `rimY`) and `DROPPER_Y` — play-field geometry.
- `SPAWN_MAX` and the `weights` array in `randSize()` — which sizes the dropper emits and how often.
- In `styles.css` the gradient / palette colours for the night sky, gold accents and bowl wood.
