/**
 * agent: "Iterate with your agent. Point, compare, pick."
 *
 * Bare capture: the stage is the editor's real capture, edge to edge, with no
 * window around it. Each beat lifts the one unit it is about in place: it
 * grows out of its own region (coverRect) up to 1:1 and covers its source,
 * so no second copy shows, and the cursor acts on the lifted unit.
 *
 *   0 Point    C (Notes); the page's dashboard screenshot lifts (the whole
 *              card at 1:1, from hero-bare); pin 1, the composer, "Try a
 *              bigger headline", Save note.
 *   1 Send     the inspector's Changes panel grows over its own column at
 *              the right edge (built, the capture's real rows); Send to agent
 *              → spinner → Sent; the terminal shows at the bottom-right.
 *   2 Compare  the Design options list grows over the left panel's column;
 *              Announcement badge turns off, and the page's badge pill is
 *              simply gone: a patch of the page's own cream covers it in the
 *              capture, under the wash.
 *   3 Pick     the hero block (headline, Get started, the note) lifts at
 *              0.75; pin 2 on the note, "Drop the note under the button.",
 *              Save; the terminal gets the second payload, and the agent
 *              acts: the note fades out of the lifted block and the capture's
 *              "Note under the button" switch turns off.
 *
 * Nothing tilts and the terminal never moves: it keeps the bottom-right
 * corner, which none of the four lifted units reaches.
 *
 * Every number in capture px is CSS px of the 1600 × 1000 midday captures
 * (the -2400 files are 1.5x, so a 1:1 crop stays sharp).
 * Open: preview.html?stage=agent
 */

import { createStage, director, typeInto, keycaps, shots, wash, lift, setDown, coverRect, place } from "./stagekit.js"

export const meta = {
  name: "agent",
  width: 1000,
  height: 625,
  compact: { below: 560, width: 358, height: 224 },
  beats: ["Point", "Send", "Compare", "Pick"],
  poster: 3,
  theme: "dark",
  className: "look-designlayer",
}

const SPRITE = new URL("../assets/icons.svg", import.meta.url).href
const CSS_ID = "stage-css-agent"
const CAP = { w: 1600, h: 1000 }
const SHOT = name => new URL(`../assets/shots/midday/${name}-2400.webp`, import.meta.url).href
const SHOTS = { hero: SHOT("hero"), notes: SHOT("notes"), changes: SHOT("changes"), options: SHOT("options") }
// Slices only, never a background layer: hero-bare is the same page with the
// editor toolbar hidden, so the dashboard card lifts without the toolbar
// floating over its last rows.
const SLICES = { ...SHOTS, "hero-bare": SHOT("hero-bare") }

// The capture fills the scene; coverRect keeps a lifted unit this far from
// any scene edge its source does not already touch.
const GUTTER = { wide: 16, compact: 12 }

// Compact: the terminal ends at 8 + 150 × 0.55 ≈ 91 (agent.css); 7px under it.
const TERM_FOOT = 98

// Unit regions in capture px, measured in the -2400 files. The dashboard is
// the whole screenshot card with a 16px margin of the page's gradient band,
// down to the capture's bottom edge (y 1000): the card runs past the
// viewport, and any cut above that slices a row of its content. The hero
// block is the headline (544–1059 × 248–373), Get started (735–866 × 405–450)
// and the note (677–923 × 464–477) with 12px or more of flat page around
// them; its top stays below the badge pill (ends at 224).
const R = {
  dash: { x: 376, y: 735, w: 848, h: 265 },    // hero-bare: the dashboard screenshot is 392–1208 × 751–
  changes: { x: 1320, y: 0, w: 280, h: 352 },  // changes: tab row to the Send to agent row
  options: { x: 0, y: 86, w: 280, h: 200 },    // options: Homepage and its five switches
  hero: { x: 520, y: 236, w: 560, h: 254 },    // options: the hero block, flat cream on every side
}

// The hero block reads as a close-up, not a takeover: 0.75 of 1:1.
const MAX = { hero: 0.75 }

