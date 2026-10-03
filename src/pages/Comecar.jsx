import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bus, LogOut, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '../components/common/Spinner';
import { ligarSessaoComoMotorista } from '../services/associadoService';
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
 * ⚠️ ATUALIZAÇÃO 03/10/2026 (decisão do dono): A PERGUNTA VOLTOU A SER "QUEM
 * VOCÊ É", e o motorista vem PRIMEIRO. A versão "o que você tem na mão" pedia
 * leitura demais para uma escolha de um toque — o dono quer a tela simples:
 * **Sou** motorista / **Sou** responsável, com o "Sou" em negrito e uma linha
 * curta embaixo que não deixa dúvida de qual é qual. O risco que a pergunta
 * antiga cobria (a mãe virando motorista) segue coberto pelo TEXTO: a porta
 * do motorista fala em van, a da família fala do filho. E o motorista vem
 * primeiro porque é o usuário principal do produto.
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
  const { user, profile, loading, logout, perfilIndisponivel, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [criando, setCriando] = useState(false);

  // "SOU MOTORISTA" CRIA A CONTA AQUI (02/10/2026). Antes era um link para
  // `/quero-fazer-parte`, que pedia de novo o e-mail que o Google acabou de
  // confirmar e uma senha que o serviço descartava. Quem chega nesta tela já
  // tem sessão — falta só o documento. O resto (nome, WhatsApp, marca,
  // cidade) é o card do primeiro acesso, com o app por baixo.
  const souMotorista = async () => {
    setCriando(true);
    try {
      await ligarSessaoComoMotorista();
      await refreshProfile();
      navigate('/tio', { replace: true });
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra criar sua conta. Tente de novo.');
      setCriando(false);
    }
  };

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
          <h1 className="mt-5 text-2xl font-extrabold text-text">
            Como você vai usar o app?
          </h1>
          {user?.email && (
            <p className="mt-2 text-sm text-textMuted">Você entrou como {user.email}.</p>
          )}
        </div>

        {/* AS DUAS PORTAS DO DESIGN SYSTEM: a do motorista é CHEIA (verde) e
          * vem primeiro; a da família é de CONTORNO. Uma linha de explicação
          * cada, curta, para ninguém tocar na errada. */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={souMotorista}
            disabled={criando}
            className="tap flex w-full items-center gap-4 rounded-2xl bg-primary p-5 text-left text-white shadow-focus disabled:opacity-60"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-onNightAccent">
              {criando ? <Spinner size={22} /> : <Bus size={24} />}
            </span>
            <span className="min-w-0">
              <span className="block text-lg text-white">
                <b className="font-extrabold">Sou</b> motorista
              </span>
              <span className="mt-0.5 block text-[15px] text-primaryChip">
                Tenho van escolar.
              </span>
            </span>
          </button>

          <Link
            to="/first-access"
            className="tap flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-5"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
              <Users size={24} />
            </span>
            <span className="min-w-0">
              <span className="block text-lg text-text">
                <b className="font-extrabold">Sou</b> responsável
              </span>
              <span className="mt-0.5 block text-[15px] text-textMuted">
                Meu filho anda na van.
              </span>
            </span>
          </Link>
        </div>

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
