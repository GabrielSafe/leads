const express = require('express')
const Redis = require('ioredis')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

// Serve static HTML files
app.use(express.static(__dirname + '/public'))
app.get('/', (req, res) => res.redirect('/dashboard-leads.html'))

const redisConfig = {
  host: process.env.REDIS_HOST || '172.17.0.2',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: t => Math.min(t*500, 3000)
}
const redisContatos   = new Redis({ ...redisConfig, db: 0 })
const redisMensagens  = new Redis({ ...redisConfig, db: 1 })
const redisRelatorios = new Redis({ ...redisConfig, db: 2 })

redisContatos.on('connect',   () => console.log('✅ Redis db0 conectado (contatos)'))
redisMensagens.on('connect',  () => console.log('✅ Redis db1 conectado (mensagens)'))
redisRelatorios.on('connect', () => console.log('✅ Redis db2 conectado (relatórios)'))

function hoje() { return new Date().toISOString().split('T')[0] }
function isAtendente(nome) { return nome === 'Atendente' || nome === 'atendente_ia' || nome === 'atendente_humano' }
function mesmaData(ts, data) { return ts && ts.split('T')[0] === data }

// BUFF_WINDOW: janela de tolerância do buff de mensagens (10s)
// BUFF_WINDOW: 10s de tolerância para o buff de mensagens do cliente
const BUFF_WINDOW_MS = 10 * 1000

function calcularTurnos(msgs) {
  const msgsCliente   = msgs.filter(m => !isAtendente(m.nome))
  const msgsAtendente = msgs.filter(m => isAtendente(m.nome))

  // PASSAGEM 1: agrupa msgs do cliente em blocos contíguos (dentro de BUFF_WINDOW)
  // Cada bloco representa um "turno" do cliente
  const blocos = []
  for (const msg of msgsCliente) {
    const ts = new Date(msg.timestamp).getTime()
    const ultimo = blocos[blocos.length - 1]
    if (ultimo && (ts - ultimo.tsFim) <= BUFF_WINDOW_MS) {
      ultimo.msgs.push(msg)
      ultimo.tsFim = ts
    } else {
      blocos.push({ msgs: [msg], tsInicio: ts, tsFim: ts })
    }
  }

  // PASSAGEM 2: para cada bloco, procura resposta do atendente na janela
  // Uma resposta é válida se estiver dentro de [-BUFF_WINDOW, +BUFF_WINDOW*3]
  // do início do bloco (permite resposta quase simultânea ou um pouco antes)
  const respostasUsadas = new Set()
  const turnos = []

  for (const bloco of blocos) {
    let respostaEncontrada = null

    for (const r of msgsAtendente) {
      const uid = r.id_mensagem + '|' + r.mensagem
      if (respostasUsadas.has(uid)) continue
      const ts = new Date(r.timestamp).getTime()
      const diff = ts - bloco.tsInicio
      // Resposta válida: até 10s antes ou 30s depois do início do bloco
      if (diff >= -BUFF_WINDOW_MS && diff <= BUFF_WINDOW_MS * 3) {
        respostaEncontrada = r
        respostasUsadas.add(uid)
        break
      }
    }

    if (respostaEncontrada) {
      const espera = Math.max(0, Math.round(
        (new Date(respostaEncontrada.timestamp).getTime() - bloco.tsInicio) / 1000
      ))
      turnos.push({ msgs_cliente: bloco.msgs, resposta: respostaEncontrada, respondido: true, tempo_espera_segundos: espera })
    } else {
      turnos.push({ msgs_cliente: bloco.msgs, resposta: null, respondido: false, tempo_espera_segundos: null })
    }
  }

  return turnos
}

