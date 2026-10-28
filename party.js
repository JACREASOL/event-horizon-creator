/* Live party sync via Firebase Realtime Database. Loaded only in the hosted app. */
(function(){
const cfg=window.EH_FIREBASE;
const BASE='https://www.gstatic.com/firebasejs/10.14.1/';
let db=null,root=null,myRef=null,members={},joined='',timer=null,lastInfo='',lastLive='',lastObj=null,open={},status='';
const load=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error(src));document.head.appendChild(s)});
async function init(){if(db)return;await load(BASE+'firebase-app-compat.js');await load(BASE+'firebase-database-compat.js');firebase.initializeApp(cfg);db=firebase.database()}
const clean=c=>(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
const newCode=()=>{const a='BCDFGHJKLMNPQRSTVWXZ23456789';let s='';for(let i=0;i<5;i++)s+=a[Math.floor(Math.random()*a.length)];return s};
function mine(){
  const p=PL();
  return{info:{name:S.name||'Unnamed',species:(SPECIES[S.species]||{}).name||'—',career:S.career||'—',attrs:Object.fromEntries(ATTRS.map(a=>[a,final(a)])),sheet:textSheet()},
    live:{hp:p.hp,hpMax:p.hpMax,ap:p.ap,apMax:p.apMax,arc:p.arc,arcMax:arcPool(),favor:p.favor,ev:evasion()}};
}
function push(){
  if(!joined||!myRef)return;
  clearTimeout(timer);
  timer=setTimeout(()=>{
    const m=mine(),i=JSON.stringify(m.info),l=JSON.stringify(m.live);
    if(i!==lastInfo){lastInfo=i;myRef.child('info').set(m.info)}
    if(l!==lastLive){lastLive=l;lastObj=Object.assign({},m.live);myRef.child('live').set(m.live)}
  },350);
}
function onSnap(snap){
  members=snap.val()||{};
  const me=members[S.pid];let ch=false;
  if(me&&me.live){
    const p=PL();
    for(const k of ['hp','ap','arc','favor']){
      const rv=me.live[k];
      if(typeof rv!=='number'||rv===p[k])continue;
      if(lastObj===null||rv!==lastObj[k]){p[k]=rv;ch=true}
    }
    lastObj=Object.assign({},me.live);
    if(ch){save()}
  }
  if(S.mode==='party'||(ch&&S.mode==='play'))render();
}
async function join(code){
  status='Connecting...';render();
  try{await init()}catch(e){status='Could not reach Firebase. Check your connection.';render();return}
  try{
    if(root)root.off();
    joined=code;S.pcode=code;S.inParty=true;
    root=db.ref('parties/'+code+'/members');myRef=root.child(S.pid);
    lastInfo='';lastLive='';lastObj=null;
    root.on('value',onSnap,e=>{status='Firebase refused access. Check the database rules.';joined='';S.inParty=false;render()});
    status='';push();render();
  }catch(e){status='Could not join: '+e.message;render()}
}
function leave(){
  try{if(root)root.off();if(myRef)myRef.remove()}catch(e){}
  joined='';root=null;myRef=null;members={};S.inParty=false;status='';
}
function bar(v,m,c){return `<div class="mbar"><i style="width:${m?Math.round(100*Math.min(v,m)/m):0}%;background:var(${c})"></i></div>`}
function row(id,m,label,k,c,max){
  const v=m.live[k]??0,mx=max;
  return `<div class="pst"><span>${label}</span><div>${bar(v,mx,c)}<span class="meter">${v}${k==='favor'?'/5':'/'+mx}</span></div>`+
    (S.gm?`<span class="step"><button data-a="ptyadj" data-id="${id}" data-k="${k}" data-d="-1">−</button><button data-a="ptyadj" data-id="${id}" data-k="${k}" data-d="1">+</button></span>`:'<span></span>')+`</div>`;
}
function view(){
  if(!cfg)return `<h2>Party</h2><p class="lede">Party sync is not set up yet. Add your Firebase settings to firebase-config.js, then reload.</p>`;
  if(!joined){
    return `<h2>Party</h2><p class="lede">Join with the code your GM gives you, or start a new party. Everyone with the code sees your name, trackers and sheet.</p>
    <label class="f" for="pcode">Party code</label><input type="text" id="pcode" data-f="pcode" value="${esc(S.pcode||'')}" placeholder="K7M2Q" autocapitalize="characters" autocomplete="off" autocorrect="off">
    <div class="actions"><button class="btn primary" data-a="ptyjoin">Join party</button><button class="btn" data-a="ptynew">Create a new party</button></div>
    <div class="meter" aria-live="polite">${esc(status)}</div>`;
  }
  const ids=Object.keys(members).sort((a,b)=>a===S.pid?-1:b===S.pid?1:((members[a].info||{}).name||'').localeCompare((members[b].info||{}).name||''));
  let h=`<h2>Party ${esc(joined)}</h2><p class="lede">${ids.length} ${ids.length===1?'player':'players'} connected. Share the code <b>${esc(joined)}</b> with your group.</p>
  <div class="actions"><button class="pill" data-a="ptygm" aria-pressed="${S.gm}">GM mode: edit anyone's trackers</button><button class="btn" data-a="ptyleave">Leave party</button></div>
  <div class="meter" aria-live="polite">${esc(status)}</div>`;
  for(const id of ids){
    const m=members[id],i=m.info||{},l=m.live;
    h+=`<div class="pcard"><h4>${esc(i.name||'Unnamed')}${id===S.pid?' <span class="chip">you</span>':''}</h4><div class="sub2">${esc(i.species||'—')} · ${esc(i.career||'—')}${l?` · Evasion ${l.ev}`:''}</div>`;
    if(l){h+=row(id,m,'HP','hp','--arc',l.hpMax)+row(id,m,'Armor','ap','--flag',l.apMax)+row(id,m,'Arc','arc','--arc',l.arcMax)+row(id,m,'Favor','favor','--flag',5)}
    if(i.attrs)h+=`<div class="chips" style="margin:8px 0">${ATTRS.map(a=>`<span class="chip">${AL[a].slice(0,3)} ${i.attrs[a]??0}</span>`).join('')}</div>`;
    h+=`<button class="pill" data-a="ptyopen" data-id="${id}" aria-pressed="${!!open[id]}">${open[id]?'Hide sheet':'Show sheet'}</button>${open[id]&&i.sheet?`<pre style="margin-top:8px">${esc(i.sheet)}</pre>`:''}</div>`;
  }
  return h;
}
function act(a,t){
  if(a==='ptyjoin'){const c=clean(S.pcode);if(c.length<4){status='Enter a code with 4 or more letters or numbers.';return}join(c)}
  else if(a==='ptynew')join(newCode());
  else if(a==='ptyleave')leave();
  else if(a==='ptygm')S.gm=!S.gm;
  else if(a==='ptyopen')open[t.dataset.id]=!open[t.dataset.id];
  else if(a==='ptyadj'&&root){
    const id=t.dataset.id,k=t.dataset.k,dd=+t.dataset.d,m=members[id];
    if(!m||!m.live)return;
    const mx=k==='favor'?5:(m.live[k+'Max']||999);
    root.child(id+'/live/'+k).transaction(v=>clamp((v||0)+dd,0,mx));
  }
}
window.EHParty={view,act,push,ref:()=>joined&&db?db.ref('parties/'+joined):null};
if(!S.pid)S.pid='p'+Math.random().toString(36).slice(2,10);
if(cfg&&S.inParty&&S.pcode)join(clean(S.pcode));else render();
})();
