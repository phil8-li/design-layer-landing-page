// Design Layer landing page: the story, told by scroll.
//
// Progressive: without this file every section still reads, every feature
// section shows its stage's poster, and every link works. With it, three kinds
// of motion run:
//   1. Scenes, scrubbed by scroll in one rAF loop: the pinned hero (three
//      planes held apart, then landed one by one), the pinned feature tracks
//      (scroll walks the tabs, and each tab sets its stage's beat), and
//      headings brightening word by word.
//   2. Arrivals, fired once by an IntersectionObserver: the stages loading as
//      their section nears, the get-started scenes, the counters.
//   3. Interactions: tabs that scroll to their stretch, copy buttons, the
//      film, and the hero leaning toward the pointer.
// Reduced motion skips 1 entirely (CSS lays every scene out in its final
// frame) and keeps 2 and 3 as instant state changes.

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
const SHOTS = "assets/shots"
const REPO = "phil8-li/design-layer"
const VIEW = { w: 1600, h: 1000 } // the CSS size every shot was captured at
const SEAM = { left: 0.1559, right: 0.8188 } // the editor's panel edges, unless a demo measured its own

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const range = (value, start, end) => clamp((value - start) / (end - start))
const lerp = (a, b, t) => a + (b - a) * t
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t) => 1 - (1 - t) ** 3
const $ = (selector, scope = document) => scope.querySelector(selector)
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)]

/* ---------- Demo app: which real app the screenshots show ---------- */

const params = new URLSearchParams(location.search)
let demo = params.get("demo") || (params.has("review") && localStorage.getItem("dl-demo")) || "midday"
let demos = []
let geometry = {} // where the demo on show draws its toolbar and panel seams, in shot pixels

const shotPath = (src, slug) => src.replace(/(assets\/shots\/)[^/]+\//, `$1${slug}/`)
const shotFile = (src, name) => src.replace(/[a-z-]+-(\d+)\.webp/, `${name}-$1.webp`)

// Only the hero's screenshots follow the demo; the feature stages draw their own app.
function applyDemo(slug) {
  demo = slug
  const info = demos.find((entry) => entry.slug === slug)
  const missing = new Set(info?.missing ?? [])
  geometry = info?.geometry ?? {}
  // Panel widths differ between captures; the strips follow this demo's seams.
  const seams = geometry.seams ?? SEAM
  for (const layer of $$(".frame-zoom, [data-plane-chrome]")) {
    layer.style.setProperty("--seam-l", seams.left)
    layer.style.setProperty("--seam-r", seams.right)
  }
  placeToolbars()
  for (const img of $$("img[data-shot]")) {
    // A demo without a bare hero shows its own hero there, toolbar and all.
    const name = img.dataset.shot === "hero-bare" && missing.has("hero-bare") ? "hero" : img.dataset.shot
    // A shot this demo could not capture falls back to the default demo's.
    const target = missing.has(name) ? demos[0]?.slug ?? slug : slug
    const move = (src) => shotPath(shotFile(src, name), target)
    img.src = move(img.getAttribute("src"))
    const set = img.getAttribute("srcset")
    if (set) img.srcset = set.split(",").map((part) => move(part.trim())).join(", ")
  }
  measureAll()
}

async function loadDemos() {
  try {
    const response = await fetch(`${SHOTS}/demos.json`)
    if (response.ok) demos = await response.json()
  } catch {}
  if (demos.length && !demos.some((entry) => entry.slug === demo)) demo = demos[0].slug
  if (demos.length > 1 && params.has("review")) mountReviewPicker()
  applyDemo(demo)
}

function mountReviewPicker() {
  const bar = document.createElement("div")
  bar.className = "review"
  bar.setAttribute("role", "radiogroup")
  bar.setAttribute("aria-label", "Demo app shown in the screenshots")
  const label = document.createElement("span")
  label.className = "review-label"
  label.textContent = "Demo app"
  bar.append(label)
  const buttons = demos.map((entry) => {
    const button = document.createElement("button")
    button.type = "button"
    button.setAttribute("role", "radio")
    button.setAttribute("aria-checked", String(entry.slug === demo))
    button.tabIndex = entry.slug === demo ? 0 : -1
    button.textContent = entry.name.split(" (")[0]
    button.title = entry.name
    button.addEventListener("click", () => {
      for (const other of buttons) {
        other.setAttribute("aria-checked", String(other === button))
        other.tabIndex = other === button ? 0 : -1
      }
      localStorage.setItem("dl-demo", entry.slug)
      const next = new URL(location.href)
      next.searchParams.set("demo", entry.slug)
      history.replaceState(null, "", next)
      applyDemo(entry.slug)
    })
    return button
  })
  bar.append(...buttons)
  bar.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
    const index = buttons.indexOf(document.activeElement)
    if (index < 0) return
    event.preventDefault()
    const next = buttons[(index + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length]
    next.focus()
    next.click()
  })
  document.body.append(bar)
}

/* ---------- The scene loop ---------- */

const scenes = new Map() // element -> { update, active }
let ticking = false

const sceneObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const scene = scenes.get(entry.target)
    if (!scene) continue
    scene.active = entry.isIntersecting
    // A scene leaving the screen gets one last frame, so it rests at its
    // start or its end rather than wherever the last scroll event left it.
    if (!scene.active && !reducedMotion.matches) scene.update(entry.target.getBoundingClientRect(), window.innerHeight)
  }
  requestTick()
}, { rootMargin: "25% 0px 25% 0px" })

function addScene(element, update) {
  if (!element) return
  scenes.set(element, { update, active: false })
  sceneObserver.observe(element)
}

function requestTick() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(tick)
}

function tick() {
  ticking = false
  const vh = window.innerHeight
  showNav()
  if (reducedMotion.matches) return
  for (const [element, scene] of scenes) if (scene.active) scene.update(element.getBoundingClientRect(), vh)
}

/* ---------- The editor's toolbar, redrawn over the screenshots ---------- */

// Each [data-toolbar-slot] becomes a copy of the real toolbar, sized in the
// shot's own pixels, so it stays sharp as the hero's planes land and can show
// a state the screenshot under it does not (Notes pressed, a tooltip).
const toolbars = []
const TOOLBAR = { x: 636, y: 948, w: 328, h: 40 } // where the editor draws it at 1600x1000

