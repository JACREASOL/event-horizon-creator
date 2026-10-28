/* Shared battle maps. Local-only until you join a party, then synced through Firebase (parties/CODE/mapdata, mapbg). */
(function(){
const W=20,H=14,CS=40,COLS=['#46d2c2','#e3a64e','#b79cf0','#7fd38a','#6fb7f0','#f0c76f'];
const COVN={1:'Partial +1',3:'Half +3',5:'Full +5'};
const seed=()=>({active:'m1',maps:{m1:{n:'Test arena',tokens:{foe1:{n:'Raider',x:12,y:6,t:'foe'}},tiles:{'8,5':3,'8,6':3,'8,7':3,'14,3':5,'14,4':1}}}});
let M=load(),bg=loadBg(),sel=null,tool='move',ref=null,bgref=null,listening='',ready=true,drag=null,confirmDel=false,msg='';
function load(){
  try{const r=JSON.parse(localStorage.getItem('eh-map2'));if(r&&r.maps)return r;
    const o=JSON.parse(localStorage.getItem('eh-map'));if(o&&o.tokens)return{active:'m1',maps:{m1:{n:'Map 1',tokens:o.tokens,tiles:o.tiles||{}}}}}catch(e){}
  return seed();
}
function loadBg(){try{return JSON.parse(localStorage.getItem('eh-mapbg'))||{}}catch(e){return{}}}
function persist(){try{localStorage.setItem('eh-map2',JSON.stringify(M))}catch(e){}}
function cur(){
  if(!M.maps||!Object.keys(M.maps).length)M=seed();
  if(!M.maps[M.active])M.active=Object.keys(M.maps)[0];
  const m=M.maps[M.active];m.tokens=m.tokens||{};m.tiles=m.tiles||{};return m;
}
const T=()=>cur().tokens,TL=()=>cur().tiles,mp=()=>'maps/'+M.active;
function link(){
  const r=window.EHParty&&EHParty.ref&&EHParty.ref(),code=r?r.key:'';
  if(code===listening)return;
  if(ref)ref.off();if(bgref)bgref.off();
  listening=code;ref=r?r.child('mapdata'):null;bgref=r?r.child('mapbg'):null;
  if(!r)bg=loadBg();
  if(ref)ready=false;else ready=true;
  if(ref)ref.on('value',s=>{
    const v=s.val();
    if(v&&v.maps)M={active:v.active||Object.keys(v.maps)[0],maps:v.maps};else ref.set(M);
    ready=true;persist();if(S.mode==='map'&&!drag)render();
  });
  if(bgref)bgref.on('value',s=>{bg=s.val()||{};if(S.mode==='map'&&!drag)render()});
}
const putTok=id=>{persist();if(ref)ref.child(mp()+'/tokens/'+id).set(T()[id])};
const putTile=k=>{persist();if(ref){const v=TL()[k];v?ref.child(mp()+'/tiles/'+k).set(v):ref.child(mp()+'/tiles/'+k).remove()}};
function setBg(id,url){
  if(url)bg[id]=url;else delete bg[id];
  if(bgref)url?bgref.child(id).set(url):bgref.child(id).remove();
  else try{localStorage.setItem('eh-mapbg',JSON.stringify(bg))}catch(e){msg='Image too big to keep on this device.'}
}
const can=id=>S.gm||id===S.pid;
function free(x,y){return!Object.values(T()).some(t=>t.x===x&&t.y===y)}
function ensure(){
  if(!S.pid)S.pid='p'+Math.random().toString(36).slice(2,10);
  const nm=S.name||'Me';let t=T()[S.pid];
  if(!t){
    const n=Object.values(T()).filter(t=>t.t==='pc').length;
    let y=6;while(!free(2,y)&&y<H-1)y++;
    T()[S.pid]=t={n:nm,x:2,y,t:'pc',c:n%COLS.length};putTok(S.pid);
  }else if(t.n!==nm){t.n=nm;putTok(S.pid)}
}
function tokenAt(x,y){return Object.keys(T()).find(id=>T()[id].x===x&&T()[id].y===y)}
function cells(a,b,c,d){
  const out=[];let dx=Math.abs(c-a),dy=Math.abs(d-b),sx=a<c?1:-1,sy=b<d?1:-1,e=dx-dy,x=a,y=b;
  while(x!==c||y!==d){const e2=2*e;if(e2>-dy){e-=dy;x+=sx}if(e2<dx){e+=dx;y+=sy}out.push([x,y])}
  return out;
}
function info(){
  const a=T()[S.pid],b=sel&&T()[sel];
  if(!a||!b||sel===S.pid)return null;
  const d=Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y)),ft=d*5,band=ft<=5?0:ft<=30?1:ft<=90?2:ft<=180?3:4;
  let cov=0;for(const[x,y]of cells(a.x,a.y,b.x,b.y))cov=Math.max(cov,TL()[x+','+y]||0);
  return{d,ft,band,cov};
}
function inner(){
  const img=bg[M.active];
  let s=img?`<image href="${img}" x="0" y="0" width="${W*CS}" height="${H*CS}" preserveAspectRatio="none"/>`:'';
  const ln=`style="stroke:var(--line);stroke-width:1;stroke-opacity:${img?.55:1}"`;
  for(let x=0;x<=W;x++)s+=`<line x1="${x*CS}" y1="0" x2="${x*CS}" y2="${H*CS}" ${ln}/>`;
  for(let y=0;y<=H;y++)s+=`<line x1="0" y1="${y*CS}" x2="${W*CS}" y2="${y*CS}" ${ln}/>`;
  for(const k in TL()){
    const[x,y]=k.split(',').map(Number),v=TL()[k];
    s+=`<rect x="${x*CS+1}" y="${y*CS+1}" width="${CS-2}" height="${CS-2}" style="fill:var(--flag);fill-opacity:${v===5?.75:v===3?.45:.22}"/><text x="${x*CS+CS/2}" y="${y*CS+CS/2+4}" text-anchor="middle" style="font:600 11px var(--f-mono);fill:var(--ink);stroke:var(--bg);stroke-width:3;paint-order:stroke">+${v}</text>`;
  }
  const a=T()[S.pid],b=sel&&T()[sel],i=info();
  if(i){
    const x1=a.x*CS+CS/2,y1=a.y*CS+CS/2,x2=b.x*CS+CS/2,y2=b.y*CS+CS/2;
    s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--arc);stroke-width:2;stroke-dasharray:6 4"/><text x="${(x1+x2)/2}" y="${(y1+y2)/2-6}" text-anchor="middle" style="font:600 12px var(--f-mono);fill:var(--ink);stroke:var(--bg);stroke-width:4;paint-order:stroke">${i.ft} ft</text>`;
  }
  for(const id in T()){
    const t=T()[id],fill=t.t==='foe'?'#d9645c':COLS[(t.c||0)%COLS.length],me=id===S.pid;
    s+=`<g data-tok="${id}" transform="translate(${t.x*CS},${t.y*CS})" style="cursor:${can(id)?'grab':'pointer'}"><circle cx="${CS/2}" cy="${CS/2}" r="${CS*.4}" fill="${fill}" style="stroke:${id===sel?'var(--ink)':me?'var(--arc)':'var(--bg)'};stroke-width:${id===sel?3:me?3:1.5}"/><text x="${CS/2}" y="${CS/2+5}" text-anchor="middle" style="font:800 15px var(--f-body);fill:#0b1117;pointer-events:none">${esc((t.n||'?').slice(0,1).toUpperCase())}</text><text x="${CS/2}" y="${CS-2}" text-anchor="middle" style="font:600 10px var(--f-mono);fill:var(--ink);stroke:var(--bg);stroke-width:3;paint-order:stroke;pointer-events:none">${esc((t.n||'').slice(0,9))}</text></g>`;
  }
  return s;
}
function view(){
  link();if(ready)ensure();
  const i=info(),t=sel&&T()[sel],ids=Object.keys(M.maps);
  let h=`<h2>${esc(cur().n||'Map')}</h2><p class="lede">Drag your token to move. Tap another token to measure. 1 square = 5 ft, so Speed 3 is 6 squares. <span class="chip ${ref?'':'flag'}">${ref?'Synced with party '+esc(listening):'Local only. Join a party to share it.'}</span></p>
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
  h+=`<h3>GM tools</h3><div class="pillrow"><button class="pill" data-a="mapgm" aria-pressed="${!!S.gm}">GM mode</button></div>`;
  if(S.gm){
    h+=`<h3>Maps</h3><div class="pillrow">${ids.map(id=>`<button class="pill" data-a="mapswitch" data-v="${id}" aria-pressed="${id===M.active}">${esc(M.maps[id].n||'Map')}</button>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:8px"><input type="text" id="mapname" placeholder="New map name" autocomplete="off" style="flex:1"><button class="btn" data-a="mapnew">Add map</button></div>
    <div class="actions"><button class="btn" data-a="mapbg">${bg[M.active]?'Change background':'Set background image'}</button>${bg[M.active]?'<button class="btn" data-a="mapbgclear">Remove background</button>':''}${ids.length>1?`<button class="btn" data-a="mapkill">${confirmDel?'Tap again to delete this map':'Delete this map'}</button>`:''}</div>
    <input type="file" id="mapbgfile" accept="image/*" hidden>
    <h3>Tools</h3><div class="pillrow"><button class="pill" data-a="mapfoe">Add enemy</button>${[['move','Move'],['0','Erase cover'],['1','Paint +1'],['3','Paint +3'],['5','Paint +5']].map(([v,n])=>`<button class="pill" data-a="maptool" data-v="${v}" aria-pressed="${tool===v}">${n}</button>`).join('')}</div>`;
  }
  if(msg)h+=`<div class="meter" aria-live="polite" style="margin-top:8px">${esc(msg)}</div>`;
  h+=`<ul class="assump"><li>Only the GM can switch maps. Players are placed on the new map automatically.</li><li>Distance counts diagonals as 1 square (5 ft). Assumed rule.</li><li>Cover is the strongest cover tile on the line to the target, including the target's own square. Assumed rule.</li><li>Range bands: Engaged 5 ft, Close 30, Medium 90, Long 180, Extreme beyond.</li></ul>`;
  return h;
}
function act(a,t){
  msg='';if(a!=='mapkill')confirmDel=false;
  if(a==='mapgm'){S.gm=!S.gm;tool='move'}
  else if(a==='maptool')tool=t.dataset.v;
  else if(a==='mapfoe'){
    const id='f'+Math.random().toString(36).slice(2,6);let x=10,y=6;while(!free(x,y)&&x<W-1)x++;
    const n=Object.values(T()).filter(t=>t.t==='foe').length+1;
    T()[id]={n:'Enemy '+n,x,y,t:'foe'};putTok(id);sel=id;
  }else if(a==='mapdel'&&S.gm&&sel&&sel!==S.pid){
    delete T()[sel];persist();if(ref)ref.child(mp()+'/tokens/'+sel).remove();sel=null;
  }else if(a==='mapswitch'&&S.gm){
    M.active=t.dataset.v;sel=null;persist();if(ref)ref.child('active').set(M.active);
  }else if(a==='mapnew'&&S.gm){
    const nm=((document.getElementById('mapname')||{}).value||'').trim()||('Map '+(Object.keys(M.maps).length+1)),id='m'+Math.random().toString(36).slice(2,6);
    M.maps[id]={n:nm,tokens:{},tiles:{}};M.active=id;sel=null;persist();
    if(ref){ref.child('maps/'+id).set({n:nm});ref.child('active').set(id)}
  }else if(a==='mapkill'&&S.gm){
    if(!confirmDel){confirmDel=true;return}
    confirmDel=false;const id=M.active;delete M.maps[id];M.active=Object.keys(M.maps)[0];sel=null;setBg(id,null);persist();
    if(ref){ref.child('maps/'+id).remove();ref.child('active').set(M.active)}
  }else if(a==='mapbg'){const f=document.getElementById('mapbgfile');if(f)f.click()}
  else if(a==='mapbgclear')setBg(M.active,null);
  else if(a==='mapuse'){
    const i=info();if(!i)return;const p=PL();
    p.band=i.band;p.tcover=i.cov;S.mode='play';
    setRes('Range set from map',[`${i.ft} ft: ${BANDS[i.band]}. Target cover ${i.cov?COVN[i.cov]:'none'}.`],'neutral');
  }
}
function cellAt(e,svg){const r=svg.getBoundingClientRect();return[clampc(Math.floor((e.clientX-r.left)/r.width*W),0,W-1),clampc(Math.floor((e.clientY-r.top)/r.height*H),0,H-1)]}
const clampc=(v,a,b)=>Math.max(a,Math.min(b,v));
function paint(x,y){
  const k=x+','+y,v=+tool;
  if(v)TL()[k]=v;else delete TL()[k];
  putTile(k);document.getElementById('mapsvg').innerHTML=inner();
}
document.addEventListener('change',e=>{
  if(!e.target||e.target.id!=='mapbgfile'||!e.target.files||!e.target.files[0])return;
  const f=e.target.files[0],u=URL.createObjectURL(f),img=new Image(),id=M.active;
  img.onload=()=>{
    const c=document.createElement('canvas');c.width=1000;c.height=700;
    const g=c.getContext('2d'),sc=Math.max(1000/img.width,700/img.height),w=img.width*sc,h=img.height*sc;
    g.drawImage(img,(1000-w)/2,(700-h)/2,w,h);URL.revokeObjectURL(u);
    setBg(id,c.toDataURL('image/jpeg',.7));render();
  };
  img.onerror=()=>{msg='Could not read that image.';render()};
  img.src=u;e.target.value='';
});
document.addEventListener('pointerdown',e=>{
  const svg=e.target.closest&&e.target.closest('#mapsvg');if(!svg||S.mode!=='map')return;
  const[x,y]=cellAt(e,svg);
  if(S.gm&&tool!=='move'){drag={paint:true};paint(x,y);svg.setPointerCapture(e.pointerId);e.preventDefault();return}
  const id=tokenAt(x,y);
  if(!id){if(sel){sel=null;render()}return}
  sel=id;
  drag={id,moved:false,can:can(id)};
  svg.setPointerCapture(e.pointerId);e.preventDefault();
});
document.addEventListener('pointermove',e=>{
  if(!drag||S.mode!=='map')return;
  const svg=document.getElementById('mapsvg');if(!svg)return;
  const[x,y]=cellAt(e,svg);
  if(drag.paint){if(drag.lx!==x||drag.ly!==y){drag.lx=x;drag.ly=y;paint(x,y)}return}
  if(!drag.can)return;
  const t=T()[drag.id];
  if(t&&(x!==t.x||y!==t.y)&&free(x,y)){t.x=x;t.y=y;drag.moved=true;svg.innerHTML=inner()}
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
