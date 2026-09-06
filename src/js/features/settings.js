// Application settings hub: sound, updates, categories, spouse messages, access and sign out.
let wifeDictionaryRows=[];

function wifeDictionaryCacheKey(){return `finance.wifeDictionary.${state.family?.id||'local'}`}
function readWifeDictionaryCache(){
  try{const rows=JSON.parse(localStorage.getItem(wifeDictionaryCacheKey())||'[]');return Array.isArray(rows)?rows:[]}catch(_){return[]}
}
function saveWifeDictionaryCache(){
  try{localStorage.setItem(wifeDictionaryCacheKey(),JSON.stringify(wifeDictionaryRows))}catch(_){}
}
function wifeDictionaryListMarkup(){
  if(!wifeDictionaryRows.length)return '<div class="wife-dictionary-empty">Пока нет записей. Добавьте первый псевдоним.</div>';
  const deleteIcon=typeof trashIcon==='function'?trashIcon():'×';
  return wifeDictionaryRows.map(row=>`<div class="wife-dictionary-row" data-id="${row.id}"><span class="wife-dictionary-alias">${esc(row.alias)}</span><button type="button" class="icon-btn wife-dictionary-delete" data-id="${row.id}" aria-label="Удалить ${esc(row.alias)}" title="Удалить">${deleteIcon}</button></div>`).join('');
}
function bindWifeDictionaryDeleteButtons(){
  document.querySelectorAll('.wife-dictionary-delete').forEach(button=>button.onclick=async()=>{
    const row=wifeDictionaryRows.find(x=>x.id===button.dataset.id);if(!row)return;
    if(!confirm(`Удалить «${row.alias}» из словаря?`))return;
    if(!navigator.onLine)return notice('wifeDictionaryNotice','Для удаления записи нужен интернет.');
    button.disabled=true;
    const {error}=await sb.from('wife_dictionary').delete().eq('id',row.id).eq('family_id',state.family.id);
    if(error){button.disabled=false;return notice('wifeDictionaryNotice',error.message||String(error))}
    wifeDictionaryRows=wifeDictionaryRows.filter(x=>x.id!==row.id);saveWifeDictionaryCache();renderWifeDictionaryList();if(typeof uiSound==='function')uiSound('delete');
  });
}
function renderWifeDictionaryList(){
  const list=document.getElementById('wifeDictionaryList');if(!list)return;
  list.innerHTML=wifeDictionaryListMarkup();
  const count=document.getElementById('wifeDictionaryCount');if(count)count.textContent=String(wifeDictionaryRows.length);
  bindWifeDictionaryDeleteButtons();
}
async function loadWifeDictionary(){
  wifeDictionaryRows=readWifeDictionaryCache();renderWifeDictionaryList();
  if(!navigator.onLine){if(!wifeDictionaryRows.length)notice('wifeDictionaryNotice','Нет подключения. Словарь загрузится после подключения к интернету.');return}
  const {data,error}=await sb.from('wife_dictionary').select('id,alias,created_by,created_at').eq('family_id',state.family.id).order('created_at',{ascending:false});
  if(error)return notice('wifeDictionaryNotice',`Не удалось загрузить словарь: ${error.message||error}`);
  wifeDictionaryRows=data||[];saveWifeDictionaryCache();renderWifeDictionaryList();
}
function openWifeDictionary(){
  closeModal();wifeDictionaryRows=readWifeDictionaryCache();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal wife-dictionary-modal" role="dialog" aria-modal="true" aria-labelledby="wifeDictionaryTitle"><div class="modal-head wife-dictionary-head"><div><h2 id="wifeDictionaryTitle">Словарь жены</h2><p>Псевдонимы и ласковые имена, которыми её называет муж.</p></div><button type="button" class="icon-btn" id="closeWifeDictionary" aria-label="Закрыть">×</button></div><div id="wifeDictionaryNotice"></div><form id="wifeDictionaryForm" class="wife-dictionary-form"><label for="wifeDictionaryInput">Новая запись</label><div class="wife-dictionary-entry"><input id="wifeDictionaryInput" maxlength="120" autocomplete="off" placeholder="Например: Золотко" required><button type="submit" class="btn btn-primary btn-small" id="wifeDictionaryAdd">Добавить</button></div></form><div class="wife-dictionary-summary">Записей: <b id="wifeDictionaryCount">${wifeDictionaryRows.length}</b></div><div class="wife-dictionary-list" id="wifeDictionaryList">${wifeDictionaryListMarkup()}</div></div></div>`);
  const modal=document.getElementById('modal');document.getElementById('closeWifeDictionary').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};
  const form=document.getElementById('wifeDictionaryForm');
  form.onsubmit=async e=>{
    e.preventDefault();notice('wifeDictionaryNotice','');
    const input=document.getElementById('wifeDictionaryInput'),button=document.getElementById('wifeDictionaryAdd'),alias=input.value.trim();
    if(!alias)return notice('wifeDictionaryNotice','Введите текст записи.');
    if(!navigator.onLine)return notice('wifeDictionaryNotice','Для сохранения новой записи нужен интернет.');
    button.disabled=true;button.textContent='Сохраняю…';
    try{
      const {data,error}=await sb.from('wife_dictionary').insert({family_id:state.family.id,alias,created_by:state.user.id}).select('id,alias,created_by,created_at').single();
      if(error){if(error.code==='23505')return notice('wifeDictionaryNotice','Такой псевдоним уже есть в словаре.');return notice('wifeDictionaryNotice',`Не удалось сохранить: ${error.message||error}`)}
      wifeDictionaryRows=[data,...wifeDictionaryRows.filter(x=>x.id!==data.id)];saveWifeDictionaryCache();input.value='';renderWifeDictionaryList();if(typeof uiSound==='function')uiSound('success');input.focus();
    }finally{if(document.body.contains(button)){button.disabled=false;button.textContent='Добавить'}}
  };
  bindWifeDictionaryDeleteButtons();loadWifeDictionary();setTimeout(()=>document.getElementById('wifeDictionaryInput')?.focus(),0);
}

