import { useState } from 'react';
import { UserX, Sunrise, Sunset, Check, Pencil, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ABSENCE_TYPES,
  declareAbsence,
  removeAbsence,
  notifyAbsence,
} from '../../services/absencesService';
import { getDateKey, horaCurta, horariosCombinados } from '../../services/horariosService';

/**
 * O AVISO EM UM TOQUE — direto na home do responsável.
 *
 * POR QUE ELE SUBSTITUI O BOTÃO QUE ABRIA A FOLHA
 * Avisar falta custava dois toques e uma folha no meio: tocar em "vai faltar
 * hoje?", esperar a folha subir, escolher a opção. Não é muito — até você
 * lembrar de QUANDO a pessoa faz isso: de manhã, atrasada, com a criança
 * doente do lado. Nesse minuto, uma tela a mais é a diferença entre avisar e
 * mandar mensagem no WhatsApp — que é onde a rota deixa de enxergar.
 *
 * As três respostas possíveis já estão na tela, escritas. Um toque envia.
 *
 * E AMANHÃ, QUE ERA IMPOSSÍVEL
 * A folha aceitava qualquer data desde sempre, mas a home só passava hoje. O
 * pai que descobre na terça à noite que na quarta tem consulta não tinha o que
 * fazer a não ser lembrar de avisar na quarta de manhã — no minuto em que ele
 * está mais ocupado. Agora "amanhã" é um toque ao lado de "hoje".
 *
 * DESFAZER É O MESMO BOTÃO
 * Sem diálogo de confirmação: enviar é um toque, e o botão fica aceso. Tocar
 * de novo desfaz. Confirmação protegeria contra o toque errado, mas cobraria
 * um toque de todo mundo pra proteger de poucos — e o estrago aqui é
 * reversível em um segundo.
 */
