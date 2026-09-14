// Rich Excel export for the Analytics page.
(function(){
  const PERIODS={
    month:{label:'1 месяц',months:1},
    quarter:{label:'3 месяца',months:3},
    half:{label:'Полгода',months:6},
    year:{label:'Год · последние 12 месяцев',months:12},
    current_year:{label:'Текущий год',currentYear:true}
  };
  let xlsxPromise=null;

  function ensureXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='vendor/xlsx.full.min.js?v=analytics-export1';
      script.async=true;
      script.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('XLSX не инициализирован'));
      script.onerror=()=>reject(new Error('Не удалось загрузить модуль Excel'));
      document.head.appendChild(script);
    }).finally(()=>{if(!window.XLSX)xlsxPromise=null});
    return xlsxPromise;
  }

  async function ensureFullHistory(){
    if(typeof ensureAllActiveTransactionsLoaded!=='function'||!state.activeTransactionsHasMore)return true;
    try{await ensureAllActiveTransactionsLoaded();return true}
    catch(error){alert(`Не удалось загрузить полную историю для отчёта: ${error?.message||error}`);return false}
  }

  function escHtml(value){
    return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function safeFilePart(value){
    return String(value||'finance').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_').slice(0,60)||'finance';
  }

  function formatDate(date){return date.toLocaleDateString('ru-RU')}
  function formatDateTime(date){return `${formatDate(date)} ${date.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`}
  function monthLabel(date){return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`}

  function scopePerson(scope){return scope==='combined'?null:state.people.find(person=>person.label===scope)||null}
  function scopeTitle(scope){
    if(scope==='combined')return 'Сводный отчёт';
    const person=scopePerson(scope);
    if(scope==='husband')return person?.display_name?`Муж · ${person.display_name}`:'Муж';
    return person?.display_name?`Жена · ${person.display_name}`:'Жена';
  }

  function periodRange(periodKey){
    const now=new Date();
    const end=new Date(now);
    const period=PERIODS[periodKey]||PERIODS.current_year;
    const start=period.currentYear
      ?new Date(now.getFullYear(),0,1,0,0,0,0)
      :new Date(now.getFullYear(),now.getMonth()-(period.months-1),1,0,0,0,0);
    return{start,end,label:period.label,key:periodKey};
  }

  function periodDescription(range){return `${range.label} · ${formatDate(range.start)} — ${formatDate(range.end)}`}

  function reportTransactions(scope,range){
    const person=scopePerson(scope);
    return state.transactions.filter(tx=>{
      if(tx.type!=='income'&&tx.type!=='expense')return false;
      const date=new Date(tx.occurred_at);
      if(Number.isNaN(date.getTime())||date<range.start||date>range.end)return false;
      return scope==='combined'||(person&&tx.person_id===person.id);
    }).sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at));
  }

  function savingsRate(income,expense){
    if(income>0)return (income-expense)/income;
    return expense>0?-1:0;
  }

  function summarize(tx){
    const income=tx.filter(item=>item.type==='income').reduce((sum,item)=>sum+Number(item.amount||0),0);
    const expense=tx.filter(item=>item.type==='expense').reduce((sum,item)=>sum+Number(item.amount||0),0);
    return{income,expense,balance:income-expense,savingsRate:savingsRate(income,expense),count:tx.length};
  }

  function monthEntries(range,tx){
    const result=[];
    let cursor=new Date(range.start.getFullYear(),range.start.getMonth(),1);
    const last=new Date(range.end.getFullYear(),range.end.getMonth(),1);
    while(cursor<=last){
      const year=cursor.getFullYear(),month=cursor.getMonth();
      const items=tx.filter(item=>{const date=new Date(item.occurred_at);return date.getFullYear()===year&&date.getMonth()===month});
      result.push({date:new Date(cursor),...summarize(items)});
      cursor=new Date(year,month+1,1);
    }
    return result;
  }

  function categoryName(id){return id?catName(id):'Без категории'}
  function subcategoryName(id){return id?(subName(id)||''):''}

  function categoryBuckets(tx,type){
    const sums={};
    tx.filter(item=>item.type===type).forEach(item=>{
      const key=item.category_id||'__none__';
      sums[key]=(sums[key]||0)+Number(item.amount||0);
    });
    const total=Object.values(sums).reduce((sum,value)=>sum+value,0);
    return Object.entries(sums).sort((a,b)=>b[1]-a[1]).map(([id,value])=>({id,name:id==='__none__'?'Без категории':categoryName(id),value,share:total?value/total:0}));
  }

  function monthlyCategoryRows(months,tx){
    const rows=[];
    months.forEach(month=>{
      const year=month.date.getFullYear(),monthIndex=month.date.getMonth();
      const items=tx.filter(item=>{const date=new Date(item.occurred_at);return date.getFullYear()===year&&date.getMonth()===monthIndex});
      ['income','expense'].forEach(type=>{
        categoryBuckets(items,type).forEach(bucket=>rows.push({month:monthLabel(month.date),type:type==='income'?'Доход':'Расход',category:bucket.name,value:bucket.value,share:bucket.share}));
      });
    });
    return rows;
  }

  function nativeShareAvailable(){return Boolean(window.__FINANCE_NATIVE__&&window.Capacitor?.Plugins?.Filesystem?.writeFile&&window.Capacitor?.Plugins?.Share?.share)}
  async function nativeShareWorkbook(XLSXLib,workbook,filename){
    const Filesystem=window.Capacitor.Plugins.Filesystem,Share=window.Capacitor.Plugins.Share;
    const base64=XLSXLib.write(workbook,{bookType:'xlsx',type:'base64',compression:true,cellStyles:true});
    const path=`exports/${filename}`;
    await Filesystem.writeFile({path,data:base64,directory:'CACHE',recursive:true});
    const result=await Filesystem.getUri({path,directory:'CACHE'});
    if(!result?.uri)throw new Error('Android не вернул адрес экспортированного файла');
    await Share.share({title:'Аналитика · Семейная казна',text:'Excel-отчёт из «Семейной казны»',files:[result.uri],dialogTitle:'Сохранить или отправить Excel'});
  }

  function setStyle(ws,address,style){if(ws[address])ws[address].s=style}
  function setNumberFormat(ws,address,format){if(ws[address])ws[address].z=format}
  function merge(ws,sr,sc,er,ec){ws['!merges']??=[];ws['!merges'].push({s:{r:sr,c:sc},e:{r:er,c:ec}})}

  const styles={
    title:{font:{name:'Aptos Display',sz:18,bold:true,color:{rgb:'FFF1D3'}},fill:{fgColor:{rgb:'10202B'}},alignment:{horizontal:'center',vertical:'center'}},
    subtitle:{font:{name:'Aptos',sz:11,bold:true,color:{rgb:'D9C6A5'}},fill:{fgColor:{rgb:'10202B'}},alignment:{horizontal:'center',vertical:'center'}},
    section:{font:{name:'Aptos Display',sz:12,bold:true,color:{rgb:'FFF1D3'}},fill:{fgColor:{rgb:'243544'}},alignment:{horizontal:'left',vertical:'center'}},
    label:{font:{name:'Aptos',sz:9,bold:true,color:{rgb:'7A6547'}},fill:{fgColor:{rgb:'F2E5CD'}},alignment:{horizontal:'center',vertical:'center',wrapText:true}},
    value:{font:{name:'Aptos Display',sz:14,bold:true,color:{rgb:'2A1C10'}},fill:{fgColor:{rgb:'FFF8E8'}},alignment:{horizontal:'center',vertical:'center'}},
    monthPositive:{font:{name:'Aptos Display',sz:11,bold:true,color:{rgb:'1D6B45'}},fill:{fgColor:{rgb:'E6F4EB'}},alignment:{horizontal:'center'}},
    monthNegative:{font:{name:'Aptos Display',sz:11,bold:true,color:{rgb:'A13E3B'}},fill:{fgColor:{rgb:'F9E8E6'}},alignment:{horizontal:'center'}},
    monthNeutral:{font:{name:'Aptos Display',sz:11,bold:true,color:{rgb:'72501F'}},fill:{fgColor:{rgb:'F5ECD9'}},alignment:{horizontal:'center'}},
    tableHead:{font:{name:'Aptos',sz:10,bold:true,color:{rgb:'FFF4DC'}},fill:{fgColor:{rgb:'73501F'}},alignment:{horizontal:'center',vertical:'center',wrapText:true}},
    text:{font:{name:'Aptos',sz:10,color:{rgb:'2A1C10'}},alignment:{vertical:'center'}},
    money:{font:{name:'Aptos',sz:10,bold:true,color:{rgb:'2A1C10'}},alignment:{horizontal:'right',vertical:'center'}},
    percent:{font:{name:'Aptos',sz:10,color:{rgb:'2A1C10'}},alignment:{horizontal:'right',vertical:'center'}}
  };

  function styleSheetRange(XLSXLib,ws,range,style){
    for(let r=range.s.r;r<=range.e.r;r++)for(let c=range.s.c;c<=range.e.c;c++)setStyle(ws,XLSXLib.utils.encode_cell({r,c}),style);
  }

  function addOverviewSheet(XLSXLib,wb,scope,range,tx){
    const summary=summarize(tx),months=monthEntries(range,tx);
    const rows=Array.from({length:35},()=>Array(8).fill(''));
    rows[0][0]='СЕМЕЙНАЯ КАЗНА · АНАЛИТИКА';
    rows[1][0]=`${scopeTitle(scope)} · ${periodDescription(range)}`;
    rows[3][0]='Доходы';rows[3][2]='Расходы';rows[3][4]='Сбережения';rows[3][6]='% сбережений';
    rows[4][0]=summary.income;rows[4][2]=summary.expense;rows[4][4]=summary.balance;rows[4][6]=summary.savingsRate;
    rows[6][0]='Помесячный календарь';
    const starts=[0,3,6];
    months.forEach((month,index)=>{
      const blockRow=8+Math.floor(index/3)*6,col=starts[index%3];
      const indicator=month.count?(month.balance>0?'▲':month.balance<0?'▼':'●'):'○';
      rows[blockRow][col]=`${indicator} ${monthLabel(month.date)}`;
      rows[blockRow+1][col]='Доход';rows[blockRow+1][col+1]=month.income;
      rows[blockRow+2][col]='Расход';rows[blockRow+2][col+1]=month.expense;
      rows[blockRow+3][col]='Баланс';rows[blockRow+3][col+1]=month.balance;
      rows[blockRow+4][col]='Сбережения';rows[blockRow+4][col+1]=month.savingsRate;
      rows[blockRow+5][col]='Операций';rows[blockRow+5][col+1]=month.count;
    });
    const ws=XLSXLib.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:15},{wch:17},{wch:3},{wch:15},{wch:17},{wch:3},{wch:15},{wch:17}];
    ws['!rows']=[{hpt:28},{hpt:20},,{hpt:18},{hpt:25},,{hpt:22}];
    merge(ws,0,0,0,7);merge(ws,1,0,1,7);merge(ws,6,0,6,7);
    [[3,0,3,1],[3,2,3,3],[3,4,3,5],[3,6,3,7],[4,0,4,1],[4,2,4,3],[4,4,4,5],[4,6,4,7]].forEach(([sr,sc,er,ec])=>merge(ws,sr,sc,er,ec));
    months.forEach((month,index)=>{const blockRow=8+Math.floor(index/3)*6,col=starts[index%3];merge(ws,blockRow,col,blockRow,col+1)});
    styleSheetRange(XLSXLib,ws,{s:{r:0,c:0},e:{r:0,c:7}},styles.title);
    styleSheetRange(XLSXLib,ws,{s:{r:1,c:0},e:{r:1,c:7}},styles.subtitle);
    styleSheetRange(XLSXLib,ws,{s:{r:6,c:0},e:{r:6,c:7}},styles.section);
    [0,2,4,6].forEach(col=>{styleSheetRange(XLSXLib,ws,{s:{r:3,c:col},e:{r:3,c:col+1}},styles.label);styleSheetRange(XLSXLib,ws,{s:{r:4,c:col},e:{r:4,c:col+1}},styles.value)});
    setNumberFormat(ws,'A5','#,##0" ₸"');setNumberFormat(ws,'C5','#,##0" ₸"');setNumberFormat(ws,'E5','#,##0" ₸"');setNumberFormat(ws,'G5','0%');
    months.forEach((month,index)=>{
      const blockRow=8+Math.floor(index/3)*6,col=starts[index%3],header=XLSXLib.utils.encode_cell({r:blockRow,c:col});
      styleSheetRange(XLSXLib,ws,{s:{r:blockRow,c:col},e:{r:blockRow,c:col+1}},month.balance>0?styles.monthPositive:month.balance<0?styles.monthNegative:styles.monthNeutral);
      for(let row=blockRow+1;row<=blockRow+5;row++){
        setStyle(ws,XLSXLib.utils.encode_cell({r:row,c:col}),styles.text);
        setStyle(ws,XLSXLib.utils.encode_cell({r:row,c:col+1}),row===blockRow+4?styles.percent:styles.money);
      }
      for(let row=blockRow+1;row<=blockRow+3;row++)setNumberFormat(ws,XLSXLib.utils.encode_cell({r:row,c:col+1}),'#,##0" ₸"');
      setNumberFormat(ws,XLSXLib.utils.encode_cell({r:blockRow+4,c:col+1}),'0%');
      if(ws[header])ws[header].v=ws[header].v;
    });
    XLSXLib.utils.book_append_sheet(wb,ws,'Обзор');
  }

  function addCategoriesSheet(XLSXLib,wb,scope,range,tx){
    const income=categoryBuckets(tx,'income'),expense=categoryBuckets(tx,'expense'),months=monthEntries(range,tx),details=monthlyCategoryRows(months,tx);
    const max=Math.max(income.length,expense.length,1),detailStart=max+7;
    const rows=Array.from({length:detailStart+details.length+4},()=>Array(7).fill(''));
    rows[0][0]='КАТЕГОРИИ · ПОДРОБНЫЙ ОТЧЁТ';rows[1][0]=`${scopeTitle(scope)} · ${periodDescription(range)}`;
    rows[3][0]='Доходы по категориям';rows[3][4]='Расходы по категориям';
    rows[4].splice(0,3,'Категория','Сумма','Доля');rows[4].splice(4,3,'Категория','Сумма','Доля');
    income.forEach((item,index)=>{rows[5+index][0]=item.name;rows[5+index][1]=item.value;rows[5+index][2]=item.share});
    expense.forEach((item,index)=>{rows[5+index][4]=item.name;rows[5+index][5]=item.value;rows[5+index][6]=item.share});
    rows[detailStart][0]='Детализация по месяцам';
    rows[detailStart+1].splice(0,5,'Месяц','Тип','Категория','Сумма','Доля месяца');
    details.forEach((item,index)=>{const row=rows[detailStart+2+index];row[0]=item.month;row[1]=item.type;row[2]=item.category;row[3]=item.value;row[4]=item.share});
    const ws=XLSXLib.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:25},{wch:15},{wch:12},{wch:3},{wch:25},{wch:15},{wch:12}];
    merge(ws,0,0,0,6);merge(ws,1,0,1,6);merge(ws,3,0,3,2);merge(ws,3,4,3,6);merge(ws,detailStart,0,detailStart,6);
    styleSheetRange(XLSXLib,ws,{s:{r:0,c:0},e:{r:0,c:6}},styles.title);
    styleSheetRange(XLSXLib,ws,{s:{r:1,c:0},e:{r:1,c:6}},styles.subtitle);
    styleSheetRange(XLSXLib,ws,{s:{r:3,c:0},e:{r:3,c:2}},styles.section);styleSheetRange(XLSXLib,ws,{s:{r:3,c:4},e:{r:3,c:6}},styles.section);
    styleSheetRange(XLSXLib,ws,{s:{r:4,c:0},e:{r:4,c:2}},styles.tableHead);styleSheetRange(XLSXLib,ws,{s:{r:4,c:4},e:{r:4,c:6}},styles.tableHead);
    styleSheetRange(XLSXLib,ws,{s:{r:detailStart,c:0},e:{r:detailStart,c:6}},styles.section);styleSheetRange(XLSXLib,ws,{s:{r:detailStart+1,c:0},e:{r:detailStart+1,c:4}},styles.tableHead);
    income.forEach((_,index)=>{setNumberFormat(ws,`B${6+index}`,'#,##0" ₸"');setNumberFormat(ws,`C${6+index}`,'0%')});
    expense.forEach((_,index)=>{setNumberFormat(ws,`F${6+index}`,'#,##0" ₸"');setNumberFormat(ws,`G${6+index}`,'0%')});
    details.forEach((_,index)=>{setNumberFormat(ws,`D${detailStart+3+index}`,'#,##0" ₸"');setNumberFormat(ws,`E${detailStart+3+index}`,'0%')});
    XLSXLib.utils.book_append_sheet(wb,ws,'Категории');
  }

  function addOperationsSheet(XLSXLib,wb,tx){
    const rows=tx.map(item=>{const date=new Date(item.occurred_at);return{
      'Дата':date.toLocaleDateString('ru-RU'),
      'Время':date.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),
      'Участник':personName(item.person_id),
      'Тип':item.type==='income'?'Доход':'Расход',
      'Категория':categoryName(item.category_id),
      'Подкатегория':subcategoryName(item.subcategory_id),
      'Сумма, ₸':Number(item.amount||0),
      'Комментарий':item.description||''
    }});
    const ws=XLSXLib.utils.json_to_sheet(rows.length?rows:[{'Дата':'','Время':'','Участник':'','Тип':'','Категория':'','Подкатегория':'','Сумма, ₸':'','Комментарий':'Нет операций за выбранный период'}]);
    ws['!cols']=[{wch:12},{wch:8},{wch:18},{wch:11},{wch:24},{wch:22},{wch:15},{wch:38}];
    if(rows.length)ws['!autofilter']={ref:`A1:H${rows.length+1}`};
    styleSheetRange(XLSXLib,ws,{s:{r:0,c:0},e:{r:0,c:7}},styles.tableHead);
    for(let row=1;row<=rows.length;row++)setNumberFormat(ws,`G${row+1}`,'#,##0" ₸"');
    XLSXLib.utils.book_append_sheet(wb,ws,'Операции');
  }

  function buildWorkbook(XLSXLib,scope,range,tx){
    const wb=XLSXLib.utils.book_new();
    wb.Props={Title:'Аналитика · Семейная казна',Subject:`${scopeTitle(scope)} · ${periodDescription(range)}`,Author:'Семейная казна',CreatedDate:new Date()};
    addOverviewSheet(XLSXLib,wb,scope,range,tx);
    addCategoriesSheet(XLSXLib,wb,scope,range,tx);
    addOperationsSheet(XLSXLib,wb,tx);
    return wb;
  }

  async function exportAnalytics(scope,periodKey,button){
    if(button){button.disabled=true;button.textContent='Формируем…'}
    try{
      if(!await ensureFullHistory())return;
      const range=periodRange(periodKey),tx=reportTransactions(scope,range),XLSXLib=await ensureXlsx();
      const workbook=buildWorkbook(XLSXLib,scope,range,tx);
      const filename=`${safeFilePart(state.family?.name||'Семейная_казна')}_аналитика_${scope}_${periodKey}_${new Date().toISOString().slice(0,10)}.xlsx`;
      if(nativeShareAvailable())await nativeShareWorkbook(XLSXLib,workbook,filename);
      else XLSXLib.writeFile(workbook,filename,{compression:true,cellStyles:true});
      if(typeof uiSound==='function')uiSound('success');
      closeModal();
    }catch(error){alert(`Не удалось выгрузить аналитику: ${error?.message||error}`)}
    finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent='Выгрузить Excel'}}
  }

  function optionButton(kind,value,label,active){return `<button type="button" class="analytics-export-option ${active?'active':''}" data-export-${kind}="${value}" aria-pressed="${active}">${escHtml(label)}</button>`}

  function openAnalyticsExport(){
    closeModal();
    const activeScope=document.querySelector('.analytics-scope-btn.active')?.dataset.analyticsScope||'combined';
    const modal=document.createElement('div');
    modal.id='modal';modal.className='modal-backdrop analytics-export-backdrop';
    modal.innerHTML=`<div class="modal analytics-export-modal" role="dialog" aria-modal="true" aria-labelledby="analyticsExportTitle">
      <div class="modal-head"><div><h2 id="analyticsExportTitle">Выгрузка аналитики</h2><p class="analytics-export-subtitle">Excel со сводкой, календарём месяцев, категориями и операциями.</p></div><button type="button" class="icon-btn" data-export-close aria-label="Закрыть">×</button></div>
      <div class="analytics-export-group"><span class="analytics-export-label">Кого выгрузить</span><div class="analytics-export-options analytics-export-scope-options">${optionButton('scope','husband','Муж',activeScope==='husband')}${optionButton('scope','wife','Жена',activeScope==='wife')}${optionButton('scope','combined','Сводный',activeScope==='combined')}</div></div>
      <div class="analytics-export-group"><span class="analytics-export-label">Период</span><div class="analytics-export-options analytics-export-period-options">${optionButton('period','month','1 месяц',false)}${optionButton('period','quarter','3 месяца',false)}${optionButton('period','half','Полгода',false)}${optionButton('period','year','Год',false)}${optionButton('period','current_year','Текущий год',true)}</div><p class="analytics-export-hint">«Год» — последние 12 календарных месяцев. «Текущий год» — с 1 января по сегодня.</p></div>
      <div class="analytics-export-preview"><span>В файле</span><b>Сводка · календарь 3×4 · категории · операции</b></div>
      <div class="analytics-export-actions"><button type="button" class="btn btn-soft" data-export-close>Отмена</button><button type="button" class="btn btn-primary" data-export-submit>Выгрузить Excel</button></div>
    </div>`;
    document.body.appendChild(modal);document.documentElement.classList.add('modal-open');
    modal.querySelectorAll('[data-export-close]').forEach(button=>button.onclick=()=>closeModal());
    modal.addEventListener('click',event=>{if(event.target===modal)closeModal()});
    modal.querySelectorAll('[data-export-scope]').forEach(button=>button.onclick=()=>{modal.querySelectorAll('[data-export-scope]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))})});
    modal.querySelectorAll('[data-export-period]').forEach(button=>button.onclick=()=>{modal.querySelectorAll('[data-export-period]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))})});
    modal.querySelector('[data-export-submit]').onclick=()=>{
      const scope=modal.querySelector('[data-export-scope].active')?.dataset.exportScope||'combined';
      const period=modal.querySelector('[data-export-period].active')?.dataset.exportPeriod||'current_year';
      exportAnalytics(scope,period,modal.querySelector('[data-export-submit]'));
    };
  }

  function installAnalyticsButton(){
    if(typeof window.analyticsPage!=='function'||window.analyticsPage.__excelExportWrapped)return;
    const originalPage=window.analyticsPage;
    function wrappedPage(){
      const html=originalPage();
      return html.replace('<h2 class="page-title">Аналитика</h2>','<div class="analytics-title-actions"><h2 class="page-title">Аналитика</h2><button type="button" class="analytics-export-button" data-analytics-export title="Выгрузить аналитику в Excel" aria-label="Выгрузить аналитику в Excel"><span aria-hidden="true">⇩</span><b>Excel</b></button></div>');
    }
    wrappedPage.__excelExportWrapped=true;
    window.analyticsPage=wrappedPage;

    if(typeof window.bindAnalyticsControls==='function'){
      const originalBind=window.bindAnalyticsControls;
      window.bindAnalyticsControls=function(){originalBind();document.querySelector('[data-analytics-export]')?.addEventListener('click',openAnalyticsExport)};
    }
  }

  installAnalyticsButton();
  window.AnalyticsExcelExport={open:openAnalyticsExport,export:exportAnalytics};
})();
