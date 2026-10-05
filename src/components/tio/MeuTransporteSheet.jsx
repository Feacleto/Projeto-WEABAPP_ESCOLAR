import { Share2, Sticker } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  FileText,
  HelpCircle,
  LayoutGrid,
  ListOrdered,
  Megaphone,
  Notebook,
  Receipt,
  School,
  TriangleAlert,
  Users,
} from 'lucide-react';
import AppSheet from '../common/AppSheet';
import { useAuth } from '../../hooks/useAuth';
import { dadosDaContratadaFaltando } from '../../services/contractService';
import { DESCONTO_POR_INDICACAO } from '../../dominio/associacao/planos.js';
import { useCobrancaLigada, useModuloDeCobranca } from '../../hooks/useCobrancaLigada';

/**
 * O ÍNDICE DO APP — "Meu transporte".
 *
 * POR QUE ELE EXISTE
 * As seis linhas de cadastro e aviso moravam no pé do Início. O motorista
 * passava por elas duas vezes por dia e usava três vezes por mês: elas
 * cobravam rolagem no momento em que ele está com o pé no freio. Pior, o
 * estado "dirigindo" apagava o bloco inteiro — então o cadastro ficava
 * inacessível exatamente no meio-dia, que é a única janela do dia em que
 * ele está PARADO no portão da escola com seis minutos livres. Pra avisar
 * uma escola ele encerrava a rota, apagava a perua do mapa das famílias e
 * ligava de novo.
 *
 * POR QUE FOLHA E NÃO TELA
 * Índice é o lugar mais visitado e menos habitado do app: ele entra pra
 * sair. Tela cobra ida e volta, tira o Início da vista e coloca um "voltar"
 * no caminho. A folha fecha no X, no toque fora e arrastando pra baixo, e
 * devolve ele onde estava. Uma tela que só encaminha não paga pedágio.
 *
 * O QUE NÃO ENTROU AQUI
 * A chave PIX. Ela já é uma folha dentro do Financeiro (PixSheet), na tela
 * onde a pergunta nasce — trazer uma segunda porta pra ela criaria duas
 * superfícies pro mesmo assunto, que é o erro que o Financeiro já corrigiu.
 *
 * AS CONTAGENS VÊM POR PROP, e não de `useChildren`/`useEscolas` aqui dentro.
 * Quem monta esta folha é o `TioDashboard`, que já assina as duas coleções pra
 * montar a rota do dia. Reassinar aqui abriria duas assinaturas permanentes do
 * Firestore pro mesmo dado — permanentes porque o hook roda mesmo com a folha
 * FECHADA — e criaria duas fontes que podem discordar por um instante. O
 * número que a linha mostra tem que ser o mesmo que a tela atrás dela mostra.
 *
 * Props:
 *   - open, onClose
 *   - criancas, escolas, semHorario: contagens, vindas de quem monta
 *   - onBroadcast: abre o SchoolBroadcastSheet. Fecha esta folha primeiro —
 *     duas folhas empilhadas deixam a de baixo escondida atrás da tampa da
 *     de cima, e o X da segunda devolve pra uma tela que a pessoa não vê.
 *   - onTutorial: o "Como usar o app" do TioLayout (openTutorial do Outlet).
 */
