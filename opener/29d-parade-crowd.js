/* ---- The parade's crowd: the title's crowd, denser, running to the horizon (docs/plans/2026-10-18-climb-game-build-plan.md, step 3) ----
   A port of docs/work/mocks/fair-places/climb/crowd.js (the Climb mock). Owner, 2026-10-18: the crowd runs to the horizon; it is
   the title's crowd, denser; it cheers the parade and ignores you. src/js/29c-parade-title.js owns it as the parade's `crowd`
   group: it calls paradeCrowd.init once per logical size and paradeCrowd.draw each frame straight into the parade's one frame
   buffer (no extra canvas), and the Climb film calls it with a camera.

   The rule that makes it work: the camera cranes straight up, so a person keeps the same size the whole way; only the row's
   height on screen changes. A row d rows below the horizon at the title sits at horizon + d * k, k = 1 at the title and
   growing as the camera rises. Nothing is ever scaled or redrawn at a new size, and nothing rises from hiding: rows only move
   down, each at its own rate. Every body runs down to the road edge, so the row in front always covers the legs of the row
   behind and no gap opens.

   Sizes are fixed by distance, at a few sizes only:
     d >= 11  the game's own crowd figure (the title's drawExec), size class s 0..4 on the title rows' curve; the title's five
              rows are the game's own, same seeds, hats and flags
     d 6.5-11 tier B, a hand-drawn 5-wide figure (head 3 x 3), arms pumping like the title's
     d 3.8-6.5 tier C, a hand-drawn 4-wide figure (head 2 x 2), still
     d 2-3.8  tier D, a head pixel on a 2-wide body
     d < 2    the sea of heads: one-pixel rows, darker toward the horizon
   Far tiers have no hats (they read as holes), no antennas; a few B figures wave a rust flag.

   API (window.paradeCrowd):
     init({W,HH,OX,OY,mulberry,colours})  builds the figures for a W x HH frame; OX = the 160-wide composition's left margin,
                                          OY = the 347-row composition's top row; colours = packed u32 {suit,suitEdge,shirt,dk,
                                          head,headHi,headSh,ink,armEdge,hand,rust,slate,iron,grey}
     draw(u32,t,{yh,k,ox,oxAt,keep,full}) draws the crowd at parade time t into a W x HH Uint32Array: yh = the horizon's frame row
                                          (OY + 98 at the title), k = the spread (1 at the title), ox = sideways offset, oxAt =
                                          an optional d -> extra offset for the row d rows below the horizon (the Sponsor
                                          kiosk's pan: each row at its own depth's rate, so the crowd never slides as one card). The
                                          buffer is cleared first (0 = transparent) unless keep is set, which draws over what
                                          is there (the title: the crowd is opaque from the horizon down). Any other view
                                          than the title's draws from baked rows (drawStrips); full = every figure, as built.
     TD, ROAD_D                           the title rows' feet and the road edge, in rows below the horizon
   The crowd's pixels are the palette tokens it is given; it makes no colour of its own. */
