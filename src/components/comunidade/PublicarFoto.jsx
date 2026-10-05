import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { publicarFotoDaTurma } from '../../services/comunidadeService';
import {
  EPOCAS,
  LEGENDA_MAX,
  PUBLICO,
  prontaParaPublicar,
  simDaFoto,
} from '../../dominio/identidade/comunidade.js';

/**
 * PUBLICAR A FOTO DA TURMA (05/10/2026) — para as famílias ou para os tios
 * parceiros. Quem posta costuma ser a AUXILIAR, então nada aqui pede a senha
 * do Financeiro.
 *
 * ⚠️ PARA AS FAMÍLIAS, ELE MARCA QUEM ESTÁ NA FOTO. Criança sem o "sim" da
 * família aparece apagada, com o motivo, e não pode ser marcada: a saída é
 * tirar outra foto sem ela. O servidor confere de novo, criança por criança.
 *
 * ⚠️ PARA OS PARCEIROS, NENHUMA CRIANÇA: a lista some e fica só a
 * declaração "nesta foto não aparece nenhuma criança".
 *
 * F1.5: a AUXILIAR usa o mesmo formulário pela conta dela. `uid` é a pasta
 * de quem sobe (a dela) e `tioUid` é o tio em nome de quem a foto sai; ela
 * só posta para as famílias, e a `turma` é a CÓPIA dela (que traz o "sim").
 */
export default function PublicarFoto({ uid, tioUid = null, publico, turma = [], onPronto }) {
  const [arquivo, setArquivo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [epoca, setEpoca] = useState('');
  const [legenda, setLegenda] = useState('');
  const [marcadas, setMarcadas] = useState([]);
  const [todasMarcadas, setTodasMarcadas] = useState(false);
  const [semCrianca, setSemCrianca] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const paraFamilias = publico === PUBLICO.FAMILIAS;

  // A prévia nasce no toque (não num efeito) e a anterior é liberada.
  const previaAtual = useRef(null);
  const escolher = (novo) => {
    if (previaAtual.current) URL.revokeObjectURL(previaAtual.current);
    previaAtual.current = novo ? URL.createObjectURL(novo) : null;
    setArquivo(novo);
    setPrevia(previaAtual.current);
  };
  useEffect(() => () => {
    if (previaAtual.current) URL.revokeObjectURL(previaAtual.current);
  }, []);

  const ordenada = useMemo(
    () => [...turma].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [turma]
  );
  const comSim = ordenada.filter((c) => simDaFoto(c) === 'sim').length;
  const pronta = prontaParaPublicar({ publico, marcadas, turma, epoca, todasMarcadas, semCrianca, temFoto: !!arquivo });

  const alternar = (id) =>
    setMarcadas((lista) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]));

  const publicar = async () => {
    setEnviando(true);
    try {
      await publicarFotoDaTurma(uid, arquivo, { publico, criancas: marcadas, epoca, legenda: legenda.trim(), todasMarcadas, semCrianca, tioUid });
      toast.success(paraFamilias ? 'Foto publicada para as famílias.' : 'Foto publicada para os tios parceiros.');
      onPronto?.();
    } catch (err) {
      toast.error(err.message || 'Não deu para publicar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <label className="block cursor-pointer">
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => escolher(e.target.files?.[0] || null)}
        />
        {previa ? (
          <img src={previa} alt="A foto escolhida" className="h-48 w-full rounded-xl object-cover" />
        ) : (
          <span className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-base font-bold text-primary">
            <Camera size={28} aria-hidden="true" />
            Escolher a foto
          </span>
        )}
      </label>

      <div>
        <p className="mb-2 text-base font-semibold text-text">Qual é a época?</p>
        <div className="flex flex-wrap gap-2">
          {EPOCAS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEpoca(e)}
              aria-pressed={epoca === e}
              className={`min-h-12 rounded-full border-2 px-4 text-base font-bold ${
                epoca === e ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-surface text-text'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-base font-semibold text-text">Legenda (opcional)</span>
        <input
          value={legenda}
          maxLength={LEGENDA_MAX}
          onChange={(e) => setLegenda(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-surface px-3 text-base text-text"
        />
      </label>

      {paraFamilias ? (
        <div>
          <p className="text-base font-semibold text-text">Quem está na foto?</p>
          <p className="mb-2 text-sm text-textMuted">
            {comSim} de {ordenada.length} famílias deram o sim para foto. Quem não deu não pode aparecer.
          </p>
          <div className="space-y-2">
            {ordenada.map((c) => {
              const sim = simDaFoto(c) === 'sim';
              const marcada = marcadas.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!sim}
                  onClick={() => alternar(c.id)}
                  aria-pressed={marcada}
                  className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border-2 px-3 text-left text-base ${
                    marcada ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-surface text-text'
                  } disabled:opacity-60`}
                >
                  <span className="font-bold">{c.name}</span>
                  <span className="text-sm font-semibold">
                    {sim ? (marcada ? 'Na foto' : 'Marcar') : 'Sem o sim da família'}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="mt-3 flex min-h-12 items-center gap-3 text-base text-text">
            <input
              type="checkbox"
              checked={todasMarcadas}
              onChange={(e) => setTodasMarcadas(e.target.checked)}
              className="h-6 w-6 accent-primary"
            />
            Marquei todas as crianças que aparecem na foto.
          </label>
        </div>
      ) : (
        <label className="flex min-h-12 items-center gap-3 text-base text-text">
          <input
            type="checkbox"
            checked={semCrianca}
            onChange={(e) => setSemCrianca(e.target.checked)}
            className="h-6 w-6 accent-primary"
          />
          Nesta foto não aparece nenhuma criança.
        </label>
      )}

      {!pronta.ok && <p className="text-sm text-textMuted">{pronta.motivo}</p>}
      <Button onClick={publicar} disabled={!pronta.ok || enviando}>
        <Check size={18} aria-hidden="true" />
        {enviando ? 'Publicando…' : paraFamilias ? (tioUid ? 'Publicar para as famílias' : 'Publicar para as minhas famílias') : 'Publicar para os tios parceiros'}
      </Button>
    </div>
  );
}
