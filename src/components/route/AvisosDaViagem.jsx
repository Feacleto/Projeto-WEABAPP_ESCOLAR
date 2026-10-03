import { useMemo, useState } from 'react';
import { Clock, FastForward, TriangleAlert, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import AppSheet from '../common/AppSheet';
import Button from '../common/Button';
import { createBroadcastEntry } from '../../services/agendaService';
import { marcarOcorrencia } from '../../services/locationService';
import { emMinutos, normalizaHora, horaCurta } from '../../dominio/rota/horarios';

/**
 * AVISAR AS FAMÍLIAS DESTA VIAGEM — com um toque, de dentro da rota
 * (03/10/2026).
 *
 * "Vou atrasar" existia, mas a quatro passos e FORA da tela da rota — e o
 * motorista atrasado está dirigindo. "Chego mais cedo" não existia: uma
 * criança falta, a perua adianta, e a família seguinte desce no horário de
 * sempre. "Problema com a perua" morava em "Meu transporte".
 *
 * ── QUEM RECEBE
 * Só as famílias desta viagem que AINDA ESPERAM a perua (quem falta embarcar
 * ou entregar). Quem já foi entregue, ou faltou, não precisa saber do atraso.
 *
 * ── DE ONDE SAEM OS MINUTOS
 * Da hora COMBINADA da criança em foco contra o relógio — a única fila que a
 * família também conhece. O GPS continua fazendo a parte dele: o "está
 * chegando" sai quando a perua chega perto, com ou sem este aviso. Previsão em
 * minutos a partir de trânsito o app não faz (decisão do dono, a reavaliar).
 */
const OPCOES = [5, 10, 15, 20, 30];

function sugestao(focoHora, agora = new Date()) {
  const hora = normalizaHora(focoHora);
  if (!hora) return null;
  const desvio = agora.getHours() * 60 + agora.getMinutes() - emMinutos(hora);
  return desvio;
}

function arredonda(min) {
  const abs = Math.min(30, Math.max(5, Math.round(Math.abs(min) / 5) * 5));
  return abs;
}

const TEXTO = {
  atraso: (m) =>
    `A perua está uns ${m} minutos atrasada hoje. Conte com uns ${m} minutos depois do horário combinado. Quando ela estiver chegando, o app avisa.`,
  cedo: (m) =>
    `Hoje a perua vai passar uns ${m} minutos antes do horário combinado. Se puder, deixe a criança pronta um pouco antes.`,
  quebrou: () =>
    'Tive um problema com a perua. Estou resolvendo e aviso assim que tiver notícia. Se puderem, se organizem para levar a criança hoje.',
};

const TITULO = {
  atraso: 'Vou atrasar',
  cedo: 'Chego mais cedo',
  quebrou: 'Problema com a perua',
};

export default function AvisosDaViagem({ adminUid, criancas = [], focoHora = null }) {
  const [tipo, setTipo] = useState(null);
  const [minutos, setMinutos] = useState(10);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  const familias = useMemo(
    () => new Set(criancas.map((c) => c?.parentUid).filter(Boolean)).size,
    [criancas]
  );
  if (!criancas.length) return null;

  const abrir = (t) => {
    const desvio = sugestao(focoHora);
    let m = 10;
    const plausivel = desvio != null && Math.abs(desvio) <= 90;
    if (t === 'atraso' && plausivel && desvio > 0) m = arredonda(desvio);
    if (t === 'cedo' && plausivel && desvio < 0) m = arredonda(desvio);
    setMinutos(m);
    setTexto(TEXTO[t](m));
    setTipo(t);
  };

  const trocaMinutos = (m) => {
    setMinutos(m);
    setTexto(TEXTO[tipo](m));
  };

  const enviar = async () => {
    setEnviando(true);
    try {
      const { alcance } = await createBroadcastEntry({
        adminUid,
        type: tipo,
        message: texto,
        children: criancas,
      });
      // PERUA QUEBRADA VIRA ESTADO DA ROTA, não só recado: a tela da família
      // troca o mapa por "o motorista avisou um problema" até ele marcar
      // "Resolvido" na barra da rota.
      if (tipo === 'quebrou') await marcarOcorrencia('perua_quebrou');
      toast.success(
        alcance
          ? `Aviso enviado para ${alcance} ${alcance === 1 ? 'família' : 'famílias'}.`
          : 'Aviso salvo no caderno. Nenhuma família desta viagem usa o app ainda.'
      );
      setTipo(null);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  const desvio = sugestao(focoHora);
  // Mais de hora e meia de diferença não é atraso de rota — é a rota iniciada
  // fora do horário (ou um teste de madrugada). A leitura cala.
  const leitura =
    desvio == null || !focoHora || Math.abs(desvio) > 90
      ? null
      : desvio > 2
        ? `Pelo combinado da parada em foco (${horaCurta(normalizaHora(focoHora))}), você está ${desvio} min atrasado.`
        : desvio < -2
          ? `Pelo combinado da parada em foco (${horaCurta(normalizaHora(focoHora))}), você está ${-desvio} min adiantado.`
          : `Você está no horário combinado da parada em foco.`;

  return (
    <>
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-textMuted">
          avisar as famílias desta viagem
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => abrir('atraso')}
            className="tap flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card px-1 text-xs font-semibold text-text"
          >
            <Clock size={18} className="text-primary" />
            Vou atrasar
          </button>
          <button
            type="button"
            onClick={() => abrir('cedo')}
            className="tap flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card px-1 text-xs font-semibold text-text"
          >
            <FastForward size={18} className="text-primary" />
            Chego mais cedo
          </button>
          <button
            type="button"
            onClick={() => abrir('quebrou')}
            className="tap flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card px-1 text-xs font-semibold text-text"
          >
            <TriangleAlert size={18} className="text-dangerText" />
            Problema na perua
          </button>
        </div>
      </section>

      <AppSheet
        open={!!tipo}
        onClose={enviando ? () => {} : () => setTipo(null)}
        title={tipo ? TITULO[tipo] : ''}
        icon={tipo === 'quebrou' ? TriangleAlert : Clock}
      >
        {tipo && (
          <div className="space-y-4 px-5 pb-6">
            {tipo !== 'quebrou' && (
              <>
                {leitura && <p className="text-sm text-textMuted">{leitura}</p>}
                <div>
                  <p className="mb-2 text-sm font-semibold text-text">Quantos minutos, mais ou menos?</p>
                  <div className="flex flex-wrap gap-2">
                    {OPCOES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => trocaMinutos(m)}
                        aria-pressed={minutos === m}
                        className={`tap min-h-11 min-w-14 rounded-full border px-4 text-sm font-bold ${
                          minutos === m
                            ? 'border-primary bg-primary text-white'
                            : 'border-border bg-card text-text'
                        }`}
                      >
                        {m} min
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-text">A mensagem</span>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                className="w-full rounded-xl border-2 border-border bg-card p-3 text-base text-text focus:border-primary focus:outline-none"
              />
            </label>
            <Button icon={Send} loading={enviando} disabled={!texto.trim()} onClick={enviar}>
              {familias
                ? `Enviar para ${familias} ${familias === 1 ? 'família' : 'famílias'}`
                : 'Salvar no caderno'}
            </Button>
          </div>
        )}
      </AppSheet>
    </>
  );
}
