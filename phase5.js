// Phase 5: autofocus amount on Overview after every render/navigation.
(function(){
  function focusAmount(){
    if(state?.view!=='overview') return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const input=document.getElementById('amount');
      if(!input) return;
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