(function(){
'use strict';
const SKY_B=98,FRIEZE_B=168,ROAD_D=FRIEZE_B-SKY_B;   // composition rows (29c-parade-title.js); the road edge is 70 rows below the horizon
const TD=[16,27,38,49,60];                              // the title rows' feet, rows below SKY_B
const mulberry0=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
let W,HH,OX,OY,C,buf=null,ox=0,oy=0,crowd=[],field=[];
// drawing modes (the title's fast path, below): 0 plain; 1 record, each pixel also writes `seq` into `dep`; 2 test, a pixel is
// written only where `dep` holds a lower seq (a nearer, static figure has not already covered it)
let dmode=0,dep=null,seq=0,cache=null,fp=null,ff=null,rowFigs=[];   // fp, ff: a pose forced for a sprite (pump value, flag parity)

function rect(x,y,w,h,c){   // y in screen rows
  x=Math.round(x)+ox;y=Math.round(y)+oy;w|=0;h|=0;
  const x0=x<0?0:x,y0=y<0?0:y,x1=x+w>W?W:x+w,y1=y+h>HH?HH:y+h;if(x1<=x0||y1<=y0)return;
  if(dmode===0){for(let yy=y0;yy<y1;yy++)buf.fill(c,yy*W+x0,yy*W+x1)}
  else if(dmode===1){for(let yy=y0;yy<y1;yy++){const o=yy*W;buf.fill(c,o+x0,o+x1);dep.fill(seq,o+x0,o+x1)}}
  else{for(let yy=y0;yy<y1;yy++){const o=yy*W,e=o+x1;for(let i=o+x0;i<e;i++)if(dep[i]<seq)buf[i]=c}}
}
function line(x0,y0,x1,y1,c){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))||1;
  for(let i=0;i<=n;i++){const x=Math.round(x0+(x1-x0)*i/n)+ox,y=Math.round(y0+(y1-y0)*i/n)+oy;
    if(x>=0&&x<W&&y>=0&&y<HH){const p=y*W+x;if(dmode===0)buf[p]=c;else if(dmode===1){buf[p]=c;dep[p]=seq}else if(dep[p]<seq)buf[p]=c}}}

/* the game's figure (29c-parade-title.js drawExec), with its foot row and body bottom as parameters, screen rows */
function drawFig(c,t,s,base,bottom){
  const w=3+s+c.wide,th=7+2*s+c.tall;
  const pump=fp!==null?fp:Math.sin(t*c.sp+c.ph),up=pump>-.3&&!c.calm,bob=pump>.7&&!c.flat?1:0;   // no head bob in the field (the far rows); the title's own five rows keep the game's   // calm: a field figure that keeps its arms down
  const x=Math.round(c.x),ty=base-th-bob,aw=s>2?2:1;
  rect(x-w+1,ty+th,2*w-1,bottom-ty-th,C.suit);
  const EDGE=c.flat?C.suit:C.suitEdge;   // flat: a field figure without the ink edge (dense rows of it read as stripes)
  rect(x-w,ty,2*w+1,th,C.suit);rect(x+w,ty+1,1,th-1,EDGE);
  const v=1+(s>>1);rect(x-v,ty,2*v+1,2,C.shirt);rect(x-v+1,ty+2,Math.max(1,2*v-1),1,C.shirt);
  rect(x,ty+1,1,2+s,C.dk);
  if(up){const reach=5+s*2+(pump>.4?2:0);
    line(x-w-1,ty+1,x-w-3,ty-reach,C.armEdge);line(x+w+1,ty+1,x+w+3,ty-reach,C.armEdge);
    for(let k=0;k<aw;k++){line(x-w+k,ty+1,x-w-2+k,ty-reach,C.suit);line(x+w-k,ty+1,x+w+2-k,ty-reach,C.suit)}
    rect(x-w-3,ty-reach-2,aw+1,aw+1,C.hand);rect(x+w+1,ty-reach-2,aw+1,aw+1,C.hand);
    if(c.flag){rect(x+w+2,ty-reach-9,1,7,C.hand);rect(x+w+3,ty-reach-9,3+s+(ff!==null?ff:(t*6+c.ph|0)%2),2+(s>>1),c.fc)}}
  else{line(x-w,ty+1,x-1,ty+4,C.suit);line(x+w,ty+1,x+1,ty+4,C.suit);rect(x-1,ty+3,3,2,C.hand)}
  const hw=5+s,hh=4+s,hx=x-(hw>>1),hy=ty-2-hh;
  rect(x-1,ty-2,2,2,EDGE);
  rect(hx+1,hy,hw-2,hh,C.head);rect(hx,hy+1,hw,hh-2,C.head);rect(hx+1,hy,hw-2,1,C.headHi);
  rect(hx+hw-1,hy+1,1,hh-2,C.headSh);rect(hx+1,hy+hh-1,hw-2,1,C.headSh);
  rect(hx+1,hy+2,s>1?2:1,s>2?2:1,C.ink);
  if(c.hat){rect(hx-1,hy-1,hw+2,1,C.ink);rect(hx+1,hy-3-(s>>1),hw-2,2+(s>>1),C.ink)}
  if(c.ant&&!c.hat){rect(x,hy-3,1,3,C.dk);rect(x,hy-4,1,1,C.grey)}
}

