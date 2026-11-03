/**
 * stagekit.js: the runtime for hand-built product demos ("stages").
 *
 * A plain-DOM port of the rules in Stageshow (benjitaylor/skills, MIT): a
 * stage drawn at a design size and scaled to its host, one drawn cursor, a
 * timeline that acts can be cancelled and paused on, and a few small parts.
 * Round 2 adds the real-UI stage: a glass Chrome window (browserWindow), its
 * screenshot layers (shots, wash) and a lifted focal unit (lift, setDown).
 * No dependencies and no build step. See stages/README.md for the contract.
 */

// ---------- Reduced motion ----------

const reducedQuery = typeof matchMedia === "function"
  ? matchMedia("(prefers-reduced-motion: reduce)")
  : { matches: false, addEventListener() {}, removeEventListener() {} }

/**
 * Behaves like a MediaQueryList for prefers-reduced-motion: reduce. It also
 * reads true while <html data-sk-reduced> is set, which is how preview.html
 * forces it without changing the OS setting. Listen with
 * reduced.addEventListener("change", fn).
 */
export const reduced = {
  get matches() {
    return reducedQuery.matches || document.documentElement.hasAttribute("data-sk-reduced")
  },
  addEventListener(type, fn) {
    reducedQuery.addEventListener(type, fn)
    reducedListeners.add(fn)
  },
  removeEventListener(type, fn) {
    reducedQuery.removeEventListener(type, fn)
    reducedListeners.delete(fn)
  },
}

const reducedListeners = new Set()

/** Turn the forced reduced-motion flag on or off (for harnesses). */
export function forceReduced(on) {
  document.documentElement.toggleAttribute("data-sk-reduced", !!on)
  for (const fn of reducedListeners) fn({ matches: reduced.matches })
}

// ---------- Easing ----------

/** Storytelling travel, arrival from nowhere, and quick UI feedback (motion.md). */
export const ease = {
  travel: "cubic-bezier(0.45, 0, 0.1, 1)",
  arrive: "cubic-bezier(0.25, 0.8, 0.25, 1)",
  feedback: "cubic-bezier(0.4, 0, 0.2, 1)",
}

// ---------- Small DOM helpers ----------

function el(tag, className, attrs) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  return node
}

/** An element's rect in the scene's own (unscaled) px. */
function rectIn(scene, target) {
  const s = scene.getBoundingClientRect()
  const r = target.getBoundingClientRect()
  const k = s.width / (scene.offsetWidth || 1) || 1
  return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, width: r.width / k, height: r.height / k }
}

// ---------- Stage ----------

/**
 * Turn root into a stage: .sk-stage with a scaled .sk-scene inside, drawn at
 * meta.width x meta.height (or meta.compact's size when root is narrower than
 * meta.compact.below). Returns { scene, layout, scale, onLayout, rect, cursor,
 * destroy }; `layout` and `scale` are live getters.
 */
