import { useMemo } from 'react';
import { Printer } from 'lucide-react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import { useChildren } from '../../hooks/useChildren';
import { useEscolas } from '../../hooks/useEscolas';
import { useMarcaDoTio } from '../../hooks/useMarcaDoTio';
import { linhasDaLista } from '../../dominio/rota/listaImpressa.js';
import {
  TITULO_DA_TELA,
  ROTULO_DA_FOLHA,
  BOTAO_IMPRIMIR,
  SEM_CRIANCAS,
  NOME_PADRAO,
  AVISO_DO_PAPEL,
  subtituloDaFolha,
  tituloDoGrupo,
} from '../../marca/listaImpressa.js';

/**
 * IMPRIMIR A LISTA DA TURMA (RC2, 14/11/2026) — a folha que ele leva no carro.
 *
 * O QUE ELA MOSTRA, E O QUE NÃO
 * Por escola, na ordem da hora: a hora de pegar, o nome e a rua. Só isso. Quem
 * decide o que entra é `dominio/rota/listaImpressa.js` (lista fechada de
 * quatro campos, com teste que procura telefone, saúde e nota sobre família
 * um por um) — esta tela só desenha o que a régua entrega, e NÃO lê o
 * documento da criança. Papel fica esquecido no carro: o que sai do app deixa
 * de ter login.
 *
 * ── PDF SEM BIBLIOTECA: `window.print()` e o CSS de impressão que o projeto já
 * tem. No celular o diálogo do sistema oferece "Salvar como PDF". Mesmo molde
 * do extrato (`TioChildStatement`).
 *
 * ── NO PAPEL NÃO HÁ COR. Tudo o que tem fundo ou cor de texto na tela vira
 * preto sobre branco no `@media print`, e a única linha é a `linhaImpressa`
 * (o `border` comum some numa impressora a jato quase sem tinta, e é a que o
 * motorista tem). Quem lê o papel lê o NOME e a HORA: a hora vai em negrito e
 * em coluna, porque é por ela que ele corre o dedo.
 *
 * ── UMA AÇÃO POR TELA: "Imprimir ou salvar em PDF", no alto, e não numa barra
 * de pé. A folha pode ter vinte linhas e o botão não pode ficar para o fim da
 * rolagem; a barra de pé teria que se esconder no papel e brigar com o menu.
 */
export default function TioListaImpressa() {
  const { children, loading } = useChildren();
  const { escolas, loading: carregandoEscolas } = useEscolas();
  const { nome } = useMarcaDoTio();
  const agora = useMemo(() => new Date(), []);

  const { total, grupos } = useMemo(() => linhasDaLista(children, escolas), [children, escolas]);

  return (
    <>
      <Header title={TITULO_DA_TELA} showBack backLabel="Minha turma" backTo="/tio/children" />

      <div className="space-y-4 px-5 pb-6 pt-4 print:p-0">
        <div className="space-y-2 print:hidden">
          <Button icon={Printer} onClick={() => window.print()} disabled={loading || total === 0}>
            {BOTAO_IMPRIMIR}
          </Button>
          <p className="text-base text-textMuted">{AVISO_DO_PAPEL.texto}</p>
        </div>

        {(loading || carregandoEscolas) && <Skeleton className="h-64 rounded-2xl print:hidden" />}

        {!loading && !carregandoEscolas && total === 0 && (
          <p className="rounded-2xl bg-card p-5 text-base text-textBody shadow-rest print:hidden">{SEM_CRIANCAS}</p>
        )}

        {!loading && !carregandoEscolas && total > 0 && (
          <article
            data-lista-impressa
            className="rounded-2xl bg-card p-5 shadow-rest print:rounded-none print:bg-transparent print:p-0 print:text-text print:shadow-none"
          >
            <header className="border-b border-border pb-3 print:border-linhaImpressa">
              <p className="rotulo print:text-text">{ROTULO_DA_FOLHA}</p>
              <h2 className="mt-1 font-display text-2xl font-bold leading-tight text-text print:text-text">
                {nome || NOME_PADRAO}
              </h2>
              <p className="mt-0.5 text-base text-textBody print:text-text">{subtituloDaFolha(total, agora)}</p>
            </header>

            {grupos.map((g) => (
              <section key={g.chave} className="mt-5">
                <h3 className="break-after-avoid border-b-2 border-text pb-1 text-base font-bold text-text print:border-text print:text-text">
                  {tituloDoGrupo(g.escola, g.criancas.length)}
                </h3>
                <ul>
                  {g.criancas.map((c) => (
                    <li
                      key={c.id}
                      className="grid break-inside-avoid grid-cols-[4.25rem_1fr] gap-x-3 border-b border-border py-2.5 print:border-linhaImpressa"
                    >
                      <span className="text-base font-bold tabular-nums text-text print:text-text">{c.hora}</span>
                      <span className="min-w-0">
                        <span className="block break-words text-base font-semibold leading-snug text-text print:text-text">
                          {c.nome}
                        </span>
                        <span className="block break-words text-base leading-snug text-textBody print:text-text">
                          {c.rua}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </article>
        )}
      </div>
    </>
  );
}
