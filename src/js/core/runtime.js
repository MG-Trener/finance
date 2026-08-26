// Core runtime: Supabase client, shared state, auth screens and data loading.
const SUPABASE_URL='https://llgubwtuhxpdpxaxxcft.supabase.co';
const SUPABASE_KEY='sb_publishable_xLCywB_jYDuPJrTKflv5LQ_r8weOhFb';
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const app=document.getElementById('app');
const MONTHS=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const INITIAL_ACTIVE_TX_LIMIT=500;
const INITIAL_TRASH_TX_LIMIT=100;
const TX_HISTORY_BATCH=500;

let state={
  user:null,family:null,people:[],categories:[],subcategories:[],
  transactions:[],trashTransactions:[],budgets:[],recurring:[],goals:[],goalContributions:[],
  activeTransactionsHasMore:false,trashTransactionsHasMore:false,transactionHistoryLoading:false,
  view:'overview',txType:'expense',selectedPersonId:null,
  year:new Date().getFullYear(),month:new Date().getMonth()+1,
  filters:{person:'all',type:'all',category:'all',period:'month',sort:'newest',search:'',trash:false},
  journalLimit:50,charts:[]
};

const money=n=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'KZT',maximumFractionDigits:0}).format(Number(n||0));
const esc=s=>String(s??'').replace(/[&<>'\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[m]));
const byId=(arr,id)=>arr.find(x=>x.id===id);
const localDT=d=>{const x=d?new Date(d):new Date();const pad=n=>String(n).padStart(2,'0');return `${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`};
function notice(id,msg,type='error'){const el=document.getElementById(id);if(el)el.innerHTML=msg?`<div class="notice ${type}">${esc(msg)}</div>`:''}
function periodTx(){return state.transactions.filter(x=>{const d=new Date(x.occurred_at);return d.getFullYear()===+state.year&&d.getMonth()+1===+state.month})}
function stats(personId){const tx=periodTx().filter(x=>!personId||x.person_id===personId);const income=tx.filter(x=>x.type==='income').reduce((a,b)=>a+Number(b.amount),0);const expense=tx.filter(x=>x.type==='expense').reduce((a,b)=>a+Number(b.amount),0);return{income,expense,balance:income-expense}}
function catName(id){return byId(state.categories,id)?.name||'Без категории'}
function subName(id){return byId(state.subcategories,id)?.name||''}
function personName(id){return byId(state.people,id)?.display_name||'Участник'}
function closeModal(){document.getElementById('modal')?.remove()}

function pendingInviteToken(){return new URLSearchParams(location.search).get('invite')||localStorage.getItem('finance.pendingInvite')||''}
function clearPendingInvite(){localStorage.removeItem('finance.pendingInvite');const u=new URL(location.href);u.searchParams.delete('invite');history.replaceState({},'',u.pathname+u.search+u.hash)}
function authConfirmationUrl(invite){const base=window.__FINANCE_NATIVE__?'https://mg-trener.github.io/finance/':location.origin+location.pathname;return `${base}?invite=${encodeURIComponent(invite)}`}
function hasDeletionIntent(){return new URLSearchParams(location.search).get('delete-account')==='1'}

function renderRestrictedAccess(msg='Этот аккаунт не приглашён в семейную казну.'){
  app.innerHTML=`<div class="restricted-shell"><div class="restricted-card"><div class="lock-badge">🔒</div><h2>Доступ закрыт</h2><p>${esc(msg)}</p><button class="btn btn-soft" id="restrictedLogout">Выйти</button></div></div>`;
  document.getElementById('restrictedLogout').onclick=()=>sb.auth.signOut();
}

function renderAuth(signup=false){
  const invite=pendingInviteToken();if(!invite)signup=false;
  app.innerHTML=`<div class="auth-shell"><section class="auth-hero"><div class="brand"><div class="brand-badge">₸</div><span>Семейная казна</span></div><div><h1>Семейные деньги под вашим флагом.</h1><p>Доступ только для участников этой семьи.</p></div><small style="color:#b7a88d">Закрытая семейная казна</small></section><section class="auth-card-wrap"><div class="auth-card"><h2>${signup?'Создать доступ по приглашению':'Вход в казну'}</h2>${invite?'<div class="invite-auth-note">У вас персональное приглашение в семейную казну.</div>':''}<div id="authNotice"></div><form id="authForm"><div class="field"><label>Email</label><input id="email" type="email" required autocomplete="email"></div><div class="field"><label>Пароль</label><input id="password" type="password" required minlength="8" autocomplete="${signup?'new-password':'current-password'}"></div><button class="btn btn-primary btn-wide">${signup?'Создать доступ':'Войти'}</button></form>${invite?`<div class="auth-switch">${signup?'Уже есть аккаунт?':'Нет аккаунта?'} <button class="link-btn" id="switchAuth">${signup?'Войти':'Создать по приглашению'}</button></div>`:''}<div class="auth-switch"><a href="privacy.html" target="_blank" rel="noopener">Конфиденциальность</a> · <a href="delete-account.html" target="_blank" rel="noopener">Удаление аккаунта</a></div></div></section></div>`;
  if(invite)document.getElementById('switchAuth').onclick=()=>renderAuth(!signup);
  document.getElementById('authForm').onsubmit=async e=>{
    e.preventDefault();notice('authNotice','');
    const email=document.getElementById('email').value.trim(),password=document.getElementById('password').value;
    if(signup){
      localStorage.setItem('finance.pendingInvite',invite);
      const res=await sb.auth.signUp({email,password,options:{emailRedirectTo:authConfirmationUrl(invite)}});
      if(res.error)return notice('authNotice',res.error.message);
      if(res.data.session){state.user=res.data.user;await loadData()}else notice('authNotice','Аккаунт создан. Подтвердите email, затем откройте ссылку приглашения снова.','success');
      return;
    }
    if(invite)localStorage.setItem('finance.pendingInvite',invite);
    const res=await sb.auth.signInWithPassword({email,password});
    if(res.error)return notice('authNotice',res.error.message);
    state.user=res.data.user;await loadData();
  };
}

function upsertById(list,row){const i=list.findIndex(x=>x.id===row.id);if(i>=0)list[i]=row;else list.unshift(row);return list}
function syncTransactionState(row){
  if(!row)return;
  state.transactions=state.transactions.filter(x=>x.id!==row.id);
  state.trashTransactions=state.trashTransactions.filter(x=>x.id!==row.id);
  if(row.deleted_at)upsertById(state.trashTransactions,row);else upsertById(state.transactions,row);
  state.transactions.sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at));
  state.trashTransactions.sort((a,b)=>new Date(b.deleted_at)-new Date(a.deleted_at));
  window.FinanceOffline?.persistSnapshotSoon?.();
}
function renderStateChange(){window.FinanceOffline?.persistSnapshotSoon?.();if(typeof renderApp==='function')renderApp()}