function setupToolbars() {
  const template = $("#toolbar")
  if (!template) return
  for (const slot of $$("[data-toolbar-slot]")) {
    const tb = template.content.firstElementChild.cloneNode(true)
    slot.replaceWith(tb)
    toolbars.push({
      tb,
      chip: $("[data-tb-chip]", tb),
      tools: Object.fromEntries($$("[data-tool]", tb).map((tool) => [tool.dataset.tool, tool])),
      tour: slot.hasAttribute("data-tour"),
    })
  }
  // The hero's app plane shows the same capture with the toolbar hidden
  // (hero-bare), so the only toolbar on screen is the one that lands.
  for (const img of $$("[data-hero] .plane-app img[data-shot='hero']")) {
    img.dataset.shot = "hero-bare"
    img.src = shotFile(img.getAttribute("src"), "hero-bare")
    img.srcset = img.getAttribute("srcset").split(",").map((part) => shotFile(part.trim(), "hero-bare")).join(", ")
  }
  placeToolbars()
  // The editor measures each tip and rounds its box up to a whole pixel.
  document.fonts.ready.then(() => {
    for (const tool of $$(".tb-tool[data-tip]")) {
      const width = Number.parseFloat(getComputedStyle(tool, "::after").width)
      if (!width) continue
      tool.style.setProperty("--tip-w", `${Math.ceil(width)}px`)
      tool.classList.add("is-sized")
    }
  })
}

function placeToolbars() {
  const at = geometry.toolbar ?? TOOLBAR
  for (const { tb } of toolbars) {
    tb.style.left = `${at.x}px`
    tb.style.top = `${at.y}px`
  }
}

/** 0 = Inspect, 1 = Notes; fractions slide the accent square between them. */
function setToolbarMode(toolbar, value) {
  toolbar.chip.style.setProperty("--chip", value.toFixed(3))
  toolbar.tools.inspect.classList.toggle("is-on", value < 0.5)
  toolbar.tools.notes.classList.toggle("is-on", value >= 0.5)
}

function showTip(toolbar, name) {
  for (const [key, tool] of Object.entries(toolbar.tools)) tool.classList.toggle("show-tip", key === name)
}

/** On first load, the hero's toolbar shows what its two modes are, once. */
function tourToolbar() {
  const toolbar = toolbars.find((entry) => entry.tour)
  if (!toolbar || reducedMotion.matches || window.scrollY > 40) return
  const end = () => {
    timers.forEach(clearTimeout)
    toolbar.tb.classList.remove("is-touring")
    setToolbarMode(toolbar, 0)
    showTip(toolbar, null)
    window.removeEventListener("scroll", onScroll)
  }
  const onScroll = () => window.scrollY > 40 && end()
  const timers = [
    setTimeout(() => {
      toolbar.tb.classList.add("is-touring")
      setToolbarMode(toolbar, 1)
      showTip(toolbar, "notes")
    }, 2000), // once the planes have drifted apart
    setTimeout(() => {
      setToolbarMode(toolbar, 0)
      showTip(toolbar, "inspect")
    }, 3600),
    setTimeout(() => showTip(toolbar, null), 4900),
    setTimeout(end, 5300), // after the tip has faded, so nothing snaps
  ]
  window.addEventListener("scroll", onScroll, { passive: true })
}

/** Keeps each 1600x1000 drawing layer scaled to the frame it sits in. */
function setupShotSpaces() {
  const spaces = $$("[data-shot-space]")
  if (!spaces.length) return
  const fit = () => {
    for (const space of spaces) space.style.setProperty("--k", String(space.parentElement.clientWidth / VIEW.w))
  }
  fit()
  const observer = new ResizeObserver(fit)
  for (const space of spaces) observer.observe(space.parentElement)
}

/* ---------- Scene: the hero ---------- */

