import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, GraduationCap, LifeBuoy, LogOut } from 'lucide-react';
import Avatar from '../common/Avatar';
import ConfirmDialog from '../common/ConfirmDialog';
import SupportSheet from '../support/SupportSheet';
import { useAuth } from '../../hooks/useAuth';
import { destinoAposSair } from '../../utils/frentes';

/**
 * O perfil como MENU SUSPENSO, não como viagem.
 *
 * Tocar no rosto no canto do cabeçalho levava pra /profile — uma tela cheia,
 * com foto, dados, PIX, sons, exclusão de conta. Só que quase toda vez que a
 * pessoa toca ali ela quer UMA de quatro coisas: sair, rever o tutorial,
 * pedir ajuda, ou conferir com que conta está logada. Nenhuma delas justifica
 * perder a tela onde ela estava — e no celular, sair de uma tela e ter que
 * achar o caminho de volta é exatamente o que faz o usuário se sentir perdido.
 *
 * Então o toque abre um menu ANCORADO no próprio rosto: o conteúdo continua
 * atrás, fechar devolve a pessoa ao mesmo pixel, e as duas ações que de fato
 * abrem outra superfície (suporte, e a ficha completa) partem daqui de forma
 * explícita.
 *
 * O TUTORIAL NÃO ABRE DAQUI DIRETO
 * O tour ilumina elementos da tela INICIAL; aberto de dentro do financeiro
 * ele apontaria pra coisas que não estão na tela. Por isso reusamos o mesmo
 * contrato do perfil: navega pra raiz do papel com `state.openTour`, e o
 * layout (TioLayout/PaiLayout) abre o tour com a tela certa embaixo.
 *
 * Props:
 *   - role:      'admin' | 'parent'
 *   - basePath:  '/tio' | '/pai'
 *   - active:    bool — já está na tela de perfil (mantém o anel de foco)
 */
export default function ProfileMenu({ role, basePath, active = false }) {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const wrapRef = useRef(null);

  // Fecha com ESC e com toque fora. As duas saídas importam: no celular o
  // toque fora é o gesto natural, no desktop é o ESC.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const go = (fn) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Meu perfil"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`tap rounded-full p-0.5 ${
          open || active ? 'ring-2 ring-primary' : ''
        }`}
      >
        <Avatar
          photoURL={profile?.photoURL}
          kind={role === 'admin' ? 'admin' : 'adult'}
          gender={profile?.gender}
          seed={user?.uid}
          name={profile?.name}
          size="sm"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu do perfil"
          className="animate-fest-balloon-in absolute right-0 top-full mt-2 w-[min(17rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-gray-100 bg-card shadow-2xl shadow-black/20"
        >
          {/* Quem está logado. É a pergunta silenciosa de quem toca aqui —
           * principalmente em casa, onde pai e mãe usam o mesmo celular. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => go(() => navigate(`${basePath}/profile`))}
            className="tap flex w-full items-center gap-3 border-b border-gray-100 p-3 text-left"
          >
            <Avatar
              photoURL={profile?.photoURL}
              kind={role === 'admin' ? 'admin' : 'adult'}
              gender={profile?.gender}
              seed={user?.uid}
              name={profile?.name}
              size="md"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-text">
                {profile?.name || 'Minha conta'}
              </span>
              <span className="block truncate text-[11px] text-textMuted">
                {user?.email ||
                  (role === 'admin' ? 'Motorista' : 'Responsável')}
              </span>
              <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary">
                Ver perfil completo
                <ChevronRight size={12} />
              </span>
            </span>
          </button>

          <MenuItem
            icon={GraduationCap}
            label="Ver o tutorial de novo"
            onClick={() =>
              go(() => navigate(basePath, { state: { openTour: true } }))
            }
          />
          <MenuItem
            icon={LifeBuoy}
            label="Falar com o suporte"
            onClick={() => go(() => setSupportOpen(true))}
          />
          <MenuItem
            icon={LogOut}
            label="Sair da conta"
            danger
            onClick={() => go(() => setConfirmLogout(true))}
          />
        </div>
      )}

      {/* PORTAL, E NÃO FILHO DO CABEÇALHO.
       *
       * O cabeçalho é `sticky z-20`, e isso abre um contexto de empilhamento
       * próprio: um `fixed z-50` declarado aqui dentro continua preso ao
       * teto de 20 do pai. A barra inferior é z-30 — o "Sair da conta?"
       * apareceria POR BAIXO dela, com o botão de confirmar tapado pela
       * pílula de navegação. Levar as duas superfícies pro body tira elas
       * desse teto. */}
      {createPortal(
        <>
          <SupportSheet
            open={supportOpen}
            onClose={() => setSupportOpen(false)}
            uid={user?.uid}
            role={role}
          />

          <ConfirmDialog
            open={confirmLogout}
            title="Sair da conta?"
            description="Você precisará entrar de novo com email e senha (ou Google) na próxima vez."
            confirmLabel="Sim, sair"
            variant="danger"
            onConfirm={async () => {
              // O papel tem que ser lido ANTES do logout: depois dele o
              // profile vira null e a informação já não existe. Mesma regra
              // do perfil.
              const destino = destinoAposSair(role);
              await logout();
              navigate(destino, { replace: true });
            }}
            onCancel={() => setConfirmLogout(false)}
          />
        </>,
        document.body,
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`tap flex w-full items-center gap-3 px-3 py-3 text-left text-sm font-semibold ${
        danger ? 'text-danger' : 'text-text'
      }`}
    >
      <Icon size={17} className={danger ? 'text-danger' : 'text-textMuted'} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
