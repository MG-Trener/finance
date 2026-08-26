// Shared modal helper used by feature modules.
// Keep it global because the current application is composed from classic scripts.
function closeModal(){
  const modal=document.getElementById('modal');
  if(modal)modal.remove();
  document.documentElement.classList.remove('modal-open');
}
window.closeModal=closeModal;
