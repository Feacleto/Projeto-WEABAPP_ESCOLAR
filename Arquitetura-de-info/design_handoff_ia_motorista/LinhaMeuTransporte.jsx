/**
 * A LINHA QUE ABRE O ÍNDICE.
 *
 * Ela existe em TODOS os estados do Início — inclusive "dirigindo", e esse é
 * o ponto inteiro da mudança. O bloco de cadastro antigo sumia durante a
 * rota, e a rota é justamente quando ele está parado no portão da escola com
 * seis minutos livres. Uma linha de 56 px é o que custa manter o app inteiro
 * alcançável enquanto a perua está parada.
 *
 * Fica no FIM da rolagem em todos os estados: é destino de quem terminou de
 * ler o que a tela tinha pra dizer, não competidor do assunto de agora.
 */
export function LinhaMeuTransporte({ onClick, dirigindo = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap w-full text-left bg-card border border-gray-200 rounded-xl px-3 py-3 flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <LayoutGrid size={16} />
      </div>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-text truncate">
          Meu transporte
        </span>
        {/* O subtítulo MUDA durante a rota, e é a única coisa que muda.
          * Fora de rota ele é um sumário ("o que tem aí dentro"). Dirigindo,
          * ele responde a pergunta do momento — e é a resposta que o
          * motorista não tinha: sim, dá pra avisar a escola sem encerrar. */}
        <span className="block text-[11px] text-textMuted truncate">
          {dirigindo
            ? 'Dá pra avisar a escola aqui mesmo'
            : 'Turma, escolas, rota padrão, avisos'}
        </span>
      </span>
      <ChevronRight size={16} className="text-textMuted shrink-0" />
    </button>
  );
}
