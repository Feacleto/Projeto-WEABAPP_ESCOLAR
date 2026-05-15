/**
 * Template HTML do email de cobrança. Inline CSS porque clientes de email
 * (Gmail, Outlook, Apple Mail) ignoram <style> externo e <link>.
 *
 * 3 variantes pelo `milestone`:
 *   - 'reminder_3d' (3 dias antes do vencimento) — azul, lembrete amigável
 *   - 'due_today'   (vence hoje)                  — âmbar, urgência leve
 *   - 'overdue_3d'  (3 dias atrasado)             — vermelho, cobrança firme
 *
 * Imagem do header: ilustração da van escolar hospedada no Hosting do app
 * (https://{appUrl}/imagemvanescolar.png). Passa credibilidade visual de
 * negócio real, não phishing.
 *
 * Botão "Pagar agora" → link direto pra `${appUrl}/pai/finance`. Se o pai
 * não estiver logado, cai no /login e volta pro destino após autenticar.
 */

const VARIANTS = {
  reminder_3d: {
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    headline: 'Mensalidade chegando',
    intro:
      'Faltam 3 dias pro vencimento da mensalidade do transporte escolar. Pra não esquecer, dá uma olhada nos detalhes abaixo.',
    badge: 'Lembrete amigável',
  },
  due_today: {
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    headline: 'Hoje é o dia do pagamento',
    intro:
      'A mensalidade do transporte escolar vence hoje. Toque no botão pra pagar via PIX direto pelo app.',
    badge: 'Vence hoje',
  },
  overdue_3d: {
    color: '#dc2626',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    headline: 'Mensalidade em atraso',
    intro:
      'A mensalidade do transporte escolar venceu há 3 dias. Pague agora pra não interromper o serviço.',
    badge: 'Atrasado · 3 dias',
  },
};

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function formatBRL(n) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(n) || 0);
}

