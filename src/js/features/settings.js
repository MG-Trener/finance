// Application settings hub: sound, updates, categories, spouse messages, access and sign out.
function settingsPage(){
  const soundsEnabled=localStorage.getItem('finance.uiSounds')!=='0';
  const updater=window.FinanceAppUpdate;
  const updateLabel=updater?.label||(window.__FINANCE_NATIVE__?'Проверить обновление':'Скачать Android APK');
  const updateDetail=updater?.detail||(window.__FINANCE_NATIVE__?'Проверить наличие новой версии':'Установочный файл Android');
  const familyMessage=window.FinancePush?.messageComposerMarkup?.()||'<div class="notice">Сообщения через push пока недоступны.</div>';
  return `<div class="settings-page"><div class="page-head"><div><h2 class="page-title">Настройки</h2><div class="page-subtitle">Приложение, доступ и служебные действия.</div></div></div><div class="settings-grid"><div class="card settings-card"><div class="settings-card-icon">♫</div><div class="settings-card-body"><h3>Звук интерфейса</h3><p>Звуки кнопок, переключателей и сохранения операций.</p></div><button type="button" class="btn btn-soft settings-control" id="soundToggle">${soundsEnabled?'🔊 Звуки включены':'🔇 Звуки выключены'}</button></div><div class="card settings-card"><div class="settings-card-icon">↻</div><div class="settings-card-body"><h3>Обновление приложения</h3><p data-app-update-detail>${esc(updateDetail)}</p></div><a class="btn btn-soft settings-control settings-update" href="${updater?.downloadUrl||APK_DOWNLOAD_URL}" target="_blank" rel="noopener" data-app-update-link><span data-app-update-label>${esc(updateLabel)}</span></a></div><div class="card settings-card"><div class="settings-card-icon">🏷</div><div class="settings-card-body"><h3>Категории</h3><p>Управление категориями и подкатегориями доходов и расходов.</p></div><button type="button" class="btn btn-soft settings-control" id="openCategoriesSettings">Открыть</button></div><div class="card settings-card settings-danger-card"><div class="settings-card-icon">⇥</div><div class="settings-card-body"><h3>Выход</h3><p>Завершить текущий сеанс семейной казны на этом устройстве.</p></div><button type="button" class="btn btn-danger settings-control" id="settingsLogout">Выйти</button></div><div class="card settings-message-card">${familyMessage}</div></div><section class="settings-access">${accessPage()}</section></div>`;
}

function bindSettings(){
  bindAccess?.();
  window.FinancePush?.bindMessageComposer?.();
  const categories=document.getElementById('openCategoriesSettings');
  if(categories)categories.onclick=()=>{state.view='categories';renderApp();scrollOverviewTop?.()};
  window.FinanceAppUpdate?.refreshUi?.();
}
