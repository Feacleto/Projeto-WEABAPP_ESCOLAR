import { formatCurrency, formatMonthLabel } from '../compartilhado/formatters';

/**
 * Recibo em imagem, gerado no próprio celular do motorista.
 *
 * POR QUE ISTO EXISTE
 * Pagamento em PIX deixa rastro: o banco emite comprovante e o pai anexa.
 * Pagamento em DINHEIRO não deixa nada. E é justamente onde a discussão
 * acontece um mês depois — "eu te paguei em dinheiro no dia 5" contra "não
 * recebi". Sem papel, sobra a memória dos dois.
 *
 * Então quando o tio confirma um recebimento em dinheiro, o app gera o recibo
 * e ele manda pro pai pelo app que quiser. O comprovante que o banco não
 * emitiu passa a existir, com valor, mês, data e quem recebeu.
 *
 * POR QUE CANVAS E NÃO PDF
 * O que ele vai fazer com o arquivo é mandar no WhatsApp. Imagem abre na
 * conversa, dá pra ver sem baixar e sem app de leitor — PDF vira anexo que
 * metade das pessoas não abre no celular. Canvas também não adiciona
 * dependência nenhuma ao projeto.
 */

const W = 1080;
const H = 1350; // 4:5, o formato que o WhatsApp corta melhor

const COLORS = {
  bg: '#FFFFFF',
  ink: '#111827',
  muted: '#6B7280',
  primary: '#1F5F3F',
  line: '#E5E7EB',
  stampBg: '#E4EFE7',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const METHOD_LABELS = {
  cash: 'Dinheiro',
  pix: 'PIX',
  card: 'Cartão',
};

/**
 * Desenha o recibo e devolve um Blob PNG.
 *
 * @param payment  doc do pagamento (childName, month, amount, paidAt, paymentMethod)
 * @param admin    doc do motorista (companyName, name, phone)
 */
export async function buildReceiptImage({ payment, admin }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  const pad = 80;

  // Faixa superior com quem emitiu
  ctx.fillStyle = COLORS.primary;
  ctx.fillRect(0, 0, W, 220);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 34px Inter, system-ui, sans-serif';
  ctx.fillText('RECIBO DE PAGAMENTO', pad, 100);
  ctx.font = '700 48px Inter, system-ui, sans-serif';
  const emitter = admin?.companyName || admin?.name || 'Transporte Escolar';
  ctx.fillText(truncate(ctx, emitter, W - pad * 2), pad, 160);

  let y = 320;

  // O valor, grande — é o que a pessoa confere de relance
  ctx.fillStyle = COLORS.muted;
  ctx.font = '500 30px Inter, system-ui, sans-serif';
  ctx.fillText('VALOR RECEBIDO', pad, y);
  y += 80;
  ctx.fillStyle = COLORS.ink;
  ctx.font = '800 96px Inter, system-ui, sans-serif';
  ctx.fillText(formatCurrency(payment?.amount), pad, y);

  y += 70;
  ctx.fillStyle = COLORS.line;
  ctx.fillRect(pad, y, W - pad * 2, 2);
  y += 80;

  // Linhas de detalhe
  const rows = [
    ['Referente a', formatMonthLabel(payment?.month)],
    ['Aluno(a)', payment?.childName || '—'],
    ['Forma de pagamento', METHOD_LABELS[payment?.paymentMethod] || '—'],
    ['Recebido em', formatDateLong(payment?.paidAt)],
  ];

  for (const [label, value] of rows) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '500 30px Inter, system-ui, sans-serif';
    ctx.fillText(label, pad, y);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '600 40px Inter, system-ui, sans-serif';
    ctx.fillText(truncate(ctx, String(value), W - pad * 2), pad, y + 52);
    y += 130;
  }

  // Selo de quitação
  y += 20;
  ctx.fillStyle = COLORS.stampBg;
  roundRect(ctx, pad, y, W - pad * 2, 130, 24);
  ctx.fill();
  ctx.fillStyle = COLORS.primary;
  ctx.font = '700 42px Inter, system-ui, sans-serif';
  ctx.fillText('✓  Pagamento confirmado', pad + 40, y + 82);

  // Rodapé: quem gerou e quando. Um recibo sem origem não serve de nada.
  ctx.fillStyle = COLORS.muted;
  ctx.font = '400 26px Inter, system-ui, sans-serif';
  const footer = admin?.phone
    ? `Emitido por ${emitter} · ${admin.phone}`
    : `Emitido por ${emitter}`;
  ctx.fillText(truncate(ctx, footer, W - pad * 2), pad, H - 110);
  ctx.fillText(
    `Gerado pelo Alô Buzinou em ${formatDateLong(new Date())}`,
    pad,
    H - 68
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem.'))),
      'image/png'
    );
  });
}

/**
 * Compartilha o recibo pelo menu do sistema — ele escolhe WhatsApp, email,
 * salvar em arquivos, o que quiser.
 *
 * `navigator.share` com arquivos existe no Chrome do Android e no Safari 15+.
 * Onde não existe, cai no download: pior, mas nunca deixa ele sem saída.
 *
 * Retorna 'shared' | 'downloaded' | 'cancelled'.
 */
export async function shareReceipt({ payment, admin }) {
  const blob = await buildReceiptImage({ payment, admin });
  const safeName = String(payment?.childName || 'aluno')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase();
  const filename = `recibo-${safeName}-${payment?.month || ''}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Recibo de pagamento',
        text: `Recibo de ${payment?.childName || ''} — ${formatMonthLabel(payment?.month)}`,
      });
      return 'shared';
    } catch (err) {
      // AbortError = ele fechou o menu. Não é falha, não mostra erro.
      if (err?.name === 'AbortError') return 'cancelled';
      throw err;
    }
  }

  // Fallback: baixa o arquivo e ele anexa manualmente.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

/* ─────────────── helpers ─────────────── */

function truncate(ctx, text, maxWidth) {
  let out = String(text || '');
  if (ctx.measureText(out).width <= maxWidth) return out;
  while (out.length > 3 && ctx.measureText(out + '...').width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + '...';
}

function formatDateLong(value) {
  const d =
    value?.toDate?.() ||
    (value instanceof Date ? value : value ? new Date(value) : new Date());
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}
