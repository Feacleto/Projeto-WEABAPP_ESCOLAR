import { formatBRL } from '../../compartilhado/formatters';
/* ⚠️ OS NÚMEROS DA MULTA VÊM DA RÉGUA, NUNCA DIGITADOS NA CLÁUSULA.
 *
 * Escrever "20%" à mão aqui criaria a quarta cópia de um número que já mora em
 * `multa.js` e é testado — e a cláusula é justamente o lugar onde a divergência
 * é mais cara: o documento diria uma coisa e a cobrança faria outra, com
 * assinatura no meio. Mudar a régua muda o contrato na mesma alteração. */
import {
  FRACAO_DA_MULTA,
  TETO_EM_MENSALIDADES,
  DIAS_SEM_MULTA,
} from '../../dominio/associacao/multa.js';
import ContratoDocAte7 from './ContratoDocAte7';

/**
 * O CONTRATO DE ASSINATURA DO APLICATIVO, RENDERIZADO (versão 8 em diante).
 *
 * Um componente só, usado dos DOIS lados: o dono vê na ficha, o assinante vê
 * antes de aceitar. Duas telas desenhando o mesmo documento é como um dia
 * elas divergem — e a que a pessoa leu não seria a que o hash provou.
 *
 * NADA É CALCULADO AQUI. Tudo vem pronto de `montarContrato()`, e é esse
 * mesmo objeto que entra no SHA-256. Se a tela recalculasse qualquer número,
 * o hash provaria um conteúdo e a pessoa teria lido outro.
 *
 * ⚠️ MAS O TEXTO É DESENHADO AQUI, E POR ISSO ELE RAMIFICA PELA VERSÃO.
 * O hash prova os números; as cláusulas saem deste código no dia em que
 * alguém abre o documento. Trocar o texto sem desviar faria um contrato
 * aceito na versão 7 ("associação") passar a exibir as cláusulas da 8 —
 * limitação de responsabilidade, reajuste — que ninguém aceitou. Por isso
 * versão ≤ 7 vai para `ContratoDocAte7`, que é o texto antigo congelado, e
 * este arquivo só desenha a 8. A próxima versão que mudar o texto faz o
 * mesmo: congela esta num arquivo próprio antes de reescrever.
 *
 * Imprimível de propósito: `window.print()` do navegador gera o PDF. Sem
 * biblioteca — são 200 KB no bundle de um app que roda em celular de rua, pra
 * fazer o que o sistema operacional já faz.
 */
export default function ContratoDoc({ dados, aceite }) {
  if (!dados) return null;
  if ((Number(dados.versao) || 0) <= 7) {
    return <ContratoDocAte7 dados={dados} aceite={aceite} />;
  }
  return <ContratoDeAssinatura dados={dados} aceite={aceite} />;
}

