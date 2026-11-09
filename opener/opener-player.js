/* The opener film's player (docs/plans/2026-11-06-opener-plan.md, step 3).

   Round 16 of docs/work/mocks/opener/ (round16.src.html), the film the owner approved, made to read the files
   scripts/marketing/build-opener.mjs bakes (manifest.json, sky.png, skyline.png, mars-surface.png, sprites/, the crowd,
   parade-lib.js, fonts/) instead of building them. The drawing logic below is round 16's, copied as it stands: shot1,
   twinkle, smoke, marsShot, wordsIn, round16 (here draw). What changed:
     - the sky, skyline and Mars's surface are loaded, not drawn; the disc is shaded with manifest.json's disc.shade
       table (round 16's spinCanvas, one lookup in place of snapTok)
     - the crowd and the game's small helpers come from the baked 29d-parade-crowd.js and parade-lib.js
     - it autoplays once, holds the end card, offers a replay under the film, and shows the end card still when the
       visitor prefers reduced motion
   The film sits in the page's flow: a box of its container's width at 393 : 852, the 393 x 852 stage scaled inside it.
   Nothing is fixed or positioned outside that box, so it never covers the page around it.

   The speaker (docs/plans/2026-11-07-opener-trailer-plan.md "Sound on", step 6): a real <button> at the film's top right, 8 px
   in, in CSS pixels outside the scaled stage (a 40 px box, 44 px to tap, the same size at any film width). It shows once
   soundReady is true, never under reduced motion. Silent: the speaker with a cross and TAP FOR SOUND in a dark box; a tap
   calls sound(true). With sound: the 40 px square with the speaker and two waves; a tap calls sound(false). Its drawing
   (speaker.html's BODY, CROSS and WAVES, 14 x 11 pixels at two screen pixels a pixel) is an inline SVG made once per look,
   never per frame: the film's redraws and its 30 fps gate are untouched.

   RPSOpener.mount(el, { base: './', autoplay: true, paradeStart }) -> { ready, soundReady, sound(on), replay(), seek(t), stats, duration }
     base        the folder the baked files are in (the page's URL resolves it)
     mix         overrides for the opening's levels and times, read at each play (opener-score.js MIX): { crowd, musicIn, musicLow, musicFull }
     paradeStart the parade's loop starts at this float (0 to 11, manifest.parade.order) on every play; left out, each play
                 (the first, replay(), sound(true)) picks one at random. The checks and the test page's ?parade=<n> fix it
     ready       a promise: files loaded and the first frame drawn
     soundReady  a promise: true once sound.js (the game's sound code and the film's score, ~110 KB) has loaded, which starts
                 after the first frame is drawn so it never delays it; false under reduced motion (no sound) or if it fails
     sound(on)   call it inside the visitor's tap (a click handler): iPhones wake audio only there.
                 sound(true) wakes the game's engine (AU.init, unlock, unmute, session 'playback', all synchronously in the
                 tap), restarts the film from 0:00 with the score scheduled LEAD (0.25 s) ahead on the audio clock, and runs the
                 film's clock from the audio clock (the time being heard), so a word and its hit share a frame. Returns true
                 when the sound is on; false before soundReady, under reduced motion, or with no Web Audio.
                 sound(false) fades the sound out fast (60 ms), stops it, and hands the film back to the page clock where it is
                 (no jump); a film that has ended stays on its end card. Returns false.
                 While the sound is on, replay() restarts with sound (it is a tap too); seek(t) turns it off.
     replay()    play from the start
     seek(t)     draw the frame at t seconds and stop (a promise, resolved when the sprites are decoded): the tests' clock
     stats       { frames: redraws so far, filesLoadedAt, firstFrameAt (performance.now ms), t: the film time last drawn,
                 clock: 'page' or 'audio', soundT0: the audio time of the film's 0:00 while the sound is on }
   The crowd (window.paradeCrowd) and the game's helpers (window.RPSOpenerLib) load as plain <script>s: two globals, no eval. */
