import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, TrendingUp, UserPlus, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Skeleton from '../common/Skeleton';
import EmptyState from '../common/EmptyState';
import Button from '../common/Button';
import Input from '../common/Input';
import AppSheet from '../common/AppSheet';
import {
  ETAPAS,
  ETAPA_PERDIDO,
  watchFunil,
  salvarLead,
  moverEtapa,
  registrarPerda,
  metricasDoFunil,
} from '../../services/funilService';
import { formatBRL } from '../../utils/formatters';
import { maskPhone } from '../../utils/masks';

/**
 * O FUNIL COMERCIAL, EM COLUNAS.
 *
 * Colunas de verdade a partir de `lg` — este painel é de mesa. Abaixo disso
 * elas empilham em seções, porque cinco colunas num celular dariam 60px cada.
 *
 * Sem arrastar, nas duas larguras. No celular o arrasto entre colunas erra
 * mais do que acerta; no monitor ele funcionaria, mas manter dois modos de
 * mover cartão custa mais do que rende — e o botão continua sendo o caminho
 * que funciona no teclado e no leitor de tela. Cada cartão tem o de avançar e
 * o de perder.
 *
 * PERDIDO NÃO É A ÚLTIMA COLUNA. Ele é saída lateral, e fica numa lista
 * separada embaixo: tratá-lo como fim do caminho faria o funil parecer que
 * todo mundo termina lá.
 */
