import { useState } from 'react';
import { QrCode, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import AppSheet from '../common/AppSheet';
import { useAuth } from '../../hooks/useAuth';
import { PIX_KEY_TYPES } from '../../services/userService';

/**
 * "MOSTRAR PIX DA PERUA" — na rota, sem senha (04/10/2026, simulação "Rota e
 * Central" aprovada pelo dono).
 *
 * A mãe pergunta no portão "pra onde eu mando?", e quem está com o celular
 * pode ser a auxiliar. Por isso o nome é "da perua", e não "meu": é ela quem
 * fala. A folha SÓ MOSTRA a chave e copia — trocar a chave continua em
 * `/tio/pix`, atrás da senha, porque foi exatamente trocar a chave que a
 * auxiliar fazia antes de 04/10/2026.
 *
 * Sem chave cadastrada, o botão não aparece: na rota não há o que fazer com
 * isso, e cadastrar pede a senha.
 *
 * `perfil` é o do MOTORISTA quando quem abre é a auxiliar na conta dela
 * (05/10/2026): a chave é dele, não dela.
 *
 * `gatilho` (opcional) troca o botão que abre: a folha da marca da auxiliar
 * (05/10/2026) abre esta MESMA folha com um botão de contorno dela, "Ver o
 * PIX da perua". A chave continua mostrada por um lugar só.
 */
export default function PixDaPerua({ perfil = null, gatilho = null }) {
  const { profile: proprio } = useAuth();
  const profile = perfil || proprio;
  const [aberta, setAberta] = useState(false);
  const chave = String(profile?.pixKey || '').trim();
  if (!chave) return null;
  const tipo = PIX_KEY_TYPES[profile?.pixKeyType]?.label || 'Chave PIX';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(chave);
      toast.success('Chave copiada.');
    } catch {
      toast.error('Não deu pra copiar. Mostre a chave na tela.');
    }
  };

  return (
    <>
      {gatilho ? gatilho(() => setAberta(true)) : (
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="tap flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 text-left text-base font-bold text-text"
      >
        <QrCode size={20} className="shrink-0 text-primary" aria-hidden="true" />
        <span className="flex-1">Mostrar PIX da perua</span>
        <span className="text-sm font-medium text-textMuted">só a chave</span>
      </button>
      )}

      <AppSheet open={aberta} onClose={() => setAberta(false)} title="PIX da perua" icon={QrCode}>
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-sm text-textMuted">{tipo}</p>
            <p className="break-all text-xl font-bold text-text">{chave}</p>
            {profile?.name && <p className="mt-1 text-sm text-textMuted">{profile.name}</p>}
          </div>
          <button
            type="button"
            onClick={copiar}
            className="tap flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-white shadow-focus"
          >
            <Copy size={20} aria-hidden="true" />
            Copiar
          </button>
          <p className="text-sm text-textMuted">Trocar a chave pede a senha do motorista.</p>
        </div>
      </AppSheet>
    </>
  );
}
