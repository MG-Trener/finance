// Goals feature retired. Keep legacy state arrays empty for offline compatibility,
// but stop loading or using financial_goals / goal_contributions in the app runtime.
loadData=async function(){
  let fu,error;
  try{
    const res=await sb.from('family_users').select('family_id,role,families(id,name,currency,created_by)').limit(1);
    fu=res.data;error=res.error;
  }catch(err){error=err}
  if(error){await restoreOfflineOrShowError(`Ошибка: ${error.message||error}`);return}
  if(!fu?.length){
    const token=pendingInviteToken();
    if(token){
      const {error:claimError}=await sb.rpc('claim_family_invite',{invite_token:token});
      if(!claimError){clearPendingInvite();return loadData()}
      return renderRestrictedAccess('Приглашение недействительно, уже использовано или срок его действия истёк.');
    }
    return renderRestrictedAccess();
  }

  state.family=fu[0].families;
  const familyId=state.family.id;
  let responses;
  try{
    responses=await Promise.all([
      sb.from('people').select('*').eq('family_id',familyId).order('label'),
      sb.from('categories').select('*').or(`family_id.is.null,family_id.eq.${familyId}`).order('sort_order'),
      sb.from('subcategories').select('*').order('sort_order'),
      sb.from('transactions').select('*').eq('family_id',familyId).is('deleted_at',null).order('occurred_at',{ascending:false}).limit(INITIAL_ACTIVE_TX_LIMIT),
      sb.from('transactions').select('*').eq('family_id',familyId).not('deleted_at','is',null).order('deleted_at',{ascending:false}).limit(INITIAL_TRASH_TX_LIMIT),
      sb.from('recurring_payments').select('*').eq('family_id',familyId).order('day_of_month')
    ]);
  }catch(err){await restoreOfflineOrShowError(`Ошибка загрузки: ${err?.message||err}`);return}

  const [p,c,s,t,trash,r]=responses;
  const firstError=responses.find(item=>item.error)?.error;
  if(firstError){await restoreOfflineOrShowError(`Ошибка загрузки: ${firstError.message}`);return}

  state.people=p.data||[];
  state.categories=c.data||[];
  state.subcategories=s.data||[];
  state.transactions=t.data||[];
  state.trashTransactions=trash.data||[];
  state.activeTransactionsHasMore=state.transactions.length===INITIAL_ACTIVE_TX_LIMIT;
  state.trashTransactionsHasMore=state.trashTransactions.length===INITIAL_TRASH_TX_LIMIT;
  state.recurring=r.data||[];
  state.goals=[];
  state.goalContributions=[];
  if(!state.selectedPersonId&&state.people[0])state.selectedPersonId=state.people.find(x=>x.linked_user_id===state.user?.id)?.id||state.people[0].id;
  await window.FinanceOffline?.reapplyPendingToState?.();
  // Old offline goal mutations are intentionally ignored by the current UI.
  state.goals=[];
  state.goalContributions=[];
  if(hasDeletionIntent())state.view='settings';
  renderApp();
  window.FinanceOffline?.persistSnapshotSoon?.();
  if(navigator.onLine)window.FinanceOffline?.flushQueue?.();
};