/* hand-drawn far figures; the foot is the bottom row, x the centre column. Keys: s suit, e suit edge, i shirt, d tie,
   h head, H head highlight, c head shadow, x eye, a arm edge, k hand, f flag; '.' clear. The last row runs on down. */
const SPR={
  B:[ ['.HHc.','.xhc.','..c..','.iie.','sidse','sssse','sssse'],                                  // arms down
      ['k...k','aHHca','axhca','s.c.e','siiee','sidse','sssse','sssse'],                          // arms up
      ['k...kff','aHHcaff','axhca..','s.c.e..','siiee..','sidse..','sssse..','sssse..'] ],          // waving a flag
  C:[ ['Hh.','hc.','sse'], ['hH.','hc.','sse'], ['Hc.','cc.','sse'] ],                           // a 2 x 2 head on shoulders
  D:[ ['hc','ss'], ['Hh','ss'], ['cc','ss'] ]                                                  // a 2 x 1 head

};
const KEY={s:'suit',e:'suitEdge',i:'shirt',d:'dk',h:'head',H:'headHi',c:'headSh',x:'ink',a:'armEdge',k:'hand',f:'rust'};
function stamp(rows,x,base,bottom,dark){
  const h=rows.length,w=rows[0].length,x0=Math.round(x)-(w>>1),y0=base-h+1;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const ch=rows[j][i];if(ch==='.')continue;
    let col=C[KEY[ch]];if(dark&&(ch==='h'||ch==='H'))col=ch==='H'?C.head:C.headSh;rect(x0+i,y0+j,1,1,col)}
  const last=rows[h-1];for(let i=0;i<w;i++)if(last[i]!=='.')rect(x0+i,base+1,1,bottom-base-1,C.suit);   // the body runs on in suit (an ink edge run down reads as a black stripe)
}

const tierAt=d=>d>=11?'fig':d>=6.5?'B':d>=3.8?'C':d>=2?'D':'sea';
const sAt=d=>Math.max(0,Math.min(4,Math.round(3*Math.pow(d/16,.64)-3)));   // the title rows' size curve
const STEP={fig0:7,fig1:8,fig2:10,fig3:12,fig4:14,B:5,C:4,D:4,sea:3};
function init(o){
  W=o.W;HH=o.HH;OX=o.OX;OY=o.OY;C=o.colours;buf=null;strips=null;rowFigs=[];const mulberry=o.mulberry;
  // the title's five rows: 29c-parade-title.js's own build, as it was, same seeds and order, so at k 1 they are the game's crowd
  crowd=[];const cr=mulberry(0x1e8),cr2=mulberry(0x2f9),W0=160;
  const exec=(rg,row,x)=>({row,x:x+OX,
      hat:rg()<.18,ant:rg()<.1,flag:rg()<.22,ph:rg()*6.28,sp:2+rg()*3,tall:rg()*3|0,wide:rg()*2|0,
      fc:rg()<.15?C.rust:[C.slate,C.iron,C.dk][rg()*3|0]});
  const X0=-OX,X1=W-OX;
  for(let row=0;row<5;row++){const step=[7,8,10,12,14][row],n=Math.ceil(W0/step)+1,off=row%2?step/2:0;
    for(let k=0;k<n;k++){const x=k*step+off+(cr()*4|0)-2;crowd.push(exec(cr,row,x))}
    for(let k=-1;k*step+off>X0-step;k--)crowd.push(exec(cr2,row,k*step+off+(cr2()*4|0)-2));
    for(let k=n;k*step+off<X1+step;k++)crowd.push(exec(cr2,row,k*step+off+(cr2()*4|0)-2))}
  // the field: rows at 5% steps in d from the road edge to the horizon, skipping the title rows
  field=[];const fr=mulberry(0xc20d);
  for(let d=ROAD_D-1;d>0.25;d*=.95){if(TD.some(t=>Math.abs(t-d)<d*.03))continue;
    const tier=tierAt(d),step=STEP[tier==='fig'?'fig'+sAt(d):tier],off=fr()*step,figs=[];
    // owner, 2026-10-18 (stills round): no seams where one size gives way to the next; near a change-over each figure
    // takes the size of a distance up to 20% either side of its row's, so sizes mix figure by figure, as in a real crowd
    for(let x=-step+off;x<W+step;x+=step){const dd=d*(.8+.4*fr()),ft=tierAt(dd);
      figs.push({x:x+(fr()*3|0)-1,v:fr(),ph:fr()*6.28,sp:2+fr()*3,tier:ft,s:sAt(dd),
        tall:fr()*3|0,wide:fr()*2|0,hat:false,ant:false,calm:fr()<.75,flat:true,flag:ft==='B'&&fr()<.05,fc:C.rust})}
    field.push({d,tier,figs,dark:d<3})}
  field.sort((a,b)=>a.d-b.d);   // back to front
}

