// Plan push UX: open the relevant Plan section from birthday and planned-expense notifications.
(function(){
  function installPlanPushActions(){
    const push=window.Capacitor?.Plugins?.PushNotifications;
    if(!push?.addListener)return;
    push.addListener('pushNotificationActionPerformed',event=>{
      const data=event?.notification?.data||{};
      if(typeof state==='undefined')return;
      const kind=String(data.kind||'');
      if(kind!=='birthday'&&kind!=='planned_expense')return;
      const date=String(kind==='planned_expense'?(data.due_date||data.date||''):(data.date||''));
      const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      state.view='plan';
      if(match){state.year=Number(match[1]);state.month=Number(match[2]);}
      if(typeof planSection!=='undefined')planSection=kind==='planned_expense'?'recurring':'calendar';
      if(typeof renderApp==='function')renderApp();
      if(typeof scrollOverviewTop==='function')scrollOverviewTop();
    });
  }
  if(window.FinancePush?.settingsMarkup){
    const base=window.FinancePush.settingsMarkup.bind(window.FinancePush);
    window.FinancePush.settingsMarkup=function(){
      return base().replace(
        'Уведомления о добавлении, изменении и удалении доходов/расходов. Автор операции сам себе push не получает.',
        'Уведомления о доходах/расходах, днях рождения и сроках плановых затрат. По плановой затрате push приходит ежедневно, начиная с заданного срока напоминания, пока она не отмечена «Оплачено».'
      );
    };
  }
  installPlanPushActions();
})();
