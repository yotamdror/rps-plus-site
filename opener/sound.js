/* The opener film's sound (docs/plans/2026-11-07-opener-trailer-plan.md, step 5; written by scripts/marketing/build-opener.mjs).
   The game's own sound code, copied whole from src/ (the knobs, the engine AU, the Fair FAIR), and the film's score after it
   (scripts/marketing/opener-score.js, round 11's), in one closure. The player loads this after the film's first frame.
   window.RPSOpenerSound = { wake(), play(timeline, mix) -> T, stop(), heard(perfNow) -> audio time, AU, FAIR, LEAD, MIX } */
window.RPSOpenerSound = (function(){
/* stubs for the two game globals the engine's fight loop reads (src/js/02-state.js G, src/js/27-pause.js paused) */
var G = { heat:0 }; var paused = false;
/* --- src/js/core/01-knobs.js (copied whole by build-opener.mjs) --- */
/* ================= FEEL KNOBS ================= */
const K = {
  bpm:112,
  musicSteps:8,     // one authored arrangement per match. The first throw of a match is the only place the arrangement advances.
  ledgerSecs:0,     // between-throw ledger: 0 = wait for a tap, >0 = auto-advance after n s
  countSecs:3.5,    // full ROCK -> SHOOT window (the hold)
  colorSecs:2.4,    // chest COLOR tell shows this many s before SHOOT
  fastColorSecs:1.65, // Late/Fast dialect: its one light flash starts this many s before SHOOT
  fastFlashSecs:0.32, // Late/Fast dialect: how long that light stays visible
  handSecs:1.2,     // HAND shape shows this many s before SHOOT
  mercurySecs:2.35, // Quickdraw: one consistent, visibly twitch-signposted clock; the honest tells keep normal relative timing
  measureStep:.20,  // Long Measure: ordinary colors pass quickly
  measureDwell:.52, // ...while Saturn's true color is held long enough to read as the exception
  clashSecs:0.78,   // SHOOT to the hit (throw-clash, owner 2026-11-05: 0.45 s plus the slow motion at the clash; clashWarp())
  stampLeadSecs:0.90,// new fight look: the hit to the verdict stamp
  deathBeats:1,     // new fight look: extra musical beats for the fall on the match-winning throw (step 6)
  hitStopFrames:2,  // robot-motion: the hit-stop, whole 30 fps frames everything on the stage holds at the hit (2 = 67 ms)
  hitStopKillFrames:3, // ...and on the match-winning hit (3 = 100 ms); 0 = no stop
  smashHoldFrames:1, // fight-feel (owner, 2026-11-05): whole 30 fps frames both throws hold still at the meet, inside the flight; 0 = none
  clashSlowFrames:5, // throw-clash (owner, 2026-11-05: "slow motion the crash"): frames of the clash, from the meet, played slow; 0 = none
  clashSlowRate:3,   // ...at a third of the speed: 5 frames take 15, so the hit lands 333 ms later (inside clashSecs)
  // ---- CASINO / PAYOUT (placeholder economy — nothing committed, all tunable on-device) ----
  mintK:1_000_000,     // $1B per 1,000 points; match payouts floor to whole billions
  mintSCap:0,          // coin mints from banked × min(S, mintSCap) when > 0; 0 = off (owner, 2026-10-18: no coin cap). Bench knob kept for comparison
  priceK:2_000_000,    // independent posted-price basis; mint tuning never reprices the shop
  coinPopAt:1_000_000_000, // coin minted THIS match must clear this for the jackpot pop (1B line)
  calcSecs:0.6,        // "calculating…" flicker length before the receipt begins (match clear only)
  chainStep:1500,      // ms per style: label+definition, then the point contribution
  popShake:14,         // shake amplitude on a jackpot pop
  // ---- MUSIC STRUCTURE (Task Card 12 step 1: one track, two rooms — every value is an ear-test knob) ----
  quantize:'pulse',    // where a throw's ROCK lands: 'pulse' = next kick (2 beats), 'beat' = next beat (old behaviour), 'off' = immediately
  freezeOnGrid:true,   // the result freeze holds >= resultHold, then releases on the next kick so rest lands on the pulse
  paBetween:true,      // Day screens (recap, hub, shop, board, ceremony) hear the track through the Fair's PA: drums out, low-passed, quieter
  paCutoff:900,        // PA low-pass, Hz
  paGain:0.55,         // PA level relative to the pit
  hubMusic:'parade',   // between fights: 'parade' = the parade's band (FAIR; default since fall-drop build 5/8), 'pa' = the fight track on the PA (bench comparison)
  fallMusic:'build',   // Mars's fall (fall-drop plan D1/D7): 'build' = the new climb, mix, landing and roll; 'today' = today's sound (bench comparison)
  heatBreath:true,     // the vignette tightens on every kick, scaled by HEAT (non-color escalation)
  uiSounds:true,       // ui-sounds: the small sounds of buttons and the Fair's machines (src/js/01c-ui-sound.js)
  uiButtons:'both',    // button sound style: 'both' | 'switch' | 'note' | 'off'
  uiLevel:1,           // the UI bus level
  cutOnClear:false     // fight-ux-aesthetics step 6, experimental: the track stops dead as the beaten robot falls, silent until the receipt
};
const CFG = { basePts:10, lead:0.08, resultHold:2.6 };
/* ============================================== */
const THROWS = ['rock','paper','scis'];
const BEATS  = {rock:'paper', paper:'scis', scis:'rock'};   // what defeats each throw
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// The FIGHT timing knobs' bench metadata (29-test-bench.js renders them); fightKnob() clamps to their min/max.
const KNOBS_TIMING=[
  {k:'countSecs',label:'Count length',min:1.5,max:6,step:0.1,fmt:v=>v.toFixed(1)+' s (ROCK→SHOOT)'},
  {k:'colorSecs',label:'Color tell',min:0,max:6,step:0.1,fmt:v=>v.toFixed(1)+' s before SHOOT'},
  {k:'fastColorSecs',label:'Late / fast tell',min:.4,max:3,step:.05,fmt:v=>v.toFixed(2)+' s before SHOOT'},
  {k:'fastFlashSecs',label:'Late / fast flash',min:.1,max:1,step:.01,fmt:v=>v.toFixed(2)+' s visible'},
  {k:'handSecs',label:'Hand tell',min:0,max:5,step:0.1,fmt:v=>v.toFixed(1)+' s before SHOOT'},
  {k:'clashSecs',label:'New look: SHOOT to the hit',min:0.2,max:1.5,step:0.01,fmt:v=>v.toFixed(2)+' s'},
  {k:'stampLeadSecs',label:'New look: pause before result',min:0.2,max:2.5,step:0.05,fmt:v=>v.toFixed(2)+' s'},
  {k:'deathBeats',label:'New look: winning-throw fall',min:0,max:4,step:1,fmt:v=>v+' beat'+(v===1?'':'s')},
  {k:'hitStopFrames',label:'Hit-stop',min:0,max:6,step:1,fmt:v=>v?v+' frame'+(v===1?'':'s')+' ('+Math.round(v*1000/30)+' ms)':'off'},
  {k:'hitStopKillFrames',label:'Hit-stop: match-winning hit',min:0,max:6,step:1,fmt:v=>v?v+' frame'+(v===1?'':'s')+' ('+Math.round(v*1000/30)+' ms)':'off'},
  {k:'smashHoldFrames',label:'Smash hold',min:0,max:4,step:1,fmt:v=>v?v+' frame'+(v===1?'':'s')+' ('+Math.round(v*1000/30)+' ms)':'off'},
  {k:'clashSlowFrames',label:'Slow motion at the clash',min:0,max:8,step:1,fmt:v=>v?v+' frame'+(v===1?'':'s')+' at 1/'+K.clashSlowRate:'off'},
  {k:'clashSlowRate',label:'Slow motion: slowed by',min:1,max:5,step:0.5,fmt:v=>v+'x'}
];

/* Slow motion at the clash (throw-clash, owner 2026-11-05: "maybe it's too fast ... slow it down so you can really see the
   clash before the hit"). The clash runs on its own clock, `flight` ms from SHOOT to the hit; from the meet (meetFrac of the
   flight) `slowFrames` 30 fps frames of it play `rate` times slower, so the time they add, plus the flight, is exactly
   `secs`: the hit still lands K.clashSecs after SHOOT. The slowing is at most half of secs and never runs past the flight's
   end. W(t) maps a clash ms onto a real ms from SHOOT; f is the slowing inside [a, b). Tested in
   scripts/rules/clash-warp.test.mjs. */
const CLASH_FRAME_MS = 1000/30;
function clashWarp(secs, meetFrac, slowFrames, rate){
  const ms = secs*1000, extra = Math.min(ms/2, Math.max(0, slowFrames*CLASH_FRAME_MS*(rate-1)));
  const flight = ms-extra, a = flight*clamp(meetFrac, 0, 1), L = Math.min(slowFrames*CLASH_FRAME_MS, flight-a);
  const f = L > 0 && extra > 0 ? 1+extra/L : 1, b = f > 1 ? a+L : a;
  const W = t => t < a ? t : t < b ? a+(t-a)*f : a+(b-a)*f+(t-b);
  return { ms, flight: f > 1 ? flight : ms, a, b, f, W };
}

/* MATCH POINT lifts the music (fight-polish, owner 2026-11-05: "how do we get the heat higher when it is, either if it's your
   win or their win or both": either side, the same lift). HEAT is one music part per throw you have won this match
   (03-fx.js: every won throw adds one for the rest of the match, up to HEAT_MAX), plus HEAT_MP_LIFT more while either side
   is one throw from the end, and HEAT_MAX outright while both are (the distance). A lost throw never takes a part away:
   03-fx.js keeps the higher of the heat playing and this level. Tested in scripts/rules/heat.test.mjs. */
const HEAT_MAX = 6, HEAT_MP_LIFT = 2;
function heatLevel(youWins, botWins, winT){
  const mpYou = winT > 1 && youWins === winT - 1, mpBot = winT > 1 && botWins === winT - 1;
  if(mpYou && mpBot) return HEAT_MAX;
  return Math.min(HEAT_MAX, youWins + (mpYou || mpBot ? HEAT_MP_LIFT : 0));
}
/* end of src/js/core/01-knobs.js --- */
/* --- src/js/01-audio.js (copied whole by build-opener.mjs) --- */
/* ---------------- AUDIO ---------------- */
/* THE MIX, MATCH BY MATCH.
   This is a four-bar dance arrangement, not the old two-bar demo loop with more parts
   bolted on. Match 1 already has a small musical pocket; match 2 is the full groove.
   From there the score develops through hooks, voicing, syncopation, and fills. That
   front-loaded density + later orchestral motion is the useful lesson from paris.mp3;
   none of the reference's notes, recording, or samples are used here. */
const STAGE_MIX=[
  {kick:.78, bass:.105, hat:.034, clap:.105, arp:.026, chord:.016}, // 1 NEON INTRO — a pocket, not a metronome
  {kick:.96, bass:.142, hat:.068, clap:.205, arp:.050, chord:.035}, // 2 FULL GROOVE — four-on-floor, offbeats, harmony
  {kick:.98, bass:.150, hat:.072, clap:.218, arp:.058, chord:.042}, // 3 HOOK ARRIVES
  {kick:.99, bass:.154, hat:.073, clap:.222, arp:.061, chord:.045}, // 4 COUNTERLINE + turnaround
  {kick:.99, bass:.156, hat:.074, clap:.224, arp:.063, chord:.046}, // 5 OPEN VOICING
  {kick:1.0, bass:.158, hat:.075, clap:.226, arp:.065, chord:.047}, // 6 BASS ANSWER
  {kick:1.0, bass:.160, hat:.076, clap:.228, arp:.067, chord:.048}, // 7 BRIGHT REVOICE
  {kick:1.0, bass:.162, hat:.078, clap:.232, arp:.069, chord:.050}  // 8 FINAL FILL
];
const STAGE_LABELS=['NEON INTRO','FULL GROOVE','HOOK ARRIVES','COUNTERLINE','OPEN VOICING','BASS ANSWER','BRIGHT REVOICE','FINAL FILL'];
// One shared pitch vocabulary for the loop and interface. A natural minor / modal:
// score ticks, win lifts, chant tones, and payout landings should sound like the same band.
const SCORE_SCALE=[220,246.94,261.63,293.66,329.63,349.23,392,440,493.88,523.25,587.33,659.25,698.46,783.99,880,1046.5];
const MUSIC_TRIM=1.35;   // music level against SFX; the compressor sits after master
/* ---- the fall's voices (fall-drop plan, step 2) ----
   The Mars fall's music, played on the engine's own context straight into master (they bypass the PA, as the walk-on's riser
   does; muted is master 0, so nothing plays). Every function takes the engine `e` so the alt engines, which inherit the
   methods below, use their own context. The laws are by x (0 at the start of the climb, 1 at the landing) and the swells
   by the time remaining, so the same climb plays over any length (a hurried replay, reduced motion). Levels are D5's: the
   bed passes the loop only in its last second, and the booms are 0.35 and 0.32. */
const FALLV=(()=>{
  const expTo=(p,v,t)=>p.exponentialRampToValueAtTime(Math.max(v,1e-4),t), linTo=(p,v,t)=>p.linearRampToValueAtTime(v,t);
  const hold=(p,t)=>{ if(p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value,t); } };
  const curve=(n,f)=>{ const a=new Float32Array(n); for(let i=0;i<n;i++) a[i]=Math.max(1e-4,f(i/(n-1))); return a; };
  const N=96;
  // the first time on or after t that sits on a 1/div beat of the loop's grid (div 1 beats, 2 eighths, 4 sixteenths)
  const grid=(e,t,div)=>{ const u=e.spb/div; return e.t0+Math.ceil((t-e.t0)/u-1e-6)*u; };
  // the pit's law: the loop's gain through the PA as the floor nears (c 4: -14 dB at the top, -9.5 dB halfway), 0 to 1 over x
  const pitLaw=(x,c)=>Math.pow(1/(1+c*(1-x)),2), pit01=(x,c)=>(pitLaw(x,c)-pitLaw(0,c))/(1-pitLaw(0,c));
  const V={
    grid, pit01,
    paLaw:{ c:4, gain:x=>pitLaw(x,4), lp:x=>120*Math.pow(20000/120,Math.pow(x,2.5)) },
    // a riser: band-passed noise sweeping up, its swell following x^p to v at t1, out just after
    riser(e,t0,t1,f0,f1,v,p){
      const s=e.ac.createBufferSource(); s.buffer=e.noiseBuf; s.loop=true; s.start(t0); s.stop(t1+.15);
      const f=e.ac.createBiquadFilter(), g=e.ac.createGain();
      f.type='bandpass'; f.Q.value=1.2; f.frequency.setValueAtTime(f0,t0); expTo(f.frequency,f1,t1);
      g.gain.setValueAtTime(.0001,t0); g.gain.setValueCurveAtTime(curve(N,x=>v*Math.pow(x,p)),t0+.001,t1-t0-.002); linTo(g.gain,0,t1+.05);
      s.connect(f); f.connect(g); g.connect(e.master);
    },
    // a sub drone rising an octave (a sine and a quiet triangle above it), its swell following x^p to v at t1, out just after
    drone(e,t0,t1,f0,f1,v,p){
      const g=e.ac.createGain(); g.gain.setValueAtTime(.0001,t0); g.gain.setValueCurveAtTime(curve(N,x=>v*Math.pow(x,p)),t0+.001,t1-t0-.002); linTo(g.gain,0,t1+.03);
      for(const [type,m,k] of [['sine',1,1],['triangle',2,.25]]){
        const o=e.ac.createOscillator(), og=e.ac.createGain(); o.type=type; og.gain.value=k;
        o.frequency.setValueAtTime(f0*m,t0); expTo(o.frequency,f1*m,t1);
        o.connect(og); og.connect(g); o.start(t0); o.stop(t1+.1);
      }
      g.connect(e.master);
    },
    // a kick heard through a floor: the engine's kick shape through a low-pass at lp Hz
    thump(e,t,v,lp){
      const o=e.ac.createOscillator(), f=e.ac.createBiquadFilter(), g=e.ac.createGain();
      o.type='sine'; o.frequency.setValueAtTime(150,t); expTo(o.frequency,45,t+.16);
      f.type='lowpass'; f.frequency.value=lp; f.Q.value=.7;
      g.gain.setValueAtTime(v*.9,t); expTo(g.gain,.001,t+.22);
      o.connect(f); f.connect(g); g.connect(e.master); o.start(t); o.stop(t+.25);
    },
    // the sub boom under a landing or a drop
    boom(e,t,v){
      const o=e.ac.createOscillator(), g=e.ac.createGain(); o.type='sine'; o.frequency.setValueAtTime(64,t); expTo(o.frequency,28,t+.45);
      g.gain.setValueAtTime(v,t); expTo(g.gain,.001,t+.55); o.connect(g); g.connect(e.master); o.start(t); o.stop(t+.6);
    },
    // hats on the sixteenth grid from t0 to t1, level and brightness rising
    tick16(e,t0,t1,v0,v1,f0=7000,f1=9000){
      const u=e.spb/4; for(let t=grid(e,t0,4); t<t1-1e-3; t+=u){ const x=(t-t0)/(t1-t0); e.hat(t,v0+(v1-v0)*x,f0+(f1-f0)*x); }
    },
    // six toms closing in on t1 over span seconds (the mock's .5 s), rising in pitch
    tomRoll(e,t1,span){ [1,.7,.46,.28,.14,0].forEach((d,i)=>e.tom(t1-d*span,110*Math.pow(2,i/6),.1+i*.016)); },
    // the PA set hard at t (the loop's low-pass and gain)
    paSet(e,t,lp,g){ const f=e.paFilter.frequency, gn=e.paGainN.gain; hold(f,t); f.setValueAtTime(lp,t); hold(gn,t); gn.setValueAtTime(g,t); },
    // a soft tick on the eighths while the open loop waits for the pick (a lookahead scheduler; stop() ends it)
    ticker:{ timer:null, next:0,
      start(e,t0,v){ this.stop(); this.next=grid(e,t0,2); const u=e.spb/2;
        this.timer=setInterval(()=>{ if(!e.ok||e.ac.state==='closed'){ this.stop(); return; } const ahead=e.ac.currentTime+.5; while(this.next<ahead){ e.hat(this.next,v,8200); this.next+=u; } },80); },
      stop(){ if(this.timer) clearInterval(this.timer); this.timer=null; } }
  };
  return V;
})();
const DEFAULT_MUSIC_ENGINE = {
  ac:null, master:null, ok:false, muted:false,
  spb:60/K.bpm, t0:0, stepDur:0, nextIdx:0, timer:null,
  on:false, silentUntil:0, intensity:1, beepGains:[],
  pendingI:null, breaking:false, breakQueued:false,
  pa:false, paUntil:0, hubParade:false, needleArmed:false, kicks:[],   // one track, two rooms (K.paBetween) + the once-per-run needle drop
  setTempo(bpm){
    // rebase t0 so the existing grid keeps its phase — otherwise changing stepDur
    // retroactively moves every past step and the scheduler jumps or stalls.
    this.spb=60/bpm; const ns=this.spb/2;
    if(this.ok && this.stepDur>0) this.t0 += this.nextIdx*(this.stepDur-ns);
    this.stepDur=ns;
  },
  /* Debug audition changes are latched to a phrase seam. Normal run changes use
     setIntensityNow() on the first throw, with stageLift() landing on ROCK. */
  setIntensity(v,allowBreak){
    v=Math.max(1,Math.min(K.musicSteps,v));
    if(v===this.intensity && this.pendingI===null) return;
    // compare against the tier actually SOUNDING, not a pending one nobody has heard
    if(allowBreak && (this.intensity-v)>=2) this.breakQueued=true;
    this.pendingI=v;
  },
  setIntensityNow(v){
    this.intensity=Math.max(1,Math.min(K.musicSteps,v));
    this.pendingI=null; this.breaking=false; this.breakQueued=false;
  },
  barTop(t){
    if(this.breaking){ this.breaking=false; }
    else if(this.breakQueued){ this.breaking=true; this.breakQueued=false; return; }
    if(this.pendingI!==null){
      const rose=this.pendingI>this.intensity;
      this.intensity=this.pendingI; this.pendingI=null;
      if(rose && this.on && t>=this.silentUntil) this.crash(t,.06,this.loopBus);
    }
  },
  stageLift(t,stage){
    if(!this.ok) return;
    // The large axis: every opponent opens with a real sectional downbeat. The short
    // syncopated fanfare makes the first throw of every match the biggest single jump.
    const early=stage<=4, bright=stage>=5;
    this.duck(t,early?.72:.62,760);
    this.kick(t,early?1.34:1.18);
    this.crash(t,early?.14:.09);
    this.bassN(t,55,early?.25:.19);
    this.chordPulse(t,110,early?.12:.085,undefined,'minor');
    this.tom(t+.055,164.81,early?.18:.13);
    this.pluck(t+.10,bright?783.99:659.25,early?.11:.085,.18,undefined,3600);
    this.pluck(t+.22,bright?1046.5:880,early?.09:.065,.24,undefined,4300);
    if(stage>=3) this.pluck(t+.34,stage>=7?1318.51:1046.5,.052,.20,undefined,4800);
  },
  init(){
    if(this.ac) return;
    try{
      this.ac=new (window.AudioContext||window.webkitAudioContext)();
      this.session('playback');   // iOS: sound through the ring/silent switch (silent-switch, owner 2026-10-20); setMute() hands the focus back while muted
      const comp=this.ac.createDynamicsCompressor();
      this.master=this.ac.createGain(); this.master.gain.value=.8;
      this.loopBus=this.ac.createGain(); this.loopBus.gain.value=1;   // the running beat lives here so it can be ducked without touching SFX
      // Day/Night: the loop passes through the PA — a low-pass and a level trim that are
      // wide open in the pit and closed between fights. SFX bypass it (they go to master).
      this.paFilter=this.ac.createBiquadFilter(); this.paFilter.type='lowpass'; this.paFilter.frequency.value=20000; this.paFilter.Q.value=.4;
      this.paGainN=this.ac.createGain(); this.paGainN.gain.value=1;
      this.loopBus.connect(this.paFilter); this.paFilter.connect(this.paGainN);
      // Music trim (owner phone check 2026-10-16: music +35% against the effects).
      this.musicTrim=this.ac.createGain(); this.musicTrim.gain.value=MUSIC_TRIM;
      this.paGainN.connect(this.musicTrim); this.musicTrim.connect(this.master);
      this.master.connect(comp); comp.connect(this.ac.destination);
      this.noiseBuf=this.ac.createBuffer(1,this.ac.sampleRate*.5,this.ac.sampleRate);
      const d=this.noiseBuf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
      this.ok=true;
    }catch(e){ this.ok=false; }
  },
  // tab-audio: a context iPhone Safari leaves stopped can stay stuck however often it is resumed. Build a
  // fresh one, carry the engine's state across and move its own times onto the new clock. Returns the
  // shift in seconds the caller adds to its times (clockRebuild(), 27-pause.js), or null when no new
  // context could be made (the old one stays).
  rebuild(){
    if(!this.ok) return null;
    const old=this.ac, was=old.currentTime;
    this.ac=null; this.ok=false; this.init();
    if(!this.ok){ this.ac=old; this.ok=true; return null; }
    try{ const p=old.close(); if(p&&p.catch) p.catch(()=>{}); }catch(e){}
    const d=this.ac.currentTime-was, at=v=>Number.isFinite(v)?v+d:v;
    this.t0+=d; this.silentUntil=at(this.silentUntil); this.paUntil=at(this.paUntil);
    this.kicks=[]; this.beepGains=[]; this._resuming=false;
    this.setMute(this.muted);
    if(this.cutOn) this.loopBus.gain.value=0;
    if(this.pa){ this.paFilter.frequency.value=K.paCutoff; this.paGainN.gain.value=K.hubMusic==='parade'?0:K.paGain; }   // as setPA: in 'parade' the loop is out even with no band (the Qualifier's receipt)
    return d;
  },
  now(){ return this.ok ? this.ac.currentTime : performance.now()/1000; },
  nextBeat(t){ const n=Math.max(0,Math.ceil((t-this.t0)/this.spb)); return this.t0+n*this.spb; },
  // The felt pulse is the kick: every 4 steps = 2 beats. ROCK on a kick means the count rides the drums.
  nextPulse(t){ const p=2*this.spb, n=Math.max(0,Math.ceil((t-this.t0)/p)); return this.t0+n*p; },
  /* ---- one track, two rooms ---- */
  // PA on: the loop drops its drums (playStep) and the bus closes to K.paCutoff / K.paGain over `secs`.
  setPA(on,at,secs){
    if(!K.paBetween && on) return;
    this.pa=!!on; this.paUntil=on?Infinity:0;
    if(!this.ok||!this.paFilter) return;
    const t=Math.max(at||0,this.ac.currentTime), d=Math.max(.02,secs||.6);
    const f=this.paFilter.frequency, g=this.paGainN.gain;
    f.cancelScheduledValues(t); f.setValueAtTime(Math.max(40,f.value),t); f.exponentialRampToValueAtTime(on?K.paCutoff:20000,t+d);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); g.linearRampToValueAtTime(on?(K.hubMusic==='parade'?0:K.paGain):1,t+d);
    if(on) this.hubBand(t); else this.hubEnd(t);
  },
  // K.hubMusic 'parade': the loop goes silent behind the PA and the parade's band plays instead, from the loop's next bar
  // seam, its bar index AU's progression bar so the chords line up. Already playing, it carries on.
  // ipad-mini fix (owner, 2026-11-07): the band keeps its own speed (FAIR.bpm, 96), as on the title and at the kiosk, and the
  // silent loop's grid moves to it, so Event films (18f, on AU.spb and AU.nextBeat) play at the 96 they were written at, in
  // step with the band; the match's tempo comes back with applyTempo() (the first throw's setLevel, or the fall's landing).
  // Not on the Qualifier's receipt (isQualReceipt, 22c): the Naming comes next, not the hub, so the loop just fades.
  hubBand(t){
    if(K.hubMusic!=='parade'||typeof FAIR==='undefined'||FAIR.state==='hub') return;
    if(typeof isQualReceipt==='function'&&isQualReceipt()) return;
    this.setTempo(FAIR.bpm||96);
    let seam=t, n=0;
    if(this.stepDur>0){ const bar=8*this.stepDur; n=8*Math.max(0,Math.ceil((t-this.t0)/bar-1e-6)); seam=this.t0+n*this.stepDur; }
    FAIR.hub(true,seam,60/this.spb,Math.floor(n/8));
    this.hubParade=true;
  },
  hubEnd(t){ if(!this.hubParade) return; this.hubParade=false; if(typeof FAIR!=='undefined') FAIR.hub(false,t); },
  // The Sponsor kiosk (FAIR.sponsor): the PA's loop fades out under the parade's band over `secs`; setPA brings it back.
  paQuiet(at,secs){
    if(!this.ok||!this.paGainN) return;
    const t=Math.max(at||0,this.ac.currentTime), g=this.paGainN.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); g.linearRampToValueAtTime(0,t+Math.max(.02,secs||.6));
  },
  // The walk-on: the PA opens back up over `secs` while the drums stay out, waiting for drop().
  paOpen(at,secs){
    if(!this.pa||!this.ok||!this.paFilter) return;
    const t=Math.max(at||0,this.ac.currentTime), d=Math.max(.02,secs||1.2);
    const f=this.paFilter.frequency, g=this.paGainN.gain;
    f.cancelScheduledValues(t); f.setValueAtTime(Math.max(40,f.value),t); f.exponentialRampToValueAtTime(20000,t+d);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); g.linearRampToValueAtTime(this.hubParade?0:1,t+d);
    if(this.hubParade) FAIR.hubThin(t,d);   // the parade's band thins under the riser; the loop stays out until the drop
  },
  // The drop: drums come back on this exact grid time (the first ROCK of a match). schedule() clears pa once it passes.
  drop(t){ if(!this.pa) return; this.paUntil=t; if(this.ok&&this.paFilter){ this.paOpen(this.ac.currentTime,Math.max(.05,t-this.ac.currentTime)); }
    if(this.hubParade){ this.hubEnd(t); if(this.ok&&this.paGainN){ const g=this.paGainN.gain, now=this.ac.currentTime; g.cancelScheduledValues(now); g.setValueAtTime(0,now); g.setValueAtTime(1,Math.max(now,t)); } } },
  /* ---- the fall into the first throw's drop (fall-drop plan, D1 / D2 / D5 / D6; step 2: nothing calls these yet) ----
     The pit's loop plays on the PA behind the Fair's band and the climb rises under both; see FALLV above. ---- */
  // The climb from the whoop to the landing, scheduled whole over `secs` from audio time t0: the riser (noise swelling as x^4
  // to 0.06), the sub drone rising an octave (x^3, to 0.05), hats on the sixteenths from 55% of the way down (0.01 to 0.05),
  // six toms into the landing, and the kick thumps on the beat (0.08 to 0.48 by the pit's law, low-pass 110 Hz to 2 kHz as
  // x^2). opts: thumps:false drops the thumps, tomSpan the toms' length (default 0.375 s, or 40% of a short climb).
  fallClimb(t0,secs,opts){
    if(!this.ok||!this.master) return;
    opts=opts||{}; const V=FALLV, t1=t0+Math.max(.2,secs||0), L=t1-t0;
    V.riser(this,t0+Math.min(.05,L*.02),t1,200,4500,.06,4);
    V.drone(this,t0,t1,41,82,.05,3);
    V.tick16(this,t0+.55*L,t1,.01,.05);
    V.tomRoll(this,t1,opts.tomSpan||Math.min(.375,L*.4));
    if(opts.thumps!==false){ const u=this.spb; for(let t=V.grid(this,t0,1); t<t1-1e-3; t+=u){ const x=(t-t0)/L;
      V.thump(this,t,.08+.4*V.pit01(x,V.paLaw.c),110*Math.pow(2000/110,x*x)); } }
  },
  // The mix by depth, x 0 to 1 (0 at the whoop, 1 at the landing); call it every frame. The pit's loop through the PA: gain
  // (1/(1+4(1-x)))^2, low-pass 120*(20000/120)^(x^2.5), by setTargetAtTime; and the Fair's band recedes (FAIR.hubFar).
  fallMix(x){
    if(!this.ok||!this.paFilter) return;
    x=Math.max(0,Math.min(1,+x||0)); const t=this.ac.currentTime, f=this.paFilter.frequency, g=this.paGainN.gain;
    f.cancelScheduledValues(t); f.setTargetAtTime(FALLV.paLaw.lp(x),t,.05);
    g.cancelScheduledValues(t); g.setTargetAtTime(FALLV.paLaw.gain(x),t,.05);
    if(typeof FAIR!=='undefined') FAIR.hubFar(x);
  },
  // The landing at audio time t: a crash (0.12), a sub boom (0.35), the loop dipped 85% for 0.3 s (a dip, not a silence), the
  // PA fully open, and the Fair's band cut (hubEnd).
  fallLand(t){
    if(!this.ok||!this.master) return;
    t=Math.max(t||0,this.ac.currentTime);
    this.crash(t,.12); FALLV.boom(this,t,.35); this.duck(t,.85,300); FALLV.paSet(this,t,20000,1); this.hubEnd(t);
  },
  // The pad waits on the open loop: a soft tick (0.02) on the eighths from t until fallWaitStop() (rollInto stops it too).
  fallWait(t){ if(!this.ok||!this.master) return; FALLV.ticker.start(this,Math.max(t||0,this.ac.currentTime),.02); },
  fallWaitStop(){ FALLV.ticker.stop(); },
  // The roll into the first ROCK (D2), from the press at t0 to ROCK at `rock`, gap = rock - t0: the PA closes to 700 Hz and 45%
  // under a hat-and-clap roll on the sixteenths (rising); an eighth-note breath of silence before ROCK, min(spb/2, max(.12,
  // gap*.45)); on ROCK the PA snaps open, a crash (0.16) and a sub boom (0.32) land. A gap under 0.42 s keeps the breath alone.
  // The game's own drums and downbeat on ROCK are drop() and stageLift()'s.
  rollInto(t0,rock){
    FALLV.ticker.stop();
    if(!this.ok||!this.master||!this.paFilter) return;
    t0=Math.max(t0||0,this.ac.currentTime); if(!(rock>t0)) return;
    const gap=rock-t0, breath=Math.min(this.spb/2,Math.max(.12,gap*.45)), end=rock-breath;
    const f=this.paFilter.frequency, gn=this.paGainN.gain;
    f.cancelAndHoldAtTime?f.cancelAndHoldAtTime(t0):f.cancelScheduledValues(t0); f.setValueAtTime(Math.max(40,f.value),t0); f.exponentialRampToValueAtTime(700,end); f.setValueAtTime(20000,rock);
    gn.cancelAndHoldAtTime?gn.cancelAndHoldAtTime(t0):gn.cancelScheduledValues(t0); gn.setValueAtTime(gn.value,t0); gn.linearRampToValueAtTime(.45,end); gn.setValueAtTime(0,end); gn.setValueAtTime(1,rock);
    if(gap>.42){ const u=this.spb/4; let i=0; for(let t=FALLV.grid(this,t0+.02,4); t<end-1e-3; t+=u,i++){ const x=(t-t0)/(end-t0);
      this.hat(t,.025+.07*x,6500+3000*x); if(i%2===0) this.clap(t,.04+.1*x); } }
    this.crash(rock,.16); FALLV.boom(this,rock,.32);
  },
  // The needle drop happens once per run: the loop is silent until the run's first ROCK, which becomes bar one.
  armNeedle(){ this.clearCut(); this.hubEnd(this.now()); this.needleArmed=true; this.silentUntil=Infinity; this.pa=false; this.paUntil=0; this.kicks=[];
    if(this.ok&&this.paFilter){ const t=this.ac.currentTime; this.paFilter.frequency.cancelScheduledValues(t); this.paFilter.frequency.setValueAtTime(20000,t); this.paGainN.gain.cancelScheduledValues(t); this.paGainN.gain.setValueAtTime(1,t); } },
  dropNeedle(t){ this.needleArmed=false; this.silentUntil=0; this.pa=false; this.paUntil=0; this.t0=t; this.nextIdx=0; this.pendingI=null; this.breaking=false; this.breakQueued=false; },
  // CUT ON CLEAR (fight-ux-aesthetics step 6, Test Bench, off by default): the track stops
  // dead as the beaten robot tips over and stays silent over the body. The loop bus shuts
  // too, since steps already scheduled up to 0.6 s ahead would otherwise play on, and
  // duck() leaves it shut. uncut(t) brings it back at the receipt the way the needle drop
  // does: bar one on that exact time. SFX go to master and are never cut.
  cut(){ this.cutOn=true; this.silentUntil=Infinity;
    if(this.ok&&this.loopBus){ const g=this.loopBus.gain, t=this.ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value,t); g.linearRampToValueAtTime(0,t+.015); } },
  uncut(t){ if(!this.cutOn) return; this.cutOn=false; this.silentUntil=0; this.t0=t; this.nextIdx=0; this.kicks=[];
    if(this.ok&&this.loopBus){ const g=this.loopBus.gain; g.cancelScheduledValues(t); g.setValueAtTime(1,t); } },
  clearCut(){ if(!this.cutOn) return; this.cutOn=false;
    if(this.ok&&this.loopBus){ const g=this.loopBus.gain, t=this.ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(1,t); } },
  // A riser under the walk-on: filtered noise sweeping up into the drop. Bypasses the PA.
  riser(t,dur){ if(!this.ok)return; dur=Math.max(.3,dur||1.2);
    const src=this.ac.createBufferSource(); src.buffer=this.noiseBuf; src.loop=true;
    const f=this.ac.createBiquadFilter(); f.type='bandpass'; f.Q.value=1.2; f.frequency.setValueAtTime(260,t); f.frequency.exponentialRampToValueAtTime(3600,t+dur);
    const g=this.ac.createGain(); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.05,t+dur); g.gain.linearRampToValueAtTime(0,t+dur+.06);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t+dur+.1); },
  // The breaker kachunk: a big old switch thrown. Spotlight on, needle down, last node of a cull.
  kachunk(t){ if(!this.ok)return; t=Math.max(t,this.ac.currentTime+.001);
    const {o}=this.osc('sine',90,t,.26,.9); o.frequency.exponentialRampToValueAtTime(38,t+.2);
    this.clap(t,.55); this.osc('square',110,t+.01,.09,.1); this.osc('triangle',1760,t+.04,.05,.05); },
  // iOS wakes the context only inside a touch's own handler: resume it and play one silent sample. Safe to call on every tap.
  unlock(){
    if(!this.ok) return;
    try{ const p=this.ac.resume(); if(p&&p.catch) p.catch(()=>{}); }catch(e){}
    try{ const b=this.ac.createBuffer(1,1,22050); const s=this.ac.createBufferSource(); s.buffer=b; s.connect(this.ac.destination); s.start(0); }catch(e){}
  },
  start(){
    if(!this.ok){ this.t0=this.now()+.06; this.on=true; return; }
    this.unlock();
    this.unmute();
    this.stepDur=this.spb/2; this.nextIdx=0; this.on=true; this.t0=this.ac.currentTime+.12;
    this.pendingI=null; this.breaking=false; this.breakQueued=false;
    this.pa=false; this.paUntil=0; this.needleArmed=false; this.kicks=[]; this.clearCut();
    this.silentUntil=0;   // a needle armed by an earlier run left this at Infinity; only armNeedle() (after start) may silence a fresh start
    if(!this.timer) this.timer=setInterval(()=>this.schedule(),25);
  },
  unmute(){
    // iOS: a looping *silent* media element promotes the page's audio session to
    // "playback", so Web Audio stops being muted by the hardware ring/silent switch.
    if(this._unmute){ this._unmute.play().catch(()=>{}); return; }
    try{
      const sr=8000, n=sr*0.5, buf=new ArrayBuffer(44+n), v=new DataView(buf);
      const w=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); };
      w(0,'RIFF'); v.setUint32(4,36+n,true); w(8,'WAVE'); w(12,'fmt ');
      v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
      v.setUint32(24,sr,true); v.setUint32(28,sr,true); v.setUint16(32,1,true); v.setUint16(34,8,true);
      w(36,'data'); v.setUint32(40,n,true);
      for(let i=0;i<n;i++) v.setUint8(44+i,128);   // 8-bit unsigned midpoint = silence
      const a=new Audio(); a.loop=true; a.volume=0.001; a.playsInline=true;
      a.src=URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
      a.play().catch(()=>{}); this._unmute=a;
    }catch(e){}
  },
  ready(cb){
    if(!this.ok){ cb(); return; }
    const t=performance.now();
    const chk=()=>{
      if(this.ac.currentTime>0.02 || performance.now()-t>1500){ this.t0=this.ac.currentTime+.12; this.nextIdx=0; cb(); }
      else {
        if(!this._resuming && this.ac.state!=='running'){
          this._resuming=true;
          const p=this.ac.resume();
          if(p&&p.catch) p.catch(()=>{});
          if(p&&p.finally) p.finally(()=>{ this._resuming=false; }); else this._resuming=false;
        }
        requestAnimationFrame(chk);
      }
    };
    chk();
  },
  schedule(){
    if(!this.ok || paused) return;
    const now=this.ac.currentTime;
    // If the main thread stalled (heavy visual tier / result freeze) and we're now
    // way behind, don't schedule a burst of past-dated notes — they'd clump and read
    // as a skip. Jump the grid forward to the next whole step and carry on cleanly.
    const behind = now - (this.t0 + this.nextIdx*this.stepDur);
    if(this.stepDur>0 && behind > 0.12){
      this.nextIdx += Math.ceil(behind/this.stepDur);
    }
    const ahead=now+.6;                        // wide lookahead: keeps ~0.6s of audio scheduled on the audio thread so a brief main-thread freeze during a screen transition can't starve the loop into a skip
    while(this.t0+this.nextIdx*this.stepDur<ahead){
      const t=this.t0+this.nextIdx*this.stepDur;
      if(this.nextIdx%8===0) this.barTop(t);   // bar seam: arrangement changes land cleanly
      if(this.pa && t>=this.paUntil) this.pa=false;                   // the drop has landed: drums are back
      if(this.on && t>=this.silentUntil) this.playStep(this.nextIdx%32,t);
      this.nextIdx++;
    }
  },
  playStep(s,t){
    const stage=this.breaking?1:Math.round(this.intensity);
    const bus=this.loopBus;
    const pa=this.pa && t<this.paUntil;   // Day: the track through the PA — drums out here, low-passed on the bus
    const lvl=STAGE_MIX[Math.max(0,Math.min(STAGE_MIX.length-1,stage-1))];
    // Four bars of eighth notes. The harmony moves Am → C → G → Em, while each
    // bar's local step p runs 0-7. The old static two-bar A loop is gone.
    const bar=Math.floor(s/8), p=s%8, onPulse=p%4===0, onBeat=p%2===0;
    const roots=[55,65.41,49,41.20], chordRoots=[110,130.81,98,82.41];
    const qualities=['minor','major','major','minor'];
    const tones=[
      [220,261.63,329.63,392], [261.63,329.63,392,523.25],
      [196,246.94,293.66,392], [164.81,196,246.94,329.63]
    ];

    /* THE POCKET. Match 1 is already musical. Match 2 gets the complete four-on-floor
       and offbeat-hat engine, so round two is where the track actually grooves. */
    if(!pa && (stage>=2?onBeat:onPulse)){
      this.kick(t,onPulse?lvl.kick:lvl.kick*.72,bus);
      if(onPulse){ this.kicks.push(t); if(this.kicks.length>32) this.kicks.shift(); }
    }
    if(!pa && (p===2||p===6)) this.clap(t,lvl.clap*(stage===1?(p===6?1:.44):1),bus);
    if(!pa && (stage>=2?(!onBeat&&p!==7):(p===3||p===7))) this.hat(t,lvl.hat*(p===7?1.25:1),stage>=7?7900:6800,bus);
    if(!pa && stage>=2 && p===7) this.openHat(t,lvl.hat*.72,5600,bus);

    /* A syncopated, chord-following bass phrase. Stage 1 states the roots; stage 2
       supplies the dancing pickup, and later rounds answer in the octave. */
    if(p===0 || p===4 || (stage>=2 && p===3)){
      const ratio=p===4?1.5:1;
      this.bassN(t,roots[bar]*ratio,lvl.bass*(p===3?.70:1),bus);
    }
    if(stage>=4 && p===7 && bar%2===1) this.bassN(t,roots[(bar+1)%4]*2,lvl.bass*.52,bus);

    /* Harmony is present at low level from the intro, then becomes a proper rhythmic
       stab in round 2. The voicing opens later; density does not simply pile upward. */
    if(p===0 || (stage>=2 && p===6)){
      const high=stage>=5 && (bar===1||bar===3);
      this.chordPulse(t,chordRoots[bar]*(high?2:1),lvl.chord,bus,qualities[bar]);
    }

    /* Filtered plucks replace the old square-wave hook. Round 1 hints; round 2 arpeggiates;
       round 3 introduces a memorable call, and round 4 answers it. */
    if((stage===1 && p===3) || (stage>=2 && (p===1||p===5))){
      const degree=p===1?1:2;
      this.pluck(t,tones[bar][degree],lvl.arp,stage>=7?.20:.16,bus,stage>=7?3200:2200);
    }
    const hookA=[440,392,329.63,261.63], hookB=[523.25,493.88,392,329.63];
    if(stage>=3 && p===3) this.pluck(t,(stage>=7?hookB:hookA)[bar],lvl.arp*1.12,.22,bus,stage>=7?3900:2700);
    if(stage>=4 && p===7) this.pluck(t,tones[(bar+1)%4][stage>=7?3:2],lvl.arp*.80,.14,bus,3400);

    /* Phrase punctuation and authored late-run mutations. */
    if(!pa && s===0) this.crash(t,stage>=8?.050:stage>=3?.032:.018,bus);
    if(!pa && stage>=4 && s===30) this.kick(t,lvl.kick*.48,bus);
    if(stage>=6 && s===22) this.pluck(t,392,lvl.arp*.78,.18,bus,3600);
    if(!pa && stage>=8 && (s===29||s===31)) this.tom(t,stage===8?(s===29?130.81:98):110,.16,bus);

    /* THE SMALL AXIS. A win now earns a recurring musical gesture—not one tiny event—
       and the very next face-off is audibly busier. Parts reset between opponents. */
    const heatN=Math.min(G.heat,6), hFrac=heatN/6;
    if(!pa && heatN>=1 && (p===1||p===5)) this.hat(t+this.stepDur*.45,.026+.020*hFrac,8600,bus); // 1: sixteenth shimmer
    if(heatN>=2 && p===7 && bar%2===0) this.pluck(t,tones[bar][3],.027+.012*hFrac,.13,bus,3800); // 2: answer plucks
    if(!pa && heatN>=3 && p===7 && bar%2===1) this.kick(t,lvl.kick*.28,bus);                    // 3: ghost kick
    if(heatN>=4 && p===2 && bar===3) this.chordPulse(t,164.81,.022+.012*hFrac,bus,'minor');      // 4: chord answer
    if(heatN>=5 && p===5) this.bassN(t,roots[bar]*2,.038+.018*hFrac,bus);                         // 5: octave bass
    if(!pa && heatN>=6 && s>=28) this.tom(t,[164.81,146.83,130.81,98][s-28],.085,bus);             // 6: four-note fill
  },
  osc(type,f,t,dur,vol,dest){
    const o=this.ac.createOscillator(), g=this.ac.createGain();
    o.type=type; o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g); g.connect(dest||this.master); o.start(t); o.stop(t+dur+.02); return {o,g};
  },
  kick(t,v,dest){ if(!this.ok)return; const {o}=this.osc('sine',150,t,.22,v*.9,dest); o.frequency.exponentialRampToValueAtTime(45,t+.16); },
  hat(t,v,freq=7000,dest){ if(!this.ok)return;
    const src=this.ac.createBufferSource(); src.buffer=this.noiseBuf;
    const f=this.ac.createBiquadFilter(); f.type='highpass'; f.frequency.value=freq;
    const g=this.ac.createGain(); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+.05);
    src.connect(f); f.connect(g); g.connect(dest||this.master); src.start(t); src.stop(t+.06); },
  openHat(t,v,freq=5600,dest){ if(!this.ok)return;
    const src=this.ac.createBufferSource(); src.buffer=this.noiseBuf;
    const f=this.ac.createBiquadFilter(); f.type='highpass'; f.frequency.value=freq;
    const g=this.ac.createGain(); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+.16);
    src.connect(f); f.connect(g); g.connect(dest||this.master); src.start(t); src.stop(t+.18); },
  crash(t,v,dest){ if(!this.ok)return;
    const src=this.ac.createBufferSource(); src.buffer=this.noiseBuf;
    const f=this.ac.createBiquadFilter(); f.type='bandpass'; f.frequency.value=3400; f.Q.value=.6;
    const g=this.ac.createGain(); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+.42);
    src.connect(f); f.connect(g); g.connect(dest||this.master); src.start(t); src.stop(t+.45); },
  bassN(t,f,v,dest){ if(!this.ok)return;
    const o=this.ac.createOscillator(), fl=this.ac.createBiquadFilter(), g=this.ac.createGain();
    o.type='sawtooth'; o.frequency.value=f; fl.type='lowpass'; fl.frequency.value=320;
    g.gain.setValueAtTime(v||.12,t); g.gain.exponentialRampToValueAtTime(.001,t+.26);
    o.connect(fl); fl.connect(g); g.connect(dest||this.master); o.start(t); o.stop(t+.3); },
  tom(t,f,v,dest){ if(!this.ok)return;
    const {o}=this.osc('triangle',f,t,.18,v,dest); o.frequency.exponentialRampToValueAtTime(f*.68,t+.15); },
  clap(t,v,dest){ if(!this.ok)return;
    const src=this.ac.createBufferSource(); src.buffer=this.noiseBuf;
    const f=this.ac.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1600; f.Q.value=.8;
    const g=this.ac.createGain(); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+.12);
    src.connect(f); f.connect(g); g.connect(dest||this.master); src.start(t); src.stop(t+.14); },
  blip(t,f,v,dur,dest){ if(!this.ok)return; return this.pluck(t,f,v,dur,dest,3000); },
  pluck(t,f,v,dur=.18,dest,brightness=2600){ if(!this.ok)return;
    const saw=this.ac.createOscillator(), tri=this.ac.createOscillator();
    const mix=this.ac.createGain(), fl=this.ac.createBiquadFilter(), g=this.ac.createGain();
    saw.type='sawtooth'; tri.type='triangle'; saw.frequency.value=f; tri.frequency.value=f;
    mix.gain.value=.58; fl.type='lowpass'; fl.Q.value=2.2;
    fl.frequency.setValueAtTime(Math.max(500,brightness),t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(260,f*1.4),t+dur);
    g.gain.setValueAtTime(.001,t); g.gain.exponentialRampToValueAtTime(v,t+.008);
    g.gain.exponentialRampToValueAtTime(.001,t+dur);
    saw.connect(mix); tri.connect(mix); mix.connect(fl); fl.connect(g); g.connect(dest||this.master);
    saw.start(t); tri.start(t); saw.stop(t+dur+.02); tri.stop(t+dur+.02); return {g};
  },
  chordPulse(t,root,v,dest,quality='minor'){ if(!this.ok)return;
    const ratios=quality==='major'?[1,1.259921,1.498307]:[1,1.189207,1.498307];
    ratios.forEach(r=>{
      const o=this.ac.createOscillator(), fl=this.ac.createBiquadFilter(), g=this.ac.createGain();
      o.type='triangle'; o.frequency.value=root*r; fl.type='lowpass'; fl.frequency.value=1500;
      g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+.32);
      o.connect(fl); fl.connect(g); g.connect(dest||this.master); o.start(t); o.stop(t+.34);
    });
  },
  beep(t,f,final){ if(!this.ok)return;
    const n=this.pluck(t,f,final?.20:.125,final?.30:.12,undefined,final?4200:3000);
    this.beepGains.push({g:n.g,t});
    if(final) this.kick(t,.8); },
  wordTick(t,f,big){ if(!this.ok)return; this.beep(t,f,big); if(!big) this.kick(t,.4); },
  /* EVT-08: the third word is a sponsor's note now. The kick lands at exactly the
     same instant a word tick would, so the beat, the tempo and the SHOOT are
     untouched — only what sits on that beat changes, from one blip to a two-note
     figure inside the same slot. */
  jingleTick(t,f){ if(!this.ok)return;
    this.beep(t,f,false); this.beep(t+.075,f*1.5,false);
    this.kick(t,.4); },
  receiptTick(index,total){ if(!this.ok)return;
    const t=this.ac.currentTime, steps=Math.max(1,total-1), p=Math.min(1,index/steps);
    // Quantized to the score's pitch set: still climbs, never wanders outside the song.
    this.beep(t,SCORE_SCALE[2+Math.round(p*6)],false);
  },
  receiptPayoff(){ if(!this.ok)return;
    const t=this.ac.currentTime; this.cancelBeeps(); this.duck(t,.72,520);
    this.chordPulse(t,110,.22); this.bassN(t,55,.28); this.kick(t,.95);
    this.pluck(t+.08,880,.15,.2,undefined,4600);
  },
  cancelBeeps(){ if(!this.ok)return;
    const now=this.ac.currentTime;
    this.beepGains.forEach(b=>{ if(b.t>now){ b.g.gain.cancelScheduledValues(0); b.g.gain.value=0; }});
    this.beepGains=[]; },
  // Dips the LOOP only (not the SFX itself) so a throw's stab or a match win reads
  // clearly against the beat instead of both fighting for the same instant. This
  // also fixes stale-note bleed-through: it's a gain node downstream of every
  // loop voice, so it affects notes already committed to the Web Audio timeline,
  // not just notes scheduled after the duck was requested.
  // Between fights the parade's band is the game's music (K.hubMusic 'parade'), so it dips too: an Event film's dips
  // (18f Q_DUCK) and the Bounty's choir reach it (FAIR.duck holds it down; ipad-mini fix, owner 2026-11-07). Under an
  // Event card the band is far off instead (FAIR.background) and FAIR.duck skips them (parade-fade fix, 2026-11-07).
  duck(t,amt,ms){
    if(this.hubParade&&typeof FAIR!=='undefined') FAIR.duck(t,amt,ms);
    if(!this.ok || !this.loopBus || this.cutOn) return;
    const g=this.loopBus.gain, now=this.ac.currentTime, at=Math.max(t,now);
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    g.linearRampToValueAtTime(1-amt, at+.02);
    g.linearRampToValueAtTime(1, at+ms/1000);
  },
  winFx(step=1){ if(!this.ok)return;
    const t=this.ac.currentTime, n=Math.max(1,Math.min(6,step));
    const a=[440,523.25,587.33,698.46,783.99,880][n-1];
    const b=[523.25,587.33,698.46,783.99,880,1046.5][n-1];
    this.duck(t,.48,220); this.pluck(t,a,.15+.012*n,.13,undefined,3600+n*180);
    this.pluck(t+.085,b,.14+.01*n,.20,undefined,4100+n*180);
    if(n>=2) this.tom(t+.02,164.81,.07+.009*n);
    if(n>=3) this.bassN(t,55,.060+.008*n);
    if(n>=5) this.chordPulse(t+.02,110,.027,undefined,'minor');
    this.hat(t,.15+.012*n);
  },
  loseFx(){ if(!this.ok)return; const t=this.ac.currentTime; this.duck(t,.5,220); const {o}=this.osc('sawtooth',240,t,.3,.2); o.frequency.exponentialRampToValueAtTime(70,t+.26); this.hat(t,.12); },
  // EVT-07: a mechanical shutter, then a crowd that came for a fight
  shutter(){ if(!this.ok)return; const t=this.ac.currentTime+.001;
    this.kick(t,.55); this.crash(t,.10);
    this.pluck(t+.012,2600,.10,.05,undefined,7000); },
  boo(){ if(!this.ok)return; const t=this.ac.currentTime+.001;
    this.duck(t,.55,700);
    [92,110,138].forEach((f,i)=>{ const {o}=this.osc('sawtooth',f,t+i*.05,.85,.055);
      o.frequency.exponentialRampToValueAtTime(f*0.72,t+.8); }); },
  tieSlam(){ if(!this.ok)return; const t=this.ac.currentTime+.001; this.kick(t,1.1); this.crash(t,.12); },   // no duck: the music swelling back 180 ms after the kick read as a second bump (owner phone check 2026-10-16)
  matchSlam(t){ if(!this.ok)return; this.duck(t,.92,(this.spb+.15)*1000); this.kick(t,1.2); this.crash(t,.3); this.chordPulse(t,110,.18,undefined,'minor'); this.pluck(t+.08,880,.14,.3,undefined,4400); },
  runOverFx(){ if(!this.ok)return; const t=this.ac.currentTime; this.duck(t,.85,900); const {o}=this.osc('sawtooth',520,t,.9,.18); o.frequency.exponentialRampToValueAtTime(60,t+.85); this.crash(t+.1,.12); },
  setMute(m){ this.muted=m; if(this.ok) this.master.gain.value=m?0:.8; this.session(m?'ambient':'playback'); },
  // Safari's Audio Session API (iOS 17+, navigator.audioSession): 'playback' sounds through the ring/silent switch and takes the
  // audio focus; 'ambient' obeys the switch and leaves the player's own music running, which is what a muted game should do.
  // Elsewhere it is undefined: a no-op. Owner phone check: silent switch on, the game still sounds; MUTED, Music keeps playing.
  session(t){ try{ const s=navigator.audioSession; if(s&&s.type!==t) s.type=t; }catch(e){} }
};

