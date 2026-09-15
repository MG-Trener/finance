// Birthday push UX: open Plan month from notification and mention birthdays in push settings.
(function(){
  function installBirthdayAction(){
    const push=window.Capacitor?.Plugins?.PushNotifications;
    if(!push?.addListener)return;
    push.addListener('pushNotificationActionPerformed',event=>{
      const data=event?.notification?.data||{};
      if(data.kind!=='birthday'||typeof state==='undefined')return;
      const date=String(data.date||'');
      const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      state.view='plan';
      if(match){state.year=Number(match[1]);state.month=Number(match[2]);}
      if(typeof planSection!=='undefined')planSection='calendar';
      if(typeof renderApp==='function')renderApp();
      if(typeof scrollOverviewTop==='function')scrollOverviewTop();
    });
  }
  if(window.FinancePush?.settingsMarkup){
    const base=window.FinancePush.settingsMarkup.bind(window.FinancePush);
    window.FinancePush.settingsMarkup=function(){
      return base().replace('Уведомления о добавлении, изменении и удалении доходов/расходов. Автор операции сам себе push не получает.','Уведомления о доходах/расходах и общие push по дням рождения из Плана. Дни рождения получают все пользователи семьи с включёнными push.');
    };
  }
  installBirthdayAction();
})();