function draw(u32,t,v){
  buf=u32;if(!v.keep)buf.fill(0);
  if((v.k||1)===1&&!Math.round(v.ox||0)&&!v.oxAt){drawTitle1(u32,t,v.yh);buf=null;return}   // the title's own view: a cache, below
  const yh=v.yh,k=v.k,road=Math.round(yh+ROAD_D*k),at=d=>Math.round(yh+d*k);
  const ox0=Math.round(v.ox||0),oxAt=v.oxAt,off=oxAt?d=>ox0+Math.round(oxAt(d)):()=>ox0;
  if(!v.full){drawStrips(t,yh,k,off,road,at,v.fast);buf=null;return}   // the film's camera: baked rows (below); v.full = draw every figure
  // the sea's ground: from the horizon down it is all crowd, dark at the back
  ox=0;oy=0;rect(0,yh+1,W,road-yh-1,C.suit);
  let o=ox0;const wrapX=x=>((x+o)%W+W)%W;
  // the farthest crowd stands in front of the title's tree line (the 8 rows above the horizon), packed heads up to the
  // skyline's foot, so no dark band opens under the city as the camera rises (owner, 2026-10-18)
  o=off(0);
  {const fr=mulberry0(77);for(let y=yh-8;y<=yh;y++){rect(0,y,W,1,C.suit);
    for(let x=-3;x<W;x+=3){const q=fr(),xx=wrapX(x+(fr()*3|0));if(q<.85)rect(xx,y,2,1,q<.4?C.head:C.headSh)}}}
  let ti=0;
  const title=row=>titleRow(row,t,road,at,off(TD[row]));
  for(const R of field){
    while(ti<5&&TD[ti]<R.d)title(ti++);
    const base=at(R.d);if(base-30>HH)continue;o=off(R.d);
    for(const f of R.figs){const x=wrapX(f.x),q=f.v;
      // the sea: seen from this low, a far crowd packs into heads, so it gets denser toward the horizon (owner, 2026-10-18:
      // the sparse dark version left a dark band under the skyline)
      if(f.tier==='sea'){if(q<Math.min(.9,.98-R.d*.15))rect(x,base,2,1,q<.5-R.d*.12?C.head:C.headSh);continue}
      if(f.tier==='fig'){const c=Object.assign({},f,{x});drawFig(c,t,f.s,base,road)}
      else if(f.tier==='B'){const pump=Math.sin(t*f.sp+f.ph),up=!f.calm&&pump>-.3;
        stamp(SPR.B[f.flag?2:up?1:0],x,base,road)}
      else if(f.tier==='C')stamp(SPR.C[q*3|0],x,base,road,R.dark&&q<.6)
      else stamp(SPR.D[q*3|0],x,base,road,R.dark)}
  }
  while(ti<5)title(ti++);
  buf=null;
}
// one of the title's five rows at sideways offset o, drawn again a width over so no seam shows
function titleRow(row,t,road,at,o){
  o=((o%W)+W)%W;
  oy=at(TD[row])-(OY+114+row*11);
  for(const c of crowd)if(c.row===row){ox=o;drawTitleRow(c,t,road-oy);if(o){ox=o-W;drawTitleRow(c,t,road-oy)}}
  ox=0;oy=0;
}
function titleRowFast(row,t,road,at,o){
  o=((o%W)+W)%W;
  const base=at(TD[row]),bd=road-base,list=rowFigs[row]||(rowFigs[row]=crowd.filter(c=>c.row===row));
  for(const c of list){const sp=figSprite(c,row,bd,figPose(c,t));
    if(!sp){ox=o;oy=base-(OY+114+row*11);drawTitleRow(c,t,road-oy);if(o){ox=o-W;drawTitleRow(c,t,road-oy)}ox=0;oy=0;continue}
    const x=Math.round(c.x);playSpans(sp,x+o,base);if(o)playSpans(sp,x+o-W,base)}
}
function drawTitleRow(c,t,bottomComp){   // the game's own call: base and body bottom in composition rows (+OY via oy)
  const s=c.row;drawFig(c,t,s,OY+114+s*11,bottomComp);
}