const ALT_SCORE_LIBRARY=Object.freeze({
  piracy:Object.freeze({label:'PIRACY',status:'IN GAME',bpm:100,
    blurb:'Paris pressure motor fused permanently to cheap retro-space circuitry.',
    scenes:['DISTANT CIRCUIT','HARD-CORE DROP','LOCKED GRID','SECOND ENGINE','PRESSURE CHAMBER','REDLINE ORBIT','SYSTEM BREACH','KILL SIGNAL']}),
  ghost:Object.freeze({label:'GHOST CIRCUIT',status:'LAB ONLY',bpm:84,
    blurb:'A dead fairground choir slowly possesses the arena machinery.',
    scenes:['EMPTY MIDWAY','FIRST VOICE','PIPE ROOM','ANSWERING GHOST','CHOIR IGNITION','BELL TOWER','FULL POSSESSION','LAST HYMN']}),
  tilt:Object.freeze({label:'TILT!',status:'LAB ONLY',bpm:132,
    blurb:'Electromechanical pinball funk: bumpers, ricochets, bonus lanes and multiball.',
    scenes:['ATTRACT MODE','BALL ONE','LEFT ORBIT','BONUS LANE','TILT WARNING','JACKPOT LIT','MULTIBALL','EXTRA BALL']}),
  gravity:Object.freeze({label:'GRAVITY WELL',status:'LAB ONLY',bpm:76,
    blurb:'A huge slow pulse bends pitch and time until the Final collapses inward.',
    scenes:['FAR SIGNAL','MASS DETECTED','ORBIT DECAY','TIME SHEAR','RED SHIFT','POINT OF NO RETURN','SPAGHETTIFY','SINGULARITY']}),
  scrap:Object.freeze({label:'SCRAP PARADE',status:'LAB ONLY',bpm:116,
    blurb:'A crooked robot marching band built from oil drums, springs and bad bearings.',
    scenes:['ONE LOOSE BOLT','BOOT STOMP','TIN PARADE','SPRING SECTION','DOUBLE TIME','BRAKE FAILURE','WHOLE YARD','ROYAL WRECK']}),
});

