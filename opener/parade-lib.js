/* Copied by scripts/marketing/build-opener.mjs from src/js/29c-parade-title.js, unchanged: the game's hexRgb, LE and pack
   (the crowd's colours), mulberry (the crowd's init) and hash3 (the twinkle's stars and the smoke's puffs), wrapped as one
   global, window.RPSOpenerLib, so the player loads it with a plain <script> (no eval; strict-CSP pages work). */
window.RPSOpenerLib = (function(){
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const LE=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
const pack=(r,g,b)=>LE?((255<<24)|(b<<16)|(g<<8)|r)>>>0:((r<<24)|(g<<16)|(b<<8)|255)>>>0;
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash3(a,b,c,sd){const s=Math.sin(a*127.1+b*311.7+c*74.7+sd*53.3)*43758.5453;return s-Math.floor(s)}
return { hexRgb, pack, mulberry, hash3 };
})();
