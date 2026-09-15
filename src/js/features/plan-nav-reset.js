// Always enter Plan through its main family month calendar.
(function(){
  if(typeof bindCommon!=='function')return;
  const baseBindCommonPlanReset=bindCommon;
  bindCommon=function(){
    baseBindCommonPlanReset();
    const planNav=document.querySelector('.nav-item[data-view="recurring"]');
    if(!planNav)return;
    planNav.onclick=()=>{
      releaseMobileScrollLock?.();
      if(typeof planSection!=='undefined')planSection='calendar';
      state.view='recurring';
      state.journalLimit=50;
      renderApp();
      scrollOverviewTop?.();
    };
  };
})();
