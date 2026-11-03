/**
 * system: "Bring your design system. Stay consistent."
 *
 * The real editor (midday captures), bare: the stage is the capture itself,
 * no browser chrome and no ground around it. Its inspector, rebuilt at 1:1,
 * grows in place at the right edge over its own column. The unit stays up for
 * every beat (the same spot) and morphs: add a library by URL, pick the app's
 * own token for the button's fill, run DS lint.
 * Open: preview.html?stage=system
 */

import {
  createStage, director, typeInto, shots, wash, lift,
  coverRect, place, reduced,
} from "./stagekit.js"

export const meta = {
  name: "system",
  // The capture's 1.6, the hero mock's aspect.
  width: 1000,
  height: 625,
  compact: { below: 560, width: 358, height: 224 },
  beats: ["Libraries", "Tokens", "Audit"],
  poster: 2,
  theme: "dark",
  className: "look-designlayer",
}

const SPRITE = new URL("../assets/icons.svg", import.meta.url).href
const CSS_ID = "stage-system-css"
const CAP = { width: 1600, height: 1000 }
const SHOT = name => new URL(`../assets/shots/midday/${name}-2400.webp`, import.meta.url).href
const LIST = { system: SHOT("system"), tokens: SHOT("tokens"), audit: SHOT("audit") }
const BACK = { [-1]: "system", 0: "system", 1: "tokens", 2: "audit" }

const GUTTER = { wide: 16, compact: 12 }

// The inspector column (x 1320–1600), the full height of the capture. The
// unit is the panel itself: as tall as the scene at its scale, so it covers
// the whole column (no foot of the capture's own panel shows under it as a
// second copy) and its top, scale and height hold while its content morphs.
// Content taller than the unit is cut at the foot with a fade. At 1:1 wide
// that is the scene's 625; compact, a 540px panel sets the scale (0.41).
const COL = { x: 1320, y: 0, w: 280 }
const PANEL_H = { wide: 625, compact: 540 }

// The demo app's tokens as tokens-2400.webp lists them (its globals.css).
const TOKENS = ["background", "foreground", "card", "card-foreground", "popover", "popover-foreground", "primary", "primary-foreground", "secondary"]
const PICK = "primary"

// Not in the landing sprite: copied verbatim from the editor's icon set
// (design-layer src/core/icons.ts), never drawn here.
const GLYPHS = {
  ChevronDown: '<path d="M18.826 9.901L12.451 16.276A0.637 0.637 0 0 1 11.549 16.276L5.174 9.901A0.637 0.637 0 0 1 6.076 8.999L12 14.924L17.924 8.999A0.637 0.637 0 0 1 18.826 9.901z"/>',
  ChevronRight: '<path d="M16.276 12.451L9.901 18.826A0.637 0.637 0 0 1 8.999 17.924L14.924 12L8.999 6.076A0.637 0.637 0 0 1 9.901 5.174L16.276 11.549A0.637 0.637 0 0 1 16.276 12.451z"/>',
  EyeOff: '<path d="M5.055 3.246A0.75 0.75 0 1 0 3.945 4.254L5.749 6.239C2.344 8.329 0.879 11.55 0.815 11.696A0.75 0.75 0 0 0 0.815 12.306C0.847 12.38 1.642 14.14 3.407 15.906C5.759 18.257 8.73 19.5 12 19.5A11.917 11.917 0 0 0 16.882 18.485L18.944 20.754A0.75 0.75 0 1 0 20.054 19.746zM9.492 10.356L13.399 14.654A3 3 0 0 1 9.492 10.356zM12 18C9.114 18 6.593 16.951 4.507 14.883A12.484 12.484 0 0 1 2.344 12C2.783 11.176 4.187 8.87 6.783 7.371L8.47 9.222A4.5 4.5 0 0 0 14.438 15.785L15.819 17.303A10.5 10.5 0 0 1 12 18zM12.563 9.053A0.75 0.75 0 0 1 12.844 7.58A4.515 4.515 0 0 1 16.478 11.577A0.75 0.75 0 0 1 15.802 12.394A0.599 0.599 0 0 1 15.731 12.394A0.75 0.75 0 0 1 14.981 11.713A3.008 3.008 0 0 0 12.563 9.053zM23.183 12.306C23.143 12.394 22.193 14.497 20.055 16.412A0.75 0.75 0 1 1 19.055 15.294A12.447 12.447 0 0 0 21.661 12A12.483 12.483 0 0 0 19.493 9.115C17.407 7.049 14.886 6 12 6A11.097 11.097 0 0 0 10.185 6.147A0.75 0.75 0 1 1 9.938 4.668A12.563 12.563 0 0 1 12 4.5C15.27 4.5 18.241 5.743 20.593 8.095C22.358 9.861 23.152 11.622 23.185 11.696A0.75 0.75 0 0 1 23.185 12.306z"/>',
  X: '<path d="M19.281 18.219A0.75 0.75 0 0 1 18.219 19.281L12 13.06L5.781 19.281A0.75 0.75 0 0 1 4.719 18.219L10.94 12L4.719 5.781A0.75 0.75 0 0 1 5.781 4.719L12 10.94L18.219 4.719A0.75 0.75 0 0 1 19.281 5.781L13.06 12z"/>',
}

