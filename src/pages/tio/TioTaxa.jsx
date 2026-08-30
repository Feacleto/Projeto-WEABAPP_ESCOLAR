import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, Check, Copy, FileText, QrCode, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { buildPixPayload } from '../../utils/pixPayload';
import { formatCurrency, formatMonthLabel } from '../../utils/formatters';
import { watchFaturasDoParceiro } from '../../services/taxaService';

/**
 * A TAXA DE ASSOCIAÇÃO na visão do MOTORISTA — o que ele deve à plataforma.
 *
 * POR QUE ESTA TELA TINHA QUE EXISTIR
 * Sem ela o dono via o que cobrar e o parceiro não via o que devia. Cobrança
 * que só existe no painel de quem cobra não é cobrança, é lembrete particular —
 * e a conversa sobre ela acontece por fora, no WhatsApp, sem lastro nenhum. É
 * exatamente o problema que o app resolve entre pai e motorista, repetido um
 * nível acima.
 *
 * O QUE ELA NÃO MOSTRA, E É DE PROPÓSITO
 * O percentual padrão da casa, o que os outros parceiros pagam, e a nota
 * interna da negociação. A régua vive em `taxaConfig`, que é `read: isOwner()`.
 * O que ele vê é o que foi combinado COM ELE e a conta que gerou o valor —
 * nada sobre o negócio dos outros.
 *
 * ELE LÊ E NÃO ESCREVE
 * As rules dão `write: isOwner()` na fatura. Quem dá baixa é o dono, quando o
 * PIX cai. Não existe "avisar que paguei" aqui de propósito: entre pai e
 * motorista esse aviso serve porque são dezenas de cobranças e uma pessoa
 * conferindo; aqui é o contrário — poucas cobranças, e quem confere é quem
 * recebe.
 *
 * CASCA E CONTEÚDO SEPARADOS
 * O corpo foi escrito solto, pra ser plugado onde a navegação decidisse. Ela
 * decidiu por rota própria (`/tio/taxa`), e rota sob o `TioLayout` recebe só
 * o `<Outlet />` e o rodapé — sem a casca daqui a tela abriria colada na
 * borda, sem título e sem caminho de volta.
 *
 * O VOLTAR É ROTULADO, e não só a seta. Quem chega aqui quase sempre veio do
 * aviso de cobrança por cima do painel — um susto. Depois de um susto, seta
 * sozinha num canto não se lê como saída.
 */
export default function TioTaxa() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-bg px-5 pb-3 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="tap -ml-1 mb-2 inline-flex items-center gap-1 p-1 text-sm text-textMuted"
        >
          <ArrowLeft size={18} /> Voltar
        </button>
        <h1 className="text-xl font-bold text-text">Taxa de associação</h1>
        <p className="text-sm text-textMuted">
          O que você paga ao Alô Buzinou — separado do que as famílias pagam a
          você.
        </p>
        {/* O CONTRATO A UM TOQUE DA COBRANÇA.
          * `/tio/contrato-plataforma` respondia sem que nada apontasse pra
          * ele. Aqui é onde ele é procurado: quem estranha um valor quer ler o
          * que foi combinado, e esse é o momento em que a dúvida vira ou uma
          * conferência de trinta segundos ou uma mensagem no WhatsApp. */}
        <button
          type="button"
          onClick={() => navigate('/tio/contrato-plataforma')}
          className="tap mt-1.5 inline-flex items-center gap-1 py-1 text-xs font-semibold text-primary"
        >
          <FileText size={13} />O que foi combinado
        </button>
      </header>

      <div className="px-5 pt-4">
        <Conteudo />
      </div>
    </div>
  );
}

