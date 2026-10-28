/* Shared battle map. Local-only until you join a party, then synced through Firebase (parties/CODE/map). */
(function(){
const W=20,H=14,CS=40,COLS=['#46d2c2','#e3a64e','#b79cf0','#7fd38a','#6fb7f0','#f0c76f'];
const COVN={1:'Partial +1',3:'Half +3',5:'Full +5'};
let M=load(),sel=null,tool='move',ref=null,listening='',drag=null;
function load(){try{const r=JSON.parse(localStorage.getItem('eh-map'));if(r&&r.tokens)return r}catch(e){}
  return{tokens:{foe1:{n:'Raider',x:12,y:6,t:'foe'}},tiles:{'8,5':3,'8,6':3,'8,7':3,'14,3':5,'14,4':1}}}
function persist(){try{localStorage.setItem('eh-map',JSON.stringify(M))}catch(e){}}
function link(){
  const r=window.EHParty&&EHParty.ref&&EHParty.ref(),code=r?r.key:'';
  if(code===listening)return;
  if(ref)ref.off();
  listening=code;ref=r?r.child('map'):null;
  if(ref)ref.on('value',s=>{
    const v=s.val();
    if(v){M.tokens=v.tokens||{};M.tiles=v.tiles||{}}else ref.set({tokens:M.tokens,tiles:M.tiles});
    persist();if(S.mode==='map'&&!drag)render();
  });
}
const putTok=id=>{persist();if(ref)ref.child('tokens/'+id).set(M.tokens[id])};
const putTile=k=>{persist();if(ref){const v=M.tiles[k];v?ref.child('tiles/'+k).set(v):ref.child('tiles/'+k).remove()}};
const can=id=>S.gm||id===S.pid;
function free(x,y){return!Object.values(M.tokens).some(t=>t.x===x&&t.y===y)}
function ensure(){
  if(!S.pid)S.pid='p'+Math.random().toString(36).slice(2,10);
  const nm=S.name||'Me';let t=M.tokens[S.pid];
  if(!t){
    const n=Object.values(M.tokens).filter(t=>t.t==='pc').length;
    let y=6;while(!free(2,y)&&y<H-1)y++;
    M.tokens[S.pid]=t={n:nm,x:2,y,t:'pc',c:n%COLS.length};putTok(S.pid);
  }else if(t.n!==nm){t.n=nm;putTok(S.pid)}
}
function tokenAt(x,y){return Object.keys(M.tokens).find(id=>M.tokens[id].x===x&&M.tokens[id].y===y)}
function cells(a,b,c,d){
  const out=[];let dx=Math.abs(c-a),dy=Math.abs(d-b),sx=a<c?1:-1,sy=b<d?1:-1,e=dx-dy,x=a,y=b;
  while(x!==c||y!==d){const e2=2*e;if(e2>-dy){e-=dy;x+=sx}if(e2<dx){e+=dx;y+=sy}out.push([x,y])}
  return out;
}
function info(){
  const a=M.tokens[S.pid],b=sel&&M.tokens[sel];
  if(!a||!b||sel===S.pid)return null;
  const d=Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y)),ft=d*5,band=ft<=5?0:ft<=30?1:ft<=90?2:ft<=180?3:4;
  let cov=0;for(const[x,y]of cells(a.x,a.y,b.x,b.y))cov=Math.max(cov,M.tiles[x+','+y]||0);
  return{d,ft,band,cov};
}
function inner(){
  let s='';const ln='style="stroke:var(--line);stroke-width:1"';
  for(let x=0;x<=W;x++)s+=`<line x1="${x*CS}" y1="0" x2="${x*CS}" y2="${H*CS}" ${ln}/>`;
  for(let y=0;y<=H;y++)s+=`<line x1="0" y1="${y*CS}" x2="${W*CS}" y2="${y*CS}" ${ln}/>`;
  for(const k in M.tiles){
    const[x,y]=k.split(',').map(Number),v=M.tiles[k];
    s+=`<rect x="${x*CS+1}" y="${y*CS+1}" width="${CS-2}" height="${CS-2}" style="fill:var(--flag);fill-opacity:${v===5?.75:v===3?.45:.22}"/><text x="${x*CS+CS/2}" y="${y*CS+CS/2+4}" text-anchor="middle" style="font:600 11px var(--f-mono);fill:var(--ink)">+${v}</text>`;
  }
  const a=M.tokens[S.pid],b=sel&&M.tokens[sel],i=info();
  if(i){
    const x1=a.x*CS+CS/2,y1=a.y*CS+CS/2,x2=b.x*CS+CS/2,y2=b.y*CS+CS/2;
    s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--arc);stroke-width:2;stroke-dasharray:6 4"/><text x="${(x1+x2)/2}" y="${(y1+y2)/2-6}" text-anchor="middle" style="font:600 12px var(--f-mono);fill:var(--ink);stroke:var(--bg);stroke-width:4;paint-order:stroke">${i.ft} ft</text>`;
  }
  for(const id in M.tokens){
    const t=M.tokens[id],fill=t.t==='foe'?'#d9645c':COLS[(t.c||0)%COLS.length],me=id===S.pid;
    s+=`<g data-tok="${id}" transform="translate(${t.x*CS},${t.y*CS})" style="cursor:${can(id)?'grab':'pointer'}"><circle cx="${CS/2}" cy="${CS/2}" r="${CS*.4}" fill="${fill}" style="stroke:${id===sel?'var(--ink)':me?'var(--arc)':'var(--bg)'};stroke-width:${id===sel?3:me?3:1.5}"/><text x="${CS/2}" y="${CS/2+5}" text-anchor="middle" style="font:800 15px var(--f-body);fill:#0b1117;pointer-events:none">${esc((t.n||'?').slice(0,1).toUpperCase())}</text><text x="${CS/2}" y="${CS-2}" text-anchor="middle" style="font:600 10px var(--f-mono);fill:var(--ink);stroke:var(--bg);stroke-width:3;paint-order:stroke;pointer-events:none">${esc((t.n||'').slice(0,9))}</text></g>`;
  }
  return s;
}
function view(){
  link();ensure();
  const i=info(),t=sel&&M.tokens[sel];
  let h=`<h2>Map</h2><p class="lede">Drag your token to move. Tap another token to measure. 1 square = 5 ft, so Speed 3 is 6 squares. <span class="chip ${ref?'':'flag'}">${ref?'Synced with party '+esc(listening):'Local only. Join a party to share it.'}</span></p>
  <svg id="mapsvg" viewBox="0 0 ${W*CS} ${H*CS}" style="width:100%;height:auto;display:block;touch-action:none;background:var(--bg);border:1px solid var(--line);border-radius:5px">${inner()}</svg>`;
  if(t){
    h+=`<div class="pcard" style="margin-top:12px"><h4>${esc(t.n)} ${sel===S.pid?'<span class="chip">you</span>':''}${t.t==='foe'?'<span class="chip flag">enemy</span>':''}</h4>`;
    if(i){
      h+=`<div class="sub2">${i.d} squares · ${i.ft} ft · ${BANDS[i.band]} (${BANDX[i.band]}) · cover ${i.cov?COVN[i.cov]:'none'}</div>
      <div class="actions" style="margin:0"><button class="btn primary" data-a="mapuse">Use in Attack tab</button>`;
    }else h+=`<div class="sub2">${sel===S.pid?'This is you.':''}</div><div class="actions" style="margin:0">`;
    if(S.gm&&sel!==S.pid)h+=`<button class="btn" data-a="mapdel">Remove token</button>`;
    h+=`</div></div>`;
  }
  h+=`<h3>GM tools</h3><div class="pillrow"><button class="pill" data-a="mapgm" aria-pressed="${!!S.gm}">GM mode</button>`;
  if(S.gm){
    h+=`<button class="pill" data-a="mapfoe">Add enemy</button>`+[['move','Move'],['0','Erase cover'],['1','Paint +1'],['3','Paint +3'],['5','Paint +5']].map(([v,n])=>`<button class="pill" data-a="maptool" data-v="${v}" aria-pressed="${tool===v}">${n}</button>`).join('');
  }
  h+=`</div><ul class="assump"><li>Distance counts diagonals as 1 square (5 ft). Assumed rule.</li><li>Cover is the strongest cover tile on the line to the target, including the target's own square. Assumed rule.</li><li>Range bands: Engaged 5 ft, Close 30, Medium 90, Long 180, Extreme beyond.</li></ul>`;
  return h;
}
function act(a,t){
  if(a==='mapgm')S.gm=!S.gm,tool='move';
  else if(a==='maptool')tool=t.dataset.v;
  else if(a==='mapfoe'){
    const id='f'+Math.random().toString(36).slice(2,6);let x=10,y=6;while(!free(x,y)&&x<W-1)x++;
    const n=Object.values(M.tokens).filter(t=>t.t==='foe').length+1;
    M.tokens[id]={n:'Enemy '+n,x,y,t:'foe'};putTok(id);sel=id;
  }else if(a==='mapdel'&&S.gm&&sel&&sel!==S.pid){
    delete M.tokens[sel];persist();if(ref)ref.child('tokens/'+sel).remove();sel=null;
  }else if(a==='mapuse'){
    const i=info();if(!i)return;const p=PL();
    p.band=i.band;p.tcover=i.cov;S.mode='play';
    setRes('Range set from map',[`${i.ft} ft: ${BANDS[i.band]}. Target cover ${i.cov?COVN[i.cov]:'none'}.`],'neutral');
  }
}
function cellAt(e,svg){const r=svg.getBoundingClientRect();return[clampc(Math.floor((e.clientX-r.left)/r.width*W),0,W-1),clampc(Math.floor((e.clientY-r.top)/r.height*H),0,H-1)]}
const clampc=(v,a,b)=>Math.max(a,Math.min(b,v));
function paint(x,y){
  const k=x+','+y,v=+tool;
  if(v)M.tiles[k]=v;else delete M.tiles[k];
  putTile(k);document.getElementById('mapsvg').innerHTML=inner();
}
document.addEventListener('pointerdown',e=>{
  const svg=e.target.closest&&e.target.closest('#mapsvg');if(!svg||S.mode!=='map')return;
  const[x,y]=cellAt(e,svg);
  if(S.gm&&tool!=='move'){drag={paint:true};paint(x,y);svg.setPointerCapture(e.pointerId);e.preventDefault();return}
  const id=tokenAt(x,y);
  if(!id){if(sel){sel=null;render()}return}
  sel=id;
  drag={id,x0:M.tokens[id].x,y0:M.tokens[id].y,moved:false,can:can(id)};
  svg.setPointerCapture(e.pointerId);e.preventDefault();
});
document.addEventListener('pointermove',e=>{
  if(!drag||S.mode!=='map')return;
  const svg=document.getElementById('mapsvg');if(!svg)return;
  const[x,y]=cellAt(e,svg);
  if(drag.paint){if(drag.lx!==x||drag.ly!==y){drag.lx=x;drag.ly=y;paint(x,y)}return}
  if(!drag.can)return;
  const t=M.tokens[drag.id];
  if((x!==t.x||y!==t.y)&&(free(x,y))){t.x=x;t.y=y;drag.moved=true;svg.innerHTML=inner()}
});
function end(){
  if(!drag)return;const d=drag;drag=null;
  if(d.moved)putTok(d.id);
  render();
}
document.addEventListener('pointerup',end);
document.addEventListener('pointercancel',end);
window.EHMap={view,act};
render();
})();
