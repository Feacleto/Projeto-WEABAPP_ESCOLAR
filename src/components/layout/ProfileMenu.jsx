import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  GraduationCap,
  LifeBuoy,
  LogOut,
  Receipt,
} from 'lucide-react';
import Avatar from '../common/Avatar';
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
  const [supportOpen, setSupportOpen] = useState(false);
  const wrapRef = useRef(null);

  /**
   * SAIR É DIRETO — sem confirmação.
   *
   * Havia um "Sair da conta?" no caminho, e ele custava mais do que
   * protegia. Sair já exige dois toques deliberados: abrir o menu no rosto e
   * escolher o último item, que é o único vermelho da lista. Ninguém chega
   * ali sem querer.
   *
   * E o que ele evitava era barato: reentrar. O que ele cobrava era de todo
   * mundo, toda vez — inclusive de quem troca de conta com frequência, que é
   * o caso de quem tem o app instalado num celular compartilhado.
   *
   * O papel é lido ANTES do logout: depois dele o profile vira null e a
   * informação já não existe. É o que decide se a pessoa volta pra porta da
   * família ou pra do motorista.
   */
  const sair = async () => {
    const destino = destinoAposSair(role);
    await logout();
    navigate(destino, { replace: true });
  };

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
          className="animate-fest-balloon-in absolute right-0 top-full mt-2 w-[min(17rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-neutro bg-card shadow-float"
        >
          {/* Quem está logado. É a pergunta silenciosa de quem toca aqui —
           * principalmente em casa, onde pai e mãe usam o mesmo celular. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => go(() => navigate(`${basePath}/profile`))}
            className="tap flex w-full items-center gap-3 border-b border-neutro p-3 text-left"
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

          {/* MINHA ASSOCIAÇÃO — só pro motorista, e só aqui.
            *
            * A tela da taxa tinha uma porta só: o aviso de cobrança em atraso.
            * Quem está em dia não tinha como abrir a própria fatura, ver o
            * histórico do que já pagou nem conferir a conta que gerou o valor.
            * Cobrança que só é visível quando está atrasada ensina o associado
            * a associar a palavra "taxa" a susto — e some justamente no mês em
            * que ele quer conferir se o desconto combinado foi aplicado. */}
          {role === 'admin' && (
            <MenuItem
              icon={Receipt}
              label="Minha associação"
              onClick={() => go(() => navigate('/tio/taxa'))}
            />
          )}
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
            onClick={() => go(sair)}
          />

          {/* O NOME DO PRODUTO, e este é o único lugar dele dentro do app.
            *
            * O cabeçalho cede o topo pra marca do MOTORISTA — "Tio Nino" — e
            * isso está certo: é a proposta de valor dele, e o app do
            * responsável tem que parecer o transporte que ele contratou.
            *
            * O efeito colateral é que "Alô Buzinou" não aparecia em canto
            * nenhum que ela conseguisse achar, e isso morde em dois momentos
            * concretos: quando ela troca de celular e vai procurar o app na
            * loja, e quando precisa reclamar de algo que não é do motorista.
            *
            * Aqui não disputa nada — está no fim de um menu que ela abre pra
            * outra coisa, em texto secundário — e resolve os dois casos.
            *
            * Sem número de versão junto: o package.json está em 0.0.0, e
            * versão falsa no rodapé é pior que versão nenhuma. */}
          <p className="border-t border-neutro px-3 py-2.5 text-center text-xs text-textMuted">
            Alô Buzinou
          </p>
        </div>
      )}

      {/* PORTAL, E NÃO FILHO DO CABEÇALHO.
       *
       * O cabeçalho é `sticky z-20`, e isso abre um contexto de empilhamento
       * próprio: um `fixed z-50` declarado aqui dentro continua preso ao teto
       * de 20 do pai. A barra inferior é z-30 — a folha apareceria POR BAIXO
       * dela, com o rodapé tapado pela pílula de navegação. O portal tira essa
       * superfície do teto.
       *
       * Era o mesmo motivo do diálogo de sair, que morava aqui e saiu junto
       * com a confirmação. */}
      {createPortal(
        <SupportSheet
          open={supportOpen}
          onClose={() => setSupportOpen(false)}
          uid={user?.uid}
          role={role}
        />,
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
