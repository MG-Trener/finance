// Invite-only family access page. Auth and data loading now live in core/runtime.js.
function accessPage(){
  const free=state.people.find(p=>!p.linked_user_id),owner=state.family?.created_by===state.user?.id;
  const pushCard=window.FinancePush?`<div class="card"><div class="lock-badge">🔔</div><h3>Push-уведомления</h3>${window.FinancePush.settingsMarkup()}</div>`:'';
  return `<div class="access-page"><div class="page-head"><div><h2 class="page-title">Доступ к казне</h2><div class="page-subtitle">Максимум два аккаунта: муж и жена.</div></div></div><div class="access-grid"><div class="card"><h3>Участники семьи</h3>${state.people.map(p=>`<div class="access-member"><div class="access-person"><span class="avatar">${p.label==='husband'?'М':'Ж'}</span><div><b>${esc(p.display_name)}</b><div class="access-state ${p.linked_user_id?'ok':'wait'}">${p.linked_user_id?'Аккаунт подключён':'Ожидает приглашения'}</div></div></div><span>${p.linked_user_id?'✓':'—'}</span></div>`).join('')}${owner&&free?`<div class="invite-box"><b>Пригласить ${esc(free.display_name)}</b><p class="access-note">Создайте персональную ссылку. Она одноразовая и действует 7 дней.</p><button class="btn btn-primary" id="createInvite" data-person="${free.id}">Создать ссылку</button><div id="inviteResult"></div></div>`:''}${owner&&!free?'<div class="notice success">Оба семейных аккаунта уже подключены.</div>':''}</div>${pushCard}<div class="card"><div class="lock-badge">🔐</div><h3>Защита и данные</h3><p class="access-note">Адрес GitHub Pages публичный, но семейные данные защищены Supabase Auth и RLS. Обычная регистрация отключена, а подключение второго пользователя возможно только по одноразовому приглашению.</p><div class="invite-actions"><a class="btn btn-soft btn-small" href="privacy.html" target="_blank" rel="noopener">Политика конфиденциальности</a><a class="btn btn-soft btn-small" href="delete-account.html" target="_blank" rel="noopener">Удаление данных</a></div><hr style="border:0;border-top:1px solid rgba(168,125,63,.28);margin:18px 0"><h3>Удаление аккаунта</h3><p class="access-note">Можно отправить запрос на удаление учётной записи и связанных персональных данных. Общие семейные финансовые записи не удаляются автоматически, чтобы не уничтожить данные второго участника семьи.</p><div id="deletionRequestState"></div><button type="button" class="btn btn-danger" id="requestAccountDeletion">Запросить удаление аккаунта</button></div></div></div>`;
}

function clearDeletionIntent(){const url=new URL(location.href);if(!url.searchParams.has('delete-account'))return;url.searchParams.delete('delete-account');history.replaceState({},'',url.pathname+url.search+url.hash)}

async function refreshDeletionRequestState(){
  const box=document.getElementById('deletionRequestState');if(!box||!state.user?.id||state.user?._offlineLocal)return null;
  const {data,error}=await sb.from('account_deletion_requests').select('id,status,requested_at').eq('user_id',state.user.id).eq('status','pending').maybeSingle();
  if(error){box.innerHTML=`<div class="notice error">${esc(error.message)}</div>`;return null}
  if(data){box.innerHTML=`<div class="notice success">Запрос уже зарегистрирован ${new Date(data.requested_at).toLocaleString('ru-RU')}. До завершения удаления вы можете продолжать пользоваться приложением.</div>`;const btn=document.getElementById('requestAccountDeletion');if(btn){btn.disabled=true;btn.textContent='Запрос уже отправлен'}}
  return data;
}

function openAccountDeletion(){
  if(state.user?._offlineLocal){alert('Для запроса удаления аккаунта сначала восстановите подключение к серверу.');return}
  closeModal();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><div><h2>Удаление аккаунта</h2><p class="quick-amount-context">Запрос будет сохранён в системе</p></div><button class="icon-btn" id="closeModal" aria-label="Закрыть">×</button></div><div id="deleteAccountNotice"></div><p>Будет создан запрос на удаление вашей учётной записи и связанных персональных данных. Общие записи семейной казны могут быть сохранены для второго участника семьи.</p><div class="field"><label>Причина или комментарий <span class="muted">(необязательно)</span></label><textarea id="deleteAccountReason" maxlength="500" rows="3" placeholder="Можно оставить пустым"></textarea></div><label style="display:flex;gap:9px;align-items:flex-start;margin:12px 0"><input id="deleteAccountConfirm" type="checkbox" style="margin-top:3px"><span>Я понимаю, что после завершения удаления доступ к аккаунту будет утрачен.</span></label><button class="btn btn-danger btn-wide" id="confirmAccountDeletion" disabled>Отправить запрос</button></div></div>`);
  document.getElementById('closeModal').onclick=closeModal;document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
  const confirm=document.getElementById('deleteAccountConfirm'),submit=document.getElementById('confirmAccountDeletion');confirm.onchange=()=>submit.disabled=!confirm.checked;
  submit.onclick=async()=>{
    submit.disabled=true;submit.textContent='Отправляю…';
    const reason=document.getElementById('deleteAccountReason').value.trim()||null;
    const {data:existing,error:existingError}=await sb.from('account_deletion_requests').select('id,requested_at').eq('user_id',state.user.id).eq('status','pending').maybeSingle();
    if(existingError){notice('deleteAccountNotice',existingError.message);submit.disabled=false;submit.textContent='Отправить запрос';return}
    if(existing){notice('deleteAccountNotice','Запрос уже был отправлен ранее.','success');setTimeout(()=>{closeModal();refreshDeletionRequestState()},450);return}
    const {error}=await sb.from('account_deletion_requests').insert({user_id:state.user.id,family_id:state.family.id,reason});
    if(error){notice('deleteAccountNotice',error.message);submit.disabled=false;submit.textContent='Отправить запрос';return}
    notice('deleteAccountNotice','Запрос зарегистрирован.','success');setTimeout(()=>{closeModal();refreshDeletionRequestState()},500);
  };
}

async function bindAccess(){
  const btn=document.getElementById('createInvite');
  if(btn)btn.onclick=async()=>{
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
  window.FinancePush?.bindSettings?.();
  const deletion=document.getElementById('requestAccountDeletion');if(deletion)deletion.onclick=openAccountDeletion;
  await refreshDeletionRequestState();
  const deletionIntent=new URLSearchParams(location.search).get('delete-account');if(deletionIntent==='1'){clearDeletionIntent();openAccountDeletion()}
}

window.openAccountDeletion=openAccountDeletion;
