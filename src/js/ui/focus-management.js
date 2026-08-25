// Refactored from phase5.js: autofocus amount on Overview.
(function(){
  function focusAmount(){
    if(state?.view!=='overview')return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const input=document.getElementById('amount');
      if(!input)return;
      input.focus({preventScroll:true});
      try{input.select()}catch(_){ }
    }));
  }

  const previousRenderApp=renderApp;
  renderApp=function(){
    previousRenderApp();
    focusAmount();
  };

  window.addEventListener('pageshow',focusAmount);
})();
