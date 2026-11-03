# Design Layer landing page

The marketing site for [DesignLayer](https://github.com/phil8-li/design-layer),
and every launch film cut made for it. Nothing in the editor imports it, and it
imports nothing from the editor at runtime. Its history up to 2026-10-22 is
`landing/` in phil8-li/design-layer.

A single static page: `index.html`, `styles.css`, `main.js`, and `assets/`. No
build step and no dependencies. `.github/workflows/pages.yml` publishes it to
[GitHub Pages](https://phil8-li.github.io/design-layer-landing-page/) on every
push to `main`. The old address, `phil8-li.github.io/design-layer/`, redirects
here.

| Path | What |
| --- | --- |
| `index.html`, `styles.css`, `main.js`, `backgrounds.js` | The page |
| `assets/` | Screenshots, stage posters, fonts, brand, and the published film |
| `stages/` | The feature demos: the stage kit, one module per section, a preview and a filming harness |
| `film/` | Film sources: `story/`, `promo/`, `beat/` and the sound tools |
| `film/iterations/` | Every rendered cut, rounds 1 to 8, with comparison pages (Git LFS) |
| `check.mjs`, `serve.mjs`, `tools/` | Checker, local server, asset tools |
| `test/` | DESIGN.md token check and the get-started commands |
| `DESIGN.md` | Design rules for the page |

```sh
node serve.mjs                 # http://127.0.0.1:4321
node check.mjs                 # markup, links, budget, then a browser pass
node check.mjs --only static   # what CI runs; needs no browser
npm test                       # also in CI
```

The browser pass needs Playwright. It is found on its own when installed
globally or through `npx`; otherwise point `SITE_PLAYWRIGHT_DIR` at a
`node_modules` that has it.

## Screenshots

The hero is a real capture of Design Layer editing a real open-source app,
under `assets/shots/<demo>/`. The page shows one demo, `midday`: Midday's
open-source website (AGPL-3.0), renamed "Demo app", with its copy rewritten to
describe Design Layer. Each demo folder has a `manifest.json` naming the app,
its repository and license, and what each shot shows. The feature sections
show these captures too, whole and bare, with the one unit a beat is about
built in DOM and lifted in place in front of them (see Motion).

After a recapture, write the two served widths and refresh `demos.json`:

```sh
node tools/optimize-shots.mjs            # every demo folder
node tools/optimize-shots.mjs --only a,b  # some, while another is still being shot
```

With more than one demo folder, `?review` adds a picker and `?demo=<slug>`
shows one directly. Both affect the hero only: the stages name their captures
themselves (`stages/<name>.js`).
`optimize-shots.mjs` adds what the hero needs from the pixels, the panel seams
and the toolbar's place. The film's `GEO` is measured by hand, so re-measure it
when a recapture moves the page's content.

## Motion

`main.js` runs every scene from one `requestAnimationFrame` loop:

- **Hero:** three planes (the app, the editor's panels, its toolbar) start
  apart at a gentle angle and follow the pointer; scroll sets them down in turn
  until they line up into the real screenshot, then the mock flies straight
  into Design like Figma's frame, whose stage is pinned underneath. The frame
  covers the landed mock, then the stage fades up in it and plays its first
  beat.
- **Feature sections**, in story order: Design like Figma (Direct edit, Align,
  Measure, Hide Design Layer), the design system (Libraries, Tokens, Audit),
  the board (Board, then Live), then iterating with an agent (Point, Send,
  Compare, Pick). Each is a stage (`stages/<name>.js` and `.css`): the real
  capture of the editor, whole and bare on the page, and the one unit the beat
  is about (the headline, the inspector's panel, the Changes list) built in
  DOM at its real size with the capture's real content, lifted in place out
  of the screenshot so it covers its own source; the gesture (cursor, typing,
  keys) happens on the lifted unit and the capture behind it swaps to the
  state that results. One beat per tab. Each section pins; scroll
  walks the tabs, each tab plays its beat and holds its result, and choosing a
  tab scrolls to it. The board has no tabs: its scroll walks the opening still,
  then its two beats. Nothing is explained in text under a frame.
- **Headings** brighten word by word as they rise. The nav stays out of the
  hero and slides in once Design like Figma pins.

A stage loads (`import()`, with the kit's `stagekit.css` and
`look-designlayer.css`) when its section comes within one screen. Until then,
and without script, the frame shows the stage's poster:
`assets/shots/stages/<name>-poster.webp`, the rest frame of the stage's
`meta.poster` beat. To add or change a stage, follow the contract in
[stages/README.md](stages/README.md) (`meta`, `mount(root)` returning `set`,
`play`, `pause`, `destroy`), check it in `stages/preview.html?stage=<name>`,
then add a `.stage[data-stage="<name>"]` root and its poster to a section's
`.frame-view`. Film a poster at the page's width and convert it as the other
images are:

```sh
node stages/film.mjs "http://127.0.0.1:4321/stages/preview.html?stage=<name>&width=1120&beat=<meta.poster>&instant=1" \
  --select .host --wait 800 --out /tmp/poster-<name>.png
cwebp -q 74 -m 6 -crop 0 0 2240 1344 /tmp/poster-<name>.png -o assets/shots/stages/<name>-poster.webp
```

The toolbar over the hero's screenshot is redrawn in HTML from the editor's
computed styles, in a 1600x1000 layer scaled to the frame, so it stays sharp as
it lands. The hero's app plane shows `hero-bare` (the same capture with the
toolbar hidden, taken by `capture-midday.mjs`), so the only toolbar there is
the one that lands.
With `prefers-reduced-motion: reduce`, nothing is pinned: each stage rests on
its first tab's result (the board on its poster beat), and a tab jumps to its
beat's result with no gesture. Without script, each frame shows its poster.

WebGL backgrounds run outside that loop, each only while it is on screen
(`backgrounds.js`, ported from React Bits' GradientBlinds, under the license in
`backgrounds.LICENSE.txt`): gradient blinds in the site's indigo. In the hero
they sit behind the mockup at 20% strength (`HERO_BLINDS`), lit from above the
top center by LightRays' average falloff, and fade out from the top of the
viewport down, the footer's fade turned over. In the footer the blinds rise out
of the section above and run to the bottom edge, lit where the pointer is, with
the light kept above the links. Everywhere else the page is plain black.
Reduced motion gets one still frame; without WebGL the hero keeps a CSS glow
(grained at `NOISE`) and the footer goes plain.

## Launch film

`assets/film/` holds the approved launch film: the One move cut (`film/promo`,
cut `t`) with its Trailer score (`film/promo/sound`, option `trailer`), 36 s with
sound. The page's Watch the film dialog plays it. To rebuild it:

```sh
node film/promo/render.mjs t --ss 2      # the picture
python3 film/promo/sound/mix.py t trailer --take 3 --video /tmp/designlayer-film/promo/cut-t.mp4
node film/promo/publish.mjs t trailer    # launch.mp4, launch-720.mp4 (each < 4 MB), launch-poster.jpg
```

`film/render.mjs` is the first film, 50 s and silent. It still writes to
`assets/film/` when run, so publish the approved cut again afterwards.

## Get started section

Both cards run the same two lines, `git clone` and `npm install`, then one
command each: `npx designlayer` (the start screen, in the browser) or
`node desktop/mac/install.mjs` (the Dock app). The page offers no
`curl | bash` one-liner and no download link on purpose:

- A `.command` double-clicked from a browser download is quarantined, and
  macOS 15+ refuses it ("Apple could not verify … is free of malware") until
  the user clicks Open Anyway in System Settings › Privacy & Security.
- Managed Macs warn on `curl … | bash` and ask for a signed package instead.

A git clone has neither problem, as long as phil8-li/design-layer holds no Git
LFS files: on a Mac whose `~/.gitconfig` requires LFS but whose Terminal has no
git-lfs, a clone stops at the first one and leaves a `design-layer` folder with
no `package.json`. That is why the page, its films and the film archive live
here. `test/get-started-cases.mjs` checks the page keeps to all of this.

phil8-li/design-layer still builds `Design-Layer-for-Mac.zip` from
`desktop/mac/package.mjs` on every push to its `main`, for people without git,
at `https://phil8-li.github.io/design-layer/downloads/Design-Layer-for-Mac.zip`;
its README.txt explains the Open Anyway step.

## Icons

`assets/icons.svg` is generated from the editor's own glyphs in
`src/core/icons.ts` of phil8-li/design-layer. Add a name to the list in
`tools/build-sprite.mjs` and run it with an installed clone of that repository
beside this one, or point `DESIGNLAYER_REPO` at one:

```sh
node tools/build-sprite.mjs
DESIGNLAYER_REPO=<path to design-layer> node tools/build-sprite.mjs
```

The page is set in [Inter](https://rsms.me/inter/) (SIL Open Font License,
`assets/fonts/LICENSE-Inter.txt`), with headlines in Instrument Sans and the
demo app's headline in the stages set in Hedvig Letters Serif (SIL Open Font
License, `assets/fonts/LICENSE-OFL.txt`, loaded by the stage sheets), all
subset to Latin.

## Film iterations

`film/iterations/` keeps every cut that was rendered while choosing the launch
film: the first three options, then rounds 2 to 8, each with an `index.html`
that plays the options side by side. Open `film/iterations/index.html` through
`node serve.mjs` to browse them.

The MP4s and sound spectrograms are stored in Git LFS (`.gitattributes` at the
root). Install it once with `brew install git-lfs && git lfs install`, or clone
with `GIT_LFS_SKIP_SMUDGE=1` to skip them. They are excluded from `check.mjs`'s
budget and from the deploy.
