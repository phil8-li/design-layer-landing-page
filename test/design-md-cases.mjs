/**
 * DESIGN.md copies its token values from styles.css, and a copy drifts. These
 * cases hold every frontmatter value to its source: the `:root` custom
 * properties and the rules the Colors/Typography/Shapes sections name.
 *
 * The mapping table below is the contract, one row per frontmatter token. A
 * token with no row fails, a row whose source is gone fails, a row with no
 * token fails, and a value that differs fails. Values compare after
 * whitespace normalization, so `color-mix(in srgb, a 10%, b)` and its
 * reflowed twin are equal and nothing else is.
 *
 * Moved here with the page from phil8-li/design-layer, whose own copy holds
 * the editor's DESIGN.md to src/core/tokens.ts.
 *
 * Usage: node test/design-md-cases.mjs
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

let passed = 0
let failed = 0

function check(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    failed += 1
    console.log(`  FAIL ${name}\n       ${error.message}`)
  }
}

// ───────────────────────────────────────────────────────── frontmatter ────

/**
 * The YAML subset DESIGN.md uses: nested maps by two-space indentation,
 * `#` comments, plain scalars, and single- or double-quoted strings. Scalars
 * stay strings ("400", "1.333"), because the comparison is textual.
 */
export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error("no YAML frontmatter at the top of the file")
  const root = {}
  const stack = [{ indent: -1, node: root }]
  for (const [index, raw] of match[1].split("\n").entries()) {
    if (/^\s*(#.*)?$/.test(raw)) continue
    const line = /^( *)([^\s:#][^:]*?):(?:\s+(.*))?$/.exec(raw)
    if (!line) throw new Error(`frontmatter line ${index + 2} is outside the parsed subset: ${raw}`)
    const [, spaces, key, rest = ""] = line
    const indent = spaces.length
    while (stack.at(-1).indent >= indent) stack.pop()
    const parent = stack.at(-1).node
    if (rest === "") {
      parent[key] = {}
      stack.push({ indent, node: parent[key] })
    } else {
      parent[key] = scalar(rest, index + 2)
    }
  }
  return root
}

function scalar(text, lineNumber) {
  if (text.startsWith('"')) {
    const m = /^"((?:[^"\\]|\\.)*)"\s*(#.*)?$/.exec(text)
    if (!m) throw new Error(`unterminated double-quoted string on frontmatter line ${lineNumber}`)
    return m[1].replace(/\\(.)/g, "$1")
  }
  if (text.startsWith("'")) {
    const m = /^'((?:[^']|'')*)'\s*(#.*)?$/.exec(text)
    if (!m) throw new Error(`unterminated single-quoted string on frontmatter line ${lineNumber}`)
    return m[1].replace(/''/g, "'")
  }
  return text.replace(/\s+#.*$/, "").trim()
}

/** `colors.primary`, `typography.body.fontSize`, ... for the four checked groups. */
function flattenTokens(frontmatter) {
  const out = new Map()
  const walk = (node, prefix) => {
    for (const [key, value] of Object.entries(node)) {
      const name = prefix ? `${prefix}.${key}` : key
      if (typeof value === "object") walk(value, name)
      else out.set(name, value)
    }
  }
  for (const group of ["colors", "typography", "rounded", "spacing"]) {
    if (frontmatter[group]) walk(frontmatter[group], group)
  }
  return out
}

/** Whitespace is not a difference; everything else is. */
export const normalize = (value) =>
  String(value)
    .replace(/\s+/g, " ")
    .replace(/\s*([(),/])\s*/g, "$1")
    .trim()

/**
 * The one comparison every token goes through. `table` maps a token name to a
 * function that returns the source value (or throws when the source is gone),
 * optionally `{ value, compare }` when the stored form is a conversion.
 */
export function compareTokens(designMd, table) {
  const problems = []
  const tokens = flattenTokens(parseFrontmatter(designMd))
  for (const [name, stored] of tokens) {
    const row = table[name]
    if (!row) {
      problems.push(`${name}: no mapping row; add one to test/design-md-cases.mjs`)
      continue
    }
    let source
    try {
      source = row()
    } catch (error) {
      problems.push(`${name}: source is gone (${error.message})`)
      continue
    }
    if (source === undefined || source === null) {
      problems.push(`${name}: source is gone (resolved to ${source})`)
      continue
    }
    if (typeof source === "object") {
      const verdict = source.compare(stored)
      if (verdict) problems.push(`${name}: DESIGN.md has ${JSON.stringify(stored)}, ${verdict}`)
    } else if (normalize(stored) !== normalize(source)) {
      problems.push(
        `${name}: DESIGN.md has ${JSON.stringify(stored)}, source has ${JSON.stringify(String(source))}`
      )
    }
  }
  for (const name of Object.keys(table)) {
    if (!tokens.has(name)) problems.push(`${name}: mapping row has no frontmatter token; remove the row`)
  }
  return problems
}

