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

// Keep the music controller isolated from the core UI bundle. It is loaded here
// because this script runs after the document body exists but before app startup.
(function(){
  if(document.querySelector('script[data-finance-music]'))return;
  const script=document.createElement('script');
  script.src='src/js/ui/music.js?v=music2';
  script.dataset.financeMusic='1';
  script.async=true;
  script.onerror=()=>console.warn('Не удалось загрузить музыкальный модуль приложения.');
  document.head.appendChild(script);
})();
