import { useId, useState } from 'react';
import { School } from 'lucide-react';
import toast from 'react-hot-toast';
import { mascaraHora } from '../../compartilhado/masks';
import { normalizaHora } from '../../dominio/rota/horarios.js';
import { proporHorasDePegar, temHoraDePegar } from '../../dominio/escola/listaDaTurma.js';
import { salvarCampoDaLista, salvarEntradaDaEscola } from '../../services/listaDaTurmaService';
import {
  ROTULOS,
  cabecalhoDaEscola,
  PROPOSTA_NOTA,
  PROPOSTA_AVISO,
  PONHA_A_ENTRADA,
} from '../../marca/textosDaLista.js';
import { RotuloDoCampo, CLASSE_DO_CAMPO } from './CamposDaLinha';

/**
 * O CABEÇALHO DE UMA ESCOLA NA LISTA DA TURMA (RC2): "Escola Alvorada · 6
 * crianças", a ENTRADA da escola e, para quem está sem hora de pegar, a hora
 * PROPOSTA pelo app.
 *
 * ⚠️ NUNCA "APLICAR A TODAS" (doc 11, corrigido depois do inventário 13a).
 * O `horaPega` é a hora na PORTA de cada casa: a mesma hora no grupo inteiro
 * dispararia "seu horário mudou" às famílias com um chute, e N casas na mesma
 * hora fazem a rota dizer que não fecha. Então ele informa a hora da ESCOLA,
 * e o app PROPÕE uma hora diferente para cada casa (`proporHorasDePegar`: da
 * mais longe para a mais perto, de 5 em 5 minutos, nenhuma repetida). Cada
 * hora aparece num campo editável e só é gravada quando ele confirma — e
 * gravada criança a criança, cada uma com a SUA hora, avisando a família
 * depois de gravar (o mesmo caminho de "Horários da rota").
 */
export default function CabecalhoDaEscola({ grupo }) {
  const idEntrada = useId();
  const [entrada, setEntrada] = useState(grupo.horaEntrada || '');
  const [estadoEntrada, setEstadoEntrada] = useState(null);
  const [proposta, setProposta] = useState(null); // [{ child, hora }]
  const [gravando, setGravando] = useState(false);

  const semHora = grupo.criancas.filter((c) => !temHoraDePegar(c));
  const entradaValida = normalizaHora(grupo.horaEntrada || entrada);

  const salvarEntrada = async () => {
    const h = normalizaHora(entrada);
    if (!grupo.escolaId || !h || h === grupo.horaEntrada) return;
    setEstadoEntrada('salvando');
    try {
      await salvarEntradaDaEscola(grupo.escolaId, h);
      setEstadoEntrada('salvo');
    } catch {
      setEstadoEntrada({ erro: true });
    }
  };

  const propor = () =>
    setProposta(proporHorasDePegar({ criancas: grupo.criancas, escola: grupo.escola, entrada: entradaValida }));

  const confirmar = async () => {
    if (!proposta?.length) return;
    setGravando(true);
    let gravadas = 0;
    try {
      // Uma criança por vez, cada uma com a SUA hora — nunca um lote com a
      // mesma hora para todas.
      for (const item of proposta) {
        const hora = normalizaHora(item.hora);
        if (!hora) continue;
        await salvarCampoDaLista(item.child, { horaPega: hora });
        gravadas += 1;
      }
      toast.success(gravadas === 1 ? '1 hora de pegar combinada.' : `${gravadas} horas de pegar combinadas.`);
      setProposta(null);
    } catch {
      toast.error(gravadas ? `${gravadas} gravadas. As outras não. Tente de novo.` : 'Não deu pra salvar. Tente de novo.');
    } finally {
      setGravando(false);
    }
  };

  return (
    <div className="space-y-2 px-1 pb-1 pt-2">
      <p className="flex items-center gap-1.5 text-base font-bold text-text">
        <School size={18} aria-hidden="true" className="shrink-0 text-escola" />
        <span className="min-w-0 truncate">{cabecalhoDaEscola(grupo.nome, grupo.criancas.length)}</span>
      </p>

      {grupo.escolaId && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-28">
            <RotuloDoCampo
              htmlFor={idEntrada}
              rotulo={ROTULOS.entrada}
              estado={estadoEntrada}
              onTentar={salvarEntrada}
            />
            <input
              id={idEntrada}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={entrada}
              onChange={(e) => {
                setEstadoEntrada(null);
                setEntrada(mascaraHora(e.target.value));
              }}
              onBlur={salvarEntrada}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              enterKeyHint="done"
              placeholder="Digite aqui"
              className={CLASSE_DO_CAMPO}
            />
          </div>
          {semHora.length > 0 && entradaValida && !proposta && (
            <button
              type="button"
              onClick={propor}
              className="tap min-h-12 flex-1 rounded-xl border-2 border-primary bg-card px-3 text-base font-semibold text-primary"
            >
              {ROTULOS.propor}
            </button>
          )}
        </div>
      )}
      {grupo.escolaId && semHora.length > 0 && !entradaValida && (
        <p className="text-sm text-textMuted">{PONHA_A_ENTRADA.texto}</p>
      )}

      {proposta && (
        <div className="space-y-3 rounded-2xl bg-card p-3 shadow-rest">
          <p className="text-base font-bold text-text">{ROTULOS.propostaTitulo}</p>
          <p className="text-sm text-textBody">{PROPOSTA_NOTA.texto}</p>
          {proposta.map((item, i) => (
            <label key={item.child.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-base font-semibold text-text">{item.child.name}</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={item.hora}
                onChange={(e) => {
                  const hora = mascaraHora(e.target.value);
                  setProposta((p) => p.map((x, j) => (j === i ? { ...x, hora } : x)));
                }}
                placeholder="Digite aqui"
                className={`${CLASSE_DO_CAMPO} !w-28`}
              />
            </label>
          ))}
          <p className="text-sm text-textMuted">{PROPOSTA_AVISO.texto}</p>
          <button
            type="button"
            onClick={confirmar}
            disabled={gravando}
            className="tap min-h-14 w-full rounded-xl bg-primary px-4 text-base font-bold text-white disabled:opacity-60"
          >
            {ROTULOS.confirmarHorarios}
          </button>
          <button
            type="button"
            onClick={() => setProposta(null)}
            className="tap min-h-12 w-full text-base font-semibold text-primary"
          >
            {ROTULOS.agoraNao}
          </button>
        </div>
      )}
    </div>
  );
}
