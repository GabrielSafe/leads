const API = window.location.port === '3001' || window.location.hostname === 'localhost' ? 'http://localhost:3001' : ''
const CORES = ['g','a','b','r','v','o']
const colorMap = {}, colorIdx = [0]
function dHoje() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) }
let dataAtual = dHoje(), cache = null, instAtual = 'todas', ontemCache = null
let _allContatos = [], _tableFilter = '', _dense = false, _sortCol = -1, _sortDir = 1, _statusFilter = 'todos'
let _page = 1, _searchTimer = null
const _PAGE_SIZE = 30


function inicializar() {
  const t = localStorage.getItem('theme')
  if (t === 'light') {
    document.body.classList.add('light')
    document.getElementById('iconMoon').style.display = 'none'
    document.getElementById('iconSun').style.display  = 'block'
  } else if (!t && window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.body.classList.add('light')
    document.getElementById('iconMoon').style.display = 'none'
    document.getElementById('iconSun').style.display  = 'block'
  }
  /* preenche nome da empresa no splash se CONFIG disponível */
  const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {}
  if (cfg.empresa) {
    const el = document.getElementById('splash-name'); if (el) el.textContent = cfg.empresa
  }
  updateGreeting()
  dataAtual = dHoje(); setDateLabel(dataAtual); initBars(); carregar(); conectarSSE()
  setInterval(() => { const el = document.getElementById('clock'); if(el) el.textContent = new Date().toLocaleTimeString('pt-BR') }, 1000)
  initPageTransitions()
  initScrollTop()
  initKeyboardShortcuts()
  initSortableHeaders()
  restoreDensity()
  initCardFilters()
  initTooltips()
}


function initTooltips() {
  const tips = [
    ['densityBtn',  'Alternar densidade'],
    ['exportBtn',   'Exportar CSV'],
    ['tableSearch', null],
  ]
  tips.forEach(([id, tip]) => {
    if (!tip) return
    const el = document.getElementById(id)
    if (el) el.setAttribute('data-tip', tip)
  })
  document.querySelectorAll('.copy-btn').forEach(b => b.setAttribute('data-tip','Copiar telefone'))
  document.querySelectorAll('.icon-btn[title]').forEach(b => { b.setAttribute('data-tip', b.title); b.removeAttribute('title') })
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicializar)
else inicializar()

function toggleTheme() {
  document.body.classList.add('theme-transitioning')
  const isLight = document.body.classList.toggle('light')
  document.getElementById('iconMoon').style.display = isLight ? 'none'  : 'block'
  document.getElementById('iconSun').style.display  = isLight ? 'block' : 'none'
  localStorage.setItem('theme', isLight ? 'light' : 'dark')
  setTimeout(() => document.body.classList.remove('theme-transitioning'), 380)
}
function setDateLabel(d) { const [y,m,dia]=d.split('-'); document.getElementById('dlabel').textContent=`${dia}/${m}/${y}`; document.getElementById('dpick').value=d }
function mudarDia(delta) { const dt=new Date(dataAtual+'T12:00:00'); dt.setDate(dt.getDate()+delta); dataAtual=dt.toISOString().split('T')[0]; setDateLabel(dataAtual); carregar() }
function irData(v) { if(!v)return; dataAtual=v; setDateLabel(v); carregar() }
function irHoje()  { dataAtual=dHoje(); setDateLabel(dataAtual); carregar() }

/* ── SPLASH ── */
let _splashHidden = false, _firstLoad = true

/* ── TOAST ── */
function showToast(msg, type='ok') {
  const c = document.getElementById('toastContainer'); if(!c) return
  const t = document.createElement('div')
  t.className = `toast ${type}`
  t.innerHTML = `<div class="toast-dot"></div><span>${msg}</span>`
  c.appendChild(t)
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')))
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350) }, 2800)
}

/* ── SCROLL TO TOP ── */
function initScrollTop() {
  const btn = document.getElementById('scrollTop')
  const content = document.querySelector('.content')
  if (!btn || !content) return
  content.addEventListener('scroll', () => btn.classList.toggle('show', content.scrollTop > 280))
  btn.addEventListener('click', () => content.scrollTo({ top:0, behavior:'smooth' }))
}

/* ── CHAT BADGE ── */
function updateChatBadge(pend) {
  const badge = document.getElementById('chatBadge')
  const bnBadge = document.getElementById('bnChatBadge')
  const val = pend > 99 ? '99+' : pend
  ;[badge, bnBadge].forEach(b => {
    if (!b) return
    if (pend > 0) { b.textContent = val; b.style.display = 'flex'; b.style.animation = 'none'; requestAnimationFrame(() => { b.style.animation = '' }) }
    else { b.style.display = 'none' }
  })
  if (!badge) return
}

