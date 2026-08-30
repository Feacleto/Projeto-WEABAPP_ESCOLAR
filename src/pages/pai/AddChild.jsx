import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Ticket, Check, Link2 } from 'lucide-react';
import AppSheet from '../../components/common/AppSheet';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { useAuth } from '../../hooks/useAuth';
import { redeemInvite } from '../../services/authService';
import { lookupInvite, normalizeInviteCode } from '../../services/inviteCodeService';
import { isValidInviteCodeFormat } from '../../utils/generateInviteCode';

/**
 * Adicionar outro filho a uma conta que já existe — /pai/adicionar-filho
 *
 * Esta operação simplesmente não existia: `signupWithInvite` sempre criava
 * conta nova, então a mãe de dois irmãos precisava de dois emails e trocava
 * de login pra ver o outro filho.
 *
 * Dois passos de propósito: primeiro confirmamos QUEM é a criança, depois
 * ele confirma. Vincular direto sem mostrar o nome deixaria o responsável
 * sem saber o que aconteceu se digitasse um código errado.
 */
function AddChildBody({ onDone }) {
  const navigate = useNavigate();
  const { refreshProfile, setActiveChildId } = useAuth();

  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState(null);

  const onCheck = async (e) => {
    e.preventDefault();
    setError(null);
    setChecking(true);
    try {
      const data = await lookupInvite(code);
      setPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  const onLink = async () => {
    setLinking(true);
    try {
      const res = await redeemInvite({ inviteCode: normalizeInviteCode(code) });
      // Já deixa o filho novo em foco — foi o que ele acabou de pedir.
      if (res?.childId) setActiveChildId(res.childId);
      await refreshProfile();
      toast.success(`${res?.childFirstName || 'Criança'} adicionado à sua conta!`);
      // A página volta pro painel; a folha só se fecha — o painel já está
      // atrás dela, e ele acabou de ser atualizado pelo refreshProfile.
      if (onDone) onDone();
      else navigate('/pai', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setLinking(false);
    }
  };

  return (
    <div className="flex flex-col">

      <div className="bg-sunken border border-border rounded-xl p-4 mb-5 flex gap-3">
        <Link2 size={18} className="text-textMuted shrink-0 mt-0.5" />
        <p className="text-xs text-textMuted leading-relaxed">
          Se você tem o <span className="text-text font-semibold">link</span>,
          basta abri-lo — ele já reconhece sua conta e adiciona o filho. Este
          campo é pra quando você só tem o código.
        </p>
      </div>

      {!preview ? (
        <form onSubmit={onCheck} className="space-y-4">
          <Input
            label="Código do convite"
            placeholder="TN2K9F4B"
            icon={Ticket}
            value={code}
            onChange={(e) => {
              setCode(normalizeInviteCode(e.target.value).slice(0, 8));
              setError(null);
            }}
            autoCapitalize="characters"
            maxLength={8}
            hint="Começa com TN. Com o link do convite, não precisa digitar nada."
            error={error}
            required
            autoFocus
          />
          <Button
            type="submit"
            loading={checking}
            disabled={!isValidInviteCodeFormat(code)}
          >
            Procurar
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-800">
              encontramos
            </p>
            <p className="text-xl font-bold text-text">
              {preview.childFirstName}
            </p>
            <p className="text-xs text-emerald-900/75">
              {preview.companyName ||
                (preview.driverFirstName
                  ? `Perua do Tio ${preview.driverFirstName}`
                  : 'Perua parceira')}
            </p>
          </div>

          <Button icon={Check} loading={linking} onClick={onLink}>
            Sim, é meu filho — adicionar
          </Button>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              setCode('');
            }}
            className="w-full text-sm text-textMuted py-2"
          >
            Não é — tentar outro código
          </button>

          <p className="text-xs text-textMuted text-center">
            Depois de adicionar, você troca entre as crianças na tela de início.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * CASCA 1 — a página. Link direto e o gesto de voltar do sistema.
 */
export default function AddChild() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col px-6 py-6">
      <Link
        to="/pai"
        className="tap -ml-1 mb-4 inline-flex items-center gap-1 self-start p-1 text-sm text-textMuted"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="mb-5 space-y-1">
        <h1 className="text-2xl font-bold text-text">Adicionar outro filho</h1>
        <p className="text-sm text-textMuted">
          Use o convite que o motorista mandou pra segunda criança.
        </p>
      </div>

      <AddChildBody onDone={() => navigate('/pai', { replace: true })} />
    </div>
  );
}

/**
 * CASCA 2 — a folha. É por onde o seletor de filhos e o perfil abrem.
 *
 * Nos dois casos o responsável está no meio de outra coisa: trocando de
 * filho, ou conferindo os dados dele. Digitar um código de convite não
 * justifica trocar de tela — ainda mais numa tela que, se ele desistir,
 * exige achar o caminho de volta.
 */
export function AddChildSheet({ open, onClose }) {
  return (
    <AppSheet
      open={open}
      onClose={onClose}
      title="Adicionar outro filho"
      subtitle="Use o convite que o motorista mandou pra segunda criança."
      icon={Ticket}
    >
      {open && <AddChildBody onDone={onClose} />}
    </AppSheet>
  );
}