// Three planes, held apart in a gentle 3/4 view: the app at the bottom, the
// editor's panels on a sheet of glass above it, the toolbar on top. At rest
// the stack leans a few degrees toward the pointer. Scroll turns it flat and
// lands the planes in order — panels, then the toolbar, which presses in and
// settles while a soft light marks the click — and every transform ends at
// none, so the layers meet pixel for pixel in the real screenshot. They land
// straight into the frame of Design like Figma, pinned underneath at the
// mock's own size and place, so the hand-off is one move with no size change;
// the stage underneath is the same capture, so the mock fades into it (handOff).
const hero = (() => {
  const track = $("[data-hero]")
  if (!track) return null
  const copy = $("[data-hero-copy]", track)
  const film = $("[data-hero-film]", track)
  const stack = $("[data-stack]", track)
  const chrome = $("[data-plane-chrome]", track)
  const tools = $("[data-plane-tools]", track)
  const view = $(".plane-app .frame-view", track)
  // The landing's clock, q: its last beat ends at q 0.47, one screen in. The
  // next section's lead-in (data-lead, in vh) is that screen's last stretch.
  const LANDED = 0.47
  const next = $("#edit [data-tabs][data-lead]")
  const nextView = next && $("#edit-view", next)
  const nextFrame = nextView?.closest(".frame")
  const nextFade = next ? $$(".section-head, .switcher-tabs", next) : []
  let base = null // the mock's frame view, untransformed, relative to the stage
  let goal = { x: 0, y: 0, s: 1 } // the film transform that lands it in that frame
  // The resting pose (degrees), and how far apart the planes float, as a share
  // of the stack's width. A phone gets a little less turn.
  const POSES = {
    wide: { rx: 24, ry: 13, rz: -4 },
    narrow: { rx: 20, ry: 10, rz: -3 },
  }
  const DEPTH = { chrome: 0.09, tools: 0.2 }
  const LEAN = { x: 3, y: 2 } // pointer parallax, degrees
  const TURN = [0.01, 0.34] // rise and flatten share one window, so the stack grows in place
  let pose = POSES.wide
  let scale = 0.8
  let startY = 0
  let startX = 0
  let zChrome = 0
  let zTools = 0
  let toolbar = null
  let intro = 1 // planes drift apart once, on first load
  const lean = { x: 0, y: 0, tx: 0, ty: 0, frame: 0, last: 0 }

  const stackTransform = (rx, ry, rz, s) =>
    Math.abs(rx) + Math.abs(ry) + Math.abs(rz) < 0.01 && Math.abs(s - 1) < 0.0005
      ? "none"
      : `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) rotateZ(${rz.toFixed(3)}deg) scale(${s.toFixed(4)})`

  function measure() {
    toolbar = toolbars.find((entry) => tools.contains(entry.tb)) ?? null
    const width = stack.offsetWidth
    pose = width < 700 ? POSES.narrow : POSES.wide
    zChrome = width * DEPTH.chrome
    zTools = width * DEPTH.tools
    // Fit the separated stack, as drawn, between the copy and the fold.
    const saved = [film, stack, chrome, tools, toolbar?.tb].map((node) => node?.style.transform)
    film.style.transform = "none"
    chrome.style.transform = `translate3d(0, 0, ${zChrome}px)`
    tools.style.transform = `translate3d(0, 0, ${zTools}px)`
    if (toolbar) toolbar.tb.style.transform = "scale(1.25)"
    // The tools plane itself is invisible: only its toolbar takes up room.
    const bounds = (s) => {
      stack.style.transform = stackTransform(pose.rx, pose.ry, pose.rz, s)
      const base = film.getBoundingClientRect()
      const rects = [stack, chrome, toolbar?.tb ?? tools].map((node) => node.getBoundingClientRect())
      const top = Math.min(...rects.map((r) => r.top)) - base.top
      const bottom = Math.max(...rects.map((r) => r.bottom)) - base.top
      const left = Math.min(...rects.map((r) => r.left))
      const right = Math.max(...rects.map((r) => r.right))
      return { top, bottom, h: bottom - top, w: right - left, mid: (left + right) / 2 - (base.left + base.width / 2) }
    }
    const copyBottom = copy.offsetTop + copy.offsetHeight
    const fold = Math.min(film.parentElement.clientHeight, window.innerHeight - (track.getBoundingClientRect().top + window.scrollY)) - 16
    const roomTop = copyBottom + 48
    const room = fold - roomTop
    let box = bounds(1)
    const roomW = window.innerWidth - (window.innerWidth < 700 ? 24 : 64)
    scale = clamp(Math.min(room / box.h, roomW / box.w), 0.4, 1)
    // Perspective makes the fit slightly non-linear; settle it in two passes.
    for (let i = 0; i < 2; i++) {
      box = bounds(scale)
      scale = clamp(scale * Math.min(room / box.h, roomW / box.w), 0.4, 1)
    }
    box = bounds(scale)
    ;[film, stack, chrome, tools, toolbar?.tb].forEach((node, i) => node && (node.style.transform = saved[i] ?? ""))
    // Centre what is drawn, not the box it is drawn in: the turn pushes it off
    // axis. Spare height goes mostly below, so the lockup sits a touch high.
    startY = roomTop + Math.max(0, (room - box.h) * 0.35) - (film.offsetTop + box.top)
    startX = -box.mid
    for (const node of [film, stack, chrome, tools]) node.style.transform = "none"
    const stageBox = film.parentElement.getBoundingClientRect()
    const filmBox = film.getBoundingClientRect()
    const viewBox = view.getBoundingClientRect()
    base = { fx: filmBox.left - stageBox.left, fy: filmBox.top - stageBox.top, ox: viewBox.left - filmBox.left, oy: viewBox.top - filmBox.top, w: viewBox.width }
    ;[film, stack, chrome, tools].forEach((node, i) => (node.style.transform = saved[i] ?? ""))
    film.style.transformOrigin = "0 0"
    // Where that frame sits once its stage pins. The stage (stages/edit.js) is
    // the same capture at the mock's 1.6, bare, so the mock lands on the whole
    // stage and the picture simply continues.
    if (nextView) {
      const pinned = $(".tabs-stage", next).getBoundingClientRect()
      const target = nextView.getBoundingClientRect()
      const s = target.width / base.w
      goal = { x: target.left - stageBox.left - base.fx - s * base.ox, y: target.top - pinned.top - base.fy - s * base.oy, s }
    }
  }

  /** The hand-off over the next section's lead-in: its title and tabs fade in
   *  over the landed mock, and its frame takes over in the same place. */
  function handOff(vh) {
    if (!next) return
    const box = next.getBoundingClientRect()
    const lead = (Number(next.dataset.lead) / 100) * vh
    const f = clamp(-box.top / lead)
    next.classList.toggle("is-waiting", box.top > 0.5)
    const rise = easeOut(range(f, 0.1, 0.7))
    for (const node of nextFade) {
      node.style.opacity = rise.toFixed(3)
      node.style.transform = rise < 1 ? `translate3d(0, ${(16 * (1 - rise)).toFixed(1)}px, 0)` : ""
    }
    // The mock holds landed; the stage (the same capture on the same rect)
    // comes up under it, then the mock and its rim fade away, so the picture
    // never changes and only the rim is seen to go.
    nextFrame.style.opacity = range(f, 0.6, 0.75).toFixed(3)
    film.style.opacity = (1 - range(f, 0.82, 0.96)).toFixed(3)
    film.style.visibility = f >= 1 ? "hidden" : ""
  }

  function update(rect, vh) {
    const q = clamp((-rect.top / vh) * LANDED) // the landing's own progress

    // The copy steps back, and the film rises into the space it leaves.
    const leave = range(q, 0, 0.18)
    copy.style.transform = leave > 0 ? `translate3d(0, ${(-48 * easeOut(leave)).toFixed(1)}px, 0)` : ""
    copy.style.opacity = String(1 - easeOut(leave))
    copy.inert = leave > 0.6
    copy.style.visibility = leave >= 1 ? "hidden" : ""
    const turn = easeInOut(range(q, ...TURN))
    const y = lerp(startY, goal.y, turn)
    const x = lerp(startX, goal.x, turn)
    const fit = lerp(1, goal.s, turn)
    film.style.transform = Math.abs(x) + Math.abs(y) < 0.25 && Math.abs(fit - 1) < 0.0005 ? "none" : `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${fit.toFixed(4)})`

    // The stack turns flat as it rises; the lean toward the pointer fades as scroll starts.
    const still = 1 - easeOut(range(q, 0, 0.04))
    const rx = pose.rx * (1 - turn) - lean.y * LEAN.y * still
    const ry = pose.ry * (1 - turn) + lean.x * LEAN.x * still
    stack.style.transform = stackTransform(rx, ry, pose.rz * (1 - turn), lerp(scale, 1, turn))

    // The panels land first, then the toolbar, which presses in once and settles.
    const panels = (1 - easeInOut(range(q, 0.06, 0.34))) * intro
    const bar = (1 - easeInOut(range(q, 0.14, 0.4))) * intro
    const settle = range(q, 0.4, 0.47)
    const press = 1 - 0.035 * Math.sin(Math.PI * settle)
    chrome.style.transform = panels * zChrome > 0.3 ? `translate3d(0, 0, ${(panels * zChrome).toFixed(1)}px)` : "none"
    tools.style.transform = bar * zTools > 0.3 ? `translate3d(0, 0, ${(bar * zTools).toFixed(1)}px)` : "none"
    chrome.style.setProperty("--lift", panels.toFixed(3))
    tools.style.setProperty("--lift", bar.toFixed(3))
    if (toolbar) {
      const s = lerp(1, 1.25, bar) * press
      toolbar.tb.style.transform = Math.abs(s - 1) > 0.0005 ? `scale(${s.toFixed(4)})` : ""
    }
    view.style.setProperty("--dim", (0.3 * panels).toFixed(3))
    handOff(vh)
  }

  /** On first load the planes drift apart, so the stack reads as layers. */
  function playIntro() {
    if (reducedMotion.matches || window.scrollY > 40) return
    intro = 0
    const started = performance.now() + 420
    const step = (now) => {
      const t = range(now - started, 0, 1400)
      intro = 1 - (1 - t) ** 4 // a long ease-out: they float apart and come to rest
      requestTick()
      if (t < 1) requestAnimationFrame(step)
      else intro = 1
    }
    requestAnimationFrame(step)
  }

  /** At rest, the stack leans a few degrees toward a fine pointer. */
  function follow(now) {
    // Frame-rate independent smoothing: about 90% of the way in 400ms.
    const dt = lean.last ? Math.min(64, now - lean.last) : 16
    lean.last = now
    const k = 1 - Math.exp(-dt / 170)
    lean.x += (lean.tx - lean.x) * k
    lean.y += (lean.ty - lean.y) * k
    requestTick()
    const moving = Math.abs(lean.tx - lean.x) + Math.abs(lean.ty - lean.y) > 0.002
    lean.frame = moving ? requestAnimationFrame(follow) : 0
    if (!moving) lean.last = 0
  }

  const aim = (tx, ty) => {
    lean.tx = tx
    lean.ty = ty
    if (!lean.frame) lean.frame = requestAnimationFrame(follow)
  }

  window.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || reducedMotion.matches || event.pointerType !== "mouse") return
    if (window.scrollY > window.innerHeight * 0.1) return
    aim(clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1), clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1))
  }, { passive: true })
  // When the pointer leaves the window, the stack eases back to its pose.
  document.documentElement.addEventListener("mouseleave", () => aim(0, 0))

  function reset() {
    for (const node of [film, copy, stack, next, nextFrame, ...nextFade]) node?.removeAttribute("style")
    for (const node of [chrome, tools]) {
      node.style.removeProperty("transform")
      node.style.removeProperty("--lift")
    }
    view.style.removeProperty("--dim")
    toolbar?.tb.style.removeProperty("transform")
    copy.inert = false
  }

  addScene(track, update)
  return { measure, reset, playIntro }
})()

