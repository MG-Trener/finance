// Progressive Web App registration and optional install action in the mobile More sheet.
(function(){
  if(window.__FINANCE_NATIVE__)return;
  let installPrompt=null;
  if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}

  function decorateInstall(){
    const list=document.querySelector('.mobile-more-list');
    if(!list||list.querySelector('#installPwa'))return;
    if(!installPrompt&&window.matchMedia('(display-mode: standalone)').matches)return;
    const button=document.createElement('button');button.type='button';button.id='installPwa';button.className='nav-item pirate-nav mobile-more-item pwa-install';button.innerHTML='<span class="nav-icon nav-more-icon" aria-hidden="true">↓</span><span class="nav-label">Установить приложение</span>';
    button.onclick=async()=>{if(!installPrompt){alert('Если браузер поддерживает установку, выберите в его меню «Добавить на главный экран» или «Установить приложение».');return}installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;button.remove()};list.appendChild(button);
  }

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;decorateInstall()});
  window.addEventListener('appinstalled',()=>{installPrompt=null;document.getElementById('installPwa')?.remove()});
  new MutationObserver(decorateInstall).observe(document.getElementById('app'),{subtree:true,childList:true});
})();
