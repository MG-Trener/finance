// Offline-first storage for the installed/mobile app.
// IndexedDB keeps a local family snapshot and a queue of transaction mutations.
(function(){
  const DB_NAME='finance-offline-v1',DB_VERSION=1,SNAPSHOT_STORE='snapshots',QUEUE_STORE='queue';
  const SNAPSHOT_FIELDS=['family','people','categories','subcategories','transactions','trashTransactions','budgets','recurring','goals','goalContributions','activeTransactionsHasMore','trashTransactionsHasMore','selectedPersonId'];
  let dbPromise=null,persistTimer=null,syncing=false,pendingCount=0,lastSyncError='';

  const uid=()=>state.user?.id||'';
  const familyId=()=>state.family?.id||'';
  const snapshotKey=userId=>`user:${userId}`;
  const tempId=()=>`offline:${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const isTempId=id=>String(id||'').startsWith('offline:');
  const nowIso=()=>new Date().toISOString();

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('IndexedDB недоступен'));
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(SNAPSHOT_STORE))db.createObjectStore(SNAPSHOT_STORE,{keyPath:'key'});
        if(!db.objectStoreNames.contains(QUEUE_STORE)){
          const store=db.createObjectStore(QUEUE_STORE,{keyPath:'id'});
          store.createIndex('user_id','userId',{unique:false});
          store.createIndex('family_id','familyId',{unique:false});
          store.createIndex('queued_at','queuedAt',{unique:false});
        }
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Не удалось открыть локальное хранилище'));
    });
    return dbPromise;
  }

  async function storeGet(storeName,key){
    const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readonly').objectStore(storeName).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  }
  async function storeAll(storeName){
    const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readonly').objectStore(storeName).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)});
  }
  async function storePut(storeName,value){
    const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readwrite').objectStore(storeName).put(value);req.onsuccess=()=>resolve(value);req.onerror=()=>reject(req.error)});
  }
  async function storeDelete(storeName,key){
    const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readwrite').objectStore(storeName).delete(key);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)});
  }

  function networkError(error){
    const msg=String(error?.message||error||'').toLowerCase();
    return !navigator.onLine||/failed to fetch|fetch failed|network|load failed|internet|connection|timeout|timed out/.test(msg);
  }

  function snapshotData(){
    const data={};for(const key of SNAPSHOT_FIELDS)data[key]=state[key];return data;
  }
  async function persistSnapshot(){
    if(!uid()||!state.family)return false;
    try{
      await storePut(SNAPSHOT_STORE,{key:snapshotKey(uid()),userId:uid(),familyId:familyId(),savedAt:nowIso(),data:snapshotData()});
      return true;
    }catch(error){console.warn('Не удалось сохранить офлайн-копию',error);return false}
  }
  function persistSnapshotSoon(){clearTimeout(persistTimer);persistTimer=setTimeout(()=>persistSnapshot(),180)}

  async function restoreSnapshot(userId=uid()){
    if(!userId)return false;
    try{
      const saved=await storeGet(SNAPSHOT_STORE,snapshotKey(userId));if(!saved?.data)return false;
      for(const key of SNAPSHOT_FIELDS)if(Object.prototype.hasOwnProperty.call(saved.data,key))state[key]=saved.data[key];
      state.offlineSnapshotAt=saved.savedAt||null;
      await reapplyPendingToState();
      updateStatus();
      if(typeof renderApp==='function')renderApp();
      return true;
    }catch(error){console.warn('Не удалось открыть офлайн-копию',error);return false}
  }

  async function ownQueue(){
    try{
      const all=await storeAll(QUEUE_STORE),user=uid(),family=familyId();
      return all.filter(x=>(!user||x.userId===user)&&(!family||x.familyId===family)).sort((a,b)=>String(a.queuedAt).localeCompare(String(b.queuedAt)));
    }catch(_){return[]}
  }
  async function refreshPendingCount(){pendingCount=(await ownQueue()).length;updateStatus();return pendingCount}
  function queueItem(kind,transactionId,payload={},extra={}){
    return {id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,kind,transactionId,userId:uid(),familyId:familyId(),payload,queuedAt:nowIso(),lastError:'',...extra};
  }

  function optimisticRow(payload,id,extra={}){
    const stamp=nowIso();
    return {id,family_id:familyId(),person_id:payload.person_id,type:payload.type,amount:payload.amount,category_id:payload.category_id,subcategory_id:payload.subcategory_id||null,description:payload.description||null,occurred_at:payload.occurred_at||stamp,created_at:stamp,updated_at:stamp,created_by:uid(),updated_by:uid(),deleted_at:null,deleted_by:null,_offline:true,...extra};
  }

  async function enqueueCreate(payload){
    const id=tempId(),row=optimisticRow(payload,id,{_pending_action:'create'}),item=queueItem('create',id,payload,{optimisticRow:row});
    await storePut(QUEUE_STORE,item);syncTransactionState(row);await refreshPendingCount();persistSnapshotSoon();return row;
  }
  async function enqueueUpdate(id,payload){
    if(isTempId(id)){
      const queue=await ownQueue(),create=queue.find(x=>x.kind==='create'&&x.transactionId===id);
      if(create){create.payload={...create.payload,...payload};create.optimisticRow={...(create.optimisticRow||{}),...payload,updated_at:nowIso(),_offline:true,_pending_action:'create'};await storePut(QUEUE_STORE,create);syncTransactionState(create.optimisticRow);await refreshPendingCount();persistSnapshotSoon();return create.optimisticRow}
    }
    const queue=await ownQueue(),existing=[...queue].reverse().find(x=>x.kind==='update'&&x.transactionId===id);
    const item=existing?{...existing,payload:{...existing.payload,...payload},lastError:''}:queueItem('update',id,payload);
    await storePut(QUEUE_STORE,item);
    const current=byId(state.transactions,id)||byId(state.trashTransactions,id);const row={...current,...payload,updated_at:nowIso(),updated_by:uid(),_offline:true,_pending_action:'update'};syncTransactionState(row);await refreshPendingCount();persistSnapshotSoon();return row;
  }
  async function enqueueDeletedState(id,deleted){
    if(isTempId(id)&&deleted){
      const queue=await ownQueue();for(const item of queue.filter(x=>x.transactionId===id))await storeDelete(QUEUE_STORE,item.id);
      state.transactions=state.transactions.filter(x=>x.id!==id);state.trashTransactions=state.trashTransactions.filter(x=>x.id!==id);await refreshPendingCount();persistSnapshotSoon();return{removed:true,data:null};
    }
    const value=deleted?nowIso():null,item=queueItem(deleted?'delete':'restore',id,{deleted_at:value});await storePut(QUEUE_STORE,item);
    const current=byId(state.transactions,id)||byId(state.trashTransactions,id),row={...current,deleted_at:value,deleted_by:deleted?uid():null,updated_at:nowIso(),updated_by:uid(),_offline:true,_pending_action:deleted?'delete':'restore'};syncTransactionState(row);await refreshPendingCount();persistSnapshotSoon();return{removed:false,data:row};
  }

  async function saveTransaction({editId=null,payload,createArgs}){
    if(editId&&isTempId(editId))return{data:await enqueueUpdate(editId,payload),error:null,queued:true};
    if(!navigator.onLine)return{data:editId?await enqueueUpdate(editId,payload):await enqueueCreate(payload),error:null,queued:true};
    try{
      const result=editId?await sb.from('transactions').update(payload).eq('id',editId).select().single():await sb.rpc('create_family_transaction',createArgs);
      if(result.error){if(networkError(result.error))return{data:editId?await enqueueUpdate(editId,payload):await enqueueCreate(payload),error:null,queued:true};return result}
      const row=Array.isArray(result.data)?result.data[0]:result.data;if(row)syncTransactionState(row);persistSnapshotSoon();return{data:row,error:null,queued:false};
    }catch(error){if(networkError(error))return{data:editId?await enqueueUpdate(editId,payload):await enqueueCreate(payload),error:null,queued:true};return{data:null,error}}
  }
  async function updateTransaction(id,payload){
    if(isTempId(id)||!navigator.onLine)return{data:await enqueueUpdate(id,payload),error:null,queued:true};
    try{const result=await sb.from('transactions').update(payload).eq('id',id).select().single();if(result.error&&networkError(result.error))return{data:await enqueueUpdate(id,payload),error:null,queued:true};if(result.data)syncTransactionState(result.data);persistSnapshotSoon();return{...result,queued:false}}catch(error){if(networkError(error))return{data:await enqueueUpdate(id,payload),error:null,queued:true};return{data:null,error}}
  }
  async function setDeleted(id,deleted){
    if(isTempId(id)||!navigator.onLine){const local=await enqueueDeletedState(id,deleted);return{...local,error:null,queued:!local.removed}}
    const value=deleted?nowIso():null;
    try{const result=await sb.from('transactions').update({deleted_at:value}).eq('id',id).select().single();if(result.error&&networkError(result.error)){const local=await enqueueDeletedState(id,deleted);return{...local,error:null,queued:true}}if(result.data)syncTransactionState(result.data);persistSnapshotSoon();return{...result,queued:false}}catch(error){if(networkError(error)){const local=await enqueueDeletedState(id,deleted);return{...local,error:null,queued:true}}return{data:null,error}}
  }

  async function reapplyPendingToState(){
    const queue=await ownQueue();
    for(const item of queue){
      if(item.kind==='create'){const row=item.optimisticRow||optimisticRow(item.payload,item.transactionId,{_pending_action:'create'});syncTransactionState(row);continue}
      const current=byId(state.transactions,item.transactionId)||byId(state.trashTransactions,item.transactionId);if(!current)continue;
      if(item.kind==='update')syncTransactionState({...current,...item.payload,_offline:true,_pending_action:'update'});
      if(item.kind==='delete')syncTransactionState({...current,deleted_at:item.payload.deleted_at||item.queuedAt,_offline:true,_pending_action:'delete'});
      if(item.kind==='restore')syncTransactionState({...current,deleted_at:null,_offline:true,_pending_action:'restore'});
    }
    await refreshPendingCount();return queue.length;
  }

  async function processItem(item){
    let result;
    if(item.kind==='create'){
      const p=item.payload;result=await sb.rpc('create_family_transaction',{p_family_id:item.familyId,p_person_id:p.person_id,p_type:p.type,p_amount:p.amount,p_category_id:p.category_id,p_subcategory_id:p.subcategory_id||null,p_description:p.description||null,p_occurred_at:p.occurred_at});
      if(!result.error){const row=Array.isArray(result.data)?result.data[0]:result.data;state.transactions=state.transactions.filter(x=>x.id!==item.transactionId);state.trashTransactions=state.trashTransactions.filter(x=>x.id!==item.transactionId);if(row)syncTransactionState(row)}
    }else{
      const payload=item.kind==='update'?item.payload:{deleted_at:item.kind==='delete'?(item.payload.deleted_at||item.queuedAt):null};
      result=await sb.from('transactions').update(payload).eq('id',item.transactionId).select().single();if(!result.error&&result.data)syncTransactionState(result.data);
    }
    return result;
  }

  async function flushQueue(){
    if(syncing||!navigator.onLine||!uid()||!state.family)return 0;syncing=true;lastSyncError='';let synced=0;
    try{
      const queue=await ownQueue();
      for(const item of queue){
        try{
          const result=await processItem(item);
          if(result?.error){if(networkError(result.error)){lastSyncError=result.error.message||'Нет сети';break}item.lastError=result.error.message||String(result.error);await storePut(QUEUE_STORE,item);lastSyncError=item.lastError;break}
          await storeDelete(QUEUE_STORE,item.id);synced++;
        }catch(error){if(networkError(error)){lastSyncError=error?.message||'Нет сети';break}item.lastError=error?.message||String(error);await storePut(QUEUE_STORE,item);lastSyncError=item.lastError;break}
      }
      await refreshPendingCount();await persistSnapshot();return synced;
    }finally{syncing=false;updateStatus()}
  }

  function statusMarkup(){return `<span id="connectionStatus" class="connection-status" ${navigator.onLine&&pendingCount===0?'hidden':''}></span>`}
  function updateStatus(){
    const el=document.getElementById('connectionStatus');if(!el)return;
    const offline=!navigator.onLine;el.hidden=!offline&&pendingCount===0;el.className=`connection-status ${offline?'is-offline':pendingCount?'is-pending':'is-online'}`;
    el.textContent=offline?`Офлайн${pendingCount?` · ${pendingCount} в очереди`:''}`:pendingCount?`Синхронизация · ${pendingCount}`:'Онлайн';
    el.title=lastSyncError||(!offline&&pendingCount?'Изменения будут отправлены в Supabase автоматически':'');
  }

  window.FinanceOffline={persistSnapshot,persistSnapshotSoon,restoreSnapshot,reapplyPendingToState,saveTransaction,updateTransaction,setDeleted,flushQueue,refreshPendingCount,statusMarkup,updateStatus,isTempId,get pendingCount(){return pendingCount},get syncing(){return syncing}};
  window.addEventListener('online',()=>{updateStatus();flushQueue()});window.addEventListener('offline',updateStatus);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine)flushQueue()});
  window.addEventListener('load',()=>{refreshPendingCount();if(navigator.onLine)flushQueue()});
})();