// The page ground in options-2400.webp: one flat value (sampled on every
// side of the badge and the note, and on both sides of the hero block).
const CREAM = "rgb(250 248 244)"

// Patches over the capture's own pixels (capture px), drawn where there is
// no capture of the changed state. Each covers its element with 4px of flat
// page around it, filled with the page's cream, so the element is simply
// not there. The note's patch runs 5px higher with a soft top edge: the
// button's shadow fades out across that band, and a hard edge would cut it.
const PATCH = {
  badge: { x: 714, y: 187, w: 172, h: 41 },    // the pill is 719–882 × 191–224
  note: { x: 670, y: 459, w: 260, h: 25 },     // the line is 677–923 × 464–480
}

// The left panel's switches in options-2400.webp: 28 × 16 at x 239, rows at
// y 125 + 32i on the panel's #171717.
const SWITCH = { badge: { x: 239, y: 125 }, note: { x: 239, y: 189 } }

// Pins in each crop's own px (capture px minus the crop's origin): pin 1 on
// the dashboard's Overview header; pin 2 just after the note's last word,
// so the note it points at stays readable until it goes.
const PINS = {
  dash1: { x: 314, y: 35 },   // capture (690, 770)
  hero2: { x: 420, y: 230 },  // capture (940, 466)
}

const NOTE_1 = "Crop this tighter"
const NOTE_2 = "Drop the note under the button."

// The terminal's whole script; each rest shows a prefix of it. Every line
// is real: the MCP setup command, then the payloads' own keys and values in
// order (assets/shots/midday/agent.json, then agent-close.json), the brief's
// markdown wrapped where a terminal 44 columns wide would wrap it. The second
// payload is agent-close.json's shape and id with the note this story pins
// (that file still holds an earlier round's note about a tilted screenshot).
const SCRIPT = [
  ["$ claude mcp add --transport http \\", ""],
  ["  designlayer http://127.0.0.1:5747/mcp", ""],
  ["› designlayer.wait_for_change()", "dim"],
  ['"tool": "wait_for_change",', ""],
  ['"count": 1,', ""],
  ['"request": "3 notes and 1 edit from', ""],
  ['  DesignLayer",', ""],
  ['"brief": "## Page Feedback: /', ""],
  ["**App:** @midday/website", ""],
  ["**Viewport:** 1600×1000", ""],
  ["### 1. flex flex", ""],
  ["**Change:** set `gap` to `16px` (was", ""],
  ["`12px`)", ""],
  ['### 2. "vibe-coded apps"', ""],
  ["**Feedback:** Keep 'vibe-coded apps' on", ""],
  ["one line at xl.", ""],
  ['### 3. link "Open source · MIT→"', ""],
  ["**Feedback:** Link the badge to the", ""],
  ["license, not the repo.", ""],
  ['### 4. "Get started"', ""],
  ["**Feedback:** Point Get started at the", ""],
  ['install step."', ""],
  ["› designlayer.wait_for_change()", "dim"],
  ['"tool": "wait_for_change",', ""],
  ['"count": 1,', ""],
  ['"request": "1 note from DesignLayer",', ""],
  ['"brief": "## Page Feedback: /', ""],
  ['### 1. "Free and open source · Runs on y"', ""],
  ["**Feedback:** Drop the note under the", ""],
  ['button."', ""],
  ["› designlayer.resolve_change(", "dim"],
  ['  "chg-2-tnc61g")', "dim"],
]
const LINES_AT = { "-1": 3, 0: 3, 1: 22, 2: 22, 3: 32 }

// Which capture shows behind each rest, and which unit is lifted.
const BACK = { "-1": "hero", 0: "notes", 1: "changes", 2: "options", 3: "options" }
const UNIT = { 0: "dash", 1: "changes", 2: "options", 3: "hero" }

