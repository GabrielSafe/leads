const API = window.location.port === '3001' || window.location.hostname === 'localhost' ? 'http://localhost:3001' : ''
const POR_PAGINA = 20
const CORES = ['#25d366','#53bdeb','#f5a623','#f15c6d','#bf59cf','#00a884','#0288d1','#e91e8c']
const colorMap = {}
let todosContatos = [], filtrados = [], paginaAtual = 1, filtroIA = 'todos', _filtrarTimer = null

function corC(tel) { if (!colorMap[tel]) colorMap[tel] = CORES[Object.keys(colorMap).length % CORES.length]; return colorMap[tel] }
function inicial(nome) { if (!nome) return '?'; return nome.trim().split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase() }
function fData(ts) { if (!ts) return '—'; return new Date(ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}) }
function fHora(ts) { if (!ts) return ''; return new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) }

async function carregar() {
  try {
    const r = await fetch(`${API}/contatos`); if (!r.ok) throw new Error()
    const data = await r.json(); todosContatos = data.contatos || []
    setStatus(true); filtrar()
  } catch {
    setStatus(false)
    document.getElementById('tableWrap').innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-txt">Não foi possível carregar</div></div>`
  }
}

function filtrar() {
  clearTimeout(_filtrarTimer)
  _filtrarTimer = setTimeout(_filtrarExec, 250)
}
function _filtrarExec() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim()
  let base = filtroIA==='ativa' ? todosContatos.filter(c=>!c.ia||c.ia==='sim')
           : filtroIA==='pausada' ? todosContatos.filter(c=>c.ia==='nao')
           : [...todosContatos]
  filtrados = q ? base.filter(c=>(c.nome||'').toLowerCase().includes(q)||(c.telefone||'').includes(q)) : base
  filtrados.sort((a,b)=>new Date(b.primeiro_contato||0)-new Date(a.primeiro_contato||0))
  paginaAtual = 1; renderTabela()
}

function renderTabela() {
  const total = filtrados.length, totalPags = Math.ceil(total/POR_PAGINA)
  const inicio = (paginaAtual-1)*POR_PAGINA, pagina = filtrados.slice(inicio, inicio+POR_PAGINA)
  const instancias = new Set(todosContatos.map(c=>c.instancia).filter(Boolean))
  const iaSim = todosContatos.filter(c=>!c.ia||c.ia==='sim').length
  const iaNao = todosContatos.filter(c=>c.ia==='nao').length
  const se = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v }
  se('statTotal',todosContatos.length); se('statIASim',iaSim); se('statIANao',iaNao)
  se('chipTotal',`${total} contato${total!==1?'s':''}`)
  if (!pagina.length) {
    document.getElementById('tableWrap').innerHTML = `<div class="empty"><div class="empty-icon">👤</div><div class="empty-txt">Nenhum contato encontrado</div></div>`
    document.getElementById('paginacao').style.display = 'none'; return
  }
  document.getElementById('tableWrap').innerHTML = `<div class="twrap"><table>
    <thead><tr><th>Contato</th><th>Primeiro contato</th><th>Primeira mensagem</th><th>Msgs</th><th>Instância</th><th>IA</th></tr></thead>
    <tbody>${pagina.map((c,idx)=>`<tr style="animation-delay:${idx*38}ms">
      <td><div class="contact-cell"><div class="avatar" style="background:${corC(c.telefone)}">${inicial(c.nome)}</div><div><div class="contact-name">${c.nome||'Desconhecido'}</div><div class="contact-phone">${c.telefone||''}</div></div></div></td>
      <td><div class="date-cell">${fData(c.primeiro_contato)}</div><div style="font-family:'Cascadia Code',Consolas,'Courier New',monospace;font-size:10px;color:var(--ink4);margin-top:1px">${fHora(c.primeiro_contato)}</div></td>
      <td><div class="first-msg" title="${c.primeira_mensagem||''}">${c.primeira_mensagem||'—'}</div></td>
      <td><span class="msgs-badge">${c.total_mensagens||0}</span></td>
      <td><span class="inst-tag">${c.instancia||'—'}</span></td>
      <td><span class="ia-badge ${c.ia==='nao'?'pausada':'ativa'}">${c.ia==='nao'?'⏸ Pausada':'▶ Ativa'}</span></td>
    </tr>`).join('')}</tbody>
  </table></div>`
  const pag = document.getElementById('paginacao')
  if (totalPags>1) {
    pag.style.display='flex'
    se('pageInfo',`${inicio+1}–${Math.min(inicio+POR_PAGINA,total)} de ${total}`)
    document.getElementById('btnPrev').disabled = paginaAtual===1
    document.getElementById('btnNext').disabled = paginaAtual===totalPags
  } else { pag.style.display='none' }
}

function mudarPagina(delta) { paginaAtual+=delta; renderTabela(); window.scrollTo({top:0,behavior:'smooth'}) }
function setFiltroIA(f) { filtroIA=f; ['Todos','Ativa','Pausada'].forEach(n=>document.getElementById('filtro'+n)?.classList.toggle('active',f===n.toLowerCase())); document.getElementById('filtroTodos').classList.toggle('active',f==='todos'); if(todosContatos.length) filtrar() }
function setStatus(ok) { const pill=document.getElementById('statusPill'),dot=document.getElementById('sdot'),txt=document.getElementById('stxt'); if(ok){pill.className='status-pill live';dot.className='dot live';txt.textContent='Ao vivo'}else{pill.className='status-pill dead';dot.className='dot dead';txt.textContent='Offline'} }
function exportarExcel() {
  if (!filtrados.length) return
  const bom='\uFEFF', header=['Nome','Telefone','Instancia','Primeiro Contato','Primeira Mensagem','Total Mensagens']
  const rows=filtrados.map(c=>[c.nome||'', "'"+( c.telefone||''), c.instancia||'', c.primeiro_contato?new Date(c.primeiro_contato).toLocaleString('pt-BR'):'', (c.primeira_mensagem||'').replace(/"/g,'""'), c.total_mensagens||0].map(v=>'"'+v+'"').join(';'))
  const csv=bom+[header.join(';'),...rows].join('\n')
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}), url=URL.createObjectURL(blob), a=document.createElement('a')
  a.href=url; a.download='contatos_'+new Date().toISOString().split('T')[0]+'.csv'; a.click(); URL.revokeObjectURL(url)
}
;(function(){
  carregar(); setInterval(carregar,60000)
})()

async function resetarIA() {
  const pausadas = todosContatos.filter(c => c.ia === 'nao').length
  if (!pausadas) { showToast('Nenhum contato com IA pausada', 'success'); return }
  if (!confirm(`Reativar IA para ${pausadas} contato${pausadas !== 1 ? 's' : ''} pausado${pausadas !== 1 ? 's' : ''}?`)) return
  const btn = document.getElementById('resetBtn')
  btn.disabled = true
  try {
    const r = await fetch(`${API}/resetar-ia`, { method: 'POST' })
    const d = await r.json()
    if (d.ok) {
      showToast(`✓ IA reativada para ${d.resetados} contato${d.resetados !== 1 ? 's' : ''}`, 'success')
      setTimeout(carregar, 800)
    } else { showToast('Erro ao resetar', 'error') }
  } catch { showToast('Erro de conexão', 'error') }
  btn.disabled = false
}
