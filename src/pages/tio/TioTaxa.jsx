import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import AvisoDoQrPix from '../../components/payments/AvisoDoQrPix';
import { Check, Copy, FileText, QrCode, Receipt, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import Header from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import ConviteParaIndicar from '../../components/tio/ConviteParaIndicar';
import { buildPixPayload } from '../../dominio/cobranca/pixPayload';
import {
  formatCurrency,
  formatDate,
  formatMonthLabel,
} from '../../compartilhado/formatters';
import { explicarIsencao } from '../../dominio/associacao/isencaoDaFatura.js';
import { watchFaturasDoParceiro } from '../../services/taxaService';

/**
 * MEU PLANO na visão do MOTORISTA — o que ele deve à plataforma.
 *
 * ⚠️ O NOME DA ÁREA É "MEU PLANO" (03/10/2026), o mesmo do menu do rosto. O
 * título era "Taxa de associação", e a mesma área tinha quatro nomes ("Meu
 * plano", "Taxa de associação", "Planos e valores", "Escolha seu plano"):
 * quem toca em "Meu plano" e cai numa tela chamada outra coisa acha que
 * errou o caminho. Aqui é "Meu plano" (fatura, valor, histórico); a escolha
 * mora em `/tio/planos`, "Escolher plano".
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
 * O CABEÇALHO É O `Header` DE TODA TELA INTERNA, mesmo fora do `TioLayout`.
 * Esta rota fica fora do layout (dentro do `GuardaDaConta`, quem está
 * bloqueado não chegaria na tela de pagar), e por isso tinha um "Voltar"
 * próprio, cinza e pequeno — um dos quatro estilos de voltar que o app tinha.
 * O `Header` já sabe consumir a história quando ela existe e cair no destino
 * nomeado quando não existe (quem chega pelo aviso, por um link ou
 * recarregando não é jogado para fora do app, justamente numa tela de
 * pagamento).
 *
 * ⚠️ SEM SINO E SEM ROSTO AQUI (`showGlobal={false}`). A escuta do sino mora
 * no `NotificacoesProvider` do `TioLayout`; fora dele o sino mostraria zero e
 * a folha diria "nenhum aviso" para quem tem aviso — e o menu do rosto
 * ofereceria "Meu plano" a quem já está nele.
 */
export default function TioTaxa() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-bg pb-10">
      <Header
        title="Meu plano"
        showBack
        backLabel="Início"
        backTo="/tio"
        showGlobal={false}
      />

      <div className="mx-auto max-w-lg px-5 pt-4">
        <p className="text-base leading-relaxed text-textMuted">
          O que você paga ao Alô Buzinou. É separado do que as famílias pagam a
          você.
        </p>
        {/* O CONTRATO A UM TOQUE DA COBRANÇA, com o MESMO nome do título da
          * tela de destino. Era "O que foi combinado", em 12px: quem estranha
          * um valor quer ler o que foi combinado, e esse é o momento em que a
          * dúvida vira ou uma conferência de trinta segundos ou uma mensagem
          * no WhatsApp. E escolher (ou trocar) o plano fica ao lado — a área
          * é uma só. */}
        <div className="mt-2 flex flex-wrap gap-x-5">
          <button
            type="button"
            onClick={() => navigate('/tio/contrato-plataforma')}
            className="tap inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary"
          >
            <FileText size={18} aria-hidden="true" />
            Contrato com a plataforma
          </button>
          <button
            type="button"
            onClick={() => navigate('/tio/planos')}
            className="tap inline-flex min-h-12 items-center gap-2 text-base font-semibold text-primary"
          >
            <Repeat size={18} aria-hidden="true" />
            {profile?.plano ? 'Trocar de plano' : 'Escolher plano'}
          </button>
        </div>

        <div className="mt-3">
          <Conteudo />
        </div>
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
      <div className="rounded-2xl bg-card p-5 text-center shadow-rest">
        <Receipt size={22} className="mx-auto text-textMuted" />
        <p className="mt-2 text-base font-semibold text-text">
          Nenhuma fatura ainda
        </p>
        <p className="mt-1 text-sm leading-relaxed text-textMuted">
          Sua primeira fatura aparece aqui no fechamento do mês, com a conta
          que gerou o valor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* O total em aberto vem primeiro: é a única pergunta que ele abre a
        * tela pra responder. */}
      <div className="rounded-2xl bg-card p-5 shadow-rest">
        <p className="rotulo">
          {abertas.length === 0 ? 'tudo em dia' : 'em aberto'}
        </p>
        <p
          className={`mt-1 text-3xl font-bold ${
            abertas.length === 0 ? 'text-primary' : 'text-text'
          }`}
        >
          {formatCurrency(total)}
        </p>
        {abertas.length > 1 && (
          <p className="mt-1 text-sm text-textMuted">
            {abertas.length} meses em aberto
          </p>
        )}
      </div>

      {abertas.map((f) => (
        <FaturaAberta key={f.id} fatura={f} />
      ))}

      {/* ⚠️ O CONVITE A INDICAR APARECE COM A FATURA PAGA, NUNCA COM ELA EM
        * ABERTO — e é a única regra de posição desta tela.
        *
        * Pedir um favor a quem está te devendo é cobrança disfarçada: o
        * cartão apareceria logo abaixo de um valor a pagar, e a leitura seria
        * "traga um colega para conseguir quitar isso". Depois que ele pagou,
        * o mesmo cartão é agradecimento — e é o instante em que ele acabou de
        * ver o número, que é quando um desconto significa alguma coisa.
        *
        * `abertas` é a lista das não quitadas: enquanto houver uma, o convite
        * não sai. */}
      {abertas.length === 0 && faturas.some((f) => f.status === 'quitada') && (
        <ConviteParaIndicar titulo="Obrigado. Dá para a próxima vir menor" />
      )}

      {faturas.some((f) => f.status === 'quitada') && (
        <section>
          <h2 className="mb-2 px-1 text-base font-bold text-text">Histórico</h2>
          <div className="space-y-2">
            {faturas
              .filter((f) => f.status === 'quitada')
              .map((f) => (
                <div
                  key={f.id}
                  className="flex items-baseline justify-between rounded-2xl bg-card px-4 py-3 shadow-rest"
                >
                  <div>
                    <p className="text-base font-semibold capitalize text-text">
                      {formatMonthLabel(f.mes)}
                    </p>
                    <p className="text-sm text-textMuted">
                      {f.criancasAtivas ?? 0} criança(s) ·{' '}
                      {f.planoRotulo || 'sem faixa'}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-base font-bold text-primary">
                    <Check size={16} aria-hidden="true" />
                    {f.isento ? 'isento' : formatCurrency(f.total)}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* A SAÍDA, E ELA FICA NO FIM DA ROLAGEM DO DINHEIRO.
        *
        * ⚠️ ESTE LINK EXISTE PORQUE O CONTRATO O PROMETE. A cláusula 6 diz que
        * o associado encerra "a qualquer momento, sem aviso prévio e sem
        * multa, PELO PRÓPRIO APLICATIVO" — e não havia caminho nenhum. Quem
        * procura cancelar procura na tela de cobrança, que é onde ele está
        * quando decide; escondê-la numa tela de ajustes seria retenção por
        * atrito, que é o que o roteiro comercial usa CONTRA o concorrente.
        *
        * Discreto, mas não escondido: quem não está procurando não tropeça
        * nele, e quem está procurando acha de primeira. Discreto é a COR
        * (cinza, sublinhado), nunca o tamanho: era 12px num alvo de 30, e
        * saída que precisa de lupa é a mesma retenção por atrito com outra
        * roupa. 16px, 48 de alvo, e o mesmo nome da tela de destino. */}
      <div className="pt-2 text-center">
        <Link
          to="/tio/encerrar"
          className="tap inline-flex min-h-12 items-center px-2 text-base text-textMuted underline underline-offset-2"
        >
          Encerrar associação
        </Link>
      </div>
    </div>
  );
}

function FaturaAberta({ fatura }) {
  // ⚠️ A EXPLICAÇÃO VEM DA FATURA, NÃO DO ZERO.
  //
  // Era `fatura.isento || total === 0`, e o texto abaixo dizia "você está no
  // período de teste" para qualquer fatura zerada — inclusive a que foi
  // ISENTADA POR CONCESSÃO, que é decisão de alguém, com motivo e prazo
  // registrados. Os campos que distinguem as duas (`motivoIsencao`,
  // `mesDeTeste`, `testeAte`) já eram gravados e ninguém os lia.
  const isencao = explicarIsencao(fatura);
  const isento = isencao !== null;

  return (
    <div className="rounded-2xl bg-card p-5 shadow-rest">
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
        * Ele vê de onde saiu o número — a taxa, o tamanho da operação e cada
        * desconto, um por um. Valor de cobrança sem a conta do lado é o que
        * transforma cada fatura numa pergunta, e a pergunta chega no WhatsApp.
        *
        * ⚠️ ESTA SEÇÃO JÁ LEU CINCO CAMPOS QUE DEIXARAM DE EXISTIR quando o
        * preço virou de tabela em 06/09/2026. `fecharFatura` encolheu à metade
        * e ninguém veio conferir quem lia do outro lado — a tela passou a
        * mostrar "Crianças ativas —" e "Total R$ 0,00" na própria cobrança da
        * plataforma. É o padrão que o CLAUDE.md nomeia como o mais caro do
        * projeto: comentário que promete garantia sobre um campo cujo gravador
        * mudou.
        *
        * ⚠️ E OS DESCONTOS AGORA SÃO ABERTOS UM A UM, e não somados num
        * percentual só. `fecharFatura` sempre gravou os quatro separados
        * (`descontoFechamento`, `descontoIndicacao`, `descontoFundador`,
        * `descontoConcessao`) e esta tela imprimia a soma — que é exatamente
        * como nasce a queixa "indiquei e não recebi": ele vê 60% e não sabe
        * qual parte é da indicação dele. */}
      <div className="mt-3 space-y-0.5 border-t border-neutro pt-3">
        <Linha
          label={`${fatura.criancas ?? fatura.criancasAtivas ?? 0} crianças × ${
            fatura.taxaPorCrianca != null ? formatCurrency(fatura.taxaPorCrianca) : '—'
          }`}
          valor={fatura.precoTabela != null ? formatCurrency(fatura.precoTabela) : '—'}
        />

        {fatura.descontoFechamento > 0 && (
          <Linha
            label="Desconto de fechamento"
            valor={`− ${Math.round(fatura.descontoFechamento * 100)}%`}
          />
        )}
        {fatura.descontoIndicacao > 0 && (
          <Linha
            label="Suas indicações"
            valor={`− ${Math.round(fatura.descontoIndicacao * 100)}%`}
          />
        )}
        {fatura.descontoFundador > 0 && (
          <Linha
            label="Condição de fundador"
            valor={`− ${Math.round(fatura.descontoFundador * 100)}%`}
          />
        )}
        {fatura.descontoConcessao > 0 && (
          <Linha
            label="Condição concedida"
            valor={`− ${Math.round(fatura.descontoConcessao * 100)}%`}
          />
        )}

        {/* ⚠️ O PISO PRECISA DIZER QUANTO COMEU, e é a linha que o programa de
          * indicação depende. Sem ela, quem indicou cinco colegas vê a fatura
          * parar num valor e conclui que a indicação não valeu — e essa queixa
          * viaja mais rápido numa rede de indicação do que a própria
          * indicação. */}
        {fatura.pisoAplicado && (
          <Linha
            label="Valor mínimo da fatura"
            valor={`+ ${formatCurrency(fatura.descontoAbsorvido || 0)}`}
          />
        )}

        <Linha label="Total" valor={formatCurrency(fatura.total)} forte />
      </div>

      {/* ⚠️ A VALIDADE DO DESCONTO FICA AO LADO DELE, e com o vitalício ela
        * virou a frase mais valiosa da tela. O desconto de fechamento não
        * expira enquanto ele ficar — dizer isso onde ele confere a conta é o
        * que transforma um número numa razão para não sair. */}
      {fatura.descontoFechamento > 0 && (
        <p className="mt-2 text-base leading-relaxed text-text">
          Seu desconto é <strong>permanente</strong>. Ele não tem prazo de
          validade.
        </p>
      )}

      {/* O plano da fatura de teste é VITRINE, e apresentar projeção como
        * cláusula é o começo de uma discussão sobre quanto foi combinado. */}
      {fatura.planoContratado === false && (
        <p className="mt-1 text-sm leading-relaxed text-textMuted">
          O cálculo acima usa o plano mensal, porque você ainda não escolheu
          um. No anual, o valor é menor.
        </p>
      )}

      {isencao ? (
        <p className="mt-3 rounded-xl border border-escolaBorder bg-escolaSoft p-3 text-base leading-relaxed text-escola">
          <strong>{isencao.titulo}</strong>
          {isencao.corpo ? ` ${isencao.corpo}` : ''}
          {/* A data só aparece quando a fatura a congelou. Contador de meses
            * não serve: o teste tem 90 dias corridos e encosta em até quatro
            * meses de calendário, então "mês 4 de 3" apareceria. */}
          {isencao.ate ? ` A isenção do teste vai até ${formatDate(isencao.ate)}.` : ''}
        </p>
      ) : (
        <>
          {/* A COBRANÇA DO GATEWAY, QUANDO ELA EXISTE.
            *
            * ⚠️ `asaasUrl` ERA GRAVADO E NINGUÉM LIA. `criarCobrancaDaFatura`
            * guarda o `invoiceUrl` desde que o gateway entrou no projeto, e
            * nenhuma tela o abria: o dono gerava a cobrança, o motorista
            * continuava vendo só o PIX copia-e-cola, e o boleto/link que
            * acabou de nascer não chegava a quem tem que pagar.
            *
            * Vem ANTES do PIX porque, quando a cobrança existe, é ela que a
            * plataforma reconcilia sozinha — o PIX direto exige baixa à mão.
            * E some quando não existe: hoje, com o gateway desligado, esta
            * tela é exatamente a de antes. */}
          {fatura.asaasUrl && (
            <a
              href={fatura.asaasUrl}
              target="_blank"
              rel="noreferrer"
              className="tap mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-marca text-base font-bold text-naMarca"
            >
              <Receipt size={18} aria-hidden="true" />
              Pagar esta fatura
            </a>
          )}
          <PagamentoPix fatura={fatura} />
        </>
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
        <p className="text-base font-semibold text-text">
          A plataforma ainda não cadastrou a chave PIX
        </p>
        <p className="mt-0.5 text-sm text-textMuted">
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
        <p className="break-all font-mono text-xs leading-relaxed text-primary">
          {payload}
        </p>
      </div>

      {/* A AÇÃO DA TELA, e por isso no tamanho grande — o QR, logo abaixo, é
        * a alternativa, no médio. */}
      <Button icon={copiado ? Check : Copy} onClick={copiar}>
        {copiado ? 'Código copiado!' : 'Copiar código PIX'}
      </Button>

      <p className="text-center text-sm text-textMuted">
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
          <AvisoDoQrPix />
        </div>
      )}

      <p className="text-center text-sm leading-relaxed text-textMuted">
        A baixa é dada pela plataforma quando o PIX cai. Você não precisa avisar.
      </p>
    </div>
  );
}

function Linha({ label, valor, forte }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-sm text-textMuted">{label}</span>
      <span
        className={`text-right text-base ${
          forte ? 'font-bold text-text' : 'text-text'
        }`}
      >
        {valor}
      </span>
    </div>
  );
}
