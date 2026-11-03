/**
 * board: "Every page on one board. One click back to live."
 *
 * Bare capture: the stage is the editor's real capture, edge to edge, with no
 * window around it. The story is two trips of one object, the live page:
 *
 *   0 Board  ⇧1: the page (hero's column, x 280–1320) shrinks as one layer
 *            into exactly its own frame on the board while canvas fades in
 *            beneath; the layer fades out as it lands, so the capture's own
 *            frame takes over and the whole board shows, with nothing lifted.
 *            The cursor then rests on the frame: its ring shows and the Live
 *            badge appears at its top-right.
 *   1 Live   press Live; the same layer grows from the frame back to the
 *            full page while hero returns beneath.
 *
 * The layer is cut from hero-bare (hero without the floating toolbar), so
 * the toolbar is not part of the page that travels; a still slice of the
 * toolbar stays on top through both trips. Capture px are CSS px of the
 * 1600 × 1000 midday captures. Poster: beat 0. Open: preview.html?stage=board
 */

import { createStage, director, keycaps, shots, ease, reduced } from "./stagekit.js"

export const meta = {
  name: "board",
  width: 1000,
  height: 625,
  compact: { below: 560, width: 358, height: 224 },
  beats: ["Board", "Live"],
  poster: 0,
  theme: "dark",
  className: "look-designlayer",
}

const SPRITE = new URL("../assets/icons.svg", import.meta.url).href
const CSS_ID = "stage-css-board"
const CAP = { w: 1600, h: 1000 }
const SHOT = name => new URL(`../assets/shots/midday/${name}-2400.webp`, import.meta.url).href
const SHOTS = { hero: SHOT("hero"), canvas: SHOT("canvas") }
const BARE = SHOT("hero-bare")

// Capture regions (CSS px of the 1600-wide captures).
const COLUMN = { x: 280, y: 0, w: 1040, h: 1000 }   // the live page between the panels
const FOCUS = { x: 312, y: 158, w: 298, h: 286 }    // the current page's frame on the board
const TOOLBAR = { x: 636, y: 948, w: 328, h: 40 }   // the editor toolbar, floating over the page

// The trips' timing. Down: the layer lands on the frame and hands over to it
// in its last 150ms. Up: it shows over the frame in 150ms, and hero returns
// over canvas only in the last 450ms, so the board stays under the page
// until it is nearly home.
const DOWN = { ms: 900, canvas: 450, out: 150 }
const UP = { ms: 1000, in: 150, hero: 450 }

// Cursor rests, in capture px: the page's ground off the board, the frame
// itself on it (the hover that shows Live).
const REST = {
  "-1": { x: 1010, y: 470 },  // the page's ground, right of Get started
  0: { x: 470, y: 330 },      // on the current frame, under its headline
  1: { x: 1010, y: 470 },
}

