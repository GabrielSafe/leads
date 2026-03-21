/* ── SHARED UTILITIES ── */
/* Loaded before each page's inline <script>. Plain declarations — no IIFE, no module. */

/* ── THEME ── */
function toggleTheme() {
  document.body.classList.add('theme-transitioning')
  const isLight = document.body.classList.toggle('light')
  document.getElementById('iconMoon').style.display = isLight ? 'none'  : 'block'
  document.getElementById('iconSun').style.display  = isLight ? 'block' : 'none'
  localStorage.setItem('theme', isLight ? 'light' : 'dark')
  setTimeout(() => document.body.classList.remove('theme-transitioning'), 380)
}

/* ── SIDEBAR TOGGLE ── */
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

/* ── SCROLL REVEAL ── */
function initScrollReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 70)
        obs.unobserve(entry.target)
      }
    })
  }, { threshold: 0.08 })
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
}

/* ── RIPPLE ── */
function addRipple(e) {
  const btn = e.currentTarget
  const wave = document.createElement('span')
  wave.className = 'ripple-wave'
  const rect = btn.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  wave.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`
  btn.classList.add('ripple-host')
  btn.appendChild(wave)
  wave.addEventListener('animationend', () => wave.remove())
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

/* ── SCROLL TOP BUTTON ── */
function initScrollTop() {
  const btn = document.getElementById('scrollTop')
  const content = document.querySelector('.content')
  if (!btn || !content) return
  content.addEventListener('scroll', () => btn.classList.toggle('show', content.scrollTop > 280))
  btn.addEventListener('click', () => content.scrollTo({ top:0, behavior:'smooth' }))
}

/* ── TOAST ── */
function showToast(msg, type='success') {
  const t = document.createElement('div')
  t.className = `toast ${type}`
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3000)
}

/* ── CONFIG BRANDING (logo, colors from CONFIG) ── */
;(function(){
  const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {}
  const la = document.getElementById('logoArea')
  if (la && cfg.empresa) {
    const h = cfg.logo_url && cfg.logo_url.trim()
    la.innerHTML = `<div class="sidebar-logo">${h ? `<img src="${cfg.logo_url}" alt="${cfg.empresa}">` : cfg.logo_emoji||'💬'}</div><div><div class="sidebar-brand-name">${cfg.empresa}</div><div class="sidebar-brand-slug">${cfg.slogan||'Painel'}</div></div>`
  }
  if (cfg.cores) {
    const r = document.documentElement
    if (cfg.cores.primaria) { r.style.setProperty('--green', cfg.cores.primaria); r.style.setProperty('--green2', cfg.cores.primaria) }
    if (cfg.cores.secundaria) r.style.setProperty('--rose', cfg.cores.secundaria)
  }
})()

/* ── THEME RESTORE + CLOCK ── */
;(function(){
  const t = localStorage.getItem('theme')
  if (t === 'light') {
    document.body.classList.add('light')
    document.getElementById('iconMoon').style.display = 'none'
    document.getElementById('iconSun').style.display  = 'block'
  }
  setInterval(() => { const el = document.getElementById('clock'); if (el) el.textContent = new Date().toLocaleTimeString('pt-BR') }, 1000)
})()
