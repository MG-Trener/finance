// Cleans retired accounting categories and legacy auto-generated plan expenses
// from live and offline state.
(function(){
  const RETIRED_CATEGORY_NAMES=new Set(['цели и накопления']);

  function isRetiredCategory(category){
    return RETIRED_CATEGORY_NAMES.has(String(category?.name||'').trim().toLocaleLowerCase('ru-RU'));
  }

  function normalizedTime(value){
    const time=new Date(value||0).getTime();
    return Number.isFinite(time)?String(time):String(value||'');
  }

  function generatedKey(value,timeField){
    return [
      value?.person_id||'',
      value?.type||'',
      Number(value?.amount||0),
      value?.category_id||'',
      value?.subcategory_id||'',
      value?.description||'',
      normalizedTime(value?.[timeField])
    ].join('|');
  }

  function scrubRetiredState(){
    const categories=Array.isArray(state.categories)?state.categories:[];
    const recurring=Array.isArray(state.recurring)?state.recurring:[];
    const retiredIds=new Set(categories.filter(isRetiredCategory).map(category=>category.id));
    const legacyGeneratedKeys=new Set(
      recurring
        .filter(item=>item.last_generated_month&&item.last_paid_at)
        .map(item=>generatedKey(item,'last_paid_at'))
    );
    let changed=false;

    const filteredCategories=categories.filter(category=>!isRetiredCategory(category));
    if(filteredCategories.length!==categories.length)changed=true;
    state.categories=filteredCategories;

    const scrub=(key,predicate)=>{
      const list=Array.isArray(state[key])?state[key]:[];
      const next=list.filter(predicate);
      if(next.length!==list.length)changed=true;
      state[key]=next;
    };

    scrub('subcategories',item=>!retiredIds.has(item.category_id));
    scrub('transactions',item=>!retiredIds.has(item.category_id)&&!legacyGeneratedKeys.has(generatedKey(item,'occurred_at')));
    scrub('trashTransactions',item=>!retiredIds.has(item.category_id)&&!legacyGeneratedKeys.has(generatedKey(item,'occurred_at')));

    const nextRecurring=recurring
      .filter(item=>!retiredIds.has(item.category_id))
      .map(item=>item.last_generated_month?{...item,last_generated_month:null}:item);
    if(nextRecurring.length!==recurring.length||nextRecurring.some((item,index)=>item!==recurring[index]))changed=true;
    state.recurring=nextRecurring;

    return changed;
  }

  window.FinanceRetiredCategories={scrub:scrubRetiredState};

  if(typeof loadData==='function'){
    const baseLoadData=loadData;
    loadData=async function(){
      await baseLoadData();
      if(scrubRetiredState()){
        window.FinanceOffline?.persistSnapshotSoon?.();
        if(typeof renderApp==='function')renderApp();
      }
    };
  }

  if(window.FinanceOffline?.restoreSnapshot){
    const baseRestoreSnapshot=window.FinanceOffline.restoreSnapshot.bind(window.FinanceOffline);
    window.FinanceOffline.restoreSnapshot=async function(...args){
      const restored=await baseRestoreSnapshot(...args);
      if(restored&&scrubRetiredState()){
        window.FinanceOffline?.persistSnapshotSoon?.();
        if(typeof renderApp==='function')renderApp();
      }
      return restored;
    };
  }
})();
