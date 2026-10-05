import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { lerVolta } from '../../components/transferencia/voltaAoAceite';
import {
  Check,
  ChevronRight,
  FileText,
  History,
  Info,
  Lock,
  LogOut,
  MessageCircle,
  MessageSquare,
  PenLine,
  Plus,
  QrCode,
  Repeat,
  Smartphone,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Header from '../../components/layout/Header';
import Sheet from '../../components/common/Sheet';
import Input from '../../components/common/Input';
import { maskCpfCnpj, documentoValido } from '../../compartilhado/masks';
import ConviteParaIndicar from '../../components/tio/ConviteParaIndicar';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { useModuloDeCobranca } from '../../hooks/useCobrancaLigada';
import { useFaturaPlataforma } from '../../hooks/useFaturaPlataforma';
import { MODULO } from '../../dominio/associacao/modulosDeCobranca.js';
import {
  PRECO_DO_CONCORRENTE,
  comparacaoComOMercado,
  linhasDeDesconto,
  pesoNaReceita,
  receitaDaTurma,
} from '../../dominio/associacao/vitrineDoPlano.js';
import { formatCurrency, formatMonthLabel, getCurrentMonthKey } from '../../compartilhado/formatters';
import { salesWhatsAppLink } from '../../config/developer';
import {
  FASE,
  O_QUE_PARA,
  EXPLICACOES,
  DUVIDAS,
  DUVIDAS_PRINCIPAIS,
  faseDoAutoatendimento,
  tomDaFala,
} from '../../dominio/associacao/autoatendimento.js';
import { estadoDaConta, diasDeAtraso, TOLERANCIA_DE_ATRASO } from '../../dominio/associacao/contaAtiva.js';
import { fimDoPeriodoPago } from '../../dominio/associacao/encerramento.js';
import { FRACAO_DA_MULTA } from '../../dominio/associacao/multa.js';
import { contratarPlano } from '../../services/contratacaoService';
import { montarContrato } from '../../dominio/associacao/contratoAssociacao.js';
import { emitirContrato } from '../../services/contratoAssociacaoService';
import {
  PLANO,
  PLANOS_DISPONIVEIS,
  TAXA,
  MINIMO,
  precoDoMes,
  descontoDoFechamento,
  ESCADA_DE_FECHAMENTO,
  PISO_DA_FATURA,
} from '../../dominio/associacao/planos.js';
import { degrauDaDecisao, fimDoTrial, ultimoDiaDoDegrau } from '../../dominio/associacao/trial.js';

/** Timestamp do Firestore, Date ou texto — a data para mostrar, ou null. */
function paraDataLocal(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * A TELA DE PLANOS — o motorista vê o próprio tamanho e escolhe o teto.
 *
 * ELA INFORMA ANTES DE OFERECER. O primeiro bloco não é uma vitrine de planos,
 * é o número de crianças ativas dele. Sem isso a tela pediria uma decisão sobre
 * um dado que só ele tem na cabeça — e o dado está no sistema.
 *
 * O PLANO CAPA QUANTIDADE, NUNCA FUNCIONALIDADE. Nenhum cartão aqui lista
 * "recursos incluídos", porque não existe recurso excluído: mapa ao vivo,
 * cobrança, agenda e relatório valem igual nas três faixas. O que muda é o
 * teto de crianças, que é `users.limiteCriancas` — campo que já existe e que
 * as rules já cobram no cadastro de criança.
 *
 * ELE PODE ESCOLHER MENOS DO QUE USA, e isso foi decisão de produto tomada com
 * o custo na mesa. O que a tela NÃO faz é escolher por ele quais crianças
 * saem: cada uma tem uma família pagando mensalidade, e um corte automático
 * ("as quatro últimas cadastradas") apagaria quatro clientes que ele não
 * escolheu perder. O cartão diz quantas ficariam de fora e manda ele apontar
 * quais, na tela de turma.
 *
 * O PREÇO MOSTRADO JÁ É O DELE. Fundador e indicações entram no número grande,
 * com o valor de tabela riscado ao lado — desconto que só aparece na fatura,
 * um mês depois, não ajuda ninguém a decidir hoje.
 *
 * ELE CONTRATA AQUI DENTRO desde 06/09/2026. Este parágrafo dizia o contrário
 * — "aceitar o plano ainda abre o WhatsApp do consultor" — e continuou dizendo
 * depois de o botão existir, vinte linhas abaixo.
 *
 * A objeção que ele levantava era real: emitir contrato mexe em
 * `contratosAssociacao` e em `limiteCriancas`, que são a parte de dinheiro do
 * sistema. A saída não foi abrir essas rules ao cliente — foi mover a escrita
 * para o servidor (`contratarPlano`) e fazer a rule do contrato exigir que o
 * documento bata com o plano que o servidor gravou.
 */
export default function TioPlanos() {
  const navigate = useNavigate();
  const location = useLocation();
  // ⚠️ O `uid` VEM DO `user`, NUNCA DO `profile`.
  //
  // `profile` é o `snap.data()` de `users/{uid}` (ver `getUserDoc`), e o
  // documento não guarda o próprio id — `uid` não está na whitelist do
  // `allow create` nem no payload do `redeemInvite`. `profile.uid` é
  // `undefined`, e `emitirContrato` começa com `if (!tioUid) throw`.
  //
  // O estrago era invisível porque a ORDEM é a pior possível: `contratarPlano`
  // já gravou faixa, limite, degrau e `assinaturaAte` quando a emissão
  // estoura. O motorista ficava cobrado, sem contrato, e a tela dele dizia
  // "Nenhum contrato emitido ainda" — sem botão. `TioContratoAssociacao` já
  // lia o `user.uid`; esta tela era a única que não.
  const { user, profile, refreshProfile } = useAuth();

  const ativas = Number(profile?.criancasAtivas) || 0;
  const fundador = profile?.condicaoFundador || null;
  const indicacoes = Number(profile?.indicacoesAtivas) || 0;

  // ⚠️ O MENSAL NASCE SELECIONADO, E NÃO O MAIS BARATO.
  //
  // O anual custa metade, então a tentação é abri-lo marcado. Mas ele pede
  // doze meses e tem multa de saída — pré-selecionar o compromisso é escolher
  // pela pessoa na única dimensão em que ela precisa escolher. O mensal é o
  // que não pede nada dela.
  const [escolhido, setEscolhido] = useState(PLANO.MENSAL);
  const mesAtual = getCurrentMonthKey();
  const [assinando, setAssinando] = useState(false);
  // O PASSO DO CPF/CNPJ (05/10/2026): só abre para quem não tem um válido no
  // perfil. Assinar exige o documento, e um documento é uma conta.
  const [pedindoDocumento, setPedindoDocumento] = useState(false);
  const [documento, setDocumento] = useState('');
  const [erroDoDocumento, setErroDoDocumento] = useState('');

  // ── O DEGRAU DA ESCADA, para a oferta do rodapé ─────────────────────────
  //
  // ⚠️ ESTA CONTA É SÓ PARA MOSTRAR. Quem grava o desconto é `contratarPlano`,
  // com o relógio do SERVIDOR, e é de lá que sai o número do toast — aqui o
  // "agora" é o relógio do aparelho. As duas usam a mesma régua e
  // `npm run testar:gateway` prova a igualdade; se divergirem, vale a do
  // servidor, e a tela é a que fica errada.
  const degrauAtual = degrauDaDecisao({
    inicio: profile?.trialInicio,
    agora: new Date(),
  });
  // ⚠️ SEM O MÓDULO DA ESCADA NÃO HÁ DEGRAU. Com a base ligada e a escada
  // desligada, `contratarPlano` grava 0% — e a tela prometia 30% "permanente".
  const escadaAtiva = useModuloDeCobranca(MODULO.ESCADA);
  const fracaoDoDegrau = escadaAtiva ? descontoDoFechamento(degrauAtual) : 0;
  // ⚠️ O ÚLTIMO DIA EM QUE O DEGRAU VALE, nunca `fimDoDegrau`: aquele é o
  // limite EXCLUSIVO, e no dia que ele devolve o servidor já grava o degrau
  // seguinte — "até 10/10, 30%" e a fatura de 20%.
  const viraEm = ultimoDiaDoDegrau(profile?.trialInicio, degrauAtual);
  const dataCurta = (d) =>
    d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

  // JÁ CONTRATOU? A tela então não é de escolha, é de troca de plano.
  const jaContratou = Boolean(profile?.plano);

  /**
   * CONTRATAR — dois passos, e a ordem é a garantia.
   *
   * 1. A callable `contratarPlano` grava a CLÁUSULA (`users.plano` e o
   *    desconto do degrau). O cliente não escreve nenhum desses campos: as
   *    rules recusam, porque cláusula que o devedor edita não é cláusula.
   * 2. Só então o contrato é emitido, e a rule exige que o plano DENTRO dele
   *    seja igual ao que o servidor acabou de gravar.
   *
   * Invertida, a ordem não funciona: emitir antes seria emitir um documento
   * cujo plano ainda não existe em `users`, e a rule negaria.
   */
  /* ⚠️ O CPF/CNPJ VEM ANTES DE TUDO (decisão do dono, 05/10/2026). Sem um
   * válido no perfil, a callable recusaria — então a tela pergunta primeiro,
   * num passo curto, e manda o número junto. Quem GRAVA é o servidor, e só
   * depois de saber que o documento não é de outra conta. */
  const contratar = () => {
    if (!escolhido) return;
    if (!documentoValido(profile?.companyDocument)) {
      setErroDoDocumento('');
      setDocumento('');
      setPedindoDocumento(true);
      return;
    }
    assinar(null);
  };

  const assinarComDocumento = () => {
    if (!documentoValido(documento)) {
      setErroDoDocumento('CPF ou CNPJ inválido. Confira os números.');
      return;
    }
    assinar(documento);
  };

  const assinar = async (documentoNovo) => {
    setAssinando(true);
    try {
      const clausula = await contratarPlano(escolhido, documentoNovo);

      const conteudo = montarContrato({
        // ⚠️ O DOCUMENTO É O QUE O SERVIDOR REGISTROU, não o do perfil em
        // memória (que ainda não foi relido): a rule do contrato compara os
        // dois e recusa se divergirem.
        motorista: { uid: user?.uid, ...profile, documentoDaAssinatura: clausula.documento },
        plano: escolhido,
        criancas: ativas,
        fundador: profile?.condicaoFundador || null,
        indicacoesAtivas: indicacoes,
        descontos: clausula.descontos,
        // ⚠️ DO SERVIDOR, NUNCA DO PERFIL. Aqui era `profile?.diaVencimento`,
        // um campo de `users` que nenhum caminho do projeto escreve — o
        // contrato saía sempre com o padrão, mesmo quando o dono tinha
        // trocado o dia no painel. O dia é da CASA e mora em `taxaConfig`,
        // que o motorista não lê; `contratarPlano` o devolve.
        diaVencimento: clausula.diaVencimento,
        isencaoAte: profile?.isencaoAte || null,
      });
      await emitirContrato({ tioUid: user?.uid, conteudo, emitidoPor: user?.uid });

      await refreshProfile();
      // ⚠️ O NÚMERO DO TOAST VEM DO SERVIDOR, não da régua local. `clausula` é
      // a resposta de `contratarPlano`, e é o servidor que decidiu o degrau
      // pelo relógio DELE. Recalcular aqui pelo relógio do aparelho poderia
      // anunciar 30% e gravar 10%.
      if (clausula.fechamento) {
        toast.success(
          `Plano contratado com ${Math.round((clausula.fracao || 0) * 100)}% de desconto travado — ele não expira.`,
          { duration: 7000 }
        );
      } else {
        toast.success('Plano contratado. Falta só aceitar o contrato.');
      }
      setPedindoDocumento(false);
      // VEIO DE UMA FAMÍLIA PARA RECEBER (F2.4): o pedido segue para o
      // CONTRATO, não direto para a Comunidade — assinatura fechada é plano
      // + contrato aceito (decisão do dono). É o aceite lá que devolve.
      const pedido = lerVolta(location.state);
      navigate('/tio/contrato-plataforma', pedido ? { state: { voltarAoPedido: pedido } } : undefined);
    } catch (err) {
      // No passo do documento, o erro fica embaixo do campo (inclusive o de
      // "já ligado a outra conta", que não diz de quem é).
      if (documentoNovo) setErroDoDocumento(err?.message || 'Não deu pra assinar agora.');
      else toast.error(err?.message || 'Não deu pra contratar agora.');
    } finally {
      setAssinando(false);
    }
  };

  // ── O AUTOATENDIMENTO (04/10/2026, desenho aprovado pelo dono) ─────────
  //
  // "Meus planos" tem os MESMOS blocos em toda fase da relação, na mesma
  // ordem: fala, sua conta, seus descontos, o plano e o botão verde, os
  // serviços, as dúvidas e o time de vendas. Muda a fala (e o tom), os números
  // e o nome do botão. Quem decide a fase e guarda os textos curtos é
  // `autoatendimento.js` (`npm run testar:autoatendimento`); quem cobra continua
  // sendo `precoDoMes`, e todo número desta tela sai dele.
  //
  // ⚠️ O PREÇO DE CADA CRIANÇA É O NÚMERO GRANDE: é o que o motorista mais
  // olha. O total do mês vem embaixo, como consequência.
  const { children } = useChildren();
  const { fatura } = useFaturaPlataforma(user?.uid);
  const indicacaoAtiva = useModuloDeCobranca(MODULO.INDICACAO);
  const agora = new Date();
  const conta = estadoDaConta({
    suspenso: profile?.suspenso === true,
    trialInicio: profile?.trialInicio || null,
    assinaturaAte: profile?.assinaturaAte || null,
    fatura,
    agora,
  });
  const atrasoDias = diasDeAtraso(fatura, agora);
  const fase = faseDoAutoatendimento({
    conta,
    atrasoDias,
    jaContratou,
    renovacaoAutomatica: profile?.renovacaoAutomatica,
    trialInicio: profile?.trialInicio,
    agora,
  });
  const receita = receitaDaTurma(children);
  const familias = children.filter((c) => c?.parentUid).length;

  const [contaCompleta, setContaCompleta] = useState(false);
  const [todasDuvidas, setTodasDuvidas] = useState(false);
  const [folha, setFolha] = useState(null);
  const [introVista, setIntroVista] = useState(() => lerIntroVista());

  // O preço de cada plano: o de TABELA (riscado quando há desconto) e o que
  // ele paga. `final` inclui o degrau que ele trava contratando hoje.
  //
  // ⚠️ `descontos` E `mes` SÃO OBRIGATÓRIOS AQUI, e já faltaram uma vez: são
  // eles que carregam o desconto de FECHAMENTO. A tela mostrava a tabela e a
  // fatura cobrava com desconto.
  const precoDe = (plano) => {
    const preco = precoDoMes({
      criancas: ativas,
      plano,
      fundador,
      indicacoesAtivas: indicacoes,
      descontos: profile?.descontos,
      mes: mesAtual,
    });
    const travando =
      plano === PLANO.MENSAL && !jaContratou && fracaoDoDegrau > 0
        ? precoDoMes({
            criancas: ativas,
            plano,
            fundador,
            indicacoesAtivas: indicacoes,
            descontos: [{ origem: 'fechamento', fracao: fracaoDoDegrau, ate: null }],
            mes: mesAtual,
          })
        : null;
    const valendo = travando || preco;
    return {
      bruto: preco.bruto,
      final: valendo.liquido,
      valendo,
      // O MÍNIMO aparece quando morde, e só quando morde: sem esta linha a
      // conta "5 × R$ 5,90" não fecha com o número grande ao lado.
      noMinimo: ativas * TAXA[plano] < MINIMO[plano],
    };
  };
  const precos = Object.fromEntries(PLANOS_DISPONIVEIS.map((p) => [p, precoDe(p)]));
  const doEscolhido = precos[escolhido];
  const porCrianca = (v) => (ativas > 0 && v != null ? v / ativas : null);
  const descontos = linhasDeDesconto(doEscolhido.valendo);
  const descontoEmReais = (doEscolhido.bruto || 0) - (doEscolhido.final || 0);
  const comparacao = comparacaoComOMercado({ criancas: ativas, liquido: doEscolhido.final });
  const peso = pesoNaReceita({ liquido: doEscolhido.final, receita });
  const pct = (f) => `${(f * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const nomeDoPlano = (p) => (p === PLANO.ANUAL ? 'anual' : 'mensal');
  const [anoRef, mesRef] = PRECO_DO_CONCORRENTE.referencia.split('-');
  const gratisHoje = fase === FASE.NAO_INICIADO || fase === FASE.TESTE || fase === FASE.TESTE_FIM;
  const noTeste = gratisHoje;
  const dataCurtaDe = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');

  const verPlanos = () => document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth' });
  const fecharIntro = () => {
    gravarIntroVista();
    setIntroVista(true);
  };

  // ⚠️ A PORTA APARECE UMA VEZ SÓ (por aparelho). Toda vez seria pedágio para
  // quem só quer ver a fatura.
  if (!introVista) return <PortaDoAutoatendimento onComecar={fecharIntro} />;

  // ── A FALA, uma por fase ─────────────────────────────────────────────────
  const tom = tomDaFala(fase);
  const fimDoTeste = fimDoTrial(profile?.trialInicio);
  const prazoDoAtraso =
    fatura?.vencimento && paraDataLocal(fatura.vencimento)
      ? new Date(paraDataLocal(fatura.vencimento).getTime() + TOLERANCIA_DE_ATRASO * 86400000)
      : null;
  const falas = {
    [FASE.NAO_INICIADO]: <p>Seu teste grátis ainda não começou.</p>,
    [FASE.TESTE]: (
      <>
        <p>
          Você está no <strong>teste grátis</strong>. Use à vontade.
        </p>
        {fracaoDoDegrau > 0 && <p>Quanto antes assinar, maior o seu desconto.</p>}
      </>
    ),
    [FASE.TESTE_FIM]: (
      <>
        <p>
          Você construiu muito aqui: <strong>{children.length} crianças</strong>
          {familias > 0 && (
            <>
              {' '}e <strong>{familias} {familias === 1 ? 'família' : 'famílias'}</strong> no app
            </>
          )}
          .
        </p>
        <p>
          Só falta uma coisa: garantir que tudo continue depois de{' '}
          <strong>{dataCurtaDe(fimDoTeste)}</strong>.
        </p>
        <VerHistoria onIr={() => navigate('/tio/historia')} />
      </>
    ),
    [FASE.PAUSADA]: (
      <>
        <p className="font-bold">Sua rota está parada. Parou:</p>
        <ul className="space-y-1 text-textMuted">
          {O_QUE_PARA.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Lock size={16} aria-hidden="true" /> {t}
            </li>
          ))}
        </ul>
        <p>As crianças, os contratos e o caixa continuam guardados.</p>
        <VerHistoria onIr={() => navigate('/tio/historia')} />
      </>
    ),
    [FASE.EM_DIA]: (
      <>
        <p>Obrigado por apoiar o app.</p>
        <p>
          Este mês: <strong>{Number(profile?.rotasNoMes) || 0} rotas</strong> e{' '}
          <strong>{children.length} crianças</strong> na turma.
        </p>
      </>
    ),
    [FASE.ATRASO]: (
      <>
        <p className="font-display text-xl font-bold">Fatura atrasada</p>
        <p>
          Ela venceu há {atrasoDias} {atrasoDias === 1 ? 'dia' : 'dias'}.
          {prazoDoAtraso && (
            <>
              {' '}Pague até <strong>{dataCurtaDe(prazoDoAtraso)}</strong> e nada para.
            </>
          )}
        </p>
      </>
    ),
    [FASE.SAIDA]: (
      <>
        <p>
          Seu plano termina em <strong>{dataCurtaDe(fimDoPeriodoPago(profile))}</strong>. Até lá,
          tudo funciona normal.
        </p>
        <p>Continuar não custa nada.</p>
        <VerHistoria onIr={() => navigate('/tio/historia')} />
      </>
    ),
  };
  const estiloDaFala = {
    normal: 'border-primaryBorder bg-primarySoft',
    aviso: 'border-warningBorder bg-warningSoft',
    parado: 'border-border bg-neutro',
  }[tom];
  const corDoRosto = { normal: 'bg-primary', aviso: 'bg-warningText', parado: 'bg-textMuted' }[tom];

  // ── O BOTÃO VERDE, um só ─────────────────────────────────────────────────
  const acao =
    fase === FASE.ATRASO
      ? { texto: 'Pagar a fatura', onClick: () => navigate('/tio/taxa') }
      : fase === FASE.SAIDA
        ? { texto: 'Continuar usando o app', onClick: () => navigate('/tio/encerrar'), contorno: true }
        : fase === FASE.EM_DIA
          ? escolhido !== profile?.plano
            ? { texto: `Trocar para o ${nomeDoPlano(escolhido)}`, onClick: contratar }
            : null
          : {
              texto:
                fase === FASE.PAUSADA
                  ? 'Escolher plano e voltar a rodar'
                  : jaContratou
                    ? `Trocar para o ${nomeDoPlano(escolhido)}`
                    : 'Assinar plano agora para apoiar o app',
              onClick: contratar,
            };

  const servicos = [
    { icone: FileText, texto: 'Minha fatura', ir: () => navigate('/tio/taxa') },
    { icone: QrCode, texto: 'Pagar com PIX', ir: () => navigate('/tio/taxa') },
    { icone: Repeat, texto: 'Trocar plano', ir: verPlanos },
    { icone: PenLine, texto: 'Contrato', ir: () => navigate('/tio/contrato-plataforma') },
    indicacaoAtiva && { icone: UserPlus, texto: 'Indicar colega', ir: () => navigate('/tio/indicar') },
    jaContratou && { icone: LogOut, texto: 'Encerrar plano', ir: () => navigate('/tio/encerrar') },
  ].filter(Boolean);

  const folhaAberta = folha ? EXPLICACOES[folha] : null;

  return (
    <div className="min-h-screen bg-bg">
      {/* O CABEÇALHO DE TODA TELA INTERNA, mesmo fora do `TioLayout`: o
        * `Header` consome a história quando ela existe e cai no destino
        * nomeado quando não existe. Sem sino e sem rosto: a escuta do sino
        * mora no `TioLayout`.
        *
        * ⚠️ O NOME É "MEUS PLANOS" (04/10/2026): virou o autoatendimento, e o
        * "Minha história" mora à direita do título. */}
      <Header
        title="Meus planos"
        showBack
        backLabel="Início"
        backTo="/tio"
        showGlobal={false}
        action={
          <button
            type="button"
            onClick={() => navigate('/tio/historia')}
            className="tap inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-primaryBorder bg-card px-3 text-sm font-bold text-primary"
          >
            <History size={18} aria-hidden="true" /> Minha história
          </button>
        }
      />

      <div className="mx-auto max-w-mobile space-y-4 px-4 pb-8 pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primaryChip px-3 py-1 text-sm font-bold uppercase tracking-wide text-accentText">
          <Smartphone size={15} aria-hidden="true" /> Autoatendimento
        </span>

        {/* 1 · A FALA */}
        <section className={`flex items-start gap-3 rounded-2xl border p-4 text-base text-text ${estiloDaFala}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${corDoRosto}`}>
            <MessageSquare size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1.5">{falas[fase]}</div>
        </section>

        {/* 2 · SUA CONTA — o essencial; "Abrir conta" abre o resto,
          * cada parte respondendo a uma pergunta que ele faz. */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-bold text-text">Sua conta</h2>
          {ativas > 0 ? (
            <>
              <p className="mt-1 text-base text-textMuted">
                <Ponto chave="porCrianca" onAbrir={setFolha}>Você paga, no plano {nomeDoPlano(escolhido)}</Ponto>
              </p>
              <div className="flex flex-wrap items-baseline gap-2">
                {doEscolhido.bruto > doEscolhido.final + 0.004 && (
                  <s className="text-lg text-textMuted">{formatCurrency(porCrianca(doEscolhido.bruto))}</s>
                )}
                <span className="font-display text-4xl font-bold text-accentText">
                  {formatCurrency(porCrianca(doEscolhido.final))}
                </span>
                <span className="text-base text-textMuted">por criança</span>
              </div>
              <p className="mt-1 text-base text-text">
                <Ponto chave="mes" onAbrir={setFolha}>
                  {ativas} {ativas === 1 ? 'criança' : 'crianças'} ={' '}
                  <strong>{formatCurrency(doEscolhido.final)} por mês</strong>
                </Ponto>
                {doEscolhido.noMinimo && (
                  <span className="block text-sm text-textMuted">
                    É o valor mínimo de {formatCurrency(MINIMO[escolhido])} por mês.
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="mt-1 text-base text-textMuted">Cadastre a sua turma para ver a sua conta.</p>
          )}
          {gratisHoje && (
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <Ponto chave="hoje" onAbrir={setFolha}>Hoje, no teste</Ponto>
              <strong className="text-base text-text">{formatCurrency(0)}</strong>
            </div>
          )}
          {!gratisHoje && fatura && (
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
              <span className="text-base text-text">Fatura de {formatMonthLabel(fatura.mes)}</span>
              <span className="text-right">
                <strong className={`block text-base ${fase === FASE.ATRASO ? 'text-dangerText' : 'text-text'}`}>
                  {formatCurrency(fatura.total)}
                </strong>
                {fatura.vencimento && (
                  <span className="text-sm text-textMuted">
                    vence {dataCurtaDe(paraDataLocal(fatura.vencimento))}
                  </span>
                )}
              </span>
            </div>
          )}

          {contaCompleta && ativas > 0 && (
            <>
              <Pergunta>Quanto custa cada plano, por criança?</Pergunta>
              {PLANOS_DISPONIVEIS.map((plano) => (
                <div key={plano} className="flex items-start justify-between gap-3 border-t border-border py-2.5">
                  <span>
                    <Ponto chave={plano === PLANO.ANUAL ? 'anual' : 'mensal'} onAbrir={setFolha}>
                      <strong>{plano === PLANO.ANUAL ? 'Anual' : 'Mensal'}</strong>
                    </Ponto>
                    <span className="block text-sm text-textMuted">
                      {plano === PLANO.ANUAL ? (
                        <>
                          12 meses · <Ponto chave="multa" onAbrir={setFolha}>tem multa</Ponto>
                        </>
                      ) : (
                        'cancela quando quiser · sem multa'
                      )}
                    </span>
                  </span>
                  <span className="text-right">
                    <strong className="block text-lg text-accentText">
                      {formatCurrency(porCrianca(precos[plano].final))}
                    </strong>
                    <span className="text-sm text-textMuted">
                      por criança · {formatCurrency(precos[plano].final)}/mês
                    </span>
                  </span>
                </div>
              ))}

              {comparacao && (
                <>
                  <Pergunta chave="concorrente" onAbrir={setFolha}>Estou pagando caro?</Pergunta>
                  <p className="text-base text-text">
                    Em outro app de van escolar com mais tempo de mercado, cada criança custa{' '}
                    <strong className="text-dangerText">
                      {formatCurrency(PRECO_DO_CONCORRENTE.porCrianca)}
                    </strong>
                    . Aqui,{' '}
                    <strong className="text-accentText">{formatCurrency(porCrianca(doEscolhido.final))}</strong>.
                  </p>
                  <p className="text-sm text-textMuted">
                    Para as suas {ativas} crianças:{' '}
                    <span className="text-dangerText">{formatCurrency(comparacao.mercado)}</span> lá,{' '}
                    <span className="text-accentText">{formatCurrency(doEscolhido.final)}</span> aqui, por mês.
                    E a multa do anual: {Math.round(PRECO_DO_CONCORRENTE.multaDoAnual * 100)}% lá,{' '}
                    {Math.round(FRACAO_DA_MULTA * 100)}% aqui. Preço público em {mesRef}/{anoRef}.
                  </p>
                </>
              )}

              {peso !== null && children.length > 0 && (
                <>
                  <Pergunta chave="bolso" onAbrir={setFolha}>Quanto isso pesa no meu bolso?</Pergunta>
                  <p className="text-base leading-relaxed text-text">
                    Cada família te paga em média{' '}
                    <strong>{formatCurrency(receita / children.length)}</strong> por mês. Dela,{' '}
                    <strong className="text-accentText">{formatCurrency(porCrianca(doEscolhido.final))}</strong>{' '}
                    vão para o app: <strong className="text-accentText">{pct(peso)}</strong>.
                  </p>
                </>
              )}
            </>
          )}
          {ativas > 0 && (
            <button
              type="button"
              onClick={() => setContaCompleta((v) => !v)}
              className="tap mt-3 flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border bg-card text-base font-bold text-primary"
            >
              {contaCompleta ? 'Ver menos' : 'Abrir conta'}
            </button>
          )}
        </section>

        {/* 3 · SEUS DESCONTOS, em cartão próprio: por que pago menos, e como
          * pago menos ainda. */}
        <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-bold text-text">Seus descontos</h2>
          {descontos.length > 0 && (
            <>
              <Pergunta>Por que eu pago menos?</Pergunta>
              <ul className="space-y-2">
                {descontos.map((d) => (
                  <li key={d.rotulo} className="flex items-center justify-between gap-3 text-base">
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primaryChip text-primary">
                        <Check size={16} aria-hidden="true" />
                      </span>
                      {d.rotulo === 'Fechamento no teste' ? (
                        <Ponto chave="fechamento" onAbrir={setFolha}>{d.rotulo}</Ponto>
                      ) : d.rotulo === 'Distribuição do app' ? (
                        <Ponto chave="indicacao" onAbrir={setFolha}>{d.rotulo}</Ponto>
                      ) : (
                        d.rotulo
                      )}
                    </span>
                    <strong className="text-accentText">− {pct(d.fracao)}</strong>
                  </li>
                ))}
              </ul>
              {ativas > 0 && descontoEmReais > 0.004 && (
                <div className="rounded-xl bg-primarySoft px-3 py-2 text-base">
                  <span className="flex items-baseline justify-between gap-2">
                    <span>Você paga por criança</span>
                    <span className="whitespace-nowrap">
                      <s className="mr-1.5 text-textMuted">{formatCurrency(porCrianca(doEscolhido.bruto))}</s>
                      <strong className="font-display text-xl text-accentText">
                        {formatCurrency(porCrianca(doEscolhido.final))}
                      </strong>
                    </span>
                  </span>
                </div>
              )}
              {doEscolhido.valendo.pisoAplicado && (
                <p className="text-sm text-textMuted">
                  A conta não fica abaixo de {formatCurrency(PISO_DA_FATURA)}.
                </p>
              )}
            </>
          )}

          <Pergunta>{descontos.length > 0 ? 'Como eu pago menos ainda?' : 'Como eu pago menos?'}</Pergunta>
          {escadaAtiva && !jaContratou && typeof degrauAtual === 'number' && (
            <>
              <div
                className="grid gap-2 text-center"
                style={{ gridTemplateColumns: `repeat(${ESCADA_DE_FECHAMENTO.length}, minmax(0, 1fr))` }}
              >
                {ESCADA_DE_FECHAMENTO.map((e) => (
                  <div
                    key={e.degrau}
                    className={`rounded-xl px-1 py-2.5 ${e.degrau === degrauAtual ? 'bg-primaryChip' : 'bg-neutro'}`}
                  >
                    <p className="font-display text-xl font-bold text-text">{pct(e.fracao)}</p>
                    <p className="text-sm text-textMuted">{e.degrau === degrauAtual ? 'agora' : 'depois'}</p>
                  </div>
                ))}
              </div>
              {/* ⚠️ A OFERTA VEM COM A DATA EM QUE MUDA — sem data não é
                * urgência, é pressão. E o preço nunca sobe se ele recusar
                * (docs/descontos.md, peça 3). Só no mensal. */}
              {escolhido === PLANO.MENSAL && fracaoDoDegrau > 0 && (
                <p className="text-base leading-relaxed text-text">
                  Assinando {viraEm ? <>até <strong>{dataCurta(viraEm)}</strong></> : 'agora'}, você garante{' '}
                  <strong className="text-accentText">{Math.round(fracaoDoDegrau * 100)}% para sempre</strong>.
                </p>
              )}
            </>
          )}
          {/* A INDICAÇÃO É O CONVITE DE SEMPRE, com o valor em reais da próxima
            * (`valorDaIndicacao`) — e ele some sozinho com o módulo desligado. */}
          <ConviteParaIndicar titulo="Desconto por distribuição do app" />
          {!indicacaoAtiva && !(escadaAtiva && !jaContratou) && (
            <p className="text-base text-textMuted">Por enquanto, não há outro desconto para você.</p>
          )}
        </section>

        {/* 4 · A TURMA COMPLETA, só no teste: cadastrar tudo enquanto é grátis. */}
        {noTeste && (
          <section className="space-y-2 rounded-2xl border border-primaryBorder bg-primarySoft p-4">
            <p className="font-display text-lg font-bold text-text">Sua turma está completa?</p>
            <p className="text-base text-text">Cadastre quem falta antes de fechar.</p>
            <p className="text-base text-textMuted">Dá para tirar depois.</p>
            <button
              type="button"
              onClick={() => navigate('/tio/children/new')}
              className="tap flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border bg-card text-base font-bold text-primary"
            >
              Cadastrar mais uma criança
            </button>
            <button
              type="button"
              onClick={verPlanos}
              className="tap flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-primary bg-card text-base font-bold text-primary"
            >
              Está completa
            </button>
          </section>
        )}

        {/* 5 · O PLANO E O BOTÃO VERDE. O mensal nasce escolhido (ver o
          * `useState`): pré-selecionar o compromisso seria escolher pela pessoa. */}
        <div id="planos" className="space-y-3" role="radiogroup" aria-label="Plano">
          {PLANOS_DISPONIVEIS.map((plano) => {
            const selecionado = escolhido === plano;
            const anual = plano === PLANO.ANUAL;
            return (
              <button
                key={plano}
                type="button"
                role="radio"
                aria-checked={selecionado}
                onClick={() => setEscolhido(plano)}
                className={`tap flex w-full items-center justify-between gap-3 rounded-xl border-2 p-4 text-left ${
                  selecionado ? 'border-primary bg-primarySoft' : 'border-border bg-card'
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      selecionado ? 'border-primary bg-primary text-white' : 'border-borderStrong bg-card'
                    }`}
                  >
                    {selecionado && <Check size={16} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-bold text-text">{anual ? 'Anual' : 'Mensal'}</span>
                    <span className="block text-sm text-textMuted">
                      {anual ? '12 meses · multa se sair antes' : 'sem prazo · sem multa'}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <strong className="block text-lg text-text">
                    {ativas > 0 ? formatCurrency(porCrianca(precos[plano].final)) : formatCurrency(TAXA[plano])}
                  </strong>
                  <span className="text-sm text-textMuted">por criança</span>
                </span>
              </button>
            );
          })}
        </div>
        {acao && (
          <div>
            {acao.contorno ? (
              <button
                type="button"
                onClick={acao.onClick}
                className="tap flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-primary bg-card text-base font-bold text-primary"
              >
                {acao.texto}
              </button>
            ) : (
              <Button onClick={acao.onClick} disabled={assinando || !escolhido}>
                {assinando ? 'Assinando…' : acao.texto}
              </Button>
            )}
            <p className="mt-1.5 text-center text-sm text-textMuted">
              Mensal sem multa · nada da sua turma é apagado
            </p>
          </div>
        )}

        {/* 6 · OS SERVIÇOS — sempre no mesmo lugar, como app de banco. */}
        <section>
          <p className="mb-2 text-sm font-bold uppercase tracking-wide text-textMuted">O que você pode fazer aqui</p>
          <div className="grid grid-cols-3 gap-2">
            {servicos.map(({ icone: Icone, texto, ir }) => (
              <button
                key={texto}
                type="button"
                onClick={ir}
                className="tap flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-1 py-3 text-center text-sm font-bold text-text"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primaryChip text-primary">
                  <Icone size={20} aria-hidden="true" />
                </span>
                {texto}
              </button>
            ))}
          </div>
        </section>

        {/* 7 · AS DÚVIDAS — três à vista, o resto em "Ver todas". */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-bold text-text">Dúvidas sobre o autoatendimento</h2>
          {(todasDuvidas ? DUVIDAS : DUVIDAS.slice(0, DUVIDAS_PRINCIPAIS)).map(([pergunta, resposta]) => (
            <details key={pergunta} className="group border-t border-border first-of-type:mt-2">
              <summary className="tap flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-base font-bold text-text">
                {pergunta}
                <Plus size={20} className="shrink-0 text-primary group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="pb-3 text-base leading-relaxed text-textMuted">{resposta}</p>
            </details>
          ))}
          <button
            type="button"
            onClick={() => setTodasDuvidas((v) => !v)}
            className="tap mt-2 flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border bg-card text-base font-bold text-primary"
          >
            {todasDuvidas ? 'Menos dúvidas' : 'Mais dúvidas'}
          </button>
        </section>

        {/* 8 · O TIME DE VENDAS, para quem prefere gente. */}
        <div className="text-center">
          <a
            href={salesWhatsAppLink('Olá! Tenho uma dúvida sobre os planos do Alô Buzinou.')}
            target="_blank"
            rel="noopener noreferrer"
            className="tap flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-base font-bold text-primary"
          >
            <MessageCircle size={20} aria-hidden="true" /> Consultar o time de vendas
          </a>
          <p className="mt-1.5 text-sm text-textMuted">
            Ainda com dúvida? O time de vendas da Alô Buzinou responde pelo WhatsApp.
          </p>
        </div>
      </div>

      {/* O PASSO DO CPF/CNPJ — um campo, uma frase, um botão verde. Sem
        * ditado por voz: documento não se dita (`testar:ditado`). */}
      <Sheet
        open={pedindoDocumento}
        onClose={() => !assinando && setPedindoDocumento(false)}
        title="Seu CPF ou CNPJ"
      >
        <p className="mb-3 text-base leading-relaxed text-text">
          O contrato precisa do seu CPF ou CNPJ.
        </p>
        <Input
          label="CPF ou CNPJ"
          icon={FileText}
          inputMode="numeric"
          autoComplete="off"
          semSalvar
          value={documento}
          onChange={(e) => {
            setDocumento(maskCpfCnpj(e.target.value));
            setErroDoDocumento('');
          }}
          error={erroDoDocumento}
        />
        <div className="mt-4">
          <Button onClick={assinarComDocumento} loading={assinando}>
            Assinar
          </Button>
        </div>
      </Sheet>

      {/* A FOLHA DE UM PONTO: título com a pergunta, uma frase de resposta. */}
      <Sheet open={Boolean(folhaAberta)} onClose={() => setFolha(null)} title={folhaAberta?.[0]}>
        <div className="space-y-2 text-lg leading-relaxed text-text">
          {folhaAberta?.[1].map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
        <div className="mt-4">
          <Button onClick={() => setFolha(null)}>Entendi</Button>
        </div>
      </Sheet>
    </div>
  );
}

// ── PEÇAS DA CONTA (fora do componente: criadas no render, elas
// reiniciariam a cada toque) ──────────────────────────────────────────────

/** Um ponto tocável da conta: abre uma folha que explica SÓ aquele ponto. */
function Ponto({ chave, onAbrir, children }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(chave)}
      className="tap inline text-left underline decoration-primaryBorder decoration-dotted underline-offset-4"
    >
      {children}
      <Info size={16} className="ml-1 inline align-[-2px] text-primary" aria-hidden="true" />
    </button>
  );
}

/** A pergunta que o motorista faz, como título de cada parte da conta. */
function Pergunta({ chave, onAbrir, children }) {
  return (
    <p className="mb-1 mt-4 text-base font-bold text-accentText">
      {chave ? (
        <Ponto chave={chave} onAbrir={onAbrir}>
          {children}
        </Ponto>
      ) : (
        children
      )}
    </p>
  );
}

function VerHistoria({ onIr }) {
  return (
    <button
      type="button"
      onClick={onIr}
      className="tap mt-1 inline-flex min-h-11 items-center gap-1 text-base font-bold text-primary"
    >
      Ver minha história <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}

// ── A PORTA: a primeira visita ao autoatendimento ──────────────────────────
//
// Uma vez só por aparelho (localStorage, com try/catch: em aba anônima a
// leitura pode falhar, e aí a porta aparece de novo — é o mal menor).
const CHAVE_DA_PORTA = 'alobuzinou:autoatendimento-visto';
function lerIntroVista() {
  try {
    return localStorage.getItem(CHAVE_DA_PORTA) === '1';
  } catch {
    return false;
  }
}
function gravarIntroVista() {
  try {
    localStorage.setItem(CHAVE_DA_PORTA, '1');
  } catch {
    /* sem armazenamento: a porta só volta a aparecer */
  }
}

/**
 * A foto dos blocos: uma miniatura NÃO clicável da tela que ele vai encontrar,
 * para reconhecê-la quando abrir. Desenho fixo, sem número dele — é só a forma.
 */
function PortaDoAutoatendimento({ onComecar }) {
  return (
    <div className="flex min-h-screen flex-col bg-primary px-5 pb-6 pt-10 text-white">
      <p className="text-sm font-bold uppercase tracking-wide text-menta">Seu autoatendimento</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight">
        Aqui você cuida do seu plano sozinho.
      </h1>
      <p className="mt-2 text-lg text-primaryChip">Tiramos esse peso do seu ombro.</p>
      <div
        aria-hidden="true"
        className="pointer-events-none mx-auto mt-6 w-full max-w-xs -rotate-2 space-y-2 rounded-2xl bg-bg p-3 text-text shadow-float"
      >
        <span className="inline-block rounded-full bg-primaryChip px-2 py-0.5 text-xs font-bold uppercase text-accentText">
          Autoatendimento
        </span>
        <p className="font-display text-xl font-bold">Meus planos</p>
        <div className="rounded-xl border border-primaryBorder bg-primarySoft p-2 text-sm">
          Você está no teste grátis. Use à vontade.
        </div>
        <div className="rounded-xl border border-border bg-card p-2">
          <p className="text-sm font-bold">Sua conta</p>
          <p className="font-display text-2xl font-bold text-accentText">R$ 5,90</p>
          <p className="text-xs text-textMuted">por criança</p>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {['Fatura', 'Plano', 'Contrato'].map((t) => (
            <div key={t} className="rounded-lg border border-border bg-card py-2 text-center text-xs font-bold">
              {t}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-center text-sm text-primaryChip">É assim que a sua tela vai aparecer.</p>
      <button
        type="button"
        onClick={onComecar}
        className="tap mt-auto flex min-h-14 w-full items-center justify-center rounded-xl bg-white text-lg font-bold text-primary"
      >
        Iniciar autoatendimento
      </button>
    </div>
  );
}