(function(){
'use strict';

// The one frame gate (owner, 2026-10-19: every animation redraws at most 30 times a second, whatever the display; time still
// comes from the clock). Copied from src/js/00-base.js line 9: FRAME_MS and frameDue(gate, now), true at most once per
// FRAME_MS-2 per gate object ({last}), the films' test.
const FRAME_MS = 1000/30;
function frameDue(gate, now){ if(gate.last==null || now-gate.last>=FRAME_MS-2){ gate.last=now; return true; } return false; }

const THROWS = ['rock', 'paper', 'scis'];
const THROW_HEX = { rock:'#FF2E6E', paper:'#2EE6FF', scis:'#FFCE3A' };
function jit(f, k){ const x = Math.sin(f * 12.9898 + k * 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; }
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
function el(tag, cls, parent){ const e = document.createElement(tag); if(cls) e.className = cls; if(parent) parent.appendChild(e); return e; }
function img(parent, cls){ const i = el('img', cls, parent); i.alt = ''; i.draggable = false; return i; }
const ease = u => .5 - .5 * Math.cos(Math.PI * u);   // the pan on a sine in-out (round 11; round 16's was a cubic)
const fade = (t, t0, d) => clamp((t - t0) / d, 0, 1);   // smooth: a new opacity every frame

// round 16's stage styles (its .stage rules), scoped to .rpso; the film's two fonts are the baked ones
const css = base => `
.rpso{ position:relative; --slate:#48433C; --ink:#070708; --cream:#F3E5C4; --grey:#9E9687; --warm:#817965; --iron:#6E675C; --brass:#C0B48E; --rock:#FF2E6E; --paper:#2EE6FF; --scis:#FFCE3A; --hair:rgba(255,255,255,.09);
  --f-display:"RPSO Jersey","Impact","Arial Narrow",sans-serif; --f-chrome:"RPSO Silkscreen","Courier New",monospace; box-sizing:border-box; display:block; width:100%; margin:0 }
.rpso *{ box-sizing:border-box }
.rpso [hidden]{ display:none !important }
@font-face{ font-family:"RPSO Jersey"; src:url("${base}fonts/Jersey25-400.woff2") format("woff2"); font-display:block }
@font-face{ font-family:"RPSO Silkscreen"; src:url("${base}fonts/Silkscreen-400.woff2") format("woff2"); font-display:block }
@font-face{ font-family:"RPSO Pixelify"; src:url("${base}fonts/PixelifySans-400_700.woff2") format("woff2"); font-weight:400 700; font-display:block }
.rpso .box{ position:relative; width:100%; aspect-ratio:393/852; overflow:hidden; background:var(--ink); contain:paint }
.rpso .stage{ position:absolute; left:0; top:0; width:393px; height:852px; overflow:hidden; background:var(--ink); transform-origin:0 0; transform:scale(var(--s,1)); color:var(--cream); font-family:var(--f-chrome) }
.rpso .stage > *{ position:absolute; box-sizing:border-box }
.rpso .stage canvas.space{ left:0; top:0; width:394px; height:852px; image-rendering:pixelated }
.rpso .stage .sun{ left:34px; top:264px; width:324px; height:168px; border-radius:162px 162px 0 0 / 168px 168px 0 0; background:repeating-linear-gradient(to bottom, var(--grey) 0 5px, var(--warm) 5px 9px, var(--ink) 9px 15px) }
.rpso .stage .sun::after{ content:''; position:absolute; inset:0; border-radius:inherit; background:linear-gradient(to bottom, rgba(7,7,8,.88), rgba(7,7,8,.15) 55%, transparent) }
.rpso .stage .floor{ left:0; top:432px; width:393px; height:1px; background:var(--iron) }
.rpso .stage .mars{ left:36px; top:220px; width:320px; height:212px }
.rpso .stage .mars img, .rpso .stage .refl img{ position:absolute; left:0; top:0; width:320px; height:212px; image-rendering:pixelated }
.rpso .stage .refl{ left:36px; top:433px; width:320px; height:212px; overflow:hidden; opacity:.32; -webkit-mask-image:repeating-linear-gradient(to bottom, #000 0 3px, transparent 3px 6px); mask-image:repeating-linear-gradient(to bottom, #000 0 3px, transparent 3px 6px) }
.rpso .stage .refl img{ transform:scaleY(-1) }
.rpso .stage .scan{ inset:0; background:repeating-linear-gradient(to bottom, rgba(0,0,0,.42) 0 1px, transparent 1px 3px); pointer-events:none }
.rpso .stage .vig{ inset:0; background:radial-gradient(ellipse at 50% 42%, transparent 38%, rgba(0,0,0,.94) 100%); pointer-events:none }
.rpso .stage .flash{ inset:0; background:#fff }
.rpso .stage .pit{ inset:0 } .rpso .stage .pit > *{ position:absolute; box-sizing:border-box }
.rpso .stage .pit canvas.smoke{ position:absolute; image-rendering:pixelated }
.rpso .stage .big{ left:12px; right:12px; top:72px; text-align:center; font:64px/.9 var(--f-display); letter-spacing:.04em; color:var(--cream); text-wrap:balance }
.rpso .stage .line10{ left:0; right:0; top:344px; font-size:56px; line-height:.9; white-space:nowrap; text-wrap:nowrap; text-shadow:0 4px 0 var(--ink), 4px 0 0 var(--ink), -4px 0 0 var(--ink), 0 -4px 0 var(--ink) }
.rpso .stage .w4{ left:0; width:393px; top:420px; display:grid; gap:4px; justify-items:center }
.rpso .stage .w4 div{ font:84px/.92 var(--f-display); transform-origin:center }
.rpso .stage .w4 .rock{ color:var(--rock) } .rpso .stage .w4 .paper{ color:var(--paper) } .rpso .stage .w4 .scis{ color:var(--scis) } .rpso .stage .w4 .plus{ color:var(--cream) }
.rpso .stage .w6{ top:440px; display:flex; flex-wrap:nowrap; justify-content:center; align-items:baseline; column-gap:9px; row-gap:0 }   /* ROCK PAPER SCISSORS plus in one line under Mars (his feet on row 415) */
.rpso .stage .w6 div{ font-size:34px; text-shadow:0 4px 0 var(--ink), 4px 0 0 var(--ink), -4px 0 0 var(--ink), 0 -4px 0 var(--ink) }   /* the title line's ink edge */
.rpso .stage .w6 .lc{ font-size:34px; transform:skewX(-12deg); margin:0 }
.rpso .stage .rules{ left:16px; right:16px; top:568px; text-align:center; font:12px/1.6 var(--f-chrome); letter-spacing:.22em; white-space:nowrap; color:var(--brass) }   /* a footnote in the alpha line's own style (owner, 2026-11-09, fair-trailer round 16: A) */
.rpso .stage .url{ left:8px; right:8px; top:524px; text-align:center; font:28px/1.2 var(--f-display); letter-spacing:.04em; color:var(--cream) }
.rpso .stage .alpha{ left:16px; right:16px; top:487px; text-align:center; font:12px/1.6 var(--f-chrome); letter-spacing:.22em; color:var(--brass) }
/* Mars's line: the game's speech bubble (src/css/12b-say.css), its stepped tail (21b-say.js sayTailShadow) turned over to point down at him; its pop-in is drawn from the clock */
.rpso .stage .say{ --cream:#F3E5C4; --charcoal:#2B2824; left:241px; top:auto; bottom:calc(852px - 205px); z-index:3; padding:9px 14px 7px;
  background:var(--cream); color:var(--charcoal); text-align:center; white-space:nowrap; font:400 22px/1.1 "RPSO Pixelify",var(--f-chrome);
  transform-origin:50% 100%; filter:drop-shadow(9px 9px 0 rgb(7 7 8 / .55));
  box-shadow:3px 0 0 var(--cream),-3px 0 0 var(--cream),0 3px 0 var(--cream),0 -3px 0 var(--cream),
    6px 0 0 var(--charcoal),-6px 0 0 var(--charcoal),0 6px 0 var(--charcoal),0 -6px 0 var(--charcoal),
    3px 3px 0 var(--charcoal),-3px 3px 0 var(--charcoal),3px -3px 0 var(--charcoal),-3px -3px 0 var(--charcoal) }
.rpso .stage .say i{ position:absolute; width:3px; height:3px; left:50%; top:calc(100% + 3px); margin-left:-15px; box-shadow:12px 12px 0 var(--charcoal),15px 12px 0 var(--charcoal),9px 9px 0 var(--charcoal),18px 9px 0 var(--charcoal),12px 9px 0 var(--cream),15px 9px 0 var(--cream),6px 6px 0 var(--charcoal),21px 6px 0 var(--charcoal),9px 6px 0 var(--cream),12px 6px 0 var(--cream),15px 6px 0 var(--cream),18px 6px 0 var(--cream),3px 3px 0 var(--charcoal),24px 3px 0 var(--charcoal),6px 3px 0 var(--cream),9px 3px 0 var(--cream),12px 3px 0 var(--cream),15px 3px 0 var(--cream),18px 3px 0 var(--cream),21px 3px 0 var(--cream),0px 0px 0 var(--charcoal),27px 0px 0 var(--charcoal),3px 0px 0 var(--cream),6px 0px 0 var(--cream),9px 0px 0 var(--cream),12px 0px 0 var(--cream),15px 0px 0 var(--cream),18px 0px 0 var(--cream),21px 0px 0 var(--cream),24px 0px 0 var(--cream) }
.rpso .replay{ display:block; margin:10px auto 0; min-height:44px; min-width:160px; padding:0 22px; border-radius:22px; border:1px solid #2a3340; background:#1b2532; color:#dfe7ef; font:600 16px/1 -apple-system,system-ui,"Segoe UI",Roboto,sans-serif; cursor:pointer }
.rpso .replay:focus-visible{ outline:2px solid var(--paper); outline-offset:2px }
/* the speaker (speaker.html look C, top right): CSS pixels, over the box, outside the scaled stage */
.rpso .spk{ position:absolute; top:8px; right:8px; z-index:2; display:flex; align-items:center; justify-content:center; gap:8px; margin:0;
  height:40px; min-width:40px; padding:0; color:var(--cream); background:rgb(7 7 8 / .72); border:1px solid var(--slate); border-radius:0;
  font:11px/1 var(--f-chrome); cursor:pointer; -webkit-tap-highlight-color:transparent; -webkit-appearance:none; appearance:none }
.rpso .spk svg{ width:28px; height:22px; display:block; flex:none; shape-rendering:crispEdges; fill:currentColor }
.rpso .spk .word{ display:none; font:11px/1 var(--f-chrome); letter-spacing:.14em; color:var(--brass); white-space:nowrap }
.rpso .spk.off{ padding:0 12px 0 7px }
.rpso .spk.off .word{ display:block }
.rpso .spk::after{ content:''; position:absolute; inset:-3px }   /* 44 px to tap: the 38 px inside the hairline, 3 px round it */
.rpso .spk:focus{ outline:none }
.rpso .spk:focus-visible{ outline:2px solid var(--cream); outline-offset:2px }
`;

// ===== the film's numbers (the manifest's) =====
const WW = 197, WH = 426;   // the world, in world pixels (two screen pixels each)

// the speaker: a 14 x 11 pixel drawing (speaker.html's), two screen pixels a pixel (the film's robot pixel)
const SPK_BODY = [[0,3,3,5],[3,2,1,7],[4,1,1,9],[5,0,1,11]];                                                   // the magnet and the cone
const SPK_CROSS = [[8,3],[9,4],[10,5],[11,6],[12,7],[12,3],[11,4],[9,6],[8,7]].map(([x, y]) => [x, y, 1, 1]);   // silent
const SPK_WAVES = [[7,3,1,1],[8,4,1,3],[7,7,1,1],[10,1,1,1],[11,2,1,1],[12,3,1,5],[11,8,1,1],[10,9,1,1]];          // sound on
const spkSvg = on => '<svg viewBox="0 0 14 11" aria-hidden="true" focusable="false">' + SPK_BODY.concat(on ? SPK_WAVES : SPK_CROSS)
  .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('') + '</svg>';

function loadImage(url){ return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('opener: cannot load ' + url)); i.src = url; }); }
function loadScript(url, global){ return new Promise((res, rej) => { if(window[global]) return res(window[global]);
  const s = document.createElement('script'); s.src = url; s.onload = () => window[global] ? res(window[global]) : rej(new Error('opener: ' + url + ' set no ' + global));
  s.onerror = () => rej(new Error('opener: cannot load ' + url)); document.head.appendChild(s); }); }

