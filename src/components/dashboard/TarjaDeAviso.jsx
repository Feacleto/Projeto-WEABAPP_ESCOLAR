import { AlertTriangle, Clock } from 'lucide-react';

/**
 * QUANDO O APP ESTÁ DIZENDO ALGO QUE NÃO É MAIS VERDADE.
 *
 * O DESENHO ORIGINAL TINHA CINCO CASOS, E CINCO ERA DEMAIS.
 *
 * O trabalho desta tarja não é resolver o medo dela — um WhatsApp ou uma
 * ligação pro motorista resolve tudo, e o botão de falar com ele agora mora
 * no cabeçalho de TODA tela dela, permanente. O trabalho é mais estreito:
 * PARAR DE MENTIR.
 *
 * Por isso sobraram dois. Os dois em que o app AFIRMA algo falso:
 *
 *   1. "A rota de hoje ainda não começou." Às 5h da manhã é calmo e
 *      verdadeiro. Às 6h40, com a criança na porta, a mesma frase cinza lê
 *      como "está tudo normal" — e não está.
 *
 *   2. "Tá na perua · voltando pra casa", com o anel pulsando. Verdade às
 *      17h30, mentira às 18h20. A animação é o pior pedaço: ela reforça a
 *      impressão de que o app está sabendo, quando o app não recebe nada há
 *      quase uma hora.
 *
 * O QUE FICOU DE FORA, E POR QUÊ
 * "A perua atrasou 15 minutos" não entrou. Ali o app está apenas calado, não
 * mentindo: ela vê o relógio, vê a hora combinada na tela, e tem o telefone
 * a um toque. Transporte escolar atrasa dia sim, dia não — uma tarja nesse
 * caso apareceria toda semana e ensinaria ela a pular tarja. E aí as duas de
 * cima, que importam, seriam puladas junto.
 *
 * AS TRÊS REGRAS DO QUE ESTÁ ESCRITO AQUI
 *   1. Um FATO, nunca um sentimento. "O último registro é de 17h32" — jamais
 *      "algo pode ter acontecido".
 *   2. Sempre a alternativa inocente, e ANTES do resto. Ela precisa ouvir
 *      "pode ser só o app dele fechado" antes de imaginar o pior. Isso
 *      protege o motorista também: sem a frase, "não iniciou" soa como "ele
 *      não veio trabalhar".
 *   3. Nunca inventar o motivo. O app não sabe se foi trânsito ou pneu, e
 *      motivo inventado é pior que atraso.
 *
 * Não existe botão aqui de propósito: o de falar com o motorista já está no
 * cabeçalho, a dois centímetros de distância, na mesma tela. Repetir seria
 * dizer que esta tarja é mais urgente que ele, e não é — ela é o aviso, ele
 * é a saída.
 */

export default function TarjaDeAviso({ aviso }) {
  if (!aviso) return null;

  const grave = aviso.nivel === 'grave';
  const Icone = grave ? AlertTriangle : Clock;

  return (
    <div
      role="status"
      className={`-mx-5 -mt-5 mb-1 flex items-start gap-2.5 border-b px-5 py-3 ${
        grave
          ? 'border-red-200 bg-red-50'
          : 'border-amber-200 bg-amber-50'
      }`}
    >
      <Icone
        size={15}
        className={`mt-0.5 shrink-0 ${grave ? 'text-red-600' : 'text-amber-600'}`}
      />
      <div className="min-w-0">
        <p
          className={`text-[12.5px] font-bold leading-snug ${
            grave ? 'text-red-900' : 'text-amber-900'
          }`}
        >
          {aviso.titulo}
        </p>
        <p
          className={`mt-0.5 text-[11.5px] leading-relaxed ${
            grave ? 'text-red-800/90' : 'text-amber-800'
          }`}
        >
          {aviso.corpo}
        </p>
      </div>
    </div>
  );
}
