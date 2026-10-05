import { useEffect, useState } from 'react';
import { Check, MessageCircle, X } from 'lucide-react';
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
 *
 * AUDITORIA DE USO (05/10/2026): o cartão abre pelo rosto de QUEM pede (o
 * logo do tio dela), e "Quero falar com o tio" existe SEMPRE — sumir quando o
 * telefone não carrega deixava uma saída só, "Ler e aceitar", e o botão que
 * chegava depois empurrava a tela embaixo do dedo. Sem telefone, ele explica.
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
        <CartaoDoPedido key={t.id} t={t} onAbrir={() => setAberto(t)} />
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

/**
 * Um pedido: o rosto do tio DELA no topo esquerdo (quem pede é quem ela
 * conhece), a frase, e as duas saídas. O perfil do tio é lido uma vez (ela
 * alcança o documento dele pela lista `adminUids`).
 */
function CartaoDoPedido({ t, onAbrir }) {
  const [tio, setTio] = useState(null);
  useEffect(() => {
    let vivo = true;
    getUserDoc(t.deUid)
      .then((u) => vivo && setTio(u || {}))
      .catch(() => vivo && setTio({}));
    return () => {
      vivo = false;
    };
  }, [t.deUid]);
  const marca = t.marcaDe || 'Seu tio';

  return (
    <section className="rounded-2xl border-2 border-primary bg-card p-4">
      <div className="flex items-start gap-3">
        {tio?.marcaLogoURL ? (
          <img src={tio.marcaLogoURL} alt="" className="h-12 w-12 shrink-0 rounded-full bg-white object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primarySoft text-lg font-bold text-primary">
            {marca.slice(0, 1).toUpperCase()}
          </span>
        )}
        <p className="text-base font-bold text-text">
          {marca} vai passar o transporte de {t.previa?.primeiroNome || 'seu filho'} para {t.marcaPara || 'outro tio'}
        </p>
      </div>
      <p className="mt-2 text-base text-textMuted">
        {t.marcaPara || 'O novo tio'} já aceitou. Falta você.
        {prazoDoPedido(t) ? ` Responda até ${prazoDoPedido(t)}.` : ''}
      </p>
      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={onAbrir}
          className="min-h-12 w-full rounded-xl bg-primary text-base font-bold text-white"
        >
          Ler e aceitar
        </button>
        <FalarComOTio telefone={tio?.phone} carregou={tio !== null} marca={t.marcaDe} />
      </div>
    </section>
  );
}

/**
 * "Quero falar com o tio" — sempre à vista. Com telefone, abre o WhatsApp;
 * sem ele (ou antes de carregar), diz o que fazer em vez de sumir.
 */
function FalarComOTio({ telefone, carregou, marca }) {
  const [semTelefone, setSemTelefone] = useState(false);
  const digitos = String(telefone || '').replace(/\D/g, '');
  const quem = marca || 'o tio';

  const tocar = () => {
    if (!digitos) {
      setSemTelefone(true);
      return;
    }
    const numero = digitos.startsWith('55') ? digitos : `55${digitos}`;
    window.open(`https://wa.me/${numero}`, '_blank', 'noopener');
  };

  return (
    <>
      <button
        type="button"
        onClick={tocar}
        disabled={!carregou}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-border text-base font-bold text-text"
      >
        <MessageCircle size={20} aria-hidden="true" />
        Quero falar com {quem}
      </button>
      {semTelefone && (
        <p className="text-base text-text">
          {quem} não tem o WhatsApp cadastrado no app. Fale com ele pelo número de sempre, o mesmo que mandou o
          convite.
        </p>
      )}
    </>
  );
}
