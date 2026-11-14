import { useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { addChild } from '../../services/childrenService';
import { camposDaEscola } from '../../services/listaDaTurmaService';
import { useDeclaracaoDaSessao } from '../../hooks/useDeclaracaoDaSessao';
import DeclaracaoDeAutorizacao, { DeclaracaoJaFeita } from './DeclaracaoDeAutorizacao';
import { ROTULOS, DECLARACAO_UMA_VEZ } from '../../marca/textosDaLista.js';
import { CLASSE_DO_CAMPO } from './CamposDaLinha';
import CampoDeValor from '../common/CampoDeValor';
import { formatCurrency } from '../../compartilhado/formatters';
import { valorDoCampoFalta } from '../../dominio/cobranca/valorDaMensalidade.js';
import { decidirOkDoNome } from '../../dominio/escola/listaDaTurma.js';

/**
 * A LINHA "+ Nome da criança" — SEMPRE ABERTA NO FIM DA LISTA (RC2).
 *
 * Digitar o nome e tocar em OK cria a criança e deixa a linha pronta para a
 * próxima (o cursor fica nela: a segunda criança custa só o nome e o OK). É a
 * via rápida que substitui as outras duas (a vaga rápida e o cadastro rápido
 * do card) para quem está na lista.
 *
 * A criança nasce `cadastroRapido: true` — FORA da rota até ter rua e hora de
 * pegar (`blocosDaDirecao`) — e com a escola que ele usou por último, que a
 * linha diz qual é: herança silenciosa é dado errado que ninguém vê.
 *
 * ⚠️ A DECLARAÇÃO DE AUTORIZAÇÃO É PEDIDA UMA VEZ AQUI, e gravada em CADA
 * criança (decisão 29): `useDeclaracaoDaSessao` lembra por sessão e por
 * usuário, em memória; o `addChild` grava os três campos (`autorizacaoDeclarada`,
 * a data do servidor e quem). Sem a caixa marcada, nada é criado.
 *
 * ⚠️ VALOR ZERO NÃO (decisão do dono, 14/11/2026). A linha pede também a
 * MENSALIDADE, obrigatória (`valorDoCampoFalta`), já PREENCHIDA com
 * o valor e o vencimento da criança anterior (`anterior`) — a turma costuma
 * ter o mesmo preço, e a segunda criança continua custando só o nome e o OK.
 * A primeira criança dele digita o valor. O valor aparece em destaque
 * ("R$ 350,00") e por extenso antes do OK: o campo é de caixa eletrônico, e
 * "350" vira R$ 3,50 — é a letra grande que pega o engano.
 */
export default function AdicionarCrianca({ escola, anterior = null, onCriada }) {
  const id = useId();
  const campo = useRef(null);
  const blocoDoValor = useRef(null);
  const [nome, setNome] = useState('');
  const valorAnterior = Number(anterior?.monthlyFee) > 0 ? Number(anterior.monthlyFee).toFixed(2) : '';
  const [valor, setValor] = useState(valorAnterior);
  const [erroValor, setErroValor] = useState('');
  const dueDay = anterior?.dueDay || 10;
  const [salvando, setSalvando] = useState(false);
  const declaracao = useDeclaracaoDaSessao();

  // ⚠️ O DUPLO TOQUE NO OK CRIAVA A CRIANÇA DUAS VEZES: `salvando` é estado,
  // e o segundo toque chega antes de o React redesenhar. A ref fecha na hora.
  const emCurso = useRef(false);

  const adicionar = async (ev) => {
    ev?.preventDefault?.();
    const limpo = nome.trim();
    const passo = decidirOkDoNome({
      nome: limpo,
      valor,
      declarou: declaracao.jaDeclarou || declaracao.marcada,
      ocupado: emCurso.current,
    });
    if (passo === 'ignorar') return;
    if (passo === 'declaracao') {
      // Acende o erro da caixa; nada é criado.
      declaracao.confirmar();
      return;
    }
    if (passo === 'valor') {
      setErroValor(ROTULOS.erroSemValor);
      return;
    }
    emCurso.current = true;
    setSalvando(true);
    try {
      const { id: novoId } = await addChild({
        name: limpo,
        // O que a caixa diz AGORA — nunca um `true` escrito à mão: se a
        // decisão acima mudar, o registro não mente por ela.
        autorizacaoDeclarada: declaracao.jaDeclarou || declaracao.marcada,
        cadastroRapido: true,
        monthlyFee: Number(valor),
        dueDay,
        ...(escola ? camposDaEscola(escola) : {}),
      });
      declaracao.lembrar();
      setNome('');
      onCriada?.(novoId);
      campo.current?.focus();
    } catch (err) {
      console.error('[lista da turma] criança não criada:', err?.code || 'erro');
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      emCurso.current = false;
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={adicionar} className="space-y-2">
      {declaracao.jaDeclarou ? (
        <DeclaracaoJaFeita />
      ) : (
        <div className="space-y-1">
          <DeclaracaoDeAutorizacao
            marcada={declaracao.marcada}
            onChange={declaracao.marcar}
            erro={declaracao.erro}
          />
          <p className="px-1 text-sm text-textMuted">{DECLARACAO_UMA_VEZ.texto}</p>
        </div>
      )}
      <label htmlFor={id} className="block px-1 text-base font-semibold text-text">
        {ROTULOS.adicionar}
      </label>
      <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-borderStrong bg-card p-2">
        <input
          ref={campo}
          id={id}
          type="text"
          autoComplete="off"
          autoCapitalize="words"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          enterKeyHint="done"
          placeholder="Digite aqui"
          className={CLASSE_DO_CAMPO}
        />
        <button
          type="submit"
          disabled={salvando || !nome.trim()}
          aria-label={`${ROTULOS.ok}: adicionar a criança`}
          className="tap inline-flex min-h-12 min-w-16 shrink-0 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-base font-bold text-white disabled:opacity-50"
        >
          <Plus size={18} aria-hidden="true" />
          {ROTULOS.ok}
        </button>
      </div>
      {/* O teclado do celular cobre o fim da lista: ao focar o valor, ele sobe
        * para o meio da tela (depois de o teclado abrir). */}
      <div
        ref={blocoDoValor}
        onFocus={() => setTimeout(() => blocoDoValor.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 300)}
        className="space-y-1 px-1"
      >
        <CampoDeValor
          label={ROTULOS.mensalidade}
          value={valor}
          onChange={(v) => {
            setErroValor('');
            setValor(v);
          }}
          error={erroValor}
        />
        {!valorDoCampoFalta(valor) && (
          <p className="text-lg font-bold text-text">
            {formatCurrency(Number(valor))} · {ROTULOS.venceNoDia(dueDay)}
          </p>
        )}
        {valorAnterior && valor === valorAnterior && (
          <p className="text-sm text-textMuted">{ROTULOS.mesmoValorDaAnterior}</p>
        )}
      </div>
      {escola?.nome && <p className="px-1 text-sm text-textMuted">{ROTULOS.naEscola(escola.nome)}</p>}
    </form>
  );
}
