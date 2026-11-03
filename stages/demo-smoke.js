/**
 * demo-smoke: a throwaway stage that exercises the contract and the kit. A
 * window with two rows and a button; beat 0 the cursor clicks the button and
 * the row is published; beat 1 a shortcut hides the sidebar.
 * Open: preview.html?stage=demo-smoke
 */

import { createStage, director, bar, bars, keycaps, windowChrome } from "./stagekit.js"

export const meta = {
  name: "demo-smoke",
  width: 720,
  height: 420,
  compact: { below: 560, width: 358, height: 420 },
  beats: ["Publish", "Shortcut"],
  poster: 0,
  theme: "dark",
}

const SPRITE = new URL("../assets/icons.svg", import.meta.url).href

function icon(id) {
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("class", "sk-icon")
  svg.setAttribute("aria-hidden", "true")
  const use = document.createElementNS(ns, "use")
  use.setAttribute("href", `${SPRITE}#${id}`)
  svg.append(use)
  return svg
}

const STYLE = `
.smoke .win { left: 40px; top: 40px; width: 820px; height: 440px; }
.smoke[data-layout="compact"] .win { left: 20px; top: 24px; width: 420px; height: 440px; }
.smoke .sk-window-side { transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms cubic-bezier(0.4, 0, 0.2, 1); overflow: hidden; }
.smoke [data-collapsed] .sk-window-side { width: 76px !important; }
.smoke [data-collapsed] .sk-window-side .sk-list { opacity: 0; }
.smoke .sk-window-side .sk-list { padding: 8px; transition: opacity 160ms; }
.smoke .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; max-width: 460px; padding: 14px 16px 12px; }
.smoke[data-layout="compact"] .head, .smoke[data-layout="compact"] .rows { max-width: 220px; }
.smoke .rows { max-width: 460px; }
.smoke .title { color: var(--sk-text-strong); font-size: 13px; font-weight: 600; }
.smoke .rows { padding: 0 4px; }
.smoke .state { transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1); }
.smoke .state[hidden] { display: inline-flex; opacity: 0; }
.smoke .filler { padding: 16px; }
`

export function mount(root) {
  const style = document.createElement("style")
  style.textContent = STYLE
  root.append(style)
  const stage = createStage(root, meta, { className: "look-designlayer smoke" })
  let ui = {}

  function render(layout) {
    stage.scene.querySelector(".win")?.remove()
    const win = windowChrome({ title: "Website", sidebar: layout === "compact" ? 96 : 180 })
    win.classList.add("win", "sk-hero")
    const side = document.createElement("div")
    side.className = "sk-list"
    for (const w of [70, 52, 64, 45]) {
      const row = document.createElement("div")
      row.className = "sk-row dense"
      row.append(bar(`${w}%`, { ink: 2 }))
      side.append(row)
    }
    win.side.append(side)

    const head = document.createElement("div")
    head.className = "head"
    const title = document.createElement("div")
    title.className = "title"
    title.textContent = "Pages"
    const publish = document.createElement("button")
    publish.className = "sk-btn primary"
    publish.textContent = "Publish"
    head.append(title, publish)

    const rows = document.createElement("div")
    rows.className = "rows"
    const real = [["Home", "i-Eye"], ["Pricing", "i-Lock"]]
    const badges = []
    for (const [name, id] of real) {
      const row = document.createElement("div")
      row.className = "sk-row"
      const lead = document.createElement("div")
      lead.className = "sk-row-lead"
      lead.append(icon(id))
      const main = document.createElement("div")
      main.className = "sk-row-main"
      const t = document.createElement("div")
      t.className = "sk-row-title"
      t.textContent = name
      main.append(t)
      const trail = document.createElement("div")
      trail.className = "sk-row-trail"
      const badge = document.createElement("span")
      badge.className = "sk-badge state"
      badge.dataset.tone = "success"
      badge.textContent = "Live"
      badge.hidden = true
      trail.append(badge)
      badges.push(badge)
      row.append(lead, main, trail)
      rows.append(row)
    }
    const filler = document.createElement("div")
    filler.className = "filler"
    filler.append(bars([60, 45, 70, 52]))

    win.body.append(head, rows, filler)
    const keys = document.createElement("div")
    keys.className = "sk-keys"
    keys.append(keycaps(["⌘", "."]))
    stage.scene.querySelector(".sk-keys")?.remove()
    stage.scene.append(win, keys)
    ui = { win, publish, badges, rows, keys, head }
  }

  // Rest spots: empty surface near the next move, never on a control.
  function restSpot(k) {
    const r = stage.rect(ui.head)
    if (k === -1) return { x: r.x + r.width - 120, y: r.y + 250 }
    return { x: r.x + r.width - 150, y: r.y + 260 }
  }

  function rest(k, { via }) {
    for (const b of ui.badges) b.hidden = k < 0
    ui.win.toggleAttribute("data-collapsed", k >= 1)
    ui.keys.removeAttribute("data-show")
    if (via !== "act") stage.cursor.at(restSpot(k))
  }

  async function act(k, a) {
    const c = stage.cursor
    if (k === 0) {
      c.kind("arrow").show()
      await c.moveTo(ui.publish, { signal: a.signal })
      await c.press(ui.publish, { signal: a.signal })
      a.step(() => { ui.badges[0].hidden = false })
      await a.wait(80)
      a.step(() => { ui.badges[1].hidden = false })
      await a.wait(300)
      await c.moveTo(restSpot(0), { dur: 700, signal: a.signal })
    }
    if (k === 1) {
      c.show()
      a.step(() => ui.keys.setAttribute("data-show", ""))
      await a.wait(260)
      const caps = ui.keys.querySelectorAll(".sk-keycap")
      a.step(() => caps.forEach(cap => cap.setAttribute("data-press", "")))
      await a.wait(120)
      a.step(() => {
        caps.forEach(cap => cap.removeAttribute("data-press"))
        ui.win.setAttribute("data-collapsed", "")
      })
      await a.wait(900)
      a.step(() => ui.keys.removeAttribute("data-show"))
      await a.wait(200)
    }
  }

  const d = director(stage, { render, rest, act, beats: meta.beats })
  return {
    set: d.set,
    play: d.play,
    pause: d.pause,
    destroy() {
      d.destroy()
      style.remove()
    },
  }
}
