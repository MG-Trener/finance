// Export current journal selection to CSV or Excel. Heavy dependencies and deep history load only when requested.
(function(){
  let xlsxPromise=null;
  function ensureXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.async=true;s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('XLSX не инициализирован'));s.onerror=()=>reject(new Error('Не удалось загрузить модуль Excel'));document.head.appendChild(s)}).finally(()=>{if(!window.XLSX)xlsxPromise=null});
    return xlsxPromise;
  }
  async function ensureExportHistory(){
    if(typeof ensureAllActiveTransactionsLoaded!=='function'||!state.activeTransactionsHasMore)return true;
    try{await ensureAllActiveTransactionsLoaded();return true}catch(error){alert(`Не удалось загрузить полную историю для экспорта: ${error?.message||error}`);return false}
  }
  function safeFilePart(value){return String(value||'finance').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_').slice(0,60)||'finance'}
  function exportRows(){const tx=typeof journalFilteredTx==='function'?journalFilteredTx():[];return tx.map(x=>{const d=new Date(x.occurred_at);return{'Дата':d.toLocaleDateString('ru-RU'),'Время':d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),'Кто':personName(x.person_id),'Тип':x.type==='income'?'Доход':'Расход','Категория':catName(x.category_id),'Подкатегория':subName(x.subcategory_id)||'','Сумма, ₸':Number(x.amount)||0,'Комментарий':x.description||''}})}
  function filterDescription(){const f=state.filters||{},parts=[];if((f.period||'month')==='month')parts.push(`${MONTHS[state.month-1]} ${state.year}`);else if(f.period==='year')parts.push(`${state.year} год`);else parts.push('за всё время');if(f.person&&f.person!=='all')parts.push(personName(f.person));if(f.type&&f.type!=='all')parts.push(f.type==='income'?'только доходы':'только расходы');if(f.category&&f.category!=='all')parts.push(catName(f.category));if((f.search||'').trim())parts.push(`поиск: ${f.search.trim()}`);return parts.join(' · ')}
  function summaryRows(){const tx=typeof journalFilteredTx==='function'?journalFilteredTx():[],income=tx.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0),expense=tx.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0),rows=[['Семья',state.family?.name||''],['Фильтр',filterDescription()],['Количество операций',tx.length],['Доходы, ₸',income],['Расходы, ₸',expense],['Баланс, ₸',income-expense],[],['По участникам','',''],['Участник','Доходы, ₸','Расходы, ₸','Баланс, ₸']];state.people.forEach(p=>{const own=tx.filter(x=>x.person_id===p.id),inc=own.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0),exp=own.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);rows.push([p.display_name,inc,exp,inc-exp])});return rows}
  function fileBase(){const family=safeFilePart(state.family?.name||'семейная_казна'),period=(state.filters?.period||'month')==='month'?`${state.year}-${String(state.month).padStart(2,'0')}`:(state.filters?.period==='year'?String(state.year):'all');return `${family}_${period}`}
  function downloadBlob(content,type,filename){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function bytesToBase64(bytes){let binary='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(binary)}
  function textToBase64(text){return bytesToBase64(new TextEncoder().encode(text))}
  async function nativeShareBase64(base64,filename,title){
    if(!window.__FINANCE_NATIVE__)return false;
    const Filesystem=window.Capacitor?.Plugins?.Filesystem,Share=window.Capacitor?.Plugins?.Share;
    if(!Filesystem?.writeFile||!Filesystem?.getUri||!Share?.share)throw new Error('Модуль сохранения файлов Android недоступен');
    const path=`exports/${filename}`;
    await Filesystem.writeFile({path,data:base64,directory:'CACHE',recursive:true});
    const result=await Filesystem.getUri({path,directory:'CACHE'});
    if(!result?.uri)throw new Error('Android не вернул адрес экспортированного файла');
    await Share.share({title,text:'Экспорт из «Семейной казны»',files:[result.uri],dialogTitle:title});
    return true;
  }
  function csvEscape(value){const s=String(value??'');return /[;"\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
  async function exportCSV(){
    if(!await ensureExportHistory())return;
    const rows=exportRows();if(!rows.length)return alert('В текущей выборке нет операций для экспорта.');
    const headers=Object.keys(rows[0]),lines=[headers.map(csvEscape).join(';')];rows.forEach(row=>lines.push(headers.map(h=>csvEscape(row[h])).join(';')));
    const content='\uFEFF'+lines.join('\r\n'),filename=`${fileBase()}.csv`;
    try{if(await nativeShareBase64(textToBase64(content),filename,'Сохранить или отправить CSV'))return}catch(error){alert(`Не удалось выгрузить CSV: ${error?.message||error}`);return}
    downloadBlob(content,'text/csv;charset=utf-8;',filename);
  }
  async function exportExcel(){
    if(!await ensureExportHistory())return;
    const rows=exportRows();if(!rows.length)return alert('В текущей выборке нет операций для экспорта.');
    let XLSXLib;try{XLSXLib=await ensureXlsx()}catch(err){alert(err.message);return}
    const wb=XLSXLib.utils.book_new(),ws=XLSXLib.utils.json_to_sheet(rows);ws['!cols']=[{wch:12},{wch:8},{wch:18},{wch:12},{wch:22},{wch:24},{wch:14},{wch:36}];XLSXLib.utils.book_append_sheet(wb,ws,'Операции');const summary=XLSXLib.utils.aoa_to_sheet(summaryRows());summary['!cols']=[{wch:24},{wch:34},{wch:16},{wch:16}];XLSXLib.utils.book_append_sheet(wb,summary,'Сводка');
    const filename=`${fileBase()}.xlsx`;
    try{
      if(window.__FINANCE_NATIVE__){const base64=XLSXLib.write(wb,{bookType:'xlsx',type:'base64',compression:true});await nativeShareBase64(base64,filename,'Сохранить или отправить Excel');return}
      XLSXLib.writeFile(wb,filename,{compression:true});
    }catch(error){alert(`Не удалось выгрузить Excel: ${error?.message||error}`)}
  }
  window.FinanceExport={exportCSV,exportExcel};
})();
