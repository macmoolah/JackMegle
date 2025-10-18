/* Simple video page client: minimal polite-offer handling, socket.io based */
(() => {
  const DEFAULT_STUN = 'stun:stun.l.google.com:19302';
  const status = id('status'), startBtn = id('startBtn'), nextBtn = id('nextBtn'),
    hangupBtn = id('hangupBtn'), muteBtn = id('muteBtn'), camBtn = id('camBtn'),
    localVideo = id('localVideo'), remoteVideo = id('remoteVideo'),
    messages = id('messages'), msgForm = id('msgForm'), msgInput = id('msgInput');

  let socket, pc, localStream, partnerId, isPolite=false, makingOffer=false, pendingCandidates=[];

  function id(i){ return document.getElementById(i); }
  function setStatus(t){ if(status) status.textContent = t; }
  function addMessage(t, cls='meta'){ const d=document.createElement('div'); d.textContent=t; d.className=cls; messages.appendChild(d); messages.scrollTop = messages.scrollHeight; }

  async function getLocal() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}}, audio:true});
      localStream = s;
      localVideo.srcObject = s;
      return s;
    } catch (err) { setStatus('Camera/mic error'); throw err; }
  }

  function createPC(iceServers=[{urls:[DEFAULT_STUN]}]) {
    pc = new RTCPeerConnection({iceServers});
    if (localStream) localStream.getTracks().forEach(t=>pc.addTrack(t, localStream));
    pc.ontrack = e => { if (e.streams && e.streams[0]) remoteVideo.srcObject = e.streams[0]; setStatus('Connected'); };
    pc.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate',{candidate:e.candidate}); };
    pc.onnegotiationneeded = async () => {
      try { makingOffer = true; const offer = await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit('offer',{sdp:pc.localDescription}); }
      catch(e){ console.error(e); } finally { makingOffer = false; }
    };
    return pc;
  }

  function startSocket() {
    socket = io();
    socket.on('connect', ()=> setStatus('Connected to signaling'));
    socket.on('waiting', ()=> setStatus('Waiting for partner'));
    socket.on('paired', (info)=> {
      partnerId = info.partnerId;
      isPolite = compareIds(socket.id, partnerId);
      setStatus('Paired: '+partnerId);
      [nextBtn, hangupBtn, muteBtn, camBtn].forEach(b=>b.disabled=false);
      if (!pc) createPC();
      socket.emit('remote-ready');
    });
    socket.on('offer', async (m)=> {
      if (!pc) createPC();
      const desc = new RTCSessionDescription(m.sdp);
      const collision = makingOffer || pc.signalingState !== 'stable';
      const ignore = !isPolite && collision;
      if (ignore) return;
      try {
        await pc.setRemoteDescription(desc);
        for (const c of pendingCandidates) await pc.addIceCandidate(c);
        pendingCandidates = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer',{sdp:pc.localDescription});
      } catch (e) { console.error(e); }
    });
    socket.on('answer', async (m)=> { try{ await pc.setRemoteDescription(new RTCSessionDescription(m.sdp)); }catch(e){console.error(e);} });
    socket.on('ice-candidate', async (m)=> {
      if (!pc) { pendingCandidates.push(m.candidate); return; }
      try { if (pc.remoteDescription) await pc.addIceCandidate(m.candidate); else pendingCandidates.push(m.candidate); } catch(e){console.error(e);}
    });
    socket.on('message', m => addMessage(m.text, 'them'));
    socket.on('partner-disconnected', ()=>{ addMessage('Partner disconnected','meta'); cleanup(); setStatus('Partner disconnected'); });
  }

  function compareIds(a='',b=''){ const nA=parseInt((a||'').replace(/\D/g,''))||0; const nB=parseInt((b||'').replace(/\D/g,''))||0; return nA>nB; }

  function cleanup(){
    if (pc) try{ pc.close(); }catch(e){} pc=null; if (remoteVideo) remoteVideo.srcObject=null;
    partnerId=null; pendingCandidates=[];
    [nextBtn, hangupBtn, muteBtn, camBtn].forEach(b=>b.disabled=true);
  }

  async function start() {
    setStatus('Starting...');
    try{ await getLocal(); }catch(e){ return; }
    if (!socket) startSocket();
    socket.emit('join',{mode:'video', interests:(sessionStorage.getItem('jm:interests')||'').split(',')});
    setStatus('Ready — waiting for pair');
  }

  startBtn?.addEventListener('click', ()=>{ startBtn.disabled=true; start(); });
  hangupBtn?.addEventListener('click', ()=>{ socket && socket.emit('leave'); cleanup(); setStatus('Hung up'); startBtn.disabled=false; });
  nextBtn?.addEventListener('click', ()=> socket && socket.emit('next'));
  msgForm?.addEventListener('submit', (e)=>{ e.preventDefault(); const v = msgInput.value.trim(); if(!v) return; addMessage(v,'me'); socket.emit('message',{text:v}); msgInput.value=''; });

  muteBtn?.addEventListener('click', ()=> {
    if (!localStream) return;
    const t = localStream.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    muteBtn.textContent = t.enabled ? 'Mute' : 'Unmute';
  });

  camBtn?.addEventListener('click', ()=> {
    if (!localStream) return;
    const t = localStream.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    camBtn.textContent = t.enabled ? 'Camera On' : 'Camera Off';
  });

})();
