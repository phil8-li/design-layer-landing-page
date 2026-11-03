/**
 * edit: "Design like Figma. On the real thing."
 *
 * The real editor (midday captures), bare: the stage is the capture itself,
 * no browser chrome and no ground around it. Each beat lifts the one unit it
 * is about, rebuilt with the capture's own strings, in place: it grows out of
 * its own position over a 0.3 wash and covers its source, never moves
 * elsewhere and never shows a second copy. Every unit lifts to 0.75× capture
 * px (0.93× for the cards), so it reads without filling the stage.
 * Double-click the headline and type; shift-select three ragged cards one by
 * one and press the inspector's own Align top where the capture has it, named
 * by a tooltip, and watch them level; hold ⌥ over the button to measure.
 * Open: preview.html?stage=edit
 */

import {
  createStage, director, keycaps, typeInto, shots, wash,
  lift, setDown, coverRect, place, reduced,
} from "./stagekit.js"

export const meta = {
  name: "edit",
  // The capture's 1.6, the hero mock's aspect: the page's hero hand-off lands
  // on the whole stage.
  width: 1000,
  height: 625,
  compact: { below: 560, width: 358, height: 224 },
  beats: ["Direct edit", "Align", "Measure"],
  poster: 0,
  theme: "dark",
  className: "look-designlayer",
}

const CSS_ID = "stage-edit-css"
const CAP = { width: 1600, height: 1000 }
const SHOT = name => new URL(`../assets/shots/midday/${name}-2400.webp`, import.meta.url).href
const LIST = { hero: SHOT("hero"), align: SHOT("align"), measure: SHOT("measure") }
// The capture each rest shows; beat 0's typed state exists in no capture.
const BACK = { [-1]: "hero", 0: "hero", 1: "align", 2: "measure" }
// The wash under each beat's lifted unit. Every unit covers its source in
// both layouts (the capture is drawn at 0.625 wide and 0.224 compact, the
// units at 0.75 to 0.93 wide and about 0.42 compact), so none needs the 0.4
// that pushes an uncovered source back.
const WASH = { 0: 0.3, 1: 0.3, 2: 0.3 }

const GUTTER = { wide: 16, compact: 12 }
// The lifted scale (scene px per capture px) of each unit at most: 75% of
// the earlier lift, so the unit reads as a part of the screen, not all of it.
const MAX = { head: 0.75, cards: 0.93, block: 0.75 }

// A unit carries 16px of its own ground around the capture region it rebuilds.
const PAD = 16
// Capture CSS px, measured in the 2400 files (÷ 1.5).
const R = {
  head: { x: 416, y: 246, w: 768, h: 120 },   // the headline's selection (hero)
  cards: { x: 381, y: 441, w: 610, h: 165 },  // three feature cards (align), room for the 47px drop
  alignTop: { x: 1462, y: 129, w: 43, h: 24.5 }, // inspector Position > Alignment > Align top (align)
  block: { x: 416, y: 246, w: 768, h: 284 },  // headline to the foot of Get started (measure)
}
const INSPECTOR_X = 1320 // the inspector column's left edge
// Clearly ragged before Align: tops 0 / 26 / 44 scene px apart at the
// cards' 0.93 lift, a stair the eye reads as "not level" at once.
const CARDS = [
  { x: 0, title: "Inspector", sub: "Layout, type, fill", dy: 0 },
  { x: 230, title: "Comments", sub: "Pins on the page", dy: 28 },
  { x: 460, title: "Changes", sub: "Notes and edits", dy: 47 },
]
const DROP = 47 // the deepest card's drop, in capture px
// The Align act's pace: the clicks are slow enough to count, the press is
// named, and the level-up runs on the travel curve.
const CLICK_HOLD = 350
const TIP_MS = 1200
const LEVEL_MS = 700

// Copied verbatim from the editor's icon set (design-layer src/core/icons.ts);
// the landing sprite has no align glyphs.
const GLYPHS = {
  AlignStartHorizontal: '<rect x="3" y="3" width="18" height="1.5"/><rect x="7.5" y="7.5" width="3" height="13.5"/><rect x="13.5" y="7.5" width="3" height="7.5"/>',
}

function h(tag, cls, text) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return node
}

const px = n => `${n}px`
const grow = r => ({ x: r.x - PAD, y: r.y - PAD, w: r.w + 2 * PAD, h: r.h + 2 * PAD })

function at(node, x, y, w, hgt) {
  node.classList.add("abs")
  Object.assign(node.style, { left: px(x), top: px(y) })
  if (w != null) node.style.width = px(w)
  if (hgt != null) node.style.height = px(hgt)
  return node
}

function glyph(name) {
  const wrap = document.createElement("span")
  wrap.innerHTML = `<svg class="sk-icon fillicon" viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[name]}</svg>`
  return wrap.firstChild
}