export default function MeuTransporteSheet({
  open,
  onClose,
  onBroadcast,
  onTutorial,
  criancas = 0,
  escolas = 0,
  semHorario = 0,
  // A rota está rodando? Decide para onde vai o "Problema na perua".
  rotaRodando = false,
}) {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // ⚠️ O QUE FALTA PARA EMITIR CONTRATO, DITO ANTES DE A FAMÍLIA ESPERAR.
  //
  // `buildContractData` devolve `null` sem nome, CPF/CNPJ e cidade da parte
  // contratada — e o motorista só descobria isso ao abrir o contrato de uma
  // criança, com a família do outro lado. A tela de lá trata bem (nomeia o que
  // falta e leva ao perfil), mas o MOMENTO é o pior possível.
  //
  // Aqui ele descobre num momento calmo, no índice que ele já abre para ver
  // turma, escolas e semana. É aviso, não formulário: pedir os três campos no
  // cadastro custaria desistência na porta do funil, e ele não precisa de
  // contrato no primeiro dia.
  const faltaContratada = dadosDaContratadaFaltando(profile);

  // Navegar FECHA a folha: sem isso ela continua montada por cima da tela
  // nova, e o "voltar" do Android fecharia a folha em vez de voltar de tela.
  const cobranca = useCobrancaLigada();
  const indicacao = useModuloDeCobranca('indicacao');
  const ir = (rota) => {
    onClose?.();
    navigate(rota);
  };

  return (
    <AppSheet
      open={open}
      onClose={onClose}
      icon={LayoutGrid}
      title="Meu transporte"
      size="tall"
    >
      {/* ⚠️ O MODELO F (04/10/2026, escolhido pelo dono entre seis). O
        * motorista de 40+ abre a folha com pressa e quer ver o que mais chama
        * atenção — então ela tem TRÊS ANDARES de peso diferente:
        *   1. AVISAR AS FAMÍLIAS AGORA, em dois botões grandes: é o que ele
        *      procura com a perua parada na rua (ver o comentário longo do
        *      "Problema na perua" abaixo, que continua valendo);
        *   2. SUA OPERAÇÃO em quatro quadrados com o número grande — o estado
        *      da turma se lê sem abrir nada;
        *   3. o resto (avisos enviados e a conta dele) em linhas simples no pé.
        * Os três blocos da auditoria de UX de 03/10 continuam: só mudou o peso
        * de cada um na tela. */}
      <div className="space-y-6 pb-2">
        <Grupo titulo="Avisar as famílias agora">
          <div className="grid grid-cols-2 gap-2.5">
            {/* ⚠️ O URGENTE VEM PRIMEIRO, E FOI PARA CÁ EM 10/09/2026.
              *
              * Ele só existia atrás do botão flutuante de `/tio/turma` e
              * `/tio/agenda` — e chegar lá custava seis ações, para o único
              * aviso que ele dispara com a perua parada na rua. Esta folha
              * existe em TODOS os estados do painel, inclusive dirigindo.
              *
              * ⚠️ UM NOME SÓ (04/10/2026): era "Perua quebrou" aqui e
              * "Problema na perua" na rota, para a mesma coisa. Com a rota
              * rodando, leva ao aviso DA ROTA — que também troca o mapa da
              * família pelo aviso (`marcarOcorrencia`). Sem rota, o caderno.
              *
              * Cara de ALERTA (tokens `danger*`): é o botão que ele procura
              * com pressa, e não pode ter o peso de "Avisos enviados". */}
            <BotaoDeAviso
              icon={TriangleAlert}
              tom="alerta"
              titulo="Problema na perua"
              onClick={() => {
                onClose?.();
                if (rotaRodando) {
                  navigate('/tio/route/now', { state: { atalho: 'problema' } });
                } else {
                  navigate('/tio/agenda', { state: { atalho: 'quebrou' } });
                }
              }}
            />
            <BotaoDeAviso
              icon={Megaphone}
              titulo="Não tem aula"
              onClick={() => {
                onClose?.();
                onBroadcast?.();
              }}
            />
          </div>
        </Grupo>

        <Grupo titulo="Sua operação">
          <div className="grid grid-cols-2 gap-2.5">
            <Quadro
              icon={Users}
              titulo="Minha turma"
              numero={criancas}
              detalhe={criancas === 1 ? 'criança' : 'crianças'}
              onClick={() => ir('/tio/children')}
            />
            {/* A semana ele consulta pra PLANEJAR — domingo à noite, sábado
              * de manhã —, e é parte da operação, não um aviso. */}
            <Quadro
              icon={CalendarDays}
              titulo="Faltas da semana"
              detalhe="Quem falta em cada dia"
              onClick={() => ir('/tio/semana')}
            />
            {/* "HORÁRIOS DA ROTA" EM TODO LUGAR (03/10/2026). A mesma tela se
              * chamava "Definir os horários" no Início, "Editar rota padrão"
              * aqui e "N crianças sem horário" na lista de pendências — três
              * nomes para uma porta faziam parecer três telas. */}
            <Quadro
              icon={ListOrdered}
              tour="rota-padrao"
              titulo="Horários da rota"
              detalhe={semHorario > 0 ? `${semHorario} sem horário` : 'O que cada família vê'}
              alerta={semHorario > 0}
              onClick={() => ir('/tio/horarios')}
            />
            <Quadro
              icon={School}
              titulo="Escolas"
              numero={escolas}
              detalhe={escolas === 1 ? 'escola' : 'escolas'}
              onClick={() => ir('/tio/children/escolas')}
            />
          </div>
        </Grupo>

        {/* Do lado do motorista pareciam coisas diferentes; do lado do pai
          * chegam no mesmo lugar — o caderno da família. */}
        <Grupo titulo="Mais">
          <Linha
            icon={Notebook}
            titulo="Avisos enviados"
            onClick={() => ir('/tio/agenda')}
          />
          {/* O PREÇO MORA AQUI, E É DE PROPÓSITO QUE ELE SEJA DISCRETO.
            *
            * Durante os três meses de teste o app fica calado sobre dinheiro —
            * quem está provando não deveria estar decidindo compra. Mas calado
            * não é escondido: quem for procurar precisa achar.
            *
            * COM A COBRANÇA DESLIGADA (02/10/2026) preço, contrato da
            * plataforma e indicação somem: não há o que contratar nem
            * descontar. Ver `dominio/associacao/cobrancaLigada.js`. */}
          {cobranca && (
            <>
              <Linha
                icon={Receipt}
                titulo="Meus planos"
                onClick={() => ir('/tio/planos')}
              />
              <Linha
                icon={FileText}
                titulo="Contrato de assinatura"
                onClick={() => ir('/tio/contrato-plataforma')}
              />
            </>
          )}
          {faltaContratada.length > 0 && (
            <Linha
              icon={FileText}
              titulo="Complete seus dados de contrato"
              subtitulo={`Sem ${faltaContratada.join(', ')}, você não emite contrato para as famílias`}
              onClick={() => ir('/tio/profile')}
              aviso="falta"
            />
          )}
          {/* O SELO é assunto da PLATAFORMA com o motorista, não da operação
            * dele com as famílias — e é uma linha só para os dois selos. */}
          <Linha
            icon={Sticker}
            titulo="Seu selo na van"
            subtitulo="Adesivo e certificado de alvará"
            onClick={() => ir('/tio/selo')}
          />
          {indicacao && (
            <Linha
              icon={Share2}
              titulo="Indicar outro motorista"
              /* ⚠️ NÃO ESCREVA A PORCENTAGEM À MÃO AQUI. Esta linha dizia
                * "10%" depois de a régua ter ido para 5% — o motorista lia o
                * DOBRO do que a fatura ia descontar. O número sai da régua. */
              subtitulo={`Cada indicação que paga vale ${Math.round(DESCONTO_POR_INDICACAO * 100)}% na sua conta`}
              onClick={() => ir('/tio/indicar')}
            />
          )}
          <Linha
            icon={HelpCircle}
            titulo="Como usar o app"
            onClick={() => {
              onClose?.();
              onTutorial?.();
            }}
          />
        </Grupo>
      </div>
    </AppSheet>
  );
}