function altEnvelope(g,t,v,dur,attack=.006){
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.0002,v),t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
}
function altDrone(e,t,f,v,dur,wide=false){
  if(!e.ok)return;const mix=e.ac.createGain(),fl=e.ac.createBiquadFilter(),g=e.ac.createGain();
  fl.type='lowpass';fl.frequency.value=wide?520:220;fl.Q.value=1.1;mix.gain.value=.55;altEnvelope(g,t,v,dur,.08);
  [0,wide?-11:0,wide?11:0].forEach((d,i)=>{const o=e.ac.createOscillator();o.type=i?'triangle':'sawtooth';o.frequency.value=f;o.detune.value=d;o.connect(mix);o.start(t);o.stop(t+dur+.03)});
  mix.connect(fl);fl.connect(g);g.connect(e.loopBus);
}
function altGlide(e,t,from,to,v,dur=.2,pan=0){
  if(!e.ok)return;const o=e.ac.createOscillator(),fl=e.ac.createBiquadFilter(),g=e.ac.createGain(),p=e.ac.createStereoPanner?e.ac.createStereoPanner():null,d=p||e.loopBus;
  o.type='square';o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+dur*.35);fl.type='lowpass';fl.frequency.setValueAtTime(3600,t);fl.frequency.exponentialRampToValueAtTime(520,t+dur);fl.Q.value=7;altEnvelope(g,t,v,dur);
  if(p){p.pan.value=pan;p.connect(e.loopBus)}o.connect(fl);fl.connect(g);g.connect(d);o.start(t);o.stop(t+dur+.03);
}
function altBell(e,t,f,v,pan=0){
  if(!e.ok)return;const p=e.ac.createStereoPanner?e.ac.createStereoPanner():null,d=p||e.loopBus;if(p){p.pan.value=pan;p.connect(e.loopBus)}
  [1,2.01,3.98].forEach((r,i)=>{const o=e.ac.createOscillator(),g=e.ac.createGain();o.type=i?'sine':'triangle';o.frequency.value=f*r;altEnvelope(g,t,v/(i+1),.42+i*.12,.002);o.connect(g);g.connect(d);o.start(t);o.stop(t+.7)});
}
function altClank(e,t,f,v,pan=0){
  if(!e.ok)return;altBell(e,t,f,v*.55,pan);e.hat(t,v*.72,2600,e.loopBus);
}
function altKick(e,t,v){e.kick(t,v,e.loopBus);e.kicks.push(t);if(e.kicks.length>32)e.kicks.shift()}
function altHeat(e){return e.labMode?(e.labHeat||0):Math.min(6,G.heat||0)}