function appendUniqueTransactions(target,rows,orderField){
  const known=new Set(target.map(x=>x.id));
  for(const row of rows||[])if(!known.has(row.id)){target.push(row);known.add(row.id)}
  target.sort((a,b)=>new Date(b[orderField]||0)-new Date(a[orderField]||0));
}

async function loadMoreTransactionHistory({trash=false,batch=TX_HISTORY_BATCH,render=true}={}){
  if(state.transactionHistoryLoading||!state.family)return 0;
  const hasMoreKey=trash?'trashTransactionsHasMore':'activeTransactionsHasMore';
  if(!state[hasMoreKey])return 0;
  const target=trash?state.trashTransactions:state.transactions;
  const orderField=trash?'deleted_at':'occurred_at';
  const from=target.length,to=from+batch-1;
  state.transactionHistoryLoading=true;
  try{
    let query=sb.from('transactions').select('*').eq('family_id',state.family.id);
    query=trash?query.not('deleted_at','is',null):query.is('deleted_at',null);
    const {data,error}=await query.order(orderField,{ascending:false}).range(from,to);
    if(error)throw error;
    const rows=data||[];
    appendUniqueTransactions(target,rows,orderField);
    state[hasMoreKey]=rows.length===batch;
    window.FinanceOffline?.persistSnapshotSoon?.();
    if(render&&typeof renderApp==='function')renderApp();
    return rows.length;
  }finally{
    state.transactionHistoryLoading=false;
  }
}

