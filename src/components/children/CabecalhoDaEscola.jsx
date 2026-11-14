import { useId, useState } from 'react';
import { School, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { mascaraHora } from '../../compartilhado/masks';
import { normalizaHora, horaCurta } from '../../dominio/rota/horarios.js';
import { proporHorasDePegar, temHoraDePegar, conferirProposta } from '../../dominio/escola/listaDaTurma.js';
import { salvarCampoDaLista, salvarEntradaDaEscola } from '../../services/listaDaTurmaService';
import { useValorDoCampo } from '../../hooks/useValorDoCampo';
import {
  ROTULOS,
  cabecalhoDaEscola,
  PROPOSTA_NOTA,
  PROPOSTA_AVISO,
  PONHA_A_ENTRADA,
  textoJaTinhamHora,
} from '../../marca/textosDaLista.js';
import { RotuloDoCampo, CLASSE_DO_CAMPO } from './CamposDaLinha';

/**
 * O CABEÇALHO DE UMA ESCOLA NA LISTA DA TURMA (RC2): UMA LINHA — "Escola
 * Alvorada · 6 crianças" e o chip da ENTRADA ("Entrada 7h00 ✎", ou "Pôr
 * entrada"). Tocar no chip abre, logo abaixo, a entrada e a hora de pegar
 * PROPOSTA para quem está sem. Era um bloco de ~140 px aberto em toda escola,
 * e numa turma nova a primeira tela não mostrava criança nenhuma (achado M6).
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
 *
 * ⚠️ A PROPOSTA SAI DA ENTRADA QUE ESTÁ NO CAMPO (achado M3): saía da entrada
 * do banco, e a remontagem do cabeçalho a cada entrada salva apagava a
 * proposta aberta. E ao confirmar ela é conferida contra a criança DE AGORA
 * (`conferirProposta`): quem ganhou hora no meio-tempo é pulado e contado; a
 * hora editada que não é hora é mostrada, e nada é gravado até corrigir.
 */
export default function CabecalhoDaEscola({ grupo, salvador, criancasAoVivo }) {
  const idEntrada = useId();
  const chaveEntrada = `escola:${grupo.escolaId}:entrada`;
  const estadoEntrada = grupo.escolaId ? salvador.ler(chaveEntrada) : null;
  const { valor: entrada, setValor: setEntrada, setEditando } = useValorDoCampo(grupo.horaEntrada || '', estadoEntrada);
  const [aberto, setAberto] = useState(false);
  const [proposta, setProposta] = useState(null); // [{ child, hora }]
  const [invalidas, setInvalidas] = useState([]);
  const [gravando, setGravando] = useState(false);

  const semHora = grupo.criancas.filter((c) => !temHoraDePegar(c));
  const entradaValida = normalizaHora(entrada);

  const salvarEntrada = () => {
    setEditando(false);
    const h = normalizaHora(entrada);
    if (!grupo.escolaId || !h || h === grupo.horaEntrada) return;
    salvador.salvar(chaveEntrada, () => salvarEntradaDaEscola(grupo.escolaId, h), { digitado: entrada });
  };

  const propor = () => {
    setInvalidas([]);
    setProposta(proporHorasDePegar({ criancas: grupo.criancas, escola: grupo.escola, entrada: entradaValida }));
  };

  const confirmar = async () => {
    if (!proposta?.length || gravando) return;
    const r = conferirProposta(proposta, criancasAoVivo);
    if (r.invalidas.length) {
      setInvalidas(r.invalidas);
      return;
    }
    setGravando(true);
    let gravadas = 0;
    try {
      // Uma criança por vez, cada uma com a SUA hora — nunca um lote com a
      // mesma hora para todas.
      for (const item of r.gravar) {
        await salvarCampoDaLista(item.child, { horaPega: item.hora });
        gravadas += 1;
      }
      toast.success(gravadas === 1 ? '1 hora de pegar combinada.' : `${gravadas} horas de pegar combinadas.`);
      if (r.jaTinham.length) toast(textoJaTinhamHora(r.jaTinham.length));
      setProposta(null);
    } catch {
      toast.error(gravadas ? `${gravadas} gravadas. As outras não. Tente de novo.` : 'Não deu pra salvar. Tente de novo.');
    } finally {
      setGravando(false);
    }
  };

  const horaDoChip = normalizaHora(grupo.horaEntrada);

  return (
    <div className="px-1">
      <div className="flex min-h-11 items-center gap-2">
        <School size={18} aria-hidden="true" className="shrink-0 text-escola" />
        <h2 className="min-w-0 flex-1 truncate text-base font-bold text-text">
          {cabecalhoDaEscola(grupo.nome, grupo.criancas.length)}
        </h2>
        {grupo.escolaId && (
          <button
            type="button"
            onClick={() => setAberto((a) => !a)}
            aria-expanded={aberto}
            className="tap inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border-2 border-border bg-card px-3 text-sm font-semibold text-text"
          >
            {horaDoChip ? ROTULOS.entradaChip(horaCurta(horaDoChip)) : ROTULOS.porEntrada}
            <Pencil size={14} aria-hidden="true" className="text-primary" />
          </button>
        )}
      </div>

      {aberto && grupo.escolaId && (
        <div className="mt-1 space-y-2 pb-1">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-28">
              <RotuloDoCampo
                htmlFor={idEntrada}
                rotulo={ROTULOS.entrada}
                estado={estadoEntrada}
                onTentar={() => salvador.tentarDeNovo(chaveEntrada)}
              />
              <input
                id={idEntrada}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={entrada}
                onFocus={() => setEditando(true)}
                onChange={(e) => setEntrada(mascaraHora(e.target.value))}
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
          {semHora.length > 0 && !entradaValida && (
            <p className="text-sm text-textMuted">{PONHA_A_ENTRADA.texto}</p>
          )}
        </div>
      )}

      {proposta && (
        <div className="mt-1 space-y-3 rounded-2xl bg-card p-3 shadow-rest">
          <p className="text-base font-bold text-text">{ROTULOS.propostaTitulo}</p>
          <p className="text-sm text-textBody">{PROPOSTA_NOTA.texto}</p>
          {proposta.map((item, i) => {
            const ruim = invalidas.includes(item.child.id);
            return (
              <div key={item.child.id}>
                <label className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-base font-semibold text-text">{item.child.name}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={item.hora}
                    aria-invalid={ruim ? true : undefined}
                    onChange={(e) => {
                      const hora = mascaraHora(e.target.value);
                      setInvalidas((l) => l.filter((id) => id !== item.child.id));
                      setProposta((p) => p.map((x, j) => (j === i ? { ...x, hora } : x)));
                    }}
                    placeholder="Digite aqui"
                    className={`${CLASSE_DO_CAMPO} !w-28 ${ruim ? '!border-danger' : ''}`}
                  />
                </label>
                {ruim && <p className="mt-1 text-right text-sm font-semibold text-dangerText">{ROTULOS.horaInvalida}</p>}
              </div>
            );
          })}
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
