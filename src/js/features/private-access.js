// Refactored from phase11.js: invite-only family access, maximum two members.
(function(){
  const inviteFromUrl=()=>new URLSearchParams(location.search).get('invite')||localStorage.getItem('finance.pendingInvite')||'';
  const clearInvite=()=>{localStorage.removeItem('finance.pendingInvite');const u=new URL(location.href);u.searchParams.delete('invite');history.replaceState({},'',u.pathname+u.search+u.hash)};

  const originalShell=shell;
  shell=function(content){
    const html=originalShell(content);
    return html.replace('</nav>',`${nav('access','🔑','Доступ')}</nav>`);
  };

  const originalNav=nav;
  nav=function(view,icon,label){
    if(view!=='access')return originalNav(view,icon,label);
    return `<div class="nav-item pirate-nav ${state.view===view?'active':''}" data-view="access"><span class="nav-icon pirate-icon icon-key" aria-hidden="true"></span><span class="nav-label">Доступ</span></div>`;
  };

  function renderRestrictedAccess(msg='Этот аккаунт не приглашён в семейную казну.'){
    app.innerHTML=`<div class="restricted-shell"><div class="restricted-card"><div class="lock-badge">🔒</div><h2>Доступ закрыт</h2><p>${esc(msg)}</p><button class="btn btn-soft" id="restrictedLogout">Выйти</button></div></div>`;
    document.getElementById('restrictedLogout').onclick=()=>sb.auth.signOut();
  }

  loadData=async function(){
    const {data:fu,error}=await sb.from('family_users').select('family_id,role,families(id,name,currency,created_by)').limit(1);
    if(error)return app.innerHTML=`<div class="boot">Ошибка: ${esc(error.message)}</div>`;
    if(!fu?.length){
      const token=inviteFromUrl();
      if(token){
        const {error:claimError}=await sb.rpc('claim_family_invite',{invite_token:token});
        if(!claimError){clearInvite();return loadData()}
        return renderRestrictedAccess('Приглашение недействительно, уже использовано или срок его действия истёк.');
      }
      return renderRestrictedAccess();
    }
    state.family=fu[0].families;
    const [p,c,s,t,b,r]=await Promise.all([
      sb.from('people').select('*').eq('family_id',state.family.id).order('label'),
      sb.from('categories').select('*').or(`family_id.is.null,family_id.eq.${state.family.id}`).order('sort_order'),
      sb.from('subcategories').select('*').order('sort_order'),
      sb.from('transactions').select('*').eq('family_id',state.family.id).order('occurred_at',{ascending:false}).limit(1000),
      sb.from('budgets').select('*').eq('family_id',state.family.id),
      sb.from('recurring_payments').select('*').eq('family_id',state.family.id).order('day_of_month')
    ]);
    state.people=p.data||[];state.categories=c.data||[];state.subcategories=s.data||[];state.transactions=t.data||[];state.budgets=b.data||[];state.recurring=r.data||[];
    if(!state.selectedPersonId&&state.people[0])state.selectedPersonId=state.people.find(x=>x.linked_user_id===state.user?.id)?.id||state.people[0].id;
    renderApp();
  };

  renderAuth=function(signup=false){
    const invite=inviteFromUrl();
    if(!invite)signup=false;
    app.innerHTML=`<div class="auth-shell"><section class="auth-hero"><div class="brand"><div class="brand-badge">₸</div><span>Семейная казна</span></div><div><h1>Семейные деньги под вашим флагом.</h1><p>Доступ только для участников этой семьи.</p></div><small style="color:#b7a88d">Закрытая семейная казна</small></section><section class="auth-card-wrap"><div class="auth-card"><h2>${signup?'Создать доступ по приглашению':'Вход в казну'}</h2>${invite?`<div class="invite-auth-note">У вас персональное приглашение в семейную казну.</div>`:''}<div id="authNotice"></div><form id="authForm"><div class="field"><label>Email</label><input id="email" type="email" required autocomplete="email"></div><div class="field"><label>Пароль</label><input id="password" type="password" required minlength="8" autocomplete="${signup?'new-password':'current-password'}"></div><button class="btn btn-primary btn-wide">${signup?'Создать доступ':'Войти'}</button></form>${invite?`<div class="auth-switch">${signup?'Уже есть аккаунт?':'Нет аккаунта?'} <button class="link-btn" id="switchAuth">${signup?'Войти':'Создать по приглашению'}</button></div>`:''}</div></section></div>`;
    if(invite)document.getElementById('switchAuth').onclick=()=>renderAuth(!signup);
    document.getElementById('authForm').onsubmit=async e=>{
      e.preventDefault();notice('authNotice','');
      const email=document.getElementById('email').value.trim(),password=document.getElementById('password').value;
      if(signup){
        localStorage.setItem('finance.pendingInvite',invite);
        const res=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname+`?invite=${encodeURIComponent(invite)}`}});
        if(res.error)return notice('authNotice',res.error.message);
        if(res.data.session){state.user=res.data.user;await loadData()}
        else notice('authNotice','Аккаунт создан. Подтвердите email, затем откройте эту ссылку приглашения снова.','success');
      }else{
        if(invite)localStorage.setItem('finance.pendingInvite',invite);
        const res=await sb.auth.signInWithPassword({email,password});
        if(res.error)return notice('authNotice',res.error.message);
        state.user=res.data.user;await loadData();
      }
    };
  };

  function accessPage(){
    const free=state.people.find(p=>!p.linked_user_id);
    const owner=state.family?.created_by===state.user?.id;
    return `<div class="access-page"><div class="page-head"><div><h2 class="page-title">Доступ к казне</h2><div class="page-subtitle">Максимум два аккаунта: муж и жена.</div></div></div><div class="access-grid"><div class="card"><h3>Участники семьи</h3>${state.people.map(p=>`<div class="access-member"><div class="access-person"><span class="avatar">${p.label==='husband'?'М':'Ж'}</span><div><b>${esc(p.display_name)}</b><div class="access-state ${p.linked_user_id?'ok':'wait'}">${p.linked_user_id?'Аккаунт подключён':'Ожидает приглашения'}</div></div></div><span>${p.linked_user_id?'✓':'—'}</span></div>`).join('')}${owner&&free?`<div class="invite-box"><b>Пригласить ${esc(free.display_name)}</b><p class="access-note">Создайте персональную ссылку. Она одноразовая и действует 7 дней.</p><button class="btn btn-primary" id="createInvite" data-person="${free.id}">Создать ссылку</button><div id="inviteResult"></div></div>`:''}${owner&&!free?`<div class="notice success">Оба семейных аккаунта уже подключены.</div>`:''}</div><div class="card"><div class="lock-badge">🔐</div><h3>Защита</h3><p class="access-note">Посторонние могут технически открыть публичный адрес GitHub Pages, но без авторизации увидят только форму входа. Данные Supabase доступны только двум членам семьи. Обычная регистрация на сайте отключена, а третьего участника база не примет.</p></div></div></div>`;
  }

  async function bindAccess(){
    const btn=document.getElementById('createInvite');if(!btn)return;
    btn.onclick=async()=>{
      btn.disabled=true;btn.textContent='Создаю…';
      const {data,error}=await sb.rpc('create_spouse_invite',{target_person:btn.dataset.person});
      btn.disabled=false;btn.textContent='Обновить ссылку';
      const box=document.getElementById('inviteResult');
      if(error){box.innerHTML=`<div class="notice error">${esc(error.message)}</div>`;return}
      const row=Array.isArray(data)?data[0]:data;const url=`${location.origin}${location.pathname}?invite=${encodeURIComponent(row.token)}`;
      box.innerHTML=`<label style="display:block;margin-top:12px">Ссылка для супруги</label><input class="invite-url" id="inviteUrl" value="${esc(url)}" readonly><div class="invite-actions"><button class="btn btn-soft btn-small" id="copyInvite">Скопировать</button></div>`;
      document.getElementById('copyInvite').onclick=async()=>{await navigator.clipboard.writeText(url);document.getElementById('copyInvite').textContent='Скопировано ✓'};
    };
  }

  const originalRenderApp=renderApp;
  renderApp=function(){
    if(state.view!=='access')return originalRenderApp();
    destroyCharts();app.innerHTML=shell(accessPage());bindCommon();bindAccess();
  };
})();
