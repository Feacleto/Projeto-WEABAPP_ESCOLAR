import { formatCurrency } from '../../compartilhado/formatters';

/**
 * Barra empilhada com legenda em LINHAS — a composição de um total.
 *
 * Substitui a pizza: comparar fatias de ângulo é difícil para qualquer um,
 * e para quem tem 40+ lendo de pé no ponto é impossível.
 *
 * Props:
 *  - segments: [{ chave, rotulo, quantidade, valor, barra, marca, Icon }]
 *      `barra` e `marca` são classes de TOKEN (ver
 *      components/payments/estadoDaMensalidade.js). Esta barra já foi
 *      categórica (emerald/blue/amber/red), e no relatório ela mostrava os
 *      estados da mensalidade com cores que não eram as do resto do app: o
 *      "aguardando" azul aqui e âmbar na lista.
 *
 * O PESO É O VALOR, não a contagem: o cartão verde de cima diz quanto
 * entrou em reais, e a fatia verde precisa ter o mesmo tamanho dessa
 * porcentagem — senão duas medidas do mesmo mês discordam lado a lado.
 * Sem valor nenhum (mensalidades zeradas), cai para a contagem.
 *
 * Os 2px entre as fatias não são enfeite: sem eles, duas cores vizinhas de
 * luminosidade parecida viram uma faixa só para quem não as distingue.
 */
export default function StackedBar({ segments = [] }) {
  const visiveis = segments.filter((s) => (s.quantidade || 0) > 0);
  const porValor = visiveis.some((s) => (Number(s.valor) || 0) > 0);
  const peso = (s) => (porValor ? Number(s.valor) || 0 : s.quantidade || 0);

  const descricao = segments
    .map((s) => `${s.quantidade || 0} ${s.rotulo.toLowerCase()}`)
    .join(', ');

  return (
    <div>
      <div
        role="img"
        aria-label={descricao}
        className="flex h-3.5 gap-[2px] overflow-hidden rounded bg-neutro"
      >
        {visiveis.map((s) => (
          <span
            key={s.chave}
            className={`block h-full transition-[flex-grow] duration-festa ease-freio ${s.barra}`}
            style={{ flexGrow: peso(s), flexBasis: 0, minWidth: peso(s) > 0 ? 4 : 0 }}
          />
        ))}
      </div>

      {/* Uma linha por estado que EXISTE no mês. Linha com zero ensinaria a
        * pular a legenda, e a legenda é onde o valor de cada estado está. */}
      <div className="mt-2.5">
        {visiveis.map((s, i) => {
          const { Icon } = s;
          return (
            <div
              key={s.chave}
              className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 py-2 text-sm ${
                i > 0 ? 'border-t border-neutro' : ''
              }`}
            >
              <span
                aria-hidden
                className={`flex h-6 w-6 items-center justify-center rounded-md ${s.marca}`}
              >
                {Icon && <Icon size={14} strokeWidth={2.6} />}
              </span>
              <span className="min-w-0 truncate text-text">
                {s.rotulo}
                <span className="ml-1.5 text-xs tabular-nums text-textMuted">
                  {s.quantidade}
                </span>
              </span>
              <span className="font-bold tabular-nums text-text">
                {formatCurrency(s.valor || 0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
