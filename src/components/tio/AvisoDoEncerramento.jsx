import { Link } from 'react-router-dom';
import { DoorOpen, Undo2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { avisoDoEncerramento } from '../../dominio/associacao/encerramento.js';

/**
 * A ASSOCIAÇÃO ESTÁ ENCERRANDO — o aviso que não se desliga e não se fecha.
 *
 * ── ⚠️ POR QUE ELE NÃO TEM O "X" QUE O `AvisoDoTrial` TEM
 * Aquele fecha porque o teste segue existindo com ou sem o aviso: nada muda
 * por ele não estar na tela. Aqui o estado é OUTRO — a renovação está
 * desligada por um gesto dele, e o produto vai parar numa data. Enquanto esse
 * estado durar, a tela precisa dizer. Aviso que some sobre uma conta que vai
 * acabar é a conta acabando de surpresa.
 *
 * É a mesma família do `AvisoDaPlataforma`: o cartão não conserta nada, ele
 * EXPLICA — e o conserto fica a um toque, que aqui é religar.
 *
 * ── ⚠️ ELE RESPONDE AO SEU PEDIDO DIRETO: "o sistema precisa avisar que a
 * renovação não está automática"
 * Não basta avisar quando acabar. Entre o pedido e a data existem semanas, e
 * é nelas que a pessoa muda de ideia — ou esquece que pediu. O cartão vive ali
 * o tempo todo, com a DATA e o caminho de volta.
 *
 * As faixas (30 / 7 / encerrada) e o porquê de serem três estão em
 * `dominio/associacao/encerramento.js`. Este arquivo só escolhe a forma.
 */
export default function AvisoDoEncerramento() {
  const { profile } = useAuth();
  const aviso = avisoDoEncerramento(profile);
  if (!aviso) return null;

  const fim = aviso.fim
    ? aviso.fim.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
    : null;

  // ── já acabou ──────────────────────────────────────────────────────────
  //
  // ⚠️ O TEXTO É "VOCÊ ENCERROU", NUNCA "VOCÊ DEVE". A tela de conta inativa é
  // a mesma de quem está inadimplente, e tratar quem saiu por escolha como
  // devedor é acusar de calote quem cumpriu o contrato.
  if (aviso.nivel === 'encerrada') {
    return (
      <div className="border-b border-border bg-sunken px-4 py-3">
        <div className="mx-auto flex max-w-mobile items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutro">
            <DoorOpen size={17} className="text-textMuted" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">
              Sua associação foi encerrada.
            </p>
            <p className="mt-0.5 text-xs text-textMuted">
              Seus dados continuam salvos. Para voltar a operar, é só escolher um
              plano.
            </p>
            <Link
              to="/tio/planos"
              className="tap mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary"
            >
              Ver planos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── faltando pouco: cartão âmbar ───────────────────────────────────────
  if (aviso.nivel === 'urgente' || aviso.nivel === 'aviso') {
    const urgente = aviso.nivel === 'urgente';
    return (
      <div className="border-b border-warningBorder bg-warningSoft px-4 py-3">
        <div className="mx-auto flex max-w-mobile items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warningChip">
            <DoorOpen size={17} className="text-warningText" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-warningText">
              {aviso.dias <= 1
                ? 'Sua associação termina amanhã.'
                : `Sua associação termina em ${aviso.dias} dias.`}
            </p>
            <p className="mt-0.5 text-xs text-textMuted">
              A renovação automática está <strong>desligada</strong>
              {fim && <> desde o seu pedido — o app funciona até {fim}</>}.{' '}
              {urgente && 'Depois dessa data as famílias deixam de acompanhar as rotas.'}
            </p>
            <Link
              to="/tio/encerrar"
              className="tap mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary"
            >
              <Undo2 size={13} /> Manter minha associação
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── longe da data: uma linha, que informa e sai do caminho ─────────────
  return (
    <div className="border-b border-border bg-sunken px-4 py-2 text-center text-xs text-textMuted">
      A renovação automática está desligada
      {fim && (
        <>
          {' '}
          — sua associação vai até{' '}
          <strong className="font-semibold text-text">{fim}</strong>
        </>
      )}
      .{' '}
      <Link to="/tio/encerrar" className="tap font-semibold text-primary underline">
        Manter
      </Link>
    </div>
  );
}
