import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Copy, Link2, LogIn, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import FundoNoturno from '../components/common/FundoNoturno';
import Logo from '../components/common/Logo';
import FundoDoLogin from '../components/auth/FundoDoLogin';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../dominio/identidade/papeis';
import { linkDoPedido, mensagemAoMotorista } from '../marca/pedidoAoMotorista';

/**
 * A PORTA DA RESPONSÁVEL QUE NÃO TEM O LINK.
 *
 * ⚠️ ESTA TELA DEIXOU DE CRIAR CONTA EM 09/09/2026, e o motivo é que ela
 * nunca conseguia.
 *
 * A entrada do responsável é o LINK, e ela é inteira do
 * [Invite.jsx](Invite.jsx): `/convite/:codigo` lê o código da URL, chama
 * `redeemInvite` e leva pro `/pai`. **Esse caminho não passa por aqui.**
 *
 * Então quem chega nesta tela é, por definição, quem NÃO tem o link. E até
 * ontem a única coisa que ela oferecia a essa pessoa era digitar um código de
 * 8 caracteres — que ela quase sempre também não tem, porque link e código
 * viajam na MESMA mensagem do WhatsApp: se a conversa sumiu, sumiram os dois.
 * A tela pedia a chave a quem tinha acabado de perder o chaveiro.
 *
 * O CAMPO SAIU, e com ele o aceite legal, o "Criar conta com Google" e o
 * e-mail/senha — sem código não há convite pra resgatar, e conta de
 * responsável sem criança vinculada é conta órfã. O que entrou no lugar está
 * em [marca/pedidoAoMotorista.js](../marca/pedidoAoMotorista.js): a mensagem
 * que ela manda pedindo o convite.
 *
 * ── POR QUE O PEDIDO É MELHOR QUE O CAMPO
 * Ele devolve um **link novo, que funciona**. O campo devolvia a chance de
 * errar uma letra num código lido por telefone — e código errado é
 * indistinguível, para ela, de convite que não existe.
 *
 * E há um caso que só o pedido resolve: **o motorista que ainda não usa o
 * app.** Ela não perdeu convite nenhum, nunca houve um. Para essa pessoa o
 * campo de código nunca teve resposta.
 *
 * ⚠️ O QUE ISTO FECHA, e a decisão é do dono: quem tem SÓ o código anotado
 * (ditado por telefone, escrito num papel) e não tem mais o link perde a
 * entrada digitada. Ela agora pede um link novo — o que resolve o problema
 * dela melhor, mas depende do motorista responder.
 *
 * Se um dia isso voltar: o mecanismo continua inteiro. `redeemInvite` aceita
 * `inviteCode`, `codigoDoTexto` ainda lê código de qualquer texto, e
 * `isValidInviteCodeFormat` ainda valida. O que saiu foi a TELA, não a porta.
 */
