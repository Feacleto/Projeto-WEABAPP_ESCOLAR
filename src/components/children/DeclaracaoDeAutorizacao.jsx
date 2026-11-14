import { TEXTO_DA_DECLARACAO } from '../../dominio/identidade/autorizacaoDeclarada.js';

/**
 * A CAIXA DA DECLARAÇÃO DE AUTORIZAÇÃO — a mesma nos três caminhos de
 * cadastro de criança (formulário completo, cadastro rápido do primeiro
 * acesso e vaga rápida da perua). Uma fonte só para o texto
 * (`TEXTO_DA_DECLARACAO`), senão cada tela acabaria dizendo uma coisa.
 *
 * ELA NÃO É O CONSENTIMENTO DA FAMÍLIA: fala dos dados OPERACIONAIS (nome,
 * endereço, contato) e não menciona saúde. Consentimento para dado sensível
 * é da responsável, na tela dela, e não pode ser coberto por uma caixa que
 * outra pessoa marca. O que ela resolve é a janela em que ninguém declarava
 * nada: a criança é cadastrada ANTES do convite, e a mãe pode nunca
 * resgatá-lo.
 */
export default function DeclaracaoDeAutorizacao({ marcada, onChange, erro, inputRef }) {
  return (
    <>
      <label
        data-erro={erro ? true : undefined}
        className={`mt-1 flex cursor-pointer items-start gap-3 rounded-2xl border bg-surface p-3 ${
          erro ? 'border-danger' : 'border-border'
        }`}
      >
        <input
          ref={inputRef}
          type="checkbox"
          checked={marcada}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-6 w-6 shrink-0 accent-primary"
        />
        <span className="text-sm leading-relaxed text-text">
          {TEXTO_DA_DECLARACAO.antes}
          <strong>{TEXTO_DA_DECLARACAO.destaque}</strong>
          {TEXTO_DA_DECLARACAO.depois}
        </span>
      </label>
      {erro && (
        <p className="-mt-1 text-sm font-semibold text-dangerText">{erro}</p>
      )}
    </>
  );
}

/**
 * A linha que fica no lugar da caixa depois que a pessoa já declarou nesta
 * sessão: a declaração continua À VISTA (nada é gravado em silêncio), só não
 * pede de novo um toque a cada criança.
 */
export function DeclaracaoJaFeita() {
  return (
    <p className="text-sm text-textMuted">
      Autorização do responsável confirmada nesta sessão.
    </p>
  );
}