/* The title's view (k 1, no sideways offset) every frame without redrawing the crowd. Everything that never moves (the sea
   ground, the far tiers, every calm figure, the flag wavers) is drawn once into `cache` in the order it was drawn in
   (dep: each pixel remembers the seq of the last static figure to paint it). The figures that move (the title's five rows, a
   quarter of the field's near rows) are listed in the same order and drawn each frame on top of a copy of the cache, only
   where no nearer static figure covers the pixel (dep < their seq): the same pixels as drawing the whole crowd back to front. */
function buildCache(yh){
  const road=yh+ROAD_D,at=d=>Math.round(yh+d),cb=new Uint32Array(W*HH),cd=new Uint16Array(W*HH),anim=[];
  buf=cb;dep=cd;dmode=1;seq=0;ox=0;oy=0;
  rect(0,yh+1,W,road-yh-1,C.suit);
  {const fr=mulberry0(77);for(let y=yh-8;y<=yh;y++){rect(0,y,W,1,C.suit);
    for(let x=-3;x<W;x+=3){const q=fr(),xx=(((x+(fr()*3|0))%W)+W)%W;if(q<.85)rect(xx,y,2,1,q<.4?C.head:C.headSh)}}}
  let ti=0;
  const title=row=>{for(const c of crowd)if(c.row===row)anim.push({k:0,c,s:row,seq:++seq,base:OY+114+row*11})};
  for(const R of field){
    while(ti<5&&TD[ti]<R.d)title(ti++);
    const base=at(R.d);if(base-30>HH)continue;
    for(const f of R.figs){const x=((f.x%W)+W)%W,q=f.v;seq++;
      if(f.tier==='sea'){if(q<Math.min(.9,.98-R.d*.15))rect(x,base,2,1,q<.5-R.d*.12?C.head:C.headSh)}
      else if(f.tier==='fig'){const c=Object.assign({},f,{x});if(f.calm)drawFig(c,0,f.s,base,road);else anim.push({k:0,c,s:f.s,seq,base})}
      else if(f.tier==='B'){if(!f.calm&&!f.flag)anim.push({k:1,f,x,seq,base});else stamp(SPR.B[f.flag?2:0],x,base,road)}
      else if(f.tier==='C')stamp(SPR.C[q*3|0],x,base,road,R.dark&&q<.6);
      else stamp(SPR.D[q*3|0],x,base,road,R.dark)}
  }
  while(ti<5)title(ti++);
  dmode=0;dep=null;buf=null;
  let r0=0;while(r0<HH&&!cb.subarray(r0*W,r0*W+W).some(v=>v))r0++;
  return {yh,road,cb,cd,anim,r0};
}
/* A moving figure takes a handful of poses (arms down, up, up and high, bobbing, a flag's two phases). Each pose is drawn once
   into a scratch frame and kept as spans, [pixel, length, colour]; a frame then plays the spans, testing depth as it goes. */