/* ---------- Tabs: the pill and the keys every tab set shares ---------- */

function movePill(pill, tab, animate) {
  if (!pill || !tab) return
  pill.classList.toggle("no-motion", !animate || reducedMotion.matches)
  pill.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px) scaleX(${tab.offsetWidth / 100})`
  pill.style.height = `${tab.offsetHeight}px`
}

/** On a narrow screen the tab row scrolls; keep the chosen tab in view. */
function centerTab(tab) {
  const list = tab.parentElement
  if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2, behavior: reducedMotion.matches ? "instant" : "smooth" })
}

/** Scrolls to a share of a pinned track, after its lead-in. Pinned, the stage
 *  holds still and only the tab changes, so jump; from outside, travel there. */
function scrollTrack(track, share, lead = 0) {
  const rect = track.getBoundingClientRect()
  const pinned = rect.top <= 1 && rect.bottom >= window.innerHeight - 1
  window.scrollTo({ top: rect.top + window.scrollY + lead + (track.offsetHeight - window.innerHeight - lead) * share, behavior: pinned ? "instant" : "smooth" })
}

/** Click to choose; arrows, Home and End move along the tablist. */
function tabKeys(tabs, current, choose) {
  tabs.forEach((node, i) => {
    node.addEventListener("click", () => choose(i))
    node.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
      const to = step ? current() + step : { Home: 0, End: tabs.length - 1 }[event.key]
      if (to === undefined) return
      event.preventDefault()
      choose((to + tabs.length) % tabs.length, { focus: true })
    })
  })
}

/* ---------- The nav arrives with the second section ---------- */

// The hero is the headline and the mockup alone. The nav slides in once
// Design like Figma's stage pins, which is also when the hero's copy is gone.
const nav = $("[data-nav]")
const navAfter = $("#edit")
let navShown

function showNav() {
  if (!nav || !navAfter) return
  const shown = navAfter.getBoundingClientRect().top <= 1
  if (shown === navShown) return
  navShown = shown
  nav.classList.toggle("is-shown", shown)
  nav.inert = !shown
}

/* ---------- Arrivals ---------- */

const arrivals = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    arrivals.unobserve(entry.target)
    entry.target.classList.add("is-in")
    entry.target.dispatchEvent(new CustomEvent("arrive"))
  }
}, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" })

const onArrive = (element, run) => {
  if (!element) return
  element.addEventListener("arrive", run, { once: true })
  arrivals.observe(element)
}

/** Wraps each word of a heading so it can brighten on its own beat. */
function splitWords(heading) {
  let index = 0
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment()
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue
          if (/^\s+$/.test(part)) {
            fragment.append(part)
            continue
          }
          const word = document.createElement("span")
          word.className = "w"
          word.style.setProperty("--i", index++)
          word.textContent = part
          fragment.append(word)
        }
        child.replaceWith(fragment)
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "KBD") {
        walk(child)
      }
    }
  }
  walk(heading)
  heading.classList.add("words")
}

/* ---------- Scene: headings brighten word by word as they rise ---------- */

// Each word lights as it travels from the bottom of the screen to 80% of the
// way up, a little later the further right it sits, so a heading reads in
// order line by line. By 80% every word is fully lit.
const headings = []

function setupHeadings() {
  for (const heading of $$("h2:not(.visually-hidden)")) {
    splitWords(heading)
    const words = $$(".w", heading)
    const entry = { heading, marks: [] }
    entry.measure = () => {
      const box = heading.getBoundingClientRect()
      entry.marks = words.map((word) => {
        const r = word.getBoundingClientRect()
        return { word, y: r.top + r.height / 2 - box.top, x: (r.left - box.left) / Math.max(1, box.width), lit: -1 }
      })
    }
    entry.measure()
    headings.push(entry)
    addScene(heading, (rect, vh) => {
      for (const mark of entry.marks) {
        const start = vh * (1 - 0.06 * mark.x)
        const end = vh * (0.86 - 0.06 * mark.x)
        const lit = Math.round(range(rect.top + mark.y, start, end) * 100) / 100
        if (lit === mark.lit) continue
        mark.lit = lit
        mark.word.style.setProperty("--lit", lit)
      }
    })
  }
}

// The hero's app token cycles the kinds of app Design Layer works on, on its
// own while the hero is on screen and on each click. The old word lifts out as
// the new one rises in, and the pill glides to the new width; the first line
// ends at a hard break, so only the second line ever moves.
function setupToken() {
  const token = $("[data-token]")
  if (!token) return
  const words = $(".token-words", token)
  const art = $(".token-art", token)
  const KINDS = [["vibe-coded", "Sparkles"], ["React", "Code"], ["Angular", "Component"]]
  const ease = "cubic-bezier(0.23, 1, 0.32, 1)"
  let at = 0
  let timer = 0
  let held = false
  let seen = false

  function advance() {
    at = (at + 1) % KINDS.length
    const old = $(".token-word:last-child", words)
    const from = words.offsetWidth
    const word = document.createElement("span")
    word.className = "token-word"
    word.textContent = KINDS[at][0]
    words.append(word)
    $("use", art).setAttribute("href", `assets/icons.svg#i-${KINDS[at][1]}`)
    if (reducedMotion.matches) return old.remove()
    old.setAttribute("aria-hidden", "true")
    old.animate({ opacity: [1, 0], transform: ["none", "translateY(-0.32em)"], filter: ["none", "blur(4px)"] }, { duration: 240, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }).finished.then(() => old.remove(), () => old.remove())
    word.animate({ opacity: [0, 1], transform: ["translateY(0.32em)", "none"], filter: ["blur(4px)", "none"] }, { duration: 460, delay: 90, easing: ease, fill: "backwards" })
    words.animate({ width: [`${from}px`, `${word.offsetWidth}px`] }, { duration: 560, easing: "cubic-bezier(0.65, 0, 0.35, 1)" })
    art.animate({ transform: ["scale(0.6)", "none"] }, { duration: 560, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" })
  }

  function schedule() {
    clearTimeout(timer)
    if (!held && seen && !document.hidden && !reducedMotion.matches) timer = setTimeout(() => {
      if (!token.closest("[inert]")) advance()
      schedule()
    }, 2600)
  }

  const hold = (on) => () => ((held = on), schedule())
  token.addEventListener("click", () => (advance(), schedule()))
  token.addEventListener("pointerenter", hold(true))
  token.addEventListener("pointerleave", hold(false))
  token.addEventListener("focus", hold(true))
  token.addEventListener("blur", hold(false))
  document.addEventListener("visibilitychange", schedule)
  reducedMotion.addEventListener("change", schedule)
  new IntersectionObserver(([entry]) => ((seen = entry.isIntersecting), schedule()), { threshold: [0, 1] }).observe(token)
}