export default function FunilKanban({ onOrcar }) {
  const [leads, setLeads] = useState(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [ocupado, setOcupado] = useState(null);

  useEffect(() => watchFunil(setLeads, () => setLeads([])), []);

  const m = useMemo(() => metricasDoFunil(leads || []), [leads]);
  const perdidos = (leads || []).filter((l) => l.etapa === ETAPA_PERDIDO);

  const avancar = async (lead) => {
    const i = ETAPAS.findIndex((e) => e.id === lead.etapa);
    const proxima = ETAPAS[i + 1];
    if (!proxima) return;
    setOcupado(lead.id);
    try {
      await moverEtapa(lead.id, proxima.id, lead);
    } catch (err) {
      // A recusa de fechar sem proposta vem do serviço, com a frase pronta.
      toast.error(err.message, { duration: 7000 });
    } finally {
      setOcupado(null);
    }
  };

  const perder = async (lead) => {
    const motivo = window.prompt(
      `Por que ${lead.nome} não fechou?\n\nSem isso o funil só conta; com isso, ele ensina.`,
      ''
    );
    if (motivo === null) return;
    setOcupado(lead.id);
    try {
      await registrarPerda(lead.id, motivo);
    } catch {
      toast.error('Não deu pra registrar.');
    } finally {
      setOcupado(null);
    }
  };

  if (leads === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <>
        {/* O TEXTO ANTIGO MENTIA: dizia que quem se inscreve pela página
          * pública "entra aqui automaticamente". Não entra — `leadsFunil` não
          * é escrito por ninguém, nem pelo app nem pelas functions. A
          * inscrição pública vai pra `waitlistDrivers`, que é a aba Fila, e é
          * outra coisa de propósito (ver o cabeçalho de `funilService`).
          *
          * Sem o botão abaixo, esta aba ficaria vazia pra sempre — um kanban
          * que só sabe mover e perder cartões que não têm como nascer. */}
        <EmptyState
          icon={UserPlus}
          title="Nenhum lead no funil"
          description="O funil é seu: motorista que ligou, que alguém indicou, que você conheceu numa garagem. Quem se inscreve pela página pública cai na aba Fila."
        />
        <div className="mt-4">
          <Button icon={UserPlus} onClick={() => setNovoAberto(true)}>
            Novo lead
          </Button>
        </div>
        <NovoLeadSheet
          open={novoAberto}
          onClose={() => setNovoAberto(false)}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        variant="secondary"
        icon={UserPlus}
        onClick={() => setNovoAberto(true)}
      >
        Novo lead
      </Button>
      <NovoLeadSheet open={novoAberto} onClose={() => setNovoAberto(false)} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metrica rotulo="No funil" valor={m.ativos} nota="em negociação" />
        <Metrica
          rotulo="Com orçamento"
          valor={m.comProposta}
          nota="proposta na mesa"
        />
        <Metrica
          rotulo="Ticket médio"
          valor={formatBRL(m.ticketMedioProposto)}
          nota="por parceiro/mês"
        />
        <Metrica
          rotulo="Conversão"
          valor={`${Math.round(m.conversao)}%`}
          nota="inscrito → fechado"
        />
      </div>

      {m.pipeline > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-infoBorder bg-infoSoft p-3">
          <TrendingUp size={16} className="mt-0.5 shrink-0 text-infoText" />
          <p className="text-[12.5px] leading-relaxed text-infoText">
            <strong>{formatBRL(m.pipeline)}/mês</strong> é o que entraria se
            tudo que está na mesa fechasse.{' '}
            <span className="text-infoText">
              Isso é expectativa — nunca some com receita real.
            </span>
          </p>
        </div>
      )}

      {/* AS COLUNAS SÓ EXISTEM DE FATO A PARTIR DE `lg`.
        *
        * Cinco etapas lado a lado num celular dariam 60px de largura cada —
        * cartão nenhum cabe. Empilhado, o funil vira uma lista com títulos, que
        * é a leitura certa pra tela estreita. Na tela larga, que é onde este
        * painel mora, ele volta a ser o que o nome promete: dá pra ver de
        * relance onde o negócio empaca.  */}
      <div className="space-y-3 lg:grid lg:grid-cols-5 lg:items-start lg:gap-3 lg:space-y-0">
        {ETAPAS.map((etapa) => {
          const daEtapa = leads.filter((l) => l.etapa === etapa.id);
          // Etapa vazia SOME no celular e FICA na web.
          //
          // Empilhado, um título com nada embaixo é só linha desperdiçada. Em
          // colunas é o contrário: a coluna vazia é a informação — some ela e
          // "Negociando" com zero vira indistinguível de uma etapa que não
          // existe, e o buraco do funil deixa de aparecer.
          return (
            <section
              key={etapa.id}
              className={daEtapa.length ? undefined : 'hidden lg:block'}
            >
              <p className="mb-1.5 flex items-center justify-between font-mono text-xs uppercase tracking-[0.1em] text-textMuted">
                {etapa.rotulo}
                <span className="font-bold text-text">{daEtapa.length}</span>
              </p>
              <div className="space-y-2">
                {daEtapa.map((l) => (
                  <Cartao
                    key={l.id}
                    lead={l}
                    ultima={etapa.id === 'fechado'}
                    ocupado={ocupado === l.id}
                    onAvancar={() => avancar(l)}
                    onPerder={() => perder(l)}
                    onOrcar={() => onOrcar?.(l)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {perdidos.length > 0 && (
        <section>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-[0.1em] text-textMuted">
            Perdidos · {perdidos.length}
          </p>
          <div className="space-y-1.5">
            {perdidos.map((l) => (
              <div
                key={l.id}
                className="rounded-xl border border-border bg-surface px-3 py-2"
              >
                <p className="text-[13px] font-semibold text-textMuted">
                  {l.nome}
                </p>
                {l.motivoPerda && (
                  <p className="text-xs text-textMuted">{l.motivoPerda}</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-textMuted">
            Os motivos aqui são o que diz se o problema é preço, produto ou
            momento — e é a única parte do funil que ensina a vender melhor.
          </p>
        </section>
      )}
    </div>
  );
}

function Cartao({ lead, ultima, ocupado, onAvancar, onPerder, onOrcar }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-text">{lead.nome}</p>
          <p className="text-xs text-textMuted">
            {[lead.cidade, lead.criancasEstimadas && `${lead.criancasEstimadas} crianças`]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {lead.propostaMensal > 0 && (
            <p className="mt-1 font-mono text-xs font-semibold text-primary">
              {formatBRL(lead.propostaMensal)}/mês proposto
            </p>
          )}
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onOrcar}
          className="tap rounded-lg border border-borderStrong px-2.5 py-1.5 text-xs font-semibold text-textMuted"
        >
          {lead.propostaMensal ? 'Rever orçamento' : 'Orçar'}
        </button>
        {!ultima && (
          <button
            type="button"
            onClick={onAvancar}
            disabled={ocupado}
            className="tap inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1.5 text-xs font-bold text-primary disabled:opacity-50"
          >
            Avançar <ArrowRight size={12} />
          </button>
        )}
        <button
          type="button"
          onClick={onPerder}
          disabled={ocupado}
          className="tap inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-textMuted disabled:opacity-50"
        >
          <XCircle size={12} /> Perdi
        </button>
      </div>
    </div>
  );
}

function Metrica({ rotulo, valor, nota }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-textMuted">
        {rotulo}
      </p>
      <p className="mt-1 text-[19px] font-extrabold tabular-nums tracking-tight text-text">
        {valor}
      </p>
      <p className="text-xs leading-tight text-textMuted">{nota}</p>
    </div>
  );
}

/**
 * NOVO LEAD — a porta que faltava.
 *
 * `leadsFunil` não era escrito por lugar nenhum: nem pelo app, nem pelas
 * functions. O kanban sabia mover e perder cartões que não tinham como
 * nascer, e o vazio dizia que a inscrição pública caía aqui — o que é falso,
 * ela cai em `waitlistDrivers` (aba Fila), e a separação é deliberada.
 *
 * SÓ O NOME É OBRIGATÓRIO. Lead nasce de uma ligação no meio da rua, com o
 * nome anotado e o resto por descobrir; exigir cidade e telefone pra registrar
 * transformaria "anotei" em "depois eu cadastro", e depois não vem. O que
 * falta se preenche movendo o cartão — e `moverEtapa` já recusa fechar sem
 * proposta, que é onde o rigor de fato importa.
 *
 * AS ESTIMATIVAS SÃO DO DONO, e não do lead: quantas crianças ele acha que a
 * pessoa tem, quanto ela cobra. Servem pra dimensionar a conversa antes de
 * existir orçamento, e é por isso que o campo se chama "estimada".
 */
function NovoLeadSheet({ open, onClose }) {
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [telefone, setTelefone] = useState('');
  const [criancas, setCriancas] = useState('');
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) {
      toast.error('Pelo menos o nome.');
      return;
    }
    setSalvando(true);
    try {
      // `id` nulo: quem chegou por fora não tem uid, e o serviço gera um.
      // Quem se inscreveu pelo app entra pelo uid — ver `salvarLead`.
      await salvarLead(null, {
        nome,
        cidade,
        telefone,
        criancasEstimadas: criancas,
        notas,
        etapa: 'inscrito',
      });
      toast.success('No funil.');
      onClose?.();
    } catch (err) {
      console.error('Falha ao criar lead:', err);
      toast.error('Não deu pra salvar agora.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppSheet open={open} onClose={onClose} title="Novo lead" icon={UserPlus}>
      <div className="space-y-3 px-5 pb-6">
        <Input
          id="lead-nome"
          label="Nome"
          placeholder="Como você anotou"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="lead-cidade"
            label="Cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
          />
          <Input
            id="lead-telefone"
            label="WhatsApp"
            value={telefone}
            onChange={(e) => setTelefone(maskPhone(e.target.value))}
          />
        </div>
        <Input
          id="lead-criancas"
          label="Crianças (estimativa)"
          type="number"
          inputMode="numeric"
          min="0"
          value={criancas}
          onChange={(e) => setCriancas(e.target.value)}
          hint="Seu chute pra dimensionar a conversa. O número real vem no orçamento."
        />
        <Input
          id="lead-notas"
          label="Nota"
          placeholder="Onde conheceu, o que ele falou"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
        <Button loading={salvando} onClick={salvar}>
          Salvar no funil
        </Button>
      </div>
    </AppSheet>
  );
}
