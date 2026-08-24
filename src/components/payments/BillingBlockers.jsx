import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert, Key, RefreshCw, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { runBillingNow } from '../../services/paymentsService';
import { mensagemDeErro } from '../../services/callableError';

/**
 * O que está impedindo o dinheiro de entrar.
 *
 * POR QUE ISTO EXISTE
 * O app tinha três formas de travar o pagamento em SILÊNCIO — nenhuma delas
 * dava erro, nenhuma aparecia em lugar nenhum, e todas terminavam com o tio
 * não recebendo sem entender por quê:
 *
 *   1. Chave PIX não cadastrada. O pai abre a tela de pagar e lê "o motorista
 *      ainda não cadastrou a chave". Ele não tem o que fazer, e o tio não sabe
 *      que isso está acontecendo.
 *
 *   2. Criança sem mensalidade configurada. O campo é opcional no cadastro (de
 *      propósito, pra o tio salvar no meio da rota), então é fácil ficar em
 *      branco. Sem valor, nenhuma cobrança é gerada — e ninguém avisa.
 *
 *   3. Criança ativa e vinculada, mas sem cobrança do mês. A geração roda uma
 *      vez por dia às 6h. Quem foi cadastrado hoje à tarde só ganha cobrança
 *      amanhã, e quem teve a mensalidade preenchida DEPOIS da geração fica sem
 *      cobrança até o mês seguinte.
 *
 * Falha silenciosa em cobrança é a pior categoria de bug num app assim: o
 * prejuízo acontece, ninguém vê, e quando alguém vê já passou um mês.
 *
 * Props:
 *   - children:  todas as crianças
 *   - payments:  pagamentos do mês exibido
 *   - monthKey:  mês exibido
 *   - admin:     doc do motorista (pra saber da chave PIX)
 *   - isCurrentMonth
 *   - onOpenPix (opcional) — abre a folha da chave em vez de navegar
 */
export default function BillingBlockers({
  children,
  payments,
  monthKey,
  admin,
  isCurrentMonth,
  // Quando quem chama sabe abrir a folha, usamos a folha. Sem isso,
  // cai na rota — que continua válida.
  onOpenPix = null,
}) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);

  const { noFee, notBilled } = useMemo(() => {
    const active = (children || []).filter((c) => c.active !== false);
    const billed = new Set((payments || []).map((p) => p.childId));

    return {
      noFee: active.filter((c) => !(Number(c.monthlyFee) > 0)),
      // Só conta quem TEM valor e TEM responsável: quem falta valor já aparece
      // no aviso de cima, e sem responsável não há pra quem cobrar.
      notBilled: active.filter(
        (c) =>
          Number(c.monthlyFee) > 0 && c.parentUid && !billed.has(c.id)
      ),
    };
  }, [children, payments]);

  const missingPix = !admin?.pixKey;

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const result = await runBillingNow(monthKey);
      if (result?.created > 0) {
        toast.success(
          `${result.created} ${result.created === 1 ? 'cobrança gerada' : 'cobranças geradas'}.`
        );
      } else {
        toast('Nenhuma cobrança nova pra gerar.');
      }
    } catch (err) {
      // Sem as functions publicadas isto devolvia "internal" na tela, e o
      // motorista ia culpar a própria internet.
      toast.error(mensagemDeErro(err, 'gerar as cobranças'), { duration: 7000 });
    } finally {
      setGenerating(false);
    }
  };

  // A geração só vale pro mês corrente: gerar cobrança retroativa de um mês
  // fechado criaria dívida que ninguém esperava.
  const showGenerate = isCurrentMonth && notBilled.length > 0;

  if (!missingPix && noFee.length === 0 && !showGenerate) return null;

  return (
    <div className="space-y-2">
      {missingPix && (
        <Blocker
          icon={Key}
          title="Chave PIX não cadastrada"
          detail="Sem ela, o app não gera o código de pagamento e os responsáveis não conseguem pagar por aqui."
          actionLabel="Cadastrar chave"
          onAction={() => (onOpenPix ? onOpenPix() : navigate('/tio/pix'))}
        />
      )}

      {noFee.length > 0 && (
        <Blocker
          icon={TriangleAlert}
          title={
            noFee.length === 1
              ? `${noFee[0].name.split(' ')[0]} está sem mensalidade`
              : `${noFee.length} crianças sem mensalidade`
          }
          detail="Sem valor configurado, nenhuma cobrança é gerada pra elas."
          actionLabel="Ver crianças"
          onAction={() => navigate('/tio/children')}
        />
      )}

      {showGenerate && (
        <Blocker
          icon={RefreshCw}
          title={
            notBilled.length === 1
              ? '1 criança sem cobrança deste mês'
              : `${notBilled.length} crianças sem cobrança deste mês`
          }
          detail="As cobranças nascem automaticamente às 6h. Se cadastrou agora, pode gerar na hora."
          actionLabel={generating ? 'Gerando...' : 'Gerar agora'}
          onAction={onGenerate}
          disabled={generating}
        />
      )}
    </div>
  );
}

function Blocker({ icon: Icon, title, detail, actionLabel, onAction, disabled }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-900 leading-tight">{title}</p>
        <p className="text-xs text-amber-800/85 mt-0.5 leading-snug">{detail}</p>
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="tap mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-900 underline disabled:opacity-60"
        >
          {actionLabel}
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