async function ensureAllActiveTransactionsLoaded(){
  let added=0;
  while(state.activeTransactionsHasMore){
    const count=await loadMoreTransactionHistory({trash:false,batch:TX_HISTORY_BATCH,render:false});
    added+=count;
    if(!count)break;
  }
  return added;
}

async function restoreOfflineOrShowError(message){
  const restored=await window.FinanceOffline?.restoreSnapshot?.(state.user?.id);
  if(restored)return true;
  app.innerHTML=`<div class="boot">${esc(message)}</div>`;return false;
}

async function loadData(){
  let fu,error;
  try{const res=await sb.from('family_users').select('family_id,role,families(id,name,currency,created_by)').limit(1);fu=res.data;error=res.error}catch(err){error=err}
  if(error){await restoreOfflineOrShowError(`Ошибка: ${error.message||error}`);return}
  if(!fu?.length){
    const token=pendingInviteToken();
    if(token){
      const {error:claimError}=await sb.rpc('claim_family_invite',{invite_token:token});
      if(!claimError){clearPendingInvite();return loadData()}
      return renderRestrictedAccess('Приглашение недействительно, уже использовано или срок его действия истёк.');
    }
    return renderRestrictedAccess();
  }

  state.family=fu[0].families;
  const familyId=state.family.id;
  let responses;
  try{
    responses=await Promise.all([
      sb.from('people').select('*').eq('family_id',familyId).order('label'),
      sb.from('categories').select('*').or(`family_id.is.null,family_id.eq.${familyId}`).order('sort_order'),
      sb.from('subcategories').select('*').order('sort_order'),
      sb.from('transactions').select('*').eq('family_id',familyId).is('deleted_at',null).order('occurred_at',{ascending:false}).limit(INITIAL_ACTIVE_TX_LIMIT),
      sb.from('transactions').select('*').eq('family_id',familyId).not('deleted_at','is',null).order('deleted_at',{ascending:false}).limit(INITIAL_TRASH_TX_LIMIT),
      sb.from('budgets').select('*').eq('family_id',familyId),
      sb.from('recurring_payments').select('*').eq('family_id',familyId).order('day_of_month'),
      sb.from('financial_goals').select('*').eq('family_id',familyId).order('created_at',{ascending:false}),
      sb.from('goal_contributions').select('*').eq('family_id',familyId).order('contributed_at',{ascending:false})
    ]);
  }catch(err){await restoreOfflineOrShowError(`Ошибка загрузки: ${err?.message||err}`);return}
  const [p,c,s,t,trash,b,r,g,gc]=responses,firstError=responses.find(x=>x.error)?.error;
  if(firstError){await restoreOfflineOrShowError(`Ошибка загрузки: ${firstError.message}`);return}

  state.people=p.data||[];state.categories=c.data||[];state.subcategories=s.data||[];
  state.transactions=t.data||[];state.trashTransactions=trash.data||[];
  state.activeTransactionsHasMore=state.transactions.length===INITIAL_ACTIVE_TX_LIMIT;
  state.trashTransactionsHasMore=state.trashTransactions.length===INITIAL_TRASH_TX_LIMIT;
  state.budgets=b.data||[];state.recurring=r.data||[];state.goals=g.data||[];state.goalContributions=gc.data||[];
  if(!state.selectedPersonId&&state.people[0])state.selectedPersonId=state.people.find(x=>x.linked_user_id===state.user?.id)?.id||state.people[0].id;
  await window.FinanceOffline?.reapplyPendingToState?.();
  if(hasDeletionIntent())state.view='access';
  renderApp();
  window.FinanceOffline?.persistSnapshotSoon?.();
  if(navigator.onLine)window.FinanceOffline?.flushQueue?.();
}

async function bootstrap(){const {data:{session}}=await sb.auth.getSession();state.user=session?.user||null;if(!state.user)return renderAuth();await loadData()}
