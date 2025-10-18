(() => {
  const socket = io();
  const status = document.getElementById('status');
  const messages = document.getElementById('messages');
  const msgForm = document.getElementById('msgForm');
  const msgInput = document.getElementById('msgInput');
  const nextBtn = document.getElementById('nextBtn');

  function setStatus(t){ if(status) status.textContent = t; }
  function addMessage(t, cls='meta'){ const d=document.createElement('div'); d.textContent=t; d.className=cls; messages.appendChild(d); messages.scrollTop=messages.scrollHeight; }

  socket.on('connect', ()=> setStatus('Connected'));
  socket.on('waiting', ()=> setStatus('Waiting'));
  socket.on('paired', (info)=> { setStatus('Paired: '+info.partnerId); });
  socket.on('message', m => addMessage(m.text,'them'));
  socket.on('partner-disconnected', ()=> { addMessage('Partner disconnected','meta'); setStatus('Partner disconnected'); });

  socket.emit('join',{mode:'text', interests:(sessionStorage.getItem('jm:interests')||'').split(',')});

  msgForm?.addEventListener('submit', (e)=> {
    e.preventDefault();
    const v = (msgInput||{}).value || '';
    if (!v.trim()) return;
    socket.emit('message',{text:v});
    addMessage(v,'me');
    msgInput.value = '';
  });

  nextBtn?.addEventListener('click', ()=> socket.emit('next'));
})();
