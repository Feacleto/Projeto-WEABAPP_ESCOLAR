import { useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { addChild } from '../../services/childrenService';
import { camposDaEscola } from '../../services/listaDaTurmaService';
import { useDeclaracaoDaSessao } from '../../hooks/useDeclaracaoDaSessao';
import DeclaracaoDeAutorizacao, { DeclaracaoJaFeita } from './DeclaracaoDeAutorizacao';
import { ROTULOS, DECLARACAO_UMA_VEZ } from '../../marca/textosDaLista.js';
import { CLASSE_DO_CAMPO } from './CamposDaLinha';

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
 */
export default function AdicionarCrianca({ escola, onCriada }) {
  const id = useId();
  const campo = useRef(null);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const declaracao = useDeclaracaoDaSessao();

  const adicionar = async (ev) => {
    ev?.preventDefault?.();
    const limpo = nome.trim();
    if (!limpo || salvando) return;
    if (!declaracao.confirmar()) return;
    setSalvando(true);
    try {
      const { id: novoId } = await addChild({
        name: limpo,
        // Só chega aqui com a declaração feita (marcada agora ou nesta sessão).
        autorizacaoDeclarada: true,
        cadastroRapido: true,
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
      {escola?.nome && <p className="px-1 text-sm text-textMuted">{ROTULOS.naEscola(escola.nome)}</p>}
    </form>
  );
}