function playAltStep(e,s,t){
  const id=e.compositionId,stage=Math.max(1,Math.min(8,Math.round(e.intensity))),heat=altHeat(e),p=s%8,bar=Math.floor(s/8),bus=e.loopBus,pa=e.pa&&t<e.paUntil;
  if(e.labMode){
    const wait=Math.max(0,(t-e.ac.currentTime)*1000);
    setTimeout(()=>labPulse(e,s),wait);
  }
  if(s===0) altDrone(e,t,id==='piracy'?49:id==='ghost'?55:id==='gravity'?36.7:id==='tilt'?65.4:43.65,.012+stage*.002,e.stepDur*31.7,stage>=5);
  if(id==='piracy'){
    if(stage===1){if(s===0||s===16){altKick(e,t,.06);e.bassN(t,46.25,.055,bus)}if(s===14||s===30)altClank(e,t,783.99,.018,s<16?-.6:.6);return}
    if(!pa&&p%2===0)altKick(e,t,.66+stage*.045);
    if(!pa&&(p===2||p===6))e.clap(t,.10+stage*.012,bus);
    if(!pa&&p%2===1)e.hat(t,.018+stage*.004,stage>=6?8000:6900,bus);
    if([0,4].includes(p)||s===14||s===22||s===30)e.bassN(t,p===4?73.42:49,.085+stage*.008,bus);
    const cell={25:82.41,26:77.78,29:77.78,31:82.41,9:82.41,10:77.78,13:77.78,15:82.41};
    if(cell[s]&&(stage>=4||s>20))e.pluck(t,cell[s],.035+stage*.006,.09,bus,900+stage*130);
    if([6,14,22,30].includes(s))altGlide(e,t,s%16===6?392:349.23,s%16===6?349.23:392,.018+stage*.006,.22,s<16?-.7:.7);
    if(stage>=5&&[11,27].includes(s))altGlide(e,t,466.16,392,.028+stage*.004,.25,s<16?.45:-.45);
    if(heat>=1&&[7,15,23,31].includes(s))e.hat(t,.035+.006*heat,8600,bus);
    if(heat>=2&&[3,19].includes(s))e.pluck(t,98,.025+.006*heat,.10,bus,1300);
    if(heat>=4&&[13,29].includes(s))altClank(e,t,587.33,.025+.005*heat,s<16?-1:1);
    if(stage===8&&s>=28)altClank(e,t,[174.61,196,233.08,293.66][s-28],.055,(s-29.5)/2);
  }else if(id==='ghost'){
    if(!pa&&p===0&&stage>=2)altKick(e,t,.34+stage*.035);
    if(p===0)e.chordPulse(t,[110,130.81,98,82.41][bar],.012+stage*.004,bus,bar%2?'major':'minor');
    if([3,7].includes(p)&&stage>=2)altBell(e,t,[440,523.25,392,329.63][bar]*(p===7?1.5:1),.012+stage*.003,s<16?-.65:.65);
    if(stage>=4&&p===5)altGlide(e,t,220,110,.012+stage*.003,.55,s<16?-.8:.8);
    if(stage>=6&&p%2===1)e.hat(t,.012+stage*.002,9200,bus);
    if(heat>=2&&s%8===6)altBell(e,t,659.25,.012+.004*heat,s<16?.5:-.5);
    if(stage===8&&s>=24&&s%2===0)e.chordPulse(t,110*Math.pow(2,(s-24)/12),.036,bus,'minor');
  }else if(id==='tilt'){
    if(!pa&&p%2===0)altKick(e,t,.36+stage*.045);
    if(!pa&&(p===2||p===6))altClank(e,t,p===2?880:1174.66,.025+stage*.004,p===2?-.7:.7);
    const lane=[261.63,329.63,392,523.25,392,659.25,523.25,783.99];
    if(p%2===1||stage>=5)e.pluck(t,lane[(s+bar)%8]*(stage>=7&&s%3===0?2:1),.018+stage*.004,.08,bus,2400+stage*300);
    if(stage>=3&&[5,13,21,29].includes(s))altGlide(e,t,1046.5,523.25,.04+stage*.003,.12,s<16?-.9:.9);
    if(stage>=6&&s%4===3)altBell(e,t,880+(s%8)*55,.022,s<16?-.5:.5);
    if(heat>=1&&s%4===1)e.hat(t,.02+.004*heat,7800,bus);
    if(stage===8&&s>=24)altGlide(e,t,392+(s-24)*55,1567.98,.032,.11,(s-27.5)/4);
  }else if(id==='gravity'){
    if(!pa&&(s===0||s===16||stage>=5&&(s===10||s===26)))altKick(e,t,.62+stage*.04);
    if(p===0)e.bassN(t,[36.7,32.7,29.14,27.5][bar],.10+stage*.008,bus);
    if([6,14,22,30].includes(s))altGlide(e,t,stage>=5?220:146.83,stage>=5?55:73.42,.018+stage*.005,.72,s<16?-.55:.55);
    if(stage>=3&&p===3)altBell(e,t,[293.66,261.63,220,196][bar],.012+stage*.002,s<16?-.7:.7);
    if(stage>=6&&!pa&&p%2===0)e.hat(t,.012+stage*.002,3600,bus);
    if(heat>=3&&s%8===4)e.bassN(t,55,.035+.008*heat,bus);
    if(stage===8&&s>=24){const f=110*Math.pow(.90,s-24);e.pluck(t,f,.042,.07,bus,700);if(s%2===0)altKick(e,t,.34)}
  }else if(id==='scrap'){
    if(!pa&&[0,3,6].includes(p))altKick(e,t,p===0?.58+stage*.04:.24+stage*.02);
    if(!pa&&[2,5,7].includes(p))altClank(e,t,[174.61,233.08,311.13][[2,5,7].indexOf(p)],.022+stage*.005,p===2?-.75:p===7?.75:0);
    if([0,4,7].includes(p))e.bassN(t,[43.65,58.27,65.41,38.89][bar]*(p===7?1.5:1),.07+stage*.007,bus);
    if(stage>=3&&p%2===1)e.hat(t,.015+stage*.003,p===7?4800:6500,bus);
    if(stage>=5&&[1,9,17,25].includes(s))e.pluck(t,[349.23,392,466.16,523.25][bar],.025+stage*.003,.13,bus,1800);
    if(heat>=2&&s%4===2)altClank(e,t,698.46,.014+.004*heat,s<16?-.4:.4);
    if(stage===8&&s>=24)altClank(e,t,[174.61,196,233.08,261.63,311.13,349.23,392,466.16][s-24],.045,(s-27.5)/4);
  }
}

function makeAltMusicEngine(compositionId,labMode=false){
  const meta=ALT_SCORE_LIBRARY[compositionId];
  return Object.assign(Object.create(DEFAULT_MUSIC_ENGINE),{
    compositionId,labMode,labHeat:0,
    ac:null,master:null,ok:false,muted:false,spb:60/meta.bpm,t0:0,stepDur:0,nextIdx:0,timer:null,on:false,silentUntil:0,intensity:1,beepGains:[],pendingI:null,breaking:false,breakQueued:false,pa:false,paUntil:0,hubParade:false,needleArmed:false,kicks:[],
    schedule(){
      if(!this.ok||(!this.labMode&&paused))return;const now=this.ac.currentTime,behind=now-(this.t0+this.nextIdx*this.stepDur);
      if(this.stepDur>0&&behind>.12)this.nextIdx+=Math.ceil(behind/this.stepDur);
      const ahead=now+.6;while(this.t0+this.nextIdx*this.stepDur<ahead){const t=this.t0+this.nextIdx*this.stepDur;if(this.nextIdx%8===0)this.barTop(t);if(this.pa&&t>=this.paUntil)this.pa=false;if(this.on&&t>=this.silentUntil)this.playStep(this.nextIdx%32,t);this.nextIdx++}
    },
    playStep(s,t){playAltStep(this,s,t)},
    stageLift(t,stage){
      if(!this.ok)return;this.duck(t,.78,620);altKick(this,t,stage===1?.7:1.08);this.crash(t,.07+stage*.008,this.loopBus);
      if(compositionId==='piracy'){this.bassN(t,49,.18,this.loopBus);altGlide(this,t,392,349.23,.055,.24,-.35);altGlide(this,t+.12,349.23,392,.05,.24,.35)}
      else if(compositionId==='ghost'){this.chordPulse(t,110,.09,this.loopBus,'minor');altBell(this,t+.08,440,.055,0)}
      else if(compositionId==='tilt'){[0,.08,.16].forEach((d,i)=>altBell(this,t+d,[523.25,783.99,1046.5][i],.045,i-1))}
      else if(compositionId==='gravity'){altDrone(this,t,36.7,.08,this.spb*2,true);altGlide(this,t+.04,220,55,.06,.9,0)}
      else {[0,.07,.14,.21].forEach((d,i)=>altClank(this,t+d,[174.61,233.08,311.13,392][i],.045,(i-1.5)/2))}
    }
  });
}

const PIRACY_MUSIC_ENGINE=makeAltMusicEngine('piracy');
const LAB_MUSIC_ENGINES=Object.fromEntries(Object.keys(ALT_SCORE_LIBRARY).map(id=>[id,makeAltMusicEngine(id,true)]));

