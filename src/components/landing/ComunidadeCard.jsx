import { Users } from 'lucide-react';

/**
 * O tamanho da comunidade, em número.
 *
 * POR QUE O NÚMERO E NÃO "UM ASSOCIADO"
 * Escrito, "um associado" passa batido como figura de linguagem. Em número
 * grande, ele é um FATO — e é justamente o fato que sustenta o resto do
 * argumento: a vaga é contada porque cada associado custa administração. Um
 * projeto que mostra "1" sem rodeio é mais convincente que um que insinua
 * escala: quem está lendo dirige uma van, não compra promessa de tamanho.
 *
 * Quando o segundo entrar, o mesmo cartão diz "2" — sem ninguém reescrever
 * texto, e sem a página envelhecer.
 *
 * A CONTAGEM VEM DE FORA
 * `associados` chega por prop de quem já tem o dado (a home lê o showcase).
 * O padrão é 1 porque é a verdade de hoje: existe um associado ativo, e
 * mostrar 0 quando o backend não responde seria pior que não mostrar nada.
 */
export default function ComunidadeCard({ associados = 1, className = '' }) {
  const n = Math.max(1, Number(associados) || 1);

  return (
    <div
      className={`rounded-2xl border border-emerald-200 bg-emerald-50 p-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm shadow-primary/25">
          <span className="text-2xl font-extrabold leading-none tabular-nums">
            {n}
          </span>
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-tight text-text">
            {n === 1 ? 'associado hoje' : 'associados hoje'} na comunidade
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
            <Users size={12} />
            vaga limitada por estrutura
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-emerald-900/75">
        Cada associado gera administração financeira e técnica pra ter um espaço
        de trabalho digital com qualidade. A gente abre vaga na velocidade que
        consegue sustentar — e acompanha cada um de perto no começo.
      </p>
    </div>
  );
}
