/**
 * O MENU DO PAINEL DO DONO, EM CINCO GRUPOS (05/10/2026, desenho aprovado pelo
 * dono no canvas "Painel do dono").
 *
 * Eram doze abas numa fileira só, e a fileira deixou de ser lida: quem
 * procura "quanto a base pagaria" não sabe se mora em Números ou em
 * Financeiro. Os grupos dizem a PERGUNTA de cada canto — ver, dinheiro,
 * pessoas, crescer, cuidar — e a aba fica onde a pergunta mora.
 *
 * NA MESA, uma coluna à esquerda; NO CELULAR, as abas de cada grupo quebram em
 * fileiras com o nome do grupo na frente. Nunca uma tira que rola: tira
 * esconde o fim, e foi assim que uma aba já ficou invisível por meses.
 *
 * Só aparece a aba que o painel tem (`disponiveis`): um item que leva a uma
 * tela vazia ensina a não confiar no menu.
 */
const GRUPOS_DO_PAINEL = [
  ['Visão', [['hoje', 'Hoje'], ['uso', 'Uso do app'], ['avaliacao', 'Avaliação do app'], ['kanban', 'Kanban'], ['calendario', 'Calendário do ano']]],
  ['Dinheiro', [['mes', 'Financeiro'], ['economia', 'Economia'], ['esg', 'ESG'], ['numeros', 'Números']]],
  ['Pessoas', [['motoristas', 'Motoristas'], ['familias', 'Famílias'], ['auxiliares', 'Auxiliares'], ['contas', 'Contas']]],
  ['Crescer', [['crm', 'CRM'], ['vendas', 'Vendas'], ['marketing', 'Marketing'], ['indicacoes', 'Indicações'], ['investidores', 'Investidores']]],
  ['Cuidar', [['seguranca', 'Segurança'], ['chamados', 'Chamados'], ['selos', 'Selos'], ['juridico', 'Jurídico'], ['registro', 'Registro'], ['politica', 'Política de bloqueio'], ['platina', 'Platina']]],
];

export default function MenuDoPainel({ tab, onEscolher, disponiveis }) {
  const tem = (id) => !disponiveis || disponiveis.includes(id);
  return (
    <nav aria-label="Seções do painel" className="mb-5 space-y-3 lg:sticky lg:top-4 lg:mb-0 lg:space-y-4">
      {GRUPOS_DO_PAINEL.map(([grupo, itens]) => {
        const visiveis = itens.filter(([id]) => tem(id));
        if (!visiveis.length) return null;
        return (
          <div key={grupo} className="flex flex-wrap items-center gap-1 lg:block lg:space-y-0.5">
            <span className="mr-1 w-full text-xs font-bold uppercase tracking-wide text-textMuted lg:mb-1 lg:block lg:px-3">
              {grupo}
            </span>
            {visiveis.map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                onClick={() => onEscolher(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={`tap min-h-[40px] rounded-xl px-3 text-left text-xs font-bold transition-colors lg:flex lg:w-full lg:items-center ${
                  tab === id ? 'bg-primaryChip text-primaryDark' : 'bg-card text-text lg:bg-transparent lg:hover:bg-card'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        );
      })}
    </nav>
  );
}