export default function FirstAccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading: authLoading } = useAuth();
  const [copiado, setCopiado] = useState(false);

  // Quem já tem sessão com papel não tem nada a fazer aqui.
  useEffect(() => {
    if (!authLoading && profile?.role) {
      const target = painelDe(profile);
      navigate(location.state?.from || target, { replace: true });
    }
  }, [authLoading, profile, navigate, location.state]);

  // Quem veio da bifurcação do login está NO MEIO de uma escolha: o
  // arrependimento provável dela é trocar de porta, não sair do app. Quem
  // chegou de qualquer outro jeito continua voltando pra porta da família.
  const veioDaEscolha = location.state?.de === 'escolha';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagemAoMotorista());
      setCopiado(true);
      toast.success('Mensagem copiada. Cole na conversa com o motorista.');
      setTimeout(() => setCopiado(false), 4000);
    } catch {
      // Sem permissão de área de transferência (iOS antigo, webview) o botão
      // não pode simplesmente não fazer nada — o WhatsApp continua aberto ao
      // lado, e é pra lá que ela vai.
      toast.error('Não deu pra copiar aqui. Use o botão do WhatsApp.');
    }
  };

  return (
    /**
     * DUAS COLUNAS NO MONITOR, EMPILHADO NO CELULAR.
     *
     * A responsável é quem mais chega pelo celular — é o link do WhatsApp
     * que a traz —, e por isso o empilhado continua sendo o desenho
     * principal. Mas ela não é SÓ celular: quem perdeu a mensagem e volta
     * pelo site costuma estar no computador, e ali a tira de 480px no meio
     * do monitor lê como app quebrado.
     *
     * Mesmo par da tela de login: `data-painel="web"` solta o teto e o
     * `w-screen` com translate é a garantia pra navegador sem `:has()`.
     */
    <div
      data-painel="web"
      className="relative left-1/2 w-screen -translate-x-1/2 bg-bg"
    >
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
        {/* ── tampa escura: a marca, no mesmo material da home ── */}
        <header className="relative overflow-hidden rounded-b-[28px] bg-night px-6 pb-7 pt-5 text-white lg:flex lg:flex-col lg:justify-between lg:rounded-none lg:px-14 lg:py-14">
          <FundoNoturno />

          <div className="relative">
            {/* Voltar vai pra porta da FAMÍLIA, não pra "/". Esta tela é do
              * responsável — quem está aqui está no caminho dele, e Voltar
              * tem que devolver ele pra frente dele. A exceção é quem veio da
              * bifurcação: essa pessoa volta pra ela. */}
            <Link
              to={veioDaEscolha ? '/login?criar=1' : '/familia'}
              className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-white/60 hover:text-white"
            >
              <ArrowLeft size={16} />{' '}
              {veioDaEscolha ? 'Voltar para a escolha' : 'Voltar'}
            </Link>
          </div>

          {/* Mesmo arranjo da tela do motorista: voltar no alto, miolo no
            * meio, domínio embaixo — senão o texto flutua num vazio de 300px
            * quando a coluna tem a altura de um monitor. */}
          <div className="relative">
            <div className="text-center lg:text-left">
              <Logo
                variant="stacked"
                tone="onDark"
                height={80}
                className="mx-auto lg:mx-0"
              />
              {/* ⚠️ A FAIXA DIZ O QUE ELA GANHA, e antes dizia o que ela tem
                * que fazer. "Primeiro acesso" / "Criar sua conta" descrevem o
                * formulário — e agora não há formulário nenhum. Do lado da
                * marca a pergunta continua sendo: por que eu faria isso.
                *
                * "Pra quem espera na porta" faz o par com "pra quem dirige"
                * da tela do motorista. */}
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-onNightAccent/80">
                pra quem espera na porta
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight lg:text-[2.1rem]">
                Acompanhe a perua do seu filho
              </h1>
              <p className="mx-auto mt-3 max-w-[22rem] text-sm leading-relaxed text-white/65 lg:mx-0">
                Você vê onde ela está, recebe o aviso quando ela chega e avisa
                quando ele não vai.{' '}
                <strong className="font-semibold text-white">
                  Sua conta nasce do convite do motorista
                </strong>{' '}
                — é ele que liga o seu filho a você.
              </p>
            </div>
          </div>

          <p className="relative hidden text-xs text-white/40 lg:block">
            alobuzinou.com.br
          </p>
        </header>

        {/* A costura entre marca e produto só existe empilhado: lado a lado, a
          * borda entre as duas colunas já faz esse trabalho. */}
        <div
          aria-hidden
          className="h-[2px] shrink-0 bg-gradient-to-r from-primary via-accent to-primary lg:hidden"
        />

        {/* ── O FUNDO AQUI LIGA MAIS TARDE QUE NO LOGIN, E A CONTA DIZ POR QUÊ
          *
          * Mesmo fundo, mesmo trio de regras
          * ([FundoDoLogin](../components/auth/FundoDoLogin.jsx)) — o que muda
          * é que o cartão desta tela tem **520px**, contra 380 do login. A
          * faixa livre à esquerda encolhe na mesma medida:
          *
          *   esquerda do cartão = 0,58·L − 52 (padding) − 520 (cartão)
          *   o cartão de fundo mais avançado alcança 284px
          *   0,58·L − 572 ≥ 284  →  L ≥ 1497px
          *
          * Por isso `min-[1500px]` e não `min-[1340px]`. Numa tela de 1440 o
          * slot do meio invadiria o cartão por ~21px, e a regra número um do
          * fundo é nunca ficar atrás dele.
          *
          * ⚠️ Se um dia o cartão desta tela estreitar, ESTE número desce
          * junto. `npm run testar:fundo` refaz as duas contas a partir dos
          * arquivos, então a divergência falha no teste em vez de aparecer na
          * tela. */}
        <main className="relative flex flex-1 flex-col bg-bg px-4 py-6 sm:px-6 lg:px-12 lg:py-16 min-[1500px]:pl-10 min-[1500px]:pr-[52px]">
          <FundoDoLogin assunto="convite" desde={1500} />
          <div className="relative z-10 mx-auto flex w-full max-w-[520px] flex-1 flex-col rounded-2xl border border-border bg-card p-5 shadow-float sm:p-7 lg:justify-center lg:p-8 min-[1500px]:mx-0 min-[1500px]:ml-auto">
            <div className="mb-5">
              <h2 className="text-xl font-extrabold leading-tight tracking-tight text-text lg:text-[1.55rem]">
                Você entra pelo convite do motorista
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-textMuted">
                É ele que liga o seu filho a você — então a conta não se cria
                daqui, ela nasce do link que ele manda.
              </p>
            </div>

            {/* O CAMINHO DE 9 EM 10 VEM PRIMEIRO, e ele não pede nada. */}
            <div className="rounded-2xl border border-primaryBorder bg-primarySoft p-4">
              <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text">
                <Link2 size={15} className="text-primary" />
                Já recebeu o link?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-primaryDark">
                É só abrir o link do WhatsApp — o convite vem dentro dele e a
                sua conta se cria por lá, <strong>sem digitar nada.</strong>
              </p>
            </div>

            {/* ⚠️ O QUE ANTES ERA UM CAMPO DE CÓDIGO.
              *
              * O divisor dizia "ou digite o código", e embaixo dele havia um
              * campo de 8 caracteres. Ele saiu em 09/09/2026: quem chega aqui
              * não tem o link, e link e código vêm na MESMA mensagem — então
              * quase sempre ela não tem nenhum dos dois. Pedir o código era
              * pedir a chave a quem perdeu o chaveiro.
              *
              * E o pedido serve um caso que o campo nunca serviu: o motorista
              * que ainda não usa o app. Aí não há convite perdido — nunca
              * houve convite. */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs text-textMuted">
                  não tem o convite?
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-text">
                Peça pro motorista da perua do seu filho.{' '}
                <span className="text-textMuted">
                  Ele se cadastra, cadastra a turma e te manda o convite — e aí
                  você acompanha tudo por aqui.
                </span>
              </p>

              <a
                href={linkDoPedido()}
                target="_blank"
                rel="noopener noreferrer"
                className="tap inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-primary text-base font-bold text-white shadow-focus hover:bg-primaryDark focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <MessageCircle size={20} />
                Pedir pelo WhatsApp
              </a>

              {/* A SEGUNDA SAÍDA EXISTE PORQUE A PRIMEIRA DEPENDE DE APP
                * INSTALADO. Dentro da webview do Instagram, ou num computador
                * sem WhatsApp Web logado, o `wa.me` abre uma página que não
                * resolve nada — e a mensagem copiada serve em qualquer
                * conversa, inclusive SMS. */}
              <button
                type="button"
                onClick={copiar}
                className="tap flex w-full items-center justify-center gap-1.5 py-1 text-sm font-semibold text-textMuted hover:text-text"
              >
                <Copy size={15} />
                {copiado ? 'Mensagem copiada' : 'Copiar a mensagem'}
              </button>

              {/* A mensagem fica À VISTA, e não atrás do botão.
                *
                * Ela sai do nome dela para um contato de trabalho, e ninguém
                * manda texto que não leu. Mostrar antes é o que evita que ela
                * descubra o teor só depois de enviar — e é a mesma razão pela
                * qual a proposta do dono abre o WhatsApp para ele LER antes
                * de enviar. */}
              <p className="whitespace-pre-line rounded-xl border border-border bg-surface p-3 text-xs leading-relaxed text-textMuted">
                {mensagemAoMotorista()}
              </p>
            </div>

            {/* AS DUAS SAÍDAS, EM UMA LINHA
              * Quem errou a tela precisa de porta — mas eram cartões grandes
              * no pé, do tamanho do conteúdo principal, e empurravam o
              * assunto da tela pra cima. Como link discreto ele continua
              * achável por quem procura, sem competir com quem está aqui pelo
              * motivo certo.
              *
              * O "Sou motorista" SAIU daqui: a regra é assimétrica — o
              * motorista pode ver coisa de responsável, o responsável não
              * pode ver coisa de motorista. Quem é motorista e caiu aqui tem
              * "Já tenho conta" ao lado. */}
            <div className="mt-auto flex items-center justify-center gap-3 pt-8 text-sm font-semibold text-textMuted lg:mt-8">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="tap inline-flex items-center gap-1.5 py-2 hover:text-text"
              >
                <LogIn size={14} />
                Já tenho conta
              </button>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4 text-[11px] text-textMuted">
              <Link to="/termos" className="hover:underline">
                Termos de Uso
              </Link>
              <span aria-hidden>·</span>
              <Link to="/privacidade" className="hover:underline">
                Política de Privacidade
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
