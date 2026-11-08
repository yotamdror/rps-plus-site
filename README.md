# rps-plus-site

The public site at <https://rps.plus>, served by GitHub Pages from `main` (root).

This repository holds only the built, public page. The game's source and the
marketing page's source live in the private `rps-plus` repository; its build
pushes the finished files here. Do not copy game source into this repository.

- `CNAME` sets the custom domain (`rps.plus`; `www.rps.plus` redirects to it).
- `.nojekyll` serves files as they are, with no Jekyll build.
- `opener/` is the opener film, copied as built from `rps-plus`
  (`node scripts/marketing/build-opener.mjs`, then all of `dist/marketing/opener/` except its
  `index.html`). A change to the film repeats that copy.