// A drawn slider over a native range input. A press sets the value whose thumb
// center is under the pointer, then drags; the input keeps the keyboard (its
// own pointer mapping is a few px off the drawn thumb). `change` gets numbers.
function slider(track, change) {
  const input = $("input", track)
  const show = () => track.style.setProperty("--p", (input.value - input.min) / (input.max - input.min))
  const seek = (event) => {
    const style = getComputedStyle(track)
    const edge = parseFloat(style.getPropertyValue("--inset")) + parseFloat(style.getPropertyValue("--knob-w")) / 2
    const box = track.getBoundingClientRect()
    const p = clamp((event.clientX - box.left - edge) / (box.width - 2 * edge))
    const [min, max, step] = [input.min, input.max, input.step].map(Number)
    const value = String(min + Math.round((p * (max - min)) / step) * step)
    if (value === input.value) return
    input.value = value
    input.dispatchEvent(new Event("input", { bubbles: true }))
  }
  track.addEventListener("pointerdown", (event) => {
    input.focus({ preventScroll: true })
    track.setPointerCapture(event.pointerId)
    track.dataset.dragging = track.dataset.pointer = ""
    seek(event)
  })
  track.addEventListener("pointermove", (event) => track.hasPointerCapture(event.pointerId) && seek(event))
  // The press keeps focus on the input instead of moving it to the page.
  track.addEventListener("mousedown", (event) => event.preventDefault())
  for (const type of ["pointerup", "pointercancel"]) track.addEventListener(type, () => delete track.dataset.dragging)
  input.addEventListener("input", () => (show(), change(Number(input.value))))
  // Chrome marks a script-focused range :focus-visible; the ring waits for a key.
  for (const type of ["keydown", "blur"]) input.addEventListener(type, () => delete track.dataset.pointer)
  show()
  return (value) => ((input.value = value), show(), change(Number(input.value)))
}

