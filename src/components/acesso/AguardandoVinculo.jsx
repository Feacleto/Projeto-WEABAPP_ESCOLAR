import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hourglass, Bus, LogOut, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { deleteOwnParentAccount, isRecentLoginRequired } from '../../services/accountService';
import { destinoAposSair } from '../../dominio/vitrine/frentes';
import { usePedidosDeAcesso } from '../../hooks/usePedidosDeAcesso';
import { linkDoPedido } from '../../marca/pedidoAoMotorista';
import WhatsAppIcon from '../common/WhatsAppIcon';
import PedirAcesso from './PedirAcesso';

/**
 * O RESPONSÁVEL AINDA SEM CRIANÇA — o card por cima do app (02/10/2026).
 *
 * Ela entrou sem o link e informou o WhatsApp. O `/pai` aparece borrado por
 * baixo (ver `SemVinculoGate` no App.jsx) e este card diz em que pé está:
 *
 *   esperando — "Se o número estiver cadastrado, o motorista recebe o
 *               pedido", com o botão de mandar o app ao motorista
 *   recusado  — o motorista disse "não conheço"
 *   sem filho — o motorista tirou da turma o último filho dela (14/11/2026)
 *
 * ⚠️ "SEM FILHO" NÃO É "PEDIDO ENVIADO". Desde 14/11/2026 tirar a criança da
 * turma não apaga a conta da família (`desvincularResponsavel.js`): a mãe de
 * um filho só fica aqui, sem criança. Ela não pediu nada, então "Pedido
 * enviado" seria mentira — e "Falta ligar sua conta", a tela de antes,
 * mandava criar uma conta que ela já tem. O servidor marca `semFilhoDesde`,
 * e o card diz o que aconteceu e como voltar (um link novo, com esta mesma
 * conta). Pedido aberto ou recusado depois disso tem precedência: é a
 * notícia mais nova.
 *
 * ⚠️ E A SAÍDA DA CONTA MORA AQUI TAMBÉM. O `/pai` está inerte por baixo,
 * então o "Excluir conta" do perfil não é alcançável — e uma conta que o app
 * guarda sem filho precisa de um jeito de ser apagada por quem é dona dela.
 *
 * ⚠️ "ACHOU" E "NÃO ACHOU" SÃO A MESMA TELA (03/10/2026). Eram duas —
 * "Encontramos um cadastro com este número" e "Não encontramos seu
 * motorista" —, e isso fazia do card um oráculo: digitar números e ler qual
 * frase aparece dizia quais telefones têm criança na plataforma. A resposta
 * do servidor também ficou igual (`pedidosDeAcesso.js`).
 *
 * ⚠️ O CARD NÃO DIZ O NOME DA CRIANÇA NEM DO MOTORISTA enquanto espera.
 * Quem digita um número alheio não pode sair sabendo que ali existe "Lucas".
 *
 * Aprovado, o perfil é relido e o gate solta o app — sem tela de "pronto".
 * ⚠️ Desde 14/11/2026 nada novo nasce "aprovado" (decisão 28): o motorista
 * manda o LINK ao WhatsApp que cadastrou, e o vínculo vem do link. O
 * "aprovado" segue lido por causa dos pedidos antigos. "Link enviado" não
 * chega aqui de propósito — as rules não o mostram a quem pediu, senão a
 * tela diria a um estranho que aquele número é de uma família.
 */
