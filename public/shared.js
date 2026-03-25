/* ── SHARED UTILITIES ── */
/* Loaded before each page's inline <script>. Plain declarations — no IIFE, no module. */

/* ── SETUP GUARD ── */
;(function(){
  if (typeof CONFIG !== 'undefined' && CONFIG._setup_required) {
    if (!window.location.pathname.includes('setup')) {
      window.location.replace('/setup.html')
    }
  }
})()

/* ── BRANDING ── */
function applyBranding() {
  const cfg = typeof CONFIG !== 'undefined' ? CONFIG : {}
  if (!cfg.empresa) return

  // Textos da sidebar
  const nameEl = document.querySelector('.sidebar-brand-name')
  const slugEl = document.querySelector('.sidebar-brand-slug')
  if (nameEl) nameEl.textContent = cfg.empresa
  if (slugEl) slugEl.textContent = cfg.slogan || 'Painel de Atendimento'

  // Logo na sidebar
  const logoEl = document.querySelector('.sidebar-logo')
  if (logoEl) {
    if (cfg.logo_type === 'image' && cfg.logo_data) {
      logoEl.innerHTML = `<img src="${cfg.logo_data}" style="width:28px;height:28px;border-radius:7px;object-fit:cover;display:block">`
      logoEl.style.background = 'transparent'
      logoEl.style.border = 'none'
    } else if (cfg.logo_type === 'emoji' && cfg.logo_emoji) {
      logoEl.innerHTML = `<span style="font-size:18px;line-height:1">${cfg.logo_emoji}</span>`
    } else if (cfg.logo_type === 'none') {
      logoEl.style.display = 'none'
    }
  }

  // Favicon
  const favicon = document.querySelector("link[rel='icon']")
  if (favicon) {
    if (cfg.logo_type === 'image' && cfg.logo_data) {
      favicon.href = cfg.logo_data
    } else if (cfg.logo_type === 'emoji' && cfg.logo_emoji) {
      favicon.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${cfg.logo_emoji}</text></svg>`
    }
  }
}
document.addEventListener('DOMContentLoaded', applyBranding)

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
    if (cfg.cores.primaria) { r.style.setProperty('--accent', cfg.cores.primaria); r.style.setProperty('--accent2', cfg.cores.primaria) }
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
