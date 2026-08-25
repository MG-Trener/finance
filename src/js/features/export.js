// Export current journal selection to CSV or Excel.
(function(){
  function safeFilePart(value){
    return String(value||'finance')
      .trim()
      .replace(/[\\/:*?"<>|]+/g,'-')
      .replace(/\s+/g,'_')
      .slice(0,60)||'finance';
  }

  function exportRows(){
    const tx=typeof journalFilteredTx==='function'?journalFilteredTx():[];
    return tx.map(x=>{
      const d=new Date(x.occurred_at);
      return {
        'Дата':d.toLocaleDateString('ru-RU'),
        'Время':d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),
        'Кто':personName(x.person_id),
        'Тип':x.type==='income'?'Доход':'Расход',
        'Категория':catName(x.category_id),
        'Подкатегория':subName(x.subcategory_id)||'',
        'Сумма, ₸':Number(x.amount)||0,
        'Комментарий':x.description||''
      };
    });
  }

  function filterDescription(){
    const f=state.filters||{};
    const parts=[];
    if((f.period||'month')==='month')parts.push(`${MONTHS[state.month-1]} ${state.year}`);
    else if(f.period==='year')parts.push(`${state.year} год`);
    else parts.push('за всё время');
    if(f.person&&f.person!=='all')parts.push(personName(f.person));
    if(f.type&&f.type!=='all')parts.push(f.type==='income'?'только доходы':'только расходы');
    if(f.category&&f.category!=='all')parts.push(catName(f.category));
    if((f.search||'').trim())parts.push(`поиск: ${f.search.trim()}`);
    return parts.join(' · ');
  }

  function summaryRows(){
    const tx=typeof journalFilteredTx==='function'?journalFilteredTx():[];
    const income=tx.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0);
    const expense=tx.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
    const rows=[
      ['Семья',state.family?.name||''],
      ['Фильтр',filterDescription()],
      ['Количество операций',tx.length],
      ['Доходы, ₸',income],
      ['Расходы, ₸',expense],
      ['Баланс, ₸',income-expense],
      []
    ];
    rows.push(['По участникам','','']);
    rows.push(['Участник','Доходы, ₸','Расходы, ₸','Баланс, ₸']);
    state.people.forEach(p=>{
      const own=tx.filter(x=>x.person_id===p.id);
      const inc=own.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0);
      const exp=own.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
      rows.push([p.display_name,inc,exp,inc-exp]);
    });
    return rows;
  }

  function fileBase(){
    const family=safeFilePart(state.family?.name||'семейная_казна');
    const period=(state.filters?.period||'month')==='month'
      ?`${state.year}-${String(state.month).padStart(2,'0')}`
      :(state.filters?.period==='year'?String(state.year):'all');
    return `${family}_${period}`;
  }

  function downloadBlob(content,type,filename){
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function csvEscape(value){
    const s=String(value??'');
    return /[;"\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
  }

  function exportCSV(){
    const rows=exportRows();
    if(!rows.length){alert('В текущей выборке нет операций для экспорта.');return}
    const headers=Object.keys(rows[0]);
    const lines=[headers.map(csvEscape).join(';')];
    rows.forEach(row=>lines.push(headers.map(h=>csvEscape(row[h])).join(';')));
    downloadBlob('\uFEFF'+lines.join('\r\n'),'text/csv;charset=utf-8;',`${fileBase()}.csv`);
  }

  function exportExcel(){
    const rows=exportRows();
    if(!rows.length){alert('В текущей выборке нет операций для экспорта.');return}
    if(!window.XLSX){alert('Модуль Excel ещё не загрузился. Обновите страницу и попробуйте снова.');return}

    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.json_to_sheet(rows);
    ws['!cols']=[
      {wch:12},{wch:8},{wch:18},{wch:12},{wch:22},{wch:24},{wch:14},{wch:36}
    ];
    XLSX.utils.book_append_sheet(wb,ws,'Операции');

    const summary=XLSX.utils.aoa_to_sheet(summaryRows());
    summary['!cols']=[{wch:24},{wch:34},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb,summary,'Сводка');

    XLSX.writeFile(wb,`${fileBase()}.xlsx`,{compression:true});
  }

  window.FinanceExport={exportCSV,exportExcel};
})();
