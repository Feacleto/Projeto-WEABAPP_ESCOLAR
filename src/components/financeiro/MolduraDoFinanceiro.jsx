import { Lock } from 'lucide-react';
import Header from '../layout/Header';

/**
 * A casca das telas da tranca: o cabeçalho "Financeiro" com o selo
 * "Protegido" e a coluna do conteúdo. As telas da tranca (primeira vez,
 * trancada, teclado, esqueci) trocam o MIOLO e mantêm a casca — para a
 * pessoa, ela continua no mesmo lugar, só a porta mudou.
 *
 * `voltarPara` só existe fora do layout do /tio (a fatura, `/tio/taxa`,
 * que não tem a barra de baixo): sem ele não haveria saída na tela.
 */
export default function MolduraDoFinanceiro({ children, voltarPara = null }) {
  return (
    <>
      <Header
        title="Financeiro"
        showBack={!!voltarPara}
        backTo={voltarPara}
        backLabel={voltarPara ? 'Início' : null}
        action={
          // Abaixo de 360px a palavra sai e fica o cadeado: com ela, o título
          // "Financeiro" saía cortado ("Financ…") — medido em 04/10/2026.
          <span
            className="flex items-center gap-1.5 pr-1 text-sm font-semibold text-textMuted"
            aria-label="Protegido"
          >
            <Lock size={18} className="text-primary" aria-hidden="true" />
            <span className="hidden min-[360px]:inline">Protegido</span>
          </span>
        }
      />
      <main className="max-w-lg mx-auto px-5 pt-5 pb-6 flex flex-col gap-4">{children}</main>
    </>
  );
}
