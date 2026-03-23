const API = window.location.port === '3001' || window.location.hostname === 'localhost' ? 'http://localhost:3001' : ''
function dHoje() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) }
const _params = new URLSearchParams(window.location.search)
let dataAtual = _params.get('data') || dHoje()
let instAtual = _params.get('instancia') || null
let _ontemResumo = null
let _calData = {}

function setDateLabel(d) { const [y,m,dia]=d.split('-'); document.getElementById('dlabel').textContent=`${dia}/${m}/${y}`; document.getElementById('dpick').value=d }
function mudarDia(delta) { const dt=new Date(dataAtual+'T12:00:00'); dt.setDate(dt.getDate()+delta); dataAtual=dt.toISOString().split('T')[0]; setDateLabel(dataAtual); carregarComInstancias() }
function irData(v) { if(!v)return; dataAtual=v; setDateLabel(v); carregarComInstancias() }
function irHoje() { dataAtual=dHoje(); setDateLabel(dataAtual); carregarComInstancias() }
function trocarInstancia(v) { instAtual=v; renderInstBar(_instancias); carregar() }
function renderInstBar(lista) {
  document.getElementById('instBar').innerHTML = lista
    .map(i=>`<button class="itab ${instAtual===i?'active':''}" onclick="trocarInstancia('${i}')"><div class="itab-dot"></div>${i}</button>`)
    .join('')
}

let _instancias = []
async function carregarComInstancias() {
  try {
    const r = await fetch(`${API}/relatorio-instancias?data=${dataAtual}`)
    const { instancias } = await r.json()
    _instancias = instancias
    const wrap = document.getElementById('instWrap')
    if (instancias.length > 0) {
      if (!instancias.includes(instAtual)) instAtual = instancias[0]
      renderInstBar(instancias)
      wrap.style.display = 'flex'
    } else {
      instAtual = null
      wrap.style.display = 'none'
    }
  } catch { instAtual = null; _instancias = [] }
  carregar()
}

async function carregar() {
  const el=document.getElementById('conteudo')
  el.innerHTML=`<div class="page-loading"><div class="ldot"></div><div class="ldot"></div><div class="ldot"></div> Carregando relatório...</div>`
  // Busca ontem para comparativo em paralelo
  const ontemDate = new Date(dataAtual+'T12:00:00'); ontemDate.setDate(ontemDate.getDate()-1)
  const ontemStr = ontemDate.toISOString().split('T')[0]
  const qs = instAtual ? `data=${dataAtual}&instancia=${encodeURIComponent(instAtual)}` : `data=${dataAtual}`
  const qsOntem = instAtual ? `data=${ontemStr}&instancia=${encodeURIComponent(instAtual)}` : `data=${ontemStr}`
  try {
    const [rHoje, rOntem] = await Promise.allSettled([
      fetch(`${API}/relatorio-ia?${qs}`),
      fetch(`${API}/relatorio-ia?${qsOntem}`)
    ])
    if (rHoje.status==='rejected'||!rHoje.value.ok) throw new Error()
    _ontemResumo = rOntem.status==='fulfilled'&&rOntem.value.ok ? (await rOntem.value.json()).resumo||null : null
    renderRelatorio(await rHoje.value.json())
    carregarCalendario()
    carregarHorario()
  } catch {
    _ontemResumo = null
    el.innerHTML=`<div class="page-empty"><div class="page-empty-icon">📭</div><div class="page-empty-title">Nenhum relatório para este dia</div><div class="page-empty-sub">O relatório é gerado automaticamente às 20h</div></div>`
    carregarCalendario()
  }
}