function mount(host, opts){
  opts = opts || {};
  const base = new URL(opts.base == null ? './' : opts.base, document.baseURI).href, baseDir = base.endsWith('/') ? base : base + '/';
  const stats = { frames: 0, filesLoadedAt: null, firstFrameAt: null, t: null, clock: 'page', soundT0: null };
  let soundDone; const soundReady = new Promise(r => { soundDone = r; });
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ----- the DOM: a box in the flow, the stage inside it, the replay button under it -----
  const root = el('div', 'rpso', host);
  const st0 = el('style', '', root); st0.textContent = css(baseDir);
  const box = el('div', 'box', root); box.setAttribute('role', 'img');
  box.setAttribute('aria-label', 'The RPS+ opener: Mars, the crowd, ROCK PAPER SCISSORS plus, Alpha coming January 2027, the address www.rps.plus and the line You already know the rules.');
  const replayBtn = el('button', 'replay', root); replayBtn.type = 'button'; replayBtn.textContent = '↻ Replay'; replayBtn.style.visibility = 'hidden';
  // the speaker, hidden until the sound has loaded; both looks drawn once, here, and swapped by a class and a visibility
  const spk = el('button', 'spk off', root); spk.type = 'button'; spk.hidden = true;
  spk.innerHTML = spkSvg(false) + spkSvg(true) + '<span class="word">TAP FOR SOUND</span>';
  const [spkOff, spkOn] = spk.querySelectorAll('svg');
  let spkState = null;
  function paintSpk(on){ if(spkState === on) return; spkState = on;
    spk.className = 'spk ' + (on ? 'on' : 'off'); spkOff.style.display = on ? 'none' : ''; spkOn.style.display = on ? '' : 'none';
    spk.setAttribute('aria-label', on ? 'Sound off' : 'Play with sound'); spk.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  paintSpk(false);
  function fit(){ box.style.setProperty('--s', (box.clientWidth / 393).toFixed(4)); }
  fit();
  if(window.ResizeObserver) new ResizeObserver(fit).observe(box); else window.addEventListener('resize', fit);

  let api = null;
  const ready = (async () => {
    const man = await fetch(baseDir + 'manifest.json').then(r => { if(!r.ok) throw new Error('opener: manifest ' + r.status); return r.json(); });
    const T16 = man.timeline, E16 = { rules: man.timeline.rules, url: man.timeline.url, alpha: man.timeline.alpha }, PAL = man.palette;
    const { disc, pit } = man, W = man.world, PAN = W.pan, H16 = man.world.horizon, MARS_X = disc.x, NU = disc.surface.w;
    const MK = pit.mk, MX = pit.mx, MY = pit.my, SMOKE_UP = pit.smokeUp, CHIMNEY = pit.chimney;

    const PR = man.parade, floatImgs = {};   // the parade's floats (docs/plans/2026-11-09-opener-parade-plan.md)
    await Promise.all(PR.order.map(async k => { floatImgs[k] = await loadImage(baseDir + PR.floats[k].file); }));
    const groundImg = PR.ground ? await loadImage(baseDir + PR.ground.file) : null;
    const [skyImg, skylineImg, surfImg, lib, paradeCrowd] = await Promise.all([
      loadImage(baseDir + man.sky.file), loadImage(baseDir + man.skyline.file), loadImage(baseDir + disc.surface.file),
      loadScript(baseDir + man.crowd.lib, 'RPSOpenerLib'), loadScript(baseDir + man.crowd.file, 'paradeCrowd') ]);
    const sprites = {};
    await Promise.all(Object.entries(pit.sprites).map(async ([k, s]) => { sprites[k] = { src: baseDir + s.file, w: s.w, h: s.h, img: await loadImage(baseDir + s.file) }; }));
    await Promise.all([document.fonts.load('84px "RPSO Jersey"'), document.fonts.load('12px "RPSO Silkscreen"'), document.fonts.load('22px "RPSO Pixelify"')]);
    stats.filesLoadedAt = performance.now();

    const { hexRgb, pack, mulberry, hash3 } = lib;   // the game's small helpers (parade-lib.js)

    // ----- the surface table (mars-surface.png) as colour indices, and the light as a lookup (disc.shade) -----
    const sc = el('canvas'); sc.width = surfImg.width; sc.height = surfImg.height; const sg = sc.getContext('2d', { willReadFrequently: true }); sg.drawImage(surfImg, 0, 0);
    const sd = sg.getImageData(0, 0, sc.width, sc.height).data, colIdx = new Map(disc.surface.colours.map((h, i) => [h, i])), tab = new Uint8Array(sc.width * sc.height);
    const hx = (r, g, b) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    for(let i = 0; i < tab.length; i++){ const c = colIdx.get(hx(sd[i * 4], sd[i * 4 + 1], sd[i * 4 + 2])); if(c === undefined) throw new Error('opener: surface pixel ' + i + ' is not a surface colour'); tab[i] = c; }
    const lut = new Uint32Array(disc.surface.colours.length * 6);
    disc.surface.colours.forEach((h, c) => disc.shade[h].forEach((s, k) => { const [r, g, b] = hexRgb(s); lut[c * 6 + k] = pack(r, g, b); }));
    // the disc's pixels (makeBake's disk): buffer index, table row, longitude column, light step
    const R = disc.R, DS = disc.S, half = disc.half, DISK = [], [LX, LY, LZ] = disc.light;
    for(let dy = -R; dy <= R; dy++) for(let dx = -R; dx <= R; dx++){
      if(dx * dx + dy * dy > R * R) continue;
      const nx = dx / R, ny = dy / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const lam = Math.max(0, nx * LX + ny * LY + nz * LZ) * .9 + .08, u0 = Math.atan2(nx, nz), u = u0 < 0 ? u0 + Math.PI * 2 : u0;
      DISK.push([(half + dy) * DS + half + dx, (dy + R) * NU, Math.floor(u / (Math.PI * 2) * NU), Math.round(lam * disc.qSteps)]);
    }
    const SPIN = { cv: el('canvas'), last: null };
    SPIN.cv.width = SPIN.cv.height = DS; SPIN.g = SPIN.cv.getContext('2d'); SPIN.id = SPIN.g.createImageData(DS, DS); SPIN.buf = new Uint32Array(SPIN.id.data.buffer);
    function spinCanvas(t){
      const a = Math.round(((t / disc.turnS) % 1) * NU); if(SPIN.last === a) return SPIN.cv; SPIN.last = a;
      const buf = SPIN.buf; buf.fill(0);
      for(let n = 0; n < DISK.length; n++){ const d = DISK[n]; buf[d[0]] = lut[tab[d[1] + (d[2] + a) % NU] * 6 + d[3]]; }
      SPIN.g.putImageData(SPIN.id, 0, 0); return SPIN.cv;
    }

    // ----- the crowd: the colours 29c-parade-title.js gives it -----
    const CROWD = { buf: new Uint32Array(WW * WH) };
    CROWD.cv = el('canvas'); CROWD.cv.width = WW; CROWD.cv.height = WH; CROWD.g = CROWD.cv.getContext('2d'); CROWD.id = CROWD.g.createImageData(WW, WH);
    { const U = n => { const c = hexRgb(PAL[n]); return pack(c[0], c[1], c[2]); };
      const ci = man.crowd.init, col = {}; for(const k of Object.keys(ci.colours)) col[k] = U(ci.colours[k]);
      paradeCrowd.init({ W: ci.W, HH: ci.HH, OX: ci.OX, OY: ci.OY, mulberry, colours: col }); }

    // ===== shot 1 (round 16) =====
    const camAt = t => Math.round(PAN * ease(clamp((t - T16.pan0) / (T16.pan1 - T16.pan0), 0, 1)));
    const TWINKLE = Array.from({ length: 40 }, (_, i) => ({ x: Math.floor(hash3(i, 2, 7, 5) * WW), y: Math.floor(hash3(i, 4, 1, 5) * man.world.skyH),
      per: 2 + hash3(i, 6, 3, 5) * 2.5, ph: hash3(i, 8, 9, 5) }));
    function twinkle(g, t, cam){
      for(const s of TWINKLE){ const y = s.y - cam; if(y < -2 || y > WH + 2) continue; const p = ((t / s.per + s.ph) % 1), b = Math.sin(p * Math.PI * 2);
        if(b < -0.2) continue; g.fillStyle = b > .85 ? PAL.phosphor : b > .5 ? PAL.cream : b > .15 ? PAL.grey : PAL.iron; g.fillRect(s.x, y, 1, 1);
        if(b > .92){ g.fillStyle = PAL.grey; g.fillRect(s.x - 1, y, 1, 1); g.fillRect(s.x + 1, y, 1, 1); g.fillRect(s.x, y - 1, 1, 1); g.fillRect(s.x, y + 1, 1, 1); } }
    }
    function shot1(g, t){   // scene 1, drawn as one picture; the caller fades it as one
      const cam = camAt(t), hy = H16 - cam;
      g.fillStyle = PAL.ink; g.fillRect(0, 0, WW, WH);
      g.globalAlpha = fade(t, T16.stars, T16.starsIn); g.drawImage(skyImg, 0, -cam);
      twinkle(g, t, cam); g.globalAlpha = 1;
      // Mars centred on the horizon, as the sun is on the pit's floor; only the half above it shows
      g.save(); g.beginPath(); g.rect(0, 0, WW, Math.max(0, hy)); g.clip();
      g.drawImage(spinCanvas(t), MARS_X - half, hy - half); g.restore();
      if(hy < WH + 40){
        g.drawImage(skylineImg, 0, hy - man.skyline.horizonRow);
        // the parade's crowd, cheering in real time, its rows spread (k) so it reaches the bottom of the frame from the mid-screen horizon
        if(groundImg) g.drawImage(groundImg, 0, hy + PR.ground.below);   // the title's road under the crowd (look 'title')
        paradeCrowd.draw(CROWD.buf, t, { yh: hy, k: man.crowd.draw.k, ox: 0, fast: true });   // its rows spread by k (manifest crowd.draw.k: the look's)
        new Uint32Array(CROWD.id.data.buffer).set(CROWD.buf); CROWD.g.putImageData(CROWD.id, 0, 0); g.drawImage(CROWD.cv, 0, 0);
        if(PR.look !== 'none') parade(g, t, hy);   // the floats roll in front of the crowd
      }
    }

    // ----- the parade (docs/plans/2026-11-09-opener-parade-plan.md): the game's twelve floats in their loop, from a start picked
    // at random each play (the game's title starts its parade at a random float every visit: buildRoute), or opts.paradeStart.
    // Float i's left edge is head + speed * t - cum_i; each steps at 8 a second, its frame picked by its step and column (x & 7)
    // from the baked sheets, its wheels roadBelow rows under the horizon, on a brass-light road. -----
    let route = [];
    function newRoute(){
      const n = PR.order.length, s0 = opts.paradeStart != null ? ((opts.paradeStart | 0) % n + n) % n : Math.floor(Math.random() * n);
      route = []; let cum = 0;
      for(let i = 0; i < 2 * n; i++){ const k = PR.order[(s0 + i) % n]; route.push({ k, f: PR.floats[k], img: floatImgs[k], cum }); cum += PR.floats[k].chassis + PR.gap; }
      stats.paradeStart = s0;
    }
    newRoute();
    function parade(g, t, hy){
      const st = Math.floor(t * PR.stepsPerS); if(st < PR.steps.first || st > PR.steps.last) return;
      const road = hy + PR.roadBelow; if(road - 120 >= WH) return;
      if(road < WH && !PR.ground){ g.fillStyle = PAL[PR.road]; g.fillRect(0, road, WW, WH - road); }   // the road, under the wheels (below rps.plus's crop)
      const head = PR.head + PR.speed * t;
      for(const r of route){ const x = Math.round(head - r.cum), f = r.f; if(x + f.dx >= WW) continue; if(x + f.dx + f.w <= 0) break;
        const i = f.index[(st - PR.steps.first) * f.phases + ((x & 7) % f.phases)];
        g.drawImage(r.img, 0, i * f.h, f.w, f.h, x + f.dx, road + f.dy, f.w, f.h); }
    }

    // ===== the stage (round 16's makeStage) =====
    function setSprite(i, key, s){ const sp = sprites[key]; if(!sp) return; if(i.dataset.k !== key){ i.dataset.k = key; i.src = sp.src; } const w = sp.w * s + 'px', h = sp.h * s + 'px'; if(i.style.width !== w){ i.style.width = w; i.style.height = h; } }
    function makeStage(host){
      const st = el('div', 'stage', host); st.setAttribute('aria-hidden', 'true'); const S = { st };
      S.space = el('canvas', 'space', st); S.space.width = WW; S.space.height = WH; S.sg = S.space.getContext('2d');
      S.line = el('div', 'big line10', st); S.line.innerHTML = 'THE GREATEST<br>GAME IN<br>THE GALAXY';
      S.pit = el('div', 'pit', st);
      S.sun = el('div', 'sun', S.pit); S.floor = el('div', 'floor', S.pit);
      S.refl = el('div', 'refl', S.pit); S.rimg = img(S.refl, 'body'); S.rlit = img(S.refl, 'lit');
      S.mars = el('div', 'mars', S.pit); S.mimg = img(S.mars, 'body'); S.mlit = img(S.mars, 'lit');
      S.steam = el('canvas', 'smoke', S.pit); S.steam.width = 80; S.steam.height = 53 + SMOKE_UP;
      S.scan = el('div', 'scan', st); S.vig = el('div', 'vig', st);
      S.w4 = el('div', 'w4 w6', st);   // one line: the three words, and "plus" from the flash
      S.w = [['ROCK', 'rock'], ['PAPER', 'paper'], ['SCISSORS', 'scis']].map(([x, c]) => { const d = el('div', c, S.w4); d.textContent = x; return d; });
      S.plus = el('div', 'plus lc', S.w4); S.plus.textContent = 'plus';   // lowercase and slanted, under SCISSORS: improved RPS, like C+
      S.rules = el('div', 'rules', st); S.rules.textContent = 'You already know the rules.';
      S.url = el('div', 'url', st); S.url.textContent = 'www.rps.plus';
      S.alpha = el('div', 'alpha', st); S.alpha.textContent = 'Alpha coming January 2027';
      S.say = el('div', 'say', st); S.say.innerHTML = '<span></span><i></i>';   // Mars's line, the speech bubble
      S.flash = el('div', 'flash', st);
      S.all = [S.space, S.line, S.pit, S.sun, S.floor, S.refl, S.mars, S.steam, S.scan, S.vig, S.w4, S.plus, S.rules, S.url, S.alpha, S.flash, S.say];
      const Wd = 80 * MK, Hd = 53 * MK, fy = MY + Hd;
      Object.assign(S.mars.style, { left: MX + 'px', top: MY + 'px', width: Wd + 'px', height: Hd + 'px' });
      Object.assign(S.refl.style, { left: MX + 'px', top: (fy + 1) + 'px', width: Wd + 'px', height: Hd + 'px' });
      Object.assign(S.sun.style, { left: '-6px', width: '405px', height: '210px', top: (fy - 210) + 'px', borderRadius: '202px 202px 0 0 / 210px 210px 0 0' });
      S.floor.style.top = fy + 'px';
      Object.assign(S.steam.style, { left: MX + 'px', top: (MY - SMOKE_UP * MK) + 'px', width: Wd + 'px', height: ((53 + SMOKE_UP) * MK) + 'px' });
      return S;
    }
    function reset(S){ for(const e of S.all) e.hidden = true; S.flash.style.opacity = '1'; S.flash.style.background = '#fff';
      for(const e of [S.mars, S.refl]) e.style.transform = ''; for(const e of [S.space, S.line, S.pit, S.rules, S.url, S.alpha]) e.style.opacity = ''; }

    // His chimney smoke (round 15, kept in 16): puffs leave the chimney, lazy at first, then more often, bigger, faster and
    // wobbling harder until it is a scrambled stream just before the flash. Drawn at robot pixels (MK screen pixels each).
    function puffBirths(t0, t1){ const out = []; let tb = t0; while(tb < t1){ out.push(tb); const u = (tb - t0) / (t1 - t0); tb += 0.5 - 0.38 * u; } return out; }
    let BIRTHS = null;
    const PUFF_TONES = [['charcoal', 'ink', 'iron'], ['slate', 'charcoal', 'iron'], ['iron', 'slate', 'grey']];
    function blob(g, cx, cy, r, age){
      const Rr = Math.max(1, Math.round(r)), [fill, edge, glint] = PUFF_TONES[age < .3 ? 0 : age < .62 ? 1 : 2];
      for(let dy = -Rr; dy <= Rr; dy++) for(let dx = -Rr; dx <= Rr; dx++){ const d = Math.hypot(dx, dy); if(d > Rr + .35) continue;
        g.fillStyle = d > Rr - .65 ? PAL[edge] : PAL[fill]; g.fillRect(cx + dx, cy + dy, 1, 1); }
      if(Rr >= 2){ g.fillStyle = PAL[glint]; g.fillRect(cx - (Rr >> 1), cy - (Rr >> 1), 1, 1); }
    }
    function smoke(c, t, t0, t1, f){
      const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
      BIRTHS = BIRTHS || puffBirths(t0, t1);
      BIRTHS.forEach((tb, k) => { const a = t - tb; if(a < 0) return; const ub = (tb - t0) / (t1 - t0), L = 1.8 - 0.8 * ub; if(a > L) return;
        const h1 = hash3(k, 1, 3, 7), h2 = hash3(k, 2, 5, 7), h3 = hash3(k, 4, 1, 7), h4 = hash3(k, 6, 2, 7);
        const vx = -(4 + 7 * h1) * (1 + ub), vy = (10 + 7 * h2) * (1 + .9 * ub);
        const wob = Math.sin(a * (3 + 5 * ub) + h3 * 6.28) * (0.4 + 4.5 * ub * ub) + jit(f, k) * 2.2 * ub * ub;   // the scramble
        const grow = a / L, r = (1.2 + 2.6 * grow * (0.7 + 0.6 * h4)) * (grow > .82 ? (1 - grow) / .18 : 1);
        if(r < .6) return;
        blob(g, Math.round(CHIMNEY[0] + vx * a + wob), Math.round(CHIMNEY[1] + SMOKE_UP - vy * a + jit(f + 7, k) * 1.2 * ub), r, grow); });
    }
    // Mars about to blow (round 7), the ramp from t0 to the flash
    function marsShot(S, t, t0){
      const t1 = T16.dark, u = clamp((t - t0) / (t1 - t0), 0, 1), f = Math.floor(t * 30);
      for(const e of [S.pit, S.sun, S.floor, S.mars, S.refl, S.steam, S.scan, S.vig]) e.hidden = false;
      const per = 0.3 - 0.24 * u, idx = Math.floor(Math.max(0, t - t0) / per) % 4, body = (t >= T16.words[2] ? 'mars-scared' : 'mars-nervous') + (idx ? '-' + (idx + 1) : '');   // his own horror face and pupil from SCISSORS (step 3)
      setSprite(S.mimg, body, MK); setSprite(S.rimg, body, MK);
      let lit = null, last = -1; T16.words.forEach((w, i) => { if(t >= w){ lit = THROWS[i]; last = i; } });
      if(t >= t1 - 0.5) lit = THROWS[Math.floor(f / 2) % 3];
      S.mlit.hidden = S.rlit.hidden = !lit; if(lit){ setSprite(S.mlit, 'mars-lit-' + lit, MK); setSprite(S.rlit, 'mars-lit-' + lit, MK); }
      const jf = last >= 0 ? Math.floor((t - T16.words[last]) * 30) : 99, kick = jf === 0 ? -12 : jf === 1 ? 5 : 0;
      const amp = 1 + 14 * u * u, jx = jit(f, 1) * amp, jy = jit(f, 2) * amp * 0.6 + kick;
      S.mars.style.transform = 'translate(' + jx.toFixed(1) + 'px,' + jy.toFixed(1) + 'px)'; S.refl.style.transform = 'translate(' + jx.toFixed(1) + 'px,' + (-jy).toFixed(1) + 'px)';
      smoke(S.steam, t, t0, t1, f);
      S.scan.style.opacity = String(0.3 + 0.55 * u); S.vig.style.opacity = String(0.25 + 0.75 * u);
    }
    function wordsIn(S, t){   // ROCK, PAPER, SCISSORS one a second under Mars; after the flash they hold alone on black
      S.w4.hidden = false; const T = T16.words;
      S.w.forEach((w, i) => { const f = Math.floor((t - T[i]) * 30); if(f < 0){ w.style.visibility = 'hidden'; return; } w.style.visibility = '';
        w.style.opacity = ''; w.style.transform = f === 0 ? 'scale(1.35)' : f === 1 ? 'scale(.96)' : '';
        if(f === 0 && i < 3){ S.flash.hidden = false; S.flash.style.background = THROW_HEX[THROWS[i]]; S.flash.style.opacity = '.12'; } });
    }
    function sayAt(S, t){   // "Please no" (owner, 2026-11-09) from a second before the flash to the flash; the game's sayIn (0.34 s, five steps to 60 %, five more) drawn from the clock
      const at = T16.dark - 1; if(t < at || t >= T16.dark) return;
      S.say.hidden = false; if(S.say.firstChild.textContent !== 'Please no') S.say.firstChild.textContent = 'Please no';
      const a = t - at, d = .34; let op = 1, sc = 1;
      if(a < .6 * d){ const q = Math.floor(a / (.6 * d) * 5) / 5; op = q; sc = .3 + .82 * q; }
      else if(a < d){ const q = Math.floor((a - .6 * d) / (.4 * d) * 5) / 5; sc = 1.12 - .12 * q; }
      S.say.style.opacity = String(op); S.say.style.transform = 'translateX(-50%) scale(' + sc.toFixed(3) + ')';
    }
    function round16(t, S){
      reset(S); S.sg.imageSmoothingEnabled = false;
      const d = fade(t, T16.pit, T16.pitIn);   // the dissolve: scene 1 out as one, the pit in, the planet becoming the sun
      if(t < T16.pit + T16.pitIn){ S.space.hidden = false; shot1(S.sg, t); S.space.style.opacity = String(1 - d);
        if(t >= T16.line && t < T16.lineOut + T16.lineOutIn){ S.line.hidden = false; S.line.style.opacity = String(Math.min(fade(t, T16.line, T16.lineIn), 1 - fade(t, T16.lineOut, T16.lineOutIn))); } }
      if(t >= T16.pit && t < T16.dark){ marsShot(S, t, T16.pit);   // the pit comes up as one, its scanlines and shadow with it
        S.pit.style.opacity = String(d); S.scan.style.opacity = String(+S.scan.style.opacity * d); S.vig.style.opacity = String(+S.vig.style.opacity * d); wordsIn(S, t); sayAt(S, t); return; }
      if(t < T16.dark) return;
      if(Math.floor((t - T16.dark) * 30) < 2){ S.flash.hidden = false; S.flash.style.background = '#fff'; S.flash.style.opacity = '1'; }   // the flash
      wordsIn(S, t);   // black: the three words alone, then the end card
      S.plus.hidden = false; S.plus.style.visibility = t >= T16.plus ? '' : 'hidden'; if(t >= T16.plus) S.plus.style.opacity = String(fade(t, T16.plus, T16.plusIn));   // from the flash the line keeps room for "plus"
      const E = E16, F = T16.endFades;
      if(t >= E.rules){ S.rules.hidden = false; S.rules.style.opacity = fade(t, E.rules, F.rules); }
      if(t >= E.url){ S.url.hidden = false; S.url.style.opacity = fade(t, E.url, F.url); }
      if(t >= E.alpha){ S.alpha.hidden = false; S.alpha.style.opacity = fade(t, E.alpha, F.alpha); }
    }

    // ===== the player: autoplay once, hold the end card, replay =====
    // Two clocks. The page's: t = (now - start) / 1000. The audio's, while the sound is on: t = the audio time being heard
    // (SND.heard, the context's output timestamp) less T0, the audio time of the film's 0:00, so a word is drawn on the frame
    // its hit is heard. The 30 fps gate is the same for both.
    const S = makeStage(box), END = T16.end - 0.001, gate = { last: null };
    let playing = false, start = 0, raf = 0, SND = null, T0 = null;
    const audioT = now => SND.heard(now) - T0;
    function draw(t){ round16(t, S); stats.frames++; stats.t = t; }
    function stop(){ playing = false; cancelAnimationFrame(raf); }
    function loop(now){
      if(!playing) return;
      if(frameDue(gate, now)){ let t = Math.max(0, T0 != null ? audioT(now) : (now - start) / 1000);
        if(T0 != null && t < stats.t) t = stats.t;   // on the audio clock, never a step back
        if(t >= T16.end){ draw(END); playing = false; replayBtn.style.visibility = reduced ? 'hidden' : 'visible'; return; }
        draw(t); }
      raf = requestAnimationFrame(loop);
    }
    function run(){ newRoute(); stop(); replayBtn.style.visibility = 'hidden'; playing = true; gate.last = null; raf = requestAnimationFrame(loop); }
    function soundOff(){ if(T0 == null) return; const t = audioT(performance.now()); SND.stop(); T0 = null; stats.clock = 'page'; stats.soundT0 = null; paintSpk(false); return t; }
    function sound(on){
      if(!on){ const was = playing, t = soundOff();   // the film runs on, silent, from where it is
        if(was && t != null) start = performance.now() - Math.max(0, t, stats.t || 0) * 1000;
        return false; }
      if(reduced || !SND || !SND.wake()) return false;   // wake(): inside the caller's tap, before anything waits
      const T = SND.play(T16, opts.mix); if(T == null) return false;
      T0 = T; stats.clock = 'audio'; stats.soundT0 = T; stats.t = 0; paintSpk(true); run();   // the film from 0:00, on the audio clock
      return true;
    }
    function replay(){ if(reduced) return; if(T0 != null && sound(true)) return; soundOff(); start = performance.now(); run(); }
    function seek(t){ soundOff(); stop(); draw(clamp(t, 0, END)); return Promise.all([...S.st.querySelectorAll('img')].filter(i => i.src).map(i => i.decode().catch(() => {}))).then(() => undefined); }
    replayBtn.addEventListener('click', replay);
    spk.addEventListener('click', () => { sound(T0 == null); });   // silent: on, from 0:00; with sound: off, the film runs on

    if(reduced) draw(END); else draw(0);   // reduced motion: the end card, still
    stats.firstFrameAt = performance.now();
    if(!reduced && opts.autoplay !== false) replay();
    api = { replay, seek, sound, duration: T16.end }; out.duration = T16.end;
    // the sound's code, fetched once the first frame is up (two frames on, so it is painted first); none under reduced motion
    if(reduced) soundDone(false);
    else requestAnimationFrame(() => requestAnimationFrame(() => loadScript(baseDir + 'sound.js', 'RPSOpenerSound')
      .then(s => { SND = s; spk.hidden = false; soundDone(true); }, e => { try { console.error(e); } catch(_){} soundDone(false); })));
  })();
  const out = { ready, soundReady, stats, replay: () => api && api.replay(), seek: t => ready.then(() => api.seek(t)),
    sound: on => !!(api && api.sound(on)), duration: null };   // the film's length, from the manifest, once it is read
  ready.catch(e => { try { console.error(e); } catch(_){} soundDone(false); });
  return out;
}

window.RPSOpener = { mount };
})();