export function createStage(root, meta, { className } = {}) {
  root.classList.add("sk-stage")
  if (className) for (const c of className.split(/\s+/).filter(Boolean)) root.classList.add(c)
  root.dataset.theme = meta.theme || "light"
  const scene = el("div", "sk-scene")
  root.append(scene)

  const listeners = new Set()
  let layout = null
  let scale = 1
  let cursor = null

  function design(which) {
    return which === "compact" && meta.compact ? meta.compact : meta
  }

  function fit() {
    const width = root.clientWidth
    if (!width) return
    const next = meta.compact && width < meta.compact.below ? "compact" : "wide"
    const d = design(next)
    scale = width / d.width
    scene.style.width = `${d.width}px`
    scene.style.height = `${d.height}px`
    scene.style.transform = `scale(${scale})`
    root.style.aspectRatio = `${d.width} / ${d.height}`
    if (next !== layout) {
      const first = layout === null
      layout = next
      root.dataset.layout = layout
      if (!first) for (const fn of listeners) fn(layout)
    }
  }

  // Pick the layout synchronously so a stage can render before the first
  // observer callback; the observer keeps it fitted after that.
  fit()
  if (layout === null) {
    layout = "wide"
    root.dataset.layout = layout
    const d = design(layout)
    scene.style.width = `${d.width}px`
    scene.style.height = `${d.height}px`
    root.style.aspectRatio = `${d.width} / ${d.height}`
  }
  const observer = new ResizeObserver(fit)
  observer.observe(root)

  return {
    scene,
    root,
    meta,
    get layout() { return layout },
    get scale() { return scale },
    get design() { return design(layout) },
    /** cb(layout) runs when the design switches between wide and compact. */
    onLayout(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    /** An element's rect in scene px: { x, y, width, height }. */
    rect(target) {
      return rectIn(scene, target)
    },
    get cursor() {
      if (!cursor) cursor = createCursor(scene, { theme: meta.theme })
      return cursor
    },
    destroy() {
      observer.disconnect()
      listeners.clear()
      cursor?.destroy()
      scene.remove()
      root.classList.remove("sk-stage")
      delete root.dataset.layout
      root.style.aspectRatio = ""
    },
  }
}

// ---------- Timeline ----------

// Lets kit calls that take a `signal` (moveTo, press, typeInto) find the
// timeline it came from, so their waits and animations pause with it.
const runs = new WeakMap()

/**
 * A cancellable, pausable script runner. run(fn) calls fn(act) with
 * act = { wait(ms), step(cb), signal }. A new run cancels the previous one.
 * wait() resolves early once cancelled (check act.signal.aborted, or just let
 * step() no-op); while paused, wait() stretches until resume.
 */
export function timeline() {
  let controller = null
  let paused = false
  let current = null
  const timers = new Set()
  const animations = new Set()

  function makeRun() {
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    const state = {
      signal,
      wait(ms) {
        return new Promise(resolve => {
          if (signal.aborted) return resolve()
          const t = { left: Math.max(0, ms), id: 0, at: 0, resolve }
          const done = () => {
            timers.delete(t)
            signal.removeEventListener("abort", done)
            clearTimeout(t.id)
            resolve()
          }
          t.done = done
          t.start = () => {
            t.at = performance.now()
            t.id = setTimeout(done, t.left)
          }
          t.stop = () => {
            clearTimeout(t.id)
            t.left = Math.max(0, t.left - (performance.now() - t.at))
          }
          timers.add(t)
          signal.addEventListener("abort", done, { once: true })
          if (!paused) t.start()
        })
      },
      step(cb) {
        if (!signal.aborted) cb()
      },
      track(animation) {
        if (signal.aborted) {
          animation.cancel()
          return animation
        }
        animations.add(animation)
        animation.finished.catch(() => {}).finally(() => animations.delete(animation))
        if (paused) animation.pause()
        return animation
      },
    }
    runs.set(signal, state)
    return state
  }

  return {
    run(fn) {
      const state = makeRun()
      const act = { wait: state.wait, step: state.step, signal: state.signal }
      const p = Promise.resolve()
        .then(() => fn(act))
        .catch(err => {
          if (!state.signal.aborted) throw err
        })
      current = p
      return p
    },
    cancel() {
      controller?.abort()
      for (const a of animations) a.cancel()
      animations.clear()
    },
    pause() {
      if (paused) return
      paused = true
      for (const t of timers) t.stop()
      for (const a of animations) a.pause()
    },
    resume() {
      if (!paused) return
      paused = false
      for (const t of timers) t.start()
      for (const a of animations) a.play()
    },
    get paused() { return paused },
    get running() { return current },
  }
}

// A wait that follows a timeline when the signal came from one, else a plain timer.
function waitFor(ms, signal) {
  const run = signal && runs.get(signal)
  if (run) return run.wait(ms)
  return new Promise(resolve => {
    if (signal?.aborted) return resolve()
    const id = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => { clearTimeout(id); resolve() }, { once: true })
  })
}

function track(animation, signal) {
  const run = signal && runs.get(signal)
  if (run) return run.track(animation)
  signal?.addEventListener("abort", () => animation.cancel(), { once: true })
  return animation
}

// ---------- Cursor ----------

// The macOS arrow from styles.css (.cue-hand), drawn at 1 unit = 1px.
const ARROW = `<svg class="sk-cursor-glyph arrow" viewBox="-1 -1 22 28" aria-hidden="true"><path d="M2.5 2v18.2l4.6-4.3 2.9 6.8 3.3-1.4-2.9-6.7H16.6Z" fill="#0b0b0c" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`
// A pointing hand in the arrow's materials (black, white edge), fingertip at 7.5,2.
const HAND = `<svg class="sk-cursor-glyph hand" viewBox="0 0 22 26" aria-hidden="true"><path d="M7.5 2c1.1 0 1.9.9 1.9 2v6.1c.3-.2.7-.3 1.1-.3.9 0 1.6.5 1.9 1.3.3-.2.7-.3 1.1-.3 1 0 1.7.6 2 1.5.3-.1.6-.2.9-.2 1.1 0 2 .9 2 2v4.1c0 3.5-2.7 6.3-6.2 6.3h-1.5c-2 0-3.6-.8-4.8-2.5L2.6 16.4c-.6-.8-.5-1.9.3-2.5s1.9-.5 2.5.3l.2.3V4c0-1.1.8-2 1.9-2Z" fill="#0b0b0c" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`
// The I-beam: an edge stroke under an ink stroke; colors flip on dark stages (CSS).
const IBEAM_PATH = "M2 1.5c1.8 0 3 .7 3 2v17c0 1.3-1.2 2-3 2M8 1.5c-1.8 0-3 .7-3 2M8 22.5c-1.8 0-3-.7-3-2M3.2 12h3.6"
const IBEAM = `<svg class="sk-cursor-glyph ibeam" viewBox="0 0 10 24" aria-hidden="true"><path class="edge" d="${IBEAM_PATH}" fill="none" stroke-width="3.2" stroke-linecap="round"/><path class="ink" d="${IBEAM_PATH}" fill="none" stroke-width="1.3" stroke-linecap="round"/></svg>`