let scratch=null;
function spriteOf(a,key,up,reach,bob,fl,road){
  if(!scratch||scratch.length!==W*HH)scratch=new Uint32Array(W*HH);
  const save=buf;buf=scratch;dmode=0;ox=0;oy=0;
  if(a.k===0){fp=bob?.85:reach?.55:up?0:-.9;ff=fl;drawFig(a.c,0,a.s,a.base,road);fp=null;ff=null}
  else stamp(SPR.B[up?1:0],a.x,a.base,road);
  buf=save;
  const x=Math.round(a.k===0?a.c.x:a.x),y0=Math.max(0,a.base-64),y1=Math.min(HH,road+1),x0=Math.max(0,x-18),x1=Math.min(W,x+24),out=[];
  for(let y=y0;y<y1;y++){const o=y*W;let x2=x0;
    while(x2<x1){const c=scratch[o+x2];if(!c){x2++;continue}let e=x2+1;while(e<x1&&scratch[o+e]===c)e++;
      out.push(o+x2,e-x2,c);scratch.fill(0,o+x2,o+e);x2=e}}
  return new Uint32Array(out);
}
function drawTitle1(u32,t,yh){
  const ca=cache&&cache.yh===yh?cache:(cache=buildCache(yh)),cb=ca.cb,e=Math.min(HH,ca.road)*W,road=ca.road,d=ca.cd;
  for(let i=ca.r0*W;i<e;i++){const v=cb[i];if(v)u32[i]=v}
  for(const a of ca.anim){
    let up,reach=false,bob=false,fl=0,pump;
    if(a.k===0){const c=a.c;pump=Math.sin(t*c.sp+c.ph);up=pump>-.3&&!c.calm;bob=pump>.7&&!c.flat;reach=up&&pump>.4;
      if(up&&c.flag)fl=(t*6+c.ph|0)%2}
    else{up=Math.sin(t*a.f.sp+a.f.ph)>-.3}
    const key=(up?1:0)|(reach?2:0)|(bob?4:0)|(fl?8:0);
    const sp=a.sp||(a.sp=[]);let sd=sp[key];if(!sd)sd=sp[key]=spriteOf(a,key,up,reach,bob,fl,road);
    const sq=a.seq;
    for(let i=0;i<sd.length;i+=3){let p=sd[i];const pe=p+sd[i+1],c=sd[i+2];for(;p<pe;p++)if(d[p]<sq)u32[p]=c}}
  dmode=0;dep=null;
}
/* The film's view (any k, any sideways offset) without redrawing the field. Each field row's still figures (calm, sea,
   tiers C and D, flag wavers) are drawn once into a strip SH rows tall whose bottom row is the row's foot, wrapped sideways
   (a figure is drawn at x mod W and again a width either side), so a strip shifted by the camera never shows a seam. A frame
   lays the strips back to front at their row's foot, the moving figures of each row straight after their strip, and the
   title's five rows where they fall. Nothing runs down below a foot: from the horizon to the road it is all suit anyway (the
   sea's ground), and a nearer row covers a farther one's feet. Against the full draw (draw(...,{full:true})) the
   one difference is within a row: a moving figure's arm goes over its still neighbour, not under it (about 1% of the crowd's pixels). Owner, 2026-10-19: the film draws at 30 fps; this keeps it there. */