app.get('/relatorio', async (req, res) => {
  try {
    const data = req.query.data || hoje()
    const keys = await redisMensagens.keys('*')
    if (!keys.length) return res.json({
      data, total_conversas:0, respondidas:0, nao_respondidas:0,
      pendentes:0, tma_segundos:0, contatos:[]
    })

    const contatos = []

    for (const telefone of keys) {
      const raw = await redisMensagens.lrange(telefone, 0, -1)
      const msgs = raw.map(m => { try { return JSON.parse(m) } catch { return null } }).filter(Boolean)
      const msgsDia = msgs.filter(m => mesmaData(m.timestamp, data))
      if (!msgsDia.length) continue

      // Ordena: timestamp ASC, empate: cliente antes do atendente
      msgsDia.sort((a,b) => {
        const diff = new Date(a.timestamp) - new Date(b.timestamp)
        if (diff !== 0) return diff
        if (!isAtendente(a.nome) && isAtendente(b.nome)) return -1
        if (isAtendente(a.nome) && !isAtendente(b.nome)) return 1
        return 0
      })

      const msgsCliente   = msgsDia.filter(m => !isAtendente(m.nome))
      const msgsAtendente = msgsDia.filter(m => isAtendente(m.nome))
      if (!msgsCliente.length) continue

      // Calcula turnos
      const turnos = calcularTurnos(msgsDia)
      const turnosRespondidos = turnos.filter(t => t.respondido)
      const temTurnoPendente  = turnos.some(t => !t.respondido)

      // TMA desta conversa = média dos turnos respondidos
      const tempos = turnosRespondidos.map(t => t.tempo_espera_segundos)
      const tmaConversa = tempos.length ? Math.round(tempos.reduce((a,b)=>a+b,0)/tempos.length) : 0

      // Dados do contato
      let dadosContato = { nome: msgsCliente[0].nome||'Desconhecido', instancia: msgsCliente[0].instancia||'-' }
      try {
        const tipo = await redisContatos.type(telefone)
        if (tipo === 'hash') dadosContato = await redisContatos.hgetall(telefone)
        else if (tipo === 'string') dadosContato = JSON.parse(await redisContatos.get(telefone))
      } catch {}

      contatos.push({
        telefone,
        nome: dadosContato.nome || msgsCliente[0].nome || 'Desconhecido',
        instancia: dadosContato.instancia || msgsCliente[0].instancia || '-',
        respondida: msgsAtendente.length > 0,
        tem_pendencia: temTurnoPendente,
        total_turnos: turnos.length,
        turnos_respondidos: turnosRespondidos.length,
        turnos_pendentes: turnos.filter(t=>!t.respondido).length,
        tma_segundos: tmaConversa,
        total_msgs_cliente: msgsCliente.length,
        total_msgs_atendente: msgsAtendente.length,
        primeira_msg_cliente: { texto: msgsCliente[0].mensagem, horario: msgsCliente[0].timestamp },
        primeira_msg_atendente: msgsAtendente[0] ? { texto: msgsAtendente[0].mensagem, horario: msgsAtendente[0].timestamp } : null,
        tempo_espera_primeiro: turnosRespondidos[0]?.tempo_espera_segundos ?? null,
        turnos,
        mensagens: msgsDia
      })
    }

    contatos.sort((a,b) => new Date(a.primeira_msg_cliente.horario) - new Date(b.primeira_msg_cliente.horario))

    const respondidas    = contatos.filter(c => c.respondida)
    const naoRespondidas = contatos.filter(c => !c.respondida)
    const comPendencia   = contatos.filter(c => c.tem_pendencia)

    // TMA global = média de todos os tempos de todos os turnos respondidos
    const todosTempos = contatos.flatMap(c => c.turnos.filter(t=>t.respondido).map(t=>t.tempo_espera_segundos))
    const tmaGlobal = todosTempos.length ? Math.round(todosTempos.reduce((a,b)=>a+b,0)/todosTempos.length) : 0

    // Pico por hora
const porHora = new Array(24).fill(0)
contatos.forEach(c => {
  const h = new Date(c.primeira_msg_cliente.horario).toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })
  const hora = parseInt(h)
  if (!isNaN(hora)) porHora[hora]++
})
const horaP = porHora.indexOf(Math.max(...porHora))

    res.json({
      data,
      total_conversas: contatos.length,
      respondidas: respondidas.length,
      nao_respondidas: naoRespondidas.length,
      com_pendencia: comPendencia.length,
      tma_segundos: tmaGlobal,
      hora_pico: horaP,
      por_hora: porHora,
      contatos
    })
  } catch(err) {
    console.error(err)
    res.status(500).json({ erro: err.message })
  }
})


app.get('/relatorio-ia', async (req, res) => {
  try {
    const data = req.query.data || hoje()
    // Tenta buscar o relatório do dia específico (db2), depois o latest
    let raw = await redisRelatorios.get(`relatorio:${data}`)
    if (!raw) raw = await redisRelatorios.get('relatorio:latest')
    if (!raw) return res.status(404).json({ erro: 'Nenhum relatório encontrado' })
    const relatorio = JSON.parse(raw)
    // Se veio array (como o agente retorna), pega o primeiro
    const dados = Array.isArray(relatorio) ? relatorio[0] : relatorio
    res.json(dados)
  } catch(err) {
    console.error(err)
    res.status(500).json({ erro: err.message })
  }
})

