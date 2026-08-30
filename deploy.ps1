# Deploy do Alô Buzinou, na ordem que funciona.
#
# Uso:   .\deploy.ps1
#        .\deploy.ps1 -SemStorage      (se o Storage ainda não foi criado)
#        .\deploy.ps1 -SoSite          (só o hosting, quando nada de backend mudou)
#
# Por que um script e não os comandos soltos: a ordem tem um ponto crítico —
# FUNCTIONS ANTES DE HOSTING. Site novo contra funções ausentes quebra na
# primeira tela, porque a home chama getShowcase e a entrada do responsável
# chama redeemInvite. Errar essa ordem é fácil e o sintoma não aponta a causa.
#
# Escrito pra Windows PowerShell 5.1: sem `&&`, sem ternário, sem `??`.

param(
  [switch]$SemStorage,
  [switch]$SoSite
)

$ErrorActionPreference = 'Continue'

# As 12 functions que NÃO dependem de segredo. As duas de e-mail
# (sendPaymentReminders, runPaymentRemindersNow) declaram RESEND_API_KEY, e o
# CLI para esperando o valor ser digitado — o que travaria este script. Elas
# sobem à parte, quando existir chave do Resend. Ver docs/deploy.md.
$FuncoesNucleo = @(
  'functions:lookupInvite',
  'functions:redeemInvite',
  'functions:joinDriverWaitlist',
  'functions:getShowcase',
  'functions:spinEntryBonus',
  'functions:closeStaleRoutes',
  'functions:sendPushOnNotification',
  'functions:generateMonthlyPayments',
  'functions:runBillingNow',
  'functions:getInvitePreview',
  'functions:flagDuplicateReceipts',
  'functions:backfillTestimonialPrivacy'
) -join ','

function Passo($titulo) {
  Write-Host ''
  Write-Host "== $titulo" -ForegroundColor Cyan
}

function Parar($msg) {
  Write-Host ''
  Write-Host "PAROU: $msg" -ForegroundColor Red
  Write-Host 'Nada depois disto foi executado. Ver docs/deploy.md.' -ForegroundColor Yellow
  exit 1
}

# ── Guarda: a branch certa ────────────────────────────────────────────────
# Cinco sessões já editaram esta árvore, e a branch é estado COMPARTILHADO:
# outra sessão pode ter trocado. Já aconteceu um commit cair na branch errada
# por conta disso.
$branch = (git branch --show-current)
Write-Host "Branch: $branch" -ForegroundColor DarkGray
if ($branch -ne 'WebApp-oficial-v1') {
  Write-Host "Aviso: o deploy normalmente sai da WebApp-oficial-v1." -ForegroundColor Yellow
  $resp = Read-Host "Continuar de '$branch'? (s/N)"
  if ($resp -ne 's') { Parar 'cancelado por causa da branch' }
}

# ── Guarda: nada sem commit ──────────────────────────────────────────────
# Deployar com árvore suja publica algo que não existe no histórico: se der
# problema, não há para onde voltar.
$sujo = (git status --porcelain)
if ($sujo) {
  Write-Host 'Há alteração sem commit:' -ForegroundColor Yellow
  git status --short
  $resp = Read-Host 'Deployar assim mesmo? (s/N)'
  if ($resp -ne 's') { Parar 'árvore suja' }
}

# ── 0) Validação ─────────────────────────────────────────────────────────
Passo 'Lint'
npm run lint
# O lint tem 10 erros de base em hooks antigos: não bloqueia, mas fica à vista.
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Lint com problemas (a base tem 10 erros conhecidos).' -ForegroundColor Yellow
}

Passo 'Build'
npm run build
if ($LASTEXITCODE -ne 0) { Parar 'o build falhou — não faz sentido subir' }

if ($SoSite) {
  Passo 'Hosting (somente)'
  npx firebase deploy --only hosting
  if ($LASTEXITCODE -ne 0) { Parar 'hosting falhou' }
  Write-Host ''
  Write-Host 'Site atualizado.' -ForegroundColor Green
  exit 0
}

# ── 1) Índices ───────────────────────────────────────────────────────────
Passo 'Índices do Firestore'
npx firebase deploy --only firestore:indexes
if ($LASTEXITCODE -ne 0) { Parar 'índices falharam' }

# ── 2) Regras do banco ───────────────────────────────────────────────────
Passo 'Regras do Firestore'
npx firebase deploy --only firestore:rules
if ($LASTEXITCODE -ne 0) { Parar 'regras do Firestore falharam' }

# ── 3) Regras do Storage ─────────────────────────────────────────────────
if ($SemStorage) {
  Write-Host ''
  Write-Host 'Storage: pulado por -SemStorage.' -ForegroundColor DarkGray
  Write-Host 'Anexo de comprovante e troca de foto ficam desligados.' -ForegroundColor DarkGray
} else {
  Passo 'Regras do Storage'
  npx firebase deploy --only storage
  if ($LASTEXITCODE -ne 0) {
    Parar 'Storage falhou. Se a mensagem diz "has not been set up", abra o console -> Storage -> Get Started. Ou rode com -SemStorage.'
  }
}

# ── 4) Functions ─────────────────────────────────────────────────────────
Passo 'Functions (as 12 do núcleo)'
npx firebase deploy --only $FuncoesNucleo
if ($LASTEXITCODE -ne 0) {
  Parar 'Functions falharam. Se a mensagem fala de billing, o plano Blaze não está ativo — e sem functions o login do responsável não existe.'
}

# ── 5) Site, por último ──────────────────────────────────────────────────
Passo 'Hosting'
npx firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { Parar 'hosting falhou (o backend já subiu)' }

Write-Host ''
Write-Host 'No ar: https://projeto-tio-nino-digital.web.app' -ForegroundColor Green
Write-Host ''
Write-Host 'Agora, as tres verificacoes do docs/deploy.md:' -ForegroundColor Cyan
Write-Host '  1. a home carrega e mostra o parceiro'
Write-Host '  2. /admin -> Manutencao -> Verificar (o backfill de privacidade)'
Write-Host '  3. cadastrar uma crianca e abrir o link do convite em outro aparelho'
