// Final application start after all feature overrides are registered.
// Keep the boot screen visible until Supabase has resolved the persisted session.
// This prevents the login form from flashing for already-authenticated users on refresh.
(function(){
  let initialResolved=false;
  let renderedUserId=null;

  function runAfterAuthCallback(fn){
    // Supabase recommends avoiding additional client calls directly inside
    // onAuthStateChange. Move app loading to the next task instead.
    setTimeout(fn,0);
  }

  sb.auth.onAuthStateChange((event,session)=>{
    const user=session?.user||null;
    state.user=user;

    if(event==='INITIAL_SESSION'){
      if(initialResolved)return;
      initialResolved=true;
      if(user){
        renderedUserId=user.id;
        runAfterAuthCallback(()=>loadData());
      }else{
        runAfterAuthCallback(()=>renderAuth());
      }
      return;
    }

    if(event==='SIGNED_IN'){
      initialResolved=true;
      if(!user)return;
      if(renderedUserId===user.id&&state.family)return;
      renderedUserId=user.id;
      runAfterAuthCallback(()=>loadData());
      return;
    }

    if(event==='SIGNED_OUT'){
      initialResolved=true;
      renderedUserId=null;
      state.user=null;
      state.family=null;
      runAfterAuthCallback(()=>renderAuth());
      return;
    }

    // TOKEN_REFRESHED and USER_UPDATED should not replace the current screen.
    if(user)renderedUserId=user.id;
  });
})();
