import { useMemo, useState } from 'react';
import { CalendarDays, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ABSENCE_LABELS, removeAbsence } from '../../services/absencesService';
import { getDateKey } from '../../dominio/rota/horarios';

/**
 * O QUE O RESPONSÁVEL JÁ AVISOU, E AINDA NÃO ACONTECEU.
 *
 * POR QUE ISTO É UMA PEÇA DE SEGURANÇA, E NÃO UMA LISTA
 * Avisar com antecedência abre um buraco: o pai marca que dia 28 a criança não
 * vai, o plano muda, e ele não lembra de desmarcar — porque nunca mais
 * reencontra aquele aviso. No dia 28 o motorista confia na informação, não
 * passa na porta, e a criança fica esperando. É falha de comunicação com uma
 * criança na calçada, que é o pior resultado que este app pode produzir.
 *
 * Limitar o quanto ele pode avisar à frente ajuda, mas não resolve: dá pra
 * esquecer um aviso de três dias atrás do mesmo jeito. O que resolve é o aviso
 * VOLTAR A APARECER — toda vez que ele abre o app, o que ele prometeu está na
 * tela, com um X do lado.
 *
 * E NA VÉSPERA A GENTE PERGUNTA
 * Quando o aviso é pra amanhã, ele deixa de ser um item de lista e vira uma
 * pergunta: "continua?". É o último momento em que desfazer ainda custa nada —
 * depois disso a perua já saiu com a rota montada sem a criança.
 */
export default function AvisosFuturos({ child, historico }) {
  const [removendo, setRemovendo] = useState(null);

  const hoje = getDateKey();
  const amanha = getDateKey(
    new Date(new Date().setDate(new Date().getDate() + 1))
  );

  const futuros = useMemo(
    () =>
      (historico || [])
        .filter((a) => a.dateKey > hoje)
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    [historico, hoje]
  );

  if (!child || futuros.length === 0) return null;

  async function desfazer(a) {
    setRemovendo(a.dateKey);
    try {
      await removeAbsence({ dateKey: a.dateKey, childId: child.id });
      toast.success(`Desmarcado. ${nomeCurto(child)} vai normal em ${curta(a.dateKey)}.`);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra desmarcar. Tente de novo.');
    } finally {
      setRemovendo(null);
    }
  }

  const vespera = futuros.find((a) => a.dateKey === amanha);
  const resto = futuros.filter((a) => a.dateKey !== amanha);

  return (
    <section className="space-y-2">
      {/* A pergunta da véspera */}
      {vespera && (
        <div className="rounded-2xl border-2 border-warningBorder bg-warningSoft p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-warningText shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-warningText leading-tight">
                Amanhã: {ABSENCE_LABELS[vespera.type]?.toLowerCase() || 'ausência'}
              </p>
              <p className="text-xs text-warningText/80 mt-0.5">
                Você avisou {haQuantoTempo(vespera.createdAt)}. Continua assim?
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              disabled={removendo === vespera.dateKey}
              onClick={() => desfazer(vespera)}
              className="tap h-10 rounded-xl bg-card border border-warningBorder text-warningText text-xs font-bold disabled:opacity-60"
            >
              Mudou, ela vai
            </button>
            <button
              type="button"
              onClick={() => toast.success('Combinado. O motorista já está avisado.')}
              className="tap h-10 rounded-xl bg-warning text-white text-xs font-bold"
            >
              Continua
            </button>
          </div>
        </div>
      )}

      {/* Os outros, como lista curta */}
      {resto.length > 0 && (
        <div className="bg-card rounded-2xl border border-border divide-y divide-neutro">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-3 pt-2.5 pb-1.5">
            você já avisou
          </p>
          {resto.map((a) => (
            <div key={a.dateKey} className="flex items-center gap-2.5 px-3 py-2.5">
              <CalendarDays size={15} className="text-textMuted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-text leading-tight">
                  {longa(a.dateKey)}
                </p>
                <p className="text-[11px] text-textMuted">
                  {ABSENCE_LABELS[a.type] || 'Ausência'}
                </p>
              </div>
              <button
                type="button"
                disabled={removendo === a.dateKey}
                onClick={() => desfazer(a)}
                aria-label={`Desmarcar ${longa(a.dateKey)}`}
                className="tap w-8 h-8 rounded-lg border border-border text-textMuted flex items-center justify-center shrink-0 disabled:opacity-60"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const nomeCurto = (c) => c?.name?.split(' ')[0] || 'seu filho';

function partes(chave) {
  const [y, m, d] = String(chave || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function curta(chave) {
  const d = partes(chave);
  if (!d) return chave;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

function longa(chave) {
  const d = partes(chave);
  if (!d) return chave;
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(d);
}

/**
 * "hoje", "há 3 dias", "há 2 semanas".
 *
 * A idade do aviso é o que diz se ele ainda é confiável. Um aviso de ontem
 * quase certamente vale; um de duas semanas atrás merece uma segunda olhada, e
 * é justamente esse que o responsável esqueceu que existe.
 */
function haQuantoTempo(ts) {
  const d = ts?.toDate?.() || (ts instanceof Date ? ts : null);
  if (!d) return 'antes';
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 14) return `há ${dias} dias`;
  const semanas = Math.floor(dias / 7);
  return semanas === 1 ? 'há 1 semana' : `há ${semanas} semanas`;
}