// The footer's inspector. The color wheel is a strip of swatches dragged under
// a fixed frame, as in graphicalui.com's theme panel: it wraps around, and the
// page's accent (and the WebGL blinds', via an "accent" event) follows the
// swatch in the frame while it moves. The sliders set the wordmark's weight
// and spacing. Nothing is kept: a reload is back to indigo.
function setupTweak() {
  const form = $("[data-tweak]")
  if (!form) return
  const root = document.documentElement.style
  const word = $(".endcard-word")
  const wheel = $("[data-wheel]", form)
  const picker = $("input", wheel)
  const SWATCHES = [["Indigo", "#798cff", "#4a5df9"], ["Violet", "#a78bfa", "#7c4dff"], ["Purple", "#c084fc", "#9333ea"], ["Fuchsia", "#e879f9", "#c026d3"], ["Pink", "#f472b6", "#db2777"], ["Rose", "#fb7185", "#e11d48"], ["Red", "#f87171", "#dc2626"], ["Coral", "#ff8a65", "#e8501c"], ["Orange", "#fb923c", "#ea580c"], ["Amber", "#fbbf24", "#d18b00"], ["Lime", "#a3e635", "#5f9b0c"], ["Green", "#4ade80", "#16a34a"], ["Mint", "#34d399", "#059669"], ["Teal", "#2dd4bf", "#0d9488"], ["Sky", "#38bdf8", "#0284c7"], ["Blue", "#60a5fa", "#2563eb"]]
  const n = SWATCHES.length
  const W = 24 // one swatch, in px
  const chips = SWATCHES.map(([, accent]) => {
    const chip = document.createElement("span")
    chip.style.background = accent
    $(".wheel-window", wheel).append(chip)
    return chip
  })
  picker.max = n - 1
  let pos = 0 // the swatch under the frame, fractional while it moves
  let shown = 0
  let tween = 0

  const wrap = (i) => ((i % n) + n) % n
  function paint() {
    for (const [i, chip] of chips.entries()) {
      const d = wrap(i - pos + n / 2) - n / 2
      chip.style.transform = `translateX(${(d * W - W / 2).toFixed(2)}px)`
    }
    const i = wrap(Math.round(pos))
    if (i === shown) return
    shown = i
    const [name, accent, deep] = SWATCHES[i]
    root.setProperty("--accent", accent)
    root.setProperty("--accent-fill", deep)
    root.setProperty("--accent-text", `color-mix(in oklab, ${accent} 82%, #fff)`)
    root.setProperty("--accent-glow", `color-mix(in srgb, ${accent} 18%, transparent)`)
    wheel.style.setProperty("--wheel", accent)
    picker.value = i
    picker.setAttribute("aria-valuetext", name)
    dispatchEvent(new CustomEvent("accent", { detail: [accent, deep] }))
  }

  // Settles on whole swatch `to` along the shorter way round.
  function settle(to) {
    cancelAnimationFrame(tween)
    const from = pos
    const goal = from + (wrap(to - from + n / 2) - n / 2)
    if (reducedMotion.matches) return (pos = wrap(goal)), paint()
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / 380)
      pos = from + (goal - from) * (1 - (1 - t) ** 3)
      paint()
      if (t < 1) tween = requestAnimationFrame(step)
      else (pos = wrap(goal)), paint()
    }
    tween = requestAnimationFrame(step)
  }

  let drag = null
  wheel.addEventListener("pointerdown", (event) => {
    cancelAnimationFrame(tween)
    wheel.setPointerCapture(event.pointerId)
    drag = { x: event.clientX, pos, moved: false }
    wheel.dataset.dragging = ""
  })
  wheel.addEventListener("pointermove", (event) => {
    if (!drag) return
    const dx = event.clientX - drag.x
    if (Math.abs(dx) > 3) drag.moved = true
    pos = drag.pos - dx / W
    paint()
  })
  const release = (event) => {
    if (!drag) return
    delete wheel.dataset.dragging
    // A tap picks the swatch under it; a drag lands on the nearest one.
    const box = wheel.getBoundingClientRect()
    settle(drag.moved ? Math.round(pos) : Math.round(pos + (event.clientX - box.left - box.width / 2) / W))
    drag = null
  }
  wheel.addEventListener("pointerup", release)
  wheel.addEventListener("pointercancel", release)

  form.addEventListener("input", (event) => event.target === picker && settle(Number(picker.value)))
  form.addEventListener("submit", (event) => event.preventDefault())
  for (const track of $$(".tweak-track", form)) {
    const input = $("input", track)
    const output = $("output", track.closest("label"))
    slider(track, (value) => {
      if (input.name === "weight") word.style.setProperty("--wm-weight", value)
      else word.style.setProperty("--wm-spacing", `${value / 100}em`)
      output.value = input.name === "weight" ? value : `${value}%`
    })
  }
  shown = -1
  paint()
}

function setupArrivals() {
  for (const element of $$("[data-rise]")) onArrive(element, () => {})
  for (const list of $$("[data-reveal]")) onArrive(list, () => {})

  // The end card rises and its light sweeps across the name every time it
  // comes into view; once it has left the screen it resets for the next visit.
  const endcard = $("[data-endcard]")
  if (endcard) {
    new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio >= 0.2) endcard.classList.add("is-in")
      else if (!entry.isIntersecting) endcard.classList.remove("is-in")
    }, { threshold: [0, 0.2] }).observe(endcard)
  }

  // The get-started scenes play once: the selection lands, the Dock icon bounces.
  for (const scene of $$("[data-arrive]")) onArrive(scene, () => {})

  for (const counter of $$("[data-count-from]")) {
    onArrive(counter, () => {
      if (reducedMotion.matches) return
      const from = Number(counter.dataset.countFrom)
      const unit = counter.dataset.countUnit ?? ""
      const format = new Intl.NumberFormat("en")
      const started = performance.now()
      const step = (now) => {
        const t = range(now - started, 0, 1600)
        counter.textContent = `${format.format(Math.round(from * (1 - easeOut(t))))}${unit}`
        if (t < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
  }

  for (const typed of $$("[data-type]")) {
    const text = typed.textContent
    onArrive(typed, () => {
      if (reducedMotion.matches) return
      typed.style.minWidth = `${typed.offsetWidth}px`
      typed.textContent = ""
      let shown = 0
      const timer = setInterval(() => {
        typed.textContent = text.slice(0, ++shown)
        if (shown >= text.length) clearInterval(timer)
      }, 55)
    })
  }
}

/* ---------- Stages: the feature demos, drawn in the editor's own look ---------- */

// Each [data-stage] is a hand-built demo (stages/<name>.js, see stages/README.md)
// with numbered beats: set(k) from k - 1 plays beat k's gesture, any other
// change jumps to its rest. A stage loads when its section comes within one
// screen; until then, and without script, its poster shows the payoff. The page
// keeps the beat it wants for each stage, so a beat chosen before the module
// arrives is the one it mounts on.
const stages = new Map() // root -> { stage, wanted, shown }
let stageSheets = null

const sheetLoaded = (link) =>
  link.sheet ? Promise.resolve() : new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true })
    link.addEventListener("error", resolve, { once: true })
  })