/**
 * One drawn cursor per scene, positioned in scene px. Its hotspot is the
 * arrow's tip. Kinds: "arrow", "hand", "ibeam". See README for the API.
 */
export function createCursor(scene, { kind = "arrow" } = {}) {
  const existing = scene.querySelector(":scope > .sk-cursor")
  if (existing?._skCursor) return existing._skCursor

  const node = el("div", "sk-cursor", { "aria-hidden": "true", "data-kind": kind })
  const press = el("div", "sk-cursor-press")
  press.innerHTML = ARROW + HAND + IBEAM
  node.append(press)

  let x = 0
  let y = 0
  let idleTimer = 0
  let moving = null

  function attach() {
    if (!node.isConnected || node.parentNode !== scene || scene.lastElementChild !== node) scene.append(node)
  }
  function wake() {
    clearTimeout(idleTimer)
    node.removeAttribute("data-idle")
  }
  function place(nx, ny) {
    x = nx
    y = ny
    node.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }
  function point(target, at = { x: 0.85, y: 0.6 }) {
    if (target && typeof target.getBoundingClientRect === "function") {
      const r = rectIn(scene, target)
      return { x: r.x + r.width * at.x, y: r.y + r.height * at.y }
    }
    return { x: target.x, y: target.y }
  }

  const api = {
    el: node,
    get x() { return x },
    get y() { return y },
    show() {
      attach()
      wake()
      node.setAttribute("data-show", "")
      return api
    },
    hide() {
      wake()
      node.removeAttribute("data-show")
      return api
    },
    /** Snap to a point (or an element's aim point) with no travel. */
    at(target, at) {
      attach()
      wake()
      moving?.cancel()
      const p = point(target, at)
      place(p.x, p.y)
      return api
    },
    /**
     * Travel to target ({x,y} or an element, aimed at `at` inside it) on a
     * shallow arc. Resolves when it arrives, or at once when signal aborts.
     */
    moveTo(target, { at, dur = 900, ease: curve = ease.travel, signal } = {}) {
      if (signal?.aborted) return Promise.resolve()
      attach()
      wake()
      const to = point(target, at)
      const from = { x, y }
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dist = Math.hypot(dx, dy)
      if (dist < 0.5) return Promise.resolve()
      // A shallow arc: bow the path sideways by 8% of its length, always
      // upward-ish so it reads as a wrist moving, never a ruler line.
      const bow = Math.min(60, dist * 0.08) * (dx >= 0 ? -1 : 1)
      const cx = from.x + dx / 2 + (-dy / dist) * bow
      const cy = from.y + dy / 2 + (dx / dist) * bow
      const frames = []
      for (let i = 0; i <= 24; i++) {
        const t = i / 24
        const u = 1 - t
        const px = u * u * from.x + 2 * u * t * cx + t * t * to.x
        const py = u * u * from.y + 2 * u * t * cy + t * t * to.y
        frames.push({ transform: `translate3d(${px}px, ${py}px, 0)` })
      }
      moving?.cancel()
      place(to.x, to.y)
      const anim = node.animate(frames, { duration: dur, easing: curve })
      moving = anim
      track(anim, signal)
      return anim.finished.then(() => {}, () => {
        // Cancelled mid-travel: the stage moves to a rest state and places
        // the cursor itself, so nothing to undo here.
      }).finally(() => { if (moving === anim) moving = null })
    },
    /**
     * Click: 90ms down (the cursor scales 0.92 about its tip; target gets
     * data-press for 120ms), then up. Resolves after the release.
     */
    async press(target, { signal } = {}) {
      if (signal?.aborted) return
      wake()
      node.setAttribute("data-press", "")
      target?.setAttribute?.("data-press", "")
      await waitFor(90, signal)
      node.removeAttribute("data-press")
      await waitFor(30, signal)
      target?.removeAttribute?.("data-press")
      await waitFor(60, signal)
    },
    /** Morph to another kind with a 120ms fade-scale. */
    kind(name) {
      if (name) node.dataset.kind = name
      return name ? api : node.dataset.kind
    },
    /** Start the 4s idle fade; any move cancels it. */
    rest(ms = 4000) {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(() => node.setAttribute("data-idle", ""), ms)
      return api
    },
    destroy() {
      clearTimeout(idleTimer)
      moving?.cancel()
      node.remove()
    },
  }
  node._skCursor = api
  return api
}

