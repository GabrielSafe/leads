/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║           ARQUIVO DE CONFIGURAÇÃO DO SISTEMA            ║
 * ║   Preencha antes de subir para o servidor               ║
 * ╚══════════════════════════════════════════════════════════╝
 */

const CONFIG = {

  // ─────────────────────────────────────────
  // IDENTIDADE DA EMPRESA
  // ─────────────────────────────────────────

  empresa: "Magma",          // Nome exibido no header e rodapé
  slogan: "Sistema de Atendimento",    // Subtítulo abaixo do nome (pode deixar vazio "")

  // ─────────────────────────────────────────
  // LOGO
  // ─────────────────────────────────────────

  // Opção 1: Emoji como logo (simples)
  logo_emoji: "💬",

  // Opção 2: URL de imagem (deixe "" para usar emoji)
  // Exemplo: "https://meusite.com/logo.png" ou "/logo.png" (arquivo na raiz)
  logo_url: "/logo.png",

  // Tamanho da logo em px (quando usar imagem)
  logo_tamanho: 36,

  // ─────────────────────────────────────────
  // FAVICON (ícone na aba do navegador)
  // ─────────────────────────────────────────

  // Opção 1: Emoji como favicon
  favicon_emoji: "💬",

  // Opção 2: URL de imagem .ico ou .png (deixe "" para usar emoji)
  favicon_url: "/logo.png",

  // ─────────────────────────────────────────
  // CORES
  // ─────────────────────────────────────────

  cores: {
    primaria:    "#0d9488",   // Cor principal (teal) — botões, destaques, links
    secundaria:  "#f43f5e",   // Cor de alerta/erro (rose) — pendências, sem resposta
    terciaria:   "#f59e0b",   // Cor de aviso (amber) — TMA, pico
    acento:      "#6366f1",   // Cor de destaque (indigo) — hora de pico
    sucesso:     "#10b981",   // Verde — respondidas, IA ativa
  },

  // ─────────────────────────────────────────
  // INSTÂNCIAS DO WHATSAPP
  // ─────────────────────────────────────────

  // Nome amigável para cada instância (aparece no filtro do dashboard)
  // Formato: { "nome_tecnico": "Nome Exibido" }
  // Exemplo: { "magma": "Loja Principal", "gabriel": "Suporte" }
  instancias: {},

  // ─────────────────────────────────────────
  // CONFIGURAÇÕES DO DASHBOARD
  // ─────────────────────────────────────────

  // Intervalo de atualização automática em segundos
  atualizacao_segundos: 30,

  // Fuso horário para datas e horas
  timezone: "America/Sao_Paulo",

  // ─────────────────────────────────────────
  // RODAPÉ
  // ─────────────────────────────────────────

  rodape: "Sistema de Monitoramento de Atendimento",

}
