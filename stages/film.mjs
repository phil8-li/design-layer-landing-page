#!/usr/bin/env node
/**
 * Film a stage page with the Playwright already on this machine.
 *
 *   node stages/film.mjs <url> --out <png> [--width 1440] [--height 900]
 *        [--select <css>] [--dark] [--reduced] [--wait <ms>]
 *        [--frames <n> --every <ms>] [--eval <js>]
 *
 * Waits for document.fonts.ready and 300ms (plus --wait) after load. With
 * --select it shots that element; with --frames it writes out-01.png,
 * out-02.png, ... every --every ms, for stepping through an act. --eval runs
 * a script in the page after load and before the wait or the first frame
 * (preview.html exposes window.__stage.go(k), e.g. --eval "__stage.go(0)"). Page errors
 * and console errors go to stderr, and the exit code is 1 when there were any.
 */

import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)

// Playwright is found the way check.mjs finds it: SITE_PLAYWRIGHT_DIR (a project
// or node_modules directory), then a local install, then a global one.
function loadPlaywright() {
  const dir = process.env.SITE_PLAYWRIGHT_DIR
  if (dir) {
    try {
      return path.basename(dir) === "node_modules"
        ? createRequire(path.join(dir, "playwright", "package.json"))("playwright")
        : createRequire(path.join(path.resolve(dir), "package.json"))("playwright")
    } catch {}
  }
  try {
    return require("playwright")
  } catch {}
  for (const root of ["/opt/homebrew/lib/node_modules", "/usr/local/lib/node_modules"]) {
    for (const anchor of ["playwright/index.js", "@playwright/mcp/node_modules/playwright/index.js"]) {
      try {
        return createRequire(path.join(root, anchor))("playwright")
      } catch {}
    }
  }
  throw new Error("Playwright not found: set SITE_PLAYWRIGHT_DIR to a node_modules that has it")
}

function parse(argv) {
  const opts = { width: 1440, height: 900, wait: 0, frames: 0, every: 150 }
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dark") opts.dark = true
    else if (a === "--reduced") opts.reduced = true
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i]
    else rest.push(a)
  }
  opts.url = rest[0]
  for (const k of ["width", "height", "wait", "frames", "every"]) opts[k] = Number(opts[k])
  return opts
}

const opts = parse(process.argv.slice(2))
if (!opts.url || !opts.out) {
  console.error("usage: node stages/film.mjs <url> --out <png> [--width 1440] [--height 900] [--select <css>] [--dark] [--reduced] [--wait <ms>] [--frames <n> --every <ms>] [--eval <js>]")
  process.exit(2)
}

const { chromium } = loadPlaywright()
const browser = await chromium.launch()
let errors = 0
try {
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    deviceScaleFactor: 2,
    colorScheme: opts.dark ? "dark" : "light",
    reducedMotion: opts.reduced ? "reduce" : "no-preference",
  })
  const page = await context.newPage()
  page.on("pageerror", err => { errors++; console.error(`[pageerror] ${err.message}`) })
  page.on("console", msg => {
    if (msg.type() === "error") { errors++; console.error(`[console.error] ${msg.text()}`) }
  })
  page.on("requestfailed", req => {
    // Font CDNs can be slow or offline; a missing font is not a page bug.
    if (!/fonts\.(googleapis|gstatic)\.com/.test(req.url())) {
      errors++
      console.error(`[requestfailed] ${req.url()} ${req.failure()?.errorText || ""}`)
    }
  })
  await page.goto(opts.url, { waitUntil: "load" })
  await page.evaluate(() => document.fonts.ready)
  if (opts.eval) await page.evaluate(opts.eval)

  const target = opts.select ? page.locator(opts.select).first() : page
  const shoot = file => opts.select
    ? target.screenshot({ path: file, animations: "allow" })
    : page.screenshot({ path: file, fullPage: true, animations: "allow" })

  if (opts.frames > 0) {
    const ext = path.extname(opts.out) || ".png"
    const base = opts.out.slice(0, opts.out.length - ext.length)
    const files = []
    for (let i = 1; i <= opts.frames; i++) {
      const t0 = Date.now()
      const file = `${base}-${String(i).padStart(2, "0")}${ext}`
      await shoot(file)
      files.push(file)
      const left = opts.every - (Date.now() - t0)
      if (left > 0) await page.waitForTimeout(left)
    }
    console.log(files.join("\n"))
  } else {
    await page.waitForTimeout(300 + opts.wait)
    await shoot(opts.out)
    console.log(opts.out)
  }
} finally {
  await browser.close()
}
process.exit(errors ? 1 : 0)