function h(tag, cls, text) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = text
  return node
}

const px = n => `${n}px`

function sprite(id) {
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("class", "sk-icon")
  svg.setAttribute("aria-hidden", "true")
  const use = document.createElementNS(ns, "use")
  use.setAttribute("href", `${SPRITE}#${id}`)
  svg.append(use)
  return svg
}

function glyph(name, cls = "") {
  const wrap = document.createElement("span")
  wrap.innerHTML = `<svg class="sk-icon fillicon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[name]}</svg>`
  return wrap.firstChild
}

function btn(cls, ...kids) {
  const b = h("button", `btn ${cls}`.trim())
  b.type = "button"
  b.tabIndex = -1
  b.append(...kids)
  return b
}

function loadCss() {
  let link = document.getElementById(CSS_ID)
  if (!link) {
    link = document.createElement("link")
    link.id = CSS_ID
    link.rel = "stylesheet"
    link.href = new URL("./system.css", import.meta.url).href
    link.addEventListener("load", () => { link.dataset.ready = "1" }, { once: true })
    document.head.append(link)
  }
  return link.dataset.ready === "1" || link.sheet
    ? Promise.resolve()
    : new Promise(r => link.addEventListener("load", r, { once: true }))
}

// A count that changes in place: both values stacked, the slot rolls.
function roll(from, to) {
  const slot = h("span", "roll")
  const col = h("span")
  col.append(h("b", "", from), h("b", "", to))
  slot.append(col)
  return slot
}

function fold(...kids) {
  const f = h("div", "fold")
  const inner = h("div")
  inner.append(...kids)
  f.append(inner)
  return f
}

function section(title, tail, body) {
  const sec = h("div", "sec")
  const head = h("div", "sec-head")
  head.append(h("span", "", title))
  const t = h("span", "tail")
  t.append(...tail)
  head.append(t)
  sec.append(head, fold(body))
  sec.head = head
  return sec
}

function libRow(name, path) {
  const lib = h("div", "lib")
  const tog = h("span", "sk-toggle")
  tog.dataset.on = ""
  lib.append(h("span", "lib-name", name), tog, glyph("X", "x"), h("span", "lib-path", path))
  return lib
}

function finding(code, file, i) {
  const f = h("div", "find")
  const main = h("div")
  const fileRow = h("div", "file")
  fileRow.append(h("span", "", file), h("span", "badge", "off page"))
  main.append(h("div", "code", code), h("div", "meta", "No automatic fix"), fileRow)
  f.append(h("span", "box"), h("span", "sq"), main)
  f.style.setProperty("--i", i)
  return f
}