/* MUSIC PROFILES
   The current fight score is deliberately named and preserved as DEFAULT.
   PIRACY is the approved alternate engine; experimental scores remain isolated
   in the integrated lab until they pass a phone ear test. */
const MUSIC_PROFILES=Object.freeze({
  default:Object.freeze({
    key:'default', label:'DEFAULT', status:'CURRENT GAME MUSIC',
    arrangement:'reactive-score-v4', baseBpm:()=>K.bpm, tempoLift:[0,8,10,12,13,14,15,16],
    chant:[440,523.25,659.25,880],engine:DEFAULT_MUSIC_ENGINE
  }),
  piracy:Object.freeze({
    key:'piracy',label:'PIRACY',status:'ALT GAME MUSIC',
    arrangement:'piracy-v1',baseBpm:()=>100,tempoLift:[0,0,1,2,3,4,5,6],
    chant:[392,523.25,622.25,783.99],engine:PIRACY_MUSIC_ENGINE
  })
});
const MUSIC_PROFILE_ORDER=Object.keys(MUSIC_PROFILES);
let ACTIVE_MUSIC_PROFILE='default';
let AU=MUSIC_PROFILES[ACTIVE_MUSIC_PROFILE].engine;
let AUDIO_MODE='default';
let LAB_OPEN=false;
let PENDING_MUSIC_PROFILE=null;
const AUDIO_MODE_ORDER=['default','piracy','muted'];
const activeMusicProfile=()=>MUSIC_PROFILES[ACTIVE_MUSIC_PROFILE];
function selectMusicProfile(key,force=false){
  const next=MUSIC_PROFILES[key];
  if(!next) return false;
  if(!force&&typeof G!=='undefined'&&(G.state==='windup'||G.state==='resolve')){
    PENDING_MUSIC_PROFILE=key;AUDIO_MODE=key;syncMusicModeUI();syncMusicProfileUI();return true;
  }
  PENDING_MUSIC_PROFILE=null;
  const old=AU,wasOn=!!old.on,wasPA=!!old.pa;
  const wasTitle=typeof FAIR!=='undefined'&&FAIR.state==='title';   // the title's sound moves to the new engine
  const wasNaming=typeof FAIR!=='undefined'&&FAIR.state==='naming';   // and the Naming's, as its loop, the PA staying quiet
  if(next.engine!==old){if(typeof FAIR!=='undefined')FAIR.stop(.05);old.on=false;old.setMute(true);ACTIVE_MUSIC_PROFILE=key;AU=next.engine;
    if(wasOn){AU.init();AU.setTempo(musicTempo());AU.setIntensityNow(musicTier());AU.start();if(wasPA)AU.setPA(true,AU.now(),.15)}
  }else ACTIVE_MUSIC_PROFILE=key;
  AUDIO_MODE=key;AU.setMute(false);syncMusicModeUI();syncMusicProfileUI();
  if(wasTitle){AU.init();AU.setMute(false);FAIR.title();}
  if(wasNaming){AU.init();AU.setMute(false);FAIR.namingLoop();AU.paQuiet(AU.now(),.15);}
  return true;
}
// K.hubMusic, switched live: a Day screen already on the PA swaps rooms at once.
function hubMusicLabel(){ return K.hubMusic==='parade'?'PARADE BAND':'FIGHT TRACK ON THE PA'; }
function setHubMusic(v){
  K.hubMusic=v==='parade'?'parade':'pa';
  if(!AU.pa||AU.paUntil!==Infinity) return;
  if(K.hubMusic==='parade') AU.setPA(true,AU.now(),.3);
  else { AU.hubEnd(AU.now()); if(typeof applyTempo==='function') applyTempo(); AU.setPA(true,AU.now(),.3); }   // the loop on the PA leaves the band's 96 for the match's tempo
}
function setAudioMode(mode){
  if(mode==='muted'){
    PENDING_MUSIC_PROFILE=null;AUDIO_MODE='muted';AU.setMute(true);syncMusicModeUI();syncMusicProfileUI();return;
  }
  selectMusicProfile(mode);
}
function cycleAudioMode(){
  const i=AUDIO_MODE_ORDER.indexOf(AUDIO_MODE);
  setAudioMode(AUDIO_MODE_ORDER[(i+1)%AUDIO_MODE_ORDER.length]);
}
function syncMusicModeUI(){
  const b=$('btnMute');if(!b)return;
  const muted=AUDIO_MODE==='muted',label=muted?'MUTED':MUSIC_PROFILES[AUDIO_MODE].label;
  b.innerHTML=muted?'&#10005;':`&#9834;<small>${label[0]}</small>`;
  const pending=PENDING_MUSIC_PROFILE?' (next throw)':'';
  b.title='Music: '+label+pending;b.setAttribute('aria-label','Music: '+label+pending);b.style.opacity=muted?.5:1;
}
/* end of src/js/01-audio.js --- */
/* --- src/js/01b-fair-sound.js (copied whole by build-opener.mjs) --- */
/* ---------------- THE FAIR'S SOUND ---------------- */
/* The opener's sound, title to the first ROCK (plan: docs/plans/2026-10-20-opener-audio-plan.md; reference: sound mock 7,
   docs/work/mocks/opener-audio/sound.js). Synthesised on AU's own context and routed into AU.master, so AU.setMute and the
   compressor cover it; it never touches AU.loopBus. It has its own PA chain (high-pass, horn peak, soft breakup, slap),
   separate from AU's Day/Night PA.
   The band is the Moog bounce with no melody, at 96 BPM on the fight's chords (A minor, C, G, E minor, a bar each:
   AU.playStep), with a cup-muted trumpet now and then. The Climb cue is scheduled just in time from the film's own beat, so
   the sound follows the picture. The Naming has a piece of its own, clean in a hall (see the Naming below). Every entry point
   is a no-op when AU has no context. */
const FAIR=(()=>{
const BPM=96,B=60/BPM;
// the Climb film's beats (src/js/29e-climb.js: CLIMB.T). That file loads after this one, so these are only the fallback; the
// cue reads CLIMB.T when it is built (T())
const T0={PAN1:4.4,CLIMB0:5.9,WAKE:15.9,TOTAL:18.3};
let CHIME=[];   // set by readBeats()
let PAN1=T0.PAN1,CLIMB0=T0.CLIMB0,WAKE=T0.WAKE,TOTAL=T0.TOTAL;
function readBeats(){ let t=T0; try{ t=CLIMB.T||T0; }catch(e){}   // CLIMB is not declared yet when this file loads
  PAN1=t.PAN1||T0.PAN1; CLIMB0=t.CLIMB0||T0.CLIMB0; WAKE=t.WAKE||T0.WAKE; TOTAL=t.TOTAL||T0.TOTAL; CHIME=[[WAKE+1.35,76],[WAKE+1.95,72]]; }
readBeats();
const FAINT=.06,FAR=300;                 // the band's level and the PA's low-pass once you are up on the poster
const BG_OUT=.8,BG_IN=1.5;               // an Event card: the band goes far off as the card lands (0.82 s), back after it
const TITLE_FADE=B*4;                    // the title's band fades in over a bar after the touch (owner, 2026-10-21)
const TRUMPET_P=.37;                     // owner, mock 7: between now and then and often
const LOOK=.3;                           // scheduling lookahead, seconds
const mtof=m=>440*Math.pow(2,(m-69)/12);
let ac=null,out=null,noiseBuf=null,pa={},hallIn=null,duckG=null,bgOn=false;
const timers=new Set();   // every interval the Fair runs, so a new engine (music profile switch) can drop the old engine's at once
function every(fn,ms){ const id=setInterval(fn,ms); timers.add(id); return id; }
let crowd=null,band=null,bed=null,wind=null,cue=null,nm=null,fallO=null,hurryT=null;
let lastLick=-9,lickN=0;

/* ---- the engine: built once per AU context ---- */
function ready(){
  if(!AU.ok||!AU.ac||!AU.master) return false;
  if(ac===AU.ac) return true;
  try{
    timers.forEach(clearInterval); timers.clear(); clearTimeout(hurryT); hurryT=null;
    ac=AU.ac; crowd=band=bed=wind=cue=nm=fallO=null; state='off';   // a new engine (music profile switch) has a new context
    out=ac.createGain(); out.gain.value=.9*F.level; out.connect(AU.master);
    noiseBuf=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate);
    const d=noiseBuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    // the Fair's loudspeakers: a horn band, a little breakup, a slap off the pavilions; pa.lp closes as the camera leaves
    pa={}; pa.in=ac.createGain();
    const hp=biq('highpass',90,.7), pk=biq('peaking',1700,1.2); pk.gain.value=3;
    const sh=ac.createWaveShaper(), n=1024, c=new Float32Array(n), drive=2.2;
    for(let i=0;i<n;i++){ const x=i/(n-1)*2-1; c[i]=Math.tanh(drive*x)/Math.tanh(drive); }
    sh.curve=c;
    pa.lp=biq('lowpass',3200,.5);
    const dl=ac.createDelay(1), fb=ac.createGain(), wet=ac.createGain();
    dl.delayTime.value=.19; fb.gain.value=.28; wet.gain.value=.35;
    pa.out=ac.createGain();
    pa.in.connect(hp); hp.connect(pk); pk.connect(sh); sh.connect(pa.lp); pa.lp.connect(pa.out);
    pa.lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(pa.out);
    duckG=ac.createGain(); duckG.gain.value=bgOn?FAINT:1; pa.out.connect(duckG); duckG.connect(out);   // F.duck's and F.background's own gain, after the PA (only the band plays through it)
    // the hall up at the Unisphere (the Naming): a synthesised stereo tail of 4.2 s, decay power 2.6, dry 0.75 and wet 0.5, into
    // out and never through the PA. The decay is worked out every 64 samples and interpolated (Math.pow on every sample took
    // 30 ms on a laptop, on the first touch)
    { hallIn=ac.createGain();
      const cv=ac.createConvolver(), len=Math.round(ac.sampleRate*4.2), ir=ac.createBuffer(2,len,ac.sampleRate);
      for(let ch=0;ch<2;ch++){ const x=ir.getChannelData(ch);
        for(let i=0;i<len;i+=64){ const e0=Math.pow(1-i/len,2.6), e1=Math.pow(Math.max(0,1-(i+64)/len),2.6);
          for(let j=0,m=Math.min(64,len-i);j<m;j++) x[i+j]=(Math.random()*2-1)*(e0+(e1-e0)*j/64); } }
      cv.buffer=ir;
      const dry=ac.createGain(), hw=ac.createGain(); dry.gain.value=.75; hw.gain.value=.5;
      hallIn.connect(dry); dry.connect(out); hallIn.connect(cv); cv.connect(hw); hw.connect(out); }
    return true;
  }catch(e){ ac=null; return false; }
}

/* ---- voice helpers ---- */
function biq(type,f,q){ const b=ac.createBiquadFilter(); b.type=type; b.frequency.value=f; b.Q.value=q==null?.7:q; return b; }
function bus(dest){ const g=ac.createGain(); g.connect(dest||out); return g; }
function panTo(dest,p){ if(!p||!ac.createStereoPanner) return dest; const s=ac.createStereoPanner(); s.pan.value=p; s.connect(dest); return s; }
// one voice: o.a attack, o.r release (held) or a plain decay (hit); o.lp a low-pass, o.to a glide, o.vib [rate, depth], o.pan
function voice(type,f,t,dur,v,dest,o={},held){
  t=Math.max(t,ac.currentTime+.005);
  const osc=ac.createOscillator(), g=ac.createGain(); osc.type=type; osc.frequency.setValueAtTime(f,t);
  if(o.detune) osc.detune.value=o.detune;
  if(o.to) osc.frequency.exponentialRampToValueAtTime(o.to,t+(o.toT||dur));
  if(o.vib){ const l=ac.createOscillator(), lg=ac.createGain(); l.frequency.value=o.vib[0]; lg.gain.value=f*o.vib[1]; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t+dur+.3); }
  let head=osc; if(o.lp){ const fl=biq('lowpass',o.lp,o.q||.8); osc.connect(fl); head=fl;
    if(o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo,t+(o.lpT||dur)); }
  head.connect(g); g.connect(panTo(dest,o.pan));
  const a=o.a||.004;
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(v,.0002),t+a);
  if(held){ const r=o.r||.08; g.gain.setValueAtTime(Math.max(v,.0002),t+Math.max(a,dur-r)); }
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  osc.start(t); osc.stop(t+dur+.05);
  return osc;
}
const hit=(type,f,t,dur,v,dest,o)=>voice(type,f,t,dur,v,dest,o,false);
const held=(type,f,t,dur,v,dest,o)=>voice(type,f,t,dur,v,dest,o,true);
// filtered noise: o.type/f/q the filter, o.f2 a sweep, o.a attack, o.pan
function noise(t,dur,v,dest,o={}){
  t=Math.max(t,ac.currentTime+.005);
  const s=ac.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
  const fl=biq(o.type||'bandpass',o.f||1000,o.q==null?1:o.q), g=ac.createGain();
  if(o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2,t+dur);
  s.connect(fl); fl.connect(g); g.connect(panTo(dest,o.pan));
  const a=o.a||.003;
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(v,.0002),t+a);
  if(o.hold) g.gain.setValueAtTime(Math.max(v,.0002),t+Math.max(a,dur-(o.r||.1)));
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.start(t,Math.random()); s.stop(t+dur+.05);
}
// hold a param where it is at t (cancelAndHoldAtTime where there is one)
function holdAt(p,t){ if(p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value,t); } }
function fadeTo(p,v,t,secs,exp){ holdAt(p,t); if(exp) p.exponentialRampToValueAtTime(Math.max(v,.0001),t+secs); else p.linearRampToValueAtTime(v,t+secs); }
// a step loop on its own bus: fn(i,t,g) for every step from t0, scheduled LOOK ahead on a 25 ms tick.
// stop(t,fade) ends the steps at t (the tick keeps running until then) and ramps the bus shut.
function loop(step,t0,fn,dest,level=1){
  const o={g:bus(dest),i:0,end:Infinity};
  o.g.gain.value=level;
  const run=()=>{
    const lim=Math.min(ac.currentTime+LOOK,o.end);
    while(t0+o.i*step<lim){ const t=t0+o.i*step; if(t>ac.currentTime-.05) fn(o.i,t,o.g); o.i++; }
    if(ac.currentTime>=o.end){ clearInterval(o.timer); setTimeout(()=>o.g.disconnect(),(o.fade+1)*1000); }
  };
  o.timer=every(run,25); run();
  o.stop=(t,fade=.2)=>{ t=Math.max(t||0,ac.currentTime); o.end=t; o.fade=fade; fadeTo(o.g.gain,0,t,fade); };
  return o;
}

/* ---- percussion and hits ---- */
const kick=(t,v,g)=>hit('sine',140,t,.3,v,g,{to:42,toT:.2});
const snare=(t,v,g,pan)=>{ noise(t,.14,v,g,{type:'highpass',f:1500,q:.5,pan}); hit('triangle',190,t,.08,v*.6,g); };
const cym=(t,v,g,dur=1.4)=>noise(t,dur,v,g,{type:'highpass',f:5000,q:.4});
const timp=(t,f,v,g)=>{ hit('sine',f,t,1.4,v,g,{to:f*.82,toT:.5}); hit('sine',f*1.5,t,.5,v*.3,g); noise(t,.12,v*.4,g,{type:'lowpass',f:300}); };
function kachunk(t,g,v=1){ hit('sine',90,t,.26,.8*v,g,{to:38,toT:.2}); noise(t,.09,.4*v,g,{f:1200,q:.8}); hit('square',110,t+.01,.09,.08*v,g); hit('triangle',1760,t+.04,.05,.05*v,g); }
function whoosh(t,dur,v,g){ noise(t,dur,v,g,{f:400,f2:5000,q:1.4,a:dur*.9,r:.05}); }

/* ---- the crowd: low babble (formant syllables), a wandering bed, the odd cheer ---- */
function crowdStart(level,t0){
  const g=bus(); g.gain.value=.0001; g.gain.exponentialRampToValueAtTime(level,t0+1.5);
  const far=biq('lowpass',1800,.5); far.connect(g);
  const srcs=[];
  const bands=[[380,.8,.5],[900,1.1,.32],[2100,1.4,.1]].map(([f,q,v])=>{
    const s=ac.createBufferSource(); s.buffer=noiseBuf; s.loop=true; const bp=biq('bandpass',f,q), a=ac.createGain();
    a.gain.value=v; a.base=v; s.connect(bp); bp.connect(a); a.connect(far); s.start(0,Math.random()); srcs.push(s); return a; });
  const syl=()=>{   // one far-off syllable: a buzzy voice through two formants
    const t=ac.currentTime+.02+Math.random()*.06, f0=95+Math.random()*150, d=.08+Math.random()*.16;
    const o=ac.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(f0,t); o.frequency.linearRampToValueAtTime(f0*(.88+Math.random()*.24),t+d);
    const f1=biq('bandpass',300+Math.random()*500,5), f2=biq('bandpass',900+Math.random()*1300,7), gg=ac.createGain();
    o.connect(f1); o.connect(f2); f1.connect(gg); f2.connect(gg); gg.connect(panTo(far,Math.random()*1.6-.8));
    gg.gain.setValueAtTime(.0001,t); gg.gain.exponentialRampToValueAtTime(.05,t+.02); gg.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.start(t); o.stop(t+d+.02); };
  const c={g,end:Infinity};
  c.timer=every(()=>{
    const t=ac.currentTime;
    if(t>=c.end){ clearInterval(c.timer); return; }
    if(ac.state!=='running') return;   // a stopped clock: nothing piles up to burst out on resume
    bands.forEach(b=>b.gain.setTargetAtTime(b.base*(.55+Math.random()*.9),t,.2));
    for(let k=0;k<2;k++) if(Math.random()<.55) syl();
    if(Math.random()<.012) noise(t,2.2,.18,far,{f:1100,q:.6,a:.7});   // a cheer somewhere down the avenue
  },90);
  c.to=(v,t,secs)=>fadeTo(g.gain,v,t,secs,true);
  c.stop=(t,fade)=>{ t=Math.max(t||0,ac.currentTime); c.end=t; fadeTo(g.gain,.0001,t,fade,true);
    srcs.forEach(s=>{ try{ s.stop(t+fade+.05); }catch(e){} }); setTimeout(()=>g.disconnect(),(t-ac.currentTime+fade+1)*1000); };
  return c;
}

