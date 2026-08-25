// Invite-only family access page. Auth and data loading now live in core/runtime.js.
function accessPage(){
  const free=state.people.find(p=>!p.linked_user_id),owner=state.family?.created_by===state.user?.id;
  return `<div class="access-page"><div class="page-head"><div><h2 class="page-title">Доступ к казне</h2><div class="page-subtitle">Максимум два аккаунта: муж и жена.</div></div></div><div class="access-grid"><div class="card"><h3>Участники семьи</h3>${state.people.map(p=>`<div class="access-member"><div class="access-person"><span class="avatar">${p.label==='husband'?'М':'Ж'}</span><div><b>${esc(p.display_name)}</b><div class="access-state ${p.linked_user_id?'ok':'wait'}">${p.linked_user_id?'Аккаунт подключён':'Ожидает приглашения'}</div></div></div><span>${p.linked_user_id?'✓':'—'}</span></div>`).join('')}${owner&&free?`<div class="invite-box"><b>Пригласить ${esc(free.display_name)}</b><p class="access-note">Создайте персональную ссылку. Она одноразовая и действует 7 дней.</p><button class="btn btn-primary" id="createInvite" data-person="${free.id}">Создать ссылку</button><div id="inviteResult"></div></div>`:''}${owner&&!free?'<div class="notice success">Оба семейных аккаунта уже подключены.</div>':''}</div><div class="card"><div class="lock-badge">🔐</div><h3>Защита</h3><p class="access-note">Адрес GitHub Pages публичный, но семейные данные защищены Supabase Auth и RLS. Обычная регистрация отключена, а подключение второго пользователя возможно только по одноразовому приглашению.</p></div></div></div>`;
}

async function bindAccess(){
  const btn=document.getElementById('createInvite');if(!btn)return;
  btn.onclick=async()=>{
    btn.disabled=true;btn.textContent='Создаю…';
    const {data,error}=await sb.rpc('create_spouse_invite',{target_person:btn.dataset.person});
    btn.disabled=false;btn.textContent='Обновить ссылку';
    const box=document.getElementById('inviteResult');
    if(error){box.innerHTML=`<div class="notice error">${esc(error.message)}</div>`;return}
    const row=Array.isArray(data)?data[0]:data;
    const url=`${location.origin}${location.pathname}?invite=${encodeURIComponent(row.token)}`;
    box.innerHTML=`<label style="display:block;margin-top:12px">Ссылка для супруги</label><input class="invite-url" id="inviteUrl" value="${esc(url)}" readonly><div class="invite-actions"><button class="btn btn-soft btn-small" id="copyInvite">Скопировать</button></div>`;
    document.getElementById('copyInvite').onclick=async()=>{await navigator.clipboard.writeText(url);document.getElementById('copyInvite').textContent='Скопировано ✓'};
  };
}
