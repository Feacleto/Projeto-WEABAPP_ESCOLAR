import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bus, LogOut, Ticket } from 'lucide-react';
import Logo from '../components/common/Logo';
import FalhaAoLerConta from '../components/common/FalhaAoLerConta';
import { useAuth } from '../hooks/useAuth';
import { painelDe } from '../dominio/identidade/papeis';

/**
 * A SALA DE ESPERA — sessão sem papel, e duas saídas.
 *
 * POR QUE ESTA TELA EXISTE
 * Quem toca em "Entrar com Google" ganha uma sessão do Firebase antes de
 * qualquer decisão nossa. Antes, essa conta era APAGADA na hora e a pessoa
 * recebia um erro — o que funcionava enquanto a única forma de entrar era ter
 * conta. Não funciona mais: o Google passou a ser também o caminho de quem
 * está chegando.
 *
 * A ALTERNATIVA ERRADA ERA CRIAR A CONTA COMO MOTORISTA, e o custo dela é
 * concreto. A mãe que recebe o convite no WhatsApp, ignora o link e toca em
 * "Entrar com Google" viraria motorista. Quando ela abrisse o convite depois,
 * o `redeemInvite` recusaria — ele já barra conta de motorista virando
 * responsável — e ela ficaria presa, sem saída dentro do app, com um e-mail
 * queimado.
 *
 * ENTÃO A PERGUNTA MUDOU. Não é "você é motorista ou responsável?": ela pede
 * que a pessoa se classifique dentro de um organograma que nunca viu, e obriga
 * a mentir quem é as duas coisas (o motorista que também é pai de aluno — ver
 * dominio/vitrine/frentes.js). A pergunta daqui é sobre o que ela TEM NA MÃO:
 * um convite, ou uma van.
 *
 * QUEM CHEGA PELO LINK NUNCA VÊ ESTA TELA. O código vem na URL
 * (`/convite/:codigo`) e o app já sabe de que lado ela está. Isto aqui é o
 * caminho de exceção, não o principal.
 *
 * A CONTA PENDURADA É INERTE. Sessão sem documento em `users` não lê nada:
 * toda regra do app passa por `isAppUser()`, que exige o documento. Quem
 * abandonar esta tela deixa um registro de autenticação vazio, e nada mais.
 */
export default function Comecar() {
  const { user, profile, loading, logout, perfilIndisponivel } = useAuth();
  const navigate = useNavigate();

  // Se o perfil aparecer, esta tela não é mais o lugar dela — a pessoa
  // escolheu uma saída e voltou.
  //
  // ⚠️ ESTE COMENTÁRIO PROMETIA COBRIR A FALHA DE REDE EM `getUserDoc`, E NÃO
  // COBRIA. Ele só reage a um `profile` que APARECE, e nada aqui relia nada:
  // quem chegava por leitura falha ficava lendo "Nada foi criado ainda" até
  // desistir. Quem cobre esse caso agora é o `perfilIndisponivel` abaixo, com
  // tela própria e botão de tentar de novo.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    if (profile?.role) navigate(painelDe(profile), { replace: true });
  }, [loading, user, profile, navigate]);

  // A LEITURA FALHOU: esta tela mentiria duas vezes ("falta ligar sua conta" e
  // "nada foi criado ainda") para quem já tem conta. Ela é o destino do
  // `Login` também, então o desvio precisa estar aqui e não só nos guardas do
  // `App`.
  if (perfilIndisponivel) return <FalhaAoLerConta />;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-bg px-6 py-10">
      <div className="mx-auto w-full max-w-mobile space-y-6">
        <div className="text-center">
          <Logo variant="stacked" height={80} className="mx-auto" />
          <h1 className="mt-5 text-2xl font-bold text-text">
            Falta ligar sua conta
          </h1>
          <p className="mt-2 text-sm text-textMuted">
            Sua entrada funcionou{user?.email ? ` como ${user.email}` : ''}. Só
            precisamos saber por onde você chegou.
          </p>
        </div>

        <div className="space-y-3">
          {/* A ordem não é neutra: o convite vem primeiro porque quem cai aqui
            * por engano é quase sempre a responsável — o motorista costuma vir
            * do "Cadastrar", que já diz o que ele é. */}
          <Link
            to="/first-access"
            className="tap flex items-start gap-3 rounded-xl border-2 border-border bg-card p-4 hover:border-primary"
          >
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primaryChip">
              <Ticket size={19} className="text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-text">
                Recebi um convite de um motorista
              </span>
              <span className="mt-0.5 block text-sm text-textMuted">
                Ele te mandou o link, ou você ainda vai pedir um pra ele.
              </span>
            </span>
          </Link>

          <Link
            to="/quero-fazer-parte"
            className="tap flex items-start gap-3 rounded-xl border-2 border-border bg-card p-4 hover:border-primary"
          >
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primaryChip">
              <Bus size={19} className="text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-text">
                Sou motorista e quero criar minha operação
              </span>
              <span className="mt-0.5 block text-sm text-textMuted">
                Cadastre suas crianças, rode a rota e cobre a mensalidade.
              </span>
            </span>
          </Link>
        </div>

        <p className="text-center text-xs text-textMuted">
          Nada foi criado ainda. Você escolhe agora, e dá para sair e voltar.
        </p>

        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
          className="tap mx-auto flex items-center gap-1.5 text-sm text-textMuted hover:text-text"
        >
          <LogOut size={15} /> Sair desta conta
        </button>
      </div>
    </div>
  );
}