// ---------- Director: the beat contract in one place ----------

/**
 * Runs the stage contract so every stage behaves the same:
 *   render(layout)          build the DOM for a layout (called on mount and on layout change)
 *   rest(k, { instant, via }) put the DOM in beat k's rest state; k = -1 is the opening still.
 *                           Must be idempotent. via is "mount" | "jump" | "layout" | "act";
 *                           unless via is "act", place the (hidden) cursor at beat k's rest
 *                           spot with cursor.at(), so the next act starts from there.
 *   act(k, act)             play beat k's gesture; route every DOM change through act.step()
 *                           or a kit call given act.signal.
 * set(k) from k-1 plays act(k) then settles on rest(k); anything else (a jump,
 * a step back, instant, reduced motion) cancels and calls rest(k) directly.
 * Returns { set, play, pause, destroy, get beat }: the object mount() returns.
 */
export function director(stage, { render, rest, act, beats }) {
  const tl = timeline()
  const cursor = stage.cursor
  let beat = -1
  let destroyed = false

  // No transition plays for a frame: mount, layout change, reduced motion.
  function snap(fn) {
    stage.root.setAttribute("data-sk-instant", "")
    fn()
    void stage.root.offsetWidth
    requestAnimationFrame(() => requestAnimationFrame(() => stage.root.removeAttribute("data-sk-instant")))
  }

  function settle(k, { instant }) {
    tl.cancel()
    cursor.hide()
    if (instant) snap(() => rest(k, { instant: true, via: "jump" }))
    else rest(k, { instant: false, via: "jump" })
  }

  render(stage.layout)
  snap(() => rest(-1, { instant: true, via: "mount" }))

  const offLayout = stage.onLayout(layout => {
    tl.cancel()
    cursor.hide()
    render(layout)
    snap(() => rest(beat, { instant: true, via: "layout" }))
  })

  return {
    get beat() { return beat },
    set(k, { instant = false } = {}) {
      if (destroyed) return Promise.resolve()
      const last = (beats?.length ?? Infinity) - 1
      k = Math.max(-1, Math.min(k, last))
      const from = beat
      beat = k
      if (k === from + 1 && k >= 0 && !instant && !reduced.matches) {
        return tl.run(async a => {
          await act(k, a)
          if (a.signal.aborted) return
          rest(k, { instant: false, via: "act" })
          cursor.rest()
        })
      }
      settle(k, { instant: reduced.matches })
      return Promise.resolve()
    },
    play() { tl.resume() },
    pause() { tl.pause() },
    destroy() {
      destroyed = true
      tl.cancel()
      offLayout()
      stage.destroy()
    },
  }
}

// ---------- Text ----------

/**
 * Type text into el one letter at a time (cps letters per second), with a
 * caret after the last letter that is solid while typing and blinks at rest.
 * The caret is removed when done unless keepCaret.
 */
export async function typeInto(el, text, { cps = 14, caret = true, keepCaret = false, signal } = {}) {
  if (signal?.aborted) return
  let mark = el.querySelector(":scope > .sk-caret")
  if (caret && !mark) {
    mark = document.createElement("span")
    mark.className = "sk-caret"
    el.append(mark)
  }
  mark?.setAttribute("data-typing", "")
  const node = document.createTextNode("")
  el.insertBefore(node, mark || null)
  const gap = 1000 / cps
  for (const ch of text) {
    if (signal?.aborted) break
    node.data += ch
    await waitFor(gap, signal)
  }
  mark?.removeAttribute("data-typing")
  if (mark && (!keepCaret || signal?.aborted)) mark.remove()
}

// ---------- Small parts ----------

/** ["⌘", "."] → a fragment of .sk-keycap kbd elements. */
export function keycaps(keys) {
  const frag = document.createDocumentFragment()
  for (const k of keys) {
    const cap = document.createElement("kbd")
    cap.className = "sk-keycap"
    cap.textContent = k
    frag.append(cap)
  }
  return frag
}

/**
 * A placeholder bar. w: a number (px) or a CSS length ("60%"). opts.ink: 1..5
 * (default 3). opts.height overrides the 8px line for a smaller text size.
 */
export function bar(w, { ink = 3, height } = {}) {
  const node = el("span", "sk-bar")
  node.style.setProperty("--w", typeof w === "number" ? `${w}px` : w)
  node.style.setProperty("--ink", `var(--sk-ink-${ink})`)
  if (height) node.style.height = `${height}px`
  return node
}

