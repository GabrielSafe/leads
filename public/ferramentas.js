let csvData = [], csvFile = null, _cancelEnvio = false

const uploadArea = document.getElementById('uploadArea')
uploadArea.addEventListener('dragover', e=>{ e.preventDefault(); uploadArea.classList.add('dragover') })
uploadArea.addEventListener('dragleave', ()=>uploadArea.classList.remove('dragover'))
uploadArea.addEventListener('drop', e=>{ e.preventDefault(); uploadArea.classList.remove('dragover'); const f=e.dataTransfer.files[0]; if(f&&f.name.endsWith('.csv')){ document.getElementById('csvInput').files=e.dataTransfer.files; processFile(f) } })

function handleFile(input) { const f=input.files[0]; if(f)processFile(f) }
function processFile(file) { csvFile=file; const r=new FileReader(); r.onload=e=>parseCSV(e.target.result,file); r.readAsText(file,'UTF-8') }

function parseCSV(text, file) {
  const firstLine=text.split('\n')[0], sep=firstLine.includes(';')?';':','
  const lines=text.trim().split('\n').filter(l=>l.trim()); if(lines.length<2)return
  const headers=lines[0].split(sep).map(h=>h.trim().replace(/^"|"$/g,''))
  csvData=lines.slice(1).map(line=>{ const vals=line.split(sep).map(v=>v.trim().replace(/^"|"$/g,'')); const row={}; headers.forEach((h,i)=>{ const val=vals[i]!==undefined?vals[i]:''; row[h]=val===''?null:val }); return row })

  // File info
  document.getElementById('fileName').textContent=file.name
  document.getElementById('fileSize').textContent=fmtBytes(file.size)
  document.getElementById('fileInfo').classList.add('show')
  uploadArea.classList.add('has-file')

  // Preview melhorado
  const preview=csvData.slice(0,5)
  const truncate = (v,n=28) => v==null?'—' : String(v).length>n ? String(v).slice(0,n)+'…' : String(v)
  document.getElementById('previewTable').innerHTML=
    `<tr>${headers.map(h=>`<th title="${h}">${truncate(h,20)}</th>`).join('')}</tr>`+
    preview.map(row=>`<tr>${headers.map(h=>`<td title="${row[h]??''}">${truncate(row[h])}</td>`).join('')}</tr>`).join('')

  document.getElementById('previewRows').textContent=csvData.length.toLocaleString('pt-BR')+' linhas'
  document.getElementById('previewCols').textContent=headers.length+' colunas'
  document.getElementById('previewCount').textContent=`Mostrando 5 de ${csvData.length.toLocaleString('pt-BR')} registros`
  document.getElementById('previewWrap').classList.add('show')

  // Mostrar campo de lote
  document.getElementById('batchField').style.display = csvData.length > 100 ? 'block' : 'none'

  checkReady()
}

function removeFile() {
  csvFile=null; csvData=[]
  document.getElementById('csvInput').value=''
  document.getElementById('fileInfo').classList.remove('show')
  document.getElementById('previewWrap').classList.remove('show')
  document.getElementById('progressWrap').classList.remove('show')
  document.getElementById('batchField').style.display='none'
  uploadArea.classList.remove('has-file')
  document.getElementById('result').classList.remove('show')
  checkReady()
}

function checkReady() { const url=document.getElementById('webhookUrl').value.trim(); document.getElementById('btnSend').disabled=!(url&&csvData.length>0) }
function fmtBytes(b) { if(b<1024)return b+' B'; if(b<1048576)return(b/1024).toFixed(1)+' KB'; return(b/1048576).toFixed(1)+' MB' }
document.getElementById('webhookUrl').addEventListener('input',checkReady)

function cancelarEnvio() { _cancelEnvio=true; document.getElementById('cancelBtn').textContent='Cancelando...' }

function setProgress(sent, total, lote, totalLotes) {
  const pct=total>0?Math.round((sent/total)*100):0
  document.getElementById('progressBar').style.width=pct+'%'
  document.getElementById('progressText').textContent=`Lote ${lote}/${totalLotes} · ${sent.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} registros`
  document.getElementById('progressPct').textContent=pct+'%'
}

async function enviar() {
  const url=document.getElementById('webhookUrl').value.trim(); if(!url||csvData.length===0)return
  const btn=document.getElementById('btnSend'), result=document.getElementById('result'), prog=document.getElementById('progressWrap')
  const batchSize=Math.max(10,parseInt(document.getElementById('batchSize').value)||100)
  const total=csvData.length, totalLotes=Math.ceil(total/batchSize)

  btn.disabled=true; btn.classList.add('loading')
  result.classList.remove('show')
  prog.classList.add('show')
  document.getElementById('cancelBtn').textContent='Cancelar'
  _cancelEnvio=false

  let sent=0, erros=0

  for (let i=0; i<totalLotes; i++) {
    if (_cancelEnvio) break
    const lote=csvData.slice(i*batchSize,(i+1)*batchSize)
    setProgress(sent, total, i+1, totalLotes)
    try {
      const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(lote)})
      if(resp.ok){ sent+=lote.length }
      else {
        erros++
        const txt=await resp.text()
        result.className='result show error'
        result.innerHTML=`<span>❌</span><span>Erro no lote ${i+1}/${totalLotes}: ${txt.slice(0,120)}</span>`
        if(erros>=3) break
      }
    } catch(err) {
      erros++
      result.className='result show error'
      result.innerHTML=`<span>❌</span><span>Erro no lote ${i+1}: ${err.message}</span>`
      if(erros>=3) break
    }
  }

  setProgress(sent, total, totalLotes, totalLotes)
  setTimeout(()=>prog.classList.remove('show'), 800)
  btn.disabled=false; btn.classList.remove('loading')

  if (_cancelEnvio) {
    result.className='result show error'
    result.innerHTML=`<span>⚠️</span><span>Cancelado após <strong>${sent.toLocaleString('pt-BR')}</strong> de ${total.toLocaleString('pt-BR')} registros.</span>`
  } else if (erros===0) {
    result.className='result show success'
    result.innerHTML=`<span>✅</span><span><strong>${sent.toLocaleString('pt-BR')} registros</strong> enviados em ${totalLotes} lote${totalLotes>1?'s':''}.</span>`
  }
}
