import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudOff, LogOut, RotateCw } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../../hooks/useAuth';

/**
 * A LEITURA DA CONTA FALHOU — e essa frase não é "você não tem conta".
 *
 * ── O QUE ESTAVA ACONTECENDO
 * `AuthContext` fazia `catch → setProfile(null)`, e `null` é também o valor de
 * quem acabou de criar sessão e ainda não escolheu um lado. Os guardas do
 * `App` tratam esse nulo como conclusivo e mandam pra `/comecar`, que diz
 * **"Falta ligar sua conta"** e **"Nada foi criado ainda"**. Para um motorista
 * de meses cuja rede caiu no meio-fio, as duas frases são falsas — e as duas
 * saídas que a tela oferece ("recebi um convite", "quero criar minha
 * operação") o levam a começar uma conta que ele já tem.
 *
 * ── POR QUE UMA TELA, E NÃO UM RETRY SILENCIOSO
 * Insistir escondido tem o mesmo defeito do loader eterno: a pessoa fica
 * olhando uma tela que não explica nada e conclui o que quiser. Aqui ela lê o
 * que houve, vê com que e-mail está entrando (é o que resolve o caso de ter
 * logado na conta errada) e decide: tenta de novo, ou sai.
 *
 * ── O BOTÃO É `refreshProfile`, DE PROPÓSITO
 * Ele é o mesmo caminho de leitura, e é ele quem baixa o terceiro estado
 * quando dá certo. Quando dá, esta tela some sozinha: quem a monta é o guarda,
 * e o guarda passa a ver `profile`.
 *
 * ⚠️ Nada de "estamos com instabilidade" ou "nossos servidores": o app não
 * sabe de quem é a falha. A causa mais comum é a rede DELE, e afirmar a nossa
 * é chutar uma desculpa.
 */
export default function FalhaAoLerConta() {
  const { user, refreshProfile, logout } = useAuth();
  const [tentando, setTentando] = useState(false);
  const [tentouEFalhou, setTentouEFalhou] = useState(false);
  const navigate = useNavigate();

  const tentarDeNovo = async () => {
    setTentando(true);
    setTentouEFalhou(false);
    try {
      await refreshProfile();
      // Deu certo: o contexto já limpou o estado e o guarda troca a tela.
    } catch {
      setTentouEFalhou(true);
    } finally {
      setTentando(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-bg px-6 py-10">
      <div className="mx-auto w-full max-w-mobile space-y-6">
        <div className="text-center">
          <Logo variant="stacked" height={80} className="mx-auto" />
          <span className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-warningChip">
            <CloudOff size={22} className="text-warningText" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-text">
            Não conseguimos abrir sua conta
          </h1>
          <p className="mt-2 text-sm text-textMuted">
            Sua entrada funcionou
            {user?.email ? ` como ${user.email}` : ''}, mas os seus dados não
            chegaram agora. Nada foi perdido — é só tentar de novo.
          </p>
        </div>

        <button
          type="button"
          onClick={tentarDeNovo}
          disabled={tentando}
          className="tap w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          <span className="flex items-center justify-center gap-2">
            <RotateCw size={17} className={tentando ? 'animate-spin' : ''} />
            {tentando ? 'Tentando…' : 'Tentar de novo'}
          </span>
        </button>

        {tentouEFalhou && (
          <p className="text-center text-sm text-warningText">
            Ainda não deu. Se estiver dirigindo, tente de novo quando o sinal
            voltar.
          </p>
        )}

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