// ──────────────────────────────────────────────────────────── the landing ────

/**
 * Enough CSS for this lookup: rules with their @media context and their
 * declarations, comments stripped, strings and parentheses respected.
 */
export function parseCss(text) {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, "")
  const rules = []
  let i = 0
  function block(media) {
    const declarations = []
    let buffer = ""
    let parens = 0
    while (i < css.length) {
      const c = css[i++]
      if (c === '"' || c === "'") {
        const end = css.indexOf(c, i)
        buffer += c + css.slice(i, end + 1)
        i = end + 1
      } else if (c === "(") {
        parens += 1
        buffer += c
      } else if (c === ")") {
        parens -= 1
        buffer += c
      } else if (c === "{" && parens === 0) {
        const prelude = buffer.trim().replace(/\s+/g, " ")
        buffer = ""
        const inner = /^@(media|supports|container)\b/.test(prelude) ? [...media, prelude] : media
        const nested = block(inner)
        rules.push({ selector: prelude, media: inner, declarations: nested })
      } else if (c === ";" && parens === 0) {
        if (buffer.trim()) declarations.push(buffer.trim())
        buffer = ""
      } else if (c === "}" && parens === 0) {
        if (buffer.trim()) declarations.push(buffer.trim())
        return declarations.map((d) => {
          const colon = d.indexOf(":")
          return [d.slice(0, colon).trim(), d.slice(colon + 1).trim()]
        })
      } else {
        buffer += c
      }
    }
    return []
  }
  block([])
  return rules
}

const landingCss = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8")

/**
 * The cascade-last value of `property` across the rules whose selector is
 * exactly `selector` (one selector per rule, not a list) in `media`.
 */
function cssValue(rules, selector, property, media = "") {
  let value
  for (const rule of rules) {
    if (rule.selector !== selector || rule.media.join(" ") !== media) continue
    for (const [name, v] of rule.declarations) if (name === property) value = v
  }
  if (value === undefined) {
    throw new Error(`no ${property} in \`${selector}\`${media ? ` inside ${media}` : ""} in styles.css`)
  }
  return value
}

/** `var(--x)` -> its `:root` value, recursively, for font stacks and calc(). */
function resolveVars(rules, value, local = {}) {
  return value.replace(/var\((--[\w-]+)\)/g, (_, name) =>
    resolveVars(rules, local[name] ?? cssValue(rules, ":root", name), local)
  )
}

/** A px-only calc() of sums and differences, for the two derived radii. */
function evalPxCalc(value) {
  const body = /^calc\((.*)\)$/.exec(value)?.[1]
  if (!body) return value
  const terms = body.match(/[+-]?\s*\d*\.?\d+px/g) ?? []
  const leftover = body.replace(/[+-]?\s*\d*\.?\d+px/g, "").trim()
  if (leftover) throw new Error(`calc() is not a px sum: ${value}`)
  return `${terms.reduce((sum, t) => sum + Number(t.replace(/\s|px/g, "")), 0)}px`
}

/** The third argument of clamp(min, preferred, max). */
function clampMax(value) {
  const m = /^clamp\(.*,\s*([^,]+)\)$/.exec(value)
  if (!m) throw new Error(`not a clamp(): ${value}`)
  return m[1].trim()
}

/** One part of a `font` shorthand written `weight size/line-height family`. */
function fontPart(value, part) {
  const m = /^(\d+)\s+([\d.]+px)\/([\d.]+)\s+(.+)$/.exec(value)
  if (!m) throw new Error(`font shorthand outside the weight size/leading family form: ${value}`)
  return { weight: m[1], size: m[2], leading: m[3], family: m[4] }[part]
}

/** The nth color stop of a linear-gradient(a, b) with no angle. */
function gradientStop(value, n) {
  const m = /^linear-gradient\((.*)\)$/.exec(value)
  if (!m) throw new Error(`not a linear-gradient(): ${value}`)
  return m[1].split(",")[n].trim()
}

// OKLab, for `color-mix(in oklab, ...)` — Björn Ottosson's reference matrices.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
function hexToOklab(hex) {
  const n = hex.replace("#", "")
  const full = n.length === 3 ? [...n].map((d) => d + d).join("") : n
  const [r, g, b] = [0, 2, 4].map((o) => toLinear(parseInt(full.slice(o, o + 2), 16) / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255))
}

/**
 * Known Gap: the design.md linter takes `color-mix()` only in srgb, so the
 * landing pills store the sRGB result of the stylesheet's oklab mix. The row
 * recomputes that mix from styles.css and allows ±1 per channel for rounding;
 * a changed `--accent-fill` or percentage still fails.
 */