function settingsPage(){
  const soundsEnabled=localStorage.getItem('finance.uiSounds')!=='0';
  const updater=window.FinanceAppUpdate;
  const updateLabel=updater?.label||(window.__FINANCE_NATIVE__?'Проверить обновление':'Скачать Android APK');
  const updateDetail=updater?.detail||(window.__FINANCE_NATIVE__?'Проверить наличие новой версии':'Установочный файл Android');
  const familyMessage=window.FinancePush?.messageComposerMarkup?.()||'<div class="notice">Сообщения через push пока недоступны.</div>';
  return `<div class="settings-page"><div class="page-head"><div><h2 class="page-title">Настройки</h2><div class="page-subtitle">Приложение, доступ и служебные действия.</div></div></div><div class="settings-grid"><div class="card settings-card"><div class="settings-card-icon">♫</div><div class="settings-card-body"><h3>Звук интерфейса</h3><p>Звуки кнопок, переключателей и сохранения операций.</p></div><button type="button" class="btn btn-soft btn-small settings-control" id="soundToggle">${soundsEnabled?'🔊 Включены':'🔇 Выключены'}</button></div><div class="card settings-card"><div class="settings-card-icon">↻</div><div class="settings-card-body"><h3>Обновление приложения</h3><p data-app-update-detail>${esc(updateDetail)}</p></div><a class="btn btn-soft btn-small settings-control settings-update" href="${updater?.downloadUrl||APK_DOWNLOAD_URL}" target="_blank" rel="noopener" data-app-update-link><span data-app-update-label>${esc(updateLabel)}</span></a></div><div class="card settings-card"><div class="settings-card-icon">✎</div><div class="settings-card-body"><h3>Словарь жены</h3><p>Псевдонимы и ласковые имена в одном семейном списке.</p></div><button type="button" class="btn btn-soft btn-small settings-control" id="openWifeDictionary">Открыть</button></div><div class="card settings-card"><div class="settings-card-icon">🏷</div><div class="settings-card-body"><h3>Категории</h3><p>Категории и подкатегории доходов и расходов.</p></div><button type="button" class="btn btn-soft btn-small settings-control" id="openCategoriesSettings">Открыть</button></div><div class="card settings-card settings-danger-card"><div class="settings-card-icon">⇥</div><div class="settings-card-body"><h3>Выход</h3><p>Завершить текущий сеанс на этом устройстве.</p></div><button type="button" class="btn btn-danger btn-small settings-control" id="settingsLogout">Выйти</button></div><div class="card settings-message-card">${familyMessage}</div></div><section class="settings-access">${accessPage()}</section></div>`;
}

function bindSettings(){
  bindAccess?.();
  window.FinancePush?.bindMessageComposer?.();
  const dictionary=document.getElementById('openWifeDictionary');if(dictionary)dictionary.onclick=openWifeDictionary;
  const categories=document.getElementById('openCategoriesSettings');
  if(categories)categories.onclick=()=>{state.view='categories';renderApp();scrollOverviewTop?.()};
  window.FinanceAppUpdate?.refreshUi?.();
}
