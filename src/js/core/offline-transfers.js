// Durable offline queue for new spouse-to-spouse transfers.
// Kept separate from the legacy transaction queue so transfer RPC semantics stay explicit.
(function(){
  const DB_NAME='finance-transfer-offline-v1';
  const DB_VERSION=1;
  const STORE='queue';
  let dbPromise=null,flushing=false,pendingCount=0,lastError='';

  const uid=()=>state.user?.id||'';
  const familyId=()=>state.family?.id||'';
  const nowIso=()=>new Date().toISOString();
  const tempId=()=>`offline:transfer:${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const isTempTransfer=id=>String(id||'').startsWith('offline:transfer:');
  const networkError=error=>!navigator.onLine||/failed to fetch|fetch failed|network|load failed|internet|connection|timeout|timed out/i.test(String(error?.message||error||''));

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('IndexedDB недоступен'));
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Не удалось открыть очередь переводов'));
    });
    return dbPromise;
  }
  async function all(){const db=await openDb();return new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readonly').objectStore(STORE).getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error)})}
  async function put(value){const db=await openDb();return new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readwrite').objectStore(STORE).put(value);request.onsuccess=()=>resolve(value);request.onerror=()=>reject(request.error)})}
  async function remove(id){const db=await openDb();return new Promise((resolve,reject)=>{const request=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)})}
  async function ownQueue(){const rows=await all();const user=uid(),family=familyId();return rows.filter(row=>(!user||row.userId===user)&&(!family||row.familyId===family)).sort((a,b)=>String(a.queuedAt).localeCompare(String(b.queuedAt)))}
  async function refreshCount(){try{pendingCount=(await ownQueue()).length}catch(_){pendingCount=0}return pendingCount}

  function optimistic(payload,id){
    const stamp=nowIso();
    return {
      id,family_id:familyId(),person_id:payload.person_id,transfer_to_person_id:payload.transfer_to_person_id,
      type:'transfer',amount:Number(payload.amount||0),category_id:null,subcategory_id:null,
      description:payload.description||null,occurred_at:payload.occurred_at||stamp,
      created_at:stamp,updated_at:stamp,created_by:uid(),updated_by:uid(),deleted_at:null,deleted_by:null,
      _offline:true,_pending_action:'create'
    };
  }

  async function enqueue(payload){
    const id=tempId(),row=optimistic(payload,id);
    await put({id,userId:uid(),familyId:familyId(),payload:{...payload,type:'transfer',category_id:null,subcategory_id:null},queuedAt:nowIso(),lastError:''});
    syncTransactionState(row);
    await refreshCount();
    window.FinanceOffline?.persistSnapshotSoon?.();
    return {data:row,error:null,queued:true};
  }

  function rpcArgs(item){
    const p=item.payload;
    return {
      p_family_id:item.familyId,
      p_from_person_id:p.person_id,
      p_to_person_id:p.transfer_to_person_id,
      p_amount:Number(p.amount||0),
      p_description:p.description||null,
      p_occurred_at:p.occurred_at||item.queuedAt
    };
  }

  async function saveTransfer({payload,createArgs}){
    if(!navigator.onLine)return enqueue(payload);
    try{
      const result=await sb.rpc('create_family_transfer',createArgs);
      if(result.error){if(networkError(result.error))return enqueue(payload);return result}
      const row=Array.isArray(result.data)?result.data[0]:result.data;
      return {data:row,error:null,queued:false};
    }catch(error){
      if(networkError(error))return enqueue(payload);
      return {data:null,error};
    }
  }

  async function updateTemp(id,payload){
    const queue=await ownQueue(),item=queue.find(row=>row.id===id);
    if(!item)return {data:null,error:new Error('Офлайн-перевод не найден')};
    item.payload={...item.payload,...payload,type:'transfer',category_id:null,subcategory_id:null};item.lastError='';
    await put(item);
    const current=byId(state.transactions,id)||byId(state.trashTransactions,id)||optimistic(item.payload,id);
    const row={...current,...item.payload,transfer_to_person_id:item.payload.transfer_to_person_id,category_id:null,subcategory_id:null,updated_at:nowIso(),_offline:true,_pending_action:'create'};
    syncTransactionState(row);window.FinanceOffline?.persistSnapshotSoon?.();
    return {data:row,error:null,queued:true};
  }

  async function discardTemp(id){
    await remove(id);
    state.transactions=state.transactions.filter(row=>row.id!==id);
    state.trashTransactions=state.trashTransactions.filter(row=>row.id!==id);
    await refreshCount();window.FinanceOffline?.persistSnapshotSoon?.();
    return {removed:true,data:null,error:null,queued:false};
  }

  async function flush(){
    if(flushing||!navigator.onLine||!uid()||!familyId())return 0;
    flushing=true;lastError='';let synced=0;
    try{
      const queue=await ownQueue();
      for(const item of queue){
        try{
          const result=await sb.rpc('create_family_transfer',rpcArgs(item));
          if(result.error){lastError=result.error.message||String(result.error);if(networkError(result.error))break;item.lastError=lastError;await put(item);break}
          const row=Array.isArray(result.data)?result.data[0]:result.data;
          state.transactions=state.transactions.filter(x=>x.id!==item.id);state.trashTransactions=state.trashTransactions.filter(x=>x.id!==item.id);
          if(row)syncTransactionState(row);
          await remove(item.id);synced++;
        }catch(error){lastError=error?.message||String(error);if(!networkError(error)){item.lastError=lastError;await put(item)}break}
      }
      await refreshCount();window.FinanceOffline?.persistSnapshotSoon?.();
      if(synced&&typeof renderStateChange==='function')renderStateChange();
      return synced;
    }finally{flushing=false}
  }

  function decorateOfflineApi(){
    const api=window.FinanceOffline;if(!api||api.__transferQueueWrapped)return Boolean(api);
    api.__transferQueueWrapped=true;
    const originalUpdate=api.updateTransaction?.bind(api),originalDelete=api.setDeleted?.bind(api);
    if(originalUpdate)api.updateTransaction=(id,payload)=>isTempTransfer(id)?updateTemp(id,payload):originalUpdate(id,payload);
    if(originalDelete)api.setDeleted=(id,deleted)=>isTempTransfer(id)?(deleted?discardTemp(id):Promise.resolve({data:null,error:new Error('Офлайн-перевод ещё не синхронизирован')})):originalDelete(id,deleted);
    return true;
  }

  function waitForReady(attempt=0){
    decorateOfflineApi();
    if(navigator.onLine&&uid()&&familyId()){flush();return}
    if(attempt<40)setTimeout(()=>waitForReady(attempt+1),250);
  }

  window.FinanceTransferOffline={saveTransfer,flush,refreshCount,isTempTransfer,updateTemp,discardTemp,get pendingCount(){return pendingCount},get flushing(){return flushing},get lastError(){return lastError}};
  decorateOfflineApi();
  refreshCount();
  window.addEventListener('online',()=>waitForReady());
  window.addEventListener('load',()=>waitForReady());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)waitForReady()});
  try{sb.auth.onAuthStateChange(()=>setTimeout(()=>waitForReady(),0))}catch(_){ }
})();