/** Bars in a column at the kit's pitch; numbers are % of the column. */
export function bars(widths, opts) {
  const col = el("div", "sk-bars")
  for (const w of widths) col.append(bar(typeof w === "number" ? `${w}%` : w, opts))
  return col
}

/**
 * A macOS window. url → a centered URL pill; title → a centered title (left at
 * 16px beside a sidebar); sidebar: a width in px → a full-height sidebar that
 * holds the lights. Returns the .sk-window element with .bar, .body and .side
 * properties for convenience. Position and size it yourself.
 */
export function windowChrome({ url, title, theme, sidebar } = {}) {
  const win = el("div", "sk-window")
  if (theme) win.dataset.theme = theme
  const lights = el("div", "sk-window-lights")
  lights.append(el("span"), el("span"), el("span"))
  const main = el("div", "sk-window-main")
  const barEl = el("div", "sk-window-bar")
  const body = el("div", "sk-window-body")
  let side = null
  if (sidebar) {
    win.setAttribute("data-sidebar", "")
    side = el("div", "sk-window-side")
    side.style.width = `${sidebar}px`
    side.append(lights)
    win.append(side)
  } else {
    barEl.append(lights)
  }
  if (url) {
    const pill = el("div", "sk-window-pill")
    pill.textContent = url
    barEl.append(pill)
  } else if (title) {
    const t = el("div", "sk-window-title")
    t.textContent = title
    barEl.append(t)
  }
  main.append(barEl, body)
  win.append(main)
  win.bar = barEl
  win.body = body
  win.side = side
  return win
}

// ---------- Browser window (Google Chrome for macOS, glass chrome) ----------

// Material Symbols Outlined, weight 400, 24px grid (viewBox 0 -960 960 960),
// copied from fonts.gstatic.com. Apache-2.0; see stages/LICENSES.md. Chrome's
// own vector icons are not licensed for reuse, so these stand in at one size.
const MS = {
  arrow_back: "m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z",
  arrow_forward: "M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z",
  refresh: "M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z",
  lock: "M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z",
  tune: "M440-120v-240h80v80h320v80H520v80h-80Zm-320-80v-80h240v80H120Zm160-160v-80H120v-80h160v-80h80v240h-80Zm160-80v-80h400v80H440Zm160-160v-240h80v80h160v80H680v80h-80Zm-480-80v-80h400v80H120Z",
  more_vert: "M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z",
  add: "M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z",
  close: "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z",
  public: "M324-111.5Q251-143 197-197t-85.5-127Q80-397 80-480t31.5-156Q143-709 197-763t127-85.5Q397-880 480-880t156 31.5Q709-817 763-763t85.5 127Q880-563 880-480t-31.5 156Q817-251 763-197t-127 85.5Q563-80 480-80t-156-31.5ZM440-162v-78q-33 0-56.5-23.5T360-320v-40L168-552q-3 18-5.5 36t-2.5 36q0 121 79.5 212T440-162Zm276-102q41-45 62.5-100.5T800-480q0-98-54.5-179T600-776v16q0 33-23.5 56.5T520-680h-80v80q0 17-11.5 28.5T400-560h-80v80h240q17 0 28.5 11.5T600-440v120h40q26 0 47 15.5t29 40.5Z",
}

function glyph(name, className = "sk-bwin-glyph") {
  return `<svg class="${className}" viewBox="0 -960 960 960" aria-hidden="true"><path d="${MS[name]}"/></svg>`
}

/**
 * The browser window's chrome height at 1:1: a 40px tab strip over a 40px
 * toolbar, measured from a 2x capture of Chrome on macOS. Size a window as
 * BWIN_CHROME + the body height you want. If a look overrides
 * --sk-bwin-tabs or --sk-bwin-toolbar, measure win.chrome.offsetHeight instead.
 */
export const BWIN_CHROME = 80

/**
 * A Google Chrome for macOS window: a translucent glass chrome (tab strip with
 * one active tab, toolbar with the omnibox) over a solid page body. Returns
 * the .sk-bwin element with .chrome, .tab, .url and .body properties. It is
 * position: absolute like windowChrome(); width and height (px) are optional.
 * favicon: an image URL, an element, or nothing (Chrome's globe).
 * secure: the omnibox's site glyph, "tune" (current Chrome) or "lock".
 */
