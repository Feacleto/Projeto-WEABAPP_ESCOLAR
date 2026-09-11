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

  // O mês em que cada desconto acaba, por origem.
  const ate = (origem) =>
    (v.descontos || []).find((d) => d.origem === origem)?.ate || null;

  /**
   * ⚠️ `ate: null` É VITALÍCIO, E O DOCUMENTO PRECISA DIZER ISSO COM PALAVRAS.
   *
   * Esta função nasceu porque o contrato estava calado justamente onde o app
   * mais promete. Quando a escada virou vitalícia (10/09/2026), o código
   * inteiro acompanhou — `contratarPlano` grava `ate: null`,
   * `descontosVigentes` o lê como sem prazo, e a conta sai igual três anos
   * depois. Só o DOCUMENTO ficou para trás: a linha imprimia "−30%" e nada
   * mais, enquanto fundador saía "sem prazo" e indicação saía "enquanto
   * ativas".
   *
   * Ou seja: a tela prometia um desconto para sempre e o papel assinado não
   * registrava a promessa. Numa discussão vale o que está escrito — e o que
   * estava escrito era uma régua de descontos com data.
   *
   * ⚠️ E A FRASE TEM DUAS METADES, PORQUE A PROMESSA TEM DUAS. "Sem prazo"
   * sozinho seria promessa aberta: o desconto vale ENQUANTO O CONTRATO
   * ESTIVER VIGENTE, e quem cancela e volta depois volta pela régua do dia,
   * não com o degrau antigo. Omitir a segunda metade criaria a expectativa
   * que gera a reclamação — a pessoa sai, volta, e cobra um desconto que
   * ninguém nunca disse que sobrevivia à saída.
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
        Ao fim do prazo o contrato se <strong>renova por mais 12 meses</strong>,
        salvo manifestação de qualquer das partes.{' '}
        {/* ⚠️ ESTA FRASE FOI REESCRITA NA VERSÃO 7, E A ANTIGA ERA AMBÍGUA NO
          * PIOR LUGAR. Ela dizia que a renovação valia "nas condições de tabela
          * então vigentes" — o que se lê, sem esforço, como "o desconto acaba
          * na renovação". E a linha do desconto, três cláusulas acima, promete
          * "sem prazo enquanto este contrato estiver vigente".
          *
          * Duas cláusulas do mesmo documento dizendo coisas opostas sobre
          * dinheiro. Num contrato de adesão a ambiguidade se resolve a favor de
          * quem aderiu (CDC art. 47), então na prática ele manteria o desconto
          * — mas descobrir isso numa discussão é o pior jeito de ter razão. */}
        <strong>
          Os descontos declarados sem prazo acompanham as renovações
        </strong>{' '}
        enquanto este contrato estiver vigente; os descontos com data de término
        não se renovam. Encerrado o contrato, as condições da cláusula 3ª deixam
        de valer, e uma nova associação segue a tabela vigente na data dela.
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
        prévio, pelo próprio aplicativo. Não há nova cobrança a partir do
        encerramento, e ele opera até o fim do período já pago.{' '}
        {/* ⚠️ A MULTA DO ANUAL PASSOU A ESTAR ESCRITA NA VERSÃO 7.
          *
          * Ela existia inteira em `multa.js` — pura, testada, com teto e
          * carência — e o contrato dizia "sem multa", sem qualquer ressalva.
          * Cobrança que o documento assinado não declara não se sustenta (CDC
          * art. 46: o consumidor não se obriga ao que não teve conhecimento
          * prévio), então a multa era INCOBRÁVEL — e um anual pela metade do
          * preço com saída livre no segundo mês não é um plano, é um vazamento.
          *
          * A metade que NÃO mudou é a do mensal, e ela é absoluta de propósito:
          * "cancelou, cancelou" é o argumento central contra o concorrente que
          * cobra 30% do saldo, e uma exceção com asterisco apaga a frase. */}
        <strong>No plano mensal não há multa</strong> em hipótese alguma. No
        plano anual, que tem compromisso de 12 meses, encerrar antes do prazo
        implica multa de <strong>{pct(FRACAO_DA_MULTA)} das mensalidades
        restantes</strong>, limitada a {TETO_EM_MENSALIDADES} mensalidades —
        nada é devido nos primeiros {DIAS_SEM_MULTA} dias, nem depois de
        cumpridos os 12 meses. O ASSOCIADO do plano anual pode, em vez disso,{' '}
        <strong>optar por não renovar</strong>: cumpre o prazo, o contrato não
        se renova e nenhuma multa é devida.{' '}
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
