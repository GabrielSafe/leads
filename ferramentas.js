let csvData = [], csvFile = null

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
  document.getElementById('fileName').textContent=file.name
  document.getElementById('fileSize').textContent=fmtBytes(file.size)
  document.getElementById('fileInfo').classList.add('show')
  uploadArea.classList.add('has-file')
  const preview=csvData.slice(0,5)
  document.getElementById('previewTable').innerHTML=`<tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>${preview.map(row=>`<tr>${headers.map(h=>`<td>${row[h]??''}</td>`).join('')}</tr>`).join('')}`
  document.getElementById('previewCount').textContent=`${csvData.length} registro${csvData.length!==1?'s':''} encontrado${csvData.length!==1?'s':''}`
  document.getElementById('previewWrap').classList.add('show')
  checkReady()
}

function removeFile() { csvFile=null; csvData=[]; document.getElementById('csvInput').value=''; document.getElementById('fileInfo').classList.remove('show'); document.getElementById('previewWrap').classList.remove('show'); uploadArea.classList.remove('has-file'); document.getElementById('result').classList.remove('show'); checkReady() }
function checkReady() { const url=document.getElementById('webhookUrl').value.trim(); document.getElementById('btnSend').disabled=!(url&&csvData.length>0) }
function fmtBytes(b) { if(b<1024)return b+' B'; if(b<1048576)return(b/1024).toFixed(1)+' KB'; return(b/1048576).toFixed(1)+' MB' }
document.getElementById('webhookUrl').addEventListener('input',checkReady)

async function enviar() {
  const url=document.getElementById('webhookUrl').value.trim(); if(!url||csvData.length===0)return
  const btn=document.getElementById('btnSend'), result=document.getElementById('result')
  btn.disabled=true; btn.classList.add('loading'); result.classList.remove('show')
  try {
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(csvData)})
    if(resp.ok){ result.className='result show success'; result.innerHTML=`<span>✅</span><span>Enviado! <strong>${csvData.length} registro${csvData.length!==1?'s':''}</strong> enviados com sucesso.</span>` }
    else { const txt=await resp.text(); result.className='result show error'; result.innerHTML=`<span>❌</span><span>Erro ${resp.status}: ${txt.slice(0,120)}</span>` }
  } catch(err) { result.className='result show error'; result.innerHTML=`<span>❌</span><span>Erro: ${err.message}</span>` }
  btn.disabled=false; btn.classList.remove('loading')
}