/* ── HELP MODAL ── */
function toggleHelpModal() {
  const existing = document.getElementById('helpModal')
  if (existing) { existing.remove(); return }
  const modal = document.createElement('div')
  modal.id = 'helpModal'
  modal.innerHTML = `<div id="helpModalInner">
    <div id="helpModalHead">
      <span>Atalhos de teclado</span>
      <button onclick="document.getElementById('helpModal').remove()">✕</button>
    </div>
    <div id="helpModalBody">
      ${[['←','Dia anterior'],['→','Próximo dia'],['T','Ir para hoje'],['R','Atualizar dados'],['Esc','Fechar drawer / limpar busca'],['?','Este menu']
      ].map(([k,v])=>`<div class="hk-row"><kbd class="hk-key">${k}</kbd><span class="hk-desc">${v}</span></div>`).join('')}
    </div>
  </div>`
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
  document.body.appendChild(modal)
}

/* ── KEYBOARD SHORTCUTS ── */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return
    const drawerOpen = document.getElementById('drawer')?.classList.contains('open')
    if (e.key === 'ArrowLeft'  && !drawerOpen) { e.preventDefault(); mudarDia(-1) }
    if (e.key === 'ArrowRight' && !drawerOpen) { e.preventDefault(); mudarDia(1) }
    if ((e.key === 't' || e.key === 'T') && !drawerOpen) { e.preventDefault(); irHoje() }
    if ((e.key === 'r' || e.key === 'R') && !drawerOpen) { e.preventDefault(); carregar(); showToast('Atualizando...','info') }
    if (e.key === 'Escape' && drawerOpen) fecharDrawer()
    if (e.key === 'Escape' && !drawerOpen) {
      const inp = document.getElementById('tableSearch')
      if (inp && inp.value) { inp.value = ''; filterTable('') }
    }
    if (e.key === '?') toggleHelpModal()
  })
}

/* ── PAGE TRANSITIONS ── */
function initPageTransitions() {
  document.querySelectorAll('.nav-item[href]').forEach(link => {
    link.addEventListener('click', () => {
      /* fechar sidebar no mobile */
      const sb = document.getElementById('sidebar')
      if (sb?.classList.contains('open')) toggleSidebar()
      /* animação de saída visual (browser navega normalmente pelo href) */
      document.querySelector('.main')?.classList.add('page-out')
    })
  })
}

