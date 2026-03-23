const API = window.location.port === '3001' || window.location.hostname === 'localhost' ? 'http://localhost:3001' : ''
const CORES = ['#25d366','#53bdeb','#f5a623','#f15c6d','#bf59cf','#00a884','#0288d1','#e91e8c']
const colorMap = {}
let todosContatos = [], filtrados = [], filtroAtual = 'todos', contatoAtivo = null
let sseConn = null
// Rastreia quantas mensagens já foram renderizadas para o contato ativo
let msgCount = 0
let chatPollingInterval = null

function corC(tel) { if (!colorMap[tel]) colorMap[tel] = CORES[Object.keys(colorMap).length % CORES.length]; return colorMap[tel] }
function inicial(nome) { if (!nome) return '?'; return nome.trim().split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase() }
function fHora(ts) { if (!ts) return ''; return new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}) }
function fData(ts) { if (!ts) return ''; return new Date(ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'}) }
function isAtendente(nome) { return nome==='Atendente'||nome==='atendente_ia'||nome==='atendente_humano' }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function dHoje() { return new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}) }

// ── CARREGA LISTA DE CONTATOS (usado na inicialização e polling geral) ──
async function carregarContatos() {
  try {
    const [relR, contR] = await Promise.all([
      fetch(`${API}/relatorio?data=${dHoje()}`),
      fetch(`${API}/contatos`)
    ])
    const relData = relR.ok ? await relR.json() : { contatos: [] }
    const contData = contR.ok ? await contR.json() : { contatos: [] }
    const contatosMap = {}
    for (const c of contData.contatos || []) contatosMap[c.telefone] = c
    todosContatos = (relData.contatos || []).map(c => ({
      ...c,
      ia: contatosMap[c.telefone]?.ia || 'sim'
    }))
    filtrarContatos()
    // Se tem chat aberto, sincroniza o objeto mas não re-renderiza tudo
    if (contatoAtivo) {
      const fresh = todosContatos.find(c => c.telefone === contatoAtivo.telefone)
      if (fresh) contatoAtivo = fresh
    }
  } catch(e) {
    document.getElementById('clBody').innerHTML = `<div class="cl-loading">Erro ao carregar</div>`
  }
}

// ── POLLING DO CHAT ATIVO: busca só as mensagens do contato aberto ──
async function pollChatAtivo() {
  if (!contatoAtivo) return
  try {
    const r = await fetch(`${API}/relatorio?data=${dHoje()}`)
    if (!r.ok) return
    const data = await r.json()
    const fresco = (data.contatos || []).find(c => c.telefone === contatoAtivo.telefone)
    if (!fresco) return
    const msgsFrescas = fresco.mensagens || []
    const msgsAtuais = contatoAtivo.mensagens || []
    // Só atualiza se chegou mensagem nova
    if (msgsFrescas.length > msgsAtuais.length) {
      contatoAtivo = { ...contatoAtivo, ...fresco }
      // Atualiza também em todosContatos
      const idx = todosContatos.findIndex(c => c.telefone === contatoAtivo.telefone)
      if (idx >= 0) todosContatos[idx] = contatoAtivo
      appendNovasMensagens(msgsFrescas)
      atualizarHeader()
      renderLista()
    }
  } catch {}
}

// ── APPEND APENAS MENSAGENS NOVAS (sem recriar o DOM) ──
function appendNovasMensagens(todasMsgs) {
  const el = document.getElementById('chatMessages')
  if (!el) return
  const novas = todasMsgs.slice(msgCount)
  if (!novas.length) return
  const eraNoFundo = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  let ultimaData = msgCount > 0 ? fData(todasMsgs[msgCount - 1].timestamp) : ''
  for (const msg of novas) {
    const data = fData(msg.timestamp)
    if (data !== ultimaData) {
      const sep = document.createElement('div')
      sep.className = 'msg-day'
      sep.innerHTML = `<span>${data}</span>`
      el.appendChild(sep)
      ultimaData = data
    }
    const out = isAtendente(msg.nome)
    const senderColor = msg.nome==='atendente_ia' ? 'var(--blue)' : (msg.nome==='atendente_humano'||msg.nome==='Atendente') ? 'var(--amber)' : 'var(--green)'
    const row = document.createElement('div')
    row.className = `msg-row ${out?'out':'in'}`
    row.innerHTML = `<div class="bubble">
      <div class="bubble-sender" style="color:${senderColor}">${msg.nome||'Cliente'}</div>
      <div class="bubble-text">${escHtml(msg.mensagem||'')}</div>
      <div class="bubble-time">${fHora(msg.timestamp)}</div>
    </div>`
    el.appendChild(row)
  }
  msgCount = todasMsgs.length
  if (eraNoFundo) el.scrollTop = el.scrollHeight
}

function filtrarContatos() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim()
  let base = filtroAtual === 'pendente' ? todosContatos.filter(c=>c.tem_pendencia)
           : filtroAtual === 'respondida' ? todosContatos.filter(c=>c.respondida && !c.tem_pendencia)
           : [...todosContatos]
  filtrados = q ? base.filter(c=>(c.nome||'').toLowerCase().includes(q)||(c.telefone||'').includes(q)) : base
  renderLista()
}

function setFiltro(f) {
  filtroAtual = f
  document.getElementById('fTodos').classList.toggle('active', f==='todos')
  document.getElementById('fPend').classList.toggle('active', f==='pendente')
  document.getElementById('fResp').classList.toggle('active', f==='respondida')
  filtrarContatos()
}