function oklabMixAsHex(rules, selector, property, media = "") {
  return () => {
    const mix = resolveVars(rules, cssValue(rules, selector, property, media))
    const m = /^color-mix\(in oklab,\s*(#[0-9a-f]{3,6})\s+([\d.]+)%,\s*(#[0-9a-f]{3,6})\)$/i.exec(mix)
    if (!m) throw new Error(`\`${selector}\` ${property} is no longer color-mix(in oklab, #hex N%, #hex): ${mix}`)
    const [a, p, b] = [hexToOklab(m[1]), Number(m[2]) / 100, hexToOklab(m[3])]
    const rgb = oklabToRgb(a.map((v, k) => v * p + b[k] * (1 - p)))
    const hex = `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`
    return {
      compare(stored) {
        const want = /^#([0-9a-f]{6})$/i.exec(stored)
        if (!want) return `expected a 6-digit hex for ${mix} (${hex})`
        const got = [0, 2, 4].map((o) => parseInt(want[1].slice(o, o + 2), 16))
        const off = got.some((c, k) => Math.abs(c - rgb[k]) > 1)
        return off ? `styles.css ${mix} converts to ${hex}` : null
      },
    }
  }
}

/** DESIGN.md token -> source expression in styles.css. */
function landingTable(rules) {
  const root = (name) => () => cssValue(rules, ":root", name)
  const rule = (selector, property, media) => () => cssValue(rules, selector, property, media)
  const family = (selector) => () => resolveVars(rules, cssValue(rules, selector, "font-family"))
  const clamped = (selector) => () => clampMax(cssValue(rules, selector, "font-size"))
  const btnFont = (part) => () => {
    const v = fontPart(cssValue(rules, ".btn", "font"), part)
    return part === "family" ? resolveVars(rules, v) : v
  }
  return {
    // :root (styles.css:31-45).
    "colors.primary": root("--accent"),
    "colors.primary-text": root("--accent-text"),
    "colors.primary-fill": root("--accent-fill"),
    "colors.primary-glow": root("--accent-glow"),
    "colors.canvas": root("--bg"),
    "colors.line": root("--line"),
    "colors.line-strong": root("--line-strong"),
    "colors.ink": root("--text"),
    "colors.ink-2": root("--text-2"),
    "colors.ink-3": root("--text-3"),
    "colors.add": root("--add"),
    // Rules named by the Colors section.
    "colors.white": rule(".btn-primary:hover", "background"),
    "colors.on-white": rule(".btn-primary", "color"),
    "colors.pill": oklabMixAsHex(rules, ".token", "--pill"),
    "colors.pill-hover": oklabMixAsHex(rules, "button.token:hover", "--pill", "@media (hover: hover) and (pointer: fine)"),
    "colors.pill-active": oklabMixAsHex(rules, "button.token:active", "--pill"),
    "colors.sticker-ground-top": () => gradientStop(cssValue(rules, "span.token-art", "background"), 0),
    "colors.sticker-ground": () => gradientStop(cssValue(rules, "span.token-art", "background"), 1),
    "colors.sticker-glyph": rule("span.token-art", "color"),
    "colors.nav-frost": rule(".nav::before", "background"),
    // Typography: display sizes hold the clamp's maximum (Known Gaps).
    "typography.display.fontFamily": family("h1"),
    "typography.display.fontSize": clamped("h1"),
    "typography.display.fontWeight": rule("h1", "font-weight"),
    "typography.display.lineHeight": rule("h1", "line-height"),
    "typography.display.letterSpacing": rule("h1", "letter-spacing"),
    "typography.headline.fontFamily": family("h2"),
    "typography.headline.fontSize": clamped("h2"),
    "typography.headline.fontWeight": rule("h2", "font-weight"),
    "typography.headline.lineHeight": rule("h2", "line-height"),
    "typography.headline.letterSpacing": rule("h2", "letter-spacing"),
    "typography.stat.fontFamily": family(".facts dt"),
    "typography.stat.fontSize": clamped(".facts dt"),
    "typography.stat.fontWeight": rule(".facts dt", "font-weight"),
    "typography.stat.lineHeight": rule(".facts dt", "line-height"),
    "typography.stat.letterSpacing": rule(".facts dt", "letter-spacing"),
    "typography.card-title.fontFamily": family(".path h3"),
    "typography.card-title.fontSize": rule(".path h3", "font-size"),
    "typography.card-title.fontWeight": rule(".path h3", "font-weight"),
    "typography.card-title.letterSpacing": rule(".path h3", "letter-spacing"),
    "typography.body.fontFamily": family("body"),
    "typography.body.fontSize": rule("body", "font-size"),
    "typography.body.lineHeight": rule("body", "line-height"),
    "typography.body.fontFeature": rule("body", "font-feature-settings"),
    // `.facts dd` inherits the body's family, which is `--font`.
    "typography.body-sm.fontFamily": () => resolveVars(rules, "var(--font)"),
    "typography.body-sm.fontSize": rule(".facts dd", "font-size"),
    "typography.body-sm.lineHeight": rule(".facts dd", "line-height"),
    "typography.button.fontFamily": btnFont("family"),
    "typography.button.fontSize": btnFont("size"),
    "typography.button.fontWeight": btnFont("weight"),
    "typography.button.lineHeight": btnFont("leading"),
    "typography.button.letterSpacing": rule(".btn", "letter-spacing"),
    // Shapes.
    "rounded.control": root("--radius-control"),
    "rounded.shot": root("--radius-shot"),
    "rounded.frame": () => evalPxCalc(resolveVars(rules, cssValue(rules, ":root", "--radius-frame"))),
    "rounded.tweak": rule(".tweak-track", "border-radius"),
    "rounded.wheel-frame": rule(".wheel-frame", "border-radius"),
    // The slider thumb's `calc(8px - var(--inset))` takes `--inset` from `.tweak-track`.
    "rounded.thumb": () =>
      evalPxCalc(
        resolveVars(rules, cssValue(rules, ".tweak-thumb", "border-radius"), {
          "--inset": cssValue(rules, ".tweak-track", "--inset"),
        })
      ),
    "rounded.sticker": rule(".token", "--art-radius"),
    // Layout (styles.css:51-58) and insets.
    "spacing.wrap": root("--wrap"),
    "spacing.wrap-wide": root("--wrap-wide"),
    "spacing.gutter": root("--gutter"),
    "spacing.section": root("--section"),
    "spacing.frame-inset": root("--frame-inset"),
    "spacing.tweak-inset": rule(".tweak-track", "--inset"),
  }
}


// ────────────────────────────────────────────────────────────── cases ────

const landingMd = fs.readFileSync(path.join(ROOT, "DESIGN.md"), "utf8")
const landingRules = parseCss(landingCss)
const LANDING = landingTable(landingRules)

/** Problems a drifted copy adds over the real file, so each case names only its own. */
const added = (problems, baseline) => problems.filter((p) => !baseline.includes(p))
const landingBaseline = compareTokens(landingMd, LANDING)

const report = (problems) => `${problems.length} drifted:\n       ${problems.join("\n       ")}`

check(`DESIGN.md frontmatter equals styles.css (${Object.keys(LANDING).length} mapped tokens)`, () => {
  const problems = landingBaseline
  assert.equal(problems.length, 0, report(problems))
})

// The check itself can fail. Each case drifts an in-memory copy, never the file.

check("a changed value and a moved accent-fill both fail", () => {
  const drifted = landingMd.replace('  ink-2: "#a1a1aa"', '  ink-2: "#a1a1ab"')
  assert.notEqual(drifted, landingMd, "the fixture line moved; update this case")
  assert.deepEqual(added(compareTokens(drifted, LANDING), landingBaseline), [
    'colors.ink-2: DESIGN.md has "#a1a1ab", source has "#a1a1aa"',
  ])
  const rules = parseCss(landingCss.replace("--accent-fill: #4a5df9;", "--accent-fill: #5a5df9;"))
  const problems = compareTokens(landingMd, landingTable(rules))
  assert.ok(problems.some((p) => p.startsWith("colors.pill: ")), report(problems))
  assert.ok(problems.some((p) => p.startsWith("colors.primary-fill: ")), report(problems))
})

check("an unmapped token and a stale row each fail", () => {
  const extra = landingMd.replace("colors:\n", 'colors:\n  brand-new: "#000000"\n')
  assert.notEqual(extra, landingMd, "the fixture line moved; update this case")
  assert.deepEqual(added(compareTokens(extra, LANDING), landingBaseline), [
    "colors.brand-new: no mapping row; add one to test/design-md-cases.mjs",
  ])
  const stale = { ...LANDING, "colors.retired": () => "#000000" }
  assert.deepEqual(added(compareTokens(landingMd, stale), landingBaseline), [
    "colors.retired: mapping row has no frontmatter token; remove the row",
  ])
})

check("a rule that loses its declaration reports the source as gone", () => {
  const rules = parseCss(landingCss.replace("  --art-radius: 0.175em;\n", ""))
  assert.deepEqual(added(compareTokens(landingMd, landingTable(rules)), landingBaseline), [
    "rounded.sticker: source is gone (no --art-radius in `.token` in styles.css)",
  ])
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