app.get('/contatos', async (req, res) => {
  try {
    const keys = await redisContatos.keys('*')
    if (!keys.length) return res.json({ contatos: [] })
    const lista = []
    for (const k of keys) {
      let contato = {}
      const tipo = await redisContatos.type(k)
      if (tipo === 'hash') contato = { telefone: k, ...await redisContatos.hgetall(k) }
      else if (tipo === 'string') { try { contato = { telefone: k, ...JSON.parse(await redisContatos.get(k)) } } catch { continue } }
      else continue

      // Busca mensagens do contato no db1
      const tipoMsg = await redisMensagens.type(k)
      if (tipoMsg === 'list') {
        const msgs = (await redisMensagens.lrange(k, 0, -1)).map(m => { try { return JSON.parse(m) } catch { return null } }).filter(Boolean)
        const msgsCliente = msgs.filter(m => !isAtendente(m.nome))
        const primeira = msgsCliente.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp))[0]
        contato.primeiro_contato = primeira?.timestamp || contato.primeiro_contato || null
        contato.primeira_mensagem = primeira?.mensagem || null
        contato.total_mensagens = msgsCliente.length
      } else {
        contato.primeiro_contato = contato.primeiro_contato || null
        contato.primeira_mensagem = null
        contato.total_mensagens = 0
      }

      lista.push(contato)
    }
    res.json({ contatos: lista })
  } catch(err) { res.status(500).json({ erro: err.message }) }
})


app.get('/mensagens', async (req, res) => {
  try {
    const keys = await redisMensagens.keys('*')
    if (!keys.length) return res.json({ total: 0, contatos: [] })
    const resultado = []
    for (const k of keys) {
      const tipo = await redisMensagens.type(k)
      if (tipo !== 'list') continue
      const msgs = (await redisMensagens.lrange(k, 0, -1))
        .map(m => { try { return JSON.parse(m) } catch { return null } })
        .filter(Boolean)
      resultado.push({ telefone: k, total: msgs.length, mensagens: msgs })
    }
    res.json({ total: resultado.reduce((s,c) => s + c.total, 0), contatos: resultado })
  } catch(err) { res.status(500).json({ erro: err.message }) }
})

app.post('/resetar-ia', async (req, res) => {
  try {
    const keys = await redisContatos.keys('*')
    if (!keys.length) return res.json({ ok: true, resetados: 0 })
    let resetados = 0
    for (const k of keys) {
      const tipo = await redisContatos.type(k)
      if (tipo === 'hash') {
        const ia = await redisContatos.hget(k, 'ia')
        if (ia === 'nao') {
          await redisContatos.hset(k, 'ia', 'sim')
          resetados++
        }
      } else if (tipo === 'string') {
        try {
          const contato = JSON.parse(await redisContatos.get(k))
          if (contato.ia === 'nao') {
            contato.ia = 'sim'
            await redisContatos.set(k, JSON.stringify(contato))
            resetados++
          }
        } catch {}
      }
    }
    console.log(`🔄 IA resetada para ${resetados} contato(s)`)
    res.json({ ok: true, resetados })
  } catch(err) {
    console.error(err)
    res.status(500).json({ erro: err.message })
  }
})

app.get('/status', async (req, res) => {
  try {
    await redisContatos.ping(); await redisMensagens.ping(); await redisRelatorios.ping()
    const c = await redisContatos.keys('*'), m = await redisMensagens.keys('*'), r = await redisRelatorios.keys('*')
    res.json({ status:'ok', db0_contatos:c.length, db1_mensagens:m.length, db2_relatorios:r.length, redis:'conectado' })
  } catch(err) { res.status(500).json({ status:'erro', erro:err.message }) }
})

app.get('/stream', (req, res) => {
  res.setHeader('Content-Type','text/event-stream')
  res.setHeader('Cache-Control','no-cache')
  res.setHeader('Connection','keep-alive')
  res.setHeader('Access-Control-Allow-Origin','*')
  res.flushHeaders()
  const hb = setInterval(() => res.write(': heartbeat\n\n'), 15000)
  const sub = redisMensagens.duplicate()
  sub.subscribe('mensagens')
  sub.on('message', (ch, msg) => res.write(`data: ${msg}\n\n`))
  req.on('close', () => { clearInterval(hb); sub.unsubscribe(); sub.disconnect() })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`🚀 API http://localhost:${PORT}`))