function selBox(handles) {
  const box = h("div", "sel")
  if (handles) {
    for (const [x, y] of [[0, 0], [50, 0], [100, 0], [0, 50], [100, 50], [0, 100], [50, 100], [100, 100]]) {
      const i = h("i")
      Object.assign(i.style, { left: `${x}%`, top: `${y}%` })
      box.append(i)
    }
  }
  return box
}

function loadCss() {
  let link = document.getElementById(CSS_ID)
  if (!link) {
    link = document.createElement("link")
    link.id = CSS_ID
    link.rel = "stylesheet"
    link.href = new URL("./edit.css", import.meta.url).href
    link.addEventListener("load", () => { link.dataset.ready = "1" }, { once: true })
    document.head.append(link)
  }
  // Acts measure their targets, so they wait for the sheet and the fonts.
  const sheet = link.dataset.ready === "1" || link.sheet
    ? Promise.resolve()
    : new Promise(r => link.addEventListener("load", r, { once: true }))
  return sheet
    .then(() => Promise.all([document.fonts.load("60px 'Hedvig Letters Serif'"), document.fonts.load("15px 'Inter Stage'")]))
    .catch(() => {})
}

// The headline as hero-2400.webp draws it: 60/60 serif, -1.5 tracking, the
// break after "for" (fixed, so the typed word never hops between lines).
function headline(word) {
  const head = h("div", "head")
  const l1 = h("span", "line", "The design layer for")
  const l2 = h("span", "line")
  l2.append(word, " apps")
  head.append(l1, l2, selBox(true))
  return head
}