/* ── SAUDAÇÃO ── */
function updateGreeting() {
  const h = new Date().getHours()
  const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {}
  const el = document.getElementById('pageTitle')
  if (el) el.textContent = cfg.empresa ? `${s}, ${cfg.empresa}` : 'Dashboard'
  const sub = document.getElementById('pageSub')
  if (sub) sub.textContent = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'})
}
function hideSplash() {
  if (_splashHidden) return
  _splashHidden = true
  const s = document.getElementById('splash')
  if (s) { s.classList.add('hide'); setTimeout(() => s.remove(), 400) }
}
/* ── FAVICON / TAB BADGE ── */
function updateTabBadge(pend) {
  const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {}
  const base = cfg.empresa ? cfg.empresa + ' · Dashboard' : 'Dashboard'
  document.title = pend > 0 ? `⚠ ${pend} pendente${pend!==1?'s':''} · ${base}` : base
  let link = document.querySelector('link[rel="icon"]')
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
  if (pend > 0) {
    const n = pend > 9 ? '9+' : pend
    const fs = n.toString().length > 1 ? '50' : '60'
    link.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23f15c6d%22/><text x=%2250%22 y=%22.82em%22 text-anchor=%22middle%22 font-family=%22system-ui,sans-serif%22 font-size=%22${fs}%22 font-weight=%22700%22 fill=%22white%22>${n}</text></svg>`
  } else {
    link.href = cfg.favicon_url || `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${cfg.favicon_emoji||'💬'}</text></svg>`
  }
}

async function carregar() {
  try {
    const yday = new Date(dataAtual+'T12:00:00'); yday.setDate(yday.getDate()-1)
    const ydayStr = yday.toISOString().split('T')[0]
    const [r1,r2,r3] = await Promise.all([fetch(`${API}/relatorio?data=${dataAtual}`), fetch(`${API}/contatos`), fetch(`${API}/relatorio?data=${ydayStr}`)])
    if (!r1.ok) throw new Error()
    cache = await r1.json(); setStatus(true)
    ontemCache = r3.ok ? await r3.json() : null
    renderInstBar(cache.contatos||[]); renderTudo(filtrar(cache))
    if (r2.ok) {
      const cData = await r2.json(), todos = cData.contatos||[]
      const iaSim = todos.filter(c=>!c.ia||c.ia==='sim').length
      const iaNao = todos.filter(c=>c.ia==='nao').length
      n('sIASim',iaSim); n('sIANao',iaNao)
    }
    hideSplash()
    if (!_firstLoad) showToast('Dados atualizados')
    _firstLoad = false
  } catch {
    setStatus(false)
    if (!_firstLoad) showToast('Falha ao atualizar', 'err')
    _firstLoad = false
    hideSplash()
  }
}
function filtrar(d) {
  if (instAtual==='todas') return d
  const c=(d.contatos||[]).filter(x=>x.instancia===instAtual)
  const resp=c.filter(x=>x.respondida), tempos=resp.map(x=>x.tempo_espera_segundos).filter(t=>t!==null)
  return {...d,total_conversas:c.length,respondidas:resp.length,nao_respondidas:c.length-resp.length,tma_segundos:tempos.length?Math.round(tempos.reduce((a,b)=>a+b,0)/tempos.length):0,contatos:c}
}
function trocarInstancia(inst) { instAtual=inst; if(!cache)return; renderInstBar(cache.contatos||[]); renderTudo(filtrar(cache)) }
function renderInstBar(contatos) {
  const inst={}; contatos.forEach(c=>{inst[c.instancia]=(inst[c.instancia]||0)+1})
  const bar=document.getElementById('instBar'), total=contatos.length
  bar.innerHTML=`<button class="itab ${instAtual==='todas'?'active':''}" onclick="trocarInstancia('todas')"><div class="itab-dot"></div>Todas<span class="itab-n">${total}</span></button>`+
    Object.entries(inst).map(([nm,c])=>`<button class="itab ${instAtual===nm?'active':''}" onclick="trocarInstancia('${nm}')"><div class="itab-dot"></div>${nm}<span class="itab-n">${c}</span></button>`).join('')
}
function setStatus(ok) {
  const pill=document.getElementById('statusPill'),dot=document.getElementById('sdot'),txt=document.getElementById('stxt')
  if(ok){pill.className='status-pill live';dot.className='dot live';txt.textContent='Ao vivo'}
  else{pill.className='status-pill dead';dot.className='dot dead';txt.textContent='Offline'}
}
function filtrarOntem(d) {
  if (instAtual==='todas') return d
  const c=(d.contatos||[]).filter(x=>x.instancia===instAtual)
  const resp=c.filter(x=>x.respondida)
  return {...d, total_conversas:c.length, respondidas:resp.length, nao_respondidas:c.length-resp.length, com_pendencia:c.filter(x=>x.tem_pendencia).length, contatos:c}
}
function renderDelta(id, hoje, ontem, lowerIsBetter=false) {
  const el=document.getElementById(id); if(!el) return
  if(ontem==null||hoje==null){el.className='sc-delta na ready';el.textContent='sem dados ontem';return}
  const diff=hoje-ontem
  if(diff===0){el.className='sc-delta eq ready';el.textContent='= igual a ontem';return}
  const better=lowerIsBetter?diff<0:diff>0
  const pct=ontem>0?` (${Math.abs(Math.round((diff/ontem)*100))}%)`:''
  el.className=`sc-delta ${better?'up':'down'} ready`
  el.textContent=`${diff>0?'↑':'↓'} ${Math.abs(diff)}${pct} vs ontem`
}
function renderDeltas(d) {
  const o=ontemCache?filtrarOntem(ontemCache):null
  const todayMsgs=(d.contatos||[]).reduce((a,c)=>a+(c.total_msgs_cliente||0),0)
  const ontemMsgs=o?(o.contatos||[]).reduce((a,c)=>a+(c.total_msgs_cliente||0),0):null
  renderDelta('dTotal', d.total_conversas||0, o?o.total_conversas:null)
  renderDelta('dResp',  d.respondidas||0,     o?o.respondidas:null)
  renderDelta('dNResp', d.nao_respondidas||0, o?o.nao_respondidas:null, true)
  renderDelta('dMsgs',  todayMsgs,            ontemMsgs)
  renderDelta('dPend',  d.com_pendencia||0,   o?o.com_pendencia:null, true)
}
function renderTudo(d) {
  const conv=d.total_conversas||0,resp=d.respondidas||0,nresp=d.nao_respondidas||0,pend=d.com_pendencia||0
  const totalMsgs=(d.contatos||[]).reduce((acc,c)=>acc+(c.total_msgs_cliente||0),0)
  n('sTotal',conv);n('sResp',resp);n('sNResp',nresp);n('sMsgsTotal',totalMsgs);n('sPend',pend)
  const tma=fTMA(d.tma_segundos||0);document.getElementById('sTMA').textContent=tma
  const pico=d.hora_pico!==undefined?`${String(d.hora_pico).padStart(2,'0')}h`:'—'
  document.getElementById('sPico').textContent=pico
  document.getElementById('chipPico').textContent=d.hora_pico!==undefined?`pico ${pico}`:'—'
  document.getElementById('chipC').textContent=`${conv} conversa${conv!==1?'s':''}`
  /* progress bar: respondidas/total */
  const prog = document.getElementById('respProgress')
  if (prog) prog.style.width = (conv > 0 ? Math.round((resp/conv)*100) : 0) + '%'
  renderBars(d.por_hora||Array(24).fill(0),d.hora_pico)
  _allContatos = d.contatos||[]
  const filtered = applyTableFilters(_allContatos)
  renderTabela(filtered); renderUltList(d.contatos||[]); renderInstList(d.contatos||[])
  updateResultCount(filtered.length)
  /* atualizar contadores das pills de status */
  const all = _allContatos
  const sf = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v }
  sf('sfcTodos', all.length)
  sf('sfcResp',  all.filter(c => c.respondida && !c.tem_pendencia).length)
  sf('sfcPend',  all.filter(c => c.tem_pendencia).length)
  sf('sfcWait',  all.filter(c => !c.respondida && !c.tem_pendencia).length)
  /* skeleton → dados reais */
  document.getElementById('statsGrid')?.classList.add('loaded')
  /* pulse nos valores ao atualizar */
  document.querySelectorAll('.sc-val').forEach(el => {
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse')
  })
  /* deltas vs ontem */
  renderDeltas(d)
  /* badge na aba + sidebar */
  updateTabBadge(pend)
  updateChatBadge(pend)
}
/* ── ANIMATED COUNTER ── */
function animateCount(el, endVal, duration) {
  const startVal = parseFloat(el.textContent) || 0
  if (startVal === endVal) return
  const startTime = performance.now()
  function tick(now) {
    const t = Math.min((now - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    el.textContent = Math.round(startVal + (endVal - startVal) * eased)
    if (t < 1) requestAnimationFrame(tick)
    else el.textContent = endVal
  }
  requestAnimationFrame(tick)
}
function n(id,v){
  const el=document.getElementById(id);if(!el)return
  const numV=parseInt(v)
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reducedMotion && !isNaN(numV) && String(v)===String(numV)) {
    animateCount(el, numV, 700)
  } else {
    el.textContent=v
  }
  el.classList.add('bump');setTimeout(()=>el.classList.remove('bump'),280)
}
function corC(tel){if(!colorMap[tel]){colorMap[tel]=CORES[colorIdx[0]%CORES.length];colorIdx[0]++};return colorMap[tel]}

function renderUltList(contatos) {
  const el=document.getElementById('ultList'),chip=document.getElementById('chipUlt')
  if(!contatos||!contatos.length){el.innerHTML='<div class="empty"><div class="empty-txt">Nenhuma conversa</div></div>';if(chip)chip.textContent='0';return}
  const sorted=[...contatos].sort((a,b)=>{const ta=(a.mensagens||[]).slice(-1)[0]?.timestamp||'',tb=(b.mensagens||[]).slice(-1)[0]?.timestamp||'';return new Date(tb)-new Date(ta)})
  if(chip)chip.textContent=sorted.length
  el.innerHTML=sorted.map(c=>{
    const ultima=(c.mensagens||[]).slice(-1)[0]
    const hora=ultima?fH(ultima.timestamp):fH(c.primeira_msg_cliente?.horario||'')
    const txt=ultima?ultima.mensagem:(c.primeira_msg_cliente?.texto||'—')
    const isAtt=ultima&&['Atendente','atendente_ia','atendente_humano'].includes(ultima.nome)
    const badge=c.tem_pendencia?'<span class="ult-pend">Pendente</span>':'<span class="ult-resp">Respondida</span>'
    return `<div class="ult-item" onclick="abrirDrawer('${c.telefone}')">
      <div class="ult-top"><div class="ult-nome">${c.nome||'Desconhecido'}</div><div class="ult-hora">${hora}</div></div>
      <div class="ult-msg"><span style="font-size:9px;opacity:0.5;margin-right:3px">${isAtt?'← IA':'→'}</span>${txt}</div>
      ${badge}</div>`}).join('')
}
function hlText(text, q) {
  if (!q || !text) return text || ''
  const safe = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return String(text).replace(new RegExp(`(${safe})`, 'gi'), '<mark>$1</mark>')
}
function renderTabela(contatos) {
  const tb=document.getElementById('tbody')
  if(!contatos.length){
    const msg = _tableFilter
      ? `Nenhum resultado para "<strong>${_tableFilter}</strong>"`
      : (_statusFilter !== 'todos' ? 'Nenhuma conversa neste filtro' : 'Nenhuma conversa neste dia')
    tb.innerHTML=`<tr><td colspan="6"><div class="empty"><div class="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="11" y2="13"/></svg></div><div class="empty-txt">${msg}</div></div></td></tr>`
    renderPaginacao(0)
    return
  }
  const total = contatos.length
  const totalPags = Math.ceil(total / _PAGE_SIZE)
  if (_page > totalPags) _page = totalPags
  const inicio = (_page - 1) * _PAGE_SIZE
  const pagina = contatos.slice(inicio, inicio + _PAGE_SIZE)
  const copyIcon=`<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
  tb.innerHTML=pagina.map((c,idx)=>{
    const cor=corC(c.telefone)
    const rowDelay=`animation-delay:${idx*38}ms`
    const rowCls=c.tem_pendencia?'row-pend':c.respondida?'row-resp':'row-wait'
    return `<tr onclick="abrirDrawer('${c.telefone}')" class="${rowCls}" style="${rowDelay}">
      <td><div class="cwrap"><div class="av ${cor}">${(c.nome||'?')[0].toUpperCase()}</div><div><div class="cname">${hlText(c.nome||'Desconhecido',_tableFilter)}${c.tem_pendencia?` <svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:var(--rose);fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>`:''}</div><div class="cphone">${hlText(fTel(c.telefone),_tableFilter)}<button class="copy-btn" onclick="copyPhone(event,'${c.telefone}')" title="Copiar">${copyIcon}</button></div></div></div></td>
      <td><div class="mtxt">${c.primeira_msg_cliente?.texto||'—'}</div><div class="mhr">${fH(c.primeira_msg_cliente?.horario)}</div></td>
      <td><div class="mtxt">${c.primeira_msg_atendente?.texto||'—'}</div><div class="mhr">${c.primeira_msg_atendente?fH(c.primeira_msg_atendente.horario):'—'}</div></td>
      <td><span class="msgs-total">${(c.total_msgs_cliente||0)+(c.total_msgs_atendente||0)}</span></td>
      <td><span style="font-size:12px;font-weight:600;color:${c.turnos_pendentes>0?'var(--rose)':'var(--green)'}">${c.turnos_respondidos}/${c.total_turnos}</span></td>
      <td>${c.tem_pendencia
        ?`<span class="sbadge pend"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>Pendente</span>`
        :c.respondida
        ?`<span class="sbadge resp"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>Respondida</span>`
        :`<span class="sbadge wait"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Aguardando</span>`}</td>
    </tr>`}).join('')
  renderPaginacao(contatos.length)
}
function renderPaginacao(total) {
  const el = document.getElementById('tablePag'); if (!el) return
  const totalPags = Math.ceil(total / _PAGE_SIZE)
  if (totalPags <= 1) { el.style.display = 'none'; return }
  el.style.display = 'flex'
  const inicio = (_page - 1) * _PAGE_SIZE + 1
  const fim = Math.min(_page * _PAGE_SIZE, total)
  el.innerHTML = `
    <span class="pag-info">${inicio}–${fim} de ${total}</span>
    <div class="pag-btns">
      <button class="pag-btn" onclick="mudarPagDash(-1)" ${_page===1?'disabled':''}>‹</button>
      <span class="pag-cur">${_page} / ${totalPags}</span>
      <button class="pag-btn" onclick="mudarPagDash(1)" ${_page===totalPags?'disabled':''}>›</button>
    </div>`
}
function mudarPagDash(delta) {
  _page += delta
  const filtered = applyTableFilters(_allContatos)
  renderTabela(filtered)
  document.querySelector('.content')?.scrollTo({ top: 0, behavior: 'smooth' })
}
function teClass(seg){if(seg===null)return{cls:'none',label:'—'};const label=fTMA(seg);if(seg<=120)return{cls:'fast',label};if(seg<=300)return{cls:'mid',label};return{cls:'slow',label}}
function initBars(){const c=document.getElementById('bars');if(!c)return;c.innerHTML='';for(let h=0;h<24;h++){const w=document.createElement('div');w.className='bw';w.innerHTML=`<div class="bbar" id="bar-${h}" style="height:2px"></div><div class="blabel">${h%6===0?h+'h':''}</div>`;c.appendChild(w)}}
function renderBars(porHora,pico){const max=Math.max(...porHora,1);porHora.forEach((v,h)=>{const b=document.getElementById(`bar-${h}`);if(!b)return;b.style.height=Math.max(2,(v/max)*120)+'px';b.setAttribute('data-v',v);b.setAttribute('data-label',`${String(h).padStart(2,'0')}h · ${v} contato${v!==1?'s':''}`);b.className=h===pico?'bbar active':v>0?'bbar has-val':'bbar'})}
function renderInstList(contatos){const inst={};contatos.forEach(c=>{inst[c.instancia]=(inst[c.instancia]||0)+1});const el=document.getElementById('instList');if(!Object.keys(inst).length){el.innerHTML=`<div class="empty"><div class="empty-txt">Nenhuma instância</div></div>`;return};el.innerHTML=Object.entries(inst).map(([nm,t])=>`<div class="irow"><div class="iname"><div class="ipip"></div>${nm}</div><div class="icount">${t}</div></div>`).join('')}

function abrirDrawer(tel) {
  if(!cache)return; const d=cache.contatos.find(x=>x.telefone===tel); if(!d)return
  document.getElementById('dname').textContent=d.nome||'Desconhecido'; document.getElementById('dphone').textContent=fTel(tel)
  /* avatar */
  const dav=document.getElementById('dav')
  if(dav){dav.className=`dav ${corC(tel)}`;dav.textContent=(d.nome||'?')[0].toUpperCase();dav.style.display='flex'}
  /* quick stats */
  const dquick=document.getElementById('dquick')
  if(dquick){dquick.style.display='flex';dquick.innerHTML=`<div class="dqs"><div class="dqs-val">${d.total_msgs_cliente}</div><div class="dqs-lbl">Msgs cliente</div></div><div class="dqs"><div class="dqs-val">${d.total_msgs_atendente}</div><div class="dqs-lbl">Msgs atend.</div></div><div class="dqs"><div class="dqs-val">${d.total_turnos}</div><div class="dqs-lbl">Turnos</div></div><div class="dqs"><div class="dqs-val">${fTMA(d.tma_segundos)}</div><div class="dqs-lbl">TMA</div></div>`}
  const resumo=`<div class="dresume"><div class="dresume-title">Resumo</div>
    <div class="dresume-row"><span class="dresume-label">Primeiro contato</span><span class="dresume-val">${fH(d.primeira_msg_cliente?.horario)}</span></div>
    <div class="dresume-row"><span class="dresume-label">Primeira resposta</span><span class="dresume-val">${d.primeira_msg_atendente?fH(d.primeira_msg_atendente.horario):'—'}</span></div>
    <div class="dresume-row"><span class="dresume-label">Tempo de espera</span><span class="dresume-val ${d.respondida?teClass(d.tempo_espera_segundos).cls:'none'} tespera">${d.respondida?fTMA(d.tempo_espera_segundos):'—'}</span></div>
    <div class="dresume-row"><span class="dresume-label">Msgs cliente / atendente</span><span class="dresume-val">${d.total_msgs_cliente} / ${d.total_msgs_atendente}</span></div>
    <div class="dresume-row"><span class="dresume-label">Turnos respondidos</span><span class="dresume-val">${d.turnos_respondidos}/${d.total_turnos}</span></div>
    <div class="dresume-row"><span class="dresume-label">Turnos pendentes</span><span class="dresume-val" style="color:${d.turnos_pendentes>0?'var(--rose)':'var(--green)'}">${d.turnos_pendentes}</span></div>
    <div class="dresume-row"><span class="dresume-label">TMA</span><span class="dresume-val">${fTMA(d.tma_segundos)}</span></div>
    <div class="dresume-row"><span class="dresume-label">Status</span><span class="dresume-val" style="color:${d.tem_pendencia?'var(--rose)':d.respondida?'var(--green)':'var(--amber)'}">${d.tem_pendencia?'Pendente':d.respondida?'Respondida':'Aguardando'}</span></div>
  </div>`
  let ti=0
  const timeline=(d.turnos||[]).map(t=>{ti++;const ok=t.respondido;const tMsgs=[...t.msgs_cliente,...(t.resposta?[t.resposta]:[])]
    const tempoLabel=ok&&t.tempo_espera_segundos!=null?`<span>${fTMA(t.tempo_espera_segundos)}</span>`:ok?'':'<span>sem resposta</span>'
    return `<div class="dturn">
      <div class="dturn-dot ${ok?'ok':'err'}"></div>
      <div class="dturn-head">
        <span class="dturn-badge ${ok?'ok':'err'}">Turno ${ti}${tempoLabel}</span>
      </div>
      <div class="dmsg-wrap">
        ${tMsgs.map(m=>{const isAtt=['Atendente','atendente_ia','atendente_humano'].includes(m.nome);const side=isAtt?'atendente':'cliente';const who=isAtt?(m.nome==='atendente_humano'?'Humano':'IA'):m.nome||'Cliente';return `<div class="dmsg ${side}"><div class="dmsg-header"><span class="dmsg-who ${side}">${who}</span><span class="dmsg-hr">${fH(m.timestamp)}</span></div><div class="dmsg-txt">${m.mensagem||'—'}</div></div>`}).join('')}
      </div>
    </div>`}).join('')
  document.getElementById('dbody').innerHTML=resumo+timeline
  document.getElementById('drawer').classList.add('open'); document.getElementById('overlay').classList.add('show')
}
function fecharDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('overlay').classList.remove('show')}

/* ── TABLE SEARCH, SORT, DENSITY ── */
function applyTableFilters(list) {
  let out = list
  if (_statusFilter !== 'todos') {
    if (_statusFilter === 'pend') out = out.filter(c => c.tem_pendencia)
    else if (_statusFilter === 'resp') out = out.filter(c => c.respondida && !c.tem_pendencia)
    else if (_statusFilter === 'wait') out = out.filter(c => !c.respondida && !c.tem_pendencia)
  }
  if (_tableFilter) {
    const q = _tableFilter
    out = out.filter(c => (c.nome||'').toLowerCase().includes(q) || String(c.telefone||'').includes(q))
  }
  if (_sortCol >= 0) {
    out = [...out].sort((a, b) => {
      let va, vb
      switch(_sortCol) {
        case 0: va=(a.nome||'').toLowerCase(); vb=(b.nome||'').toLowerCase(); break
        case 1: va=a.primeira_msg_cliente?.horario||''; vb=b.primeira_msg_cliente?.horario||''; break
        case 2: va=a.primeira_msg_atendente?.horario||''; vb=b.primeira_msg_atendente?.horario||''; break
        case 3: va=(a.total_msgs_cliente||0)+(a.total_msgs_atendente||0); vb=(b.total_msgs_cliente||0)+(b.total_msgs_atendente||0); break
        case 4: va=a.total_turnos||0; vb=b.total_turnos||0; break
        case 5: va=a.tem_pendencia?2:a.respondida?0:1; vb=b.tem_pendencia?2:b.respondida?0:1; break
        default: return 0
      }
      return _sortDir * (va > vb ? 1 : va < vb ? -1 : 0)
    })
  }
  return out
}
function filterTable(q) {
  clearTimeout(_searchTimer)
  _searchTimer = setTimeout(() => {
    _tableFilter = q.toLowerCase().trim()
    _page = 1
    const filtered = applyTableFilters(_allContatos)
    renderTabela(filtered)
    updateResultCount(filtered.length)
  }, 250)
}
function updateResultCount(shown) {
  const el = document.getElementById('resultCount')
  if (!el) return
  const active = _tableFilter || _statusFilter !== 'todos'
  if (active && _allContatos.length > 0) {
    el.textContent = `${shown} / ${_allContatos.length}`
    el.style.display = 'inline'
  } else {
    el.style.display = 'none'
  }
}
function toggleDensity() {
  _dense = !_dense
  const tbl = document.getElementById('mainTable')
  if (tbl) tbl.classList.toggle('dense', _dense)
  const btn = document.getElementById('densityBtn')
  if (btn) btn.classList.toggle('dense-on', _dense)
  localStorage.setItem('density', _dense ? '1' : '0')
}
function restoreDensity() {
  if (localStorage.getItem('density') === '1') {
    _dense = true
    const tbl = document.getElementById('mainTable')
    if (tbl) tbl.classList.add('dense')
    const btn = document.getElementById('densityBtn')
    if (btn) btn.classList.add('dense-on')
  }
}
function initSortableHeaders() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = parseInt(th.dataset.col)
      if (_sortCol === col) { _sortDir = -_sortDir }
      else { _sortCol = col; _sortDir = 1 }
      document.querySelectorAll('th.sortable').forEach(h => h.classList.remove('sort-asc','sort-desc'))
      th.classList.add(_sortDir === 1 ? 'sort-asc' : 'sort-desc')
      renderTabela(applyTableFilters(_allContatos))
    })
  })
}
function copyPhone(e, tel) {
  e.stopPropagation()
  const clean = String(tel||'').replace(/\D/g,'')
  if (navigator.clipboard) {
    navigator.clipboard.writeText('+' + clean).then(() => showToast('Telefone copiado', 'ok'))
  }
}

/* ── STATUS FILTER ── */
function setStatusFilter(sf) {
  _statusFilter = sf; _page = 1
  document.querySelectorAll('.sf-pill').forEach(p => p.classList.toggle('active', p.dataset.sf === sf))
  /* highlight card ativo */
  document.querySelectorAll('.sc').forEach(c => c.classList.remove('card-filter-on'))
  const cardMap = { resp:'sResp', pend:'sPend', wait:'sNResp' }
  if (sf !== 'todos' && cardMap[sf]) {
    const el = document.getElementById(cardMap[sf])?.closest('.sc')
    if (el) el.classList.add('card-filter-on')
  }
  const filtered = applyTableFilters(_allContatos)
  renderTabela(filtered)
  updateResultCount(filtered.length)
}

/* ── CARD CLICK → FILTRO ── */
function initCardFilters() {
  const cardMap = { sTotal:'todos', sResp:'resp', sNResp:'wait', sPend:'pend' }
  Object.entries(cardMap).forEach(([id, sf]) => {
    const el = document.getElementById(id)
    if (!el) return
    const card = el.closest('.sc')
    if (card) card.addEventListener('click', (e) => {
      if (e.target.closest('.copy-btn')) return
      setStatusFilter(sf)
    })
  })
}

/* ── EXPORT CSV ── */
function exportCSV() {
  const list = applyTableFilters(_allContatos)
  if (!list.length) { showToast('Nenhum dado para exportar', 'err'); return }
  const heads = ['Nome','Telefone','1ª Msg','1ª Resposta','Msgs Cliente','Msgs Atendente','Turnos','TMA','Status']
  const rows = list.map(c => [
    c.nome||'Desconhecido',
    fTel(c.telefone),
    fH(c.primeira_msg_cliente?.horario),
    c.primeira_msg_atendente ? fH(c.primeira_msg_atendente.horario) : '—',
    c.total_msgs_cliente,
    c.total_msgs_atendente,
    `${c.turnos_respondidos}/${c.total_turnos}`,
    fTMA(c.tma_segundos),
    c.tem_pendencia ? 'Pendente' : c.respondida ? 'Respondida' : 'Aguardando'
  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
  const csv = [heads.join(','), ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `atendimento_${dataAtual}.csv`
  a.click(); URL.revokeObjectURL(url)
  showToast(`${list.length} registros exportados`, 'ok')
}
function conectarSSE(){try{const es=new EventSource(`${API}/stream`);es.onmessage=()=>{carregar();showToast('Nova mensagem recebida','info')};es.onerror=()=>setTimeout(conectarSSE,5000)}catch{}}
function fH(ts){if(!ts)return'—';return new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function fTel(tel){const t=String(tel||'').replace(/\D/g,'');if(t.length>=12)return`+${t.slice(0,2)} (${t.slice(2,4)}) ${t.slice(4,9)}-${t.slice(9)}`;return tel}
function fTMA(seg){if(!seg&&seg!==0)return'—';if(seg<60)return`${seg}s`;const m=Math.floor(seg/60),s=seg%60;return s>0?`${m}m ${s}s`:`${m}m`}

;(function(){
  const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {}
  const logoArea = document.getElementById('logoArea')
  if (logoArea && cfg.empresa) {
    const hasLogo = cfg.logo_url && cfg.logo_url.trim()
    logoArea.innerHTML = `
      <div class="sidebar-logo">${hasLogo?`<img src="${cfg.logo_url}" alt="${cfg.empresa}">`:cfg.logo_emoji||'💬'}</div>
      <div>
        <div class="sidebar-brand-name">${cfg.empresa}</div>
        <div class="sidebar-brand-slug">${cfg.slogan||'Painel'}</div>
      </div>`
  }
  if (cfg.cores) {
    const r = document.documentElement
    if (cfg.cores.primaria)   { r.style.setProperty('--green',cfg.cores.primaria); r.style.setProperty('--green2',cfg.cores.primaria) }
    if (cfg.cores.secundaria) r.style.setProperty('--rose',cfg.cores.secundaria)
    if (cfg.cores.terciaria)  r.style.setProperty('--amber',cfg.cores.terciaria)
  }
})()

function toggleSidebar() {
  const sb = document.getElementById('sidebar')
  const ov = document.getElementById('sidebarOverlay')
  const open = document.getElementById('menuIconOpen')
  const close = document.getElementById('menuIconClose')
  const isOpen = sb.classList.toggle('open')
  ov.classList.toggle('show', isOpen)
  if (open)  open.style.display  = isOpen ? 'none'  : 'block'
  if (close) close.style.display = isOpen ? 'block' : 'none'
}
