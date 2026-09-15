// Enforce server-side read-only Treasurer behavior without changing existing UI flows.
(function(){
  const previousFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:(input?.url||'');
    let next=url;
    if(url.includes('/functions/v1/treasurer-assistant-plan')&&!url.includes('/functions/v1/treasurer-readonly-gateway')){
      next=url.replace('/functions/v1/treasurer-assistant-plan','/functions/v1/treasurer-readonly-gateway');
    }else if(url.includes('/functions/v1/treasurer-live-delegate')&&!url.includes('/functions/v1/treasurer-live-readonly-delegate')){
      next=url.replace('/functions/v1/treasurer-live-delegate','/functions/v1/treasurer-live-readonly-delegate');
    }
    if(next===url)return previousFetch(input,init);
    if(typeof input==='string')return previousFetch(next,init);
    if(input instanceof Request)return previousFetch(new Request(next,input),init);
    return previousFetch(input,init);
  };
})();