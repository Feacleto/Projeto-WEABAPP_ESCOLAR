import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFotosDaTurma } from '../../hooks/useFotosDaTurma';
import { responderFotoDaTurma } from '../../services/comunidadeService';
import { quandoSome, simDaFoto } from '../../dominio/identidade/comunidade.js';

/**
 * A FOTO DA TURMA, DO LADO DA FAMÍLIA (05/10/2026).
 *
 * Duas peças:
 * - `PerguntaDaFoto`: "Pode aparecer em foto da turma?". É a autorização
 *   dela (LGPD art. 14), e só ela responde: as rules recusam o motorista.
 *   No Início aparece enquanto ela não respondeu; na ficha, sempre, com a
 *   resposta atual e o jeito de mudar.
 * - `FotosDaTurmaNoInicio`: as fotos que o motorista publicou para as
 *   famílias e ainda valem. Sem curtir, sem comentar: é para ver.
 */
export function PerguntaDaFoto({ child, naFicha = false }) {
  const [salvando, setSalvando] = useState(false);
  const estado = simDaFoto(child);
  if (!child?.id) return null;
  if (!naFicha && estado !== 'sem_resposta') return null;
  const nome = String(child.name || '').trim().split(/\s+/)[0] || 'seu filho';

  const responder = async (sim) => {
    setSalvando(true);
    try {
      await responderFotoDaTurma(child.id, sim);
      toast.success(sim ? `${nome} pode aparecer na foto da turma.` : `${nome} não aparece na foto da turma.`);
    } catch {
      toast.error('Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-base font-bold text-text">Pode aparecer em foto da turma?</p>
      <p className="mt-1 text-base text-textMuted">
        {estado === 'sim'
          ? `Sim: ${nome} pode aparecer na foto que a perua posta numa data especial, só para as famílias da turma. Ela some em 30 dias.`
          : estado === 'nao'
            ? `Não: ${nome} não aparece em foto da turma.`
            : `Numa data especial, a perua pode postar uma foto da turma para as famílias dela. Ela some em 30 dias. Você escolhe se ${nome} pode aparecer.`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={salvando}
          onClick={() => responder(false)}
          aria-pressed={estado === 'nao'}
          className={`min-h-12 rounded-xl border-2 text-base font-bold ${estado === 'nao' ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-surface text-text'}`}
        >
          Não
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={() => responder(true)}
          aria-pressed={estado === 'sim'}
          className={`min-h-12 rounded-xl border-2 text-base font-bold ${estado === 'sim' ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-surface text-text'}`}
        >
          Sim
        </button>
      </div>
    </div>
  );
}

export function FotosDaTurmaNoInicio({ child }) {
  const fotos = useFotosDaTurma(child?.adminUid);
  const [aberta, setAberta] = useState(null);

  return (
    <>
      <PerguntaDaFoto child={child} />
      {fotos.length > 0 && (
        <section className="space-y-2">
          <p className="inline-flex items-center gap-2 text-base font-bold text-text">
            <Camera size={20} className="text-primary" aria-hidden="true" />
            Fotos da turma
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {fotos.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAberta(f)}
                className="w-56 shrink-0 overflow-hidden rounded-2xl bg-card text-left"
              >
                <img src={f.url} alt={`Foto da turma: ${f.epoca}`} className="h-36 w-full object-cover" loading="lazy" />
                <span className="block px-3 pt-2 text-base font-bold text-text">{f.epoca}</span>
                <span className="block px-3 pb-2 text-sm text-textMuted">{quandoSome(f.expiraEm?.toMillis?.() || 0)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {aberta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto da turma: ${aberta.epoca}`}
          className="fixed inset-0 z-50 flex flex-col bg-black"
          onClick={() => setAberta(null)}
        >
          <button
            type="button"
            onClick={() => setAberta(null)}
            className="m-3 flex min-h-12 items-center gap-2 self-end rounded-xl bg-white px-4 text-base font-bold text-text"
          >
            <X size={20} aria-hidden="true" />
            Fechar
          </button>
          <img src={aberta.url} alt="" className="min-h-0 flex-1 object-contain" />
          <p className="p-4 text-center text-base font-bold text-white">
            {aberta.epoca}
            {aberta.legenda ? ` · ${aberta.legenda}` : ''}
          </p>
        </div>
      )}
    </>
  );
}
