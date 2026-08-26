// Desktop-only focus helper. Mobile browsers should not open the keyboard
// automatically when the overview is rendered.
(function(){
  window.focusAmountDesktop=function(){
    if(state?.view!=='overview')return;
    if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const input=document.getElementById('amount');
      if(!input||document.activeElement===input)return;
      input.focus({preventScroll:true});
      try{input.select()}catch(_){ }
    }));
  };
})();
