# stages: hand-built product demos

A stage is a small, authored product UI demo: a cropped, bled window in the
product's own look, 3 to 7 real strings, placeholder bars elsewhere, a drawn
cursor that does one thing per beat, and a payoff that holds. This folder is
the kit (`stagekit.js`, `stagekit.css`), two product looks, a harness and one
throwaway example. No build step and no dependencies: plain DOM, CSS and ES
modules.

Read the Stageshow references (stage-ui skill,
`references/upstream/benjitaylor-stageshow/`: `craft.md`, `motion.md`,
`framing.md`, `looks.md`) for the design rules. This file covers the code.

| File | What it is |
| --- | --- |
| `stagekit.js` | runtime: stage, cursor, timeline, director, typing, keycaps, bars, window chrome, glass browser window, screenshot layers, lift |
| `stagekit.css` | tokens (`--sk-*`), light and dark, and every small part |
| `look-designlayer.css` | Design Layer editor, dark (`.look-designlayer`) |
| `look-appbuilder.css` | App builder, Luminous light (`.look-appbuilder`) |
| `specimen.html` | every part in both looks at 1:1 |
| `preview.html` | `?stage=<name>` loads `./<name>.js` and drives it |
| `demo-smoke.js` | the smallest stage that obeys the contract; copy its shape |
| `film.mjs` | screenshots and frame sequences with Playwright |
| `LICENSES.md` | third-party material (Material Symbols glyphs, Stageshow) |

## The stage module contract

One file per stage: `stages/<name>.js`.

```js
export const meta = {
  name: "edit",
  width: 1000, height: 600,                         // design size in px; the host scales it to fit
  compact: { below: 560, width: 358, height: 420 }, // second design for phone columns (host width < 560)
  beats: ["Direct edit", "Align", "Measure", "Hide"], // beat names, in order
  poster: 3,                                        // the beat whose rest frame tells the story alone
  theme: "dark",                                    // or "light"
}

export function mount(root) {   // root: an empty element; the stage fills its width
  return {
    set(beat, { instant = false } = {}), // go to beat k (see Beats)
    play(), pause(),                     // pause freezes a running act; play resumes
    destroy(),
  }
}
```

### Beats