export function mount(root) {
  const ready = loadCss()
  const stage = createStage(root, meta, { className: `${meta.className} st-sys` })
  let ui = {}
  let resting = null // the beat whose rest is on screen; null while an act runs
  let gutter = GUTTER.wide
  let panelH = PANEL_H.wide
  let tab = "system"

  function render(layout) {
    gutter = GUTTER[layout]
    panelH = PANEL_H[layout]
    stage.scene.replaceChildren()
    // The capture is the stage: it fills the scene, and the host masks the
    // corners.
    const screen = h("div", "sk-screen")
    const layers = shots(screen, { ...CAP, list: LIST })

    const unit = h("div", "unit")

    // Tabs, with the selected pill as one indicator that slides.
    const tabsRow = h("div", "tabs-row")
    const tabs = h("div", "tabs")
    const ind = h("span", "tab-ind")
    tabs.append(ind)
    const tabEls = {}
    for (const [key, name] of [["design", "Design"], ["changes", "Changes"], ["system", "Design system"]]) {
      tabEls[key] = h("span", "tab", name)
      tabs.append(tabEls[key])
    }
    tabsRow.append(tabs)

    // ---- Design system tab (system-2400.webp, audit-2400.webp)
    const sysBody = h("div", "tbody")
    const count = roll("2", "3")
    const newLib = fold(libRow("Design system", "acme.com/design-system"))
    newLib.classList.add("new-lib")
    const url = h("div", "url")
    const urlText = h("span", "")
    url.append(h("span", "ph", "https://"), urlText)
    const add = btn("primary", "Add")
    const addRow = h("div", "add-row")
    addRow.append(url, add)
    const disc = h("div", "disc")
    disc.append(glyph("ChevronRight"), "Add a file from this project")
    const libsBody = h("div", "sec-body")
    libsBody.append(libRow("Sections", "src/components/sections"), libRow("Integrations", "src/app/integrations"), newLib, addRow, disc)
    const libs = section("Libraries", [count, glyph("ChevronDown", "chev")], libsBody)

    const busy = h("span", "busy")
    busy.append(sprite("i-ListChecks"), h("span", "spin"))
    const audit = btn("", busy, "Audit")
    const btnRow = h("div", "btn-row")
    btnRow.append(audit, btn("muted", "Fix all (0)"))
    const hideRow = h("div", "btn-row hide")
    hideRow.append(btn("", glyph("EyeOff"), "Hide markers"))
    const results = h("div", "results")
    const summary = h("div", "summary", "144 issues · 142 errors · 2 warnings · 0 on this page")
    const group = h("div", "group")
    group.append(h("span", "", "Off-scale values"), h("span", "n", "89"))
    ;[summary, group].forEach((n, i) => n.style.setProperty("--i", i))
    results.append(summary, group,
      finding("\"max-w-[1400px] mx-auto\"", "features-grid-section.tsx:9", 2),
      finding("\"flex flex-col it…ll sm:w-[150px]\"", "features-grid-section.…:24", 3))
    const lintBody = h("div", "sec-body")
    lintBody.append(btnRow, hideRow, results)
    const lint = section("DS lint", [glyph("ChevronDown", "chev")], lintBody)
    sysBody.append(libs, lint)

    // ---- Design tab, the button selected (tokens-2400.webp): Layout, the
    // Fill color popover open over Fill, and the Fill row.
    const desBody = h("div", "tbody")
    const dims = h("div", "fields")
    const w = h("div", "fld")
    w.append(h("span", "k", "W"), "120", h("span", "end", "Hug"))
    const hgt = h("div", "fld")
    hgt.append(h("span", "k", "H"), "44", glyph("ChevronDown", "end"))
    dims.append(w, hgt)
    const layoutBody = h("div", "sec-body")
    layoutBody.append(h("div", "lab", "Dimensions"), dims)
    const layoutSec = section("Layout", [sprite("i-Grid2x2"), glyph("ChevronDown")], layoutBody)

    const pop = h("div", "pop")
    const popHead = h("div", "pop-head")
    popHead.append(h("span", "", "Fill color"), glyph("X"))
    const search = h("div", "pop-search")
    search.append(sprite("i-Search"), h("span", "", "Search"))
    const list = h("div", "tok-list")
    const tokRows = {}
    for (const name of TOKENS) {
      const r = h("div", "tok-row")
      r.append(h("span", "swatch"), h("span", "", name))
      tokRows[name] = r
      list.append(r)
    }
    const foot = h("div", "pop-foot")
    foot.append(h("span", "", "Your own value"), h("span", "", "#0a0a0a"))
    pop.append(popHead, search, h("div", "pop-label", "Color"), list, foot)
    const popWrap = fold(pop)
    popWrap.classList.add("pop-wrap")

    const fillVal = h("span", "fill-val")
    fillVal.append(h("span", "hex", "#18181b"), h("span", "tok", PICK))
    const fillFld = h("div", "fld")
    fillFld.append(h("span", "swatch"), fillVal)
    const alpha = h("div", "fld")
    alpha.append(h("span", "k", "A"), "100", h("span", "end", "%"))
    const trail = h("span", "trail")
    trail.append(h("span", "dot"), h("span", "", "−"))
    const fillRow = h("div", "fill-row")
    fillRow.append(fillFld, alpha, trail)
    const fillBody = h("div", "sec-body")
    fillBody.append(fillRow)
    const fillSec = section("Fill", [sprite("i-Grid2x2"), sprite("i-Plus"), glyph("ChevronDown")], fillBody)
    desBody.append(layoutSec, popWrap, fillSec)

    unit.append(tabsRow, sysBody, desBody, h("div", "foot"))
    stage.scene.append(screen, unit)
    ui = { screen, layers, unit, ind, tabEls, sysBody, desBody, libs, count, newLib, url, urlText, add, audit, results, popWrap, tokRows, disc, fillRow, hideRow }
  }

  // ---- geometry

  const bounds = () => ({ x: 0, y: 0, w: stage.design.width, h: stage.design.height })
  const from = hgt => ui.layers.rect({ ...COL, h: hgt })
  // The inspector column touches the scene's top, right and bottom edges, so
  // coverRect keeps the unit flush with them: it grows leftward over its own
  // column and never slides toward the middle.
  const lifted = () => coverRect({ w: COL.w, h: panelH }, from(CAP.height), bounds(), { gutter, max: 1 })

  // A point inside the lifted unit, from an element's box in the unit's own
  // px (measured against the unit's live box, so it holds mid-move too).
  function inUnit(el, fx, fy, dx = 0, dy = 0) {
    const r = lifted()
    const k = r.w / COL.w
    // Read the folds at their end state, not mid-open (see measure()).
    const folds = ui.unit.querySelectorAll(".fold")
    folds.forEach(f => { f.style.transition = "none" })
    const u = ui.unit.getBoundingClientRect()
    const e = el.getBoundingClientRect()
    folds.forEach(f => { f.style.transition = "" })
    const s = u.width / ui.unit.offsetWidth || 1
    const x = (e.left - u.left) / s
    const y = (e.top - u.top) / s
    return { x: r.x + (x + el.offsetWidth * fx + dx) * k, y: r.y + (y + el.offsetHeight * fy + dy) * k }
  }

  // Rest on the unit's own empty surface, beside the next move: after the
  // opening, on the left of the URL field; after Libraries, past the end of
  // "Add a file from this project" (the token list opens there); after
  // Tokens, right of the Fill row's end (Audit is next); after Audit, beside
  // Hide markers.
  function spot(k) {
    if (k < 0) { const r = lifted(); return { x: r.x - 28, y: r.y + r.h * 0.4 } }
    if (k === 0) return inUnit(ui.disc, 0, 0.5, 236)
    if (k === 1) return inUnit(ui.fillRow, 0.5, 1, 0, 8)
    return inUnit(ui.hideRow, 0, 0.5, 236)
  }

  // ---- state

  function placeInd(key, instant) {
    const t = ui.tabEls[key]
    if (instant) ui.ind.style.transition = "none"
    ui.ind.style.left = px(t.offsetLeft)
    ui.ind.style.width = px(t.offsetWidth)
    if (instant) { void ui.ind.offsetWidth; ui.ind.style.transition = "" }
  }

  function showTab(key, instant) {
    tab = key
    for (const [k, el] of Object.entries(ui.tabEls)) el.toggleAttribute("data-selected", k === key)
    ui.sysBody.toggleAttribute("data-active", key === "system")
    ui.desBody.toggleAttribute("data-active", key === "design")
    placeInd(key, instant)
  }

  // Heights settle after a fold's own transition, so measure the target
  // state with transitions off, then let the unit's height ease to it.
  function measure(body) {
    const folds = body.querySelectorAll(".fold")
    folds.forEach(f => { f.style.transition = "none" })
    const hgt = body.offsetHeight
    folds.forEach(f => { f.style.transition = "" })
    return hgt
  }

  function fitTo(body) {
    const full = 39 + measure(body)
    ui.unit.style.height = px(panelH)
    ui.unit.toggleAttribute("data-cut", full > panelH)
  }

  // State that every rest and act share; `k` is the beat whose rest it is.
  function setState(k, { instant }) {
    ui.urlText.querySelector(".sk-caret")?.remove()
    ui.urlText.textContent = ""
    ui.url.removeAttribute("data-focus")
    ui.url.removeAttribute("data-filled")
    ui.newLib.toggleAttribute("data-closed", k < 0)
    ui.count.toggleAttribute("data-next", k >= 0)
    ui.libs.toggleAttribute("data-closed", k === 2)
    ui.audit.removeAttribute("data-busy")
    ui.results.removeAttribute("data-off")
    ui.popWrap.setAttribute("data-closed", "")
    ui.unit.toggleAttribute("data-token", k >= 1)
    for (const [name, r] of Object.entries(ui.tokRows)) {
      r.removeAttribute("data-hover")
      r.toggleAttribute("data-focus", name === "background")
    }
    showTab(k === 1 ? "design" : "system", instant)
    fitTo(tab === "design" ? ui.desBody : ui.sysBody)
  }

  function rest(k, { instant, via }) {
    const snap = instant || via === "mount" || via === "layout" || reduced.matches
    resting = k
    setState(k, { instant: snap })
    ui.layers.show(BACK[k], { instant: snap })
    if (k >= 0) {
      place(ui.unit, lifted())
      ui.unit.setAttribute("data-lifted", "")
      ui.unit.style.boxShadow = "var(--sk-shadow-float)"
      ui.unit.style.opacity = "1"
    } else {
      ui.unit.removeAttribute("data-lifted")
      ui.unit.style.opacity = "0"
    }
    // The panel covers its whole column, so the page steps back by 0.3.
    wash(ui.screen, k >= 0 ? 0.3 : 0, { instant: snap })
    // A jump lands on a rest that shows its cursor (the kit fades it in 4s);
    // the opening still and a layout switch only place it, hidden.
    if (via !== "act") stage.cursor.at(spot(k))
    if (via === "jump" && k >= 0) stage.cursor.kind("arrow").show().rest()
  }

  async function act(k, a) {
    resting = null
    await ready
    const c = stage.cursor
    const sig = { signal: a.signal }

    if (k === 0) {
      c.kind("arrow")
      wash(ui.screen, 0.3)
      // It grows out of the inspector column's top at the capture's scale.
      await lift(ui.unit, { from: from(panelH), to: lifted(), ...sig })
      c.show()
      const go = c.moveTo(ui.url, { at: { x: 0.3, y: 0.5 }, dur: 600, ...sig })
      await a.wait(380)
      a.step(() => c.kind("ibeam"))
      await go
      await c.press(null, sig)
      a.step(() => { ui.url.setAttribute("data-focus", ""); ui.url.setAttribute("data-filled", "") })
      await typeInto(ui.urlText, "acme.com/design-system", { cps: 22, keepCaret: true, ...sig })
      const toAdd = c.moveTo(ui.add, { at: { x: 0.7, y: 0.62 }, dur: 420, ...sig })
      await a.wait(100)
      a.step(() => c.kind("arrow"))
      await toAdd
      await c.press(ui.add, sig)
      a.step(() => {
        ui.urlText.textContent = ""
        ui.url.removeAttribute("data-filled")
        ui.url.removeAttribute("data-focus")
        ui.newLib.removeAttribute("data-closed")
        ui.count.setAttribute("data-next", "")
      })
      await c.moveTo(spot(0), { dur: 600, ...sig })
    }

    if (k === 1) {
      c.kind("arrow").show()
      // Same spot: the unit stays up and its body morphs into the Design tab
      // with the token popover open, as tokens-2400.webp has it.
      a.step(() => {
        ui.layers.show("tokens")
        ui.popWrap.removeAttribute("data-closed")
        showTab("design")
        fitTo(ui.desBody)
      })
      await a.wait(700)
      const row = ui.tokRows[PICK]
      await c.moveTo(row, { at: { x: 0.6, y: 0.6 }, dur: 700, ...sig })
      a.step(() => { row.setAttribute("data-hover", ""); ui.tokRows.background.removeAttribute("data-focus") })
      await a.wait(160)
      await c.press(row, sig)
      a.step(() => {
        ui.popWrap.setAttribute("data-closed", "")
        ui.unit.setAttribute("data-token", "")
        fitTo(ui.desBody)
      })
      await a.wait(300)
      await c.moveTo(spot(1), { dur: 600, ...sig })
    }

    if (k === 2) {
      c.kind("arrow").show()
      // Back to the Design system tab, Libraries folded as audit-2400.webp has it.
      a.step(() => {
        ui.libs.setAttribute("data-closed", "")
        ui.results.setAttribute("data-off", "")
        showTab("system")
        fitTo(ui.sysBody)
      })
      await a.wait(400)
      await c.moveTo(ui.audit, { at: { x: 0.72, y: 0.6 }, dur: 700, ...sig })
      await c.press(ui.audit, sig)
      a.step(() => ui.audit.setAttribute("data-busy", ""))
      await a.wait(500)
      // The findings and the page's markers land together.
      a.step(() => {
        ui.audit.removeAttribute("data-busy")
        ui.results.removeAttribute("data-off")
        ui.layers.show("audit")
        fitTo(ui.sysBody)
      })
      await a.wait(400)
      await c.moveTo(spot(2), { dur: 600, ...sig })
    }
  }

  const dir = director(stage, { render, rest, act, beats: meta.beats })
  // Heights and the tab pill are measured, so measure again once the sheet
  // and the fonts are in (a rest can run before either).
  Promise.all([ready, document.fonts.ready]).then(() => {
    if (!ui.unit) return
    placeInd(tab, true)
    stage.root.setAttribute("data-sk-instant", "")
    fitTo(tab === "design" ? ui.desBody : ui.sysBody)
    // A rest before the sheet landed scaled the unit by its unstyled width.
    // Only a rest: during an act the lift owns the unit, and a place() here
    // would cancel it at its first frame and leave it invisible.
    if (resting !== null && ui.unit.hasAttribute("data-lifted")) place(ui.unit, lifted())
    if (resting !== null) stage.cursor.at(spot(resting))
    void stage.root.offsetWidth
    requestAnimationFrame(() => stage.root.removeAttribute("data-sk-instant"))
  })
  return dir
}
