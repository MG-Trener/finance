// Application settings hub: sound, updates, family dictionary, categories, access and sign out.
let familyDictionaryRows=[];
let familyDictionaryOwner='wife';

const FAMILY_DICTIONARY_META={
  wife:{label:'Словарь жены',description:'Псевдонимы и ласковые имена, которыми её называет муж.',placeholder:'Например: Золотко'},
  husband:{label:'Словарь мужа',description:'Псевдонимы и ласковые имена, которыми его называет жена.',placeholder:'Например: Любимый'}
};

function familyDictionaryCacheKey(){return `finance.familyDictionary.${state.family?.id||'local'}`}
function legacyWifeDictionaryCacheKey(){return `finance.wifeDictionary.${state.family?.id||'local'}`}
function normalizeFamilyDictionaryRow(row){
  return {...row,dictionary_owner:row?.dictionary_owner==='husband'?'husband':'wife',comment:String(row?.comment||'')};
}
function readFamilyDictionaryCache(){
  try{
    const current=JSON.parse(localStorage.getItem(familyDictionaryCacheKey())||'null');
    if(Array.isArray(current))return current.map(normalizeFamilyDictionaryRow);
    const legacy=JSON.parse(localStorage.getItem(legacyWifeDictionaryCacheKey())||'[]');
    return Array.isArray(legacy)?legacy.map(normalizeFamilyDictionaryRow):[];
  }catch(_){return[]}
}
function saveFamilyDictionaryCache(){
  try{localStorage.setItem(familyDictionaryCacheKey(),JSON.stringify(familyDictionaryRows))}catch(_){}
}
function familyDictionaryVisibleRows(){
  return familyDictionaryRows
    .filter(row=>row.dictionary_owner===familyDictionaryOwner)
    .sort((a,b)=>String(a.alias||'').localeCompare(String(b.alias||''),'ru',{sensitivity:'base'}));
}
function familyDictionaryListMarkup(){
  const rows=familyDictionaryVisibleRows();
  if(!rows.length)return '<div class="family-dictionary-empty">Пока нет записей. Добавьте первую.</div>';
  return rows.map(row=>`<button type="button" class="family-dictionary-alias" data-id="${row.id}" title="Редактировать или удалить"><span class="family-dictionary-alias-text">${esc(row.alias)}</span>${row.comment?`<span class="family-dictionary-comment">— ${esc(row.comment)}</span>`:''}</button>`).join('');
}
function bindFamilyDictionaryRows(){
  document.querySelectorAll('#familyDictionaryList .family-dictionary-alias[data-id]').forEach(button=>{
    button.onclick=()=>openFamilyDictionaryEdit(button.dataset.id);
  });
}
function renderFamilyDictionaryList(){
  const list=document.getElementById('familyDictionaryList');if(!list)return;
  list.innerHTML=familyDictionaryListMarkup();
  const count=document.getElementById('familyDictionaryCount');if(count)count.textContent=String(familyDictionaryVisibleRows().length);
  bindFamilyDictionaryRows();
}
function renderFamilyDictionaryOwnerUi(){
  const meta=FAMILY_DICTIONARY_META[familyDictionaryOwner];
  document.querySelectorAll('.family-dictionary-tab[data-owner]').forEach(tab=>{
    const active=tab.dataset.owner===familyDictionaryOwner;
    tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',active?'true':'false');
  });
  const hint=document.getElementById('familyDictionaryHint');if(hint)hint.textContent=meta.description;
  const input=document.getElementById('familyDictionaryInput');if(input)input.placeholder=meta.placeholder;
  renderFamilyDictionaryList();
}
async function loadFamilyDictionary(){
  familyDictionaryRows=readFamilyDictionaryCache();renderFamilyDictionaryList();
  if(!navigator.onLine){if(!familyDictionaryRows.length)notice('familyDictionaryNotice','Нет подключения. Словарь загрузится после подключения к интернету.');return}
  const {data,error}=await sb.from('wife_dictionary').select('id,alias,comment,dictionary_owner,created_by,created_at').eq('family_id',state.family.id).order('created_at',{ascending:false});
  if(error)return notice('familyDictionaryNotice',`Не удалось загрузить словарь: ${error.message||error}`);
  familyDictionaryRows=(data||[]).map(normalizeFamilyDictionaryRow);saveFamilyDictionaryCache();renderFamilyDictionaryList();
}
function openFamilyDictionaryEdit(id){
  const row=familyDictionaryRows.find(item=>item.id===id);if(!row)return;
  familyDictionaryOwner=row.dictionary_owner;
  closeModal();
  const returnToDictionary=()=>{closeModal();openFamilyDictionary()};
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop modal-layout-top" id="modal"><div class="modal family-dictionary-modal family-dictionary-edit-modal" role="dialog" aria-modal="true" aria-labelledby="familyDictionaryEditTitle"><div class="modal-head family-dictionary-head"><div><h2 id="familyDictionaryEditTitle">Редактировать запись</h2><p>${esc(FAMILY_DICTIONARY_META[row.dictionary_owner].label)}</p></div><button type="button" class="icon-btn" id="closeFamilyDictionaryEdit" aria-label="Закрыть">×</button></div><div id="familyDictionaryEditNotice"></div><form id="familyDictionaryEditForm" class="family-dictionary-form"><label for="familyDictionaryEditInput">Запись</label><input id="familyDictionaryEditInput" maxlength="120" autocomplete="off" value="${esc(row.alias)}" required><label for="familyDictionaryEditComment">Комментарий</label><textarea id="familyDictionaryEditComment" maxlength="500" rows="2" placeholder="Необязательно">${esc(row.comment)}</textarea><div class="family-dictionary-edit-actions"><button type="button" class="btn btn-danger btn-small family-dictionary-delete" id="familyDictionaryDelete">Удалить</button><span class="family-dictionary-actions-spacer"></span><button type="button" class="btn btn-soft btn-small" id="familyDictionaryEditCancel">Отмена</button><button type="submit" class="btn btn-primary btn-small" id="familyDictionaryEditSave">Сохранить</button></div></form></div></div>`);
  const modal=document.getElementById('modal');
  document.getElementById('closeFamilyDictionaryEdit').onclick=returnToDictionary;
  document.getElementById('familyDictionaryEditCancel').onclick=returnToDictionary;
  modal.onclick=e=>{if(e.target===modal)returnToDictionary()};
  document.getElementById('familyDictionaryDelete').onclick=async()=>{
    if(!confirm(`Удалить запись «${row.alias}»?`))return;
    if(!navigator.onLine)return notice('familyDictionaryEditNotice','Для удаления нужен интернет.');
    const deleteButton=document.getElementById('familyDictionaryDelete');
    deleteButton.disabled=true;deleteButton.textContent='Удаляю…';
    try{
      const {error}=await sb.from('wife_dictionary').delete().eq('id',row.id).eq('family_id',state.family.id);
      if(error)return notice('familyDictionaryEditNotice',`Не удалось удалить: ${error.message||error}`);
      familyDictionaryRows=familyDictionaryRows.filter(item=>item.id!==row.id);saveFamilyDictionaryCache();if(typeof uiSound==='function')uiSound('success');returnToDictionary();
    }finally{if(document.body.contains(deleteButton)){deleteButton.disabled=false;deleteButton.textContent='Удалить'}}
  };
  document.getElementById('familyDictionaryEditForm').onsubmit=async e=>{
    e.preventDefault();notice('familyDictionaryEditNotice','');
    const input=document.getElementById('familyDictionaryEditInput'),commentInput=document.getElementById('familyDictionaryEditComment'),button=document.getElementById('familyDictionaryEditSave');
    const alias=input.value.trim(),comment=commentInput.value.trim();
    if(!alias)return notice('familyDictionaryEditNotice','Введите текст записи.');
    if(alias===row.alias&&comment===row.comment)return returnToDictionary();
    if(!navigator.onLine)return notice('familyDictionaryEditNotice','Для сохранения изменений нужен интернет.');
    button.disabled=true;button.textContent='Сохраняю…';
    try{
      const {data,error}=await sb.from('wife_dictionary').update({alias,comment:comment||null}).eq('id',row.id).eq('family_id',state.family.id).select('id,alias,comment,dictionary_owner,created_by,created_at').single();
      if(error){if(error.code==='23505')return notice('familyDictionaryEditNotice','Такая запись уже есть в этом словаре.');return notice('familyDictionaryEditNotice',`Не удалось сохранить: ${error.message||error}`)}
      const normalized=normalizeFamilyDictionaryRow(data);familyDictionaryRows=familyDictionaryRows.map(item=>item.id===normalized.id?normalized:item);saveFamilyDictionaryCache();if(typeof uiSound==='function')uiSound('success');returnToDictionary();
    }finally{if(document.body.contains(button)){button.disabled=false;button.textContent='Сохранить'}}
  };
}
function openFamilyDictionary(){
  closeModal();familyDictionaryRows=readFamilyDictionaryCache();
  const meta=FAMILY_DICTIONARY_META[familyDictionaryOwner];
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop modal-layout-top" id="modal"><div class="modal family-dictionary-modal" role="dialog" aria-modal="true" aria-labelledby="familyDictionaryTitle"><div class="modal-head family-dictionary-head"><div><h2 id="familyDictionaryTitle">Семейный словарь</h2><p id="familyDictionaryHint">${esc(meta.description)}</p></div><button type="button" class="icon-btn" id="closeFamilyDictionary" aria-label="Закрыть">×</button></div><div class="family-dictionary-tabs" role="tablist" aria-label="Выбор словаря"><button type="button" class="family-dictionary-tab" data-owner="wife" role="tab">Словарь жены</button><button type="button" class="family-dictionary-tab" data-owner="husband" role="tab">Словарь мужа</button></div><div id="familyDictionaryNotice"></div><form id="familyDictionaryForm" class="family-dictionary-form"><label for="familyDictionaryInput">Новая запись</label><div class="family-dictionary-entry"><input id="familyDictionaryInput" maxlength="120" autocomplete="off" placeholder="${esc(meta.placeholder)}" required><button type="submit" class="btn btn-primary btn-small" id="familyDictionaryAdd">Добавить</button></div><label for="familyDictionaryComment">Комментарий</label><textarea id="familyDictionaryComment" maxlength="500" rows="2" placeholder="Необязательно — будет показан рядом с записью"></textarea></form><div class="family-dictionary-summary">Записей: <b id="familyDictionaryCount">0</b></div><div class="family-dictionary-list" id="familyDictionaryList"></div></div></div>`);
  const modal=document.getElementById('modal');document.getElementById('closeFamilyDictionary').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};
  document.querySelectorAll('.family-dictionary-tab[data-owner]').forEach(tab=>{tab.onclick=()=>{familyDictionaryOwner=tab.dataset.owner;notice('familyDictionaryNotice','');renderFamilyDictionaryOwnerUi()}});
  const form=document.getElementById('familyDictionaryForm');
  form.onsubmit=async e=>{
    e.preventDefault();notice('familyDictionaryNotice','');
    const input=document.getElementById('familyDictionaryInput'),commentInput=document.getElementById('familyDictionaryComment'),button=document.getElementById('familyDictionaryAdd');
    const alias=input.value.trim(),comment=commentInput.value.trim();
    if(!alias)return notice('familyDictionaryNotice','Введите текст записи.');
    if(!navigator.onLine)return notice('familyDictionaryNotice','Для сохранения новой записи нужен интернет.');
    button.disabled=true;button.textContent='Сохраняю…';
    try{
      const {data,error}=await sb.from('wife_dictionary').insert({family_id:state.family.id,alias,comment:comment||null,dictionary_owner:familyDictionaryOwner,created_by:state.user.id}).select('id,alias,comment,dictionary_owner,created_by,created_at').single();
      if(error){if(error.code==='23505')return notice('familyDictionaryNotice','Такая запись уже есть в этом словаре.');return notice('familyDictionaryNotice',`Не удалось сохранить: ${error.message||error}`)}
      const normalized=normalizeFamilyDictionaryRow(data);familyDictionaryRows=[normalized,...familyDictionaryRows.filter(x=>x.id!==normalized.id)];saveFamilyDictionaryCache();input.value='';commentInput.value='';renderFamilyDictionaryList();if(typeof uiSound==='function')uiSound('success');input.focus();
    }finally{if(document.body.contains(button)){button.disabled=false;button.textContent='Добавить'}}
  };
  renderFamilyDictionaryOwnerUi();loadFamilyDictionary();
}