const SH=48;
let strips=null;
function buildStrips(){
  const out=[],save=buf,sb=new Uint32Array(W*SH);
  for(const R of field){
    sb.fill(0);buf=sb;dmode=0;oy=0;const base=SH-1,anim=[];
    for(const f of R.figs){const xm=((f.x%W)+W)%W,q=f.v;
      const moving=(f.tier==='fig'&&!f.calm)||(f.tier==='B'&&!f.calm&&!f.flag);
      if(moving){anim.push(f);continue}
      for(const xo of [0,-W,W]){ox=xo;
        if(f.tier==='sea'){if(q<Math.min(.9,.98-R.d*.15))rect(xm,base,2,1,q<.5-R.d*.12?C.head:C.headSh)}
        else if(f.tier==='fig')drawFig(Object.assign({},f,{x:xm}),0,f.s,base,base);
        else if(f.tier==='B')stamp(SPR.B[f.flag?2:0],xm,base,base);
        else if(f.tier==='C')stamp(SPR.C[q*3|0],xm,base,base,R.dark&&q<.6);
        else stamp(SPR.D[q*3|0],xm,base,base,R.dark)}}
    ox=0;let r0=0;while(r0<SH&&!sb.subarray(r0*W,r0*W+W).some(v=>v))r0++;
    // each row's runs of pixels that are set: runs[ri[j]..ri[j+1]) = start, end, start, end ...; a frame copies the runs, with no test per pixel
    const px=sb.slice(r0*W),n=px.length/W,ri=new Uint32Array(n+1),rr=[];
    for(let j=0;j<n;j++){ri[j]=rr.length;let x=0;
      while(x<W){if(!px[j*W+x]){x++;continue}let e=x+1;while(e<W&&px[j*W+e])e++;rr.push(x,e);x=e}}
    ri[n]=rr.length;
    out.push({R,px,r0,anim,ri,runs:new Int16Array(rr)});
  }
  buf=save;return out;
}
/* The ride's fast path (v.fast): a moving figure takes a few poses, and each is drawn once, with drawFig or stamp as above, into a scratch
   frame and kept as spans [row from the foot, column from the figure's, length, colour]; a frame then plays the spans (the same pixels
   as drawing the figure again, clipped at the frame's edges as rect clips). A pose is told by the thresholds its pump crosses. */
