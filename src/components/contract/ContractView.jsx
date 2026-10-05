import { formatBRL } from '../../compartilhado/formatters';
import { formatPhone } from '../../compartilhado/formatters';
import {
  versaoDoTexto,
  regrasDoTexto,
  seAtrasar,
  identificacaoDaContratada,
} from '../../dominio/cobranca/contratoDaFamilia.js';

/*
 * ⚠️ ESTA TELA DESENHA O TEXTO DA VERSÃO GRAVADA, NÃO O TEXTO DE HOJE
 * (05/10/2026). O hash do aceite é tirado de `dados` (os valores), e as
 * cláusulas moram aqui no código — então cada redação tem número
 * (`dados.versaoDoTexto`, ausente = 1) e o que muda entre elas está em
 * `v2 ? … : …`. O ramo do texto 1 NÃO SE EDITA: é o que as famílias que já
 * aceitaram leram. Os números citados (multa, juros, prazos, canal) vêm de
 * `regrasDoTexto`, por versão — antes de 03/10/2026 a multa era literal no
 * texto, e um resumo que a digitasse de novo seria a segunda verdade sobre o
 * mesmo dinheiro.
 */

/**
 * O RESUMO DO COMBINADO — o que a família precisa conferir, ANTES do texto
 * longo (03/10/2026).
 *
 * Ninguém relê nove cláusulas para achar o valor e o dia do vencimento, e é
 * exatamente isso que o portão manda conferir. O resumo responde as cinco
 * perguntas que viram briga depois (quanto, quando vence, até quando, falta
 * dá desconto?, e se atrasar?) com os números lidos do MESMO `data` que o
 * contrato abaixo usa — nunca digitados. Não é parte do documento: some na
 * impressão, e o contrato inteiro continua logo abaixo.
 */