export function browserWindow({ title = "", url = "", favicon, theme = "light", width, height, secure = "tune" } = {}) {
  const win = el("div", "sk-bwin", { "data-theme": theme })
  if (width != null) win.style.width = typeof width === "number" ? `${width}px` : width
  if (height != null) win.style.height = typeof height === "number" ? `${height}px` : height

  const chrome = el("div", "sk-bwin-chrome", { "aria-hidden": "true" })
  const tabs = el("div", "sk-bwin-tabs")
  const lights = el("div", "sk-bwin-lights")
  lights.append(el("span"), el("span"), el("span"))
  const tab = el("div", "sk-bwin-tab")
  const fav = el("span", "sk-bwin-fav")
  if (typeof favicon === "string") {
    const img = el("img", "", { src: favicon, alt: "", width: "16", height: "16", decoding: "async" })
    fav.append(img)
  } else if (favicon && favicon.nodeType) {
    fav.append(favicon)
  } else {
    fav.innerHTML = glyph("public", "sk-bwin-glyph sk-bwin-globe")
  }
  const tabTitle = el("span", "sk-bwin-tab-title")
  tabTitle.textContent = title
  const tabClose = el("span", "sk-bwin-tab-close")
  tabClose.innerHTML = glyph("close")
  tab.append(fav, tabTitle, tabClose)
  const plus = el("span", "sk-bwin-new")
  plus.innerHTML = glyph("add")
  tabs.append(lights, tab, plus)

  const toolbar = el("div", "sk-bwin-bar")
  const btn = name => {
    const b = el("span", "sk-bwin-btn")
    b.innerHTML = glyph(name)
    return b
  }
  const omni = el("div", "sk-bwin-url")
  const site = el("span", "sk-bwin-url-site")
  site.innerHTML = glyph(secure === "lock" ? "lock" : "tune")
  const urlText = el("span", "sk-bwin-url-text")
  urlText.textContent = url
  omni.append(site, urlText)
  toolbar.append(btn("arrow_back"), btn("arrow_forward"), btn("refresh"), omni, btn("more_vert"))

  chrome.append(tabs, toolbar)
  const body = el("div", "sk-bwin-body")
  win.append(chrome, body)
  win.chrome = chrome
  win.tab = tab
  win.url = omni
  win.body = body
  return win
}

// ---------- Real-UI layers: screenshots, wash, lift ----------

// Rects come in as { x, y, w, h }; stage.rect() gives { x, y, width, height }.
function toRect(r) {
  return { x: r.x || 0, y: r.y || 0, w: r.w ?? r.width ?? 0, h: r.h ?? r.height ?? 0 }
}

// The frame a body's rects are measured in: the stage scene, else the
// nearest positioned ancestor (a lifted unit lives in the same frame).
function frameOf(node) {
  return node.closest(".sk-scene") || node.offsetParent || document.body
}

/**
 * Screenshot layers in a browser body. list: { id: url }; width x height is
 * the capture's size in px (the body should have that aspect; the stage sizes
 * the body). Returns { show(id, { instant, ms }), rect(r), el, current }.
 */
export function shots(body, { width, height, list }) {
  const box = el("div", "sk-shots")
  body.prepend(box)
  const ids = Object.keys(list)
  const imgs = new Map()
  for (const id of ids) {
    // Lazy until shown or warmed: a stage with ten captures loads one. The
    // loading attribute goes on before src, or the first one waits for scroll.
    const img = el("img", "sk-shot", { alt: "", decoding: "async", loading: id === ids[0] ? "eager" : "lazy", draggable: "false" })
    img.dataset.id = id
    img.src = list[id]
    box.append(img)
    imgs.set(id, img)
  }
  let current = null
  let fade = null

  // decode() as well as eager: Chrome otherwise defers decoding an image
  // that has not been in the viewport, and a crossfade to it shows the body.
  function warm(id) {
    const img = imgs.get(id)
    if (!img || img.dataset.warm) return
    img.dataset.warm = ""
    img.loading = "eager"
    img.decode?.().catch(() => {})
  }

  function show(id, { instant = false, ms = 320 } = {}) {
    const next = imgs.get(id)
    if (!next || id === current) return Promise.resolve()
    warm(id)
    const i = ids.indexOf(id)
    if (i >= 0 && i + 1 < ids.length) warm(ids[i + 1])
    fade?.cancel()
    const prev = current ? imgs.get(current) : null
    current = id
    // The outgoing layer stays opaque underneath until the incoming one is
    // fully in, so the fade never shows the body through the middle.
    for (const img of imgs.values()) img.removeAttribute("data-top")
    next.setAttribute("data-top", "")
    next.setAttribute("data-on", "")
    if (instant || !prev || reduced.matches) {
      for (const img of imgs.values()) if (img !== next) img.removeAttribute("data-on")
      fade = null
      return Promise.resolve()
    }
    prev.setAttribute("data-on", "")
    const anim = next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: ease.feedback })
    fade = anim
    return anim.finished.then(() => {
      if (current === id) for (const img of imgs.values()) if (img !== next) img.removeAttribute("data-on")
    }, () => {})
  }

  // The capture's px → scene px, given where the body sits right now. The
  // image covers the body anchored top-center, so a body of another aspect
  // still maps correctly.
  function rect(r) {
    const { x, y, w, h } = toRect(r)
    const b = rectIn(frameOf(body), body)
    const k = Math.max(b.width / width, b.height / height)
    const ox = (b.width - width * k) / 2
    return { x: b.x + ox + x * k, y: b.y + y * k, w: w * k, h: h * k }
  }

  if (ids.length) show(ids[0], { instant: true })

  return {
    show,
    rect,
    el: box,
    get current() { return current },
  }
}

