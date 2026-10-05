import { useEffect, useState } from 'react';
import { ArrowRightLeft, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import Sheet, { SheetCTA, SheetGhost } from '../common/Sheet';
import { Lista } from './PassarParaOutroTio';
import { getUserDoc } from '../../services/authService';
import { aceitarTransferencia, watchTransferenciasDaFamilia } from '../../services/transferenciasService';
import { O_QUE_NAO_VAI, O_QUE_VAI, prazoDoPedido } from '../../dominio/identidade/transferencia.js';

/**
 * O CARTÃO DA FAMÍLIA (fase 2 da rede, 05/10/2026), no Início dela: o tio
 * dela vai passar o transporte para um tio parceiro, e o parceiro já aceitou.
 * Fica até ela responder ou o pedido vencer.
 *
 * Duas saídas, na voz do tio DELA: "Ler e aceitar" e "Quero falar com o Tio
 * Nino" (o WhatsApp dele) — não há "Recusar": quem não quer conversa com o
 * tio, e ele cancela o pedido. O "Aceito" mora DENTRO da folha, depois do
 * que vai e do que fica: ninguém aceita sem ter visto (pedido da sessão de
 * uso). Aceitar é o que cria a criança na turma do parceiro.
 */
export default function TransferenciaParaAceitar() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [aberto, setAberto] = useState(null);
  const [aceitando, setAceitando] = useState(false);

  useEffect(() => watchTransferenciasDaFamilia(user?.uid, setPedidos), [user?.uid]);
  if (!pedidos.length) return null;

  const aceitar = async (t) => {
    setAceitando(true);
    try {
      await aceitarTransferencia(t.id);
      toast.success(`Pronto. Agora o transporte é com ${t.marcaPara || 'o novo tio'}.`);
      setAberto(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAceitando(false);
    }
  };

  return (
    <>
      {pedidos.map((t) => (
        <section key={t.id} className="rounded-2xl border-2 border-primary bg-card p-4">
          <p className="flex items-start gap-2 text-base font-bold text-text">
            <ArrowRightLeft size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            {t.marcaDe || 'Seu tio'} vai passar o transporte de {t.previa?.primeiroNome || 'seu filho'} para{' '}
            {t.marcaPara || 'outro tio'}
          </p>
          <p className="mt-1 text-base text-textMuted">
            {t.marcaPara || 'O novo tio'} já aceitou. Falta você.
            {prazoDoPedido(t) ? ` Responda até ${prazoDoPedido(t)}.` : ''}
          </p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => setAberto(t)}
              className="min-h-12 w-full rounded-xl bg-primary text-base font-bold text-white"
            >
              Ler e aceitar
            </button>
            <FalarComOTio uid={t.deUid} marca={t.marcaDe} />
          </div>
        </section>
      ))}

      <Sheet open={!!aberto} onClose={() => setAberto(null)} title={`Passar para ${aberto?.marcaPara || 'o novo tio'}`}>
        {aberto && (
          <div className="space-y-4">
            <Lista titulo={`Vai para ${aberto.marcaPara || 'o novo tio'}`} itens={O_QUE_VAI} icone={Check} />
            <Lista titulo={`Fica com ${aberto.marcaDe || 'o tio de agora'}`} itens={O_QUE_NAO_VAI} icone={X} />
            <p className="text-base text-text">
              Mensalidade em aberto continua sendo paga a {aberto.marcaDe || 'o tio de agora'}.{' '}
              {aberto.marcaPara || 'O novo tio'} combina com você o valor e os horários, e manda um contrato novo
              para você assinar.
            </p>
            <SheetCTA onClick={() => aceitar(aberto)} loading={aceitando}>
              Aceito
            </SheetCTA>
            <SheetGhost onClick={() => setAberto(null)}>Agora não</SheetGhost>
          </div>
        )}
      </Sheet>
    </>
  );
}

function FalarComOTio({ uid, marca }) {
  const [fone, setFone] = useState(null);
  useEffect(() => {
    let vivo = true;
    getUserDoc(uid)
      .then((u) => vivo && setFone(String(u?.phone || '').replace(/\D/g, '') || null))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [uid]);
  if (!fone) return null;
  const numero = fone.startsWith('55') ? fone : `55${fone}`;
  return (
    <a
      href={`https://wa.me/${numero}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border text-base font-bold text-text"
    >
      Quero falar com {marca || 'o tio'}
    </a>
  );
}
