import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { enablePush, isPushAvailable, permissionState } from '../../services/pushService';

const DISPENSADO = 'ab_convite_push_v1';

// Não pede na primeira visita: quem acabou de entrar ainda não sabe se vai
// usar, e permissão negada na pressa é permissão que o navegador não pergunta
// de novo. Mesma régua do `InstallPrompt`, e de propósito — os dois competem
// pelo mesmo instante de atenção.
const MIN_VISITAS = 2;
const VISITAS = 'ab_visits_v1';

function lerInt(chave) {
  try {
    return Number(localStorage.getItem(chave)) || 0;
  } catch {
    return 0;
  }
}

/**
 * O CONVITE PARA LIGAR O AVISO NO CELULAR — no caminho, e não enterrado.
 *
 * ── POR QUE ELE PRECISOU SAIR DO PERFIL
 * `enablePush` só era chamada de `/tio/perfil`, atrás de uma rolagem. Quem
 * nunca abriu o perfil nunca ligou o push — e push desligado é o canal inteiro
 * desligado: os avisos comerciais, o aviso de fatura e o de degrau viram
 * documentos em `notifications` que ninguém vê, porque quem parou de abrir o
 * app é exatamente quem eles existem para alcançar.
 *
 * O canal de saída da plataforma dependia de uma tela que ninguém visita.
 *
 * ── O QUE ELE PROMETE, E É SÓ ISSO
 * Chegada da criança, recado de escola e cobrança. Nada de "fique por dentro"
 * nem de "não perca nenhuma novidade" — pedir permissão prometendo vago é como
 * se ensina alguém a negar por reflexo. Ele diz as três coisas que o app
 * realmente manda, e o motorista decide sabendo.
 *
 * ── E ELE SOME DEPOIS DE UM "NÃO"
 * Uma vez, e acabou. O navegador já trata permissão negada como definitiva
 * naquele dispositivo; insistir na interface é pedir de novo uma coisa que o
 * sistema operacional não vai nem perguntar.
 */
export default function ConvitePush() {
  const { user } = useAuth();
  const [visivel, setVisivel] = useState(false);
  const [ligando, setLigando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        if (localStorage.getItem(DISPENSADO)) return;
        if (lerInt(VISITAS) < MIN_VISITAS) return;
      } catch {
        // Modo privado: o convite simplesmente não aparece. Melhor calar que
        // reaparecer a cada navegação por não conseguir lembrar do "não".
        return;
      }

      // Já concedido ou já negado: não há o que perguntar. `denied` é
      // definitivo no navegador, e um botão que não faz nada é pior que
      // nenhum botão.
      if (permissionState() !== 'default') return;
      if (!(await isPushAvailable())) return;

      if (ativo) setVisivel(true);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const dispensar = () => {
    setVisivel(false);
    try {
      localStorage.setItem(DISPENSADO, '1');
    } catch {
      // Sem lembrar do "não", ele volta na próxima navegação. Aceitável: o
      // custo é ver de novo, não perder nada.
    }
  };

  const ligar = async () => {
    setLigando(true);
    try {
      const r = await enablePush(user?.uid);
      if (r?.ok) toast.success('Pronto. Os avisos chegam no seu celular.');
      else if (r?.reason === 'negado') {
        toast('Sem problema — os avisos continuam aqui dentro do app.');
      } else toast.error('Não deu pra ligar os avisos agora.');
    } catch {
      toast.error('Não deu pra ligar os avisos agora.');
    } finally {
      setLigando(false);
      dispensar();
    }
  };

  if (!visivel) return null;

  return (
    <div className="mb-4 px-5 pt-4">
      <div className="relative rounded-2xl border border-primaryBorder bg-primarySoft p-4">
        <button
          type="button"
          onClick={dispensar}
          aria-label="Agora não"
          className="tap absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-textMuted"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primaryChip">
            <Bell size={18} className="text-primary" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text">
              Receber os avisos no celular
            </p>
            {/* As três coisas que o app manda de verdade. Prometer vago é como
              * se ensina alguém a negar por reflexo. */}
            <p className="mt-0.5 text-xs leading-relaxed text-textMuted">
              Hoje eles só aparecem quando você abre o app. Ligando, chegam no
              celular: chegada da criança, recado de escola e cobrança.
            </p>

            <button
              type="button"
              onClick={ligar}
              disabled={ligando}
              className="tap mt-3 h-9 rounded-xl bg-primary px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              {ligando ? 'Ligando…' : 'Ligar avisos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