// Rest spots for the cursor (scene px): empty, washed background beside the
// lifted unit, on the side of the next move (Send, the switches, pin 2).
const REST = {
  wide: { "-1": { x: 700, y: 300 }, 0: { x: 880, y: 290 }, 1: { x: 240, y: 300 }, 2: { x: 330, y: 180 }, 3: { x: 250, y: 290 } },
  compact: { "-1": { x: 280, y: 100 }, 0: { x: 280, y: 100 }, 1: { x: 100, y: 140 }, 2: { x: 300, y: 120 }, 3: { x: 300, y: 130 } },
}

function ensureCss() {
  const had = document.getElementById(CSS_ID)
  if (had) return had
  const link = document.createElement("link")
  link.id = CSS_ID
  link.rel = "stylesheet"
  link.href = new URL("./agent.css", import.meta.url).href
  document.head.append(link)
  return link
}

function h(tag, cls, ...kids) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  for (const k of kids) if (k !== null && k !== undefined) node.append(k)
  return node
}

function icon(id, cls = "") {
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("class", `sk-icon ${cls}`.trim())
  svg.setAttribute("aria-hidden", "true")
  const use = document.createElementNS(ns, "use")
  use.setAttribute("href", `${SPRITE}#${id}`)
  svg.append(use)
  return svg
}

// The landing sprite has no chevron; this path is copied from the editor's
// icon set (design-layer src/core/icons.ts).
function chevron(cls = "") {
  const wrap = document.createElement("span")
  wrap.innerHTML = `<svg class="sk-icon ag-fill ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.826 9.901L12.451 16.276A0.637 0.637 0 0 1 11.549 16.276L5.174 9.901A0.637 0.637 0 0 1 6.076 8.999L12 14.924L17.924 8.999A0.637 0.637 0 0 1 18.826 9.901z"/></svg>`
  return wrap.firstChild
}

// A 1:1 slice of a capture: the -2400 file drawn at 1600 CSS px wide, so
// one capture px is one scene px and the 1.5x pixels keep it sharp.
function slice(name, r) {
  const img = h("div", "ag-img")
  img.style.cssText = `width: ${r.w}px; height: ${r.h}px; background-image: url("${SLICES[name]}"); background-size: ${CAP.w}px ${CAP.h}px; background-position: ${-r.x}px ${-r.y}px;`
  return img
}