function settingsPage(){
  const soundsEnabled=localStorage.getItem('finance.uiSounds')!=='0';
  const updater=window.FinanceAppUpdate;
  const updateLabel=updater?.label||(window.__FINANCE_NATIVE__?'Проверить обновление':'Скачать Android APK');
  const updateDetail=updater?.detail||(window.__FINANCE_NATIVE__?'Проверить наличие новой версии':'Установочный файл Android');
  const familyMessage=window.FinancePush?.messageComposerMarkup?.()||'<div class="notice">Сообщения через push пока недоступны.</div>';
  return `<div class="settings-page"><div class="page-head"><div><h2 class="page-title">Настройки</h2><div class="page-subtitle">Приложение, доступ и служебные действия.</div></div></div><div class="settings-grid"><div class="card settings-card"><div class="settings-card-icon">♫</div><div class="settings-card-body"><h3>Звук интерфейса</h3><p>Звуки кнопок, переключателей и сохранения операций.</p></div><button type="button" class="btn btn-soft btn-small settings-control" id="soundToggle">${soundsEnabled?'🔊 Включены':'🔇 Выключены'}</button></div><div class="card settings-card"><div class="settings-card-icon">↻</div><div class="settings-card-body"><h3>Обновление приложения</h3><p data-app-update-detail>${esc(updateDetail)}</p></div><a class="btn btn-soft btn-small settings-control settings-update" href="${updater?.downloadUrl||APK_DOWNLOAD_URL}" target="_blank" rel="noopener" data-app-update-link><span data-app-update-label>${esc(updateLabel)}</span></a></div><div class="card settings-card"><div class="settings-card-icon">✎</div><div class="settings-card-body"><h3>Семейный словарь</h3><p>Отдельные словари жены и мужа с комментариями.</p></div><button type="button" class="btn btn-soft btn-small settings-control" id="openFamilyDictionary">Открыть</button></div><div class="card settings-card"><div class="settings-card-icon">🏷</div><div class="settings-card-body"><h3>Категории</h3><p>Категории и подкатегории доходов и расходов.</p></div><button type="button" class="btn btn-soft btn-small settings-control" id="openCategoriesSettings">Открыть</button></div><div class="card settings-card settings-danger-card"><div class="settings-card-icon">⇥</div><div class="settings-card-body"><h3>Выход</h3><p>Завершить текущий сеанс на этом устройстве.</p></div><button type="button" class="btn btn-danger btn-small settings-control" id="settingsLogout">Выйти</button></div><div class="card settings-message-card">${familyMessage}</div></div><section class="settings-access">${accessPage()}</section></div>`;
}

function bindSettings(){
  bindAccess?.();
  window.FinancePush?.bindMessageComposer?.();
  const dictionary=document.getElementById('openFamilyDictionary');if(dictionary)dictionary.onclick=openFamilyDictionary;
  const categories=document.getElementById('openCategoriesSettings');
  if(categories)categories.onclick=()=>{state.view='categories';renderApp();scrollOverviewTop?.()};
  window.FinanceAppUpdate?.refreshUi?.();
}