/* ── CALENDÁRIO 7 DIAS ── */
const DIAS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
async function carregarCalendario() {
  const dias = []
  for (let i=6; i>=0; i--) {
    const d=new Date(dataAtual+'T12:00:00'); d.setDate(d.getDate()-i)
    dias.push(d.toISOString().split('T')[0])
  }
  const results = await Promise.allSettled(dias.map(async d => {
    const qs = instAtual ? `data=${d}&instancia=${encodeURIComponent(instAtual)}` : `data=${d}`
    const r = await fetch(`${API}/relatorio-ia?${qs}`)
    if (!r.ok) return { data: d, score: 'none' }
    const json = await r.json()
    const rs = json.resumo||{}
    const pS=rs.percentual_sem_resposta||0, pF=rs.percentual_finalizadas||0
    return { data: d, score: pS>40||pF<30?'critico':pS>20||pF<60?'atencao':'bom' }
  }))
  _calData = {}
  results.forEach(r => { if (r.status==='fulfilled'&&r.value) _calData[r.value.data]=r.value })
  renderCalendario(dias)
}
function renderCalendario(dias) {
  const dotColor = {bom:'var(--green)',atencao:'var(--amber)',critico:'var(--rose)',none:'var(--border)'}
  document.getElementById('calStrip').innerHTML = dias.map(d => {
    const info=_calData[d], score=info?.score||'none'
    const [,m,dia]=d.split('-')
    const dow = DIAS_PT[new Date(d+'T12:00:00').getDay()]
    return `<button class="cal-day ${d===dataAtual?'active':''}" onclick="irData('${d}')">
      <span class="cal-dot" style="background:${dotColor[score]}"></span>
      <span class="cal-lbl">${dia}/${m}</span>
      <span class="cal-day-name">${dow}</span>
    </button>`
  }).join('')
}

/* ── HORÁRIO DE PICO ── */
async function carregarHorario() {
  const el = document.getElementById('horaPicoBody')
  if (!el) return
  try {
    const qs = instAtual ? `data=${dataAtual}&instancia=${encodeURIComponent(instAtual)}` : `data=${dataAtual}`
    const r = await fetch(`${API}/stats-horario?${qs}`)
    if (!r.ok) throw new Error()
    const { por_hora } = await r.json()
    const total = por_hora.reduce((a,b)=>a+b,0)
    if (total===0) { el.innerHTML=`<div class="hpico-empty">Sem dados de horário para este dia</div>`; return }
    const max = Math.max(...por_hora,1)
    const pico = por_hora.indexOf(Math.max(...por_hora))
    const horas = por_hora.map((v,i)=>({h:i,v})).filter(({h,v})=>v>0||(h>=7&&h<=21))
    el.innerHTML=`<div class="hpico-wrap"><div class="hpico-chart">${horas.map(({h,v})=>`<div class="hpico-col${h===pico&&v>0?' pico':''}">
      ${v>0?`<span class="hpico-val">${v}</span>`:'<span class="hpico-val" style="opacity:0">0</span>'}
      <div class="hpico-bar" style="height:${Math.max(Math.round((v/max)*60),v>0?4:2)}px"></div>
      <span class="hpico-lbl">${String(h).padStart(2,'0')}h</span>
    </div>`).join('')}</div></div>`
  } catch { el.innerHTML=`<div class="hpico-empty">Não foi possível carregar</div>` }
}

/* ── DELTA VS ONTEM ── */
function delta(cur, prev, maiorEBom=true) {
  if (prev==null||prev===0&&cur===0) return ''
  const d=cur-prev; if(d===0) return ''
  const up=d>0, good=maiorEBom?up:!up
  const cls=up?(good?'up-good':'up-bad'):(good?'dn-good':'dn-bad')
  return `<span class="delta ${cls}">${up?'↑':'↓'}${Math.abs(d)}</span>`
}

/* ── COPIAR LINK ── */
function copiarLink() {
  const url=new URL(window.location.href)
  url.searchParams.set('data',dataAtual)
  if(instAtual) url.searchParams.set('instancia',instAtual)
  navigator.clipboard.writeText(url.toString()).then(()=>showToast('Link copiado!','ok')).catch(()=>showToast('Erro ao copiar','err'))
}