/* ---- the parade's band: the Moog bounce, no melody, on the fight's chords (bar index mod 4 = AU.playStep's bar) ---- */
const PROG=[[45,[57,60,64]],[48,[55,60,64]],[43,[55,59,62]],[40,[55,59,64]]];   // bass root, chord
function boing(t,g){ hit('sine',900,t,.28,.07,g,{to:180,toT:.25}); }
// the kit: one 16-step string per voice, x on the steps it plays
const DR={k:(t,g)=>kick(t,.55,g), c:(t,g)=>noise(t,.12,.1,g,{f:1400,q:.9}),
  h:(t,g)=>noise(t,.03,.028,g,{type:'highpass',f:7000}), o:(t,g)=>noise(t,.22,.035,g,{type:'highpass',f:6000}),
  g:(t,g)=>kick(t,.25,g)};   // g: a ghost kick
const KIT={k:'x.....x.x.......',g:'..........x.....',c:'....x.......x...',h:'x.x.x.x.x.x.x.x.',o:'..............x.'};
const sub=(t,root,d,g)=>hit('sine',mtof(root),t,d,.32,g,{lp:300});            // the low end the PA would cut
const octBass=(s,t,root,g,v=.1)=>{ if(s%2===0) hit('square',mtof(root+12+(s%4?12:0)),t,.1,v,g,{lp:700}); };
// the trumpeter: a short lick on the bar's own chord, at random, never two bars running; cup-muted (a nasal band, a duller
// top, less level)
function trumpet(t,m,d,g){ const f=mtof(m), mute=biq('bandpass',1300,2.2), mg=ac.createGain(); mg.gain.value=2.2; mute.connect(mg); mg.connect(g);
  for(const dt of [-6,6]) held('sawtooth',f,t,d*.92,.028,mute,{detune:dt,lp:500,lpTo:1900,lpT:.06,a:.03,r:.07,vib:[5.5,.006]});
  hit('sawtooth',f*.94,t,.06,.014,mute,{to:f}); }   // the scoop up into the note
const LICKS=[
  [[[0,69,.5],[.5,72,.5],[1,76,1.5]],[[0,76,.75],[.75,72,.25],[1,69,2]]],                  // A minor
  [[[0,67,.5],[.5,72,.5],[1,76,.5],[1.5,79,1.5]],[[2,72,.5],[2.5,76,.5],[3,79,1]]],        // C
  [[[0,74,.5],[.5,71,.5],[1,67,2]],[[2,79,.5],[2.5,74,.5],[3,71,1]]],                      // G
  [[[0,76,.5],[.5,79,.5],[1,83,2]],[[0,76,1],[1,75,1],[2,74,2]]]];                         // E minor (and a wah-wah fall)
function trumpetLick(t,bar,spb,g){
  lickN++; if(lickN-lastLick<2||Math.random()>=TRUMPET_P) return; lastLick=lickN;
  const L=LICKS[bar%4][Math.floor(Math.random()*2)];
  for(const [b,m,l] of L) trumpet(t+b*spb,m,l*spb,g);
}
// the band from audio time t0 at `bpm`, its first bar being bar index `bar0` (chord = bar0 % 4); through the PA
function bandStart(t0,bpm,bar0){
  const spb=60/bpm;
  return Object.assign(loop(spb/4,t0,(i,t,g)=>{
    const s=i%16, bar=bar0+Math.floor(i/16), [root,ch]=PROG[bar%4];
    if(s===0) trumpetLick(t,bar,spb,g);
    for(const k in KIT) if(KIT[k][s]==='x') DR[k](t,g);
    octBass(s,t,root,g,.13); if(s===0||s===8) sub(t,root,.45,g);
    if(s===6||s===14) ch.forEach(n=>hit('square',mtof(n),t,.07,.014,g,{lp:1800}));   // soft chord blips
    if(s===12&&bar%2===1) boing(t,g);
  },pa.in,1),{t0,bar0});
}

/* ---- the wind up there (owner, mock 7: "a feeling of height"): a low rush, a moan, a thin whistle, each wandering on its
   own; it rises over the climb and blows on under the poster ---- */
function windStart(t0,rise){
  t0=Math.max(t0,ac.currentTime);
  const g=bus(), srcs=[]; g.gain.setValueAtTime(.0001,t0); g.gain.exponentialRampToValueAtTime(1,t0+rise);
  const mk=(type,f,q,v,p)=>{ const s=ac.createBufferSource(); s.buffer=noiseBuf; s.loop=true; const fl=biq(type,f,q), a=ac.createGain();
    a.gain.value=v; s.connect(fl); fl.connect(a); a.connect(panTo(g,p)); s.start(0,Math.random()); srcs.push(s); return {fl,a,v,f}; };
  const bands=[mk('lowpass',420,.7,.05,-.3),mk('bandpass',950,4,.022,.4),mk('bandpass',1750,9,.007,-.6)];
  const w={g,end:Infinity};
  w.timer=every(()=>{ const t=ac.currentTime;
    if(t>=w.end){ clearInterval(w.timer); return; }
    if(ac.state!=='running') return;
    bands.forEach(b=>{ b.a.gain.setTargetAtTime(b.v*(.35+Math.random()*1.3),t,.7); b.fl.frequency.setTargetAtTime(b.f*(.8+Math.random()*.45),t,.9); }); },800);
  w.stop=(t,fade=.05)=>{ t=Math.max(t||0,ac.currentTime); w.end=t; fadeTo(g.gain,0,t,fade);
    srcs.forEach(s=>{ try{ s.stop(t+fade+.05); }catch(e){} }); setTimeout(()=>g.disconnect(),(t-ac.currentTime+fade+1)*1000); };
  return w;
}

/* ---- the chimes: "attention, please", the Fair's two-tone chime as the poster arrives, on a loudspeaker of its own ---- */
function chimeHorn(g){ const horn=biq('bandpass',1400,.7); horn.connect(g); return horn; }
function chimeTone(t,m,horn){ hit('sine',mtof(m),t,1.6,.5,horn); hit('sine',mtof(m)*2.76,t,.4,.08,horn); hit('sine',mtof(m)*2,t,.9,.15,horn); }

/* ---- the living poster: his boiler every two beats, the needle's tick, stars as glass bells ---- */
function bedStart(t0){
  return loop(B/2,t0,(i,t,g)=>{
    if(i%4===0) hit('sine',66,t,.28,.1,g,{to:44,lp:300});
    if(Math.random()<.08) hit('square',2200+Math.random()*400,t,.02,.006,g);
    if(Math.random()<.07) hit('sine',[1760,2093,2637,3136][Math.floor(Math.random()*4)],t,1.2,.012,g,{pan:Math.random()*1.4-.7});
  });
}

/* ---- the Climb cue: events on the film's beats ---- */
// [beat, fn(t, cueBus), must]: t is the audio time of that beat. A `must` event (a ramp, the wind, the bed) still fires if
// the film is already past it; the rest are dropped when more than half a beat late.
function climbEvents(F,horn){
  const E=[], ev=(b,fn,must)=>E.push({b,fn,must});
  const at=(t,b0,b)=>t+(b-b0)*B;
  // the parade falls away below you, the whole way up: the loudspeakers close and the band thins; it never stops
  ev(.4,t=>{ const lp=pa.lp.frequency, mg=band&&band.g.gain, e=at(t,.4,CLIMB0);
    holdAt(lp,t); lp.setValueAtTime(3200,t); lp.exponentialRampToValueAtTime(1500,e);
    if(mg){ holdAt(mg,t); mg.setValueAtTime(1,t); mg.linearRampToValueAtTime(.6,e); }
    if(crowd){ crowd.to(.05,t,2*B); } },true);
  ev(CLIMB0,t=>{ const lp=pa.lp.frequency, mg=band&&band.g.gain, e=at(t,CLIMB0,WAKE);
    holdAt(lp,t); lp.exponentialRampToValueAtTime(FAR,e);
    if(mg){ holdAt(mg,t); mg.linearRampToValueAtTime(FAINT,e); }
    if(crowd) crowd.to(.03,t,1.5*B);
    if(!wind) wind=windStart(t,10*B); },true);       // the wind rises with you and stays up on the poster
  ev(CLIMB0+1.5,t=>{ if(crowd) crowd.to(.008,t,8.5*B); },true);
  // the CCTV ring turns to follow you
  [[-2.4,-.6],[-1.7,.6],[-1.0,-.3]].forEach(([d,p])=>ev(F+d,(t,g)=>hit('square',260,t,.3,.045,g,{to:390,lp:1100,q:4,pan:p})));
  ev(PAN1,(t,g)=>timp(t,49,.25,g));
  // the searchlight is a breaker and a hum
  ev(F,(t,g)=>{ kachunk(t,g,1.2); held('sawtooth',60,t,1.6*B,.05,g,{lp:320,a:.02,r:.6}); held('sawtooth',120,t,1.6*B,.02,g,{lp:500,r:.6}); cym(t,.05,g,1.6); });
  // his boiler builds
  [11.9,12.9,13.6,14.2,14.7,15.1,15.4,15.65].forEach((b,k)=>ev(b,(t,g)=>hit('sine',62,t,.3,.14+k*.04,g,{to:40,lp:400})));
  // he wakes: the valve, the sideways knock, the needle into the red, four puffs from his stacks
  ev(WAKE,(t,g)=>{
    kachunk(t,g); hit('sine',70,t+.05,.35,.5,g,{to:40});
    hit('sine',420,t,.2,.05,g,{to:1400}); held('square',1400,t+.2,B*.9,.025,g,{lp:2400,vib:[18,.02],r:.2});
    hit('sine',1400,t+.2+B*.9,.3,.03,g,{to:500});
    [0,.12,.26,.42].forEach((d,k)=>noise(t+d,.55,.09,g,{type:'highpass',f:2600,q:.4,pan:k%2?.5:-.5}));
    noise(t+.5,1.3*B,.02,g,{type:'highpass',f:3200,q:.3,hold:true,r:.5}); });
  CHIME.forEach(([b,m])=>ev(b,t=>chimeTone(t,m,horn)));
  ev(TOTAL,t=>{ if(state==='climb'){ bed=bedStart(t); state='poster'; } },true);
  return E.sort((a,b)=>a.b-b.b);
}

/* ---- the Naming (plan: docs/plans/2026-10-21-naming-music-plan.md; reference: the ear-test mock's sketch A, the orrery organ,
   docs/work/mocks/naming-music/naming-music.html): organ chords with a slow rotary wobble, a pedal under them and glassy
   arpeggios high above, clean in the hall. A cue on the film's beats (29f-naming.js NAMING.T), then a loop of 8 bars on the
   fight's chords from the film's beat 8, for as long as the naming takes ---- */
const DRAW=[[1,1],[2,.55],[3,.3],[4,.25],[6,.1],[8,.06]];   // drawbars 8', 4', 2 2/3', 2', 1 1/3', 1'
function organ(t,ms,dur,v,dest,a=.18){ for(const m of ms) for(const [h,w] of DRAW) held('sine',mtof(m)*h,t,dur,v*w,dest,{a,r:.7}); }
function pedal(t,root,dur,v,g){ held('sine',mtof(root-12),t,dur,v,g,{a:.25,r:.6}); held('sine',mtof(root),t,dur,v*.35,g,{a:.25,r:.6}); }
function glass(t,m,v,g,pan){ const f=mtof(m); hit('triangle',f,t,.8,v,g,{pan}); hit('sine',f*2,t,.35,v*.45,g,{pan}); }
function bell(t,m,v,g,pan){ const f=mtof(m); hit('sine',f,t,2.2,v,g,{pan}); hit('sine',f*2.76,t,.9,v*.3,g,{pan}); hit('sine',f*5.4,t,.4,v*.12,g,{pan}); }
const LOOP_AT=8, CUE_END=5.25;   // the loop's first bar, on the film's beats (the film is 6.5, the card up at 6.25); the cue's last
// the cue: [beat, fn(t, bus), must] as the Climb's. The ring's organ and pedal play into n.hold / n.holdP, which give way where
// the loop starts (they are held to the film's beat 8, so only a hurried film leaves them sounding there)
function namingEvents(n){
  const E=[], ev=(b,fn,must)=>E.push({b,fn,must});
  for(let i=0;i<10;i++) ev(.25+i*.11,(t,g)=>timp(t,55,.05+i*.028,g));                                    // he turns to stone: a roll
  [69,71,72,74,76,77,79,81,83,84,86,88,89,91,93].forEach((m,i)=>ev(.75+i*.24,(t,g)=>glass(t,m,.016+i*.001,g,i%2?.5:-.5)));   // the camera rises
  ev(1.5,t=>{ organ(t,[57,60,64],6.5*B,.02,n.hold,1.4); pedal(t,45,6.5*B,.08,n.holdP); },true);            // the ring tips: A minor swells in
  ev(3,(t,g)=>noise(t,2.25*B,.03,g,{type:'highpass',f:5000,q:.4,a:2.2*B}));                               // Earth to the lens: a cymbal swell
  ev(CUE_END,(t,g)=>{ timp(t,55,.28,g); [81,84,88].forEach((m,i)=>glass(t+i*.03,m,.03,g,(i-1)*.5)); });   // the card
  return E.sort((a,b)=>a.b-b.b);
}
// loop bar k (0 at the grid): a chord a bar, PROG[k % 4]; the arpeggio in eighths for four bars, then in sixteenths for four.
// A bar scheduled late (the main thread stalled over its start) holds its chord from now and drops the notes already past.
function namingBar(k,t,n){
  const c=k%4, [root,ch]=PROG[c], g=n.g, T=[ch[0]+12,ch[1]+12,ch[2]+12,ch[0]+24,ch[1]+24,ch[2]+24];
  const now=ac.currentTime, t1=Math.max(t,now+.005), d=t1-t, ahead=x=>x>now-.02;
  organ(t1,ch,4*B+.05-d,.02,n.ob); pedal(t1,root,4*B-d,.085,g);
  if(Math.floor(k/4)%2===0) [0,1,2,3,2,1,0,1].forEach((j,i)=>{ const x=t+i*B/2; if(ahead(x)) glass(x,T[j],.02,g,i%2?.45:-.45); });
  else [0,1,2,3,4,5,4,3,2,3,4,5,4,3,2,1].forEach((j,i)=>{ const x=t+i*B/4; if(ahead(x)) glass(x,T[j],.013,g,i%2?.6:-.6); });
  if(c===3) timp(t+3*B,mtof(root),.1,g);
}
// the Naming from now, on its own bus into the hall. beatFn() is the film's beat, or null (no film: the loop at once). Each
// 25 ms tick schedules the cue's events in the next 0.3 s from the film's beat, then fixes the loop's bar grid on the audio
// clock: at the film's beat 8, or on the next beat when the film was hurried past the cue (x7, a seek) or is already past 8
function namingStart(beatFn){
  const now=ac.currentTime, g=bus(hallIn), ob=ac.createGain(), lfo=ac.createOscillator(), lg=ac.createGain();
  // the organ's bus: a slow rotary wobble, its level (0.85, +-0.15) and its pan (+-0.35) at 0.8 Hz
  ob.gain.value=.85; lfo.frequency.value=.8; lg.gain.value=.15; lfo.connect(lg); lg.connect(ob.gain);
  if(ac.createStereoPanner){ const p=ac.createStereoPanner(), pg=ac.createGain(); pg.gain.value=.35; lfo.connect(pg); pg.connect(p.pan); ob.connect(p); p.connect(g); }
  else ob.connect(g);
  lfo.start(now);
  const n={g,ob,hold:bus(ob),holdP:bus(g),grid:null,k:0,i:0,b0:null,t0:0,p:2,end:Infinity}, E=namingEvents(n);
  const nextBeat=(t,b)=>t+(Math.floor(b)+1-b)*B;
  const start=t=>{ n.grid=t; n.i=E.length; fadeTo(n.hold.gain,0,t,.4); fadeTo(n.holdP.gain,0,t,.4); };
  // the grid from the film's beat b at audio time t, as the tick would fix it
  const due=(t,b)=>b==null?t+.1:b>LOOP_AT?nextBeat(t,b):t+(LOOP_AT-b)*B;
  n.tick=()=>{
    const now=ac.currentTime;
    if(now>=n.end){ clearInterval(n.timer); return; }
    if(ac.state!=='running') return;   // a stopped clock: nothing piles up; the late-event skip drops what the film passed meanwhile
    if(n.grid==null){
      const b=beatFn?beatFn():null;
      if(b==null||b>LOOP_AT) start(due(now,b));
      else {
        if(n.b0==null){ n.b0=b; n.t0=now; }
        while(n.i<E.length&&E[n.i].b<=b+LOOK/B){
          const e=E[n.i++];
          if(e.b<b-.5&&!e.must) continue;
          e.fn(Math.max(now,now+(e.b-b)*B),g);
        }
        // hurried: the film is half a beat ahead of the audio clock since the cue began
        if(b>=CUE_END&&b-n.b0>(now-n.t0)/B+.5) start(nextBeat(now,b));
        else if(b+LOOK/B>=LOOP_AT) start(due(now,b));
      }
    }
    if(n.grid!=null) for(let t;(t=n.grid+n.k*4*B)<now+LOOK;n.k++) if(t>now-B) namingBar(n.k,t,n);   // up to a beat late
  };
  // the chord at audio time t (the cue's is A minor), and the bar the band joins on at t: [its start, its bar index]
  n.chord=t=>n.grid==null||t<n.grid?0:Math.floor((t-n.grid)/(4*B))%4;
  n.barAt=t=>{
    if(n.grid==null) start(due(t,beatFn?beatFn():null));
    if(t<n.grid) return [n.grid,0];
    const k=Math.floor((t-n.grid)/(4*B)); return [n.grid+k*4*B,k%4];
  };
  n.to=(v,t,secs)=>fadeTo(g.gain,v,t,secs);
  n.stop=(t,fade)=>{ t=Math.max(t||0,ac.currentTime); n.end=t; fadeTo(g.gain,0,t,fade);
    try{ lfo.stop(t+fade+.1); }catch(e){} setTimeout(()=>g.disconnect(),(t-ac.currentTime+fade+1)*1000); };
  n.timer=every(n.tick,25); n.tick();
  return n;
}

