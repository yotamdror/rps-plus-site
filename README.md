# rps-plus-site

The public site at <https://rps.plus>, served by GitHub Pages from `main` (root).

This repository holds only the built, public page. The game's source and the
marketing page's source live in the private `rps-plus` repository; its build
pushes the finished files here. Do not copy game source into this repository.

- `CNAME` sets the custom domain (`rps.plus`; `www.rps.plus` redirects to it).
- `.nojekyll` serves files as they are, with no Jekyll build.
- `opener/` is the opener film, copied as built from `rps-plus`
  (`node scripts/marketing/build-opener.mjs`, then all of `dist/marketing/opener/` except its
  `index.html`; since 2026-11-09 that includes `floats/`, the parade's floats). A change to the film repeats that copy.

## The feed

Under the film, `index.html` carries a feed of news and release notes, newest first (`#feed`). The first screen
is still the film alone; ▾ SCROLL FOR MORE appears beside ↻ REPLAY when the film ends. `rps.plus/#this-week` jumps
to the newest post; each post has its own anchor (`#alpha-week-1`) so an old link keeps working.

- **Tags and the filter.** Each post is `<article class="post" id="..." data-tag="...">` with a brass tag label
  before its date. The row at the top (ALL, RELEASE NOTES, NEWS) shows one tag at a time and keeps it in the address
  (`rps.plus/#release-notes`). A new tag: add it to `TAGS` in the feed script, add its button to `.filters`, and
  put it on its posts.
- **A release note is a story** (`.rn-story`): one stage holds every loop (`.rn-reel video.loop`, `data-step` =
  the note, `data-part` = 0 or 1), and the notes (`.rn-step`) scroll past it. The lit note's loop shows. Phones
  (under 700 px): the loop fills the screen and each note is a solid rust card that scrolls over it, a screen
  apart; the card's kicker carries `N / 5`. iPad and computers: the loop pinned left with a count and bars, the
  notes right. A note with two loops (BEFORE, AFTER) switches by scroll: the second loop shows 30 % of a screen
  after the note lights (give that note `class="rn-step two"`).
- **Loops** live in `blog/<post-id>/` (MP4, H.264, 786 x 1704, muted, a few seconds, under ~400 KB each). They load
  only when the story comes near and play only while on screen. Week 1's are built in `rps-plus` by
  `docs/work/mocks/alpha-week-post/scripts/notes.cjs` (that folder's README has the rebuild).
- **Fonts.** The feed's body text is Geist Pixel (`fonts/GeistPixel-400.woff2`, copied from `rps-plus`
  `assets/fonts/`); headings are Jersey 25, labels Silkscreen.
- **Adding a post:** copy an `<article>` to the top of `#feed`, give it a new `id`, a tag and a date, and move the
  `<span id="this-week" class="anchor">` into it. A text post needs nothing else.