/** The kit's two sheets, once, before the first stage mounts. */
function loadStageSheets() {
  stageSheets ??= Promise.all(["stagekit.css", "look-designlayer.css"].map((name) => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = new URL(`./stages/${name}`, import.meta.url).href
    document.head.append(link)
    return sheetLoaded(link)
  }))
  return stageSheets
}

function setStage(root, beat) {
  const entry = stages.get(root)
  if (!entry || entry.wanted === beat) return
  entry.wanted = beat
  if (entry.stage && entry.shown !== beat) {
    entry.shown = beat
    entry.stage.set(beat)
  }
}

async function mountStage(root) {
  const entry = stages.get(root)
  try {
    const [mod] = await Promise.all([import(`./stages/${root.dataset.stage}.js`), loadStageSheets()])
    entry.stage = mod.mount(root)
    // The drawn buttons and fields are a picture of the editor, not controls:
    // they take no focus or clicks, and the root's aria-label speaks for them.
    const scene = root.querySelector(":scope > .sk-scene")
    if (scene) scene.inert = true
    entry.shown = entry.wanted
    entry.stage.set(entry.wanted, { instant: true })
    // The module links its own sheet; the poster stays until that has applied,
    // so the swap is never to an unstyled scene.
    const pending = $$('link[rel="stylesheet"]').filter((link) => !link.sheet)
    await Promise.race([Promise.all(pending.map(sheetLoaded)), new Promise((r) => setTimeout(r, 3000))])
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    root.classList.add("is-mounted")
    const poster = root.parentElement.querySelector(":scope > .stage-poster")
    if (poster) poster.hidden = true
    // The frame's height is the stage's now, not the poster's; the pinned
    // stage centers its column on that height, so the hero re-measures where
    // Design like Figma's stage sits before the mock lands on it.
    if (root.dataset.stage === "edit") measureAll()
  } catch (error) {
    console.warn(`Stage ${root.dataset.stage} off:`, error) // the poster stays
  }
}

function setupStages() {
  const roots = $$("[data-stage]")
  for (const root of roots) stages.set(root, { stage: null, wanted: -1, shown: null })
  const near = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue
      near.unobserve(target)
      for (const root of roots) if (target.contains(root) && !stages.get(root).loading) {
        stages.get(root).loading = true
        mountStage(root)
      }
    }
  }, { rootMargin: "100% 0px" })
  for (const section of new Set(roots.map((root) => root.closest("section") ?? root))) near.observe(section)
}

/* ---------- Feature tracks: scroll walks the tabs, and the tabs move the scroll ---------- */

// Each feature section sits in a pinned track where every tab owns an equal
// stretch of scroll: scrolling advances the tab, the pill and the stage's beat,
// and the chosen tab fills as its stretch runs out. Choosing a tab scrolls to
// its stretch, so the scroll position and the selection never disagree. Until
// the stage pins it rests on its opening still, so the first beat's gesture
// plays where it can be seen. A track with no tabs (data-stage-beats="N")
// walks the opening still and then N beats. With reduced motion the tracks
// do not pin and the tabs are plain tabs.
const switchers = []

function setupSwitchers() {
  for (const track of $$("[data-tabs]")) {
    const switcher = $("[data-switcher]", track)
    const list = $('[role="tablist"]', track)
    const pill = $(".switcher-pill", track)
    const tabs = $$('[role="tab"]', track)
    const root = $("[data-stage]", track)
    const view = root?.closest(".frame-view")
    const beats = Number(track.dataset.stageBeats) || 0
    const weights = (list?.dataset.weights || "").split(/\s+/).map(Number).filter((n) => n > 0)
    while (weights.length < tabs.length) weights.push(1)
    const total = tabs.length ? weights.slice(0, tabs.length).reduce((a, b) => a + b, 0) : 1
    let index = 0
    // The track's height counts the stretches: a weighted tab counts as that
    // many; a track with no tabs may ask for more than one per beat
    // (data-stage-stretches), which lengthens each of its beats alike.
    track.style.setProperty("--tabs", tabs.length ? total : Number(track.dataset.stageStretches) || beats + 1)
    const scrolled = () => !reducedMotion.matches
    // A lead-in (data-lead, in vh) before the first tab: the hero's hand-off.
    const leadIn = () => ((Number(track.dataset.lead) || 0) / 100) * window.innerHeight
    const show = (beat) => root && setStage(root, beat)

    const placePill = (animate) => movePill(pill, tabs[index], animate)

    const select = (next, { focus = false } = {}) => {
      if (!tabs.length) return
      index = clamp(next, 0, tabs.length - 1)
      tabs.forEach((tab, i) => {
        tab.setAttribute("aria-selected", String(i === index))
        tab.tabIndex = i === index ? 0 : -1
        if (i !== index) tab.style.removeProperty("--fill")
      })
      view?.setAttribute("aria-labelledby", tabs[index].id)
      if (focus) tabs[index].focus({ preventScroll: true })
      placePill(true)
      // When the page scroll drives the tabs, slide() keeps the tab in view
      // and the scene sets the beat.
      if (!scrolled()) {
        centerTab(tabs[index])
        show(index)
      }
    }

    /** Selects a tab; on a scroll-driven set, by scrolling to its stretch. */
    const choose = (next, options) => {
      const target = clamp(next, 0, tabs.length - 1)
      select(target, options)
      if (scrolled()) scrollTrack(track, (weights.slice(0, target).reduce((a, b) => a + b, 0) + 0.04) / total, leadIn())
    }

    tabKeys(tabs, () => index, choose)

    // A row too wide for the screen scrolls sideways. It follows the page
    // scroll: as a tab's stretch runs out, the row slides the next one in.
    const center = (tab) => tab.offsetLeft + tab.offsetWidth / 2
    const slide = (fill) => {
      if (!list || list.scrollWidth <= list.clientWidth + 1) return
      const from = center(tabs[index])
      const to = center(tabs[Math.min(index + 1, tabs.length - 1)])
      list.scrollLeft = from + (to - from) * easeInOut(range(fill, 0.55, 1)) - list.clientWidth / 2
    }
    // Fade only the edges that have more tabs past them.
    const fade = () => {
      if (!list) return
      const max = list.scrollWidth - list.clientWidth
      list.style.setProperty("--fade-l", list.scrollLeft > 1 ? "24px" : "0px")
      list.style.setProperty("--fade-r", list.scrollLeft < max - 1 ? "24px" : "0px")
    }
    list?.addEventListener("scroll", fade, { passive: true })
    window.addEventListener("resize", fade)
    fade()

    addScene(track, (rect, vh) => {
      const lead = leadIn()
      const raw = (-rect.top - lead) / Math.max(1, rect.height - vh - lead)
      const p = clamp(raw)
      if (!tabs.length) {
        show(clamp(Math.floor(p * (beats + 1)) - 1, -1, beats - 1))
        return
      }
      // A tab's stretch of the track is its weight's share (data-weights on
      // the tablist, one number per tab; default 1 each), so a beat whose
      // gesture needs reading time holds the screen longer.
      const stop = (i) => weights.slice(0, i).reduce((a, b) => a + b, 0) / total
      let next = 0
      while (next < tabs.length - 1 && p >= stop(next + 1)) next++
      if (next !== index) select(next)
      show(raw < 0 ? -1 : index)
      const fill = clamp((p - stop(index)) / (weights[index] / total))
      tabs[index].style.setProperty("--fill", fill.toFixed(3))
      slide(fill)
    })

    const mode = () => {
      switcher?.classList.toggle("is-scrolling", scrolled() && tabs.length > 0)
      // Unpinned, the chosen tab's rest shows (the first tab's on load); the
      // board, with no tabs, rests on its first beat, the frame its poster shows.
      if (!scrolled()) show(tabs.length ? index : 0)
    }
    mode()
    switchers.push({ placePill, mode })
    placePill(false)
  }
  window.addEventListener("resize", () => switchers.forEach((entry) => entry.placePill(false)))
  document.fonts?.ready.then(() => switchers.forEach((entry) => entry.placePill(false)))
}

