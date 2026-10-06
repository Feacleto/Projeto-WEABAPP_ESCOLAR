import { useEffect, useState } from 'react';
import { Printer, Mail } from 'lucide-react';
import Spinner from '../common/Spinner';
import { formatCurrency } from '../../compartilhado/formatters';
import { getRetratoDaBase, getSurveyResults } from '../../services/adminMetricsService';
import { COMPANY_INFO } from '../../pages/legal/legalContent';
import { PLANO, TAXA } from '../../dominio/associacao/planos.js';
import { DIAS_DE_USO } from '../../dominio/associacao/retratoDaBase.js';

/**
 * O RELATÓRIO PARA O INVESTIDOR — uma folha, para imprimir ou salvar em PDF
 * (05/10/2026).
 *
 * ⚠️ CAPTAÇÃO FOI DECIDIDA COMO NÃO (docs/pitch-investidor.md): o plano é crescer
 * com receita. A folha existe para responder a quem PROCURA — o contato que
 * chegou pelo site —, e o selo no topo diz isso para o próprio dono não a ler
 * como convite.
 *
 * ⚠️ SÓ NÚMERO DA BASE, NUNCA PESSOA: nenhum nome de motorista, família ou
 * criança entra aqui. Os números vêm do retrato (contagens no servidor + lista
 * de motoristas) e da média da avaliação do app.
 *
 * ⚠️ "PAGARIA POR MÊS" É POTENCIAL, não receita, e a folha escreve isso ao lado.
 * Onde o número não veio, "—", nunca zero.
 *
 * O PDF é o diálogo de impressão do navegador (`window.print`), com um bloco
 * `@media print` que esconde todo o resto do painel e deixa só a folha.
 */
const CSS_DE_IMPRESSAO = `
@media print {
  body * { visibility: hidden !important; }
  .folha-do-investidor, .folha-do-investidor * { visibility: visible !important; }
  .folha-do-investidor {
    position: absolute; left: 0; top: 0; width: 100%;
    border: 0 !important; box-shadow: none !important; border-radius: 0 !important;
    background: #fff !important; color: #000 !important; padding: 0 !important;
  }
  .folha-do-investidor .no-print { display: none !important; }
}
`;

const numero = (v) => (v === null || v === undefined ? '—' : String(v));

function Linha({ rotulo, valor, nota }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border py-2.5 last:border-b-0">
      <dt className="text-sm text-text">{rotulo}</dt>
      <dd className="text-right">
        <span className="font-display text-lg font-extrabold tabular-nums text-text">{valor}</span>
        {nota && <span className="block text-xs text-textMuted">{nota}</span>}
      </dd>
    </div>
  );
}

export default function RelatorioParaInvestidor() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      getRetratoDaBase(),
      // A avaliação é um complemento: se falhar, a folha sai sem ela.
      getSurveyResults().catch((err) => {
        console.error('[admin] avaliação do app não veio para o relatório:', err);
        return null;
      }),
    ])
      .then(([r, pesquisa]) => vivo && setDados({ r: r.retrato, pesquisa }))
      .catch((err) => {
        console.error('[admin] relatório para investidor não carregou:', err);
        if (vivo) setDados(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (dados === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra montar o relatório.
      </p>
    );
  }
  if (!dados) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const { r, pesquisa } = dados;
  const media =
    pesquisa && pesquisa.respondentes > 0 ? pesquisa.mediaGeral.toFixed(1).replace('.', ',') : '—';

  return (
    <section className="space-y-3" aria-labelledby="relatorio-investidor">
      <style>{CSS_DE_IMPRESSAO}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h2 id="relatorio-investidor" className="rotulo">
          Relatório para o investidor
        </h2>
        <button
          type="button"
          onClick={() => window.print()}
          className="tap inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-white"
        >
          <Printer size={15} /> Baixar PDF
        </button>
      </div>

      <p className="no-print rounded-xl bg-primarySoft px-3 py-2 text-xs font-semibold text-primaryDark">
        Captação decidida como não: a tela responde a quem procura.
      </p>

      <article className="folha-do-investidor space-y-5 rounded-2xl border border-border bg-card p-5">
        <header>
          <p className="rotulo">Alô Buzinou</p>
          <h3 className="mt-1 font-display text-xl font-extrabold text-text">
            Retrato da plataforma
          </h3>
          <p className="mt-1 text-xs text-textMuted">
            {new Date().toLocaleDateString('pt-BR')} · só números da base, sem nome de motorista,
            família ou criança.
          </p>
        </header>

        <div>
          <h4 className="text-sm font-bold text-text">A base hoje</h4>
          <dl className="mt-1">
            <Linha
              rotulo="Motoristas rodando"
              valor={`${r.rodaramNaSemana} de ${r.motoristas}`}
              nota={`rota nos últimos ${DIAS_DE_USO} dias`}
            />
            <Linha rotulo="Crianças ativas" valor={numero(r.criancasAtivas)} />
            <Linha
              rotulo="Crianças com a família no app"
              valor={r.fracaoComFamilia === null ? '—' : `${Math.round(r.fracaoComFamilia * 100)}%`}
            />
            <Linha rotulo="Assinantes com plano" valor={numero(r.assinantes)} />
            <Linha
              rotulo="A base pagaria por mês"
              valor={r.pagariaPorMes === null ? '—' : formatCurrency(r.pagariaPorMes)}
              nota="potencial se a cobrança ligasse hoje; não é receita"
            />
            <Linha
              rotulo="Avaliação do app"
              valor={media === '—' ? '—' : `${media} de 5`}
              nota={pesquisa?.respondentes > 0 ? `${pesquisa.respondentes} respostas` : null}
            />
          </dl>
        </div>

        <div>
          <h4 className="text-sm font-bold text-text">O modelo</h4>
          <p className="mt-1 text-sm leading-relaxed text-text">
            Quem paga é o motorista, por criança ativa: {formatCurrency(TAXA[PLANO.MENSAL])} no mensal e{' '}
            {formatCurrency(TAXA[PLANO.ANUAL])} no anual. A família não paga nada, e a mensalidade
            escolar vai direto da família para o motorista, sem passar pela plataforma.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-text">O que ainda não está provado</h4>
          <p className="mt-1 text-sm leading-relaxed text-text">
            Quantos motoristas ficam depois que a cobrança ligar. Hoje a cobrança está desligada, então
            os números acima medem uso, não disposição de pagar.
          </p>
        </div>

        <footer className="border-t border-border pt-3 text-xs text-textMuted">
          {COMPANY_INFO.razaoSocial} · CNPJ {COMPANY_INFO.cnpj}
        </footer>
      </article>

      <div className="no-print rounded-2xl border border-dashed border-border p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-text">
          <Mail size={15} aria-hidden /> Enviar por e-mail
        </p>
        <p className="mt-1 text-xs leading-relaxed text-textMuted">
          Ainda não entra: precisa de uma function nova para mandar a folha pelo remetente oficial.
          Por enquanto, baixe o PDF e responda ao contato abaixo.
        </p>
      </div>
    </section>
  );
}