function ensureCss() {
  const had = document.getElementById(CSS_ID)
  if (had) return had
  const link = document.createElement("link")
  link.id = CSS_ID
  link.rel = "stylesheet"
  link.href = new URL("./board.css", import.meta.url).href
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

// A crop of a capture: an <img> in a clipping box, drawn at the capture's
// on-stage scale k (object-fit fills the img box, object-position is its
// origin), offset so the crop sits on the capture under it pixel for pixel.
function crop(url, r, k, cls) {
  const box = h("div", cls)
  box.style.width = `${r.w * k}px`
  box.style.height = `${r.h * k}px`
  const img = h("img")
  Object.assign(img, { src: url, alt: "", decoding: "async", draggable: false })
  img.style.cssText = `position: absolute; left: ${-r.x * k}px; top: ${-r.y * k}px; width: ${CAP.w * k}px; height: ${CAP.h * k}px; max-width: none; object-fit: cover; object-position: 0 0;`
  box.append(img)
  return box
}

export function mount(root) {
  const link = ensureCss()
  const cssReady = link.sheet ? Promise.resolve() : new Promise(r => {
    link.addEventListener("load", r, { once: true })
    link.addEventListener("error", r, { once: true })
  })
  const stage = createStage(root, meta, { className: `${meta.className} bd` })
  let ui = {}
  const moving = new Set()

  // Capture px → scene px. The screen fills the scene and the capture covers
  // it top-anchored and centered, as shots() draws it. Computed from the
  // design size rather than measured, so it holds while the host is hidden.
  function scale() {
    const d = ui.layout === "compact" ? meta.compact : meta
    const k = Math.max(d.width / CAP.w, d.height / CAP.h)
    return { k, ox: (d.width - CAP.w * k) / 2 }
  }
  function cap(r) {
    const { k, ox } = scale()
    return { x: ox + r.x * k, y: r.y * k, w: (r.w || 0) * k, h: (r.h || 0) * k }
  }

  // The layer's one scale is the width ratio; the frame and the column share
  // the page's aspect (298 × 286 against 1040 × 1000), so it fits both.
  function transformFor(r) {
    return `translate(${r.x}px, ${r.y}px) scale(${r.w / ui.natural.w})`
  }

  function render(layout) {
    stage.scene.querySelectorAll(":scope > :not(.sk-cursor)").forEach(n => n.remove())
    ui = { layout }
    const { k } = scale()
    const screen = h("div", "sk-screen")
    const layers = shots(screen, { width: CAP.w, height: CAP.h, list: SHOTS })

    // The live page as one layer, nothing inside it but the page.
    const page = h("div", "bd-page")
    page.append(crop(BARE, COLUMN, k, "bd-clip"))
    const natural = { w: COLUMN.w * k, h: COLUMN.h * k }
    page.style.width = `${natural.w}px`
    page.style.height = `${natural.h}px`
    ui.natural = natural

    // The hover on the capture's own frame: the ring and the editor's Live
    // badge. The badge is drawn in capture px and scaled by --bk, the
    // capture's scale × 1.4, so it reads on the board.
    const hot = h("div", "bd-hot")
    const live = h("div", "bd-live", icon("i-Play"), h("span", null, "Live"))
    hot.append(h("div", "bd-ring"), live)
    const f = cap(FOCUS)
    hot.style.cssText = `left: ${f.x}px; top: ${f.y}px; width: ${f.w}px; height: ${f.h}px; --bk: ${k * 1.4};`

    // The toolbar floats over the page in the editor; a still slice of it
    // stays on top while the page travels under it. Canvas's slice (only
    // its view button differs) fades over hero's.
    const tools = h("div", "bd-tools")
    const tCanvas = crop(SHOTS.canvas, TOOLBAR, k, "bd-tool bd-tool-canvas")
    tools.append(crop(SHOTS.hero, TOOLBAR, k, "bd-tool"), tCanvas)
    const t = cap(TOOLBAR)
    tools.style.cssText = `left: ${t.x}px; top: ${t.y}px; width: ${t.w}px; height: ${t.h}px;`

    const keys = h("div", "sk-keys bd-keys")
    keys.append(keycaps(["⇧", "1"]))
    stage.scene.append(screen, hot, page, tools, keys)
    Object.assign(ui, { screen, layers, page, hot, live, tCanvas, keys })
  }

  function setTool(id) {
    ui.tCanvas.toggleAttribute("data-on", id === "canvas")
  }

  // A capture crossfade, tracked with the trip so it pauses with the act.
  function showShot(id, ms) {
    ui.layers.show(id, { ms })
    for (const img of ui.screen.querySelectorAll(".sk-shot")) for (const a of img.getAnimations()) track(a)
  }

  function track(anim, signal) {
    moving.add(anim)
    signal?.addEventListener("abort", () => anim.cancel(), { once: true })
    anim.finished.then(() => {}, () => {}).finally(() => moving.delete(anim))
    return anim
  }

  // One trip of the page layer: Web Animations on transform and opacity
  // only, on a layer promoted for just this move. `alpha` is the opacity
  // keyframes; the style holds the end state, so a finished or cancelled
  // trip leaves the layer where it belongs.
  function travel(from, to, ms, alpha, signal) {
    if (signal.aborted) return Promise.resolve()
    const p = ui.page
    p.style.transition = "none"
    p.style.transform = transformFor(to)
    p.style.opacity = String(alpha[alpha.length - 1].opacity)
    if (reduced.matches) return Promise.resolve()
    p.style.willChange = "transform"
    const move = track(p.animate([{ transform: transformFor(from) }, { transform: transformFor(to) }], { duration: ms, easing: ease.travel }), signal)
    track(p.animate(alpha, { duration: ms, easing: "linear" }), signal)
    return move.finished.then(() => {}, () => {}).finally(() => { p.style.willChange = "" })
  }

  function rest(k, { instant, via }) {
    const snap = instant || via !== "jump"
    const board = k === 0
    const p = ui.page
    // A jump out of a trip fades the layer from where it is now, rather than
    // snapping it home first.
    const was = getComputedStyle(p)
    const at = { transform: was.transform, opacity: was.opacity }
    for (const a of moving) a.cancel()
    moving.clear()
    p.style.willChange = ""
    if (snap) {
      p.style.transition = "none"
      p.style.opacity = "0"
    } else if (Number(at.opacity) > 0) {
      p.style.transition = "none"
      p.style.transform = at.transform
      p.style.opacity = at.opacity
      void p.offsetWidth
      p.style.transition = ""
      p.style.opacity = "0"
    }
    ui.layers.show(board ? "canvas" : "hero", { instant: snap, ms: 300 })
    setTool(board ? "canvas" : "hero")
    ui.keys.removeAttribute("data-show")
    ui.hot.toggleAttribute("data-hover", board)
    // A jump lands on a rest that shows its cursor (the kit fades it after
    // 4s); the opening still and a layout switch only place it, hidden.
    if (via !== "act") stage.cursor.at(cap(REST[k]))
    if (via === "jump" && k >= 0) stage.cursor.kind("arrow").show().rest()
  }

  async function act(k, a) {
    await cssReady
    if (a.signal.aborted) return
    const c = stage.cursor
    const sig = { signal: a.signal }
    if (k === 0) {
      // ⇧1 is Canvas view's shortcut; the keys carry it.
      a.step(() => ui.keys.setAttribute("data-show", ""))
      await a.wait(280)
      const caps = ui.keys.querySelectorAll(".sk-keycap")
      a.step(() => caps.forEach(cap => cap.setAttribute("data-press", "")))
      await a.wait(120)
      // The trip: the layer starts exactly on hero's page and ends exactly on
      // canvas's frame, so both hand-overs are seamless. Canvas fades in
      // beneath over the first half; the layer hands over in its last 150ms.
      let trip = Promise.resolve()
      a.step(() => {
        caps.forEach(cap => cap.removeAttribute("data-press"))
        setTool("canvas")
        showShot("canvas", DOWN.canvas)
        const hold = 1 - DOWN.out / DOWN.ms
        trip = travel(cap(COLUMN), cap(FOCUS), DOWN.ms,
          [{ opacity: 1 }, { opacity: 1, offset: hold }, { opacity: 0 }], a.signal)
      })
      await a.wait(400)
      a.step(() => ui.keys.removeAttribute("data-show"))
      await trip
      // Landed: the board shows whole. The cursor comes to the frame, and
      // the hover shows the ring and Live.
      await a.wait(300)
      a.step(() => c.kind("arrow").show())
      await c.moveTo(cap(REST[0]), { dur: 750, ...sig })
      a.step(() => ui.hot.setAttribute("data-hover", ""))
      await a.wait(200)
    }
    if (k === 1) {
      c.kind("arrow").show()
      await c.moveTo(ui.live, { at: { x: 0.6, y: 0.6 }, dur: 420, ...sig })
      await c.press(ui.live, sig)
      let trip = Promise.resolve()
      a.step(() => {
        ui.hot.removeAttribute("data-hover")
        setTool("hero")
        trip = travel(cap(FOCUS), cap(COLUMN), UP.ms,
          [{ opacity: 0 }, { opacity: 1, offset: UP.in / UP.ms }, { opacity: 1 }], a.signal)
      })
      await a.wait(UP.ms - UP.hero)
      a.step(() => showShot("hero", UP.hero))
      await trip
      // Home: hero under the layer is the same page, pixel for pixel.
      a.step(() => { ui.page.style.opacity = "0" })
      await c.moveTo(cap(REST[1]), { dur: 600, ...sig })
    }
  }

  const d = director(stage, { render, rest, act, beats: meta.beats })
  return {
    set: d.set,
    play() { d.play(); for (const a of moving) a.play() },
    pause() { d.pause(); for (const a of moving) a.pause() },
    destroy() { d.destroy() },
  }
}