/* ---------- Pointer light on frames ---------- */

function setupGlow() {
  if (!finePointer.matches || reducedMotion.matches) return
  for (const frame of $$("[data-glow]")) {
    let pending = false
    let last = null
    frame.addEventListener("pointermove", (event) => {
      last = event
      if (pending) return
      pending = true
      requestAnimationFrame(() => {
        pending = false
        const rect = frame.getBoundingClientRect()
        frame.style.setProperty("--x", `${last.clientX - rect.left}px`)
        frame.style.setProperty("--y", `${last.clientY - rect.top}px`)
      })
    })
    frame.addEventListener("pointerenter", () => frame.classList.add("is-lit"))
    frame.addEventListener("pointerleave", () => frame.classList.remove("is-lit"))
  }
}

/* ---------- The film ---------- */

async function setupFilm() {
  const dialog = $("[data-film]")
  const opener = $("[data-film-open]")
  if (!dialog || !opener) return
  const video = $("[data-film-video]", dialog)
  const source = $("source", video)
  try {
    const response = await fetch(source.getAttribute("src"), { method: "HEAD" })
    if (!response.ok) throw new Error(String(response.status))
  } catch {
    opener.hidden = true // no film published yet: offer nothing rather than a broken player
    return
  }
  opener.addEventListener("click", () => {
    dialog.showModal()
    video.currentTime = 0
    video.play().catch(() => {})
  })
  const close = () => dialog.close()
  $("[data-film-close]", dialog).addEventListener("click", close)
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close()
  })
  dialog.addEventListener("close", () => video.pause())
}

/* ---------- Copy buttons ---------- */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.cssText = "position:fixed;opacity:0;pointer-events:none"
    document.body.append(area)
    area.select()
    const ok = document.execCommand("copy")
    area.remove()
    return ok
  }
}

function setupCopy() {
  for (const button of $$("[data-copy]")) {
    const label = button.getAttribute("aria-label")
    let reset = 0
    button.addEventListener("click", async () => {
      const code = button.closest("[data-copy-root]")?.querySelector("code")
      if (!code && !button.dataset.copyText) return
      // Comment lines are for reading, not for pasting into a shell.
      const lines = code ? $$(".t-cmd", code).map((line) => line.textContent) : []
      const text = button.dataset.copyText ?? (lines.length ? lines.join("\n") : code.textContent.split("\n").filter((line) => !line.trim().startsWith("#")).join("\n").trim())
      if (!(await copyText(text))) return
      button.classList.add("is-copied")
      button.setAttribute("aria-label", "Copied")
      clearTimeout(reset)
      reset = setTimeout(() => {
        button.classList.remove("is-copied")
        button.setAttribute("aria-label", label)
      }, 1600)
    })
  }
}

/* ---------- The star count beside GitHub in the nav, when GitHub answers ---------- */

async function loadRepo() {
  let repo
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}`, { headers: { Accept: "application/vnd.github+json" } })
    if (!response.ok) return
    repo = await response.json()
  } catch {
    return
  }
  // A new project's zero is true but says nothing; show the count once it does.
  const stars = $("[data-stars]")
  if (!stars || !Number.isFinite(repo.stargazers_count) || repo.stargazers_count <= 0) return
  stars.textContent = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(repo.stargazers_count)
  stars.hidden = false
}

/* ---------- Start ---------- */

function measureAll() {
  hero?.measure()
  for (const entry of headings) entry.measure()
  requestTick()
}

function onMotionPreference() {
  for (const entry of switchers) entry.mode()
  if (reducedMotion.matches) {
    hero?.reset()
    for (const entry of headings) for (const mark of entry.marks) {
      mark.word.style.removeProperty("--lit")
      mark.lit = -1
    }
  }
  measureAll()
}

window.addEventListener("scroll", requestTick, { passive: true })
window.addEventListener("resize", measureAll)
reducedMotion.addEventListener("change", onMotionPreference)
document.fonts?.ready.then(measureAll)

setupToolbars()
setupShotSpaces()
setupHeadings()
setupToken()
setupTweak()
setupArrivals()
setupStages()
setupSwitchers()
setupGlow()
setupCopy()
setupFilm()
measureAll()
loadDemos()
loadRepo()
hero?.playIntro()
// Blinds behind the hero's mockup and in the footer: WebGL, so loaded on their
// own. If they fail, .no-webgl puts back the CSS glow they replace.
import("./backgrounds.js")
  .then((mod) => mod.mountBackgrounds(reducedMotion))
  .catch((error) => {
    document.documentElement.classList.add("no-webgl")
    console.warn("Backgrounds off:", error)
  })
tourToolbar()
