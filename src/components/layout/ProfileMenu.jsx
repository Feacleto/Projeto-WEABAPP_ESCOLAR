import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Receipt } from 'lucide-react';
import Avatar from '../common/Avatar';
import Logo from '../common/Logo';
import { useAuth } from '../../hooks/useAuth';
import { fimDoTrial } from '../../dominio/associacao/trial.js';
import { destinoAposSair } from '../../dominio/vitrine/frentes';
import { CENA_SAIDA, travessar } from '../../marca/travessia';
import { useCobrancaLigada } from '../../hooks/useCobrancaLigada';

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
 * ⚠️ O MENU FICOU CURTO (03/10/2026, pedido do dono). "Ver o tutorial de
 * novo" e "Falar com o suporte" saíram daqui: os dois já moram na tela de
 * perfil, e repetidos aqui eles disputavam o olho com o "Ver meu perfil",
 * que é o caminho principal. Sobraram quem está logado, o perfil em
 * destaque, o plano (só motorista, com a cobrança ligada) e sair.
 *
 * Props:
 *   - role:      'admin' | 'parent'
 *   - basePath:  '/tio' | '/pai'
 *   - active:    bool — já está na tela de perfil (mantém o anel de foco)
 */
export default function ProfileMenu({ role, basePath, active = false }) {
  const navigate = useNavigate();
  const cobranca = useCobrancaLigada();
  const { user, profile, logout } = useAuth();
  const [open, setOpen] = useState(false);
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

    // A CORTINA SOBE ANTES DO LOGOUT, e essa ordem é o conserto.
    //
    // Ela viajava no `state` da navegação e a saída nunca aparecia: ao zerar a
    // sessão, o PrivateRoute devolve `<Navigate to="/login">`, que navega
    // dentro de um efeito — podendo chegar DEPOIS do nosso `navigate` e levar
    // o `state` embora. Subindo antes, a cortina cobre a tela atual e o
    // logout, a troca de rota e qualquer redirecionamento acontecem por baixo
    // dela. De quebra é a ordem dramática certa: o ambiente fecha, e só então
    // a pessoa está do lado de fora.
    //
    // O papel é lido antes do logout — depois dele o profile é null. E se a
    // cortina falhar, o logout e a navegação acontecem do mesmo jeito: sair
    // nunca depende do teatro.
    travessar(CENA_SAIDA, role);
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
        // A área de toque tem 44×44 mesmo com o avatar pequeno dentro.
        className={`tap flex h-11 w-11 items-center justify-center rounded-full ${
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
          <div className="border-b border-neutro p-3">
            <div className="flex items-center gap-3">
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
                <span className="block truncate text-xs text-textMuted">
                  {user?.email || (role === 'admin' ? 'Motorista' : 'Responsável')}
                </span>
              </span>
            </div>
            {/* O PERFIL É O CAMINHO PRINCIPAL DO MENU, e por isso é botão cheio
              * — era um link pequeno, com o mesmo peso do tutorial e do suporte
              * logo abaixo. Tutorial, suporte, avisos e privacidade moram lá. */}
            <button
              type="button"
              role="menuitem"
              onClick={() => go(() => navigate(`${basePath}/profile`))}
              className="tap mt-3 flex h-11 w-full items-center justify-center gap-1 rounded-xl bg-primary text-sm font-bold text-white"
            >
              Ver meu perfil
              <ChevronRight size={16} />
            </button>
          </div>

          {/* MEU PLANO — só pro motorista, e só aqui.
            *
            * ⚠️ O NOME É "MEU PLANO" (03/10/2026, decisão do dono), e não
            * "Minha associação", "Minha assinatura" nem "taxa": é como ele fala
            * do plano do celular — neutro, sem cara de cobrança. Embaixo vai só
            * o ESTADO, em cinza; valor em reais só dentro da tela.
            *
            * A tela da taxa tinha uma porta só: o aviso de cobrança em atraso.
            * Quem está em dia não tinha como abrir a própria fatura, ver o
            * histórico do que já pagou nem conferir a conta que gerou o valor.
            * Cobrança que só é visível quando está atrasada ensina o associado
            * a associar a palavra "taxa" a susto — e some justamente no mês em
            * que ele quer conferir se o desconto combinado foi aplicado. */}
          {/* Some com a cobrança desligada: não há fatura nem conta a conferir. */}
          {role === 'admin' && cobranca && (
            <MenuItem
              icon={Receipt}
              label="Meu plano"
              detalhe={estadoDoPlano(profile)}
              onClick={() => go(() => navigate('/tio/taxa'))}
            />
          )}
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
            * outra coisa — e resolve os dois casos.
            *
            * É o LOGOTIPO e não o nome escrito, e pro caso que motivou isto a
            * diferença conta: quem troca de celular vai procurar o app na
            * loja, e ali o que ela varre é a lista de ÍCONES. Reconhecer o
            * desenho é mais rápido que lembrar como se escreve. O nome não se
            * perde pra quem usa leitor de tela — o <Logo> emite `role="img"`
            * com `aria-label="Alô Buzinou"`.
            *
            * Pequeno de propósito (15px de altura): é assinatura de rodapé, e
            * o único item colorido do menu tem que continuar sendo o "Sair".
            *
            * Sem número de versão junto: o package.json está em 0.0.0, e
            * versão falsa no rodapé é pior que versão nenhuma. */}
          <div className="flex justify-center border-t border-neutro px-3 py-3">
            <Logo height={15} />
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * O estado do plano numa palavra, em cinza: nunca valor, nunca vermelho
 * enquanto estiver em dia ou em teste — o menu não é lugar de cobrar.
 */
function estadoDoPlano(profile) {
  if (profile?.suspenso) return 'Pausado';
  if (profile?.plano === 'mensal') return 'Mensal';
  if (profile?.plano === 'anual') return 'Anual';
  const fim = fimDoTrial(profile?.trialInicio);
  if (fim) {
    return `Em teste até ${fim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  }
  return 'Em teste';
}

function MenuItem({ icon: Icon, label, detalhe, onClick, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`tap flex w-full items-center gap-3 px-3 py-3 text-left text-sm font-semibold ${
        danger ? 'text-dangerText' : 'text-text'
      }`}
    >
      <Icon size={17} className={danger ? 'text-danger' : 'text-textMuted'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {detalhe && (
          <span className="block truncate text-xs font-normal text-textMuted">{detalhe}</span>
        )}
      </span>
    </button>
  );
}