function renderLista() {
  if (!filtrados.length) {
    document.getElementById('clBody').innerHTML = `<div class="cl-loading">Nenhuma conversa encontrada</div>`
    return
  }
  document.getElementById('clBody').innerHTML = filtrados.map((c,idx) => {
    const cor = corC(c.telefone)
    const ini = inicial(c.nome)
    const ultMsg = c.mensagens?.[c.mensagens.length-1]
    const preview = ultMsg?.mensagem || '—'
    const hora = fHora(ultMsg?.timestamp || c.primeira_msg_cliente?.horario)
    const statusCls = c.tem_pendencia ? 'pend' : c.respondida ? 'resp' : 'noresp'
    const iaCls = c.ia === 'nao' ? 'pausada' : 'ativa'
    const isActive = contatoAtivo?.telefone === c.telefone ? 'active' : ''
    return `<div class="contact-item ${isActive}" style="animation-delay:${idx*30}ms" onclick="abrirChat('${c.telefone}')">
      <div class="ci-avatar" style="background:${cor}">
        ${ini}
        <div class="ci-avatar-ia ${iaCls}"></div>
      </div>
      <div class="ci-info">
        <div class="ci-top">
          <div class="ci-name">${c.nome||'Desconhecido'}</div>
          <div class="ci-time">${hora}</div>
        </div>
        <div class="ci-bottom">
          <div class="ci-preview">${preview}</div>
          <div class="ci-badge"><div class="ci-status ${statusCls}"></div></div>
        </div>
      </div>
    </div>`
  }).join('')
}

function abrirChat(telefone) {
  contatoAtivo = todosContatos.find(c=>c.telefone===telefone)
  if (!contatoAtivo) return
  msgCount = 0
  renderLista()
  montarChatWindow()
  document.getElementById('chatWindow').classList.add('mobile-open')
  document.getElementById('contactList').style.display = 'none'
  // Inicia polling dedicado ao chat ativo
  iniciarChatPolling()
}

// Monta o shell do chat (header + área de mensagens) — só chamado ao abrir um chat
function montarChatWindow() {
  const c = contatoAtivo
  const cw = document.getElementById('chatWindow')
  cw.innerHTML = `
    <div class="chat-bg-pattern"></div>
    <div class="chat-header" id="chatHeader"></div>
    <div class="chat-messages" id="chatMessages"></div>
  `
  atualizarHeader()
  // Renderiza todas as mensagens do zero
  appendNovasMensagens(c.mensagens || [])
}

// Atualiza apenas o header (status, IA) sem tocar nas mensagens
function atualizarHeader() {
  const hdr = document.getElementById('chatHeader')
  if (!hdr || !contatoAtivo) return
  const c = contatoAtivo
  const cor = corC(c.telefone)
  const ini = inicial(c.nome)
  const statusCls = c.tem_pendencia ? 'pend' : c.respondida ? 'resp' : 'noresp'
  const statusTxt = c.tem_pendencia ? 'Pendente' : c.respondida ? 'Respondida' : 'Sem resposta'
  const iaCls = c.ia === 'nao' ? 'pausada' : 'ativa'
  const iaTxt = c.ia === 'nao' ? '⏸ IA Pausada' : '▶ IA Ativa'
  const iaHoverTxt = c.ia === 'nao' ? 'Ativar IA' : 'Pausar IA'
  hdr.innerHTML = `
    <div class="ch-left">
      <button class="back-btn" onclick="voltarLista()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="ch-avatar" style="background:${cor}">${ini}</div>
      <div>
        <div class="ch-name">${c.nome||'Desconhecido'}</div>
        <div class="ch-phone">${c.telefone}</div>
      </div>
    </div>
    <div class="ch-right">
      <div class="ch-status-pill ${statusCls}">${statusTxt}</div>
      <button class="ia-toggle ${iaCls}" id="iaToggleBtn" onclick="toggleIA('${c.telefone}')" title="${iaHoverTxt}">${iaTxt}</button>
    </div>`
}

function iniciarChatPolling() {
  if (chatPollingInterval) clearInterval(chatPollingInterval)
  chatPollingInterval = setInterval(pollChatAtivo, 8000)
}

function pararChatPolling() {
  if (chatPollingInterval) { clearInterval(chatPollingInterval); chatPollingInterval = null }
}

async function toggleIA(telefone) {
  const c = todosContatos.find(x=>x.telefone===telefone)
  if (!c) return
  const novoStatus = c.ia === 'nao' ? 'sim' : 'nao'
  try {
    const r = await fetch(`${API}/contato/${telefone}/ia`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ia: novoStatus })
    })
    if (!r.ok) throw new Error()
    c.ia = novoStatus
    if (contatoAtivo) contatoAtivo.ia = novoStatus
    atualizarHeader()
    renderLista()
    showToast(novoStatus === 'sim' ? '▶ IA reativada' : '⏸ IA pausada', 'success')
  } catch { showToast('Erro ao alterar IA', 'error') }
}

function voltarLista() {
  pararChatPolling()
  contatoAtivo = null
  msgCount = 0
  document.getElementById('chatWindow').classList.remove('mobile-open')
  document.getElementById('contactList').style.display = 'flex'
}

function conectarSSE() {
  if (sseConn) { try { sseConn.close() } catch {} }
  sseConn = new EventSource(`${API}/stream`)
  // SSE dispara: atualiza lista de contatos e aciona poll imediato do chat
  sseConn.onmessage = () => {
    carregarContatos()
    if (contatoAtivo) pollChatAtivo()
  }
  sseConn.onerror = () => { try { sseConn.close() } catch {}; setTimeout(conectarSSE, 5000) }
}

;(function(){
  carregarContatos()
  conectarSSE()
  // Polling geral da lista a cada 15s
  setInterval(carregarContatos, 60000)
})()
