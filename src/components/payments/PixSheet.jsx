import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { Copy, Key } from 'lucide-react';
import AppSheet from '../common/AppSheet';
import Button from '../common/Button';
import PixForm from './PixForm';
import { useAuth } from '../../hooks/useAuth';
import { buildPixPayload } from '../../dominio/cobranca/pixPayload';
import { PIX_KEY_TYPES } from '../../services/userService';

/**
 * "MOSTRAR MEU PIX" — SÓ MOSTRAR, NUNCA EDITAR (03/10/2026).
 *
 * Aberto da tela TRANCADA do Financeiro, sem senha: o motorista no portão
 * mostra o QR para a mãe pagar ali mesmo. Por isso este modo não tem
 * formulário — trocar a chave sem senha deixaria quem pegou o celular pôr a
 * chave DELE no lugar, e as mensalidades da turma cairiam na conta errada.
 * Trocar a chave continua no modo normal, atrás da senha.
 *
 * O código vai SEM valor: cada família digita o dela.
 */
function MeuPix({ onClose }) {
  const { profile } = useAuth();
  const [qr, setQr] = useState(null);
  const payload = buildPixPayload({
    key: profile?.pixKey,
    keyType: profile?.pixKeyType,
    merchantName: profile?.companyName || profile?.name,
    city: profile?.companyCity || profile?.city,
  });

  useEffect(() => {
    if (!payload) return;
    QRCode.toDataURL(payload, { width: 360, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [payload]);

  if (!profile?.pixKey || !payload) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base text-textBody">
          Você ainda não cadastrou a chave PIX. Cadastre no Financeiro, com a sua senha.
        </p>
        <Button onClick={onClose}>Fechar</Button>
      </div>
    );
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Código PIX copiado.');
    } catch {
      toast.error('Não deu pra copiar.');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {qr ? (
        <img src={qr} alt="QR do meu PIX" className="w-56 h-56 rounded-lg" />
      ) : (
        <div className="w-56 h-56 rounded-lg bg-neutro" />
      )}
      <p className="text-[17px] text-textBody break-all">
        {PIX_KEY_TYPES[profile.pixKeyType]?.label || 'Chave'}: {profile.pixKey}
      </p>
      <Button variant="secondary" icon={Copy} onClick={copiar}>
        Copiar código PIX
      </Button>
      <Button onClick={onClose}>Fechar</Button>
    </div>
  );
}

/**
 * A chave PIX, como folha.
 *
 * Os três caminhos que levam aqui — o perfil, o banner do financeiro e o
 * bloco de pendências — são todos interrupções de outra tarefa. O motorista
 * está conferindo o mês, vê "cadastre sua chave", resolve, e quer voltar
 * pro mês. Como página, voltar era um gesto a mais e a tela recarregava
 * do zero.
 */
export default function PixSheet({ open, onClose, mostrar = false }) {
  if (mostrar) {
    return (
      <AppSheet open={open} onClose={onClose} title="Meu PIX" icon={Key}>
        <MeuPix onClose={onClose} />
      </AppSheet>
    );
  }
  return (
    <AppSheet
      open={open}
      onClose={onClose}
      title="Chave PIX"
      subtitle="É a chave que os pais copiam com um toque pra pagar a mensalidade."
      icon={Key}
    >
      <PixForm onDone={onClose} />
    </AppSheet>
  );
}