const REFB=72;
function spanSprite(draw,bd){   // draw() paints one figure with its foot at row REFB and its column at W>>1; bd: rows its body runs below the foot
  if(REFB+bd+2>HH||W<100)return null;
  if(!scratch||scratch.length!==W*HH)scratch=new Uint32Array(W*HH);
  const save=buf;buf=scratch;dmode=0;ox=0;oy=0;
  try{draw()}finally{buf=save}
  const cx=W>>1,off=[],len=[],cols=[],xe=cx+40;   // a figure stands within 40 columns and 64 rows above its foot
  let bx0=1e9,bx1=-1e9,by0=1e9,by1=-1e9;
  for(let y=REFB-64;y<=REFB+bd+1;y++){const o=y*W;let x=cx-40;
    while(x<xe){const c=scratch[o+x];if(!c){x++;continue}let e=x+1;while(e<xe&&scratch[o+e]===c)e++;
      off.push((y-REFB)*W+x-cx);len.push(e-x);cols.push(c);scratch.fill(0,o+x,o+e);
      if(x-cx<bx0)bx0=x-cx;if(e-cx>bx1)bx1=e-cx;if(y-REFB<by0)by0=y-REFB;if(y-REFB>by1)by1=y-REFB;x=e}}
  // o: each span's offset from the foot's pixel, l its length, c its colour; the box it covers, columns from x0 to x1, rows y0 to y1 (inclusive)
  return {o:new Int32Array(off),l:new Uint8Array(len),c:new Uint32Array(cols),x0:bx0,x1:bx1,y0:by0,y1:by1,W};
}
function playSpans(sp,x,base){   // a sprite at column x (rounded, as drawFig and stamp round it), foot row base, clipped to the frame
  x=Math.round(x);const b=buf,O=sp.o,L=sp.l,Cs=sp.c,n=Cs.length;
  if(x+sp.x1<=0||x+sp.x0>=W||base+sp.y1<0||base+sp.y0>=HH||!n)return;   // wholly off the frame
  if(x+sp.x0>=0&&x+sp.x1<=W&&base+sp.y0>=0&&base+sp.y1<HH){   // wholly in it: no clipping
    const q=base*W+x;for(let i=0;i<n;i++){const d=q+O[i],c=Cs[i];for(let k=d,e=d+L[i];k<e;k++)b[k]=c}return}
  for(let i=0;i<n;i++){   // across an edge: each span cut as rect cuts it
    const dy=Math.round(O[i]/W),dx=O[i]-dy*W,y=base+dy;if(y<0||y>=HH)continue;
    let x0=x+dx,x1=x0+L[i];if(x0<0)x0=0;if(x1>W)x1=W;if(x1<=x0)continue;
    const o=y*W,c=Cs[i];for(let q=o+x0,e=o+x1;q<e;q++)b[q]=c}
}
// a drawFig pose (pump thresholds forced as spriteOf does); c carries its own sprites in c.sp, valid for one body depth bd
function figPose(c,t){
  const pump=Math.sin(t*c.sp+c.ph),up=pump>-.3&&!c.calm;
  return up?1|(pump>.4?2:0)|(pump>.7&&!c.flat?4:0)|(c.flag&&((t*6+c.ph|0)%2)?8:0):0;
}
function figSprite(c,s,bd,key){
  if(c.spBd!==bd){c.spBd=bd;c.spr=[]}
  let sp=c.spr[key];
  if(sp===undefined){
    sp=c.spr[key]=spanSprite(()=>{fp=!(key&1)?-.9:key&4?.85:key&2?.55:0;ff=key>>3&1;
      try{drawFig(Object.assign({},c,{x:W>>1}),0,s,REFB,REFB+bd)}finally{fp=null;ff=null}},bd);
  }
  return sp;
}
function drawStrips(t,yh,k,off,road,at,fast){
  if(!strips||strips.W!==W){strips=buildStrips();strips.W=W}
  let o=off(0);const wrapX=x=>((x+o)%W+W)%W;
  ox=0;oy=0;rect(0,yh+1,W,road-yh-1,C.suit);
  {const fr=mulberry0(77);for(let y=yh-8;y<=yh;y++){rect(0,y,W,1,C.suit);
    for(let x=-3;x<W;x+=3){const q=fr(),xx=wrapX(x+(fr()*3|0));if(q<.85)rect(xx,y,2,1,q<.4?C.head:C.headSh)}}}
  let ti=0;
  const title=row=>fast?titleRowFast(row,t,road,at,off(TD[row])):titleRow(row,t,road,at,off(TD[row]));
  for(const S of strips){const R=S.R;
    while(ti<5&&TD[ti]<R.d)title(ti++);
    const base=at(R.d);if(base-30>HH)continue;
    o=off(R.d);const sh=((o%W)+W)%W;
    const y0=base-SH+1+S.r0,px=S.px,n=px.length/W;
    const ri=S.ri,runs=S.runs,m=W-sh;
    for(let j=0;j<n;j++){const y=y0+j;if(y<0||y>=HH)continue;const d=y*W+sh,so=j*W;
      for(let r=ri[j],re=ri[j+1];r<re;r+=2){const a=runs[r],b=runs[r+1];   // a run, cut where the shift wraps the row
        if(b<=m){for(let x=a;x<b;x++)buf[d+x]=px[so+x]}
        else if(a>=m){for(let x=a;x<b;x++)buf[d+x-W]=px[so+x]}
        else{for(let x=a;x<m;x++)buf[d+x]=px[so+x];for(let x=m;x<b;x++)buf[d+x-W]=px[so+x]}}}
    for(const f of S.anim){const x=wrapX(f.x);
      if(fast){let sp;
        if(f.tier==='fig')sp=figSprite(f,f.s,0,figPose(f,t));
        else{const key=Math.sin(t*f.sp+f.ph)>-.3?1:0,c=f.spr||(f.spr=[]);sp=c[key];
          if(sp===undefined)sp=c[key]=spanSprite(()=>stamp(SPR.B[key],W>>1,REFB,REFB),0)}
        if(sp)playSpans(sp,x,base);
        else if(f.tier==='fig')drawFig(Object.assign({},f,{x}),t,f.s,base,base);
        else stamp(SPR.B[Math.sin(t*f.sp+f.ph)>-.3?1:0],x,base,base)}
      else if(f.tier==='fig')drawFig(Object.assign({},f,{x}),t,f.s,base,base);
      else stamp(SPR.B[Math.sin(t*f.sp+f.ph)>-.3?1:0],x,base,base)}
  }
  while(ti<5)title(ti++);
}
window.paradeCrowd={init,draw,TD,ROAD_D};
})();
