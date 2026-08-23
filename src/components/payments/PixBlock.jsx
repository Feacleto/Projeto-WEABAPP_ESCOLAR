import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { buildPixPayload } from '../../utils/pixPayload';
import { PIX_KEY_TYPES } from '../../services/userService';

/**
 * Pagamento por PIX com copia-e-cola de verdade.
 *
 * Antes a chave aparecia como texto e o pai tinha que selecionar, copiar e
 * digitar o valor no app do banco. Agora ele cola um código único que já
 * carrega valor, nome e identificação do mês — menos erro de digitação e
 * menos "paguei o valor errado".
 *
 * Props:
 *   - admin:   doc do motorista (pixKey, pixKeyType, name, companyName, city)
 *   - amount:  valor da mensalidade
 *   - txid:    identificação livre (usamos o mês, ex: '2026-08')
 */
export default function PixBlock({ admin, amount, txid }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const payload = buildPixPayload({
    key: admin?.pixKey,
    keyType: admin?.pixKeyType,
    merchantName: admin?.companyName || admin?.name,
    city: admin?.companyCity || admin?.city,
    amount,
    txid,
  });

  useEffect(() => {
    if (!showQr || qrDataUrl || !payload) return;
    QRCode.toDataURL(payload, {
      width: 340,
      margin: 1,
      color: { dark: '#111827', light: '#FFFFFF' },
    })
      .then(setQrDataUrl)
      .catch(() => toast.error('Não foi possível gerar o QR.'));
  }, [showQr, qrDataUrl, payload]);

  // Sem chave cadastrada não há o que mostrar — e é o tio que resolve isso.
  if (!admin?.pixKey) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <p className="text-sm font-semibold text-text">
          O motorista ainda não cadastrou a chave PIX
        </p>
        <p className="text-xs text-textMuted mt-1">
          Combine o pagamento direto com ele.
        </p>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success('Código copiado! Cole no app do seu banco.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não deu pra copiar. Toque e segure no código pra selecionar.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-card border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
              chave pix
            </p>
            <p className="text-sm text-text break-all">
              {PIX_KEY_TYPES[admin.pixKeyType]?.label || 'Chave'}: {admin.pixKey}
            </p>
          </div>
        </div>

        {/* O copia-e-cola é o caminho principal — o valor já vai embutido */}
        <div className="bg-gray-50 border border-dashed border-primary/40 rounded-xl p-3">
          <p className="font-mono text-[10px] leading-relaxed text-primary break-all">
            {payload}
          </p>
        </div>

        <Button icon={copied ? Check : Copy} onClick={copy}>
          {copied ? 'Código copiado!' : 'Copiar código PIX'}
        </Button>
        <p className="text-[11px] text-textMuted text-center">
          O valor de {formatBRLShort(amount)} já vai no código — não precisa
          digitar.
        </p>
      </div>

      {!showQr ? (
        <Button variant="ghost" size="md" icon={QrCode} onClick={() => setShowQr(true)}>
          Prefiro pagar pelo QR
        </Button>
      ) : (
        <div className="bg-card border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR do PIX" className="w-48 h-48 rounded-lg" />
          ) : (
            <div className="w-48 h-48 rounded-lg bg-gray-100 animate-pulse" />
          )}
          <p className="text-xs text-textMuted text-center">
            Abra o app do banco, escolha PIX e aponte a câmera.
          </p>
        </div>
      )}
    </div>
  );
}

function formatBRLShort(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
