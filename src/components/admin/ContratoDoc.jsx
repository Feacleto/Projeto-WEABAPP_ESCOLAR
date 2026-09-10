import { formatBRL } from '../../compartilhado/formatters';

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

  const { contratada: c, associado: a, plano: p, valores: v } = dados;
  const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
  const pct = (f) => `${Math.round((Number(f) || 0) * 100)}%`;

  // O mês em que cada desconto acaba, por origem. Um desconto sem data no
  // documento é um desconto para sempre — e "para sempre" numa cláusula de
  // preço é a diferença entre um acordo de doze meses e uma tabela nova.
  const ate = (origem) =>
    (v.descontos || []).find((d) => d.origem === origem)?.ate || null;

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
        {/* ⚠️ A QUALIFICAÇÃO DA CONTRATADA INCLUI A SEDE.
          *
          * Faltava, e é o que a cláusula de foro dos Termos precisa poder
          * nomear — ela elege "a comarca da sede do controlador". Um contrato
          * que não diz onde a contratada fica deixa a cláusula sem referência.
          *
          * `c.endereco` vem de `config/developer.js`, a mesma fonte que os
          * Termos e a Política usam desde 09/09/2026: antes disso a identidade
          * estava escrita em três lugares e eles discordavam. */}
        <p className="mb-2">
          <strong>CONTRATADA:</strong> {c.razao}, inscrita no CNPJ sob nº{' '}
          {c.cnpj}
          {c.endereco ? `, com sede em ${c.endereco}` : ''}, mantenedora da
          plataforma Alô Buzinou.
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

      <Clausula n="3" titulo="Plano contratado e taxa">
        <table className="w-full text-[12.5px]">
          <tbody>
            <Linha rotulo="Plano" valor={p.rotulo || '—'} forte />
            {/* ⚠️ O QUE A CLÁUSULA DECLARA É A TAXA, NÃO UM VALOR.
              * A versão 4 congelava o preço da faixa e o teto de crianças, e o
              * efeito era pesado: crescer exigia contrato novo, com aceite
              * novo, por ter ganhado um cliente. Declarando a taxa, a mesma
              * cláusula continua verdadeira em qualquer tamanho.
              * Não existe Básico/Pro: o app é completo nos dois planos. */}
            {p.taxaPorCrianca != null && (
              <Linha
                rotulo="Taxa por criança ativa"
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
                valor={`−${pct(v.descontoFechamento)}${ate('fechamento') || ate('antecipacao') ? ` até ${ate('fechamento') || ate('antecipacao')}` : ''}`}
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
            {/*
              ⚠️ O PISO APARECE SÓ QUANDO MORDE, mas a cláusula existe sempre
              (`valores.pisoDaFatura`). Sem esta linha o documento mostra o
              desconto cheio e um valor mensal que ele não justifica — a mesma
              contradição da concessão, pelo outro lado da conta.
            */}
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
                rotulo="Meses sem taxa"
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
            <strong>Nenhuma taxa é devida</strong> enquanto vigorarem as
            condições acima. Terminado o prazo de cada uma, a taxa volta ao que
            sobrar da tabela.
          </p>
        )}

        {/* A CONTA ACOMPANHA O TAMANHO, E DIZER ISSO AQUI EVITA A CONVERSA MAIS
          * DESAGRADÁVEL QUE EXISTE: a cobrança que subiu sem aviso.
          *
          * ⚠️ O texto anterior dizia "passando do teto, o ASSOCIADO escolhe
          * entre subir de faixa ou indicar quais crianças saem". Não há mais
          * teto: nada trava quando ele cresce, e nenhuma criança precisa sair
          * para a próxima entrar. */}
        <p className="mt-2 text-[11.5px] text-textMuted">
          O valor mensal é a taxa acima multiplicada pelo número de crianças
          ativas, apurado no fechamento de cada mês. Não há teto de crianças, e
          o ASSOCIADO é avisado antes de a conta mudar.
        </p>
      </Clausula>

      <Clausula n="4" titulo="Vigência">
        De <strong>{data(dados.vigenciaInicio)}</strong> a{' '}
        <strong>{data(dados.vigenciaFim)}</strong> ({dados.vigenciaMeses} meses).
        {/* RENOVA DE 12 EM 12, e é isso que dá prazo aos descontos da cláusula
          * 3 — eles duram exatamente um período. */}
        Ao fim do prazo o contrato se <strong>renova por mais 12 meses</strong>{' '}
        nas condições de tabela então vigentes, salvo manifestação de qualquer
        das partes.{' '}
        <strong>Os descontos com prazo não se renovam automaticamente.</strong>
      </Clausula>

      <Clausula n="5" titulo="Suspensão por inadimplência">
        {/* O QUE CONTA COMO ATRASO — a frase que faltava.
          * A cláusula falava em "havendo atraso" sobre um contrato que não
          * marcava data nenhuma. Suspender alguém por descumprir um prazo que
          * o documento não diz é o tipo de cláusula que não se sustenta. */}
        {v.diaVencimento > 0 && (
          <>
            Considera-se em atraso a taxa não paga até o{' '}
            <strong>dia {v.diaVencimento}</strong> do mês de referência.{' '}
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
        {/* ⚠️ A CLÁUSULA É ASSIMÉTRICA DE PROPÓSITO, E SÓ UMA METADE MUDOU.
          *
          * Ela dizia "qualquer das partes pode encerrar mediante aviso de 30
          * dias". O prazo saiu do lado do ASSOCIADO — cancelou, cancelou — e
          * ficou do lado da CONTRATADA.
          *
          * Tirar os dois lados seria pior que não mexer: deixaria a plataforma
          * podendo cortar da noite pro dia quem depende dela para trabalhar, o
          * que é rescisão unilateral sem direito equivalente (CDC art. 51, XI).
          * Quem tem mais poder é quem carrega a obrigação. */}
        <strong>O ASSOCIADO pode encerrar a qualquer momento</strong>, sem aviso
        prévio e sem multa, pelo próprio aplicativo. Não há nova cobrança a
        partir do encerramento, e ele opera até o fim do período já pago.{' '}
        <strong>A CONTRATADA</strong>, para encerrar, comunica com{' '}
        <strong>30 dias de antecedência</strong>. O ASSOCIADO pode solicitar a
        exportação dos seus dados a qualquer tempo, e a exclusão após o
        encerramento, na forma da LGPD.
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