function renderRelatorio(d) {
  const r=d.resumo||{}, h=d.horarios||{}, recl=d.reclamacoes||[], mel=d.pontos_melhoria||[]
  const gravCls=g=>({'ALTA':'alta','MEDIA':'media','BAIXA':'baixa'})[g?.toUpperCase()]||'baixa'
  const chevron=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`

  // Score geral
  const pSem=r.percentual_sem_resposta||0, pFin=r.percentual_finalizadas||0
  const score = pSem>40||pFin<30 ? 'critico' : pSem>20||pFin<60 ? 'atencao' : 'bom'
  const scoreLbl = {critico:'Crítico',atencao:'Atenção',bom:'Bom'}[score]

  // TMA color
  const tma=r.tma_minutos||0
  const tmaCls = tma<=10 ? 'tma-ok' : tma<=30 ? 'tma-warn' : 'tma-crit'
  const tmaNote = tma<=10 ? '· dentro do ideal' : tma<=30 ? '· atenção ao tempo' : '· acima do recomendado'

  // Data formatada
  const [ay,am,ad]=(dataAtual||'').split('-')
  const dataFmt=`${ad||'--'}/${am||'--'}/${ay||'----'}`

  const secHeader=`<div class="rep-header">
    <div>
      <div class="rep-empresa">${d.empresa||instAtual||'Relatório'}</div>
      <div class="rep-data">${dataFmt}</div>
    </div>
    <span class="score-badge ${score}"><span class="score-dot"></span>${scoreLbl}</span>
  </div>`

  const secAlerta = pSem>30 ? `<div class="alert-banner">
    <span class="alert-icon">⚠️</span>
    <div><div class="alert-txt">${pSem}% das conversas ficaram sem resposta</div><div class="alert-sub">${r.sem_resposta||0} de ${r.total_conversas||0} atendimentos não foram respondidos no dia.</div></div>
  </div>` : ''

  const o=_ontemResumo
  const secResumo=`<div class="section" style="transition-delay:0ms">
    <div class="section-head"><div style="display:flex;align-items:center"><div class="section-num">01</div><div class="section-title">Resumo Executivo</div></div>${o?`<span style="font-size:10px;color:var(--ink4)">vs ontem</span>`:''}</div>
    <div class="section-body">
      <div class="exec-grid">
        <div class="exec-card"><div class="exec-card-top">Total</div><div class="exec-card-val">${r.total_conversas||0}${delta(r.total_conversas||0,o?.total_conversas,true)}</div><div class="exec-card-lbl">conversas no dia</div></div>
        <div class="exec-card fin"><div class="exec-card-top">Finalizadas</div><div class="exec-card-val">${r.finalizadas||0}${delta(r.finalizadas||0,o?.finalizadas,true)}</div><div class="exec-card-pct">${pFin}%</div><div class="exec-card-lbl">concluídas</div></div>
        <div class="exec-card and"><div class="exec-card-top">Em andamento</div><div class="exec-card-val">${r.em_andamento||0}${delta(r.em_andamento||0,o?.em_andamento,false)}</div><div class="exec-card-pct">${r.percentual_em_andamento||0}%</div><div class="exec-card-lbl">em progresso</div></div>
        <div class="exec-card sem"><div class="exec-card-top">Sem resposta</div><div class="exec-card-val">${r.sem_resposta||0}${delta(r.sem_resposta||0,o?.sem_resposta,false)}</div><div class="exec-card-pct">${pSem}%</div><div class="exec-card-lbl">não atendidas</div></div>
      </div>
      <div class="exec-progress">
        <div class="ep-seg fin" style="width:${pFin}%"></div>
        <div class="ep-seg and" style="width:${r.percentual_em_andamento||0}%"></div>
        <div class="ep-seg sem" style="width:${pSem}%"></div>
      </div>
      <div class="tma-card ${tmaCls}"><div class="tma-icon">⏱</div><div><div class="tma-val">${tma} min</div><div class="tma-lbl">Tempo médio por atendimento ${tmaNote}</div></div></div>
    </div></div>`

  const secHorarios=`<div class="section" style="transition-delay:80ms">
    <div class="section-head"><div style="display:flex;align-items:center"><div class="section-num">02</div><div class="section-title">Horários de Operação</div></div></div>
    <div class="section-body"><div class="hor-grid">
      <div class="hor-card"><div class="hor-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg></div><div><div class="hor-lbl">Primeira mensagem recebida</div><div class="hor-time">${h.primeira_msg_cliente_hora||'—'}</div><div class="hor-nome">${h.primeira_msg_cliente_nome||''}</div></div></div>
      <div class="hor-card"><div class="hor-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div><div><div class="hor-lbl">Primeira resposta da equipe</div><div class="hor-time">${h.primeira_resposta_hora||'—'}</div></div></div>
      <div class="hor-card"><div class="hor-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg></div><div><div class="hor-lbl">Última mensagem recebida</div><div class="hor-time">${h.ultima_msg_cliente_hora||'—'}</div><div class="hor-nome">${h.ultima_msg_cliente_nome||''}</div></div></div>
      <div class="hor-card"><div class="hor-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div><div><div class="hor-lbl">Última resposta da equipe</div><div class="hor-time">${h.ultima_resposta_hora||'—'}</div></div></div>
    </div></div></div>`

  const secPico=`<div class="section" style="transition-delay:140ms">
    <div class="section-head"><div style="display:flex;align-items:center"><div class="section-num">03</div><div class="section-title">Pico de Atendimento</div></div></div>
    <div class="section-body" id="horaPicoBody"><div class="page-loading"><div class="ldot"></div><div class="ldot"></div><div class="ldot"></div></div></div></div>`

  const secRecl=`<div class="section" style="transition-delay:180ms">
    <div class="section-head"><div style="display:flex;align-items:center"><div class="section-num">04</div><div class="section-title">Reclamações e Críticas</div></div>${recl.length>0?`<span style="font-family:'Cascadia Code',Consolas,monospace;font-size:10px;color:var(--rose);font-weight:600">${recl.length} registro${recl.length>1?'s':''}</span>`:''}</div>
    <div class="section-body">${recl.length===0
      ?`<div class="recl-empty"><div class="recl-empty-icon">✅</div><div class="recl-empty-txt">Nenhuma reclamação registrada no período</div></div>`
      :`<div class="recl-grid">${recl.map(rc=>{const gc=gravCls(rc.gravidade);return`<div class="recl-card ${gc}"><div class="recl-card-head"><span class="recl-badge ${gc}">${rc.gravidade}</span><span class="recl-num">#${rc.numero}</span></div><div class="recl-card-body"><div class="recl-nome">${rc.cliente||'—'}</div><div class="recl-tel">${rc.telefone||''}</div><div class="recl-resumo">${rc.resumo||''}</div></div></div>`}).join('')}</div>`}
    </div></div>`

  const secMel=`<div class="section" style="transition-delay:220ms">
    <div class="section-head"><div style="display:flex;align-items:center"><div class="section-num">05</div><div class="section-title">Pontos de Melhoria</div></div></div>
    <div class="section-body">${mel.length===0
      ?`<div class="recl-empty"><div class="recl-empty-icon">✅</div><div class="recl-empty-txt">Atendimento dentro dos padrões de qualidade</div></div>`
      :`<div class="melhoria-list">${mel.map((m,i)=>`<div class="melhoria-card" id="mel${i}">
        <div class="melhoria-head" onclick="toggleMel(${i})">
          <div class="melhoria-idx">${i+1}</div>
          <div class="melhoria-titulo">${m.titulo||''}</div>
          ${(m.exemplos||[]).length?`<span class="melhoria-count">${(m.exemplos||[]).length} ex.</span>`:''}
          <div class="melhoria-toggle">${chevron}</div>
        </div>
        <div class="melhoria-desc">${m.descricao||''}</div>
        <div class="melhoria-exemplos">${(m.exemplos||[]).map(e=>`<div class="exemplo-card"><div class="exemplo-head"><div><div class="exemplo-cliente">${e.cliente||'—'}</div><div class="exemplo-tel">${e.telefone||''}</div></div><div class="exemplo-hora">${e.horario||''}</div></div><div class="exemplo-msg">"${e.mensagem||''}"</div>${e.contexto?`<div class="exemplo-ctx">${e.contexto}</div>`:''}</div>`).join('')}</div>
      </div>`).join('')}</div>`}
    </div></div>`

  const secObs = d.observacoes ? `<div class="section" style="transition-delay:260ms"><div class="section-head"><div style="display:flex;align-items:center"><div class="section-num">06</div><div class="section-title">Observações Gerais</div></div></div><div class="section-body"><div class="obs-card"><div class="obs-txt">${d.observacoes}</div></div></div></div>` : ''

  const footer=`<div class="report-footer"><div class="footer-brand">Relatório gerado por <span>${d.empresa||instAtual||''}</span></div><div class="footer-date">${dataAtual}</div></div>`

  document.getElementById('conteudo').innerHTML = secHeader+secAlerta+secResumo+secHorarios+secPico+secRecl+secMel+secObs+footer
}

function toggleMel(i) {
  document.getElementById('mel'+i)?.classList.toggle('open')
}

;(function(){
  setDateLabel(dataAtual); carregarComInstancias()
})()