- Every beat k has an **act** (the gesture: cursor travel, a click, typing, a
  key) and a **rest** (the state after it, with the beat's payoff on screen).
- The stage mounts on the **opening still**, `rest(-1)`: a finished,
  believable screen with nothing happening.
- `set(k)` from `k - 1` plays `act(k)` on a timeline, then holds at `rest(k)`.
- Any other transition (a jump forward by more than one, a step back, or
  `instant: true`) cancels a running act and moves the DOM to `rest(k)` with
  short transitions of about 300 ms and no cursor act. A step back is the
  viewer's own step: nothing plays backwards, the earlier rest state returns.
- Under `prefers-reduced-motion: reduce` every `set` is instant, with no
  transitions at all.
- Rest states never contain anything mid-change.
- Between beats the cursor rests on empty surface near its next move, and
  fades after 4 s of rest.
- Beats are clamped to `-1 .. beats.length - 1`.

### Write a stage with `director`

`director()` implements the contract above so every stage behaves the same.
You write three functions; `mount` returns what `director` returns.

```js
import { createStage, director, windowChrome, bar, bars, keycaps } from "./stagekit.js"

export const meta = { /* as above */ }

export function mount(root) {
  const stage = createStage(root, meta, { className: "look-designlayer my-stage" })
  let ui = {}

  // Build the DOM for a layout. Called on mount and when wide <-> compact switches.
  function render(layout) {
    stage.scene.querySelector(".win")?.remove()
    const win = windowChrome({ title: "Website", sidebar: layout === "compact" ? 96 : 180 })
    win.classList.add("win", "sk-hero")
    // ... fill win.body, keep references in ui
    stage.scene.append(win)
    ui = { win /* , button, rows ... */ }
  }

  // Put the DOM in beat k's rest state. Idempotent: same k, same DOM.
  // Unless via is "act", also place the hidden cursor at k's rest spot.
  function rest(k, { instant, via }) {
    ui.win.toggleAttribute("data-published", k >= 0)
    if (via !== "act") stage.cursor.at({ x: 600, y: 380 })
  }

  // Play beat k's gesture. Every DOM change goes through a.step(), or a kit
  // call given a.signal, so a cancel never leaves a half-done change behind.
  async function act(k, a) {
    const c = stage.cursor
    if (k === 0) {
      c.kind("arrow").show()
      await c.moveTo(ui.button, { signal: a.signal })
      await c.press(ui.button, { signal: a.signal })
      a.step(() => ui.win.setAttribute("data-published", ""))
      await a.wait(400)
      await c.moveTo({ x: 600, y: 380 }, { dur: 700, signal: a.signal }) // rest spot near the next move
    }
  }

  return director(stage, { render, rest, act, beats: meta.beats })
}
```

How `director` calls you:

| Moment | Call |
| --- | --- |
| mount | `render(layout)`, then `rest(-1, { instant: true, via: "mount" })` with transitions off |
| `set(k)` from `k - 1` | `act(k, a)`, then `rest(k, { instant: false, via: "act" })`, then `cursor.rest()` |
| any other `set` | cancel, `cursor.hide()`, `rest(k, { instant: false, via: "jump" })` (your CSS transitions run, keep them about 300 ms) |
| reduced motion | as above, with `instant: true` and every transition off for that frame |
| layout switch | cancel, `cursor.hide()`, `render(layout)`, `rest(current, { instant: true, via: "layout" })` |

Drive rest states with attributes and classes on your own elements, and put
the transitions in your stage's CSS. `.sk-stage[data-sk-instant]` turns every
transition off for one frame; the director sets it, so you do not need to.

Scope your CSS under your stage's class (`.my-stage .win { ... }`), and the
compact design under `.my-stage[data-layout="compact"]` (`createStage` puts
both the class and `data-layout` on `root`). `@keyframes` go outside. A
`<style>` element appended to `root` in `mount` and removed in `destroy` is
fine (see `demo-smoke.js`).

## The kit API (`stagekit.js`)

```js
export const reduced   // like a MediaQueryList for prefers-reduced-motion: reduce; .matches,
                       // addEventListener("change", fn). Also true while <html data-sk-reduced>.
export function forceReduced(on)  // harness only: sets/clears <html data-sk-reduced>
export const ease = {
  travel:   "cubic-bezier(0.45, 0, 0.1, 1)",   // storytelling travel (cursor, flights)
  arrive:   "cubic-bezier(0.25, 0.8, 0.25, 1)", // arrival from nowhere, 0.8 to 1 s
  feedback: "cubic-bezier(0.4, 0, 0.2, 1)",    // UI feedback, as quick as the product
}
```

### `createStage(root, meta, { className })`

Puts `.sk-stage` (plus `className`) and `data-theme` on `root`; `root` gets
`overflow: hidden` and an `aspect-ratio` from the active design. Creates
`root > .sk-scene` at the design size, scaled with a transform to fit
`root`'s width (ResizeObserver). Picks the compact design when `root` is
narrower than `meta.compact.below` and sets `root.dataset.layout` to `"wide"`
or `"compact"`.

Returns `{ scene, root, meta, layout, scale, design, onLayout(cb), rect(el), cursor, destroy() }`:

- `scene`: draw everything in it, in design px.
- `layout`, `scale`, `design`: live getters.
- `onLayout(cb)`: `cb(layout)` on a wide/compact switch; returns an unsubscribe. `director` uses it for you.
- `rect(el)`: `{ x, y, width, height }` of an element in scene px (unscaled).
- `cursor`: the scene's one cursor, created on first use.

### `createCursor(scene, { kind = "arrow" })`

One `.sk-cursor` per scene, positioned in scene px, hidden until shown. Use
`stage.cursor` rather than calling this. Kinds: `"arrow"` (the macOS arrow
from `styles.css` `.cue-hand`, tip is the hotspot), `"hand"` (pointer,
fingertip is the hotspot), `"ibeam"` (center is the hotspot; white with a dark
edge on a dark stage). The cursor re-attaches itself to the scene if your
`render` cleared it.

| Method | Does |
| --- | --- |
| `show()`, `hide()` | fade in / out (240 ms) |
| `at(target, at?)` | snap, no travel. `target`: `{ x, y }` or an element |
| `moveTo(target, { at = { x: 0.85, y: 0.6 }, dur = 900, ease = ease.travel, signal })` → Promise | travel on a shallow arc. An element is aimed at the fraction `at` inside it, off its text |
| `press(target?, { signal })` → Promise | 90 ms down: the cursor scales 0.92 about its hotspot and `target` gets `data-press` for 120 ms; then up |
| `kind(name)` | morph by a 120 ms fade-scale, never a pop. `kind()` returns the current kind |
| `rest(ms = 4000)` | start the idle fade; any move, `at` or `press` cancels it |

Pick the kind from what is under it: an arrow on native buttons, an I-beam
over text you will select or type into, a hand on links. Switch it as the
cursor crosses the edge (`c.kind("ibeam")` partway through a move), never
after it arrives.

### `timeline()`

`{ run(fn) → Promise, cancel(), pause(), resume(), paused, running }`.
`fn(act)` gets `act = { wait(ms), step(cb), signal }`:

- `wait(ms)` resolves early once cancelled; while paused it stretches until resume.
- `step(cb)` runs `cb` only if the run is still live.
- A new `run()` cancels the previous one.
- `moveTo`, `press` and `typeInto` given `act.signal` pause and cancel with the run (their timers and Web Animations).
- CSS transitions already running finish on their own when paused; keep them short.

`director` owns one timeline; use `timeline()` directly only for a stage that
needs something the director does not do.

### `director(stage, { render, rest, act, beats })`

See "Write a stage with director". Returns `{ set, play, pause, destroy, beat }`.
`destroy()` also destroys the stage.

### `typeInto(el, text, { cps = 14, caret = true, keepCaret = false, signal })` → Promise

Letters land one at a time. A `.sk-caret` sits after the last letter, solid
while typing and blinking at rest; it is removed when done unless `keepCaret`.
In a field, type into its `.sk-field-text`.

### Small parts

```js
keycaps(["⌘", "."])        // DocumentFragment of kbd.sk-keycap. Put it in a .sk-keys box
                           // (bottom-center of the scene); toggle data-show on the box
bar(w, { ink = 3, height }) // span.sk-bar; w is px (number) or a CSS length ("60%"); ink 1..5
bars([60, 45, 70, 52])     // div.sk-bars of bars at the 12px text pitch; numbers are %
windowChrome({ url, title, theme, sidebar }) // div.sk-window with .bar, .body, .side properties
inView(root, { onEnter, onLeave, rootMargin = "0px", threshold = 0.25 }) // returns unobserve
```

`windowChrome`: a 38 px bar with three 12 px traffic lights 8 px apart,
centered 19 px from the left and top (Stageshow's rule: as far from the left
as their center is from the top). `url` gives a centered URL pill; `title` a
centered 13 px title. `sidebar: 180` gives a full-height sidebar holding the
lights; the content column is the surface and its title sits at 16 px. Size
and place the window with your own CSS (it is `position: absolute`). Add
`sk-hero` for the hero shadow.

## CSS parts (`stagekit.css`)

All scoped under `.sk-stage`. Put `data-hover`, `data-press`,
`data-selected`, `data-on`, `data-focus` and `data-show` on parts to change
their state.

| Class | Notes |
| --- | --- |
| `.sk-window` `-bar` `-lights` `-title` `-pill` `-body` `-side` `-main` | from `windowChrome()` |
| `.sk-bar`, `.sk-bars` | 8 px line, radius 4, `--w` width, `--ink` color |
| `.sk-list` > `.sk-row` (`.dense`) | grid: `.sk-row-lead` (16 px icon or avatar) / `.sk-row-main` (`.sk-row-title`, `.sk-row-sub`) / `.sk-row-trail`. Padding 12 px, 8 px dense; one-line rows hug `--sk-row`. Hover and selected fills are inset and rounded |
| `.sk-avatar` (`.sm` 20, default 24, `.lg` 28) | named: `style="--c: #7a6ad8"` and an initial; filler: no `--c`, no text |
| `.sk-btn.primary` / `.secondary` / `.ghost` (`.pill`) | 28 px, 12 px label. `data-press` is one step darker, never a gray swap |
| `.sk-field` > `.sk-field-text` | `--sk-control` high; `data-placeholder` on the text; `data-focus` ring never moves text |
| `.sk-caret` | blinks; `data-typing` holds it solid |
| `.sk-menu` > `.sk-menu-item` (`.sk-menu-hint`), `.sk-menu-sep` | raised surface, float shadow, `--sk-row` items |
| `.sk-toggle` | `data-on` |
| `.sk-tabs` > `.sk-tab` | `data-selected` |
| `.sk-badge` | `data-tone="success" / "warning" / "danger" / "neutral"`; default is the accent |
| `.sk-chip` | |
| `.sk-keys` > `.sk-keycap` | the page's own key pill: dark cap, light hairline, 13 px / 600 |
| `.sk-icon` | a 16 px box; fill it from the product's icon set (below) |
| `.sk-satellite` | raised surface, satellite shadow; place it straddling the hero's edge |
| `.sk-leader` | 1 px line ending in a 4 px dot; `--len`, `--angle` |
| `.sk-fade-b`, `.sk-fade-r` | mask fades, length `--sk-fade` (64 px) |
| `.sk-mono` / `.sk-code`, `.sk-num` | monospace only for code; tabular figures in the product's family |

### Tokens

`--sk-canvas --sk-surface --sk-chrome --sk-well --sk-raised`,
`--sk-line --sk-line-faint`, `--sk-text-strong --sk-text --sk-text-faint`,
`--sk-icon --sk-icon-faint`, `--sk-accent --sk-accent-soft --sk-accent-text`
(plus `--sk-accent-fill` and `--sk-on-accent` for the primary button),
`--sk-success --sk-danger --sk-warning` with `-soft`, `--sk-font --sk-mono
--sk-text-size`, `--sk-radius-sm -md -lg -window -pill`, `--sk-control
--sk-row`, `--sk-shadow-hero -window -satellite -ground -float -lift -card`,
`--sk-ink-1` to `-5`, `--sk-fade`. `data-theme="dark"` on `.sk-stage` (or on
any element inside it) switches them. On dark, depth comes from a lighter
surface and shadows are quiet.


## Real-UI stage: screenshot background + lifted unit

The product's real UI is a screenshot inside a glass Chrome window; the one
unit the beat is about is built in DOM at its real size and **lifted** out of
the screenshot to where it reads, then the gesture happens on it.

### Recipe

1. Ground: `.sk-colorfield` fills the scene. Put the window over it with a
   gutter (48 px is a good start) so the glass chrome frosts the field at its
   top corners. The window may run off the bottom or one side.
2. `browserWindow({ title, url, theme })`, sized `width` × `BWIN_CHROME + width * capH / capW`
   so the body has the capture's aspect.
3. `shots(win.body, { width: capW, height: capH, list })`: the screenshot
   layers. Resolve URLs from your module: `new URL("../assets/shots/x.webp", import.meta.url).href`.
4. Build the beat's unit at 1:1, absolutely positioned in `stage.scene` (not
   in the body, which clips). Its natural size is its real product size: 13 px
   text for App builder, 12 px for Design Layer.
