import { useNavigate } from 'react-router-dom';
import {
  Users,
  School,
  ListOrdered,
  CalendarDays,
  Megaphone,
  Notebook,
  FileText,
  HelpCircle,
  ChevronRight,
  LayoutGrid,
} from 'lucide-react';
import AppSheet from '../common/AppSheet';

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
}) {
  const navigate = useNavigate();

  // Navegar FECHA a folha: sem isso ela continua montada por cima da tela
  // nova, e o "voltar" do Android fecharia a folha em vez de voltar de tela.
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
      subtitle="Tudo que você ajusta parado. Fecha no X, no toque fora ou arrastando pra baixo."
      size="tall"
    >
      <div className="space-y-4 pb-2">
        <Grupo titulo="quem anda na perua">
          <Linha
            icon={Users}
            titulo="Minha turma"
            contagem={criancas}
            onClick={() => ir('/tio/children')}
          />
          <Linha
            icon={School}
            titulo="Escolas"
            contagem={escolas}
            onClick={() => ir('/tio/children/escolas')}
          />
          {/* "Horários" não dizia que ali se edita a rota — o motorista pensa
            * "minha rota padrão". Mesmo nome que já está no Início hoje. */}
          <Linha
            icon={ListOrdered}
            titulo="Editar rota padrão"
            subtitulo="Os horários que você definiu — é o que cada família vê"
            aviso={semHorario > 0 ? `${semHorario} a confirmar` : null}
            onClick={() => ir('/tio/horarios')}
          />
        </Grupo>

        {/* A semana fica separada do cadastro porque ele consulta isso pra
          * PLANEJAR — domingo à noite, sábado de manhã — e não quando há
          * aviso novo. */}
        <Grupo titulo="a semana">
          <Linha
            icon={CalendarDays}
            titulo="Faltas da semana"
            subtitulo="Quem falta em qual dia, de segunda a sexta"
            onClick={() => ir('/tio/semana')}
          />
        </Grupo>

        {/* Do lado do motorista pareciam duas coisas diferentes; do lado do
          * pai chegam no mesmo lugar. O grupo diz isso. */}
        <Grupo titulo="avisos que vão pra agenda das famílias">
          <Linha
            icon={Megaphone}
            titulo="Avisar que não tem aula"
            subtitulo="Marca a falta e avisa quem você escolher"
            onClick={() => {
              onClose?.();
              onBroadcast?.();
            }}
          />
          <Linha
            icon={Notebook}
            titulo="Avisos enviados"
            subtitulo="O que já foi pro caderno de cada família"
            onClick={() => ir('/tio/agenda')}
          />
        </Grupo>

        <Grupo titulo="minha conta">
          <Linha
            icon={FileText}
            titulo="Contrato da plataforma"
            onClick={() => ir('/tio/contrato-plataforma')}
          />
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

function Grupo({ titulo, children }) {
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-1">
        {titulo}
      </p>
      {children}
    </section>
  );
}

/** Mesma linha do Início de hoje — o motorista não aprende peça nova. */
function Linha({ icon: Icon, titulo, subtitulo, contagem, aviso, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap w-full text-left bg-card border border-border rounded-xl px-3 py-3 flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-lg bg-neutro text-textMuted flex items-center justify-center shrink-0">
        <Icon size={16} />
      </div>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-text truncate">
          {titulo}
        </span>
        {subtitulo && (
          <span className="block text-[11px] text-textMuted truncate">
            {subtitulo}
          </span>
        )}
      </span>
      {aviso ? (
        <span className="text-[11px] font-semibold text-warningText shrink-0">
          {aviso}
        </span>
      ) : contagem != null ? (
        <span className="font-mono text-xs text-textMuted shrink-0">
          {contagem}
        </span>
      ) : null}
      <ChevronRight size={16} className="text-textMuted shrink-0" />
    </button>
  );
}
