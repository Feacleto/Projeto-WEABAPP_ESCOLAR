/**
 * O cabeçalho DE CONTEÚDO — a frase que diz onde a pessoa está e o que fazer.
 *
 * POR QUE NÃO BASTAVA O <Header>
 * A barra do topo tem o título e a seta de voltar, e ela resolve LOCALIZAÇÃO:
 * "estou em Minha turma". Só que localização não é a mesma coisa que
 * orientação. Na lista de crianças havia quatro pílulas — Todos, Manhã,
 * Tarde, Noite — sem uma palavra explicando o que elas filtram. Quem cadastrou
 * as crianças sabe; quem abriu o app pela segunda semana, não. O motorista
 * lia quatro botões e não sabia que aquilo eram as turmas dele.
 *
 * A resposta certa não era renomear os filtros: os rótulos estão corretos,
 * o que faltava era alguém apresentando eles. Isso é uma frase, e frase mora
 * num cabeçalho de conteúdo.
 *
 * A REGRA DA SEGUNDA LINHA
 * A primeira linha diz o que a tela é. A segunda diz o que FAZER — verbo, e
 * de preferência apontando pro próximo elemento na tela. Legenda que só
 * reformula o título em outras palavras é ruído com cara de ajuda, e o
 * segundo lugar mais caro da tela é caro demais pra isso.
 *
 * Props:
 *   - title:    string — o que é esta tela
 *   - subtitle: string — o que fazer aqui
 *   - icon:     componente lucide (opcional)
 *   - action:   ReactNode à direita (opcional)
 */
export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  action = null,
}) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={17} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold leading-tight text-text">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs leading-snug text-textMuted">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
