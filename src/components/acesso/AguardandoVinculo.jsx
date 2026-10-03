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
 *   aguardando  — "Encontramos um cadastro com este número": o motorista
 *                 recebeu o pedido e aprova com um toque
 *   recusado    — o motorista disse "não conheço"
 *   nada        — nenhuma criança com este número: ela manda o app para o
 *                 motorista, e quando ele cadastrar o filho com o número,
 *                 o pedido nasce sozinho
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
  } else if (aguardando) {
    corpo = (
      <>
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-warningSoft text-warningText">
          <Hourglass size={20} />
        </span>
        <h2 className="text-xl font-extrabold text-text">Encontramos um cadastro com este número</h2>
        <p className="mt-1.5 text-sm text-textMuted">
          Pedimos ao motorista para confirmar. Assim que ele aprovar, seu filho
          aparece aqui.
        </p>
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse motion-reduce:animate-none"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </>
    );
  } else {
    corpo = (
      <>
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primaryChip text-primary">
          <Bus size={20} />
        </span>
        <h2 className="text-xl font-extrabold text-text">
          {recusado ? 'O motorista não confirmou' : 'Não encontramos seu motorista'}
        </h2>
        <p className="mt-1.5 text-sm text-textMuted">
          {recusado
            ? 'Fale com ele para conferir o número que ele cadastrou.'
            : 'Mande o app para ele cadastrar o seu filho com este número. Depois é só ele aprovar.'}
        </p>
        {!recusado && (
          <a
            href={linkDoPedido({ nome: profile?.name || '' })}
            target="_blank"
            rel="noreferrer"
            className="tap mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-white"
          >
            <WhatsAppIcon size={18} colored={false} />
            Mandar para o motorista
          </a>
        )}
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
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCorrigindo(true)}
              className="tap py-2 text-sm font-semibold text-primary"
            >
              Corrigir meu número
            </button>
            <button
              type="button"
              onClick={logout}
              className="tap inline-flex items-center gap-1 py-2 text-sm text-textMuted"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