function formatLongDate(d) {
  if (!d) return '';
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Monta o HTML final do email.
 *
 * @param {object} params
 * @param {string} params.milestone        — 'reminder_3d' | 'due_today' | 'overdue_3d'
 * @param {string} params.parentName       — nome do responsável
 * @param {string} params.childName        — nome da criança
 * @param {number} params.amount           — valor da mensalidade
 * @param {Date}   params.dueDate          — data de vencimento
 * @param {string} params.monthLabel       — "Maio/2026"
 * @param {string} params.appUrl           — base URL do app (https://...)
 * @param {string} [params.pixKey]         — chave PIX do tio
 * @param {string} [params.pixKeyType]     — tipo da chave (cpf/email/phone/aleatoria)
 * @param {string} [params.adminName]      — nome do motorista
 * @param {string} [params.companyName]    — nome da empresa
 */
function buildEmailHtml({
  milestone,
  parentName,
  childName,
  amount,
  dueDate,
  monthLabel,
  appUrl,
  pixKey,
  pixKeyType,
  adminName,
  companyName,
}) {
  const v = VARIANTS[milestone] || VARIANTS.reminder_3d;
  const safeParent = escapeHtml(parentName?.split(' ')[0] || 'Olá');
  const safeChild = escapeHtml(childName || 'a criança');
  const safeAdmin = escapeHtml(adminName || 'o motorista');
  const safeCompany = escapeHtml(companyName || 'Alô Buzinou!');
  const safePix = escapeHtml(pixKey || '');
  const safePixType = escapeHtml(pixKeyType || '');
  const valor = formatBRL(amount);
  const vencimento = formatLongDate(dueDate);
  const safeMonth = escapeHtml(monthLabel || '');
  const payUrl = `${appUrl}/pai/finance`;
  // URL absoluta da imagem da van — em /public/imagemvanescolar.png
  const heroImg = `${appUrl}/imagemvanescolar.png`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mensalidade do transporte escolar</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color:#111827;">
  <!-- Pre-header (texto invisível mas aparece na lista de emails) -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; visibility:hidden;">
    ${v.headline} — ${valor} de ${safeChild} · ${vencimento}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f4f6; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; background-color:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 8px 24px rgba(15,23,42,0.08);">

          <!-- Header com imagem da van escolar (credibilidade visual) -->
          <tr>
            <td style="position:relative;">
              <img src="${heroImg}" alt="Van escolar" width="560" style="display:block; width:100%; max-width:560px; height:auto;" />
            </td>
          </tr>

          <!-- Faixa de marca (logo + nome) -->
          <tr>
            <td style="background:linear-gradient(135deg, #10b981 0%, #047857 100%); color:#ffffff; padding:16px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; opacity:0.85;">
                      ${safeCompany}
                    </div>
                    <div style="font-size:22px; font-weight:800; line-height:1.2; margin-top:4px;">
                      Alô Buzinou!
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Badge do status (cor varia por milestone) -->
          <tr>
            <td style="padding:24px 28px 0 28px;">
              <span style="display:inline-block; background-color:${v.bgColor}; color:${v.color}; border:1px solid ${v.borderColor}; border-radius:9999px; padding:6px 12px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em;">
                ${v.badge}
              </span>
            </td>
          </tr>

          <!-- Corpo principal -->
          <tr>
            <td style="padding:16px 28px 8px 28px;">
              <h1 style="margin:0; font-size:24px; line-height:1.25; font-weight:800; color:#111827;">
                Olá, ${safeParent}!
              </h1>
              <p style="margin:12px 0 0 0; font-size:15px; line-height:1.55; color:#374151;">
                ${v.intro}
              </p>
            </td>
          </tr>

          <!-- Box destacado com valor + vencimento -->
          <tr>
            <td style="padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${v.bgColor}; border:1px solid ${v.borderColor}; border-radius:16px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:${v.color};">
                      Mensalidade · ${safeMonth}
                    </div>
                    <div style="font-size:32px; font-weight:800; color:${v.color}; line-height:1.15; margin-top:6px; letter-spacing:-0.01em;">
                      ${valor}
                    </div>
                    <div style="font-size:13px; color:#4b5563; margin-top:8px;">
                      <strong>Aluno(a):</strong> ${safeChild}
                    </div>
                    <div style="font-size:13px; color:#4b5563; margin-top:2px;">
                      <strong>Vencimento:</strong> ${vencimento}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Botão principal "Pagar agora" -->
          <tr>
            <td style="padding:8px 28px 24px 28px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:${v.color}; border-radius:16px;">
                    <a href="${payUrl}" target="_blank" style="display:inline-block; padding:16px 28px; color:#ffffff; font-size:16px; font-weight:800; text-decoration:none; letter-spacing:0.01em;">
                      Pagar agora pelo app →
                    </a>
                  </td>
                </tr>
              </table>
              <div style="margin-top:10px; font-size:12px; color:#6b7280;">
                Toque no botão pra abrir o app e pagar com PIX.
              </div>
            </td>
          </tr>

          ${
            safePix
              ? `<!-- Bloco PIX como alternativa -->
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:16px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:#6b7280;">
                      Pagar por PIX direto
                    </div>
                    <div style="font-size:13px; color:#4b5563; margin-top:8px;">
                      <strong>Chave (${safePixType}):</strong>
                    </div>
                    <div style="font-size:15px; font-weight:700; color:#111827; word-break:break-all; margin-top:4px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;">
                      ${safePix}
                    </div>
                    <div style="font-size:12px; color:#6b7280; margin-top:10px;">
                      Copie a chave acima e cole no seu banco. Depois marque
                      como pago no app pra ${safeAdmin} ser avisado.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
              : ''
          }

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb; padding:20px 28px; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:11px; line-height:1.5; color:#6b7280; text-align:center;">
                Você recebeu este email porque seu cadastro no
                <strong>Alô Buzinou!</strong> está vinculado a ${safeChild}.
                <br />
                Em caso de dúvida, fale com ${safeAdmin} pelo app.
              </p>
            </td>
          </tr>
        </table>

        <!-- Assinatura discreta -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px; margin-top:16px;">
          <tr>
            <td style="font-size:11px; color:#9ca3af; text-align:center;">
              Alô Buzinou! · sistema de transporte escolar
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Versão texto puro do email (fallback pra clientes que não renderizam HTML
 * ou pro filtro anti-spam que checa balanceamento HTML vs texto).
 */
function buildEmailText({
  milestone,
  parentName,
  childName,
  amount,
  dueDate,
  monthLabel,
  appUrl,
  pixKey,
  adminName,
}) {
  const v = VARIANTS[milestone] || VARIANTS.reminder_3d;
  const valor = formatBRL(amount);
  const venc = formatLongDate(dueDate);
  const first = parentName?.split(' ')[0] || 'Olá';
  return `Olá, ${first}!

${v.intro}

Mensalidade — ${monthLabel}
Valor: ${valor}
Aluno(a): ${childName}
Vencimento: ${venc}

Pagar agora pelo app:
${appUrl}/pai/finance

${pixKey ? `Pagar por PIX:\nChave: ${pixKey}\n\n` : ''}Em caso de dúvida, fale com ${adminName || 'o motorista'} pelo app.

— Alô Buzinou!
`;
}

function subjectFor(milestone, childName, monthLabel) {
  const child = childName?.split(' ')[0] || 'a criança';
  switch (milestone) {
    case 'reminder_3d':
      return `Mensalidade de ${child} vence em 3 dias · ${monthLabel}`;
    case 'due_today':
      return `Hoje vence a mensalidade de ${child} · ${monthLabel}`;
    case 'overdue_3d':
      return `Mensalidade de ${child} em atraso · ${monthLabel}`;
    default:
      return `Mensalidade · ${monthLabel}`;
  }
}

module.exports = { buildEmailHtml, buildEmailText, subjectFor };
