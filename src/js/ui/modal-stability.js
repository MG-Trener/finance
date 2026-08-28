// Adds explicit semantic/layout classes to legacy modals without coupling CSS to DOM position.
(function(){
  const ROOT=document.documentElement;

  function classify(backdrop){
    if(!(backdrop instanceof HTMLElement)||!backdrop.classList.contains('modal-backdrop'))return;
    const modal=backdrop.querySelector(':scope > .modal');
    if(!modal)return;

    backdrop.classList.remove('modal-layout-top','modal-layout-center','modal-layout-sheet');

    if(modal.querySelector('#editNotice')){
      modal.classList.add('transaction-edit-modal');
      backdrop.classList.add('modal-layout-top');
    }else if(modal.classList.contains('transfer-modal')||modal.querySelector('#transferForm')){
      modal.classList.add('transfer-modal');
      backdrop.classList.add('modal-layout-center');
    }else if(modal.classList.contains('quick-amount-modal')||modal.querySelector('#quickAmountForm')){
      modal.classList.add('quick-amount-modal');
      backdrop.classList.add('modal-layout-center');
    }else if(modal.classList.contains('local-lock-settings')){
      backdrop.classList.add('modal-layout-center');
    }else if(modal.classList.contains('history-modal')||modal.classList.contains('sync-center-modal')||modal.querySelector('#historyBody')){
      backdrop.classList.add('modal-layout-top');
    }else{
      backdrop.classList.add('modal-layout-sheet');
    }

    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
  }

  function refresh(){
    const backdrops=[...document.querySelectorAll('body>.modal-backdrop')];
    backdrops.forEach(classify);
    ROOT.classList.toggle('finance-modal-open',backdrops.length>0);
  }

  const observer=new MutationObserver(refresh);
  observer.observe(document.body,{childList:true});
  document.addEventListener('DOMContentLoaded',refresh);
  window.addEventListener('pageshow',refresh);
  window.FinanceModalStability={refresh,classify};
  refresh();
})();
