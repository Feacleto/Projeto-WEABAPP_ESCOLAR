import { useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import AppSheet from '../common/AppSheet';
import Avatar from '../common/Avatar';
import CampoDeValor from '../common/CampoDeValor';
import CampoDaRua from './CampoDaRua';
import { CLASSE_DO_CAMPO } from './CamposDaLinha';
import { useSalvarNaLista } from '../../hooks/useSalvarNaLista';
import { procurarPontoDaCasa } from '../../services/listaDaTurmaService';
import { FALTA, gruposACompletar, oQueFalta, resumoDaLinha } from '../../dominio/escola/listaDaTurma.js';
import { normalizaHora } from '../../dominio/rota/horarios.js';
import { valorDoCampoFalta } from '../../dominio/cobranca/valorDaMensalidade.js';
import { DIGA_O_VALOR } from '../../marca/valorDoConvite.js';
import { mascaraHora, maskPhone, unmaskPhone, isValidPhone } from '../../compartilhado/masks';
import { montarEndereco } from '../../compartilhado/formatters';
import {
  ROTULOS,
  GRUPO_A_COMPLETAR,
  SEM_VALOR,
  PULADOS_FICAM,
  progressoDaFila,
} from '../../marca/textosDaLista.js';

/**
 * A CAIXA "A COMPLETAR" (RC2) — o que ele deixou para depois, junto, AGRUPADO
 * PELO QUE FALTA: hora de pegar, rua, número da casa, WhatsApp da mãe e
 * mensalidade (a fila de "sem valor": sem valor, a mensalidade do mês não
 * nasce — `functions/lib/billing.js`).
 *
 * Tocar num grupo abre a fila: UM campo por vez, com o progresso ("2 de 7"),
 * "Salvar e ir para a próxima" e "Ainda não sei · próxima", que pula sem
 * perder nada. É revisão em fila, não escrita em massa: cada criança grava a
 * SUA resposta, depois de ele ver o nome dela.
 *
 * A fila é a foto do grupo na hora em que ele abriu: quem foi completado no
 * meio não some de baixo do dedo dele; quem foi pulado volta no "Ver de novo".
 */
export default function ACompletar({ criancas }) {
  const grupos = useMemo(() => gruposACompletar(criancas), [criancas]);
  const [aberta, setAberta] = useState(null); // { falta, ids }
  const porId = useMemo(() => new Map((criancas || []).map((c) => [c.id, c])), [criancas]);
  if (!grupos.length) return null;

  const abrir = (falta) => {
    const g = gruposACompletar(criancas).find((x) => x.falta === falta);
    // `chave` remonta a fila no "Ver de novo": recomeça do primeiro.
    setAberta((antes) => (g ? { falta, ids: g.criancas.map((c) => c.id), chave: (antes?.chave || 0) + 1 } : null));
  };

  return (
    <section className="space-y-2 rounded-2xl bg-card p-3 shadow-rest" aria-label={ROTULOS.aCompletar}>
      <p className="flex items-center gap-1.5 text-base font-bold text-text">
        <ListChecks size={18} aria-hidden="true" className="text-primary" />
        {ROTULOS.aCompletar}
      </p>
      <div className="flex flex-wrap gap-2">
        {grupos.map((g) => (
          <button
            key={g.falta}
            type="button"
            onClick={() => abrir(g.falta)}
            className={`tap inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-3 text-base font-semibold ${
              g.falta === FALTA.HORA ? 'border-warningBorder bg-warningSoft text-warningText' : 'border-border bg-card text-text'
            }`}
          >
            {GRUPO_A_COMPLETAR[g.falta]}
            <span className="rounded-full bg-neutro px-2 text-sm font-bold text-text">{g.criancas.length}</span>
          </button>
        ))}
      </div>

      <AppSheet
        open={!!aberta}
        onClose={() => setAberta(null)}
        title={aberta ? `${ROTULOS.aCompletar} · ${GRUPO_A_COMPLETAR[aberta.falta]}` : ''}
        icon={ListChecks}
      >
        {aberta && (
          <Fila
            key={aberta.chave}
            falta={aberta.falta}
            ids={aberta.ids}
            porId={porId}
            onRecomecar={() => abrir(aberta.falta)}
          />
        )}
      </AppSheet>
    </section>
  );
}

function Fila({ falta, ids, porId, onRecomecar }) {
  const [pos, setPos] = useState(0);
  const proxima = () => setPos((p) => p + 1);
  if (pos >= ids.length) {
    return (
      <div className="space-y-3">
        <p className="text-base font-bold text-text">{ROTULOS.fimDaFila}</p>
        <p className="text-base text-textBody">{PULADOS_FICAM.texto}</p>
        <button
          type="button"
          onClick={onRecomecar}
          className="tap min-h-14 w-full rounded-xl border-2 border-primary bg-card text-base font-bold text-primary"
        >
          {ROTULOS.verDeNovo}
        </button>
      </div>
    );
  }
  const crianca = porId.get(ids[pos]);
  const pct = Math.round((pos / ids.length) * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-textMuted">
        <span>{falta === FALTA.MENSALIDADE ? SEM_VALOR.texto : ''}</span>
        <span className="font-semibold">{progressoDaFila(pos + 1, ids.length)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutro" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      {crianca ? (
        <ItemDaFila key={crianca.id} falta={falta} crianca={crianca} onProxima={proxima} />
      ) : (
        <button type="button" onClick={proxima} className="tap min-h-12 w-full text-base font-semibold text-primary">
          {ROTULOS.pularEProxima}
        </button>
      )}
    </div>
  );
}

