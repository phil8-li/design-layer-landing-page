# AGENTS.md — landing page

Instructions for AI agents editing the DesignLayer landing page, served at
https://phil8-li.github.io/design-layer-landing-page/. The tool lives in
[phil8-li/design-layer](https://github.com/phil8-li/design-layer); this
repository shares no code with it at runtime.

Design rules live in DESIGN.md. Read it before any UI edit, and add new rules there.

## Commands

```sh
node serve.mjs                 # http://127.0.0.1:4321
node check.mjs --only static   # markup, links, budget (what CI runs)
node check.mjs                 # plus a Playwright browser pass
npm test                       # DESIGN.md tokens, get-started commands
```

Run `node check.mjs --only static && npm test` before saying a change works.
The page has a hard budget: html+css+js under 180 KB, each image under 700 KB,
each video under 4 MB, first view under 2.5 MB.

## Rules

- No build step and no dependencies. Plain HTML, CSS and ES modules.
- Screenshots are real captures under `assets/shots/<demo>/`; regenerate them
  with `tools/optimize-shots.mjs`, never hand-edit.
- `film/iterations/` is an archive of rendered cuts in Git LFS. Add new rounds
  there; never delete or re-encode old ones.
- The get-started commands are how people install phil8-li/design-layer.
  Change them only together with that repository's README.
- With `prefers-reduced-motion: reduce`, or without script or WebGL, every
  scene must rest in its final frame.

See [README.md](README.md) for the motion system and the film pipeline.