export default function AguardandoVinculo() {
  const { user, profile, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { pedidos, carregando } = usePedidosDeAcesso('responsavel');
  const [corrigindo, setCorrigindo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [apagando, setApagando] = useState(false);

  const aguardando = pedidos.some((p) => p.status === 'aguardando');
  const aprovado = pedidos.some((p) => p.status === 'aprovado');
  // Só a recusa muda a tela — e ela vem de um gesto do motorista, não da
  // busca pelo número. "Aguardando" e "nenhum pedido" são a mesma tela.
  const recusado = !aguardando && pedidos.some((p) => p.status === 'recusado');

  // O vínculo é escrito em `users` pelo servidor; o perfil daqui não é ao
  // vivo, então quem avisa é o pedido mudando para "aprovado".
  useEffect(() => {
    if (aprovado) refreshProfile();
  }, [aprovado, refreshProfile]);

  // Tirada da turma sem outro filho: só vale enquanto não há pedido mais novo.
  const semFilho = Boolean(profile?.semFilhoDesde) && !aguardando && !recusado;

  const excluirConta = async () => {
    // Lido ANTES: `deleteUser` derruba a sessão e o perfil vira nulo.
    const destino = destinoAposSair(profile?.role);
    setApagando(true);
    try {
      await deleteOwnParentAccount({ uid: user?.uid, childIds: [] });
      toast.success('Conta excluída.');
      navigate(destino, { replace: true });
    } catch (err) {
      if (isRecentLoginRequired(err)) {
        toast.error('Por segurança, saia e entre de novo antes de excluir a conta.', { duration: 6000 });
        await logout();
        navigate(destino, { replace: true });
        return;
      }
      toast.error('Não foi possível excluir. Tente novamente.');
      setApagando(false);
    }
  };

  if (carregando) return null;

  let corpo;
  if (corrigindo) {
    corpo = <PedirAcesso aoConcluir={() => setCorrigindo(false)} />;
  } else if (excluindo) {
    corpo = (
      <>
        <h2 className="text-xl font-extrabold text-text">Excluir sua conta?</h2>
        <p className="mt-1.5 text-base text-textMuted">
          Seu login e seus avisos são apagados, e isso não tem volta. Para usar
          o app de novo depois, você cria uma conta pelo link do motorista.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={excluirConta}
            disabled={apagando}
            className="tap flex min-h-12 w-full items-center justify-center rounded-xl bg-dangerText font-bold text-white disabled:opacity-60"
          >
            {apagando ? 'Excluindo…' : 'Sim, excluir minha conta'}
          </button>
          <button
            type="button"
            onClick={() => setExcluindo(false)}
            disabled={apagando}
            className="tap flex min-h-12 w-full items-center justify-center rounded-xl text-base font-semibold text-primary"
          >
            Voltar
          </button>
        </div>
      </>
    );
  } else if (semFilho) {
    corpo = (
      <>
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primaryChip text-primary">
          <UserRound size={20} />
        </span>
        <h2 className="text-xl font-extrabold text-text">Nenhuma criança na sua conta agora</h2>
        <p className="mt-1.5 text-base text-textMuted">
          O motorista tirou a criança da turma dele, e ela saiu do seu app.
          Sua conta continua aqui.
        </p>
        <p className="mt-3 text-base text-textMuted">
          Se foi engano, fale com ele. Ele manda um link novo, e você abre com
          esta mesma conta.
        </p>
      </>
    );
  } else if (recusado) {
    corpo = (
      <>
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primaryChip text-primary">
          <Bus size={20} />
        </span>
        <h2 className="text-xl font-extrabold text-text">O motorista não confirmou</h2>
        <p className="mt-1.5 text-base text-textMuted">
          Fale com ele para conferir o número que ele cadastrou.
        </p>
      </>
    );
  } else {
    corpo = (
      <>
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-warningSoft text-warningText">
          <Hourglass size={20} />
        </span>
        <h2 className="text-xl font-extrabold text-text">Pedido enviado</h2>
        <p className="mt-1.5 text-base text-textMuted">
          Se o número estiver cadastrado, o motorista recebe o pedido e manda
          o link para o WhatsApp que ele tem. Abra o link por lá, com esta
          mesma conta, e seu filho aparece aqui.
        </p>
        <p className="mt-3 text-base text-textMuted">
          Ele ainda não usa o app? Mande para ele. Quando ele cadastrar seu
          filho com este número, o pedido chega sozinho.
        </p>
        <a
          href={linkDoPedido({ nome: profile?.name || '' })}
          target="_blank"
          rel="noreferrer"
          className="tap mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-whatsapp font-bold text-onAccent"
        >
          <WhatsAppIcon size={18} colored={false} />
          Mandar para o motorista
        </a>
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-[420px] rounded-3xl bg-card p-5 shadow-float">
        {corpo}
        {!corrigindo && !excluindo && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCorrigindo(true)}
              className="tap inline-flex min-h-12 items-center px-1 text-base font-semibold text-primary"
            >
              {semFilho ? 'Pedir acesso pelo WhatsApp' : 'Corrigir meu número'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="tap inline-flex min-h-12 items-center gap-1.5 px-2 text-base text-textMuted"
            >
              <LogOut size={18} /> Sair
            </button>
          </div>
        )}
        {!corrigindo && !excluindo && (
          <button
            type="button"
            onClick={() => setExcluindo(true)}
            className="tap mt-1 inline-flex min-h-12 items-center px-1 text-base text-textMuted underline"
          >
            Excluir minha conta
          </button>
        )}
      </div>
    </div>
  );
}
