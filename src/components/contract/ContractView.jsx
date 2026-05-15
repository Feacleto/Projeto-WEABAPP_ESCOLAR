import { formatBRL } from '../../services/contractService';
import { formatPhone } from '../../utils/formatters';

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
export default function ContractView({ data, acceptanceInfo = null }) {
  const {
    company,
    parent,
    student,
    finance,
    period,
    contractedYear,
  } = data;

  return (
    <article className="bg-card text-text leading-relaxed text-sm">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wide">
          Contrato de Prestação de Serviços
          <br />
          de Transporte Escolar
        </h1>
      </header>

      {/* Preâmbulo */}
      <section className="space-y-4">
        <p className="text-justify">
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

        {/* Cláusula 1 */}
        <p className="text-justify">
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
        <p className="text-justify">
          <strong>CLÁUSULA 2ª</strong> – A Contratada se obriga a manter os
          veículos em perfeitas condições de uso, que ofereçam conforto e
          segurança aos alunos que deles se utilizarem.
        </p>

        {/* Cláusula 3 */}
        <p className="text-justify">
          <strong>CLÁUSULA 3ª</strong> – A configuração formal do ato de
          inscrição no serviço de transporte escolar se procede pelo cadastro
          do aluno realizado pela Contratada no aplicativo Tio Nino Digital,
          com aceite eletrônico deste contrato pelo Contratante por meio do
          mesmo aplicativo.
        </p>

        {/* Cláusula 4 */}
        <p className="text-justify">
          <strong>CLÁUSULA 4ª</strong> – É de inteira responsabilidade da
          Contratada a prestação de serviço de transporte dos alunos no que se
          refere a designação de veículos, motoristas e auxiliares, fixação do
          itinerário, além de outras providências que as atividades exigirem,
          sem a ingerência do Contratante.
        </p>

        {/* Cláusula 5 */}
        <p className="text-justify">
          <strong>CLÁUSULA 5ª</strong> – Nas ruas que não oferecerem condições
          de tráfego ou de acesso, o motorista do veículo indicará o local
          adequado para acolher e deixar o aluno com seu responsável.
        </p>

        {/* Cláusula 6 */}
        <p className="text-justify">
          <strong>CLÁUSULA 6ª</strong> – Em caso de mudança de endereço ou de
          regime de transporte por parte do Contratante, o presente contrato
          deverá ser renovado ou aditado, sendo que a Contratada reserva-se o
          direito de não fazê-lo.
        </p>

        {/* Cláusula 7 — regra principal: 12 parcelas com férias */}
        <p className="text-justify">
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
        <p className="text-justify">
          <strong>CLÁUSULA 8ª</strong> – As parcelas terão vencimento todo dia{' '}
          <strong>{finance.dueDay}</strong> de cada mês.
        </p>
        <p className="text-justify pl-4">
          <strong>§ 1º</strong> – Em caso de falta de pagamento no vencimento,
          o valor será acrescido de multa de 10% (dez por cento).
        </p>
        <p className="text-justify pl-4">
          <strong>§ 2º</strong> – Em caso de inadimplência, a Contratada poderá
          optar:
        </p>
        <p className="text-justify pl-8">
          I – Pela rescisão contratual, independente da exigibilidade do débito
          vencido e do devido no mês da efetivação.
        </p>
        <p className="text-justify pl-8">
          II – Pela suspensão da prestação dos serviços, independente da
          exigibilidade do débito vencido e do devido no mês da efetivação.
        </p>

        {/* Cláusula 9 */}
        <p className="text-justify">
          <strong>CLÁUSULA 9ª</strong> – O presente contrato tem vigência de{' '}
          <strong>{period.startDate}</strong> a{' '}
          <strong>{period.endDate}</strong> e poderá ser rescindido nas
          seguintes hipóteses:
        </p>
        <p className="text-justify pl-4">
          <strong>A) Pelo Contratante:</strong>
        </p>
        <p className="text-justify pl-8">I – Por simples desistência formal;</p>
        <p className="text-justify pl-4">
          <strong>B) Pela Contratada:</strong>
        </p>
        <p className="text-justify pl-8">
          I – Por inadimplência, nos termos do inciso I do parágrafo 2º da
          cláusula 8ª.
        </p>
        <p className="text-justify pl-4">
          <strong>Parágrafo Único</strong> – Em todos os casos fica o
          Contratante obrigado a pagar o valor da parcela do mês em que ocorrer
          o evento.
        </p>

        {/* Encerramento */}
        <p className="text-justify mt-6">
          E, por estarem justos e contratados, manifestam o aceite pelo
          aplicativo Tio Nino Digital, com pleno valor e eficácia jurídica
          conforme legislação vigente sobre documentos eletrônicos.
        </p>

        <p className="text-right text-textMuted">
          {company.address.split(',')[0] || 'São Paulo'},{' '}
          {new Date().toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
          .
        </p>
      </section>

      {/* Bloco de aceite (visível quando o contrato foi assinado) */}
      {acceptanceInfo && (
        <section className="mt-8 border-t border-gray-200 pt-6 space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-textMuted">
            Aceite eletrônico
          </h3>
          <div className="bg-bg rounded-xl p-4 space-y-1 text-xs">
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
                <span className="font-mono text-[10px]">
                  {acceptanceInfo.hash}
                </span>
              </p>
            )}
            <p className="text-[10px] text-textMuted pt-1">
              Contrato versão {acceptanceInfo.version || 1}. Aceite registrado
              eletronicamente conforme MP 2.200-2/2001 e Lei 14.063/2020.
            </p>
          </div>
        </section>
      )}

      {/* Rodapé com referência do contrato */}
      <footer className="mt-8 text-center text-[10px] text-textMuted">
        Contrato gerado para o ano de {contractedYear} · referência:{' '}
        {data.inviteCode || data.childId}
      </footer>
    </article>
  );
}
