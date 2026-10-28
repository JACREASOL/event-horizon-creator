/* Email sign-in and a cloud roster of saved characters (users/UID/chars). Also boots Firebase for the rest of the app. */
(function(){
const cfg=window.EH_FIREBASE,BASE='https://www.gstatic.com/firebasejs/10.14.1/';
const KEYS=['name','species','vPrimary','vExtra','fTrait','hFloat','base','career','skills','abil','freeAb','gear','notes','pl'];
let fb=null,user=null,roster={},rref=null,msg='',email='',confirmId='',timer=null,lastSaved='',booted=false,booting=null;
const load=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error(src));document.head.appendChild(s)});
function boot(){
  if(booting)return booting;
  booting=(async()=>{
    await load(BASE+'firebase-app-compat.js');await load(BASE+'firebase-auth-compat.js');await load(BASE+'firebase-database-compat.js');
    firebase.initializeApp(cfg);fb={db:firebase.database(),auth:firebase.auth()};
    await new Promise(res=>{let first=true;fb.auth.onAuthStateChanged(u=>{user=u;watch();if(first){first=false;booted=true;res()}else render()})});
    return fb;
  })();
  booting.catch(()=>{booting=null});
  return booting;
}
function watch(){
  if(rref)rref.off();rref=null;roster={};
  if(user){
    rref=fb.db.ref('users/'+user.uid+'/chars');
    rref.on('value',s=>{roster=s.val()||{};if(S.mode==='acct')render()},()=>{msg='Could not read your characters. Check the database rules.';if(S.mode==='acct')render()});
  }
}
const pack=()=>{const o={};KEYS.forEach(k=>o[k]=S[k]);return o};
const meta=()=>({name:S.name||'Unnamed',species:(SPECIES[S.species]||{}).name||'',career:S.career||''});
function saveChar(asNew){
  if(!user||!rref){msg='Sign in first.';return}
  if(!(S.name||'').trim()){msg='Name your character on the Sheet step first.';return}
  const id=(!asNew&&S.cid)||('c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)),data=JSON.stringify(pack());
  S.cid=id;
  rref.child(id).set(Object.assign(meta(),{upd:firebase.database.ServerValue.TIMESTAMP,data})).then(()=>{lastSaved=data;msg='Saved.';render()},e=>{msg='Save failed: '+e.message;render()});
  msg='Saving...';
}
function push(){
  if(!user||!rref||!S.cid)return;
  clearTimeout(timer);
  timer=setTimeout(()=>{
    const d=JSON.stringify(pack());
    if(d!==lastSaved&&rref&&S.cid){lastSaved=d;rref.child(S.cid).update(Object.assign(meta(),{upd:firebase.database.ServerValue.TIMESTAMP,data:d}))}
  },2000);
}
function loadChar(id){
  const r=roster[id];if(!r)return;
  let o;try{o=JSON.parse(r.data)}catch(e){msg='That character could not be read.';return}
  const keep={pid:S.pid,pcode:S.pcode,inParty:S.inParty,gm:S.gm};
  S=Object.assign(blank(),o,keep,{cid:id,mode:'build',step:0});
  lastSaved=JSON.stringify(pack());msg='';
}
function newChar(){
  const keep={pid:S.pid,pcode:S.pcode,inParty:S.inParty,gm:S.gm};
  S=Object.assign(blank(),keep);lastSaved='';msg='';S.mode='build';
}
const errs={'auth/invalid-credential':'Wrong email or password.','auth/wrong-password':'Wrong email or password.','auth/user-not-found':'No account with that email.','auth/email-already-in-use':'That email already has an account. Use Sign in.','auth/weak-password':'Password needs at least 6 characters.','auth/invalid-email':'That email does not look right.','auth/too-many-requests':'Too many tries. Wait a minute.','auth/operation-not-allowed':'Email sign-in is not turned on in Firebase yet.','auth/network-request-failed':'No connection.'};
async function doAuth(kind){
  const em=(document.getElementById('acemail')||{}).value||'',pw=(document.getElementById('acpw')||{}).value||'';
  email=em.trim();
  if(!email||!pw){msg='Enter your email and password.';return}
  msg='Working...';
  try{await boot()}catch(e){msg='Could not reach Firebase. Check your connection.';render();return}
  try{
    if(kind==='up')await fb.auth.createUserWithEmailAndPassword(email,pw);else await fb.auth.signInWithEmailAndPassword(email,pw);
    try{localStorage.setItem('eh-auth','1')}catch(e){}
    msg='';
  }catch(e){msg=errs[e.code]||('Sign-in failed: '+(e.code||e.message))}
  render();
}
async function reset(){
  const em=((document.getElementById('acemail')||{}).value||'').trim();email=em;
  if(!em){msg='Enter your email first, then tap Forgot password.';return}
  try{await boot();await fb.auth.sendPasswordResetEmail(em);msg='Reset email sent. Check your inbox.'}catch(e){msg=errs[e.code]||'Could not send the reset email.'}
  render();
}
function view(){
  if(!cfg)return`<h2>Account</h2><p class="lede">Sign-in is not set up yet. Add your Firebase settings to firebase-config.js.</p>`;
  const m=`<div class="meter" aria-live="polite" style="margin-top:8px">${esc(msg)}</div>`;
  if(!user){
    if(!booted&&localStorage.getItem('eh-auth')==='1')return`<h2>Account</h2><p class="lede">Checking your sign-in...</p>`;
    return`<h2>Account</h2><p class="lede">Sign in to save characters online and join parties. New here? Choose Create account.</p>
    <label class="f" for="acemail">Email</label><input type="text" id="acemail" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" value="${esc(email)}">
    <label class="f" for="acpw">Password</label><input type="password" id="acpw" autocomplete="current-password" style="width:100%;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:9px 10px;font:inherit">
    <div class="actions"><button class="btn primary" data-a="acctin">Sign in</button><button class="btn" data-a="acctup">Create account</button><button class="btn" data-a="acctreset">Forgot password</button></div>${m}`;
  }
  const ids=Object.keys(roster).sort((a,b)=>(roster[b].upd||0)-(roster[a].upd||0));
  let h=`<h2>Account</h2><p class="lede">Signed in as <b>${esc(user.email||'')}</b>.</p>
  <div class="actions" style="margin-top:0"><button class="btn" data-a="acctout">Sign out</button></div>
  <h3>Current character</h3>
  <p class="meter">${esc(S.name||'Unnamed')} · ${S.cid&&roster[S.cid]?'saved, changes sync automatically':'not saved yet'}</p>
  <div class="actions" style="margin-top:0"><button class="btn primary" data-a="acctsave">${S.cid&&roster[S.cid]?'Save now':'Save to my characters'}</button>${S.cid&&roster[S.cid]?'<button class="btn" data-a="acctsavenew">Save as a copy</button>':''}<button class="btn" data-a="acctnew">New character</button></div>${m}
  <h3>My characters</h3>`;
  if(!ids.length)h+=`<p class="lede">Nothing saved yet.</p>`;
  for(const id of ids){
    const r=roster[id];
    h+=`<div class="pcard"><h4>${esc(r.name||'Unnamed')}${id===S.cid?' <span class="chip">open</span>':''}</h4><div class="sub2">${esc([r.species,r.career].filter(Boolean).join(' · ')||'No species or career yet')}</div>
    <div class="actions" style="margin:0"><button class="btn" data-a="acctload" data-id="${id}">Open</button><button class="btn" data-a="acctdel" data-id="${id}">${confirmId===id?'Tap again to delete':'Delete'}</button></div></div>`;
  }
  return h;
}
function act(a,t){
  const id=t.dataset.id;
  if(a!=='acctdel')confirmId='';
  if(a==='acctin')doAuth('in');
  else if(a==='acctup')doAuth('up');
  else if(a==='acctreset')reset();
  else if(a==='acctout'){fb&&fb.auth.signOut();try{localStorage.removeItem('eh-auth')}catch(e){}msg='';}
  else if(a==='acctsave')saveChar(false);
  else if(a==='acctsavenew')saveChar(true);
  else if(a==='acctnew')newChar();
  else if(a==='acctload')loadChar(id);
  else if(a==='acctdel'){
    if(confirmId===id){rref&&rref.child(id).remove();if(S.cid===id)S.cid='';confirmId=''}else confirmId=id;
  }
}
window.EHAcct={view,act,push,boot,user:()=>user,state:()=>user?'in':(!booted&&localStorage.getItem('eh-auth')==='1'&&cfg?'wait':'out')};
if(cfg&&localStorage.getItem('eh-auth')==='1')boot().then(()=>render(),()=>{});
})();
