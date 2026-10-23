/**
 * The get-started section installs phil8-li/design-layer from a git clone.
 *
 * macOS 15+ refuses a quarantined, unsigned .command until the user clicks Open
 * Anyway in Privacy & Security, and managed Macs warn on `curl | bash`. A clone
 * has neither problem, and its steps must work: the clone's own `npm install`
 * comes first, because npm installs no dependencies for a folder dependency and
 * the prepare script needs esbuild. Moved here with the page from
 * desktop/mac/test/desk-cases.mjs in phil8-li/design-layer.
 *
 * Usage: node test/get-started-cases.mjs
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

const page = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
const start = page.slice(page.indexOf('id="start"'), page.indexOf("</section>\n    </section>", page.indexOf('id="start"')))

check("the get-started section installs from a clone, with no security prompt", () => {
  assert.doesNotMatch(page, /\|\s*(ba)?sh\b/, "the page pipes nothing into a shell")
  assert.doesNotMatch(page, /right-click/i, "the page must not send users to right-click > Open")
  assert.doesNotMatch(start, /\.zip|\.command/, "the section offers no quarantined download")
  // One line per command; the copy button joins these lines (main.js setupCopy).
  const shown = [...start.matchAll(/<code>([\s\S]*?)<\/code>/g)].map(([, code]) => [...code.matchAll(/<span class="t-cmd">(.*?)<\/span>/g)].map(([, line]) => line))
  const setup = ["git clone https://github.com/phil8-li/design-layer", "cd design-layer &amp;&amp; npm install"]
  const expected = [[...setup, "npx designlayer"], [...setup, "node desktop/mac/install.mjs"]]
  assert.deepEqual(shown, expected, "the browser card starts the editor; the Mac card installs the app")
  assert.match(start, /Use it in your browser on top of your app\./)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
