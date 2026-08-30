import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode, Link2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { inviteUrl } from '../../utils/inviteUrl';

/**
 * Compartilhamento do convite pelo tio.
 *
 * O caminho principal é o LINK, não o código: o responsável abre e a conta
 * se cria na hora, sem digitar TN4582 num teclado de celular. O código
 * segue visível como plano B (ditar por telefone) e o QR serve pro
 * presencial — o tio mostra a tela e o pai aponta a câmera.
 *
 * Props:
 *   - code: string (ex: 'TN4582')
 *   - childName: string — usado na mensagem do WhatsApp
 *   - parentPhone: string opcional (só dígitos) — abre a conversa certa
 */
export default function InviteShare({ code, childName, parentPhone }) {
  const [copied, setCopied] = useState(null); // 'link' | 'code' | null
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [showQr, setShowQr] = useState(false);

  const url = inviteUrl(code);
  const firstName = String(childName || '').trim().split(/\s+/)[0] || '';

  useEffect(() => {
    if (!showQr || qrDataUrl) return;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: '#111827', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      .catch(() => toast.error('Não foi possível gerar o QR.'));
  }, [showQr, qrDataUrl, url]);

  const copy = async (value, kind) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard falha em contexto não-seguro (http) e em alguns webviews
      toast.error('Não deu pra copiar. Toque e segure pra selecionar.');
    }
  };

  const waText = encodeURIComponent(
    `Oi! Aqui é do transporte escolar${firstName ? ` do/da ${firstName}` : ''}. ` +
      `Abra este link pra acompanhar a rota e as mensalidades pelo app: ${url}`
  );
  const waHref = parentPhone
    ? `https://wa.me/${parentPhone.startsWith('55') ? parentPhone : `55${parentPhone}`}?text=${waText}`
    : `https://wa.me/?text=${waText}`;

  return (
    <div className="space-y-3">
      {/* Caminho principal: mandar o link */}
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        className="tap w-full h-14 rounded-xl bg-[#25D366] text-white font-semibold inline-flex items-center justify-center gap-2 shadow-focus"
      >
        <WhatsAppIcon size={20} colored={false} />
        Mandar convite no WhatsApp
      </a>

      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted flex items-center gap-1.5">
          <Link2 size={12} />
          link do convite
        </p>
        <p className="text-xs text-text break-all font-mono leading-relaxed">
          {url}
        </p>
        <Button
          size="sm"
          variant="secondary"
          icon={copied === 'link' ? Check : Copy}
          onClick={() => copy(url, 'link')}
        >
          {copied === 'link' ? 'Link copiado!' : 'Copiar link'}
        </Button>
      </div>

      {/* Plano B: ditar o código */}
      <div className="bg-sunken border border-border rounded-xl p-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
          se precisar ditar por telefone
        </p>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-extrabold tracking-[0.2em] text-primary flex-1">
            {code}
          </p>
          <button
            type="button"
            onClick={() => copy(code, 'code')}
            aria-label="Copiar código"
            className="tap w-11 h-11 rounded-xl bg-card border border-border flex items-center justify-center text-textMuted"
          >
            {copied === 'code' ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      {/* Presencial */}
      {!showQr ? (
        <Button variant="ghost" size="md" icon={QrCode} onClick={() => setShowQr(true)}>
          Mostrar QR pra ele apontar a câmera
        </Button>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR do convite ${code}`}
              className="w-44 h-44 rounded-lg"
            />
          ) : (
            <div className="w-44 h-44 rounded-lg bg-neutro animate-pulse" />
          )}
          <p className="text-xs text-textMuted text-center">
            Peça pro responsável abrir a câmera do celular e apontar aqui.
          </p>
        </div>
      )}
    </div>
  );
}
