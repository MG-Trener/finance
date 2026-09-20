// Removes retired accounting categories from live and offline state.
(function(){
  const RETIRED_CATEGORY_NAMES=new Set(['цели и накопления']);

  function isRetiredCategory(category){
    return RETIRED_CATEGORY_NAMES.has(String(category?.name||'').trim().toLocaleLowerCase('ru-RU'));
  }

  function scrubRetiredCategories(){
    const categories=Array.isArray(state.categories)?state.categories:[];
    const retiredIds=new Set(categories.filter(isRetiredCategory).map(category=>category.id));
    const filteredCategories=categories.filter(category=>!isRetiredCategory(category));
    let changed=filteredCategories.length!==categories.length;
    state.categories=filteredCategories;

    if(!retiredIds.size)return changed;

    const scrub=(key,predicate)=>{
      const list=Array.isArray(state[key])?state[key]:[];
      const next=list.filter(predicate);
      if(next.length!==list.length)changed=true;
      state[key]=next;
    };

    scrub('subcategories',item=>!retiredIds.has(item.category_id));
    scrub('transactions',item=>!retiredIds.has(item.category_id));
    scrub('trashTransactions',item=>!retiredIds.has(item.category_id));
    scrub('recurring',item=>!retiredIds.has(item.category_id));
    return changed;
  }

  window.FinanceRetiredCategories={scrub:scrubRetiredCategories};

  if(typeof loadData==='function'){
    const baseLoadData=loadData;
    loadData=async function(){
      await baseLoadData();
      if(scrubRetiredCategories()){
        window.FinanceOffline?.persistSnapshotSoon?.();
        if(typeof renderApp==='function')renderApp();
      }
    };
  }

  if(window.FinanceOffline?.restoreSnapshot){
    const baseRestoreSnapshot=window.FinanceOffline.restoreSnapshot.bind(window.FinanceOffline);
    window.FinanceOffline.restoreSnapshot=async function(...args){
      const restored=await baseRestoreSnapshot(...args);
      if(restored&&scrubRetiredCategories()){
        window.FinanceOffline?.persistSnapshotSoon?.();
        if(typeof renderApp==='function')renderApp();
      }
      return restored;
    };
  }
})();
