import { useMemo, useState } from 'react';
import { FileText, Percent, Gift, CircleDollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet from '../common/Sheet';
import Button from '../common/Button';
import {
  MODOS,
  PERIODICIDADES,
  MESES_DA_PERIODICIDADE,
  setNegociacao,
  setLimiteCriancas,
} from '../../services/taxaService';
import {
  montarContrato,
  emitirContrato,
} from '../../services/contratoAssociacaoService';
import { formatBRL } from '../../utils/formatters';

/**
 * O ORÇAMENTO — e o contrato que nasce dele.
 *
 * Uma folha só faz as duas coisas de propósito: gravar a negociação e emitir o
 * documento. Separar em duas telas criaria a janela em que o combinado existe
 * e o papel não — e é nessa janela que alguém começa a operar sem contrato.
 *
 * A PRÉVIA MOSTRA CAIXA E RECEITA SEPARADOS, SEMPRE
 * Um associado que paga doze meses à vista põe muito no caixa hoje e pouco de
 * receita por mês. Somar os dois é o erro que multiplica valuation por doze, e
 * ele começa aqui — na tela onde o número é decidido. Por isso as duas linhas
 * aparecem lado a lado mesmo quando são iguais (mensal), pra a distinção virar
 * hábito antes de virar problema.
 */

const DESCONTO_SUGERIDO = { anual: 15, anual12: 0, semestral: 5, mensal: 0 };

const ROTULO_PER = {
  mensal: 'Mensal',
  semestral: 'Semestral',
  anual: 'Anual à vista',
  anual12: 'Anual em 12×',
};

export default function OrcamentoSheet({
  open,
  onClose,
  parceiro, // { uid, name, city, email, phone }
  base, // { criancas, mensalidadeMedia }
  config, // a régua da casa — entra no contrato pelo dia do vencimento
  negociacaoAtual,
  ownerUid,
  onSalvo,
}) {
  const [modo, setModo] = useState(negociacaoAtual?.modo || MODOS.PERCENTUAL);
  const [valor, setValor] = useState(String(negociacaoAtual?.valor ?? 6));
  const [per, setPer] = useState(
    negociacaoAtual?.periodicidade || PERIODICIDADES.MENSAL
  );
  const [desconto, setDesconto] = useState(
    String(negociacaoAtual?.descontoAntecipacao ?? 0)
  );
  const [carencia, setCarencia] = useState(
    String(negociacaoAtual?.isencaoMeses ?? 0)
  );
  const [notas, setNotas] = useState(negociacaoAtual?.notas || '');
  // Quantas crianças ativas ele pode cadastrar. Nasce da estimativa que ele
  // deu na inscrição — mas quem fecha o número é esta conversa.
  // O limite vigente vem do doc do parceiro (é lá que a rule lê). Sem limite
  // ainda, a sugestão é o que ele já tem ativo — nunca menos que a operação
  // real, senão o orçamento nasceria bloqueando quem já está rodando.
  const [vagas, setVagas] = useState(
    String(parceiro?.limiteCriancas ?? base?.criancas ?? '')
  );
  const [salvando, setSalvando] = useState(false);

  const conta = useMemo(() => {
    const criancas = Number(base?.criancas) || 0;
    const media = Number(base?.mensalidadeMedia) || 0;
    const baseMensal = criancas * media;
    const v = Number(valor) || 0;
    const d = Number(desconto) || 0;
    const c = Math.max(0, Number(carencia) || 0);
    const meses = MESES_DA_PERIODICIDADE[per] || 1;

    const cheia =
      modo === MODOS.GRATUITO ? 0 : modo === MODOS.FIXO ? v : baseMensal * (v / 100);
    const cobrados = Math.max(0, meses - c);
    const total = cheia * cobrados * (1 - d / 100);

    return {
      baseMensal,
      cheia,
      meses,
      // Caixa: o que entra de uma vez. Em 12× é a parcela.
      caixa: per === PERIODICIDADES.ANUAL12 ? total / 12 : total,
      // Receita reconhecida: o total diluído no período que ele cobre.
      receitaMes: total / meses,
      custoCarencia: cheia * c,
      descontoEmReais: cheia * cobrados * (d / 100),
    };
  }, [base, modo, valor, per, desconto, carencia]);

  const trocarPer = (novo) => {
    setPer(novo);
    // Sugere o desconto usual da periodicidade, mas só se ele ainda não mexeu.
    // Sobrescrever um número que o dono digitou seria o app decidindo preço.
    if (!Number(desconto)) setDesconto(String(DESCONTO_SUGERIDO[novo] ?? 0));
  };

  const salvar = async () => {
    if (!parceiro?.uid) return;
    setSalvando(true);
    try {
      await setNegociacao(parceiro.uid, {
        modo,
        valor: Number(valor) || 0,
        periodicidade: per,
        descontoAntecipacao: Number(desconto) || 0,
        isencaoMeses: Number(carencia) || 0,
        notas,
      });

      // O LIMITE MORA EM `users`, E NÃO AQUI NA NEGOCIAÇÃO.
      //
      // Não é duplicação por descuido: a rule de `children` precisa lê-lo no
      // momento do cadastro, e `getAfter` no doc do motorista custa uma
      // leitura — apontar pra `taxaParceiros` custaria outra, em toda criação
      // de criança, pra sempre. O campo é `write: isOwner()` pelas rules, e o
      // parceiro não alcança nem no próprio doc.
      const limite = Math.max(0, Math.trunc(Number(vagas) || 0));
      if (limite > 0) {
        await setLimiteCriancas(parceiro.uid, limite);
      }

      const conteudo = montarContrato({
        motorista: {
          uid: parceiro.uid,
          name: parceiro.name,
          city: parceiro.city,
          email: parceiro.email,
          phone: parceiro.phone,
        },
        negociacao: {
          modo,
          valor: Number(valor) || 0,
          periodicidade: per,
          descontoAntecipacao: Number(desconto) || 0,
          isencaoMeses: Number(carencia) || 0,
        },
        base: {
          criancas: base?.criancas || 0,
          mensalidadeMedia: base?.mensalidadeMedia || 0,
        },
        // A régua da casa entra pelo dia do vencimento. Sem ela o contrato
        // cairia no padrão e prometeria um dia que a fatura não usaria.
        config,
      });

      await emitirContrato({
        tioUid: parceiro.uid,
        conteudo,
        emitidoPor: ownerUid,
      });

      toast.success('Orçamento salvo e contrato emitido para aceite.');
      onSalvo?.();
      onClose?.();
    } catch (err) {
      console.error('Falha ao salvar orçamento:', err);
      toast.error(err?.message || 'Não deu pra salvar agora.');
    } finally {
      setSalvando(false);
    }
  };

  const gratuito = modo === MODOS.GRATUITO;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon={FileText}
      eyebrow="orçamento"
      title={parceiro?.name || 'Associado'}
      subtitle="Salvar grava a negociação e emite o contrato para ele aceitar."
    >
      <div className="space-y-4">
        <Grupo rotulo="Como cobrar">
          <Opcoes
            valor={modo}
            onChange={setModo}
            opcoes={[
              { v: MODOS.PERCENTUAL, r: 'Percentual', Icon: Percent },
              { v: MODOS.FIXO, r: 'Fixo', Icon: CircleDollarSign },
              { v: MODOS.GRATUITO, r: 'Gratuidade', Icon: Gift },
            ]}
          />
        </Grupo>

        {!gratuito && (
          <>
            <Grupo
              rotulo={
                modo === MODOS.FIXO
                  ? 'Valor fixo por mês (R$)'
                  : 'Percentual sobre a mensalidade (%)'
              }
            >
              <Campo value={valor} onChange={setValor} type="number" step="0.5" />
            </Grupo>

            <Grupo rotulo="Periodicidade">
              <Opcoes
                valor={per}
                onChange={trocarPer}
                opcoes={Object.values(PERIODICIDADES).map((v) => ({
                  v,
                  r: ROTULO_PER[v],
                }))}
              />
            </Grupo>

            <div className="grid grid-cols-2 gap-3">
              <Grupo rotulo="Desconto por antecipação (%)">
                <Campo value={desconto} onChange={setDesconto} type="number" />
              </Grupo>
              <Grupo rotulo="Meses de carência">
                <Campo value={carencia} onChange={setCarencia} type="number" />
              </Grupo>
            </div>
          </>
        )}

        {/* VAGAS — vale inclusive na gratuidade, e é por isso que fica fora
          * do `!gratuito` acima. Associado cortesia também tem tamanho
          * contratado; sem limite, "de graça" vira ilimitado por descuido. */}
        <Grupo rotulo="Vagas de criança contratadas">
          <Campo value={vagas} onChange={setVagas} type="number" />
          <p className="mt-1.5 text-xs leading-relaxed text-textMuted">
            É o teto que o app vai impor: acima disso ele não cadastra e cai
            numa tela pedindo pra falar com você.{' '}
            {base?.criancas > 0 && (
              <>
                Hoje ele tem <strong>{base.criancas}</strong> ativa(s) — abaixo
                disso, ninguém é desligado, mas ele não cadastra mais nenhuma.
              </>
            )}
          </p>
        </Grupo>

        <Grupo rotulo="Nota interna — só você vê">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="O que foi combinado, e por quê."
            className="min-h-[64px] w-full resize-y rounded-xl border border-borderStrong bg-surface px-3 py-2.5 text-[14px] text-text"
          />
        </Grupo>

        {/* ── a conta, com caixa e receita SEMPRE separados ── */}
        <div className="rounded-2xl border border-border bg-surface p-4 text-[13px]">
          {gratuito ? (
            <>
              <Linha rotulo="Este parceiro" valor="não é cobrado" />
              <Linha
                rotulo="Custo pra plataforma"
                valor={`${formatBRL(conta.baseMensal * 0.06)}/mês`}
                cor="text-warning"
                total
              />
              <p className="mt-2 text-xs leading-relaxed text-textMuted">
                A gratuidade aparece no painel como decisão, e o que ela deixa
                de render entra no custo de aquisição — em vez de sumir num
                campo zerado.
              </p>
            </>
          ) : (
            <>
              <Linha rotulo="Base" valor={formatBRL(conta.baseMensal)} />
              <Linha rotulo="Mensalidade cheia" valor={formatBRL(conta.cheia)} />
              {Number(carencia) > 0 && (
                <Linha
                  rotulo={`Carência (${carencia} mês/es)`}
                  valor={`−${formatBRL(conta.custoCarencia)}`}
                  cor="text-warning"
                />
              )}
              {Number(desconto) > 0 && (
                <Linha
                  rotulo={`Antecipação (−${desconto}%)`}
                  valor={`−${formatBRL(conta.descontoEmReais)}`}
                  cor="text-warning"
                />
              )}
              <Linha
                rotulo={
                  per === PERIODICIDADES.MENSAL
                    ? 'Caixa por mês'
                    : per === PERIODICIDADES.ANUAL12
                      ? 'Caixa por parcela'
                      : 'Caixa de uma vez'
                }
                valor={formatBRL(conta.caixa)}
              />
              <Linha
                rotulo="Receita reconhecida"
                valor={`${formatBRL(conta.receitaMes)}/mês`}
                total
              />
              {per !== PERIODICIDADES.MENSAL && (
                <p className="mt-2 text-xs leading-relaxed text-textMuted">
                  As duas linhas são números diferentes e continuam diferentes
                  no painel. Somar caixa antecipado como se fosse receita
                  mensal multiplica o resultado pelo número de meses.
                </p>
              )}
            </>
          )}
        </div>

        <Button onClick={salvar} loading={salvando} variant="secondary">
          {!salvando && <FileText size={18} />}
          Salvar e emitir contrato
        </Button>
      </div>
    </Sheet>
  );
}

function Grupo({ rotulo, children }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold text-text">{rotulo}</p>
      {children}
    </div>
  );
}

function Campo({ value, onChange, ...rest }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-borderStrong bg-surface px-3 py-2.5 text-[15px] text-text"
      {...rest}
    />
  );
}

function Opcoes({ valor, onChange, opcoes }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map(({ v, r, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={valor === v}
          className={`tap inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-[12.5px] font-semibold ${
            valor === v
              ? 'border-primary bg-primary text-white'
              : 'border-borderStrong bg-surface text-textMuted'
          }`}
        >
          {Icon && <Icon size={14} />}
          {r}
        </button>
      ))}
    </div>
  );
}

function Linha({ rotulo, valor, cor, total }) {
  return (
    <div
      className={`flex justify-between py-1 ${
        total ? 'mt-1.5 border-t border-border pt-2 font-bold' : ''
      }`}
    >
      <span className="text-textMuted">{rotulo}</span>
      <span className={`tabular-nums ${cor || 'text-text'}`}>{valor}</span>
    </div>
  );
}
