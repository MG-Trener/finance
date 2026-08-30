// Keep the first overview render pinned to the very top.
// Android WebView may restore the previous document scroll position before the
// application replaces the boot screen, so reset it again while layout settles.
(function(){
  try{
    if('scrollRestoration' in history)history.scrollRestoration='manual';
  }catch(_){}

  function resetDocumentTop(){
    try{window.scrollTo({top:0,left:0,behavior:'auto'})}catch(_){window.scrollTo(0,0)}
    const scrolling=document.scrollingElement;
    if(scrolling)scrolling.scrollTop=0;
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    const main=document.querySelector('.main');
    if(main)main.scrollTop=0;
  }

  function settleAtTop(){
    resetDocumentTop();
    requestAnimationFrame(()=>{
      resetDocumentTop();
      requestAnimationFrame(resetDocumentTop);
    });
    [60,180,420,800].forEach(delay=>setTimeout(resetDocumentTop,delay));
  }

  resetDocumentTop();

  if(typeof renderApp!=='function')return;
  const baseRenderApp=renderApp;
  let firstOverviewPending=true;

  renderApp=function(){
    const result=baseRenderApp.apply(this,arguments);
    if(firstOverviewPending&&state?.view==='overview'){
      firstOverviewPending=false;
      settleAtTop();
    }
    return result;
  };
})();