export function mount(root) {
  const ready = loadCss()
  const stage = createStage(root, meta, { className: `${meta.className} st-edit` })
  let ui = {}
  let gutter = GUTTER.wide

  function render(layout) {
    gutter = GUTTER[layout]
    stage.scene.replaceChildren()
    // The capture is the stage: it fills the scene, and the host masks the
    // corners.
    const screen = h("div", "sk-screen")
    const layers = shots(screen, { ...CAP, list: LIST })

    // 0 · the headline
    const word = h("span", "word", "vibe-coded")
    const headU = h("div", "unit page")
    Object.assign(headU.style, { width: px(R.head.w + 2 * PAD), height: px(R.head.h + 2 * PAD) })
    headU.append(at(headline(word), PAD, PAD))

    // 1 · the three cards
    const cardsU = h("div", "unit page cards-u")
    cardsU.style.width = px(R.cards.w + 2 * PAD)
    cardsU.style.setProperty("--shot", `url("${LIST.align}")`)
    const cards = CARDS.map(c => {
      const card = at(h("div", "card"), PAD + c.x, PAD)
      card.style.setProperty("--dy", px(c.dy))
      const tile = h("div", "tile")
      tile.style.setProperty("--bx", px(-(R.cards.x + c.x + 45)))
      // Two px down: the capture's selection outline runs over the tile's top row.
      tile.style.setProperty("--by", px(-(R.cards.y + 2)))
      card.append(tile, h("div", "t", c.title), h("div", "s", c.sub), selBox(true))
      return card
    })
    cardsU.append(...cards, h("div", "gbox"))

    // The inspector stays the capture's own. Only its Align top button gets
    // a built overlay, at the button's capture size and place, for the hover
    // and the press: never a second, enlarged copy of the panel.
    const alignBtn = h("div", "align-btn")
    Object.assign(alignBtn.style, { width: px(R.alignTop.w), height: px(R.alignTop.h) })
    alignBtn.append(glyph("AlignStartHorizontal"))
    // The editor's tooltip on that button, so the viewer knows what was
    // pressed: a small dark pill just above it, for 1.2s.
    const tip = h("div", "align-tip", "Align top")

    // 2 · headline to button, with the ⌥ guide
    const blockU = h("div", "unit page")
    Object.assign(blockU.style, { width: px(R.block.w + 2 * PAD), height: px(R.block.h + 2 * PAD) })
    const sub = at(h("div", "sub"), PAD, PAD + 142)
    sub.append("Select anything in your running app and change it like a Figma layer. Or", h("br"), "comment, and your coding agent makes the change.")
    const cta = at(h("div", "cta", "Get started"), PAD + 325, PAD + 240)
    cta.append(h("i", "hov"))
    const guide = at(h("div", "guide"), PAD + 384, PAD + 120, null, 120)
    const tag = at(h("div", "guide-label", "120"), PAD + 384, PAD + 180)
    blockU.append(at(headline("vibe-coded"), PAD, PAD), sub, cta, guide, tag)

    const keys = h("div", "sk-keys")
    stage.scene.append(screen, alignBtn, headU, cardsU, blockU, tip, keys)
    ui = { screen, layers, word, headU, cardsU, cards, alignBtn, tip, blockU, cta, keys }
  }

  // ---- geometry (scene px)

  const bounds = () => ({ x: 0, y: 0, w: stage.design.width, h: stage.design.height })
  const from = r => ui.layers.rect(grow(r))
  // In place: centered on its source and covering it, at the largest scale up
  // to `max` that fits the scene less the gutter.
  const cover = (size, r, max = 1, room = bounds()) => coverRect(size, from(r), room, { gutter, max })

  function headTo() { return cover({ w: R.head.w + 2 * PAD, h: R.head.h + 2 * PAD }, R.head, MAX.head) }
  // Sized for the 47px drop, so the scale holds while the cards level. The
  // press lands on the inspector's own button, so the cards grow only as far
  // as the inspector's left edge and never cover it.
  function cardsTo() {
    const room = { ...bounds(), w: ui.layers.rect({ x: INSPECTOR_X, y: 0, w: 0, h: 0 }).x }
    return cover({ w: R.cards.w + 2 * PAD, h: R.cards.h + 2 * PAD }, R.cards, MAX.cards, room)
  }
  function blockTo() { return cover({ w: R.block.w + 2 * PAD, h: R.block.h + 2 * PAD }, R.block, MAX.block) }
  const alignRect = () => ui.layers.rect(R.alignTop)

  // The tooltip centered over the button, 6px above it, kept inside the scene.
  function placeTip() {
    const b = alignRect()
    const w = ui.tip.offsetWidth
    const x = Math.max(4, Math.min(b.x + b.w / 2 - w / 2, stage.design.width - w - 4))
    ui.tip.style.transform = `translate(${x}px, ${b.y - ui.tip.offsetHeight - 6}px)`
  }

  // The lifted unit of beat k with its rect.
  function liftedOf(k) {
    if (k === 0) return [ui.headU, headTo()]
    if (k === 1) return [ui.cardsU, cardsTo()]
    if (k === 2) return [ui.blockU, blockTo()]
    return null
  }

  function spot(k) {
    const b = bounds()
    if (k <= 0) { const r = headTo(); return { x: r.x + r.w * 0.86, y: Math.min(r.y + r.h + 40, b.h - 24) } }
    // Beside the levelled cards, on the unit's ground right of the last one,
    // so the eye ends on the result rather than on the button.
    if (k === 1) {
      const r = cardsTo()
      const s = r.w / (R.cards.w + 2 * PAD)
      return { x: r.x + (PAD + 620) * s, y: r.y + (PAD + 64) * s }
    }
    if (k === 2) return aimButton()
    return { x: b.w * 0.7, y: b.h * 0.5 }
  }

  // Off the label, on the button's right shoulder.
  function aimButton() {
    const r = blockTo()
    const k = r.w / (R.block.w + 2 * PAD)
    return { x: r.x + (PAD + 325 + 104) * k, y: r.y + (PAD + 240 + 30) * k }
  }

  // ---- state

  function showKeys(list) {
    if (list) {
      ui.keys.replaceChildren(keycaps(list))
      ui.keys.setAttribute("data-show", "")
    } else {
      ui.keys.removeAttribute("data-show")
    }
  }

  function selectCards(n) {
    ui.cards.forEach((card, i) => card.toggleAttribute("data-sel", i < n))
    ui.cardsU.toggleAttribute("data-group", n === 3)
  }

  function rest(k, { instant, via }) {
    const snap = instant || via === "mount" || via === "layout" || reduced.matches
    // An unfinished act may have left a caret or an empty word behind.
    ui.word.querySelector(".sk-caret")?.remove()
    ui.word.textContent = k >= 0 ? "real" : "vibe-coded"
    ui.word.removeAttribute("data-sel")
    selectCards(k >= 1 ? 3 : 0)
    ui.cardsU.toggleAttribute("data-aligned", k >= 1)
    // The inspector rests as the capture has it: no overlay on its button.
    place(ui.alignBtn, alignRect())
    ui.alignBtn.removeAttribute("data-hover")
    ui.alignBtn.removeAttribute("data-press")
    ui.tip.removeAttribute("data-show")
    ui.blockU.toggleAttribute("data-measure", k === 2)
    ui.cta.toggleAttribute("data-hover", k === 2)
    showKeys(k === 2 ? ["⌥"] : null)

    ui.layers.show(BACK[k], { instant: snap })

    const lifted = liftedOf(k)
    for (const u of [ui.headU, ui.cardsU, ui.blockU]) {
      if (lifted?.[0] === u) {
        place(u, lifted[1])
        u.setAttribute("data-lifted", "")
        u.style.boxShadow = "var(--sk-shadow-float)"
        u.style.opacity = "1"
      } else {
        u.removeAttribute("data-lifted")
        u.style.opacity = "0"
      }
    }
    wash(ui.screen, lifted ? WASH[k] : 0, { instant: snap })
    // A jump lands on a rest that shows its cursor (the kit fades it in 4s);
    // the opening still and a layout switch only place it, hidden.
    if (via !== "act") stage.cursor.at(spot(k))
    if (via === "jump" && k >= 0) stage.cursor.kind("arrow").show().rest()
  }

  async function act(k, a) {
    await ready
    const c = stage.cursor
    const sig = { signal: a.signal }
    const screen = ui.screen

    if (k === 0) {
      c.kind("arrow").show()
      wash(screen, WASH[0])
      await lift(ui.headU, { from: from(R.head), to: headTo(), ...sig })
      // The arrow turns into an I-beam as it crosses onto the letters.
      const go = c.moveTo(ui.word, { at: { x: 0.4, y: 0.55 }, dur: 800, ...sig })
      await a.wait(560)
      a.step(() => c.kind("ibeam"))
      await go
      await a.wait(160)
      await c.press(null, sig)
      await c.press(null, sig)
      a.step(() => ui.word.setAttribute("data-sel", ""))
      await a.wait(420)
      // The first letter replaces the selection.
      a.step(() => { ui.word.removeAttribute("data-sel"); ui.word.textContent = "" })
      await typeInto(ui.word, "real", { cps: 18, ...sig })
      await a.wait(260)
      const away = c.moveTo(spot(0), { dur: 700, ...sig })
      await a.wait(120)
      a.step(() => c.kind("arrow"))
      await away
    }

    if (k === 1) {
      c.kind("arrow")
      // The headline sets down as the cards come up, 200ms of overlap.
      const down = setDown(ui.headU, { to: from(R.head), ...sig })
      await a.wait(200)
      a.step(() => { ui.layers.show("align"); wash(screen, WASH[1]) })
      const up = lift(ui.cardsU, { from: from(R.cards), to: cardsTo(), ...sig })
      await a.wait(500)
      // ⇧ stays up through all three clicks.
      a.step(() => showKeys(["⇧"]))
      await Promise.all([down, up])
      c.show()
      // One card at a time: each click leaves the editor's outline and
      // handles on its card, and the next waits 350ms so each one counts.
      for (let i = 0; i < 3; i++) {
        await c.moveTo(ui.cards[i], { at: { x: 0.8, y: 0.62 }, dur: i === 0 ? 360 : 300, ...sig })
        await c.press(ui.cards[i], sig)
        a.step(() => selectCards(i + 1))
        // After the third, the group's box is the news; the cursor leaves sooner.
        await a.wait(i < 2 ? CLICK_HOLD : 250)
      }
      a.step(() => showKeys(null))
      // To the inspector's own button, where the capture draws it; the
      // tooltip names it as the cursor arrives.
      await c.moveTo(ui.alignBtn, { at: { x: 0.62, y: 0.68 }, dur: 450, ...sig })
      a.step(() => {
        ui.alignBtn.setAttribute("data-hover", "")
        placeTip()
        ui.tip.setAttribute("data-show", "")
      })
      await a.wait(80)
      await c.press(ui.alignBtn, sig)
      // The cards level (700ms on the travel curve, edit.css) with their box,
      // while the cursor comes back beside them, so the eye ends on the row.
      a.step(() => ui.cardsU.setAttribute("data-aligned", ""))
      const walk = c.moveTo(spot(1), { dur: LEVEL_MS - 100, ...sig })
      await a.wait(160)
      a.step(() => ui.alignBtn.removeAttribute("data-hover"))
      await walk
      // The tooltip has been up since the arrival (80 + the press's 180 +
      // the walk back); it goes once 1.2s are over, then the level-up ends.
      await a.wait(Math.max(0, TIP_MS - (80 + 180 + LEVEL_MS - 100)))
      a.step(() => ui.tip.removeAttribute("data-show"))
    }

    if (k === 2) {
      c.kind("arrow")
      const down = setDown(ui.cardsU, { to: from(R.cards), ...sig })
      await a.wait(300)
      a.step(() => { ui.layers.show("measure"); wash(screen, WASH[2]) })
      const up = lift(ui.blockU, { from: from(R.block), to: blockTo(), ...sig })
      await a.wait(560)
      a.step(() => showKeys(["⌥"]))
      await Promise.all([down, up])
      c.show()
      await c.moveTo(aimButton(), { dur: 700, ...sig })
      a.step(() => {
        ui.cta.setAttribute("data-hover", "")
        ui.blockU.setAttribute("data-measure", "")
      })
      await a.wait(800)
    }
  }

  return director(stage, { render, rest, act, beats: meta.beats })
}
