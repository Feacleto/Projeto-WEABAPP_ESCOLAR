import { useState } from 'react';
import { HandCoins } from 'lucide-react';
import toast from 'react-hot-toast';
import AppSheet from '../common/AppSheet';
import { useAuth } from '../../hooks/useAuth';
import { confirmReceipt, anotarPixDaFamilia } from '../../services/paymentsService';
import { logPaymentEvent, PAYMENT_EVENTS } from '../../services/paymentAuditService';
import { VIA_SEM_SENHA } from '../../dominio/cobranca/trilhaDoPagamento.js';
import { nomeDoMesDaMensalidade } from '../../dominio/cobranca/semSenha.js';

/**
 * A MENSALIDADE EM ABERTO, NA PORTA — sem valor nenhum (04/10/2026, simulação
 * "Rota e Central" aprovada pelo dono).
 *
 * Na rota, a tela é a Central da AUXILIAR, e ela não pode saber quanto cada
 * família paga. Mas é na porta que o dinheiro chega na mão, então ela precisa
 * poder dar baixa. Por isso esta caixa mostra só o MÊS ("Mensalidade de
 * outubro em aberto") e "Recebi" — nunca o valor, nem na confirmação.
 *
 * ⚠️ DUAS SAÍDAS, E SÓ UMA É BAIXA:
 * - "Em dinheiro, na minha mão" dá a baixa (`paid`, dinheiro).
 * - "A família disse que mandou PIX" NÃO dá baixa: vira `claimed`, o mesmo
 *   estado do "Já paguei" da família. A auxiliar não vê o extrato do banco do
 *   tio, e "pago" sem ninguém ver o dinheiro cair seria a tela mentindo.
 * As duas gravam `meta.via: 'sem_senha'` na trilha, e o tio lê "Baixa dada
 * sem a senha" depois — para o Firestore ela e ele são a mesma conta.
 *
 * ⚠️ "RECEBI" É DE CONTORNO, NUNCA CHEIO (auditoria da sessão "uso"): na
 * porta, o único botão cheio é o EMBARQUEI do rodapé. Dois cheios com a perua
 * parada e pressa, e o polegar vai no mais forte.
 *
 * ⚠️ NENHUM VALOR AQUI É REGRA, NÃO GOSTO: `npm run testar:sem-senha` reprova
 * qualquer valor impresso nos componentes da rota sem senha.
 */
export default function MensalidadeNaPorta({ payment, childName }) {
  const { user } = useAuth();
  const [aberta, setAberta] = useState(false);
  const [gravando, setGravando] = useState(false);
  if (!payment?.id) return null;

  const mes = nomeDoMesDaMensalidade(payment.month);
  const primeiroNome = String(childName || payment.childName || '').split(' ')[0];

  const receber = async (como) => {
    setGravando(true);
    try {
      if (como === 'dinheiro') {
        await confirmReceipt(payment.id, 'cash');
        logPaymentEvent(payment.id, {
          type: PAYMENT_EVENTS.CONFIRMED,
          actorUid: user?.uid,
          actorRole: 'admin',
          meta: { via: VIA_SEM_SENHA, method: 'cash' },
        });
        toast.success(`Baixa dada: mensalidade de ${mes} de ${primeiroNome}.`);
      } else {
        await anotarPixDaFamilia(payment.id);
        logPaymentEvent(payment.id, {
          type: PAYMENT_EVENTS.CLAIMED,
          actorUid: user?.uid,
          actorRole: 'admin',
          meta: { via: VIA_SEM_SENHA, method: 'pix' },
        });
        toast.success('Anotado. O motorista confere no banco.');
      }
      setAberta(false);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra anotar. Tente de novo.');
    } finally {
      setGravando(false);
    }
  };

  return (
    <>
      {/* A frase tem a linha inteira e o "Recebi" vem embaixo: lado a lado,
        * a 360 px a frase quebrava em cinco linhas (jornada C1). */}
      <div className="space-y-2 rounded-xl border border-warningBorder bg-warningSoft p-3">
        <p className="flex items-center gap-2 text-base font-bold text-warningText">
          <HandCoins size={20} className="shrink-0" aria-hidden="true" />
          Mensalidade de {mes} em aberto
        </p>
        <button
          type="button"
          onClick={() => setAberta(true)}
          className="tap min-h-12 w-full rounded-xl border-2 border-warningText bg-card px-4 text-base font-bold text-warningText"
        >
          Recebi
        </button>
      </div>

      <AppSheet
        open={aberta}
        onClose={() => !gravando && setAberta(false)}
        title={`Recebeu a mensalidade de ${mes} de ${primeiroNome}?`}
        icon={HandCoins}
      >
        <div className="space-y-3">
          <button
            type="button"
            disabled={gravando}
            onClick={() => receber('dinheiro')}
            className="tap flex min-h-14 w-full items-center rounded-xl border-2 border-border bg-card px-4 text-left text-base font-bold text-text disabled:opacity-60"
          >
            Em dinheiro, na minha mão
          </button>
          <button
            type="button"
            disabled={gravando}
            onClick={() => receber('pix')}
            className="tap flex min-h-14 w-full items-center rounded-xl border-2 border-border bg-card px-4 text-left text-base font-bold text-text disabled:opacity-60"
          >
            A família disse que mandou PIX
          </button>
          <p className="text-sm text-textMuted">O PIX o motorista confere no banco.</p>
        </div>
      </AppSheet>
    </>
  );
}