/**
 * Os avisos às famílias, em botão grande (modelo F): 80 px, ícone em cima e
 * nome embaixo. `tom="alerta"` é o "Problema na perua": cheio, nos tokens de
 * alerta, para ser achado com pressa. O outro é de contorno verde.
 */
function BotaoDeAviso({ icon: Icon, titulo, onClick, tom }) {
  const alerta = tom === 'alerta';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-base font-bold ${
        alerta ? 'bg-dangerText text-white' : 'border-2 border-primary bg-card text-primary'
      }`}
    >
      <Icon size={24} aria-hidden="true" />
      {titulo}
    </button>
  );
}

/**
 * Um quadrado da operação (modelo F): o número grande no canto diz o estado
 * sem abrir nada; o detalhe embaixo do nome diz o que o número é. `alerta`
 * pinta o detalhe de âmbar — algo pede atenção ali.
 */
function Quadro({ icon: Icon, titulo, numero, detalhe, alerta = false, onClick, tour }) {
  return (
    <button
      type="button"
      data-tour={tour}
      onClick={onClick}
      className="tap flex min-h-[104px] flex-col justify-between rounded-2xl border border-border bg-card p-3.5 text-left"
    >
      <span className="flex w-full items-center justify-between">
        <Icon size={26} className="text-primary" aria-hidden="true" />
        {numero != null && (
          <span className="font-display text-2xl font-extrabold tabular-nums text-text">{numero}</span>
        )}
      </span>
      <span className="mt-2 block">
        <span className="block text-base font-bold leading-snug text-text">{titulo}</span>
        {detalhe && (
          <span
            className={`block text-sm leading-snug ${alerta ? 'font-semibold text-warningText' : 'text-textMuted'}`}
          >
            {detalhe}
          </span>
        )}
      </span>
    </button>
  );
}

/** Um bloco da folha: título de 16 px, que é como ele acha o bloco. */
function Grupo({ titulo, children }) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 font-display text-base font-bold text-text">{titulo}</h3>
      {children}
    </section>
  );
}

/**
 * Mesma linha do Início — o motorista não aprende peça nova. 56 px, título
 * de 16 e subtítulo de 14 (eram 14 e 12: a folha é lida em pé, no portão).
 *
 * `tom="alerta"`: a linha que se procura com pressa (perua quebrou). Só cor
 * por token — o mesmo vermelho do "Faltou" na rota.
 */
function Linha({ icon: Icon, titulo, subtitulo, contagem, aviso, onClick, tour, tom }) {
  const alerta = tom === 'alerta';
  return (
    <button
      type="button"
      data-tour={tour}
      onClick={onClick}
      className={`tap flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${
        alerta ? 'border-dangerBorder bg-dangerSoft' : 'border-border bg-card'
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          alerta ? 'bg-dangerChip text-dangerText' : 'bg-neutro text-textMuted'
        }`}
      >
        <Icon size={20} />
      </div>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-base font-semibold leading-snug ${
            alerta ? 'text-dangerText' : 'text-text'
          }`}
        >
          {titulo}
        </span>
        {subtitulo && (
          <span className="block text-sm leading-snug text-textMuted">{subtitulo}</span>
        )}
      </span>
      {aviso ? (
        <span className="shrink-0 text-sm font-semibold text-warningText">{aviso}</span>
      ) : contagem != null ? (
        <span className="shrink-0 font-mono text-base text-textMuted">{contagem}</span>
      ) : null}
      <ChevronRight size={18} className="shrink-0 text-textMuted" />
    </button>
  );
}