function ContratoDeAssinatura({ dados, aceite }) {
  const { contratada: c, assinante: a = {}, plano: p, valores: v } = dados;
  const k = dados.condicoes || {};
  const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
  const pct = (f) => `${Math.round((Number(f) || 0) * 100)}%`;

  // O mês em que cada desconto acaba, por origem.
  const ate = (origem) =>
    (v.descontos || []).find((d) => d.origem === origem)?.ate || null;

  /**
   * ⚠️ `ate: null` É VITALÍCIO, E O DOCUMENTO PRECISA DIZER ISSO COM PALAVRAS.
   *
   * A escada virou vitalícia em 10/09/2026 e o código inteiro acompanhou; só
   * o documento ficou para trás, imprimindo "−30%" e nada mais. Numa
   * discussão vale o que está escrito.
   *
   * ⚠️ E A FRASE TEM DUAS METADES, PORQUE A PROMESSA TEM DUAS. "Sem prazo"
   * sozinho seria promessa aberta: o desconto vale ENQUANTO O CONTRATO
   * ESTIVER VIGENTE, e quem cancela e volta depois volta pela régua do dia.
   */
  const validade = (origem) => {
    const d = (v.descontos || []).find((x) => x.origem === origem);
    if (!d) return '';
    if (d.ate === null) return ', sem prazo enquanto este contrato estiver vigente';
    return d.ate ? ` até ${d.ate}` : '';
  };

  return (
    <article className="text-[13px] leading-relaxed text-text print:text-black">
      {/* ── cabeçalho: quem cobra ── */}
      <header className="flex items-start gap-3 border-b-2 border-primary pb-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-white">
          AB
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-extrabold tracking-tight">Alô Buzinou</p>
          <p className="text-[11px] text-textMuted">
            {c.nomeFantasia || c.razao} · CNPJ {c.cnpj}
          </p>
          <p className="text-[11px] text-textMuted">
            {c.cidade} · {c.telefone} · {c.email}
          </p>
        </div>
      </header>

      <h2 className="mt-4 text-[16px] font-extrabold tracking-tight">
        Contrato de Assinatura do Aplicativo Alô Buzinou
      </h2>
      <p className="mb-4 text-[11px] text-textMuted">
        Emitido em {data(dados.emitidoEm)} · versão {dados.versao}
      </p>

      <Clausula n="1" titulo="As partes">
        {/* ⚠️ A CONTRATADA É QUALIFICADA PELA RAZÃO SOCIAL DO MEI — o nome
          * civil do titular —, e "Desenvolva Algo" vem como nome fantasia. A
          * parte de um contrato é a pessoa que o CNPJ diz; o nome fantasia só
          * a identifica. A SEDE vai junto porque é o que a cláusula de foro
          * e a qualificação precisam poder nomear. */}
        <p className="mb-2">
          <strong>CONTRATADA:</strong> {c.razao}
          {c.tipo ? ` (${c.tipo})` : ''}
          {c.nomeFantasia ? `, nome fantasia ${c.nomeFantasia}` : ''}, inscrito
          no CNPJ sob nº {c.cnpj}
          {c.endereco ? `, com sede em ${c.endereco}` : ''}, mantenedor do
          aplicativo Alô Buzinou, e-mail {c.email}.
        </p>
        {/* ⚠️ O CPF/CNPJ DO ASSINANTE É OBRIGATÓRIO NA VERSÃO 8 (05/10/2026,
          * um documento = uma conta). A qualificação sai SEMPRE com o número:
          * a rule de `contratosAssociacao` só deixa nascer contrato cujo
          * documento bata com o que `contratarPlano` registrou. O "—" só
          * aparece numa prévia montada antes disso, nunca num contrato
          * gravado. */}
        <p>
          <strong>ASSINANTE:</strong> {a.nome || '—'}, inscrito no CPF/CNPJ sob
          nº {a.documento || '—'},
          transportador escolar
          {a.cidade ? ` atuante em ${a.cidade}` : ''}
          {a.email ? `, e-mail ${a.email}` : ''}.
        </p>
      </Clausula>

      <Clausula n="2" titulo="Objeto">
        Assinatura, isto é, licença de uso não exclusiva e intransferível, do
        aplicativo Alô Buzinou para a gestão do transporte escolar do
        ASSINANTE: cadastro de crianças, rota, comunicação com responsáveis e
        controle de mensalidades.{' '}
        <strong>
          A CONTRATADA não processa nem intermedeia os pagamentos entre o
          ASSINANTE e as famílias
        </strong>{' '}
        — a mensalidade das crianças é recebida diretamente pelo ASSINANTE.
        Integram este contrato os Termos de Uso e a Política de Privacidade do
        aplicativo.
      </Clausula>

      <Clausula n="3" titulo="Plano e valor da assinatura">
        <table className="w-full text-[12.5px]">
          <tbody>
            <Linha rotulo="Plano" valor={p.rotulo || '—'} forte />
            {/* O QUE A CLÁUSULA DECLARA É O VALOR POR CRIANÇA, NÃO UM TOTAL:
              * declarando a regra, a mesma cláusula continua verdadeira em
              * qualquer tamanho, e crescer não exige contrato novo. Não existe
              * Básico/Pro: o app é completo nos dois planos. */}
            {p.taxaPorCrianca != null && (
              <Linha
                rotulo="Valor por criança ativa"
                valor={`${formatBRL(p.taxaPorCrianca)} por mês`}
                forte
              />
            )}
            {p.minimoMensal != null && (
              <Linha rotulo="Mínimo mensal" valor={formatBRL(p.minimoMensal)} />
            )}
            {p.taxaAcimaDe40 != null && (
              <Linha
                rotulo={`Acima de ${p.criancasNaTaxaCheia} crianças`}
                valor={`${formatBRL(p.taxaAcimaDe40)} por criança excedente`}
              />
            )}
            {p.precoTabela != null && (
              <Linha
                rotulo={`Hoje, com ${p.criancasNaAssinatura} ${p.criancasNaAssinatura === 1 ? 'criança' : 'crianças'}`}
                valor={`${formatBRL(p.precoTabela)} por mês`}
              />
            )}
            <Linha rotulo="Cobrança" valor="mensal" />

            {v.descontoFundador > 0 && (
              <Linha
                rotulo="Condição de fundador"
                valor={`−${pct(v.descontoFundador)}, sem prazo`}
                cor="text-warning"
              />
            )}
            {v.descontoFechamento > 0 && (
              <Linha
                rotulo="Contratação no período de teste"
                valor={`−${pct(v.descontoFechamento)}${
                  validade('fechamento') || validade('antecipacao')
                }`}
                cor="text-warning"
              />
            )}
            {v.descontoIndicacao > 0 && (
              <Linha
                rotulo="Indicações ativas"
                valor={`−${pct(v.descontoIndicacao)} enquanto ativas`}
                cor="text-warning"
              />
            )}
            {/* O PISO APARECE SÓ QUANDO MORDE, mas a regra existe sempre
              * (`valores.pisoDaFatura`). Sem esta linha o documento mostra o
              * desconto cheio e um valor mensal que ele não justifica. */}
            {v.pisoAplicado && (
              <Linha
                rotulo="Piso de manutenção do ambiente"
                valor={`+${formatBRL(v.descontoAbsorvido)} — nenhuma fatura abaixo de ${formatBRL(v.pisoDaFatura)}`}
                cor="text-textMuted"
              />
            )}
            {v.descontoConcessao > 0 && (
              <Linha
                rotulo="Condição concedida"
                valor={`−${pct(v.descontoConcessao)}${ate('concessao') ? ` até ${ate('concessao')}` : ''}`}
                cor="text-warning"
              />
            )}
            {v.isencaoAte && (
              <Linha
                rotulo="Meses sem cobrança"
                valor={`nenhuma fatura até ${v.isencaoAte}`}
                cor="text-warning"
              />
            )}

            {v.diaVencimento > 0 && (
              <Linha rotulo="Vencimento" valor={`todo dia ${v.diaVencimento}`} />
            )}

            <tr className="border-t border-borderStrong">
              <td className="pt-2 font-bold">Valor por mês</td>
              <td className="pt-2 text-right text-[16px] font-extrabold tabular-nums">
                {v.valorMensal == null ? 'a combinar' : formatBRL(v.valorMensal)}
              </td>
            </tr>
          </tbody>
        </table>

        {v.valorMensal === 0 && (
          <p className="mt-2 rounded-lg bg-warningSoft p-2 text-[12px] text-warningText">
            <strong>Nenhum valor é devido</strong> enquanto vigorarem as
            condições acima. Terminado o prazo de cada uma, o valor volta ao que
            sobrar da tabela.
          </p>
        )}

        <p className="mt-2 text-[11.5px] text-textMuted">
          O valor mensal é o valor por criança multiplicado pelo número de
          crianças ativas, apurado no fechamento de cada mês. Não há teto de
          crianças, e o ASSINANTE é avisado antes de a conta mudar.
        </p>
      </Clausula>

      <Clausula n="4" titulo="Vigência, renovação e reajuste">
        De <strong>{data(dados.vigenciaInicio)}</strong> a{' '}
        <strong>{data(dados.vigenciaFim)}</strong> ({dados.vigenciaMeses} meses).
        Ao fim do prazo o contrato se <strong>renova por mais 12 meses</strong>,
        salvo manifestação de qualquer das partes.{' '}
        {/* A frase do desconto na renovação é a da versão 7, que tirou a
          * ambiguidade "nas condições de tabela então vigentes" — lida como
          * "o desconto acaba ao renovar", o oposto da linha da cláusula 3. */}
        <strong>
          Os descontos declarados sem prazo acompanham as renovações
        </strong>{' '}
        enquanto este contrato estiver vigente; os descontos com data de término
        não se renovam. Encerrado o contrato, as condições da cláusula 3ª deixam
        de valer, e uma nova assinatura segue a tabela vigente na data dela.
        {/* ⚠️ O REAJUSTE É NOVO NA 8, E TEM QUATRO TRAVAS QUE SÓ VALEM JUNTAS:
          * uma vez por ano, só na renovação (nunca no meio do período
          * contratado), com teto num índice público, e com aviso antes. A
          * quinta é a saída: quem não aceita o valor novo não renova, sem
          * multa — reajuste que prende o assinante ao preço novo seria
          * alteração unilateral do preço (CDC art. 51, X). O teto e o prazo
          * vêm de `dados.condicoes`, congelados no documento aceito. */}
        <p className="mt-2">
          <strong>Reajuste.</strong> O valor por criança, o valor por criança
          excedente e o mínimo mensal da cláusula 3ª podem ser reajustados{' '}
          <strong>uma vez por ano, somente na renovação</strong>, limitados à
          variação do {k.reajusteIndice || 'IPCA'} acumulada nos 12 meses
          anteriores. A CONTRATADA avisa o ASSINANTE pelo aplicativo com pelo
          menos <strong>{k.reajusteAvisoDias || 30} dias</strong> de antecedência
          da renovação. Os descontos sem prazo continuam valendo, aplicados
          sobre o valor reajustado. Recebido o aviso, o ASSINANTE pode{' '}
          <strong>não renovar, sem multa</strong>, em qualquer plano.
        </p>
      </Clausula>

      <Clausula n="5" titulo="Suspensão por inadimplência">
        {v.diaVencimento > 0 && (
          <>
            Considera-se em atraso o valor não pago até o{' '}
            <strong>dia {v.diaVencimento}</strong> do mês de referência.{' '}
          </>
        )}
        Havendo atraso, a CONTRATADA comunica o ASSINANTE pelo próprio
        aplicativo e poderá{' '}
        <strong>suspender o acesso às funções de operação</strong> — início de
        rota, cadastro e cobrança.{' '}
        <strong>
          Os responsáveis vinculados mantêm acesso aos próprios dados
        </strong>
        , e nenhuma informação é excluída. A suspensão cessa com a
        regularização.{' '}
        <strong>
          A CONTRATADA não comunica a inadimplência aos responsáveis do
          ASSINANTE.
        </strong>
      </Clausula>

      <Clausula n="6" titulo="Encerramento e dados do assinante">
        {/* ⚠️ A CLÁUSULA É ASSIMÉTRICA DE PROPÓSITO: o ASSINANTE encerra na
          * hora, a CONTRATADA mantém 30 dias de aviso. Tirar os dois prazos
          * seria rescisão unilateral sem direito equivalente (CDC art. 51,
          * XI). E a multa do anual está escrita desde a 7 porque cobrança que
          * o documento não declara não se sustenta (CDC art. 46). */}
        <strong>O ASSINANTE pode encerrar a qualquer momento</strong>, sem aviso
        prévio, pelo próprio aplicativo. Não há nova cobrança a partir do
        encerramento, e ele usa o aplicativo até o fim do período já pago.{' '}
        <strong>No plano mensal não há multa</strong> em hipótese alguma. No
        plano anual, que tem compromisso de 12 meses, encerrar antes do prazo
        implica multa de <strong>{pct(FRACAO_DA_MULTA)} das mensalidades
        restantes</strong>, limitada a {TETO_EM_MENSALIDADES} mensalidades —
        nada é devido nos primeiros {DIAS_SEM_MULTA} dias, nem depois de
        cumpridos os 12 meses. O ASSINANTE do plano anual pode, em vez disso,{' '}
        <strong>optar por não renovar</strong>: cumpre o prazo, o contrato não
        se renova e nenhuma multa é devida.{' '}
        <strong>A CONTRATADA</strong>, para encerrar, comunica com{' '}
        <strong>30 dias de antecedência</strong>.{' '}
        {/* O CANAL VAI ESCRITO: direito sem caminho é promessa sem caminho. E
          * desde a 8 é o e-mail dos Termos (`EMAIL_DO_CONTRATO`), não o Gmail
          * de `DEV_EMAIL` — dois endereços para o mesmo direito confundiam. */}
        O ASSINANTE pode solicitar a exportação dos seus dados a qualquer
        tempo, e a exclusão após o encerramento, na forma do art. 18 da LGPD,
        pelo e-mail <strong>{c.email}</strong>.{' '}
        <strong>O encerramento, por si só, não apaga dados</strong> — os
        registros de pagamento são mantidos por 5 anos por obrigação fiscal,
        conforme a Política de Privacidade.
      </Clausula>

      {/* ⚠️ A CLÁUSULA DE DADOS (LGPD art. 39) É NOVA NA 8, E É A MAIS
        * IMPORTANTE DELA. Os dados das famílias e das crianças entram no app
        * pela mão do ASSINANTE, para a relação DELE com elas — ele decide o
        * que cadastrar e para quê, então é o CONTROLADOR; a plataforma trata
        * por conta dele, então é a OPERADORA. Sem isto escrito, a plataforma
        * fica com a responsabilidade de controladora sobre dado que não
        * escolheu coletar, e o assinante sem saber que responde pelo que
        * cadastra.
        *
        * ⚠️ A RESSALVA (b) NÃO É BRECHA, É A LISTA DO QUE JÁ EXISTE: conta de
        * acesso, segurança, cobrança da assinatura, comunidade, níveis — os
        * usos próprios que a Política descreve. Calar sobre eles faria o
        * contrato prometer o que o app não cumpre. E a conta de login de
        * cada responsável é da plataforma como controladora, porque é ela
        * que a família aceita nos Termos. */}
      <Clausula n="7" titulo="Tratamento de dados das famílias">
        Quanto aos dados pessoais dos responsáveis e das crianças que o
        ASSINANTE cadastra no aplicativo, o{' '}
        <strong>ASSINANTE é o controlador</strong> e a{' '}
        <strong>CONTRATADA é a operadora</strong> (Lei 13.709/2018, art. 39). A
        CONTRATADA: (a) trata esses dados somente para prestar o serviço deste
        contrato, conforme as instruções do ASSINANTE dadas pelo uso do
        aplicativo, os Termos de Uso e a Política de Privacidade; (b) não os
        usa para outros fins, nem os vende ou cede, ressalvados os usos
        próprios da plataforma descritos na Política — contas de acesso,
        segurança, cobrança da assinatura e recursos do aplicativo como
        comunidade e níveis; (c) mantém sigilo sobre eles e o exige de quem os
        acessa em seu nome; (d) adota medidas de segurança técnicas e
        administrativas adequadas; (e) usa apenas os fornecedores
        (suboperadores) declarados na Política de Privacidade; (f) apoia o
        ASSINANTE no atendimento de pedidos dos titulares; (g) comunica ao
        ASSINANTE, em prazo razoável, incidente de segurança que possa afetar
        esses dados; e (h) encerrado o contrato, mantém ou elimina os dados
        conforme a Política de Privacidade e as obrigações legais. Os dados da
        conta de acesso de cada responsável são tratados pela CONTRATADA como
        controladora, conforme a Política. O{' '}
        <strong>ASSINANTE declara ter base legal</strong> para cadastrar os
        dados que insere — inclusive os das crianças, no melhor interesse
        delas — e responde pelo uso que ele e a auxiliar que convidar, na conta
        própria dela, fazem do aplicativo.
      </Clausula>

      {/* ⚠️ A LIMITAÇÃO É ESCRITA PARA NÃO SER ABUSIVA. O motorista autônomo
        * pode ser equiparado a consumidor, e cláusula que exonera o
        * fornecedor de tudo é nula (CDC art. 51, I). Por isso: (1) o limite é
        * um VALOR, não uma exoneração; (2) ressalva dolo, culpa grave e o que
        * a lei não deixa limitar; (3) a exclusão de lucros cessantes vale
        * para as DUAS partes. O que a plataforma não responde — o transporte,
        * a relação dele com as famílias — não é limitação: é o que ela de
        * fato não faz (item 7 dos Termos, docs/marca.md). */}
      <Clausula n="8" titulo="Disponibilidade e responsabilidade">
        O aplicativo é oferecido no estado em que se encontra e é melhorado
        continuamente. A CONTRATADA emprega esforços razoáveis para mantê-lo
        disponível, mas <strong>não garante funcionamento ininterrupto</strong>{' '}
        ou livre de falhas: ele depende de internet, do aparelho, do GPS e de
        serviços de terceiros, e pode passar por manutenção — feita, sempre que
        possível, fora dos horários de rota. A CONTRATADA{' '}
        <strong>não presta nem responde pelo serviço de transporte</strong>,
        pela condução do veículo, nem pela relação contratual e financeira
        entre o ASSINANTE e as famílias. Nenhuma das partes responde por lucros
        cessantes. A responsabilidade da CONTRATADA por danos decorrentes deste
        contrato fica limitada ao total pago pelo ASSINANTE nos{' '}
        {k.limiteDaIndenizacaoMeses || 12} meses anteriores ao fato,{' '}
        <strong>
          exceto em caso de dolo ou culpa grave e nas hipóteses em que a lei
          não admite limitação
        </strong>
        .
      </Clausula>

      {/* ⚠️ A COMARCA É DECLARADA (`DEV_COMARCA`), NUNCA DERIVADA DA SEDE, e
        * a ressalva do domicílio é o que impede a cláusula de ser abusiva e
        * cair inteira quando o assinante for tratado como consumidor (CDC
        * arts. 51, IV e 101, I). */}
      <Clausula n="9" titulo="Foro">
        Fica eleito o foro da comarca de <strong>{c.comarca || '—'}</strong>{' '}
        para as questões deste contrato, ressalvado ao ASSINANTE, quando
        considerado consumidor, o direito de propor ação no foro do próprio
        domicílio (CDC, art. 101, I).
      </Clausula>

      {/* ── o rodapé do aceite ── */}
      <footer className="mt-4 border-t border-dashed border-borderStrong pt-3 text-[11.5px] text-textMuted">
        {aceite?.aceitoEm ? (
          <>
            <p>
              <strong className="text-primary">Aceito eletronicamente</strong>{' '}
              por {aceite.aceitoPorNome} em{' '}
              {new Date(
                aceite.aceitoEm?.toDate?.() || aceite.aceitoEm
              ).toLocaleDateString('pt-BR')}
              .
            </p>
            {aceite.aceiteHash && (
              <p className="mt-1 break-all font-mono text-[10px]">
                verificação {aceite.aceiteHash.slice(0, 32)}
              </p>
            )}
            <p className="mt-2">
              O aceite registra data, dispositivo e uma verificação do conteúdo
              — é ela que prova que o texto aceito foi este, e não outro.
            </p>
          </>
        ) : (
          <p>
            <strong className="text-warning">
              Aguardando aceite do assinante.
            </strong>
          </p>
        )}
      </footer>
    </article>
  );
}

function Clausula({ n, titulo, children }) {
  return (
    <section className="mb-3">
      <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-textMuted">
        {n} · {titulo}
      </p>
      <div>{children}</div>
    </section>
  );
}

function Linha({ rotulo, valor, forte, cor }) {
  return (
    <tr>
      <td className="py-1 text-textMuted">{rotulo}</td>
      <td className={`py-1 text-right ${cor || ''} ${forte ? 'font-bold' : ''}`}>
        {valor}
      </td>
    </tr>
  );
}