/**
 * Step the body back while a unit is lifted: a white (light) or black (dark)
 * veil over the screenshot, opacity `level` (0 to 0.4). The chrome sits
 * outside the body, so it stays crisp. Returns the .sk-wash element.
 */
export function wash(body, level, { ms = 320, instant = false } = {}) {
  let veil = body.querySelector(":scope > .sk-wash")
  if (!veil) {
    veil = el("div", "sk-wash", { "aria-hidden": "true" })
    body.append(veil)
  }
  const to = Math.max(0, Math.min(0.4, level))
  const snap = instant || reduced.matches
  veil.style.transitionDuration = snap ? "0ms" : `${ms}ms`
  veil.style.opacity = String(to)
  return veil
}

function liftTransform(r, natural) {
  const k = natural.w ? r.w / natural.w : 1
  return `translate(${r.x}px, ${r.y}px) scale(${k})`
}

function naturalSize(unit) {
  return { w: unit.offsetWidth, h: unit.offsetHeight }
}

// The unit's lifted shadow as a computed list, plus the same list with every
// color transparent, so the two interpolate shadow by shadow.
function shadowPair(unit) {
  const prev = unit.style.boxShadow
  unit.style.boxShadow = "var(--sk-shadow-float)"
  const on = getComputedStyle(unit).boxShadow
  unit.style.boxShadow = prev
  const off = on === "none" ? "none" : on.replace(/rgba?\([^)]*\)/g, "rgba(0, 0, 0, 0)")
  return { on, off }
}

function prepUnit(unit) {
  unit.style.position = unit.style.position || "absolute"
  unit.style.left = "0px"
  unit.style.top = "0px"
  unit.style.transformOrigin = "0 0"
  // A new move starts from wherever a running one has the unit right now.
  const running = unit._skLift
  if (running && (running.playState === "running" || running.playState === "paused")) {
    try { running.commitStyles() } catch {}
  }
  running?.cancel()
  unit._skLift = null
}

/** Snap a unit to a scene-px rect (its natural size scaled to rect.w), no motion. */
export function place(unit, to) {
  prepUnit(unit)
  unit.style.transform = liftTransform(toRect(to), naturalSize(unit))
  return unit
}

function runLift(unit, keyframes, final, { ms, signal }) {
  if (signal?.aborted) return Promise.resolve()
  const anim = unit.animate(keyframes, { duration: ms, easing: ease.travel })
  unit._skLift = anim
  Object.assign(unit.style, final)
  // A cancel leaves the unit where it was caught; the caller snaps it.
  signal?.addEventListener("abort", () => {
    if (anim.playState === "finished" || anim.playState === "idle") return
    try { anim.commitStyles() } catch {}
    anim.cancel()
  }, { once: true })
  track(anim, signal)
  return anim.finished.then(() => {}, () => {}).finally(() => {
    if (unit._skLift === anim) unit._skLift = null
  })
}

/**
 * Lift a built unit (absolutely positioned in the scene at its 1:1 size) from
 * its region in the screenshot (`from`, scene px) to its readable place (`to`,
 * scene px; to.w / unit width is its scale). Travels on ease.travel with the
 * long settle (never under 600ms) while its float shadow fades in. Resolves on
 * landing; the unit keeps data-lifted. fade: false skips the short fade-in at
 * the region, for a unit that already matches the capture pixel for pixel.
 */
export function lift(unit, { from, to, ms = 700, signal, fade = true } = {}) {
  prepUnit(unit)
  const n = naturalSize(unit)
  const a = liftTransform(toRect(from), n)
  const b = liftTransform(toRect(to), n)
  const shadow = shadowPair(unit)
  unit.setAttribute("data-lifted", "")
  const final = { transform: b, boxShadow: shadow.on, opacity: "1" }
  if (reduced.matches) {
    Object.assign(unit.style, final)
    return Promise.resolve()
  }
  // The unit appears over its own region as it starts to rise, so it hands
  // off from the capture instead of popping on top of it.
  return runLift(unit, [
    { transform: a, boxShadow: shadow.off, opacity: fade ? 0 : 1, offset: 0 },
    { opacity: 1, offset: fade ? 0.12 : 0 },
    { transform: b, boxShadow: shadow.on, opacity: 1, offset: 1 },
  ], final, { ms: Math.max(600, ms), signal })
}