/* ---- the fall (descent-sound, owner 2026-10-21: "needs to feel real"): the walk's drop down the column after the Naming. The
   wind rushes and whistles with the camera's speed, and the parade below comes up as the camera comes down, as sound does over
   distance: its level 1 / (1 + 15.7 h) for height h (the poster's 0.06 at the top, most of the rise near the ground), the PA's
   low-pass opening from far off (300 Hz) to the ground's (3200), the crowd with it. The Naming's organ, up at the Unisphere,
   recedes the same way. Values are placeholders until the phone ear test. ---- */
const NEAR=15.7, near=h=>1/(1+NEAR*Math.max(0,Math.min(1,h)));   // 1 / NEAR + 1 = the band's level at the top, FAINT
const VDROP=1;   // the unhurried drop's top speed, in heights a second (about 1.2 s for the whole drop, eased at its ends)
// the wind of the fall: a rush, a body and a whistle, all filtered noise; set(s) by the camera's speed s (0, 1 the unhurried drop)
function fallWind(){
  const t0=ac.currentTime, g=bus(), srcs=[];
  const mk=(type,f,q,p)=>{ const s=ac.createBufferSource(); s.buffer=noiseBuf; s.loop=true; const fl=biq(type,f,q), a=ac.createGain(); a.gain.value=0;
    s.connect(fl); fl.connect(a); a.connect(panTo(g,p)); s.start(t0,Math.random()*1.5); srcs.push(s); return {fl,a}; };
  const rush=mk('lowpass',500,.7,-.25), body=mk('bandpass',320,1.4,.3), whistle=mk('bandpass',900,11,.4);
  let last=0;
  return {
    set(s,t){ const w=s*s, j=.8+Math.random()*.4, k=s>last?.06:.22; last=s;   // quick to rise, a tail as it eases off; a gust's jitter
      rush.a.gain.setTargetAtTime(.16*w*j,t,k); rush.fl.frequency.setTargetAtTime(450+1600*s,t,.08);
      body.a.gain.setTargetAtTime(.1*w,t,k); body.fl.frequency.setTargetAtTime(280+220*s,t,.1);
      whistle.a.gain.setTargetAtTime(.22*w*(.7+Math.random()*.6),t,k); whistle.fl.frequency.setTargetAtTime(760+1100*s,t,.07); },
    get level(){ return rush.a.gain.value; },
    stop(t,fade){ t=Math.max(t||0,ac.currentTime); fadeTo(g.gain,0,t,fade);
      srcs.forEach(s=>{ try{ s.stop(t+fade+.05); }catch(e){} }); setTimeout(()=>g.disconnect(),(t-ac.currentTime+fade+1)*1000); }
  };
}
// follow the walk's camera: fall() its height (1 the Naming's, 0 the column's foot) or null when the walk is over. Each 25 ms
// tick sets the band, the PA, the crowd, the Naming and the wind from where the camera is now, so the sound follows the
// picture through a hurried walk (x7) and reduced motion's cuts (a jump, no wind).
function fallStart(fall){
  const o={wind:fallWind(),hist:[]};
  const set=(p,v,t,k)=>p.setTargetAtTime(v,t,k);
  const at=(h,s,t,k)=>{
    if(band) set(band.g.gain,near(h),t,k);
    set(pa.lp.frequency,3200*Math.pow(FAR/3200,Math.max(0,Math.min(1,h))),t,k);
    if(crowd) set(crowd.g.gain,Math.max(.0001,.06*near(h)),t,k);
    if(nm) set(nm.g.gain,Math.max(0,(near(1-h)-near(1))/(1-near(1))),t,k);
    o.wind.set(s,t);
  };
  o.end=(t,fade)=>{ clearInterval(o.timer); o.wind.stop(t,fade); };
  o.timer=every(()=>{
    const now=ac.currentTime;
    if(ac.state!=='running') return;
    const h=fall();
    if(h==null){ at(0,0,now,.1); o.end(now+.8,.4); if(fallO===o) fallO=null; return; }   // the walk is over: the ground's sound
    // the speed over the last ~80 ms (frames and ticks do not line up); a jump of half the column in a tick is a cut, not a fall
    const H=o.hist; if(H.length&&Math.abs(H[H.length-1][1]-h)>.5) H.length=0;
    H.push([now,h]); while(H.length>2&&now-H[1][0]>=.08) H.shift();
    const [t0,h0]=H[0], s=now-t0>.02?Math.min(1.5,Math.max(0,(h0-h)/(now-t0))/VDROP):0;
    at(h,s,now,.05);
  },25);
  return o;
}

/* ---- state ---- */
let state='off';
function ensureBase(){   // the crowd and the band, if the title did not start them
  const now=ac.currentTime;
  if(!crowd) crowd=crowdStart(.06,now);
  if(!band){ pa.lp.frequency.cancelScheduledValues(now); pa.lp.frequency.setValueAtTime(3200,now); band=bandStart(now+.1,BPM,0); }
}
// silence everything at audio time t over `fade`
function killAll(t,fade){
  t=Math.max(t||0,ac.currentTime);
  clearTimeout(hurryT); hurryT=null;
  if(cue){ cue.stop(t,fade); cue=null; }
  if(nm){ nm.stop(t,fade); nm=null; }
  if(fallO){ fallO.end(t,fade); fallO=null; }
  if(band){ band.stop(t,fade); band=null; }
  if(bed){ bed.stop(t,fade); bed=null; }
  if(wind){ wind.stop(t,fade); wind=null; }
  if(crowd){ crowd.stop(t,fade); crowd=null; }
  const lp=pa.lp.frequency; lp.cancelScheduledValues(t+fade+.02); lp.setValueAtTime(3200,t+fade+.03);
  state='off';
}

const F={
  get state(){ return state; },
  bpm:BPM,   // the band's own tempo; between fights AU runs at it too (AU.hubBand)
  // the title: the crowd and the band. Idempotent.
  title(){
    if(!ready()||state==='title') return;
    if(state!=='off') killAll(ac.currentTime,.05);
    ac.resume&&ac.state==='suspended'&&ac.resume().catch(()=>{});
    const now=ac.currentTime;
    pa.lp.frequency.cancelScheduledValues(now); pa.lp.frequency.setValueAtTime(3200,now);
    crowd=crowdStart(.06,now); band=bandStart(now+.1,BPM,0);
    const bg=band.g.gain; bg.setValueAtTime(0,now); bg.linearRampToValueAtTime(1,now+TITLE_FADE);
    state='title';
  },
  stop(fade){ if(!ready()) return; killAll(ac.currentTime,fade==null?.4:fade); },
  // The Climb. beatFn() is the film's current beat (0 = the NEW GAME tap, 96 BPM, TOTAL = 18.3 the landing) or null while it
  // is not playing; flashBeat the beat the searchlight flashes. Each 25 ms tick schedules the events whose beat falls in the
  // next 0.3 s, so the sound follows the picture.
  climb(beatFn,flashBeat){
    if(!ready()) return;
    readBeats();
    if(cue){ cue.stop(ac.currentTime,.05); cue=null; }
    if(state==='title'||state==='climb') {} else { killAll(ac.currentTime,.05); }
    ensureBase();
    const g=bus(), horn=chimeHorn(g), E=climbEvents(flashBeat>0&&flashBeat<50?flashBeat:9.4,horn);
    const c=cue={g,end:Infinity,i:0};
    c.stop=(t,fade)=>{ c.end=t; fadeTo(g.gain,0,t,fade); setTimeout(()=>g.disconnect(),(t-ac.currentTime+fade+3)*1000); };
    state='climb';
    c.timer=every(()=>{
      const now=ac.currentTime;
      if(now>=c.end||c.i>=E.length){ clearInterval(c.timer); return; }
      if(ac.state!=='running') return;   // c.i stays put; the late-event skip drops what the film passed meanwhile
      const b=beatFn&&beatFn();
      if(b==null) return;
      while(c.i<E.length&&E[c.i].b<=b+LOOK/B){
        const e=E[c.i++];
        if(e.b<b-.5&&!e.must) continue;
        const t=Math.max(now,now+(e.b-b)*B);
        if(t>=c.end) continue;
        e.fn(t,g);
      }
    },25);
  },
  // a hurried Climb (x7): the cue is dropped and whooshes to the chime, which lands at audio time landAt
  hurry(landAt){
    if(!ready()||state!=='climb') return;
    const now=ac.currentTime, Lt=Math.max(landAt||0,now+.2);
    if(cue){ cue.stop(now,.12); cue=null; }
    if(bed){ bed.stop(now,.01); bed=null; }
    if(band){ const mg=band.g.gain, lp=pa.lp.frequency; holdAt(mg,now); holdAt(lp,now); mg.linearRampToValueAtTime(FAINT,Lt); lp.exponentialRampToValueAtTime(FAR,Lt); }
    if(crowd) crowd.to(.008,now,Lt-now);
    if(!wind) wind=windStart(now,Lt-now+.1); else { const wg=wind.g.gain; holdAt(wg,now); wg.setValueAtTime(Math.max(wg.value,.0001),now); wg.exponentialRampToValueAtTime(1,Lt); }
    const g=bus(); whoosh(now,Lt-now,.05,g);
    const horn=chimeHorn(g); CHIME.forEach(([b,m])=>chimeTone(Lt+(b-TOTAL)*B,m,horn));
    bed=bedStart(Lt);
    clearTimeout(hurryT); hurryT=setTimeout(()=>{ hurryT=null; if(state==='climb') state='poster'; },(Lt-now)*1000);
  },
  // straight to the poster bed (reduced motion, CLIMB OFF, a film that will not play)
  land(){
    if(!ready()) return;
    if(state==='poster') return;
    if(cue){ cue.stop(ac.currentTime,.05); cue=null; }
    if(bed){ bed.stop(ac.currentTime,.05); bed=null; }
    clearTimeout(hurryT); hurryT=null;
    ensureBase();
    const now=ac.currentTime, mg=band.g.gain, lp=pa.lp.frequency;
    holdAt(mg,now); mg.setValueAtTime(FAINT,now); holdAt(lp,now); lp.setValueAtTime(FAR,now);
    crowd.to(.008,now,.3);
    if(!wind) wind=windStart(now,.3);
    bed=bedStart(now+.05);
    state='poster';
  },
  // The walk down to the Sponsor kiosk (owner, 2026-10-21): the crowd and the band come back in from silence over `secs` as
  // the camera drops down the column, the PA opening from far off to the ground's, and play on under the sponsor pick and its
  // contract; the ceremony stops them (22-ceremony.js cerBand). From the Naming it is a cross-fade: the band joins on the
  // Naming's bar grid (its first bar the bar playing, its bar index the Naming's chord, so the two line up while they cross)
  // and the Naming fades out over `secs`, its scheduler running on silent for BACK (namingBack). With fall() (the walk's
  // camera height, NAMING.fall) the levels follow the camera down instead and the wind blows on the drop (the fall, above).
  // Idempotent; the hub's band ('parade') already playing is kept.
  sponsor(secs,fall){
    if(!ready()||state==='sponsor'||state==='hub') return;
    const cross=state==='naming'&&!!nm;
    if(state!=='off'&&!cross) killAll(ac.currentTime,.05);
    ac.resume&&ac.state==='suspended'&&ac.resume().catch(()=>{});
    const now=ac.currentTime, s=Math.max(.3,secs||1), lp=pa.lp.frequency;
    holdAt(lp,now); lp.setValueAtTime(FAR,now); if(!fall) lp.exponentialRampToValueAtTime(3200,now+s);
    crowd=crowdStart(.06,now+Math.max(0,s-1.5));
    if(cross){ const [t0,bar]=nm.barAt(now); band=bandStart(t0,BPM,bar); }
    else band=bandStart(now+.1,BPM,0);
    const bg=band.g.gain; bg.setValueAtTime(0,now);
    if(fall){ const cg=crowd.g.gain; cg.cancelScheduledValues(now); cg.setValueAtTime(.0001,now);
      if(nm) holdAt(nm.g.gain,now);
      fallO=fallStart(fall); }
    else { bg.linearRampToValueAtTime(1,now+s); if(cross) nm.to(0,now,s); }
    state='sponsor';
  },
  // The Naming (naming-music plan): the cue on the film's beats, beatFn() as for the Climb (0 = the receipt's tap, 96 BPM;
  // null when there is no film), then the loop from the film's beat 8. Whatever played before stops.
  naming(beatFn){
    if(!ready()) return;
    if(state!=='off') killAll(ac.currentTime,.05);
    ac.resume&&ac.state==='suspended'&&ac.resume().catch(()=>{});
    nm=namingStart(beatFn||null); state='naming';
  },
  // the loop alone, the organ at once (reduced motion, the Naming switched off, the straight cut). Idempotent.
  namingLoop(){ if(!ready()||state==='naming') return; F.naming(null); },
  // ◀ ▶ or a tap on the orrery: a soft bell, one of the three notes of the chord playing now, two octaves up, picked by the
  // planet's index i (or by counting the turns from Earth when there is none), panned by dir
  namingTurn(dir,i){
    if(!ready()||state!=='naming'||!nm) return;
    const t=ac.currentTime+.01, d=dir>0?1:dir<0?-1:0, ch=PROG[nm.chord(t)][1];
    nm.p=i==null?nm.p+d:i|0;
    bell(t,ch[(nm.p%3+3)%3]+24,.05,nm.g,d*.3);
  },
  // BACK from the sponsor letters to the identity step: the band and the crowd fade out over `secs` and the Naming fades back
  // in. With no Naming to come back to (a music profile switch on the letters) its loop starts, fading in.
  namingBack(secs){
    if(!ready()||state==='naming') return;
    const now=ac.currentTime, s=Math.max(.05,secs||1.2);
    if(fallO){ fallO.end(now,.2); fallO=null; }
    if(state==='sponsor'&&nm){
      if(band){ band.stop(now,s); band=null; }
      if(crowd){ crowd.stop(now,s); crowd=null; }
      nm.to(1,now,s); state='naming';
      return;
    }
    if(state!=='off') killAll(now,s);
    F.naming(null); const g=nm.g.gain; g.setValueAtTime(0,now); g.linearRampToValueAtTime(1,now+s);
  },
  // checks and the bench: the Naming's and the band's bus levels now, the Naming's bar grid, the band's start and first bar
  get levels(){ return {naming:nm?nm.g.gain.value:0,band:band?band.g.gain.value:0,grid:nm?nm.grid:null,bandT0:band?band.t0:null,bandBar:band?band.bar0:null,
    wind:fallO?fallO.wind.level:0,lp:pa.lp?pa.lp.frequency.value:0,crowd:crowd?crowd.g.gain.value:0,duck:duckG?duckG.gain.value:1,bg:bgOn}; },
  // A dip under something the player watches, called by AU.duck while the band is the hub's music (ipad-mini fix, owner
  // 2026-11-07: the band drops low while an Event film plays): an Event film's cues (one every four beats, at the film's own
  // duckLvl), the Bounty's choir. Down to 1 - amt over 50 ms, held `ms`, back up over 0.4 s; a cue inside the hold keeps it
  // down. Its own gain after the PA, so hubThin's and hubFar's levels are left alone. Under an Event card the band is
  // already far off (F.background), so the dips are skipped: they would pump it and bring it back to full.
  duck(t,amt,ms){
    if(!ready()||!duckG||bgOn) return;
    t=Math.max(t||0,ac.currentTime);
    const g=duckG.gain, lo=Math.max(0,Math.min(1,1-(+amt||0))), end=t+Math.max(.05,(+ms||0)/1000);
    holdAt(g,t); g.linearRampToValueAtTime(lo,t+.05); g.setValueAtTime(lo,end); g.linearRampToValueAtTime(1,end+.4);
  },
  // An Event card (parade-fade fix, owner 2026-11-07: "it needs to fade out when an event pops up and then fade back in.
  // Just needs to be in the background"): on, the band goes far off over BG_OUT, as it sounds from up on the poster (its
  // level FAINT, the PA's low-pass at FAR) and stays there, the films' dips skipped; off, it comes back over BG_IN. The
  // level is on duckG and the low-pass is the hub's (2400), so a band that starts while the card is up starts far off.
  background(on,t){
    on=!!on; if(on===bgOn) return; bgOn=on;
    if(!ready()||!duckG) return;
    t=Math.max(t||0,ac.currentTime); const d=on?BG_OUT:BG_IN, g=duckG.gain;
    holdAt(g,t); g.linearRampToValueAtTime(on?FAINT:1,t+d);
    if(state==='hub'){ const lp=pa.lp.frequency; holdAt(lp,t); lp.exponentialRampToValueAtTime(on?FAR:2400,t+d); }
  },
  // everything silent at audio time t (the first ROCK)
  cut(t){ if(!ready()) return; killAll(t==null?ac.currentTime:t,.02); },
  // Between fights (plan step 5): on, the band starts at audio time t at `bpm` with its first bar being bar index `bar` of
  // AU's progression (AU.playStep: bar = floor(step/8) % 4, A minor, C, G, E minor), so the chords line up. Off, it stops
  // at t. The PA closes a little (2400 Hz) as it does between fights.
  hub(on,t,bpm,bar){
    if(!ready()) return;
    t=Math.max(t||0,ac.currentTime);
    if(on){
      if(state!=='off'&&state!=='hub') killAll(t,.02);
      if(band){ band.stop(t,.02); band=null; }
      const lp=pa.lp.frequency; holdAt(lp,t); lp.setValueAtTime(bgOn?FAR:2400,t);   // far off under an Event card
      band=bandStart(t,bpm>0?bpm:BPM,Math.max(0,Math.floor(bar||0)));
      state='hub';
    }else if(state==='hub'){
      if(band){ band.stop(t,.02); band=null; }
      state='off';
    }
  },
  // the walk-on thins the hub's band over `secs` from audio time t, under the riser (to be called by AU.paOpen)
  hubThin(t,secs){
    if(!ready()||state!=='hub'||!band) return;
    t=Math.max(t||0,ac.currentTime); secs=Math.max(.05,secs||1.2);
    const lp=pa.lp.frequency, mg=band.g.gain;
    holdAt(lp,t); lp.exponentialRampToValueAtTime(700,t+secs); holdAt(mg,t); mg.linearRampToValueAtTime(.35,t+secs);
  },
  // The fall (fall-drop plan, D1; called every frame by AU.fallMix): x 0 at the whoop to 1 at the landing. The band stays with
  // you and recedes: its level 1 - 0.7x^3 of its hub level (-10 dB at the floor) and a further -2 dB, its low-pass from the
  // hub's 2400 Hz toward 1900 Hz (about a third of hubThin's travel by the floor). setTargetAtTime, so a frame's call is smooth.
  hubFar(x){
    if(!ready()||state!=='hub'||!band) return;
    x=Math.max(0,Math.min(1,+x||0)); const t=ac.currentTime, lp=pa.lp.frequency, mg=band.g.gain;
    lp.cancelScheduledValues(t); lp.setTargetAtTime(2400*Math.pow(1900/2400,x),t,.05);
    mg.cancelScheduledValues(t); mg.setTargetAtTime((1-.7*x*x*x)*Math.pow(10,-2*x/20),t,.05);
  }
};
// OPENER LEVEL: a gain multiplier on everything FAIR plays
let levelV=1;
Object.defineProperty(F,'level',{get(){ return levelV; },set(v){ levelV=Math.max(0,+v||0); if(ac&&out&&ac===AU.ac) out.gain.setTargetAtTime(.9*levelV,ac.currentTime,.03); }});
F._film={ready,crowdStart,kachunk,held,hit,cym,bus,noise,get crowd(){ return crowd; },get band(){ return band; },get pa(){ return pa; },get nm(){ return nm; },get out(){ return out; },timp,glass,organ,pedal};   // the opener film's one patch (scripts/marketing/build-opener.mjs FAIR_PATCH)
return F;
})();
/* end of src/js/01b-fair-sound.js --- */
/* --- scripts/marketing/opener-score.js (copied whole by build-opener.mjs) --- */
/* ===== the film's score (docs/plans/2026-11-07-opener-trailer-plan.md, step 5) =====
   Round 11's trailer() (docs/work/mocks/opener-sound/listen11.src.html, the sound the owner approved, "Okay, all good"),
   played live on the game's own engine pasted above (AU, FAIR, FALLV, MUSIC_PROFILES). build-opener.mjs pastes this file
   after the game's three files, inside sound.js's one closure, so the names below see theirs. The times are the film's own:
   play(tl) is handed manifest.json's timeline (the one the picture is drawn from), not a copy of it. Only the levels and the
   placement are the film's; every voice is the game's.

   What changed from round 11's page: the times come from tl (round 11 worked them out from its own TL); each play is a
   "take" with its own timers, its own crowd and its own gain node for AU's voices, so stop() can silence a take whose hits
   are already scheduled (AU's voices connect to AU.master when they are scheduled, so a take routes them through its gain
   by pointing AU.master at it for the length of the call, then back); and FAIR's output is put back at its level when a take
   starts, since the last one ended on a fade to silence. */
