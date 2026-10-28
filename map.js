/* Shared battle maps. Local-only until you join a party, then synced through Firebase (parties/CODE/mapdata, mapbg). */
(function(){
const CS=40,COLS=['#46d2c2','#e3a64e','#b79cf0','#7fd38a','#6fb7f0','#f0c76f'];
const COVN={1:'Partial +1',3:'Half +3',5:'Full +5'};
const seed=()=>({active:'m1',maps:{m1:{n:'Test arena',tokens:{foe1:{n:'Raider',x:12,y:6,t:'foe'}},tiles:{'8,5':3,'8,6':3,'8,7':3,'14,3':5,'14,4':1}}}});
let Z={z:1,x:0,y:0},pts={},pinch=null;
let fs=false,apiFs=false,menu=false;
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
const clampc=(v,a,b)=>Math.max(a,Math.min(b,v));
const dm=()=>{const m=cur();return{w:m.w||20,h:m.h||14}};
function vb(){const{w,h}=dm(),vw=w*CS/Z.z,vh=h*CS/Z.z;Z.x=clampc(Z.x,0,w*CS-vw);Z.y=clampc(Z.y,0,h*CS-vh);return[Z.x,Z.y,vw,vh]}
function applyVb(){const s=document.getElementById('mapsvg');if(s)s.setAttribute('viewBox',vb().join(' '))}
function zoomAt(f,fx,fy){const[x,y,vw,vh]=vb(),{w,h}=dm(),nz=clampc(Z.z*f,1,5),px=x+fx*vw,py=y+fy*vh;Z.z=nz;Z.x=px-fx*w*CS/nz;Z.y=py-fy*h*CS/nz;applyVb()}
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
const okImg=u=>typeof u==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(u);
let imgTarget=null;
['mapbgfile','tokimgfile'].forEach(id=>{if(document.getElementById(id))return;const i=document.createElement('input');i.type='file';i.accept='image/*';i.id=id;i.hidden=true;document.body.appendChild(i)});
const can=id=>S.gm||id===S.pid;
function free(x,y){return!Object.values(T()).some(t=>t.x===x&&t.y===y)}
function ensure(){
  if(!S.pid)S.pid='p'+Math.random().toString(36).slice(2,10);
  const nm=S.name||'Me';let t=T()[S.pid];
  const pic=S.portrait||'';
  if(!t){
    const n=Object.values(T()).filter(t=>t.t==='pc').length;
    let y=6;while(!free(2,y)&&y<dm().h-1)y++;
    T()[S.pid]=t={n:nm,x:2,y,t:'pc',c:n%COLS.length};if(pic)t.img=pic;putTok(S.pid);
  }else if(t.n!==nm||(t.img||'')!==pic){t.n=nm;if(pic)t.img=pic;else delete t.img;putTok(S.pid)}
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
  const{w:W,h:H}=dm(),img=okImg(bg[M.active])?bg[M.active]:'';
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
    const ring=`style="fill:none;stroke:${id===sel?'var(--ink)':me?'var(--arc)':'var(--bg)'};stroke-width:${id===sel?3:me?3:1.5}"`;
    s+=`<g data-tok="${id}" transform="translate(${t.x*CS},${t.y*CS})" style="cursor:${can(id)?'grab':'pointer'}"><circle cx="${CS/2}" cy="${CS/2}" r="${CS*.4}" fill="${fill}"/>${okImg(t.img)?`<clipPath id="cp${id}"><circle cx="${CS/2}" cy="${CS/2}" r="${CS*.4}"/></clipPath><image href="${t.img}" x="${CS*.1}" y="${CS*.1}" width="${CS*.8}" height="${CS*.8}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cp${id})" style="pointer-events:none"/>`:`<text x="${CS/2}" y="${CS/2+5}" text-anchor="middle" style="font:800 15px var(--f-body);fill:#0b1117;pointer-events:none">${esc((t.n||'?').slice(0,1).toUpperCase())}</text>`}<circle cx="${CS/2}" cy="${CS/2}" r="${CS*.4}" ${ring}/><text x="${CS/2}" y="${CS-2}" text-anchor="middle" style="font:600 10px var(--f-mono);fill:var(--ink);stroke:var(--bg);stroke-width:3;paint-order:stroke;pointer-events:none">${esc((t.n||'').slice(0,9))}</text></g>`;
  }
  return s;
}
function view(){
  link();if(ready)ensure();
  if(fs)return fsView();
  const i=info(),t=sel&&T()[sel],ids=Object.keys(M.maps),{w:W,h:H}=dm();
  let h=`<h2>${esc(cur().n||'Map')}</h2><p class="lede">Drag your token to move. Tap another token to measure. 1 square = 5 ft, so Speed 3 is 6 squares. <span class="chip ${ref?'':'flag'}">${ref?'Synced with party '+esc(listening):'Local only. Join a party to share it.'}</span></p>
  <svg id="mapsvg" viewBox="${vb().join(' ')}" style="width:100%;height:auto;display:block;touch-action:none;background:var(--bg);border:1px solid var(--line);border-radius:5px">${inner()}</svg>
  <div class="actions" style="margin:8px 0 0;align-items:center"><button class="btn" data-a="mapzout" aria-label="Zoom out">−</button><button class="btn" data-a="mapzfit">Fit</button><button class="btn" data-a="mapzin" aria-label="Zoom in">+</button><button class="btn primary" data-a="mapfs">Full screen</button><span class="meter">${Z.z>1?Math.round(Z.z*100)+'%. ':''}Pinch or scroll to zoom. Drag empty space to pan.</span></div>`;
  if(t){
    h+=`<div class="pcard" style="margin-top:12px"><h4>${esc(t.n)} ${sel===S.pid?'<span class="chip">you</span>':''}${t.t==='foe'?'<span class="chip flag">enemy</span>':''}</h4>`;
    if(i){
      h+=`<div class="sub2">${i.d} squares · ${i.ft} ft · ${BANDS[i.band]} (${BANDX[i.band]}) · cover ${i.cov?COVN[i.cov]:'none'}</div>
      <div class="actions" style="margin:0"><button class="btn primary" data-a="mapuse">Use in Attack tab</button>`;
    }else h+=`<div class="sub2">${sel===S.pid?'This is you.':''}</div><div class="actions" style="margin:0">`;
    if(S.gm&&sel!==S.pid)h+=`<button class="btn" data-a="mapdel">Remove token</button>`;
    if(can(sel))h+=`<button class="btn" data-a="maptokimg">${t.img?'Change picture':'Set picture'}</button>${t.img?'<button class="btn" data-a="maptokimgclear">Remove picture</button>':''}`;
    h+=`</div></div>`;
  }
  h+=`<h3>GM tools</h3><div class="pillrow"><button class="pill" data-a="mapgm" aria-pressed="${!!S.gm}">GM mode</button></div>`;
  if(S.gm){
    h+=`<h3>Maps</h3><div class="pillrow">${ids.map(id=>`<button class="pill" data-a="mapswitch" data-v="${id}" aria-pressed="${id===M.active}">${esc(M.maps[id].n||'Map')}</button>`).join('')}</div>
    <div style="display:flex;gap:8px;margin-top:8px"><input type="text" id="mapname" placeholder="New map name" autocomplete="off" style="flex:1"><button class="btn" data-a="mapnew">Add map</button></div>
    <div class="actions"><button class="btn" data-a="mapbg">${bg[M.active]?'Change background':'Set background image'}</button>${bg[M.active]?'<button class="btn" data-a="mapbgclear">Remove background</button>':''}${ids.length>1?`<button class="btn" data-a="mapkill">${confirmDel?'Tap again to delete this map':'Delete this map'}</button>`:''}</div>
    <h3>Map size</h3><div class="row"><span class="lab">Width<small>${W} squares · ${W*5} ft</small></span><span class="step"><button data-a="mapw" data-d="-1">−</button><output>${W}</output><button data-a="mapw" data-d="1">+</button></span></div>
    <div class="row"><span class="lab">Height<small>${H} squares · ${H*5} ft</small></span><span class="step"><button data-a="maph" data-d="-1">−</button><output>${H}</output><button data-a="maph" data-d="1">+</button></span></div>
    <p class="lede" style="font-size:13px;margin:4px 0 0">Resize before adding a background, or the picture will stretch.</p>
    <h3>Tools</h3><div class="pillrow"><button class="pill" data-a="mapfoe">Add enemy</button>${[['move','Move'],['0','Erase cover'],['1','Paint +1'],['3','Paint +3'],['5','Paint +5']].map(([v,n])=>`<button class="pill" data-a="maptool" data-v="${v}" aria-pressed="${tool===v}">${n}</button>`).join('')}</div>`;
  }
  if(msg)h+=`<div class="meter" aria-live="polite" style="margin-top:8px">${esc(msg)}</div>`;
  h+=`<ul class="assump"><li>Zoom and pan are only for your own screen.</li><li>Only the GM can switch maps. Players are placed on the new map automatically.</li><li>Distance counts diagonals as 1 square (5 ft). Assumed rule.</li><li>Cover is the strongest cover tile on the line to the target, including the target's own square. Assumed rule.</li><li>Range bands: Engaged 5 ft, Close 30, Medium 90, Long 180, Extreme beyond.</li></ul>`;
  return h;
}

function focusMe(){
  const m=T()[S.pid];if(!m)return;
  const{w,h}=dm();Z.z=clampc(Math.max(Z.z,Math.min(3,Math.max(w,h)/6)),1,5);
  Z.x=m.x*CS+CS/2-w*CS/Z.z/2;Z.y=m.y*CS+CS/2-h*CS/Z.z/2;
}
function learned(){
  const out=[];
  for(const at in SKILLS)for(const s in SKILLS[at])for(const x of SKILLS[at][s]){
    const r=abRank(s,x)||(S.freeAb===abKey(s,x)?1:0);
    if(r&&AB[x])out.push({s,x,r,fx:AB[x](r)});
  }
  return out;
}
function fsView(){
  const me=T()[S.pid]||{n:'Me'},i=info(),t=sel&&T()[sel],p=PL(),{w,h}=dm();
  const sc=Math.min(innerWidth/w,innerHeight/h),res=p.res;
  const av=okImg(me.img)?`<img src="${me.img}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`:`<span style="font:700 26px var(--f-body);color:var(--ink)">${esc((me.n||'?').slice(0,1).toUpperCase())}</span>`;
  const top='calc(env(safe-area-inset-top,0px) + 8px)',bot='calc(env(safe-area-inset-bottom,0px) + 8px)';
  const box='background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:6px 9px';
  let h2=`<div id="mapfsbox" style="position:fixed;inset:0;z-index:60;background:var(--bg);display:flex;align-items:center;justify-content:center;overflow:hidden">
  <svg id="mapsvg" viewBox="${vb().join(' ')}" style="width:${Math.floor(w*sc)}px;height:${Math.floor(h*sc)}px;display:block;touch-action:none;background:var(--bg)">${inner()}</svg>
  <div style="position:absolute;top:${top};left:8px;right:8px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;pointer-events:none">
    <div style="display:flex;gap:8px;align-items:center;pointer-events:auto"><button data-a="mapmenu" title="Tap for actions" aria-label="Open actions" aria-expanded="${menu}" style="width:64px;height:64px;border-radius:50%;padding:0;border:3px solid var(--arc);background:var(--panel);overflow:hidden;cursor:pointer;display:flex;align-items:center;justify-content:center">${av}</button>
    <div style="${box};font:600 12px var(--f-mono);color:var(--ink)">${esc(me.n||'Me')}<br>HP ${p.hp}/${p.hpMax}<br>Arc ${p.arc}</div></div>
    <div style="display:flex;gap:4px;pointer-events:auto"><button class="btn" style="padding:6px 10px" data-a="mapzout" aria-label="Zoom out">−</button><button class="btn" style="padding:6px 10px" data-a="mapzin" aria-label="Zoom in">+</button><button class="btn" style="padding:6px 10px" data-a="mapctr" aria-label="Center on me">◎</button><button class="btn" style="padding:6px 10px" data-a="mapfsx" aria-label="Exit full screen">✕</button></div>
  </div>`;
  if(res){
    const col=res.tone==='good'?'var(--arc)':res.tone==='bad'?'var(--bad)':'var(--muted)';
    h2+=`<div aria-live="polite" style="position:absolute;top:calc(env(safe-area-inset-top,0px) + 86px);left:8px;right:8px;max-width:520px;${box};border-left:5px solid ${col};background:var(--panel);color:var(--ink);font:13px var(--f-body)"><div style="display:flex;justify-content:space-between;gap:8px"><strong>${esc(res.h)}</strong><button class="btn" data-a="maptoastx" aria-label="Dismiss" style="padding:2px 8px">✕</button></div>${(res.lines||[]).map(l=>`<div style="margin-top:3px">${esc(l)}</div>`).join('')}</div>`;
  }
  if(!menu&&t&&sel!==S.pid){
    h2+=`<div style="position:absolute;left:8px;bottom:${bot};${box};color:var(--ink);font:13px var(--f-body)"><strong>${esc(t.n)}</strong>${t.t==='foe'?' <span class="chip flag">enemy</span>':''}<div class="sub2">${i?`${i.ft} ft · ${BANDS[i.band]} · cover ${i.cov?COVN[i.cov]:'none'}`:''}</div>${i&&t.t==='foe'?'<div class="actions" style="margin:6px 0 0"><button class="btn primary" data-a="mapatk">Attack</button></div>':''}</div>`;
  }
  if(menu){
    const w0=WEAPONS[p.wi],ab=learned(),sk=[];
    for(const at in SKILLS)for(const s in SKILLS[at])if(skillRank(s)>0)sk.push(s);
    h2+=`<div role="dialog" aria-label="Actions" style="position:absolute;left:0;right:0;bottom:0;max-height:64vh;overflow:auto;background:var(--panel);border-top:2px solid var(--arc);padding:12px 12px calc(env(safe-area-inset-bottom,0px) + 12px);color:var(--ink);font:14px var(--f-body)">
    <div style="display:flex;justify-content:space-between;align-items:center"><strong>${esc(me.n||'Me')} · actions</strong><button class="btn" data-a="mapmenu">Close</button></div>
    <div class="sub2" style="margin:6px 0">${t&&sel!==S.pid&&i?`Target: ${esc(t.n)}, ${i.ft} ft, ${BANDS[i.band]}, cover ${i.cov?COVN[i.cov]:'none'}`:'No target. Tap an enemy on the map to select one.'}</div>
    <h4 style="margin:8px 0 4px">Weapon</h4><div class="pillrow">${WEAPONS.map((x,k)=>`<button class="pill" data-a="mapwpn" data-v="${k}" aria-pressed="${k===p.wi}">${esc(x.n)}</button>`).join('')}</div>
    <h4 style="margin:10px 0 4px">Combat</h4><div class="actions" style="margin:0"><button class="btn primary" data-a="mapatk">Attack with ${esc(w0.n)}</button>${w0.melee?'':`<button class="btn" data-a="mapaim" aria-pressed="${!!p.aim}">${p.aim?'Aimed shot: on':'Aimed shot'}</button>`}<button class="btn" data-a="mapdef">Defend</button></div>
    <div class="row"><span class="lab">Target evasion</span><span class="step"><button data-a="mapev" data-d="-1">−</button><output>${p.enemyEv}</output><button data-a="mapev" data-d="1">+</button></span></div>`;
    if(sk.length)h2+=`<h4 style="margin:10px 0 4px">Skill checks <span class="meter">vs DN ${p.dn}</span></h4><div class="pillrow">${sk.map(s=>`<button class="pill" data-a="mapskill" data-v="${esc(s)}">${esc(s)} ${sg(skillBonus(s))}</button>`).join('')}</div>`;
    h2+=`<h4 style="margin:10px 0 4px">Abilities</h4>`;
    if(!ab.length)h2+=`<p class="lede" style="font-size:13px;margin:0">None learned yet. Buy some on the Skills step.</p>`;
    for(const a of ab)h2+=`<div class="row" style="align-items:flex-start"><span class="lab">${esc(a.x)}${a.r>1?' R'+a.r:''}<small>${esc(a.s)}</small></span><span class="fx" style="flex:1">${esc(a.fx)}</span>${a.x==='Second Wind'?'<button class="btn" data-a="mapsw">Use</button>':''}</div>`;
    h2+=`</div>`;
  }
  return h2+'</div>';
}
function act(a,t){
  msg='';if(a!=='mapkill')confirmDel=false;
  if(a==='mapfs'){
    fs=true;menu=false;focusMe();
    try{const d=document.documentElement;if(d.requestFullscreen)d.requestFullscreen().then(()=>{apiFs=true}).catch(()=>{})}catch(e){}
  }else if(a==='mapfsx'){
    fs=false;menu=false;Z={z:1,x:0,y:0};
    try{if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen()}catch(e){}apiFs=false;
  }
  else if(a==='mapmenu')menu=!menu;
  else if(a==='mapctr')focusMe();
  else if(a==='maptoastx')PL().res=null;
  else if(a==='mapwpn'){PL().wi=+t.dataset.v}
  else if(a==='mapev'){const p=PL();p.enemyEv=clampc(p.enemyEv+ +t.dataset.d,0,15)}
  else if(a==='mapaim'){const p=PL();p.aim=!p.aim}
  else if(a==='mapatk'){
    const i=info(),tk=sel&&T()[sel];
    if(!i||!tk||sel===S.pid){setRes('No target',['Tap an enemy on the map first.'],'bad')}
    else{const p=PL();p.band=i.band;p.tcover=i.cov;doAttack();p.aim=false}
    menu=false;
  }
  else if(a==='mapdef'){doDefend();menu=false}
  else if(a==='mapskill'){doSkill(t.dataset.v,skillBonus(t.dataset.v));menu=false}
  else if(a==='mapsw'){const p=PL(),r=roll(8),b=p.hp;p.hp=Math.min(p.hpMax,p.hp+r);setRes('Second Wind',[`Recovered 1d8: ${r}. HP ${b} to ${p.hp}.`],'good');menu=false}
  else if(a==='mapgm'){S.gm=!S.gm;tool='move'}
  else if(a==='maptool')tool=t.dataset.v;
  else if(a==='mapfoe'){
    const id='f'+Math.random().toString(36).slice(2,6);const D=dm();let x=Math.min(10,D.w-1),y=Math.min(6,D.h-1);while(!free(x,y)&&x<D.w-1)x++;
    const n=Object.values(T()).filter(t=>t.t==='foe').length+1;
    T()[id]={n:'Enemy '+n,x,y,t:'foe'};putTok(id);sel=id;
  }else if(a==='mapdel'&&S.gm&&sel&&sel!==S.pid){
    delete T()[sel];persist();if(ref)ref.child(mp()+'/tokens/'+sel).remove();sel=null;
  }else if(a==='mapswitch'&&S.gm){
    M.active=t.dataset.v;sel=null;Z={z:1,x:0,y:0};persist();if(ref)ref.child('active').set(M.active);
  }else if(a==='mapnew'&&S.gm){
    const nm=((document.getElementById('mapname')||{}).value||'').trim()||('Map '+(Object.keys(M.maps).length+1)),id='m'+Math.random().toString(36).slice(2,6);
    M.maps[id]={n:nm,tokens:{},tiles:{}};M.active=id;sel=null;Z={z:1,x:0,y:0};persist();
    if(ref){ref.child('maps/'+id).set({n:nm});ref.child('active').set(id)}
  }else if(a==='mapkill'&&S.gm){
    if(!confirmDel){confirmDel=true;return}
    confirmDel=false;const id=M.active;delete M.maps[id];M.active=Object.keys(M.maps)[0];sel=null;Z={z:1,x:0,y:0};setBg(id,null);persist();
    if(ref){ref.child('maps/'+id).remove();ref.child('active').set(M.active)}
  }else if(a==='mapbg'){const f=document.getElementById('mapbgfile');if(f)f.click()}
  else if(a==='mapbgclear')setBg(M.active,null);
  else if(a==='mapzin')zoomAt(1.4,.5,.5);
  else if(a==='mapzout')zoomAt(1/1.4,.5,.5);
  else if(a==='mapzfit'){Z={z:1,x:0,y:0}}
  else if(a==='maptokimg'){imgTarget=sel;const f=document.getElementById('tokimgfile');if(f)f.click()}
  else if(a==='maptokimgclear'&&sel&&can(sel))setImg(sel,'');
  else if((a==='mapw'||a==='maph')&&S.gm){
    const m=cur(),k=a==='mapw'?'w':'h',lim=k==='w'?[8,40]:[6,30];
    m[k]=clampc(dm()[k]+ +t.dataset.d,lim[0],lim[1]);const{w,h}=dm();
    for(const id in m.tokens){const tk=m.tokens[id],nx=Math.min(tk.x,w-1),ny=Math.min(tk.y,h-1);if(nx!==tk.x||ny!==tk.y){tk.x=nx;tk.y=ny;putTok(id)}}
    persist();if(ref)ref.child(mp()+'/'+k).set(m[k]);Z={z:1,x:0,y:0};
  }
  else if(a==='mapuse'){
    const i=info();if(!i)return;const p=PL();
    p.band=i.band;p.tcover=i.cov;S.mode='play';
    setRes('Range set from map',[`${i.ft} ft: ${BANDS[i.band]}. Target cover ${i.cov?COVN[i.cov]:'none'}.`],'neutral');
  }
}
function setImg(id,url){
  if(id===S.pid)S.portrait=url||'';
  const t=T()[id];if(!t)return;
  if(url)t.img=url;else delete t.img;
  putTok(id);
}
function cellAt(e,svg){const r=svg.getBoundingClientRect(),[x,y,vw,vh]=vb(),{w,h}=dm();return[clampc(Math.floor((x+(e.clientX-r.left)/r.width*vw)/CS),0,w-1),clampc(Math.floor((y+(e.clientY-r.top)/r.height*vh)/CS),0,h-1)]}
function paint(x,y){
  const k=x+','+y,v=+tool;
  if(v)TL()[k]=v;else delete TL()[k];
  putTile(k);document.getElementById('mapsvg').innerHTML=inner();
}
document.addEventListener('change',e=>{
  if(!e.target||e.target.id!=='mapbgfile'||!e.target.files||!e.target.files[0])return;
  const f=e.target.files[0],u=URL.createObjectURL(f),img=new Image(),id=M.active;
  img.onload=()=>{
    const c=document.createElement('canvas');const d=dm(),cw=1000,ch=Math.round(1000*d.h/d.w);c.width=cw;c.height=ch;
    const g=c.getContext('2d'),sc=Math.max(cw/img.width,ch/img.height),w=img.width*sc,h=img.height*sc;
    g.drawImage(img,(cw-w)/2,(ch-h)/2,w,h);URL.revokeObjectURL(u);
    setBg(id,c.toDataURL('image/jpeg',.7));render();
  };
  img.onerror=()=>{msg='Could not read that image.';render()};
  img.src=u;e.target.value='';
});
document.addEventListener('change',e=>{
  if(!e.target||e.target.id!=='tokimgfile'||!e.target.files||!e.target.files[0]||!imgTarget)return;
  const f=e.target.files[0],u=URL.createObjectURL(f),img=new Image(),id=imgTarget;
  img.onload=()=>{
    const c=document.createElement('canvas');c.width=c.height=96;
    const g=c.getContext('2d'),sc=Math.max(96/img.width,96/img.height),w=img.width*sc,h=img.height*sc;
    g.drawImage(img,(96-w)/2,(96-h)/2,w,h);URL.revokeObjectURL(u);
    setImg(id,c.toDataURL('image/jpeg',.78));render();
  };
  img.onerror=()=>{msg='Could not read that image.';render()};
  img.src=u;e.target.value='';
});
document.addEventListener('wheel',e=>{
  const svg=e.target.closest&&e.target.closest('#mapsvg');if(!svg||S.mode!=='map')return;
  e.preventDefault();const r=svg.getBoundingClientRect();
  zoomAt(e.deltaY<0?1.15:1/1.15,(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);
},{passive:false});
document.addEventListener('pointerdown',e=>{
  const svg=e.target.closest&&e.target.closest('#mapsvg');if(!svg||S.mode!=='map')return;
  pts[e.pointerId]={x:e.clientX,y:e.clientY};
  if(Object.keys(pts).length===2){
    if(drag&&drag.moved&&drag.id)putTok(drag.id);
    drag=null;const[a,b]=Object.values(pts);pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,z:Z.z};e.preventDefault();return;
  }
  if(pinch)return;
  const[x,y]=cellAt(e,svg);
  if(S.gm&&tool!=='move'){drag={paint:true};paint(x,y);svg.setPointerCapture(e.pointerId);e.preventDefault();return}
  const id=tokenAt(x,y);
  if(!id){drag={pan:true,sx:e.clientX,sy:e.clientY,vx:Z.x,vy:Z.y,moved:false};svg.setPointerCapture(e.pointerId);e.preventDefault();return}
  sel=id;
  drag={id,moved:false,can:can(id)};
  svg.setPointerCapture(e.pointerId);e.preventDefault();
});
document.addEventListener('pointermove',e=>{
  if(S.mode!=='map')return;
  if(pts[e.pointerId]){pts[e.pointerId]={x:e.clientX,y:e.clientY}}
  const svg=document.getElementById('mapsvg');if(!svg)return;
  if(pinch&&Object.keys(pts).length>=2){
    const[a,b]=Object.values(pts),r=svg.getBoundingClientRect(),d=Math.hypot(a.x-b.x,a.y-b.y)||1;
    zoomAt(clampc(pinch.z*d/pinch.d,1,5)/Z.z,((a.x+b.x)/2-r.left)/r.width,((a.y+b.y)/2-r.top)/r.height);return;
  }
  if(!drag)return;
  if(drag.pan){
    const r=svg.getBoundingClientRect(),[,,vw,vh]=vb(),dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
    if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;
    Z.x=drag.vx-dx/r.width*vw;Z.y=drag.vy-dy/r.height*vh;applyVb();return;
  }
  const[x,y]=cellAt(e,svg);
  if(drag.paint){if(drag.lx!==x||drag.ly!==y){drag.lx=x;drag.ly=y;paint(x,y)}return}
  if(!drag.can)return;
  const t=T()[drag.id];
  if(t&&(x!==t.x||y!==t.y)&&free(x,y)){t.x=x;t.y=y;drag.moved=true;svg.innerHTML=inner()}
});
function end(e){
  if(e&&e.pointerId!==undefined)delete pts[e.pointerId];
  if(pinch){if(Object.keys(pts).length<2)pinch=null;return}
  if(!drag)return;const d=drag;drag=null;
  if(d.pan){if(!d.moved)sel=null}
  else if(d.moved){putTok(d.id);if(fs&&d.id===S.pid)focusMe()}
  render();
}
document.addEventListener('pointerup',end);
document.addEventListener('pointercancel',end);
window.addEventListener('resize',()=>{if(fs&&S.mode==='map')render()});
document.addEventListener('fullscreenchange',()=>{if(apiFs&&!document.fullscreenElement){fs=false;menu=false;apiFs=false;Z={z:1,x:0,y:0};if(S.mode==='map')render()}});
window.EHMap={view,act,pickPortrait:()=>{imgTarget=S.pid;const f=document.getElementById('tokimgfile');if(f)f.click()}};
render();
})();
