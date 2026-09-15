// Route Treasurer requests through the Plan-aware assistant without changing the
// existing recorder / voice pipeline. Loaded after treasurer-voices.js so its
// selected-voice wrapper remains active for the new endpoint as well.
(function(){
  const previousFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:(input?.url||'');
    const marker='/functions/v1/treasurer-assistant';
    if(url.includes(marker)&&!url.includes('/functions/v1/treasurer-assistant-plan')){
      const nextUrl=url.replace(marker,'/functions/v1/treasurer-assistant-plan');
      if(typeof input==='string')return previousFetch(nextUrl,init);
      if(input instanceof Request)return previousFetch(new Request(nextUrl,input),init);
    }
    return previousFetch(input,init);
  };
})();