import { formatBRL } from '../../services/contractService';

/**
 * O CONTRATO DE ASSOCIAÇÃO, RENDERIZADO.
 *
 * Um componente só, usado dos DOIS lados: o dono vê antes de emitir, o
 * associado vê antes de aceitar. Duas telas desenhando o mesmo documento é
 * como um dia elas divergem — e a que a pessoa leu não seria a que o hash
 * provou.
 *
 * NADA É CALCULADO AQUI. Tudo vem pronto de `montarContrato()`, e é esse
 * mesmo objeto que entra no SHA-256. Se a tela recalculasse qualquer número,
 * o hash provaria um conteúdo e a pessoa teria lido outro.
 *
 * Imprimível de propósito: `window.print()` do navegador gera o PDF. Sem
 * biblioteca — são 200 KB no bundle de um app que roda em celular de rua, pra
 * fazer o que o sistema operacional já faz.
 */
export default function ContratoDoc({ dados, aceite }) {
  if (!dados) return null;

  const { contratada: c, associado: a, taxa: t } = dados;
  const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

  const periodoLabel =
    t.periodicidade === 'mensal'
      ? 'mês'
      : t.periodicidade === 'semestral'
        ? 'semestre'
        : 'ano';

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
            {c.razao} · CNPJ {c.cnpj}
          </p>
          <p className="text-[11px] text-textMuted">
            {c.cidade} · {c.telefone} · {c.email}
          </p>
        </div>
      </header>

      <h2 className="mt-4 text-[16px] font-extrabold tracking-tight">
        Contrato de Associação à Plataforma
      </h2>
      <p className="mb-4 text-[11px] text-textMuted">
        Emitido em {data(dados.emitidoEm)} · versão {dados.versao}
      </p>

      <Clausula n="1" titulo="As partes">
        <p className="mb-2">
          <strong>CONTRATADA:</strong> {c.razao}, inscrita no CNPJ sob nº{' '}
          {c.cnpj}, mantenedora da plataforma Alô Buzinou.
        </p>
        <p>
          <strong>ASSOCIADO:</strong> {a.nome || '—'}, transportador escolar
          {a.cidade ? ` atuante em ${a.cidade}` : ''}.
        </p>
      </Clausula>

      <Clausula n="2" titulo="Objeto">
        Licença de uso da plataforma Alô Buzinou para gestão do transporte
        escolar: cadastro de crianças, roteirização, comunicação com
        responsáveis e controle de mensalidades.{' '}
        <strong>
          A CONTRATADA não processa nem intermedeia os pagamentos entre o
          ASSOCIADO e as famílias
        </strong>{' '}
        — a mensalidade das crianças é recebida diretamente pelo ASSOCIADO.
      </Clausula>

      <Clausula n="3" titulo="Taxa de associação">
        <table className="w-full text-[12.5px]">
          <tbody>
            <Linha rotulo="Regra" valor={t.rotuloRegra} forte />
            <Linha
              rotulo="Base na assinatura"
              valor={`${t.baseCriancas} criança(s) × ${formatBRL(t.baseMensalidade)}`}
            />
            <Linha rotulo="Periodicidade" valor={t.rotuloPeriodicidade} />
            {/* Contrato da versão 1 não tem o campo. Some a linha em vez de
              * escrever "vence todo dia undefined" num documento assinado. */}
            {t.diaVencimento > 0 && (
              <Linha
                rotulo="Vencimento"
                valor={`todo dia ${t.diaVencimento}`}
              />
            )}
            {t.descontoAntecipacao > 0 && (
              <Linha
                rotulo="Desconto por antecipação"
                valor={`−${t.descontoAntecipacao}%`}
                cor="text-warning"
              />
            )}
            {t.carenciaMeses > 0 && (
              <Linha
                rotulo="Carência concedida"
                valor={`${t.carenciaMeses} mês(es) sem cobrança`}
                cor="text-warning"
              />
            )}
            <tr className="border-t border-borderStrong">
              <td className="pt-2 font-bold">Valor por {periodoLabel}</td>
              <td className="pt-2 text-right text-[16px] font-extrabold tabular-nums">
                {formatBRL(t.valorPorPeriodo)}
              </td>
            </tr>
          </tbody>
        </table>
        {t.modo === 'gratuito' && (
          <p className="mt-2 rounded-lg bg-warningSoft p-2 text-[12px] text-warningText">
            <strong>Gratuidade integral.</strong> Nenhuma taxa é devida enquanto
            vigorar esta condição.
          </p>
        )}
      </Clausula>

      <Clausula n="4" titulo="Vigência">
        De <strong>{data(dados.vigenciaInicio)}</strong> a{' '}
        <strong>{data(dados.vigenciaFim)}</strong> ({dados.vigenciaMeses} meses).
        Ao fim do prazo, a CONTRATADA apresenta nova proposta; não havendo
        renovação,{' '}
        <strong>o acesso permanece ativo em regime mensal</strong> até
        manifestação de qualquer das partes.
      </Clausula>

      <Clausula n="5" titulo="Suspensão por inadimplência">
        {/* O QUE CONTA COMO ATRASO — a frase que faltava.
          * A cláusula falava em "havendo atraso" sobre um contrato que não
          * marcava data nenhuma. Suspender alguém por descumprir um prazo que
          * o documento não diz é o tipo de cláusula que não se sustenta. */}
        {t.diaVencimento > 0 && (
          <>
            Considera-se em atraso a taxa não paga até o{' '}
            <strong>dia {t.diaVencimento}</strong> do mês de referência.{' '}
          </>
        )}
        Havendo atraso, a CONTRATADA comunica o ASSOCIADO pelo próprio
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
          ASSOCIADO.
        </strong>
      </Clausula>

      <Clausula n="6" titulo="Encerramento e dados">
        Qualquer das partes pode encerrar mediante aviso de 30 dias. O ASSOCIADO
        pode solicitar a exportação dos seus dados a qualquer tempo, e a
        exclusão após o encerramento, na forma da LGPD.
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
              Aguardando aceite do associado.
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