function Conteudo() {
  const { user } = useAuth();
  const [faturas, setFaturas] = useState(null);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return watchFaturasDoParceiro(
      user.uid,
      setFaturas,
      () => setFaturas([])
    );
  }, [user?.uid]);

  const abertas = useMemo(
    () => (faturas || []).filter((f) => f.status !== 'quitada'),
    [faturas]
  );
  const total = useMemo(
    () => abertas.reduce((s, f) => s + (Number(f.total) || 0), 0),
    [abertas]
  );

  if (faturas === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (faturas.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-5 text-center shadow-sm">
        <Receipt size={22} className="mx-auto text-textMuted" />
        <p className="mt-2 text-sm font-semibold text-text">
          Nenhuma taxa lançada ainda
        </p>
        <p className="mt-1 text-xs leading-relaxed text-textMuted">
          Quando a plataforma fechar o mês, a sua taxa aparece aqui com a conta
          que gerou o valor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* O total em aberto vem primeiro: é a única pergunta que ele abre a
        * tela pra responder. */}
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
          {abertas.length === 0 ? 'tudo em dia' : 'em aberto'}
        </p>
        <p
          className={`mt-1 text-3xl font-bold ${
            abertas.length === 0 ? 'text-emerald-700' : 'text-text'
          }`}
        >
          {formatCurrency(total)}
        </p>
        {abertas.length > 1 && (
          <p className="mt-1 text-xs text-textMuted">
            {abertas.length} meses em aberto
          </p>
        )}
      </div>

      {abertas.map((f) => (
        <FaturaAberta key={f.id} fatura={f} />
      ))}

      {faturas.some((f) => f.status === 'quitada') && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-bold text-text">Histórico</h2>
          <div className="space-y-2">
            {faturas
              .filter((f) => f.status === 'quitada')
              .map((f) => (
                <div
                  key={f.id}
                  className="flex items-baseline justify-between rounded-2xl bg-card px-4 py-3 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-semibold capitalize text-text">
                      {formatMonthLabel(f.mes)}
                    </p>
                    <p className="text-[11px] text-textMuted">
                      {f.criancas} criança(s) · base {formatCurrency(f.base)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                    <Check size={13} />
                    {f.isento ? 'isento' : formatCurrency(f.total)}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FaturaAberta({ fatura }) {
  const isento = fatura.isento || Number(fatura.total) === 0;

  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-bold capitalize text-text">
          {formatMonthLabel(fatura.mes)}
        </h3>
        <span className="text-xl font-bold text-text">
          {isento ? 'isento' : formatCurrency(fatura.total)}
        </span>
      </div>

      {/* A CONTA ABERTA.
        *
        * Ele vê de onde saiu o número — quantas crianças e qual o total que ele
        * mesmo contratou. Valor de cobrança sem a conta do lado é o que
        * transforma cada fatura numa pergunta, e a pergunta chega no WhatsApp. */}
      <div className="mt-3 space-y-0.5 border-t border-neutro pt-3">
        <Linha label="Crianças ativas" valor={String(fatura.criancas ?? '—')} />
        <Linha
          label="Total que você cobra"
          valor={formatCurrency(fatura.base)}
        />
        {fatura.modo === 'percentual' && fatura.valorNegociado != null && (
          <Linha
            label="Taxa combinada"
            valor={`${fatura.valorNegociado}%`}
          />
        )}
        {fatura.desconto > 0 && (
          <Linha
            label="Desconto"
            valor={`− ${formatCurrency(fatura.desconto)}`}
          />
        )}
        <Linha label="Total" valor={formatCurrency(fatura.total)} forte />
      </div>

      {isento ? (
        <p className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs leading-relaxed text-violet-900">
          Este mês está <strong>isento</strong> — nada a pagar. A conta acima
          fica à vista pra você saber como ela é calculada quando a isenção
          terminar.
        </p>
      ) : (
        <PagamentoPix fatura={fatura} />
      )}
    </div>
  );
}

/**
 * O copia-e-cola, com o valor já embutido.
 *
 * Mesma decisão do `PixBlock` do responsável, pelo mesmo motivo: chave como
 * texto obriga a pessoa a digitar o valor no app do banco, e é aí que sai
 * pagamento com valor errado. O `txid` leva o mês, então a plataforma reconhece
 * o que entrou sem perguntar.
 */
function PagamentoPix({ fatura }) {
  const [copiado, setCopiado] = useState(false);
  const [mostrarQr, setMostrarQr] = useState(false);
  const [qr, setQr] = useState(null);

  const payload = useMemo(
    () =>
      buildPixPayload({
        key: fatura.pixKey,
        keyType: fatura.pixKeyType,
        merchantName: fatura.nomePlataforma,
        city: fatura.cidadePlataforma,
        amount: Number(fatura.total) || 0,
        txid: fatura.mes,
      }),
    [fatura]
  );

  useEffect(() => {
    if (!mostrarQr || qr || !payload) return;
    QRCode.toDataURL(payload, { width: 340, margin: 1 })
      .then(setQr)
      .catch(() => toast.error('Não foi possível gerar o QR.'));
  }, [mostrarQr, qr, payload]);

  // Sem chave cadastrada não há o que mostrar — e quem resolve é a plataforma.
  if (!payload) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-sunken p-3">
        <p className="text-xs font-semibold text-text">
          A plataforma ainda não cadastrou a chave PIX
        </p>
        <p className="mt-0.5 text-[11px] text-textMuted">
          Combine o pagamento direto com ela.
        </p>
      </div>
    );
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopiado(true);
      toast.success('Código copiado! Cole no app do seu banco.');
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error('Não deu pra copiar. Toque e segure no código pra selecionar.');
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-xl border border-dashed border-primary/40 bg-sunken p-3">
        <p className="break-all font-mono text-[10px] leading-relaxed text-primary">
          {payload}
        </p>
      </div>

      <Button size="md" icon={copiado ? Check : Copy} onClick={copiar}>
        {copiado ? 'Código copiado!' : 'Copiar código PIX'}
      </Button>

      <p className="text-center text-[11px] text-textMuted">
        O valor de {formatCurrency(fatura.total)} já vai no código — não precisa
        digitar.
      </p>

      {!mostrarQr ? (
        <Button
          variant="ghost"
          size="md"
          icon={QrCode}
          onClick={() => setMostrarQr(true)}
        >
          Prefiro pagar pelo QR
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border p-4">
          {qr ? (
            <img src={qr} alt="QR do PIX" className="h-48 w-48 rounded-lg" />
          ) : (
            <div className="h-48 w-48 animate-pulse rounded-lg bg-neutro" />
          )}
          <p className="text-center text-xs text-textMuted">
            Abra o app do banco, escolha PIX e aponte a câmera.
          </p>
        </div>
      )}

      <p className="text-center text-[11px] leading-relaxed text-textMuted">
        A baixa é dada pela plataforma quando o PIX cai. Você não precisa avisar.
      </p>
    </div>
  );
}

function Linha({ label, valor, forte }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-xs text-textMuted">{label}</span>
      <span
        className={`text-right text-sm ${
          forte ? 'font-bold text-text' : 'text-text'
        }`}
      >
        {valor}
      </span>
    </div>
  );
}