/**
 * The reverse of lift: the shadow fades first, then the unit travels back to
 * `to` (its region, scene px) and hands back to the capture by fading out
 * (fade: false keeps it visible there). Removes data-lifted.
 */
export function setDown(unit, { to, ms = 500, signal, fade = true } = {}) {
  const n = naturalSize(unit)
  prepUnit(unit)
  const start = unit.style.transform || getComputedStyle(unit).transform
  const b = liftTransform(toRect(to), n)
  const shadow = shadowPair(unit)
  unit.removeAttribute("data-lifted")
  const final = { transform: b, boxShadow: "", opacity: fade ? "0" : "1" }
  if (reduced.matches) {
    Object.assign(unit.style, final)
    return Promise.resolve()
  }
  return runLift(unit, [
    { transform: start, boxShadow: shadow.on, opacity: 1, offset: 0 },
    { transform: start, boxShadow: shadow.off, offset: 0.2 },
    { opacity: 1, offset: fade ? 0.88 : 1 },
    { transform: b, boxShadow: shadow.off, opacity: fade ? 0 : 1, offset: 1 },
  ], final, { ms, signal })
}

/**
 * The largest rect for a unit of natural size { w, h }, scaled at most `max`
 * (1 = 1:1) and to fit inside `bounds` less `gutter`, centered on `around`'s
 * center and moved so it stays `gutter` px inside `bounds`. All scene px.
 */
export function fitRect(size, around, bounds, { gutter = 20, max = 1 } = {}) {
  const s = toRect(size)
  const a = toRect(around)
  const B = toRect(bounds)
  const k = Math.max(0, Math.min(max, (B.w - 2 * gutter) / s.w, (B.h - 2 * gutter) / s.h))
  const w = s.w * k
  const h = s.h * k
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi))
  return {
    x: clamp(a.x + a.w / 2 - w / 2, B.x + gutter, B.x + B.w - gutter - w),
    y: clamp(a.y + a.h / 2 - h / 2, B.y + gutter, B.y + B.h - gutter - h),
    w,
    h,
  }
}

/**
 * Like fitRect, but the lifted unit stays over its own place: it is centered
 * on `around` (the source region) and may run up to the bounds' edge, with no
 * gutter, on any side the source already touches (within `edge` px), so an
 * edge panel grows in place and covers its source instead of sliding toward
 * the middle and leaving a second copy beside it.
 */
export function coverRect(size, around, bounds, { gutter = 20, max = 1, edge = 24 } = {}) {
  const s = toRect(size)
  const a = toRect(around)
  const B = toRect(bounds)
  const touches = {
    left: a.x - B.x <= edge,
    right: B.x + B.w - (a.x + a.w) <= edge,
    top: a.y - B.y <= edge,
    bottom: B.y + B.h - (a.y + a.h) <= edge,
  }
  const gx = (touches.left ? 0 : gutter) + (touches.right ? 0 : gutter)
  const gy = (touches.top ? 0 : gutter) + (touches.bottom ? 0 : gutter)
  const k = Math.max(0, Math.min(max, (B.w - gx) / s.w, (B.h - gy) / s.h))
  const w = s.w * k
  const h = s.h * k
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi))
  const lo = { x: B.x + (touches.left ? 0 : gutter), y: B.y + (touches.top ? 0 : gutter) }
  const hi = { x: B.x + B.w - (touches.right ? 0 : gutter) - w, y: B.y + B.h - (touches.bottom ? 0 : gutter) - h }
  return {
    x: clamp(touches.left && !touches.right ? B.x : touches.right && !touches.left ? B.x + B.w - w : a.x + a.w / 2 - w / 2, lo.x, hi.x),
    y: clamp(touches.top && !touches.bottom ? B.y : touches.bottom && !touches.top ? B.y + B.h - h : a.y + a.h / 2 - h / 2, lo.y, hi.y),
    w,
    h,
  }
}

// ---------- Visibility ----------

/** IntersectionObserver wrapper. Returns a function that stops observing. */
export function inView(root, { onEnter, onLeave, rootMargin = "0px", threshold = 0.25 } = {}) {
  let inside = false
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting && !inside) { inside = true; onEnter?.(e) }
      else if (!e.isIntersecting && inside) { inside = false; onLeave?.(e) }
    }
  }, { rootMargin, threshold })
  io.observe(root)
  return () => io.disconnect()
}
