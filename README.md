# rps-plus-site

The public site at <https://rps.plus>, served by GitHub Pages from `main` (root).

The game's name in words is **RPS plus**, never "RPS+" (owner, 2026-11-24); the logo art stays as drawn.

This repository holds only the built, public page. The game's source and the
marketing page's source live in the private `rps-plus` repository; its build
pushes the finished files here. Do not copy game source into this repository.

- `CNAME` sets the custom domain (`rps.plus`; `www.rps.plus` redirects to it).
- `.nojekyll` serves files as they are, with no Jekyll build.
- `index.html` is the Alpha sign-up page (look A, "Event TV"): the trailer in `film/` (muted autoplay, plays once, then REPLAY; no autoplay under reduced motion; see Trailer A/B below; `rps-plus.mp4` and `poster.jpg` are the old film, no longer linked, to delete a week after the switch), the sponsor marks and benefit stills in
  `img/`, the game's fonts in `fonts/`. The form posts email and the optional sponsor (`kuiper`, `adAstra`,
  `paperCorp`, `solarTie`, `ponzi`) with `source: 'site'` and coarse context to the Alpha Worker's `/api/notify`; a
  page view pings `/api/visit`.
- `opener/` is the old opener film, kept in the tree but no longer linked from any page.

## Trailer A/B (`film/`)

**Now only the gameplay trailer (`fair`)** (owner, 2026-11-22: "leave corporate off for now"): `FILMS` in `index.html` lists `['fair']`; add `'corporate'` back to split visitors between the two films again. The rest of this section describes the split.

The page can play one of two films, picked at random per visitor, so sign-up rates can be compared. Files: `film/fair.mp4`
+ `film/fair-poster.jpg` (the fair trailer) and `film/corporate.mp4` + `film/corporate-poster.jpg` (the corporate one).
The `<video>` has no `src` in the HTML; the script sets `src` and `poster` after the pick.

- **The pick.** A coin flip on a device's first load, kept in `localStorage` key `rpsFilm` (`fair` or `corporate`), so a
  visitor sees the same film every time. Storage blocked: a fresh flip each load.
- **What is sent.** `film` goes with the page view (`/api/visit`, plus `first` on a device's first load) and with the
  sign-up (`/api/notify`). Nothing rides in the URL (owner, 2026-11-22). Run-data's "Trailer score" section in
  `rps-plus` has the query.
- **Swapping a film:** replace its two files (same names; the poster is the first frame, a JPG under ~150 KB) and push.
  Visitors keep their assigned side, so a changed film mixes into the same counts: start a new test under new names.

## News (`news/`)

The release-notes feed lives on an unlisted page, `rps.plus/news/` (`news/index.html`), newest post first (`#feed`).
`index.html` is only the sign-up page and links nowhere to it. `rps.plus/news/#this-week` jumps to the newest post;
each post has its own anchor (`#alpha-week-1`).

- **Old links forward.** The first script in `index.html`'s `<head>` sends an old link such as `rps.plus/#alpha-week-1`
  to `/news/#alpha-week-1` before anything draws. It holds a hard-coded list: `#this-week`, `#release-notes`, `#news`,
  `#all`, `#feed`, `#alpha-week-1`, `#site-live`. Every new post id goes on that list.
- **Tags and the filter.** Each post is `<article class="post" id="..." data-tag="...">` with a brass tag label
  before its date. The row at the top (ALL, RELEASE NOTES, NEWS) shows one tag at a time and keeps it in the address
  (`rps.plus/news/#release-notes`). A new tag: add it to `TAGS` in the feed script, add its button to `.filters`, and
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
- **Adding a post:** copy an `<article>` to the top of `#feed` in `news/index.html`, give it a new `id`, a tag and a
  date, and move the `<span id="this-week" class="anchor"></span>` into it. Then add its id to the forwarding list in
  `index.html`. A text post needs nothing else.
