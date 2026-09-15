// Final reference-oriented presentation layer for the Plan screen.
// Adds purely decorative structure over the existing Plan implementation.
(function(){
  if(typeof planPage!=='function')return;
  const basePlanPageReference=planPage;

  planPage=function(){
    const html=basePlanPageReference();
    const template=document.createElement('template');
    template.innerHTML=html;
    const root=template.content.querySelector('.plan-vintage-page');
    if(!root)return html;
    root.classList.add('plan-reference-ornate');
    if(planSection==='calendar'&&!root.querySelector('.plan-frame-corner')){
      ['tl','tr','bl','br'].forEach(pos=>root.insertAdjacentHTML('beforeend',`<span class="plan-frame-corner ${pos}" aria-hidden="true"></span>`));
    }
    return template.innerHTML;
  };

  if(typeof recurringPage==='function')recurringPage=function(){return planPage()};
})();