export default function AvisoRapido({
  child,
  absenceHoje,
  absenceAmanha,
  onDetalhes,
  // A QUARTA RESPOSTA — quem vai buscar no lugar dela.
  //
  // "Não vai", "eu levo", "eu busco" e "a avó busca" são quatro respostas da
  // MESMA pergunta: quem encosta na criança hoje. Moravam em dois cartões de
  // cores diferentes, e ela descobria a quarta rolando. Juntas, ela lê as
  // quatro de uma vez.
  onOutraPessoa,
  altPickup = null,
}) {
  const [dia, setDia] = useState('hoje');
  const [enviando, setEnviando] = useState(null);

  if (!child) return null;

  const hoje = getDateKey();
  const amanha = getDateKey(
    new Date(new Date().setDate(new Date().getDate() + 1))
  );
  const dateKey = dia === 'hoje' ? hoje : amanha;
  const declarado = dia === 'hoje' ? absenceHoje : absenceAmanha;

  const { pega, entrega, presumido } = horariosCombinados(child);
  const nome = child.name?.split(' ')[0] || 'seu filho';

  async function alternar(tipo) {
    if (enviando) return;
    setEnviando(tipo);
    try {
      if (declarado?.type === tipo) {
        await removeAbsence({ dateKey, childId: child.id });
        toast.success('Aviso desfeito.');
      } else {
        await declareAbsence({
          dateKey,
          childId: child.id,
          childName: child.name,
          parentUid: child.parentUid || null,
          adminUid: child.adminUid || null,
          type: tipo,
          declaredBy: 'parent',
        });
        notifyAbsence({
          child: { name: child.name, parentUid: child.parentUid },
          type: tipo,
          dateKey,
          declaredBy: 'parent',
        });
        toast.success(confirmacao(tipo, dia, nome, pega, entrega, presumido));
      }
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra avisar. Tente de novo.');
    } finally {
      setEnviando(null);
    }
  }

  const OPCOES = [
    { tipo: ABSENCE_TYPES.FULL, icon: UserX, titulo: 'Não vai' },
    { tipo: ABSENCE_TYPES.NO_PICKUP, icon: Sunrise, titulo: 'Eu levo' },
    { tipo: ABSENCE_TYPES.NO_DROPOFF, icon: Sunset, titulo: 'Eu busco' },
  ];

  // A quarta NÃO é um ABSENCE_TYPE, e é a única que abre folha: precisa de
  // nome e telefone de terceiro. As outras três continuam sendo um toque.
  const outraAtiva = !!altPickup;

  return (
    <section className="bg-card rounded-3xl shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-bold text-text flex-1 min-w-0">
          Precisa avisar o motorista?
        </p>
        {/* A folha completa continua existindo pro que não cabe em três
          * botões: "já peguei na escola", trocar o dia, escrever um motivo. */}
        <button
          type="button"
          onClick={onDetalhes}
          className="tap text-[11px] font-semibold text-primary inline-flex items-center gap-1 shrink-0"
        >
          <Pencil size={12} />
          mais opções
        </button>
      </div>

      {/* Hoje / amanhã */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
        {[
          { v: 'hoje', label: 'Hoje' },
          { v: 'amanha', label: 'Amanhã' },
        ].map((d) => (
          <button
            key={d.v}
            type="button"
            onClick={() => setDia(d.v)}
            aria-pressed={dia === d.v}
            className={`tap py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              dia === d.v ? 'bg-card text-text shadow-sm' : 'text-textMuted'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {OPCOES.map((o) => {
          const ativo = declarado?.type === o.tipo;
          return (
            <button
              key={o.tipo}
              type="button"
              disabled={!!enviando}
              onClick={() => alternar(o.tipo)}
              aria-pressed={ativo}
              className={`tap rounded-2xl border-2 py-3 px-1 flex flex-col items-center gap-1.5 transition-colors disabled:opacity-60 ${
                ativo
                  ? 'border-primary bg-primary/10'
                  : 'border-gray-200 bg-card'
              }`}
            >
              <o.icon
                size={20}
                className={ativo ? 'text-primary' : 'text-textMuted'}
              />
              <span
                className={`text-xs font-bold ${
                  ativo ? 'text-primary' : 'text-text'
                }`}
              >
                {o.titulo}
              </span>
              {ativo && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary">
                  <Check size={10} /> avisado
                </span>
              )}
            </button>
          );
        })}

        {/* A QUARTA: "outra pessoa busca". Abre folha porque precisa de nome
          * e telefone de um terceiro — as outras três resolvem num toque.
          * Acesa, mostra o primeiro nome de quem vai buscar; é o que
          * substitui o cartão separado de "Hoje quem pega: Vovó Cida". */}
        {onOutraPessoa && (
          <button
            type="button"
            disabled={!!enviando}
            onClick={onOutraPessoa}
            aria-pressed={outraAtiva}
            className={`tap flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1 py-3 transition-colors disabled:opacity-60 ${
              outraAtiva ? 'border-primary bg-primary/10' : 'border-gray-200 bg-card'
            }`}
          >
            <UserCheck
              size={20}
              className={outraAtiva ? 'text-primary' : 'text-textMuted'}
            />
            <span
              className={`text-center text-xs font-bold leading-tight ${
                outraAtiva ? 'text-primary' : 'text-text'
              }`}
            >
              Outra pessoa
            </span>
            {outraAtiva && (
              <span className="max-w-full truncate text-[10px] font-semibold text-primary">
                {String(altPickup.name || '').split(' ')[0]}
              </span>
            )}
          </button>
        )}
      </div>

      <p className="text-[11px] text-textMuted leading-relaxed">
        {declarado
          ? 'Toque de novo no mesmo botão pra desfazer.'
          : 'Um toque avisa o motorista na hora.'}
      </p>
    </section>
  );
}

/**
 * A confirmação diz O QUE MUDOU, e não "salvo".
 *
 * "Aviso enviado" não responde a pergunta que o responsável tem depois de
 * tocar: preciso descer com ele às 6h20 ou não? Quando o horário está
 * combinado, a frase usa ele.
 */
function confirmacao(tipo, dia, nome, pega, entrega, presumido) {
  const quando = dia === 'hoje' ? 'hoje' : 'amanhã';
  if (tipo === ABSENCE_TYPES.FULL) {
    return `Avisado: ${nome} não vai ${quando}.`;
  }
  if (tipo === ABSENCE_TYPES.NO_PICKUP) {
    return presumido
      ? `Avisado: você leva ${quando}. O motorista traz de volta.`
      : `Avisado: você leva ${quando}. O motorista não passa às ${horaCurta(pega)}, mas traz de volta às ${horaCurta(entrega)}.`;
  }
  return presumido
    ? `Avisado: você busca ${quando}. O motorista só leva.`
    : `Avisado: você busca ${quando}. O motorista pega às ${horaCurta(pega)} e não traz de volta.`;
}