function ItemDaFila({ falta, crianca, onProxima }) {
  const { estado, salvar } = useSalvarNaLista(crianca);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  // Já resolvido por outro caminho (a linha, a família): segue.
  const aindaFalta = oQueFalta(crianca).includes(falta);
  const contratoFeito = !!(crianca.contratoVigente || crianca.contractAcceptedAt || crianca.contratoAguardando);
  const salvando = estado[falta] === 'salvando';
  const naoSalvou = estado[falta] && typeof estado[falta] === 'object';

  const gravar = async () => {
    let mudanca = null;
    if (falta === FALTA.HORA) {
      const h = normalizaHora(valor);
      if (!h) return setErro('Hora inválida. Ex: 06:20');
      mudanca = { horaPega: h };
    } else if (falta === FALTA.WHATSAPP) {
      if (!isValidPhone(valor)) return setErro('Telefone com DDD.');
      mudanca = { parentPhone: unmaskPhone(valor) };
    } else if (falta === FALTA.MENSALIDADE) {
      if (valorDoCampoFalta(valor)) return setErro(DIGA_O_VALOR);
      mudanca = { monthlyFee: Number(valor) };
    } else if (falta === FALTA.NUMERO) {
      const partes = crianca.enderecoPartes;
      if (!partes?.logradouro || !valor.trim()) return setErro('Escreva o número.');
      mudanca = {
        address: montarEndereco({ ...partes, numero: valor.trim() }),
        numeroPendente: false,
        enderecoPartes: null,
        lat: null,
        lng: null,
      };
    }
    if (!mudanca) return onProxima();
    setErro('');
    const ok = await salvar(falta, mudanca);
    if (!ok) return;
    if (falta === FALTA.NUMERO) {
      procurarPontoDaCasa(crianca, mudanca.address, { ...crianca.enderecoPartes, numero: valor.trim() });
    }
    onProxima();
  };

  const campoSimples = (tipo) => (
    <input
      type="text"
      inputMode={tipo === 'hora' || tipo === 'numero' ? 'numeric' : 'tel'}
      autoComplete="off"
      aria-label={GRUPO_A_COMPLETAR[falta]}
      aria-invalid={erro ? true : undefined}
      value={valor}
      onChange={(e) => {
        setErro('');
        const v = e.target.value;
        setValor(tipo === 'hora' ? mascaraHora(v) : tipo === 'telefone' ? maskPhone(v) : v.slice(0, 12));
      }}
      enterKeyHint="done"
      placeholder="Digite aqui"
      className={`${CLASSE_DO_CAMPO} ${erro ? '!border-danger' : ''}`}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar photoURL={crianca.photoURL} gender={crianca.gender} seed={crianca.id} kind="child" size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold text-text">{crianca.name}</span>
          <span className="block truncate text-sm text-textMuted">{resumoDaLinha(crianca)}</span>
        </span>
      </div>

      {!aindaFalta ? null : falta === FALTA.RUA || (falta === FALTA.NUMERO && !crianca.enderecoPartes?.logradouro) ? (
        <CampoDaRua crianca={crianca} salvar={salvar} estado={estado.rua} />
      ) : falta === FALTA.MENSALIDADE ? (
        contratoFeito ? null : <CampoDeValor label={GRUPO_A_COMPLETAR[falta]} value={valor} onChange={setValor} error={erro} />
      ) : (
        <div>
          {campoSimples(falta === FALTA.HORA ? 'hora' : falta === FALTA.WHATSAPP ? 'telefone' : 'numero')}
          {erro && <p className="mt-1 text-sm font-semibold text-dangerText">{erro}</p>}
        </div>
      )}
      {naoSalvou && <p role="alert" className="text-sm font-semibold text-dangerText">{ROTULOS.naoSalvou}</p>}

      {aindaFalta && falta !== FALTA.RUA && !(falta === FALTA.MENSALIDADE && contratoFeito) && (
        <button
          type="button"
          onClick={gravar}
          disabled={salvando}
          className="tap min-h-14 w-full rounded-xl bg-primary px-4 text-base font-bold text-white disabled:opacity-60"
        >
          {naoSalvou ? ROTULOS.tentarDeNovo : ROTULOS.salvarEProxima}
        </button>
      )}
      <button type="button" onClick={onProxima} className="tap min-h-12 w-full text-base font-semibold text-primary">
        {aindaFalta && falta !== FALTA.RUA ? ROTULOS.pularEProxima : ROTULOS.irParaProxima}
      </button>
    </div>
  );
}