5. `lift(unit, { from: layers.rect(region), to: fitRect(size, from, bounds), signal: a.signal })`,
   with `wash(win.body, 0.3)` at the same moment.
6. The gesture (cursor, typing) on the lifted unit.
7. `setDown(unit, { to: layers.rect(region) })` and `wash(win.body, 0)`, or the
   host's cut to the next beat. In `rest(k)`, use `place()` and
   `wash(..., { instant })`, never a lift.

Rules:

- One unit is lifted at a time.
- A lifted unit never covers the thing in the background it is about to act
  on, unless the action happens inside the unit. Pick `around` (and the
  gutter) for `fitRect` so the target stays clear.
- The unit's natural size is the product's size; `fitRect`'s `max` stays at 1
  unless the stage is a deliberate close-up.
- Only the chrome is glass. The body is the solid page (Stageshow,
  craft.md: "only the floating sidebar is glass").

### `browserWindow({ title, url, favicon, theme = "light", width, height, secure = "tune" })` → `.sk-bwin`

Google Chrome for macOS, proportions measured from a 2x capture of Chrome at
1440 wide: a 40 px tab strip and a 40 px toolbar, so `BWIN_CHROME` (exported)
is 80. The chrome is fixed at that size whatever the body's scale. `favicon`
is an image URL, an element, or nothing (Chrome's globe). `secure` is the
omnibox's site glyph, `"tune"` (current Chrome) or `"lock"`. `theme` sets
`data-theme` (light or dark glass). `position: absolute`; place it with
`left`/`top`. Returns the element with `.chrome`, `.tab`, `.url`, `.body`.

| Class | What it is |
| --- | --- |
| `.sk-bwin` | the window: no fill of its own, 12 px radius (`--sk-bwin-radius`), `--sk-shadow-hero` |
| `.sk-bwin-chrome` | glass: `--sk-glass-bar` fill, `backdrop-filter: blur(24px) saturate(1.6)`, rim light on top, `--sk-line` hairline at the bottom |
| `.sk-bwin-tabs` | row 1 (`--sk-bwin-tabs`, 40 px): `.sk-bwin-lights` (12 px, 8 px gaps, centered 19 px from the left, 20 px from the top), `.sk-bwin-tab`, `.sk-bwin-new` (`+`) |
| `.sk-bwin-tab` | the active tab: 240 × 34 px, 10 px top radius and 10 px flares at its foot, `--sk-glass-tab`; `.sk-bwin-fav` (16 px), `.sk-bwin-tab-title` (13 px, fades at its end), `.sk-bwin-tab-close` |
| `.sk-bwin-bar` | row 2 (`--sk-bwin-toolbar`, 40 px): three `.sk-bwin-btn` (back, forward dimmed, reload), `.sk-bwin-url`, a `⋮` `.sk-bwin-btn` |
| `.sk-bwin-url` | the omnibox: a 32 px pill in `--sk-glass-omni`, `.sk-bwin-url-site` (16 px glyph), `.sk-bwin-url-text` (13 px) |
| `.sk-bwin-glyph` | an 18 px Material Symbols path (see `LICENSES.md`); never draw one by hand |
| `.sk-bwin-body` | the page: `position: relative`, `overflow: hidden`, bottom corners rounded, `--sk-surface` |
| `.sk-colorfield` | the ground: `linear-gradient(135deg, --sk-field-a, --sk-field-b)` plus a faint 16 px dot grid (`--sk-field-dot`) that the glass visibly frosts. Not `.sk-field`: that is the text field |

Glass tokens (set by the theme, overridable by a look): `--sk-glass-bar`,
`--sk-glass-omni`, `--sk-glass-tab` (three steps, each more opaque),
`--sk-glass-rim`, `--sk-glass-blur`, `--sk-field-a`, `--sk-field-b`,
`--sk-field-dot`, `--sk-wash`. Design Layer: field `#07080c` → `#101424`,
dark glass. App builder: field `#eef4fa` → `#f7f8fb`, light glass.

### `shots(body, { width, height, list })` → `{ show(id, { instant, ms = 320 }), rect(r), el, current }`

`list` is `{ id: url }`; `width` × `height` is the capture's size in px. One
`img.sk-shot` per id fills the body (`object-fit: cover`, top-anchored),
`decoding="async"`; the first is eager and shown at once, the rest lazy.
`show(id)` crossfades: the incoming layer fades in over the outgoing one,
which stays opaque underneath until the fade ends; `instant` snaps. `show`
also warms the next id in `list` (eager load and `decode()`). `rect({ x, y, w, h })`
maps a capture-px rectangle to scene px from where the body is now; the
whole body is `rect({ x: 0, y: 0, w: width, h: height })`.

### `wash(body, level, { ms = 320, instant })` → `.sk-wash`

A white (light) or black (dark) veil over the screenshot at `level`, clamped
to 0 … 0.4, by a CSS transition (so `data-sk-instant` snaps it). The chrome is
outside the body and stays crisp.

### `lift(unit, { from, to, ms = 700, signal, fade = true })` → Promise

`unit`: an element at its natural size, absolutely positioned in the scene.
The kit sets `left: 0; top: 0; transform-origin: 0 0` and drives `transform`.
It starts at `translate(from) scale(from.w / unit width)` with no shadow and
travels on `ease.travel` (never under 600 ms) to `translate(to) scale(to.w / unit width)`
while `--sk-shadow-float` fades in. It fades in over the first 12% so it hands
off from the capture rather than popping on it (`fade: false` skips that). It
resolves when it lands and keeps `data-lifted`. With `signal` from an act it
pauses and cancels with the timeline; a cancel leaves the unit where it was
caught, and `rest()` then snaps it with `place()`. Under reduced motion it
snaps.

### `setDown(unit, { to, ms = 500, signal, fade = true })` → Promise

The reverse: the shadow fades over the first 20%, then the unit travels to
`to` and fades out at the end (`fade: false` keeps it showing there). Removes
`data-lifted`.

### `fitRect(size, around, bounds, { gutter = 20, max = 1 })`, `coverRect(size, around, bounds, { gutter = 20, max = 1, edge = 24 })` (the same, but a unit whose source touches an edge of the bounds grows in place up to that edge, so it covers its source instead of sliding toward the middle) → `{ x, y, w, h }`

The largest rect for a unit of natural `size` (`{ w, h }`), scaled at most
`max` and to fit `bounds` less `gutter`, centered on `around`'s center and
moved to stay `gutter` px inside `bounds`. All scene px. Rects may use
`w`/`h` or `width`/`height` (what `stage.rect()` returns).

### `place(unit, to)`

Snap a unit to a scene-px rect with no motion.

## Looks

- **Design Layer**: `className: "look-designlayer"`, `theme: "dark"`. 12 px
  text, 24 px rows, surface `#171717`, indigo accent `#798cff`, primary fill
  `#4a5df9`. Extra tokens: `--sk-component` (`#c09aeb`, component layers),
  `--sk-guide` (`#f14445`, measure guides), `--sk-tab-selected`.
  Values from `design-layer/DESIGN.md`.
- **App builder**: `className: "look-appbuilder"`, `theme: "light"`. 13 px
  text, Luminous light roles, elevation as a glow with no stroke. The
  committing button is `.sk-btn.primary`: a `#9dd2ff` pill with a black label.
  The accent ink (`--sk-accent`, links and active marks) is `#3186ff`.

## Icons

Do not draw icons. Use the product's own set:

- **Design Layer**: the editor's sprite, `../assets/icons.svg` (ids like
  `i-Eye`, `i-Lock`, `i-Component`, `i-Type`, `i-Search`, `i-Trash`,
  `i-Pencil`, `i-MessageSquare`; list them with
  `grep -o 'id="[^"]*"' assets/icons.svg`). Resolve the URL from your module
  so it works from any page:

  ```js
  const SPRITE = new URL("../assets/icons.svg", import.meta.url).href
  // <svg class="sk-icon"><use href="${SPRITE}#i-Eye"/></svg>
  ```

  `svg.sk-icon` sets the sprite's line style (no fill, `currentColor`
  stroke), because a sprite's root attributes do not reach a `<use>`.