export function mount(root) {
  const link = ensureCss()
  const cssReady = link.sheet ? Promise.resolve() : new Promise(r => {
    link.addEventListener("load", r, { once: true })
    link.addEventListener("error", r, { once: true })
  })
  const stage = createStage(root, meta, { className: `${meta.className} ag` })
  let ui = {}

  // ---- Geometry ----

  function design() {
    return ui.layout === "compact" ? meta.compact : meta
  }

  // Capture px → scene px. The screen fills the scene and the capture covers
  // it top-anchored and centered, as shots() draws it; computed from the
  // design size, so it holds while the host is hidden.
  function capRect(r) {
    const d = design()
    const k = Math.max(d.width / CAP.w, d.height / CAP.h)
    const ox = (d.width - CAP.w * k) / 2
    return { x: ox + r.x * k, y: r.y * k, w: r.w * k, h: r.h * k }
  }

  function fromRect(name) {
    return capRect(R[name])
  }

  // In place: centered on its own source and grown up to 1:1, running to any
  // scene edge the source already touches (the Changes panel stays on the
  // right edge, Design options on the left, the cards on the bottom), so the
  // lifted unit covers its source. Compact: the largest scale that fits.
  function toRect(name) {
    const d = design()
    // Compact: the hero block would cover the terminal in the top-left
    // corner, so it lifts in the band under it, on the left gutter, leaving
    // the bubble room on its right.
    if (name === "hero" && ui.layout === "compact") {
      const r = coverRect({ w: R.hero.w, h: R.hero.h }, fromRect("hero"), { x: 0, y: TERM_FOOT, w: d.width, h: d.height - TERM_FOOT }, { gutter: GUTTER.compact, max: MAX.hero })
      return { ...r, x: GUTTER.compact }
    }
    return coverRect({ w: R[name].w, h: R[name].h }, fromRect(name), { x: 0, y: 0, w: d.width, h: d.height }, { gutter: GUTTER[ui.layout], max: MAX[name] ?? 1 })
  }

  function scaleOf(name) {
    return toRect(name).w / R[name].w
  }

  // ---- Units ----

  function pin(n, at) {
    const p = h("div", "ag-pin", h("b", null, String(n)))
    p.style.left = `${at.x}px`
    p.style.top = `${at.y}px`
    return p
  }

  function bubble(text, at, side) {
    const b = h("div", `ag-bubble ${side}`, text)
    b.style.top = `${at.y - 13}px`
    if (side === "right") b.style.left = `${at.x + 16}px`
    else b.style.right = `calc(100% - ${at.x - 16}px)`
    return b
  }

  function unitShell(name) {
    const u = h("div", `ag-unit ag-unit-${name}`)
    u.style.width = `${R[name].w}px`
    u.style.height = `${R[name].h}px`
    return u
  }

  function buildDash() {
    const u = unitShell("dash")
    const p1 = pin(1, PINS.dash1)
    const b1 = bubble(NOTE_1, PINS.dash1, "right")
    u.append(slice("hero-bare", R.dash), p1, b1)
    return { dash: u, dashPin: p1, dashBubble: b1 }
  }

  // A patch of page cream over a capture rect (`r`, capture px), placed in
  // `origin`'s px (the lifted crop's, or the capture's own).
  function patch(r, origin = { x: 0, y: 0 }, cls = "") {
    const p = h("div", `ag-patch ${cls}`.trim())
    p.style.cssText = `left: ${r.x - origin.x}px; top: ${r.y - origin.y}px; width: ${r.w}px; height: ${r.h}px; background: ${CREAM};`
    return p
  }

  // The hero block from the options capture, its own note patch inside it,
  // so the note fades out of the lifted close-up itself.
  function buildHero() {
    const u = unitShell("hero")
    const gone = patch(PATCH.note, R.hero, "soft-top")
    const p2 = pin(2, PINS.hero2)
    const b2 = bubble(NOTE_2, PINS.hero2, "right")
    b2.classList.add("wraps")
    u.append(slice("options", R.hero), gone, p2, b2)
    return { hero: u, heroNoteGone: gone, heroPin: p2, heroBubble: b2 }
  }

  // Changes drawn on the capture itself, under the wash: the badge pill's
  // patch, and built switches over the capture's own two (on its panel
  // color, so the capture's switch never shows around the built one). One
  // box in capture px, scaled as shots() scales the capture.
  function buildCapFx(screen) {
    const fx = h("div", "ag-capfx")
    const badgeGone = patch(PATCH.badge)
    const sw = {}
    for (const [name, at] of Object.entries(SWITCH)) {
      const t = h("span", "ag-toggle")
      t.setAttribute("data-on", "")
      const box = h("div", "ag-capswitch", t)
      box.style.left = `${at.x - 4}px`
      box.style.top = `${at.y - 4}px`
      fx.append(box)
      sw[name] = { box, t }
    }
    fx.prepend(badgeGone)
    screen.querySelector(":scope > .sk-shots").after(fx)
    return { capfx: fx, badgeGone, capBadge: sw.badge, capNote: sw.note }
  }

  function placeCapFx() {
    const d = design()
    const k = Math.max(d.width / CAP.w, d.height / CAP.h)
    ui.capfx.style.transform = `translate(${(d.width - CAP.w * k) / 2}px, 0) scale(${k})`
  }

  // A capture switch override: shown (on the capture's state, on) or not, and
  // on or off. Shown flips at once: the built switch matches the capture's.
  function capSwitch(s, shown, on) {
    s.box.toggleAttribute("data-show", shown)
    s.t.toggleAttribute("data-on", on)
  }

  // The inspector's Changes tab as changes-2400.webp draws it: the tab row,
  // "Notes and edits", the four numbered rows (row 1 is the edit, tagged
  // Ready) and the action row with Send to agent.
  function buildChanges() {
    const u = unitShell("changes")
    const tabs = h("div", "ag-tabs",
      h("span", "ag-tab", "Design"),
      h("span", "ag-tab on", "Changes", h("span", "ag-count", "4")),
      h("span", "ag-tab", "Design system"))
    const head = h("div", "ag-sechead", h("span", null, "Notes and edits"), chevron())
    const rows = h("div", "ag-rows")
    const items = [
      [1, "gap: 12px → 16px", true],
      [2, "Keep 'vibe-coded apps' on one l…"],
      [3, "Link the badge to the license, no…"],
      [4, "Point Get started at the install st…"],
    ]
    for (const [n, text, edit] of items) {
      const top = h("div", "ag-row-top", h("span", `ag-disc${edit ? " sq" : ""}`, String(n)), edit ? h("span", "ag-ready", "Ready") : null)
      rows.append(h("div", "ag-card", top, h("div", "ag-row-text", text)))
    }
    const send = h("span", "ag-btn primary ag-send")
    send.dataset.state = "idle"
    send.append(
      h("span", "s-idle", "Send to agent"),
      h("span", "s-busy", h("span", "ag-spin")),
      h("span", "s-sent", icon("i-Check"), h("span", null, "Sent")),
    )
    const actions = h("div", "ag-actions", h("span", "ag-ib", icon("i-Eye")), h("span", "ag-ib", icon("i-Trash")), send, h("span", "ag-btn", "Copy"))
    u.append(tabs, head, rows, actions)
    return { changes: u, send }
  }

  // The left panel's Design options tab (options-2400.webp): the Homepage
  // group and its five switches, in the capture's states.
  function buildOptions() {
    const u = unitShell("options")
    u.append(h("div", "ag-group", chevron(), h("span", null, "Homepage")))
    const toggles = []
    const rows = [["Announcement badge", true], ["Subtitle", false], ["Note under the button", true], ["Hero screenshot", true], ["Tilted hero screenshot", false]]
    for (const [label, on] of rows) {
      const t = h("span", "ag-toggle")
      t.dataset.base = on ? "on" : "off"
      if (on) t.setAttribute("data-on", "")
      u.append(h("div", "ag-switch", h("span", null, label), t))
      toggles.push(t)
    }
    return { options: u, badgeToggle: toggles[0], noteToggle: toggles[2] }
  }

  function buildTerminal() {
    const term = h("div", "sk-satellite ag-term")
    const barEl = h("div", "ag-term-bar", h("div", "ag-lights", h("span"), h("span"), h("span")), h("span", null, "Your agent, over MCP"))
    const track = h("div", "ag-track")
    term.append(barEl, h("div", "ag-term-body", track))
    return { term, track }
  }

  // The note composer as notes-2400.webp draws it: a 195px card, a focused
  // field, Cancel and Save note. It lives in the scene at 1:1 so it reads at
  // the same size whatever the lifted unit's scale.
  function buildComposer() {
    const area = h("div", "ag-area")
    const save = h("span", "ag-btn primary", "Save note")
    // Outer box: position (and the compact scale); inner card: the open/close.
    const card = h("div", "ag-comp-card", area, h("div", "ag-row-end", h("span", "ag-btn ghost", "Cancel"), save))
    const composer = h("div", "ag-composer", card)
    return { composer, area, save }
  }

  function render(layout) {
    stage.scene.querySelectorAll(":scope > :not(.sk-cursor)").forEach(n => n.remove())
    ui = { layout }
    const screen = h("div", "sk-screen")
    const layers = shots(screen, { width: CAP.w, height: CAP.h, list: SHOTS })
    wash(screen, 0, { instant: true })
    const keys = h("div", "sk-keys ag-keys")
    keys.append(keycaps(["C"]))
    const D = buildDash()
    const T = buildHero()
    const F = buildCapFx(screen)
    const Ch = buildChanges()
    const O = buildOptions()
    const M = buildTerminal()
    const C = buildComposer()
    stage.scene.append(screen, M.term, D.dash, Ch.changes, O.options, T.hero, C.composer, keys)
    Object.assign(ui, { screen, layers, keys, ...D, ...T, ...F, ...Ch, ...O, ...M, ...C })
    ui.units = { dash: D.dash, changes: Ch.changes, options: O.options, hero: T.hero }
    placeCapFx()
    // Pins and bubbles keep their 1:1 size on a unit lifted below 1:1 (the
    // hero block; every unit in compact), and a readable one in compact.
    for (const name of ["dash", "hero"]) {
      const k = scaleOf(name)
      ui.units[name].style.setProperty("--inv", String(Math.max(1, (layout === "compact" ? 0.8 : 1) / k)))
    }
  }

  // ---- State setters: idempotent ----

  function setUnits(on) {
    for (const [name, u] of Object.entries(ui.units)) {
      if (name === on) {
        place(u, toRect(name))
        u.setAttribute("data-lifted", "")
        u.style.boxShadow = "var(--sk-shadow-float)"
        u.style.opacity = "1"
      } else {
        place(u, fromRect(name))
        u.removeAttribute("data-lifted")
        u.style.boxShadow = ""
        u.style.opacity = "0"
      }
    }
  }

  function setLines(n, { fresh = false } = {}) {
    const track = ui.track
    const have = track.querySelectorAll(".ag-line:not(.caret)").length
    if (have !== n || !track.querySelector(".caret")) {
      track.textContent = ""
      SCRIPT.slice(0, n).forEach(([t, cls], i) => {
        const line = h("div", `ag-line ${cls}`.trim(), t)
        if (fresh && i >= have) line.classList.add("new")
        track.append(line)
      })
      const caret = h("div", "ag-line caret")
      caret.append(h("span", "sk-caret"))
      track.append(caret)
    }
    scrollTrack()
  }

  // Scroll like a terminal: the newest line on the body's bottom, in whole
  // rows so the first visible line is never sliced.
  function scrollTrack() {
    const track = ui.track
    const room = track.parentElement.offsetHeight
    const over = Math.max(0, track.offsetHeight - room)
    const row = parseFloat(getComputedStyle(track).lineHeight) || 18
    track.style.translate = `0 ${-Math.ceil(over / row) * row}px`
  }

  function aim(el, at = { x: 0.5, y: 0.5 }) {
    const r = stage.rect(el)
    return { x: r.x + r.width * at.x, y: r.y + r.height * at.y }
  }

  // The composer opens beside its pin, above it: to the right of pin 1, to
  // the left of pin 2, kept inside the scene.
  function placeComposer(pinEl, side) {
    const p = aim(pinEl)
    const s = ui.layout === "wide" ? 1 : 0.8
    const w = 195 * s
    const hgt = 126 * s
    let x = side === "right" ? p.x + 14 : p.x - 14 - w
    let y = p.y - 10 - hgt
    x = Math.max(8, Math.min(x, design().width - w - 8))
    y = Math.max(8, Math.min(y, design().height - hgt - 8))
    ui.composer.style.left = `${Math.round(x)}px`
    ui.composer.style.top = `${Math.round(y)}px`
    ui.composer.style.setProperty("--ox", side === "right" ? "0" : "100%")
  }

  function rest(k, { instant, via }) {
    ui.layers.show(BACK[k], { instant: instant || via !== "jump", ms: 300 })
    wash(ui.screen, k >= 0 ? 0.3 : 0, { instant: instant || via !== "jump", ms: 300 })
    setUnits(UNIT[k])
    ui.keys.removeAttribute("data-show")
    ui.composer.removeAttribute("data-show")
    ui.dashPin.toggleAttribute("data-show", k >= 0)
    ui.dashBubble.toggleAttribute("data-show", k >= 0)
    ui.heroPin.toggleAttribute("data-show", k >= 3)
    ui.heroBubble.toggleAttribute("data-show", k >= 3)
    ui.heroNoteGone.toggleAttribute("data-show", k >= 3)
    ui.send.dataset.state = k >= 1 ? "sent" : "idle"
    ui.badgeToggle.toggleAttribute("data-on", k < 2)
    ui.noteToggle.toggleAttribute("data-on", k < 3)
    // The capture's edits exist only while the options capture shows.
    ui.badgeGone.toggleAttribute("data-show", k >= 2)
    capSwitch(ui.capBadge, k >= 2, false)
    capSwitch(ui.capNote, k >= 3, false)
    ui.term.toggleAttribute("data-show", k >= 1)
    ui.term.toggleAttribute("data-forward", k === 1 || k === 3)
    setLines(LINES_AT[k])
    // A jump lands on a rest that shows its cursor (the kit fades it in 4s);
    // the opening still and a layout switch only place it, hidden.
    if (via !== "act") stage.cursor.at(REST[ui.layout][k])
    if (via === "jump" && k >= 0) stage.cursor.kind("arrow").show().rest()
  }

  async function stream(a, from, to, gap = 80) {
    for (let n = from + 1; n <= to; n++) {
      a.step(() => setLines(n, { fresh: true }))
      await a.wait(gap)
    }
  }

  // A unit is a composited layer only while it moves.
  function promote(unit, moving) {
    unit.style.willChange = "transform"
    return moving.finally(() => { unit.style.willChange = "" })
  }

  function rise(unit, opts) {
    unit.style.willChange = "transform"
    return promote(unit, lift(unit, opts))
  }

  // Swap the lifted unit: the old one sets down into its region while the
  // new capture fades in under the wash, and the new unit lifts 300ms later,
  // so the two overlap by about 200ms.
  async function swap(a, prev, next, capture, ms = 700) {
    const sig = { signal: a.signal }
    a.step(() => ui.layers.show(capture, { ms: 320 }))
    const down = promote(ui.units[prev], setDown(ui.units[prev], { to: fromRect(prev), ms: 500, ...sig }))
    await a.wait(300)
    let up = Promise.resolve()
    a.step(() => {
      up = rise(ui.units[next], { from: fromRect(next), to: toRect(next), ms, ...sig })
    })
    await down
    return up
  }

  // Pin a note on the lifted unit: press, the pin lands, the composer opens
  // beside it; the cursor parks near Save note while the words type, then
  // Save closes the composer and the bubble shows in the same frame.
  async function note(a, pinEl, bubbleEl, side, text, { there = false } = {}) {
    const c = stage.cursor
    const sig = { signal: a.signal }
    if (!there) await c.moveTo(aim(pinEl), { dur: 480, ...sig })
    await c.press(null, sig)
    a.step(() => pinEl.setAttribute("data-show", ""))
    await a.wait(100)
    a.step(() => {
      ui.area.textContent = ""
      placeComposer(pinEl, side)
      ui.composer.setAttribute("data-show", "")
    })
    await a.wait(80)
    const parked = c.moveTo(aim(ui.save, { x: 0.3, y: 1.6 }), { dur: 500, ...sig })
    await typeInto(ui.area, text, { cps: 34, ...sig })
    await parked
    await c.moveTo(ui.save, { at: { x: 0.7, y: 0.7 }, dur: 260, ...sig })
    await c.press(ui.save, sig)
    a.step(() => {
      ui.composer.removeAttribute("data-show")
      bubbleEl.setAttribute("data-show", "")
    })
  }

  async function act(k, a) {
    await cssReady
    if (a.signal.aborted) return
    const c = stage.cursor
    const sig = { signal: a.signal }
    const L = ui.layout
    if (k === 0) {
      // C is the Notes shortcut; the toolbar's Notes button is a 0.6-scale
      // control in the background, so the key carries the mode change.
      a.step(() => ui.keys.setAttribute("data-show", ""))
      await a.wait(260)
      const cap = ui.keys.querySelector(".sk-keycap")
      a.step(() => cap.setAttribute("data-press", ""))
      await a.wait(120)
      a.step(() => cap.removeAttribute("data-press"))
      await a.wait(140)
      // The key leaves before the unit rises past it.
      let up = Promise.resolve()
      a.step(() => {
        ui.keys.removeAttribute("data-show")
        wash(ui.screen, 0.3)
        up = rise(ui.dash, { from: fromRect("dash"), to: toRect("dash"), ms: 700, ...sig })
      })
      await a.wait(300)
      a.step(() => c.kind("arrow").at(REST[L][-1]).show())
      await up
      await note(a, ui.dashPin, ui.dashBubble, "right", NOTE_1)
      a.step(() => ui.layers.show("notes", { ms: 320 }))
      await c.moveTo(REST[L][0], { dur: 450, ...sig })
    }
    if (k === 1) {
      const up = swap(a, "dash", "changes", "changes")
      await a.wait(300)
      c.kind("arrow").show()
      await up
      await c.moveTo(ui.send, { at: { x: 0.8, y: 0.7 }, dur: 600, ...sig })
      await c.press(ui.send, sig)
      a.step(() => { ui.send.dataset.state = "busy" })
      await a.wait(320)
      a.step(() => {
        ui.send.dataset.state = "sent"
        ui.term.setAttribute("data-show", "")
        ui.term.setAttribute("data-forward", "")
      })
      await a.wait(160)
      const away = c.moveTo(REST[L][1], { dur: 700, ...sig })
      await stream(a, 3, 22, 60)
      await away
    }
    if (k === 2) {
      a.step(() => ui.term.removeAttribute("data-forward"))
      const up = swap(a, "changes", "options", "options")
      await a.wait(300)
      c.kind("arrow").show()
      await up
      await c.moveTo(ui.badgeToggle, { at: { x: 0.5, y: 0.6 }, dur: 600, ...sig })
      await c.press(ui.badgeToggle, sig)
      // The switch lands and the pill is gone in the same 200ms; the capture's
      // own switch turns with it, under the lifted list.
      a.step(() => {
        ui.badgeToggle.removeAttribute("data-on")
        ui.badgeGone.setAttribute("data-show", "")
        capSwitch(ui.capBadge, true, false)
      })
      await a.wait(200)
      await c.moveTo(REST[L][2], { dur: 600, ...sig })
    }
    if (k === 3) {
      // The act holds 4s only if the cursor travels while the block rises:
      // it heads for where pin 2 will be once the block has landed.
      const up = swap(a, "options", "hero", "options", 600)
      const r = toRect("hero")
      const k3 = r.w / R.hero.w
      c.kind("arrow").show()
      await c.moveTo({ x: r.x + PINS.hero2.x * k3, y: r.y + PINS.hero2.y * k3 }, { dur: 500, ...sig })
      await up
      await note(a, ui.heroPin, ui.heroBubble, "right", NOTE_2, { there: true })
      a.step(() => ui.term.setAttribute("data-forward", ""))
      const away = c.moveTo(REST[L][3], { dur: 480, ...sig })
      await stream(a, 22, 30, 30)
      // The agent acts 400ms after its payload: the note leaves the lifted
      // block, and the capture's switch for it turns off under the wash.
      await a.wait(400)
      a.step(() => {
        ui.heroNoteGone.setAttribute("data-show", "")
        capSwitch(ui.capNote, true, true)
      })
      await a.wait(40)
      a.step(() => capSwitch(ui.capNote, true, false))
      await stream(a, 30, 32, 30)
      await away
    }
  }

  const d = director(stage, { render, rest, act, beats: meta.beats })
  // The terminal scrolls by measured height, which is wrong until the
  // stylesheet and fonts land on a first mount; measure again once they have.
  if (!link.sheet) link.addEventListener("load", () => ui.track?.isConnected && scrollTrack(), { once: true })
  document.fonts.ready.then(() => { if (ui.track?.isConnected) scrollTrack() })
  return { set: d.set, play: d.play, pause: d.pause, destroy: d.destroy }
}
