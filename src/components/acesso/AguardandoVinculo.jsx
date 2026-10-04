import { useEffect, useState } from 'react';
import { Hourglass, Bus, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
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
 */
export default function AguardandoVinculo() {
  const { profile, refreshProfile, logout } = useAuth();
  const { pedidos, carregando } = usePedidosDeAcesso('responsavel');
  const [corrigindo, setCorrigindo] = useState(false);

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

  if (carregando) return null;

  let corpo;
  if (corrigindo) {
    corpo = <PedirAcesso aoConcluir={() => setCorrigindo(false)} />;
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
          Se o número estiver cadastrado, o motorista recebe o pedido. Assim
          que ele aprovar, seu filho aparece aqui.
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
        {!corrigindo && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCorrigindo(true)}
              className="tap inline-flex min-h-12 items-center px-1 text-base font-semibold text-primary"
            >
              Corrigir meu número
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
      </div>
    </div>
  );
}
