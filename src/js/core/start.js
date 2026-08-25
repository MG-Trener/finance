// Final application start after all feature overrides are registered.
sb.auth.onAuthStateChange(async(_,session)=>{state.user=session?.user||null;if(state.user)await loadData();else renderAuth()});
bootstrap();
