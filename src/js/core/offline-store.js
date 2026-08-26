// Offline-first storage for the installed/mobile app.
// IndexedDB keeps a local family snapshot plus a durable mutation queue.
(function(){
  const DB_NAME='finance-offline-v1',DB_VERSION=1,SNAPSHOT_STORE='snapshots',QUEUE_STORE='queue';
  const SNAPSHOT_FIELDS=['family','people','categories','subcategories','transactions','trashTransactions','budgets','recurring','goals','goalContributions','activeTransactionsHasMore','trashTransactionsHasMore','selectedPersonId'];
  const ENTITY_CONFIG={
    budget:{table:'budgets',stateKey:'budgets',label:'Бюджет'},
    recurring:{table:'recurring_payments',stateKey:'recurring',label:'Регулярный платёж'},
    goal:{table:'financial_goals',stateKey:'goals',label:'Финансовая цель'},
    contribution:{table:'goal_contributions',stateKey:'goalContributions',label:'Пополнение цели'},
    category:{table:'categories',stateKey:'categories',label:'Категория'},
    subcategory:{table:'subcategories',stateKey:'subcategories',label:'Подкатегория'}
  };
  let dbPromise=null,persistTimer=null,syncing=false,pendingCount=0,conflictCount=0,lastSyncError='';

  const uid=()=>state.user?.id||'';
  const familyId=()=>state.family?.id||'';
  const snapshotKey=userId=>`user:${userId}`;
  const tempId=(prefix='tx')=>`offline:${prefix}:${crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
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
          store.createIndex('user_id','userId',{unique:false});store.createIndex('family_id','familyId',{unique:false});store.createIndex('queued_at','queuedAt',{unique:false});
        }
      };
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Не удалось открыть локальное хранилище'));
    });return dbPromise;
  }
  async function storeGet(storeName,key){const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readonly').objectStore(storeName).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
  async function storeAll(storeName){const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readonly').objectStore(storeName).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}
  async function storePut(storeName,value){const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readwrite').objectStore(storeName).put(value);req.onsuccess=()=>resolve(value);req.onerror=()=>reject(req.error)})}
  async function storeDelete(storeName,key){const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction(storeName,'readwrite').objectStore(storeName).delete(key);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}

  function networkError(error){const msg=String(error?.message||error||'').toLowerCase();return !navigator.onLine||/failed to fetch|fetch failed|network|load failed|internet|connection|timeout|timed out/.test(msg)}
  function snapshotData(){const data={};for(const key of SNAPSHOT_FIELDS)data[key]=state[key];return data}
  async function persistSnapshot(){if(!uid()||!state.family)return false;try{await storePut(SNAPSHOT_STORE,{key:snapshotKey(uid()),userId:uid(),familyId:familyId(),savedAt:nowIso(),data:snapshotData()});return true}catch(error){console.warn('Не удалось сохранить офлайн-копию',error);return false}}
  function persistSnapshotSoon(){clearTimeout(persistTimer);persistTimer=setTimeout(()=>persistSnapshot(),180)}

  async function restoreSnapshot(userId=uid()){
    if(!userId)return false;
    try{
      const saved=await storeGet(SNAPSHOT_STORE,snapshotKey(userId));if(!saved?.data)return false;
      for(const key of SNAPSHOT_FIELDS)if(Object.prototype.hasOwnProperty.call(saved.data,key))state[key]=saved.data[key];
      state.offlineSnapshotAt=saved.savedAt||null;await reapplyPendingToState();updateStatus();if(typeof renderApp==='function')renderApp();return true;
    }catch(error){console.warn('Не удалось открыть офлайн-копию',error);return false}
  }

  async function ownQueue(){try{const all=await storeAll(QUEUE_STORE),user=uid(),family=familyId();return all.filter(x=>(!user||x.userId===user)&&(!family||x.familyId===family)).sort((a,b)=>String(a.queuedAt).localeCompare(String(b.queuedAt)))}catch(_){return[]}}
  async function refreshPendingCount(){const queue=await ownQueue();pendingCount=queue.length;conflictCount=queue.filter(x=>x.conflictData).length;updateStatus();return pendingCount}
  function queueItem(kind,targetId,payload={},extra={}){return{id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,domain:'transaction',kind,targetId,transactionId:targetId,userId:uid(),familyId:familyId(),payload,queuedAt:nowIso(),lastError:'',conflictData:null,...extra}}

  function optimisticRow(payload,id,extra={}){const stamp=nowIso();return{id,family_id:familyId(),person_id:payload.person_id,type:payload.type,amount:payload.amount,category_id:payload.category_id,subcategory_id:payload.subcategory_id||null,description:payload.description||null,occurred_at:payload.occurred_at||stamp,created_at:stamp,updated_at:stamp,created_by:uid(),updated_by:uid(),deleted_at:null,deleted_by:null,_offline:true,...extra}}
  async function enqueueCreate(payload){const id=tempId('tx'),row=optimisticRow(payload,id,{_pending_action:'create'}),item=queueItem('create',id,payload,{optimisticRow:row});await storePut(QUEUE_STORE,item);syncTransactionState(row);await refreshPendingCount();persistSnapshotSoon();return row}
  async function enqueueUpdate(id,payload){
    if(isTempId(id)){const queue=await ownQueue(),create=queue.find(x=>(x.domain||'transaction')==='transaction'&&x.kind==='create'&&(x.targetId||x.transactionId)===id);if(create){create.payload={...create.payload,...payload};create.optimisticRow={...(create.optimisticRow||{}),...payload,updated_at:nowIso(),_offline:true,_pending_action:'create'};await storePut(QUEUE_STORE,create);syncTransactionState(create.optimisticRow);await refreshPendingCount();persistSnapshotSoon();return create.optimisticRow}}
    const current=byId(state.transactions,id)||byId(state.trashTransactions,id),queue=await ownQueue(),existing=[...queue].reverse().find(x=>(x.domain||'transaction')==='transaction'&&x.kind==='update'&&(x.targetId||x.transactionId)===id);
    const item=existing?{...existing,payload:{...existing.payload,...payload},lastError:'',conflictData:null}:queueItem('update',id,payload,{baseUpdatedAt:current?.updated_at||null});await storePut(QUEUE_STORE,item);
    const row={...current,...payload,updated_at:nowIso(),updated_by:uid(),_offline:true,_pending_action:'update'};syncTransactionState(row);await refreshPendingCount();persistSnapshotSoon();return row;
  }
  async function enqueueDeletedState(id,deleted){
    if(isTempId(id)&&deleted){const queue=await ownQueue();for(const item of queue.filter(x=>(x.targetId||x.transactionId)===id))await storeDelete(QUEUE_STORE,item.id);state.transactions=state.transactions.filter(x=>x.id!==id);state.trashTransactions=state.trashTransactions.filter(x=>x.id!==id);await refreshPendingCount();persistSnapshotSoon();return{removed:true,data:null}}
    const current=byId(state.transactions,id)||byId(state.trashTransactions,id),value=deleted?nowIso():null,item=queueItem(deleted?'delete':'restore',id,{deleted_at:value},{baseUpdatedAt:current?.updated_at||null});await storePut(QUEUE_STORE,item);
    const row={...current,deleted_at:value,deleted_by:deleted?uid():null,updated_at:nowIso(),updated_by:uid(),_offline:true,_pending_action:deleted?'delete':'restore'};syncTransactionState(row);await refreshPendingCount();persistSnapshotSoon();return{removed:false,data:row};
  }

  async function saveTransaction({editId=null,payload,createArgs}){
    if(editId&&isTempId(editId))return{data:await enqueueUpdate(editId,payload),error:null,queued:true};
    if(!navigator.onLine)return{data:editId?await enqueueUpdate(editId,payload):await enqueueCreate(payload),error:null,queued:true};
    try{const result=editId?await sb.from('transactions').update(payload).eq('id',editId).select().single():await sb.rpc('create_family_transaction',createArgs);if(result.error){if(networkError(result.error))return{data:editId?await enqueueUpdate(editId,payload):await enqueueCreate(payload),error:null,queued:true};return result}const row=Array.isArray(result.data)?result.data[0]:result.data;if(row)syncTransactionState(row);persistSnapshotSoon();return{data:row,error:null,queued:false}}catch(error){if(networkError(error))return{data:editId?await enqueueUpdate(editId,payload):await enqueueCreate(payload),error:null,queued:true};return{data:null,error}}
  }
  async function updateTransaction(id,payload){if(isTempId(id)||!navigator.onLine)return{data:await enqueueUpdate(id,payload),error:null,queued:true};try{const result=await sb.from('transactions').update(payload).eq('id',id).select().single();if(result.error&&networkError(result.error))return{data:await enqueueUpdate(id,payload),error:null,queued:true};if(result.data)syncTransactionState(result.data);persistSnapshotSoon();return{...result,queued:false}}catch(error){if(networkError(error))return{data:await enqueueUpdate(id,payload),error:null,queued:true};return{data:null,error}}}
  async function setDeleted(id,deleted){if(isTempId(id)||!navigator.onLine){const local=await enqueueDeletedState(id,deleted);return{...local,error:null,queued:!local.removed}}const value=deleted?nowIso():null;try{const result=await sb.from('transactions').update({deleted_at:value}).eq('id',id).select().single();if(result.error&&networkError(result.error)){const local=await enqueueDeletedState(id,deleted);return{...local,error:null,queued:true}}if(result.data)syncTransactionState(result.data);persistSnapshotSoon();return{...result,queued:false}}catch(error){if(networkError(error)){const local=await enqueueDeletedState(id,deleted);return{...local,error:null,queued:true}}return{data:null,error}}}

  function entityArray(entity){const cfg=ENTITY_CONFIG[entity];return cfg?state[cfg.stateKey]:null}
  function entityOptimistic(entity,payload,id,action='create'){
    const stamp=nowIso(),base={id,...payload,_offline:true,_pending_action:action};
    if(entity==='goal')return{created_at:stamp,archived:false,...base};
    if(entity==='contribution')return{contributed_at:stamp,...base};
    if(entity==='category')return{is_system:false,sort_order:999,...base};
    if(entity==='subcategory')return{sort_order:999,...base};
    return{created_at:stamp,updated_at:stamp,...base};
  }
  function applyEntityRow(entity,row){const list=entityArray(entity);if(!list||!row)return;upsertById(list,row);if(entity==='contribution')list.sort((a,b)=>new Date(b.contributed_at)-new Date(a.contributed_at));if(entity==='goal')list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));persistSnapshotSoon()}
  async function enqueueEntityCreate(entity,payload){const id=tempId(entity),row=entityOptimistic(entity,payload,id),item=queueItem('create',id,payload,{domain:'entity',entity,optimisticRow:row});await storePut(QUEUE_STORE,item);applyEntityRow(entity,row);await refreshPendingCount();return row}
  async function enqueueEntityUpdate(entity,id,payload){
    const list=entityArray(entity),current=byId(list||[],id);
    if(isTempId(id)){const queue=await ownQueue(),create=queue.find(x=>x.domain==='entity'&&x.entity===entity&&x.kind==='create'&&x.targetId===id);if(create){create.payload={...create.payload,...payload};create.optimisticRow={...(create.optimisticRow||current||{}),...payload,_offline:true,_pending_action:'create'};await storePut(QUEUE_STORE,create);applyEntityRow(entity,create.optimisticRow);await refreshPendingCount();return create.optimisticRow}}
    const item=queueItem('update',id,payload,{domain:'entity',entity});await storePut(QUEUE_STORE,item);const row={...current,...payload,_offline:true,_pending_action:'update'};applyEntityRow(entity,row);await refreshPendingCount();return row;
  }
  async function enqueueEntityDelete(entity,id){
    const list=entityArray(entity)||[];
    if(isTempId(id)){const queue=await ownQueue();for(const item of queue.filter(x=>x.domain==='entity'&&x.entity===entity&&x.targetId===id))await storeDelete(QUEUE_STORE,item.id);state[ENTITY_CONFIG[entity].stateKey]=list.filter(x=>x.id!==id);if(entity==='goal'){for(const item of queue.filter(x=>x.domain==='entity'&&x.entity==='contribution'&&x.payload?.goal_id===id))await storeDelete(QUEUE_STORE,item.id);state.goalContributions=state.goalContributions.filter(x=>x.goal_id!==id)}await refreshPendingCount();persistSnapshotSoon();return true}
    await storePut(QUEUE_STORE,queueItem('delete',id,{}, {domain:'entity',entity}));state[ENTITY_CONFIG[entity].stateKey]=list.filter(x=>x.id!==id);await refreshPendingCount();persistSnapshotSoon();return true;
  }
  async function saveEntity(entity,{id=null,payload}){
    const cfg=ENTITY_CONFIG[entity];if(!cfg)return{data:null,error:new Error('Неизвестный тип локальной записи')};
    if(id&&isTempId(id))return{data:await enqueueEntityUpdate(entity,id,payload),error:null,queued:true};
    if(!navigator.onLine)return{data:id?await enqueueEntityUpdate(entity,id,payload):await enqueueEntityCreate(entity,payload),error:null,queued:true};
    try{const query=id?sb.from(cfg.table).update(payload).eq('id',id):sb.from(cfg.table).insert(payload);const result=await query.select().single();if(result.error&&networkError(result.error))return{data:id?await enqueueEntityUpdate(entity,id,payload):await enqueueEntityCreate(entity,payload),error:null,queued:true};if(result.data)applyEntityRow(entity,result.data);return{...result,queued:false}}catch(error){if(networkError(error))return{data:id?await enqueueEntityUpdate(entity,id,payload):await enqueueEntityCreate(entity,payload),error:null,queued:true};return{data:null,error}}
  }
  async function deleteEntity(entity,id){
    const cfg=ENTITY_CONFIG[entity];if(!cfg)return{error:new Error('Неизвестный тип локальной записи')};if(isTempId(id)||!navigator.onLine){await enqueueEntityDelete(entity,id);return{error:null,queued:true}};
    try{const result=await sb.from(cfg.table).delete().eq('id',id);if(result.error&&networkError(result.error)){await enqueueEntityDelete(entity,id);return{error:null,queued:true}}if(!result.error){state[cfg.stateKey]=state[cfg.stateKey].filter(x=>x.id!==id);persistSnapshotSoon()}return{...result,queued:false}}catch(error){if(networkError(error)){await enqueueEntityDelete(entity,id);return{error:null,queued:true}}return{error}}
  }

  function deepReplace(value,from,to){if(value===from)return to;if(Array.isArray(value))return value.map(x=>deepReplace(x,from,to));if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value))out[k]=deepReplace(v,from,to);return out}return value}
  async function remapTempId(from,to){
    for(const key of ['categories','subcategories','transactions','trashTransactions','budgets','recurring','goals','goalContributions'])state[key]=deepReplace(state[key],from,to);
    const all=await ownQueue();for(const item of all){const next=deepReplace(item,from,to);if(JSON.stringify(next)!==JSON.stringify(item))await storePut(QUEUE_STORE,next)}persistSnapshotSoon();
  }

  async function reapplyPendingToState(){
    const queue=await ownQueue();
    for(const item of queue){
      if(item.domain==='entity'){
        const list=entityArray(item.entity);if(!list)continue;
        if(item.kind==='create'){applyEntityRow(item.entity,item.optimisticRow||entityOptimistic(item.entity,item.payload,item.targetId));continue}
        if(item.kind==='update'){const current=byId(list,item.targetId);if(current)applyEntityRow(item.entity,{...current,...item.payload,_offline:true,_pending_action:'update'});continue}
        if(item.kind==='delete')state[ENTITY_CONFIG[item.entity].stateKey]=list.filter(x=>x.id!==item.targetId);
        continue;
      }
      const targetId=item.targetId||item.transactionId;
      if(item.kind==='create'){const row=item.optimisticRow||optimisticRow(item.payload,targetId,{_pending_action:'create'});syncTransactionState(row);continue}
      const current=byId(state.transactions,targetId)||byId(state.trashTransactions,targetId);if(!current)continue;
      if(item.kind==='update')syncTransactionState({...current,...item.payload,_offline:true,_pending_action:'update'});
      if(item.kind==='delete')syncTransactionState({...current,deleted_at:item.payload.deleted_at||item.queuedAt,_offline:true,_pending_action:'delete'});
      if(item.kind==='restore')syncTransactionState({...current,deleted_at:null,_offline:true,_pending_action:'restore'});
    }
    await refreshPendingCount();return queue.length;
  }

  async function transactionConflict(item){
    if(item.force||!item.baseUpdatedAt||item.kind==='create')return null;
    const targetId=item.targetId||item.transactionId;if(isTempId(targetId))return null;
    const {data,error}=await sb.from('transactions').select('*').eq('id',targetId).single();if(error)return{error};
    const serverTime=new Date(data.updated_at||data.created_at||0).getTime(),baseTime=new Date(item.baseUpdatedAt||0).getTime();
    if(serverTime>baseTime+500)return{serverData:data};return null;
  }
  async function processTransactionItem(item){
    const targetId=item.targetId||item.transactionId;let result;
    if(item.kind==='create'){
      const p=item.payload;result=await sb.rpc('create_family_transaction',{p_family_id:item.familyId,p_person_id:p.person_id,p_type:p.type,p_amount:p.amount,p_category_id:p.category_id,p_subcategory_id:p.subcategory_id||null,p_description:p.description||null,p_occurred_at:p.occurred_at});
      if(!result.error){const row=Array.isArray(result.data)?result.data[0]:result.data;state.transactions=state.transactions.filter(x=>x.id!==targetId);state.trashTransactions=state.trashTransactions.filter(x=>x.id!==targetId);if(row)syncTransactionState(row)}return result;
    }
    const conflict=await transactionConflict(item);if(conflict?.error)return{error:conflict.error};if(conflict?.serverData)return{error:null,conflict:true,serverData:conflict.serverData};
    const payload=item.kind==='update'?item.payload:{deleted_at:item.kind==='delete'?(item.payload.deleted_at||item.queuedAt):null};result=await sb.from('transactions').update(payload).eq('id',targetId).select().single();if(!result.error&&result.data)syncTransactionState(result.data);return result;
  }
  async function processEntityItem(item){
    const cfg=ENTITY_CONFIG[item.entity];if(!cfg)return{error:new Error('Неизвестный тип очереди')};let result;
    if(item.kind==='create')result=await sb.from(cfg.table).insert(item.payload).select().single();
    else if(item.kind==='update')result=await sb.from(cfg.table).update(item.payload).eq('id',item.targetId).select().single();
    else{result=await sb.from(cfg.table).delete().eq('id',item.targetId);if(!result.error)return result}
    if(!result.error&&result.data){if(item.kind==='create'&&isTempId(item.targetId))await remapTempId(item.targetId,result.data.id);applyEntityRow(item.entity,result.data)}return result;
  }
  async function processItem(item){return item.domain==='entity'?processEntityItem(item):processTransactionItem(item)}

  async function flushQueue(){
    if(syncing||!navigator.onLine||!uid()||!state.family)return 0;syncing=true;lastSyncError='';let synced=0;
    try{
      const queue=await ownQueue();
      for(const item of queue){
        try{
          const result=await processItem(item);
          if(result?.conflict){item.conflictData={serverData:result.serverData,detectedAt:nowIso()};item.lastError='Конфликт: запись изменилась на другом устройстве';await storePut(QUEUE_STORE,item);lastSyncError=item.lastError;break}
          if(result?.error){if(networkError(result.error)){lastSyncError=result.error.message||'Нет сети';break}item.lastError=result.error.message||String(result.error);await storePut(QUEUE_STORE,item);lastSyncError=item.lastError;break}
          await storeDelete(QUEUE_STORE,item.id);synced++;
        }catch(error){if(networkError(error)){lastSyncError=error?.message||'Нет сети';break}item.lastError=error?.message||String(error);await storePut(QUEUE_STORE,item);lastSyncError=item.lastError;break}
      }
      await refreshPendingCount();await persistSnapshot();return synced;
    }finally{syncing=false;updateStatus()}
  }

  function queueLabel(item){if(item.domain==='entity')return ENTITY_CONFIG[item.entity]?.label||'Запись';if(item.kind==='create')return'Новая операция';if(item.kind==='delete')return'Удаление операции';if(item.kind==='restore')return'Восстановление операции';return'Изменение операции'}
  async function openSyncCenter(){
    const queue=await ownQueue();closeModal();document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal sync-center-modal"><div class="modal-head"><div><h2>Синхронизация</h2><p class="quick-amount-context">${navigator.onLine?'Интернет доступен':'Сейчас нет подключения'}</p></div><button class="icon-btn" id="closeModal">×</button></div><div class="sync-center-actions"><button class="btn btn-primary" id="syncNow" ${!navigator.onLine||syncing?'disabled':''}>Синхронизировать сейчас</button></div><div class="sync-center-list">${queue.length?queue.map(item=>`<div class="sync-item ${item.conflictData?'has-conflict':''}"><div><b>${esc(queueLabel(item))}</b><small>${new Date(item.queuedAt).toLocaleString('ru-RU')}</small>${item.lastError?`<p>${esc(item.lastError)}</p>`:''}</div>${item.conflictData?`<div class="sync-conflict-actions"><button class="btn btn-soft btn-small syncServerWins" data-id="${item.id}">Оставить серверную</button><button class="btn btn-primary btn-small syncLocalWins" data-id="${item.id}">Отправить мою</button></div>`:''}</div>`).join(''):'<div class="empty">Очередь пуста. Все изменения синхронизированы.</div>'}</div></div></div>`);
    document.getElementById('closeModal').onclick=closeModal;document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal()};const sync=document.getElementById('syncNow');if(sync)sync.onclick=async()=>{sync.disabled=true;await flushQueue();openSyncCenter()};
    document.querySelectorAll('.syncServerWins').forEach(b=>b.onclick=()=>resolveConflict(b.dataset.id,'server'));document.querySelectorAll('.syncLocalWins').forEach(b=>b.onclick=()=>resolveConflict(b.dataset.id,'local'));
  }
  async function resolveConflict(itemId,strategy){
    const item=(await ownQueue()).find(x=>x.id===itemId);if(!item?.conflictData)return;
    if(strategy==='server'){const server=item.conflictData.serverData;if(server)syncTransactionState(server);await storeDelete(QUEUE_STORE,item.id);await refreshPendingCount();await persistSnapshot();openSyncCenter();renderStateChange();return}
    item.force=true;item.conflictData=null;item.lastError='';await storePut(QUEUE_STORE,item);await refreshPendingCount();await flushQueue();openSyncCenter();renderStateChange();
  }

  function statusMarkup(){return `<button type="button" id="connectionStatus" class="connection-status" ${navigator.onLine&&pendingCount===0?'hidden':''} title="Открыть состояние синхронизации"></button>`}
  function updateStatus(){const el=document.getElementById('connectionStatus');if(!el)return;const offline=!navigator.onLine;el.hidden=!offline&&pendingCount===0;el.className=`connection-status ${conflictCount?'is-conflict':offline?'is-offline':pendingCount?'is-pending':'is-online'}`;el.textContent=conflictCount?`Конфликт · ${conflictCount}`:offline?`Офлайн${pendingCount?` · ${pendingCount} в очереди`:''}`:pendingCount?`Синхронизация · ${pendingCount}`:'Онлайн';el.title=lastSyncError||'Открыть состояние синхронизации';el.onclick=openSyncCenter}

  window.FinanceOffline={persistSnapshot,persistSnapshotSoon,restoreSnapshot,reapplyPendingToState,saveTransaction,updateTransaction,setDeleted,saveEntity,deleteEntity,flushQueue,refreshPendingCount,statusMarkup,updateStatus,openSyncCenter,isTempId,get pendingCount(){return pendingCount},get conflictCount(){return conflictCount},get syncing(){return syncing}};
  window.addEventListener('online',()=>{updateStatus();flushQueue()});window.addEventListener('offline',updateStatus);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine)flushQueue()});window.addEventListener('load',()=>{refreshPendingCount();if(navigator.onLine)flushQueue()});
})();