export function ResumoDoCombinado({ data, children }) {
  const { finance, period } = data;
  const linhas = [
    ['Mensalidade', formatBRL(finance.monthlyFee)],
    ['Vencimento', `Todo dia ${finance.dueDay}`],
    ['Vale de', `${period.startDate} a ${period.endDate}`],
    ['Falta e férias', 'Não dão desconto'],
    ['Se atrasar', seAtrasar(data)],
  ];
  return (
    <section className="rounded-2xl border border-border bg-card p-4 print:hidden">
      <h2 className="text-lg font-bold text-text">Resumo do combinado</h2>
      <dl className="mt-3 divide-y divide-border">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-base text-textMuted">{rotulo}</dt>
            <dd className="text-right text-lg font-bold text-text">{valor}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}

/**
 * Renderização visual do contrato. Recebe `data` montado por
 * `buildContractData()` e produz a leitura completa do contrato.
 *
 * Reusado em:
 *   - Tela do Tio (/tio/children/:id/contract) — pra imprimir/enviar
 *   - Gate do Pai — antes de aceitar
 *
 * CSS print já existe em index.css (.print:hidden) — botões de ação
 * ficam escondidos quando imprime.
 */
/**
 * `numero` e `tipo` vêm da versão GRAVADA (`children/{id}/contratos/{n}`);
 * `mudancas`, quando é um aditivo, abre o documento com o que mudou — ninguém
 * relê nove cláusulas para achar o número que mudou.
 */
export default function ContractView({
  data,
  acceptanceInfo = null,
  numero = null,
  tipo = 'contrato',
  mudancas = null,
}) {
  const {
    company,
    parent,
    student,
    finance,
    period,
    contractedYear,
  } = data;
  const v2 = versaoDoTexto(data) >= 2;
  const regras = regrasDoTexto(data);
  const ident = identificacaoDaContratada(company);

  return (
    <article className="bg-card text-left text-base leading-relaxed text-text">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wide">
          Contrato de Prestação de Serviços
          <br />
          de Transporte Escolar
        </h1>
        {/* Só o ADITIVO leva número no topo. O primeiro contrato que a família
          * lê pode ser a "versão 3" — as anteriores foram rascunhos do
          * motorista antes de ela entrar — e o número só confundia. */}
        {numero && tipo === 'aditivo' && (
          <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-textMuted">
            Aditivo · versão {numero}
          </p>
        )}
      </header>

      {mudancas?.length > 0 && (
        <section className="mb-6 rounded-2xl border border-warningBorder bg-warningSoft p-4 print:border-linhaImpressa print:bg-transparent">
          <p className="text-base font-bold text-warningText">
            O que muda em relação à versão anterior
          </p>
          <ul className="mt-2 space-y-1.5">
            {mudancas.map((m) => (
              <li key={m.rotulo} className="text-base text-text">
                <strong>{m.rotulo}:</strong>{' '}
                <span className="line-through text-textMuted">{m.de}</span>{' '}
                → <strong>{m.para}</strong>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-warningText">
            O resto do contrato continua igual. Até o aceite, vale a versão anterior.
          </p>
        </section>
      )}

      {/* Preâmbulo */}
      <section className="space-y-4">
        {v2 ? (
          <p>
            Pelo presente instrumento particular de{' '}
            <strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE
            ESCOLAR</strong>, de um lado <strong>{company.name}</strong>,{' '}
            {ident.tipo === 'CNPJ' ? 'com sede em' : 'com endereço em'}{' '}
            <strong>{company.address}</strong>,{' '}
            {ident.tipo === 'CNPJ'
              ? 'inscrita no CNPJ'
              : ident.tipo === 'CPF'
                ? 'inscrito(a) no CPF'
                : 'inscrito(a) no CPF/CNPJ'}{' '}
            sob nº <strong>{company.document}</strong>
            {ident.representante && (
              <>
                , neste ato representada por{' '}
                <strong>{ident.representante}</strong>
              </>
            )}
            , doravante denominada <strong>CONTRATADA</strong>, e, de outro
            lado, o(a) responsável pelo aluno <strong>{student.name}</strong>,{' '}
            <strong>{parent.name}</strong>
            {parent.email && (
              <>
                , com e-mail <strong>{parent.email}</strong>
              </>
            )}
            {parent.phone && (
              <>
                {parent.email ? ' e' : ', com'} telefone{' '}
                <strong>{formatPhone(parent.phone)}</strong>
              </>
            )}
            , doravante denominado(a) <strong>CONTRATANTE</strong>, têm, entre
            si, justo e contratado o seguinte:
          </p>
        ) : (
          <p>
            Pelo presente instrumento particular de{' '}
            <strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE
            ESCOLAR</strong>,{' '}
            <strong>{company.name}</strong>, com sede à{' '}
            <strong>{company.address}</strong>, devidamente inscrita no
            C.N.P.J./C.P.F. sob nº <strong>{company.document}</strong>, doravante
            apenas denominada <strong>CONTRATADA</strong>, neste ato representada
            por seu representante legal{' '}
            <strong>{company.representative}</strong>, e, de outro lado, o
            responsável pelo aluno <strong>{student.name}</strong>, Sr(a).{' '}
            <strong>{parent.name}</strong>, com email{' '}
            <strong>{parent.email}</strong>
            {parent.phone && (
              <>
                {' '}
                e telefone <strong>{formatPhone(parent.phone)}</strong>
              </>
            )}
            , agora apenas denominado <strong>CONTRATANTE</strong>, tem, entre si,
            justo e contratado o seguinte:
          </p>
        )}

        {/* Cláusula 1 */}
        <p>
          <strong>CLÁUSULA 1ª</strong> – A Contratada obriga-se a transportar o
          aluno do endereço <strong>{student.homeAddress}</strong> para a
          escola <strong>{student.school}</strong>{' '}
          {student.schoolAddress && (
            <>
              (situada em <strong>{student.schoolAddress}</strong>)
            </>
          )}{' '}
          e/ou vice-versa, conforme regime de transporte desejado pelo
          contratante, nos dias letivos, de acordo com o calendário de aulas da
          referida escola.
        </p>

        {/* Cláusula 2 */}
        <p>
          <strong>CLÁUSULA 2ª</strong> – A Contratada se obriga a manter os
          veículos em perfeitas condições de uso, que ofereçam conforto e
          segurança aos alunos que deles se utilizarem.
        </p>

        {/* Cláusula 3 */}
        <p>
          <strong>CLÁUSULA 3ª</strong> – A configuração formal do ato de
          inscrição no serviço de transporte escolar se procede pelo cadastro
          do aluno realizado pela Contratada no aplicativo Alô Buzinou,
          com aceite eletrônico deste contrato pelo Contratante por meio do
          mesmo aplicativo.
        </p>

        {/* Cláusula 4 */}
        <p>
          <strong>CLÁUSULA 4ª</strong> – É de inteira responsabilidade da
          Contratada a prestação de serviço de transporte dos alunos no que se
          refere a designação de veículos, motoristas e auxiliares, fixação do
          itinerário, além de outras providências que as atividades exigirem,
          sem a ingerência do Contratante.
        </p>

        {/* Cláusula 5 */}
        <p>
          <strong>CLÁUSULA 5ª</strong> – Nas ruas que não oferecerem condições
          de tráfego ou de acesso, o motorista do veículo indicará o local
          adequado para acolher e deixar o aluno com seu responsável.
        </p>

        {/* Cláusula 6 */}
        <p>
          <strong>CLÁUSULA 6ª</strong> – Em caso de mudança de endereço ou de
          regime de transporte por parte do Contratante, o presente contrato
          deverá ser renovado ou aditado, sendo que a Contratada reserva-se o
          direito de não fazê-lo.
        </p>

        {/* Cláusula 7 — regra principal: 12 parcelas com férias */}
        <p>
          <strong>CLÁUSULA 7ª</strong> – Como contraprestação pelos serviços
          prestados, o Contratante pagará à Contratada{' '}
          <strong>{finance.installments} parcelas mensais</strong> no valor de{' '}
          <strong>{formatBRL(finance.monthlyFee)}</strong> cada,{' '}
          <strong>
            inclusive durante o período de férias escolares
          </strong>
          . A contraprestação é anual diluída em parcelas mensais para a
          manutenção da vaga e cobertura dos custos operacionais da Contratada,
          independentemente da quantidade de dias letivos do mês.
        </p>

        {/* Cláusula 8 */}
        <p>
          <strong>CLÁUSULA 8ª</strong> – As parcelas terão vencimento todo dia{' '}
          <strong>{finance.dueDay}</strong> de cada mês.
        </p>
        {v2 ? (
          <>
            <p className="pl-4">
              <strong>§ 1º</strong> – Em caso de falta de pagamento no
              vencimento, o valor será acrescido de multa de{' '}
              {regras.multa.pct}% ({regras.multa.extenso}), juros de mora de{' '}
              {regras.juros.pctAoMes}% ({regras.juros.extenso}) ao mês,
              proporcionais aos dias de atraso, e correção monetária pelo IPCA
              (IBGE), nos termos do art. 52, § 1º, do Código de Defesa do
              Consumidor.
            </p>
            <p className="pl-4">
              <strong>§ 2º</strong> – Em caso de inadimplência, a Contratada
              poderá optar, desde que avise o Contratante com antecedência
              mínima de {regras.diasDeAvisoAntesDeSuspender.n} ({regras.diasDeAvisoAntesDeSuspender.extenso}) dias, pelo
              aplicativo Alô Buzinou ou por WhatsApp, e o débito não seja pago
              nesse prazo:
            </p>
            <p className="pl-8">
              I – Pela rescisão contratual, sem prejuízo da cobrança do débito
              vencido e do devido no mês da efetivação.
            </p>
            <p className="pl-8">
              II – Pela suspensão da prestação dos serviços até a quitação do
              débito, sem prejuízo da cobrança do débito vencido e do devido
              no mês da efetivação.
            </p>
          </>
        ) : (
          <>
            <p className="pl-4">
              <strong>§ 1º</strong> – Em caso de falta de pagamento no vencimento,
              o valor será acrescido de multa de {regras.multa.pct}% ({regras.multa.extenso}).
            </p>
            <p className="pl-4">
              <strong>§ 2º</strong> – Em caso de inadimplência, a Contratada poderá
              optar:
            </p>
            <p className="pl-8">
              I – Pela rescisão contratual, independente da exigibilidade do débito
              vencido e do devido no mês da efetivação.
            </p>
            <p className="pl-8">
              II – Pela suspensão da prestação dos serviços, independente da
              exigibilidade do débito vencido e do devido no mês da efetivação.
            </p>
          </>
        )}

        {/* Cláusula 9 */}
        <p>
          <strong>CLÁUSULA 9ª</strong> – O presente contrato tem vigência de{' '}
          <strong>{period.startDate}</strong> a{' '}
          <strong>{period.endDate}</strong> e poderá ser rescindido nas
          seguintes hipóteses:
        </p>
        <p className="pl-4">
          <strong>A) Pelo Contratante:</strong>
        </p>
        <p className="pl-8">I – Por simples desistência formal;</p>
        {v2 && (
          <p className="pl-8">
            II – Por arrependimento, em até {regras.diasDeArrependimento.n}{' '}
            ({regras.diasDeArrependimento.extenso}) dias contados do aceite eletrônico deste contrato, nos
            termos do art. 49 do Código de Defesa do Consumidor, sem multa e
            sem justificativa, pagando apenas pelos dias de transporte
            efetivamente prestados até a desistência, se houver. O que tiver
            sido pago além disso será devolvido, corrigido monetariamente.
          </p>
        )}
        <p className="pl-4">
          <strong>B) Pela Contratada:</strong>
        </p>
        <p className="pl-8">
          {v2
            ? 'I – Por inadimplência, nos termos do inciso I do parágrafo 2º da cláusula 8ª, com o aviso prévio ali previsto.'
            : 'I – Por inadimplência, nos termos do inciso I do parágrafo 2º da cláusula 8ª.'}
        </p>
        <p className="pl-4">
          <strong>Parágrafo Único</strong> –{' '}
          {v2
            ? 'Salvo no arrependimento do inciso II da alínea A, fica o Contratante obrigado a pagar o valor da parcela do mês em que ocorrer o evento.'
            : 'Em todos os casos fica o Contratante obrigado a pagar o valor da parcela do mês em que ocorrer o evento.'}
        </p>

        {v2 && (
          <>
            {/* Cláusula 10 — dados pessoais (LGPD) */}
            <p>
              <strong>CLÁUSULA 10ª</strong> – A Contratada é a controladora
              dos dados pessoais do aluno e do Contratante (nome, endereço,
              escola, telefone, e-mail, horários e registros das viagens),
              tratados para prestar o transporte e cumprir este contrato (Lei
              13.709/2018, art. 7º, V), sempre no melhor interesse da criança
              (art. 14). A Contratada usa o aplicativo Alô Buzinou como
              ferramenta, que trata esses dados em nome dela, como operador.
            </p>
            <p className="pl-4">
              <strong>§ 1º</strong> – Dados de saúde do aluno só serão
              tratados se o Contratante os informar, com consentimento
              específico dado no próprio aplicativo, que pode ser revogado a
              qualquer momento.
            </p>
            <p className="pl-4">
              <strong>§ 2º</strong> – O Contratante pode exercer os direitos
              de titular (como acesso, correção e eliminação dos dados)
              diretamente com a Contratada ou pelo canal do aplicativo,{' '}
              <strong>{regras.canalDoTitular}</strong>.
            </p>

            {/* Cláusula 11 — foro */}
            <p>
              <strong>CLÁUSULA 11ª</strong> – Fica eleito o foro do domicílio
              do Contratante para resolver qualquer questão deste contrato
              (Código de Defesa do Consumidor, art. 101, I).
            </p>
          </>
        )}

        {/* Encerramento */}
        <p className="mt-6">
          E, por estarem justos e contratados, manifestam o aceite pelo
          aplicativo Alô Buzinou, com pleno valor e eficácia jurídica
          conforme legislação vigente sobre documentos eletrônicos.
        </p>

        <p className="text-right text-textMuted">
          {company.city || company.address.split(',').slice(-1)[0].trim() || 'São Paulo'},{' '}
          {/* A data é a da EMISSÃO desta versão, não a de quem está lendo:
            * o contrato gravado não pode ter a data mudando a cada abertura. */}
          {new Date(data.issuedAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
          .
        </p>
      </section>

      {/* Bloco de aceite (visível quando o contrato foi assinado) */}
      {acceptanceInfo && (
        <section className="mt-8 border-t border-border pt-6 space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-textMuted">
            Aceite eletrônico
          </h3>
          <div className="bg-bg rounded-xl p-4 space-y-1 text-sm">
            <p>
              <strong>Aceito por:</strong>{' '}
              {acceptanceInfo.name || '—'}
            </p>
            <p>
              <strong>Data e hora:</strong>{' '}
              {acceptanceInfo.acceptedAt
                ? new Date(acceptanceInfo.acceptedAt).toLocaleString('pt-BR')
                : '—'}
            </p>
            {acceptanceInfo.hash && (
              <p className="break-all">
                <strong>Hash de integridade:</strong>{' '}
                <span className="font-mono text-sm">
                  {acceptanceInfo.hash}
                </span>
              </p>
            )}
            <p className="text-sm text-textMuted pt-1">
              {numero ? `Versão ${numero} do contrato.` : `Contrato versão ${acceptanceInfo.version || 1}.`} Aceite registrado
              eletronicamente conforme MP 2.200-2/2001, art. 10, § 2º, e Código Civil, art. 107.
            </p>
          </div>
        </section>
      )}

      {/* Rodapé com referência do contrato */}
      <footer className="mt-8 text-center text-sm text-textMuted">
        {numero ? `Versão ${numero}` : `Contrato de ${contractedYear}`} · referência:{' '}
        {data.inviteCode || data.childId}
      </footer>
    </article>
  );
}
