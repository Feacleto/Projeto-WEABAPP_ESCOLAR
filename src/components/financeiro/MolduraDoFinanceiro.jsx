import { Lock } from 'lucide-react';
import Header from '../layout/Header';

/**
 * A casca das telas da tranca: o cabeçalho "Financeiro" com o selo
 * "Protegido" e a coluna do conteúdo. As telas da tranca (primeira vez,
 * trancada, teclado, esqueci) trocam o MIOLO e mantêm a casca — para a
 * pessoa, ela continua no mesmo lugar, só a porta mudou.
 *
 * `voltarPara` só existe fora do layout do /tio (a fatura, `/tio/taxa`,
 * que não tem a barra de baixo): sem ele não haveria saída na tela. É também
 * ele que esconde sino e perfil ali — fora do layout a escuta do sino não
 * existe.
 */
export default function MolduraDoFinanceiro({ children, voltarPara = null }) {
  return (
    <>
      <Header
        title="Financeiro"
        showBack={!!voltarPara}
        backTo={voltarPara}
        backLabel={voltarPara ? 'Início' : null}
        // Fora do layout do /tio (só a fatura, `/tio/taxa`) não existe a
        // escuta do sino: ele mostraria zero e "nenhum aviso" a quem tem
        // aviso. Mesma escolha das outras telas de fora do layout.
        showGlobal={!voltarPara}
        action={
          // Mora ao lado do título grande, fora da barra (04/10/2026): ali
          // a palavra cabe inteira até no celular de 320 px.
          <span
            className="flex min-h-12 items-center gap-1.5 pr-1 text-sm font-semibold text-textMuted"
            aria-label="Protegido"
          >
            <Lock size={18} className="text-primary" aria-hidden="true" />
            <span>Protegido</span>
          </span>
        }
      />
      <main className="max-w-lg mx-auto px-5 pt-5 pb-6 flex flex-col gap-4">{children}</main>
    </>
  );
}