const BEAT = 60 / 96;   // the organ and the band share the Fair's 96 BPM, a bar each
const CHANT = MUSIC_PROFILES.default.chant;
const M = () => FAIR._film;   // the Fair's voices, handed out by sound.js's one patch
// levels (round 11): the organ at 2 once the band is in; the band at 0.4 of its game level, a quarter of that in the pit; the
// crowd twice the game's, -3 dB in the pit; far off on the stars (0.025), light after the flash (0.045)
const ORGAN = 2, BAND = .4, PIT_BAND = .1, CROWD = .12, PIT_DIP = .7, CROWD_FAR = .025, CROWD_AFTER = .045;
// the opening (owner, 2026-11-09, opener-parade round 4: "as soon as the pan starts, for the crowd to get louder and louder
// ... from a physics standpoint ... the crowd is a larger thing"): far off on the stars, the crowd swells from the pan's start
// to its roar (`crowd`) at the landing and holds it over the parade until the pit; the parade's music (the organ, then the
// band) comes in at `musicIn` s, a far sound, `musicLow` of its level by the landing and full by `musicFull` s, under the roar.
// The player may hand play() a mix (mount's opts.mix) whose fields override these.
const MIX = { crowd: 1.8, musicIn: 4.4, musicLow: .4, musicFull: 9 };
// the count: the music dips to 35 % under each word and comes back over 0.3 s
const DIP = .35, DIP_BACK = .3;
// the ending: the Fair's output fades to silence over FADE seconds on (1 - x)^2, ending at the film's end
const FADE = 2;
// how far ahead of the tap the film's 0:00 is put, so the first frame and the first sound start together
const LEAD = .25;

let take = null;   // the play under way: { T, timers, C (its crowd), g (its gain for AU's voices) }

// take a param's value as it is at t and drop what was scheduled after (also mid-curve, which cancelScheduledValues cannot)
function holdNow(p, t){ try { if(p.cancelAndHoldAtTime){ p.cancelAndHoldAtTime(t); return; } } catch(e){}
  const v = p.value; p.cancelScheduledValues(0); p.setValueAtTime(v, t); }
function later(tk, t, fn){ tk.timers.push(setTimeout(() => { if(take === tk) fn(); }, Math.max(0, (t - AU.ac.currentTime) * 1000))); }
function viaTake(tk, fn){ const m = AU.master; AU.master = tk.g; try { fn(); } finally { AU.master = m; } }

function crowdIn(tk, a, pan0, pan1, mix){ later(tk, a, () => { M().ready(); tk.C = M().crowdStart(CROWD_FAR, AU.ac.currentTime); });   // far off, on the stars
  // nearer and nearer as the camera comes down: a third of the roar at the pan's middle, the whole of it on the landing
  const mid = (pan0 + pan1) / 2;
  later(tk, pan0, () => { if(tk.C) tk.C.to(mix.crowd / 3, AU.ac.currentTime, Math.max(.1, mid - AU.ac.currentTime)); });
  later(tk, mid, () => { if(tk.C) tk.C.to(mix.crowd, AU.ac.currentTime, Math.max(.1, pan1 - AU.ac.currentTime)); }); }
// the organ (the Naming's loop, FAIR.namingBack) faded in over `secs`, its bars pinned to `grid`
function organIn(tk, a, secs, grid, land, mix){ later(tk, a, () => { FAIR.namingBack(secs); const n = M().nm; if(n){ n.grid = grid; n.k = Math.max(1, n.k);
  n.to(ORGAN * mix.musicLow, AU.ac.currentTime, Math.max(.1, land - AU.ac.currentTime)); } }); }   // slowly, to musicLow by the landing
// the band joining under the organ (FAIR.sponsor, the organ kept up), then the crowd up
function bandJoins(tk, a, secs, full, mix){
  later(tk, a, () => {   // the parade's band, far off: in from `a`, musicLow of its level by the landing
    FAIR.sponsor(secs);
    const now = AU.ac.currentTime, b = M().band, n = M().nm, land = a + secs;
    if(b){ const g = b.g.gain; g.cancelScheduledValues(now); g.setValueAtTime(0, now); g.linearRampToValueAtTime(BAND * mix.musicLow, now + secs); }
    if(n) n.to(ORGAN * mix.musicLow, now, secs);
    const sc = M().crowd; if(sc) sc.stop(now, .05);   // the take's own crowd carries on instead
  });
  // the landing: the music up to full by `full`
  later(tk, a + secs, () => { const now = AU.ac.currentTime, b = M().band, n = M().nm, d = Math.max(.1, full - now);
    if(b){ const g = b.g.gain; holdNow(g, now); g.linearRampToValueAtTime(BAND, now + d); }
    if(n) n.to(ORGAN, now, d); });
}
// the pit: the band down to a quarter with the dissolve
function bandDown(tk, a, secs){ later(tk, a, () => { const b = M().band, now = AU.ac.currentTime; if(!b) return; const g = b.g.gain;
  g.cancelScheduledValues(now); g.setValueAtTime(BAND, now); g.linearRampToValueAtTime(PIT_BAND, now + secs); }); }
function dip(tk, w){
  const n = M().nm, b = M().band, c = tk.C;
  [[n && n.g.gain, ORGAN], [b && b.g.gain, PIT_BAND], [c && c.g.gain, CROWD * PIT_DIP]].forEach(([p, v]) => { if(!p) return;
    p.cancelScheduledValues(w - .01); p.setValueAtTime(v, w - .005); p.linearRampToValueAtTime(v * DIP, w + .015); p.linearRampToValueAtTime(v, w + DIP_BACK); });
}
// the build-up: the walk-on's riser into ROCK, the crowd dipping a little; the match's opening hit on ROCK; each word the
// SHOOT-strength tick with the music dipping under it
function buildUp(tk, a, words){
  later(tk, a, () => { const now = AU.ac.currentTime; viaTake(tk, () => AU.riser(now, words[0] - now)); if(tk.C) tk.C.to(CROWD * PIT_DIP, now, words[0] - now); });
  viaTake(tk, () => { AU.stageLift(words[0], 2); words.forEach((w, i) => AU.wordTick(w, CHANT[i], true)); });
  words.forEach(w => later(tk, w - .25, () => dip(tk, w)));
}
// the flash: the match's slam, the fall's boom at 0.4, a crash and a clap; the crowd on, lightly
function flashOut(tk, a){
  viaTake(tk, () => { AU.matchSlam(a); FALLV.boom(AU, a, .4); AU.crash(a, .2); AU.clap(a, .3); });
  later(tk, a, () => { if(tk.C) tk.C.to(CROWD_AFTER, AU.ac.currentTime, .3); });
}
// the ending (rounds 10 and 11): the organ's loop stops before the chord's bar and the band just before the chord; on the chord
// the organ's A minor and its pedal held still (as namingBar voices them, no arpeggio) with the Naming's card sting; held at
// full until FADE seconds before the end, then the Fair's output fades to silence on (1 - x)^2 by the film's end
function ending(tk, chord, end){
  const t = chord, f0 = end - FADE, f1 = end, d = f1 - t + .8;
  later(tk, t - 1, () => { const n = M().nm, b = M().band; if(n) n.end = t - .35; if(b) b.stop(t - .02, .05); });
  later(tk, t - .3, () => { const n = M().nm; if(!n) return;
    M().organ(t, [57, 60, 64], d, .02, n.ob); M().pedal(t, 45, d, .085, n.g);
    M().timp(t, 55, .28, n.g); [81, 84, 88].forEach((m, i) => M().glass(t + i * .03, m, .03, n.g, (i - 1) * .5)); });
  later(tk, f0 - .5, () => { const o = M().out; if(!o) return; const g = o.gain, v = .9 * FAIR.level, N = 64, c = new Float32Array(N);
    for(let i = 0; i < N; i++){ const x = i / (N - 1); c[i] = v * (1 - x) * (1 - x); }
    g.cancelScheduledValues(f0 - .02); g.setValueAtTime(v, f0 - .01); g.setValueCurveAtTime(c, f0, f1 - f0); });
  later(tk, f1 + .2, () => FAIR.stop(.02));
}
// the organ's bar grid: ROCK is beat 3 of a bar, 22 beats after the grid's first bar (0.85 s in round 11)
const gridOf = tl => tl.words[0] - 22 * BEAT;

// the whole score from audio time T (the film's 0:00); tl is manifest.json's timeline
function trailer(tk, T, tl, mix){
  const at = f => T + f, g0 = gridOf(tl), mi = Math.min(mix.musicIn, tl.pan1 - .5);
  crowdIn(tk, at(g0 - .1), at(tl.pan0), at(tl.pan1), mix);
  organIn(tk, at(mi), .5, at(g0), at(tl.pan1), mix);   // the organ's bars stay on the grid from 0.85 s, so ROCK lands on its beat
  bandJoins(tk, at(mi), tl.pan1 - mi, at(mix.musicFull), mix);
  bandDown(tk, at(tl.pit), tl.pitIn);
  buildUp(tk, at(tl.pit), tl.words.map(at));
  flashOut(tk, at(tl.dark));
  ending(tk, at(tl.rules), at(tl.end));   // the chord on the end card's lines (20.85 s), silence from the film's end
}

// stop the take under way: its timers, its crowd, the Fair (killAll) and its output, and the AU voices it already scheduled
function stopTake(fade){
  const tk = take; take = null; if(!tk || !AU.ac) return;
  const now = AU.ac.currentTime, f = Math.max(.01, fade);
  tk.timers.forEach(clearTimeout);
  const o = M().out; if(o){ holdNow(o.gain, now); o.gain.linearRampToValueAtTime(0, now + f); }
  FAIR.stop(f);
  if(tk.C) tk.C.stop(now, f);
  holdNow(tk.g.gain, now); tk.g.gain.linearRampToValueAtTime(0, now + f);
  setTimeout(() => { try { tk.g.disconnect(); } catch(e){} }, (f + .2) * 1000);
}

// ----- what the player calls -----
// wake(): inside the visitor's tap, synchronously. The game's engine, as the game wakes it on a touch: the context (AU.init),
// resumed with a silent sample (AU.unlock), the silent media element that lifts iOS's mute (AU.unmute), and Safari's audio
// session set to playback (AU.session), so the sound plays through the iPhone's silent switch. True when there is sound.
function wake(){
  AU.init(); if(!AU.ok) return false;
  AU.unlock(); AU.unmute(); AU.session('playback');
  return true;
}
// play(tl): a new take from 0:00, LEAD seconds ahead of now on the audio clock; returns that time (T), the film's 0:00
function play(tl, mix){
  if(!AU.ok) return null;
  stopTake(.05);
  const ac = AU.ac, now = ac.currentTime, T = now + LEAD;
  M().ready();
  { const g = M().out.gain, v = .9 * FAIR.level;   // the Fair's output back at its level (the last take ended on a fade to 0)
    holdNow(g, now); g.linearRampToValueAtTime(0, now + .05); g.setValueAtTime(v, T - .01); }
  const tk = { T, timers: [], C: null, g: ac.createGain() };
  tk.g.connect(AU.master);
  take = tk;
  const m = { ...MIX }; if(mix) for(const k of Object.keys(MIX)){ const v = +mix[k]; if(isFinite(v)) m[k] = v; }
  tk.mix = m;
  trailer(tk, T, tl, m);
  return T;
}
// stop(): the Fair's output down fast (60 ms), the take stopped
function stop(){ stopTake(.06); }
// the audio time being heard now (performance.now() ms): the context's output timestamp carried forward to `now`, never past
// the context's own clock; without one, the clock less the output latency
function heard(now){
  const ac = AU.ac; if(!ac) return 0;
  let ts = null; try { ts = ac.getOutputTimestamp && ac.getOutputTimestamp(); } catch(e){}
  if(ts && ts.performanceTime > 0 && ts.contextTime > 0){
    const run = ac.state === 'running' ? Math.max(0, (now - ts.performanceTime) / 1000) : 0;
    return Math.min(ac.currentTime, ts.contextTime + run);
  }
  return Math.max(0, ac.currentTime - (ac.outputLatency || ac.baseLatency || 0));
}
/* end of scripts/marketing/opener-score.js --- */
return { wake, play, stop, heard, AU, FAIR, LEAD, MIX };
})();