- **App builder**: Material Symbols Rounded, loaded by the host page from
  Google Fonts: `<span class="sk-icon material-symbols-rounded">add</span>`.
  `preview.html` and `specimen.html` load it.

## Harness

```sh
node serve.mjs   # http://127.0.0.1:4321 (one server; reuse it if it is up)
open "http://127.0.0.1:4321/stages/preview.html?stage=demo-smoke"
```

`preview.html` parameters: `stage`, `width` (1120, 720, 390), `beat` (plays
`act(beat)` from `rest(beat - 1)`), `instant=1` (jump to `rest(beat)`),
`reduced=1`, `theme`. Keys: ← → step beats, space plays or pauses.
`window.__stage.go(k)` steps from a script.

```sh
# a rest frame
node stages/film.mjs "http://127.0.0.1:4321/stages/preview.html?stage=demo-smoke&width=1120&beat=1&instant=1" \
  --out /tmp/b1.png --width 1440 --select .host --wait 600
# an act, frame by frame
node stages/film.mjs "http://127.0.0.1:4321/stages/preview.html?stage=demo-smoke&beat=1" \
  --out /tmp/act.png --select .host --frames 12 --every 150
# a step back, scripted
node stages/film.mjs "...&beat=1" --out /tmp/back.png --select .host --wait 2500 \
  --eval "new Promise(r => setTimeout(r, 2000)).then(() => __stage.go(0))"
```

`film.mjs` flags: `--width --height --select --dark --reduced --wait
--frames --every --eval`. It prints page errors, console errors and failed
requests to stderr and exits 1 when there were any. Tile frames with
`ffmpeg -i /tmp/act-%02d.png -vf "scale=560:-1,tile=4x3" -frames:v 1 /tmp/sheet.png`.

## Checklist for a new stage

1. Copy `demo-smoke.js`, rename, set `meta`.
2. Draw the opening still first; film it at 1120 and 390.
3. Write each `rest(k)`, step through them with `instant=1`.
4. Write each `act(k)`; film it with `--frames`.
5. Step back and jump in the preview: no act plays, the earlier rest returns.
6. Check `reduced=1`: every beat is its rest frame.
