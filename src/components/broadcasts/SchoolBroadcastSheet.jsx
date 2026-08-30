import { useEffect, useMemo, useState } from 'react';
import { X, Megaphone, School, Send, Check, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useChildren } from '../../hooks/useChildren';
import { useEscolas } from '../../hooks/useEscolas';
import { useAuth } from '../../hooks/useAuth';
import {
  createSchoolBroadcast,
  diasUteis,
  truncouIntervalo,
  rotuloDoPeriodo,
  rotuloDoDia,
  MAX_DIAS,
} from '../../services/broadcastService';
import { getDateKey } from '../../utils/horarios';
import { chaveDoNome } from '../../utils/nomeEscola';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';

/**
 * "Sem aula" — o aviso que já sai virando ausência na rota.
 *
 * TRÊS COISAS QUE ELE NÃO FAZIA
 * Era um dia só, era a escola inteira, e agrupava por nome digitado. Os três
 * limites tinham o mesmo efeito prático: o motorista não usava. Ou avisava
 * famílias que não deviam ser avisadas, ou disparava o mesmo recado três vezes
 * pra cobrir três dias, ou descobria que metade da turma não tinha recebido
 * porque a escola dela estava escrita com pontos.
 */
/**
 * A CASCA. O miolo só monta com a folha ABERTA — e isso não é detalhe.
 *
 * O componente recebia `open` como prop, mas os hooks rodavam de qualquer
 * jeito: `useChildren` e `useEscolas` no topo, antes de qualquer `return`.
 * Como esta folha é montada incondicionalmente no `TioDashboard`, o resultado
 * era DUAS assinaturas do Firestore abertas a tela inteira, o dia inteiro,
 * para uma folha que talvez nunca fosse aberta.
 *
 * Com `useChildren` e `useEscolas` já assinados pelo layout e pelo dashboard,
 * eram a terceira e a quarta cópia dos mesmos dados.
 *
 * O padrão já existe no projeto, dois diretórios ao lado: `ChildDetail.jsx`
 * monta o corpo com `{open && <ChildDetailBody …/>}` pelo mesmo motivo.
 */
export default function SchoolBroadcastSheet({ open, onClose }) {
  if (!open) return null;
  return <SchoolBroadcastBody onClose={onClose} />;
}

function SchoolBroadcastBody({ onClose }) {
  const { alcaProps, estilo } = useArrastarPraFechar(onClose);
  const { user } = useAuth();
  const { children: todasCriancas } = useChildren();
  const { escolas } = useEscolas();

  const [escolaId, setEscolaId] = useState('');
  const [de, setDe] = useState(getDateKey());
  const [ate, setAte] = useState('');
  const [message, setMessage] = useState('');
  const [desmarcadas, setDesmarcadas] = useState(() => new Set());
  const [enviando, setEnviando] = useState(false);

  /**
   * As escolas ofertadas. Sai das entidades cadastradas, mas cai pro nome
   * digitado quando a criança ainda não foi migrada — senão o motorista que
   * ainda não cadastrou escola nenhuma abre o aviso e vê uma lista vazia.
   */
  const opcoes = useMemo(() => {
    const mapa = new Map();
    for (const e of escolas) {
      mapa.set(e.id, { id: e.id, nome: e.nome, criancas: [], legada: false });
    }
    for (const c of todasCriancas) {
      if (c.active === false) continue;
      if (c.schoolId && mapa.has(c.schoolId)) {
        mapa.get(c.schoolId).criancas.push(c);
        continue;
      }
      const nome = c.school?.trim();
      if (!nome) continue;
      const chave = `legado:${chaveDoNome(nome)}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, { id: chave, nome, criancas: [], legada: true });
      }
      mapa.get(chave).criancas.push(c);
    }
    return [...mapa.values()]
      .filter((o) => o.criancas.length > 0)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [escolas, todasCriancas]);

  const escolhida = opcoes.find((o) => o.id === escolaId) || null;

  // Trocar de escola zera a seleção de crianças: manter marcações da escola
  // anterior faria o aviso sair pra quem ele não estava olhando.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesmarcadas(new Set());
  }, [escolaId]);

  const dias = useMemo(() => diasUteis(de, ate || de), [de, ate]);
  // O teto de 31 dias TRUNCA em silêncio. Sem esta linha, errar o ano no
  // seletor mostrava "31 dias úteis · de 01/01 a 12/02", com o botão
  // habilitado — e gravava 31 faltas que ninguém pediu.
  const truncado = useMemo(() => truncouIntervalo(dias, ate || de), [dias, ate, de]);
  const alcancadas = useMemo(
    () => (escolhida?.criancas || []).filter((c) => !desmarcadas.has(c.id)),
    [escolhida, desmarcadas]
  );

  function alternar(id) {
    setDesmarcadas((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function enviar() {
    if (!escolhida) {
      toast.error('Escolha uma escola.');
      return;
    }
    if (!dias.length) {
      toast.error('Escolha pelo menos um dia útil.');
      return;
    }
    if (!alcancadas.length) {
      toast.error('Escolha pelo menos uma criança.');
      return;
    }
    setEnviando(true);
    try {
      const { affectedCount } = await createSchoolBroadcast({
        escolaId: escolhida.legada ? null : escolhida.id,
        escolaNome: escolhida.nome,
        de,
        ate: ate || de,
        message,
        adminUid: user.uid,
        children: alcancadas,
      });
      toast.success(
        `${affectedCount} ${affectedCount === 1 ? 'família avisada' : 'famílias avisadas'} · ${rotuloDoPeriodo(dias)}`
      );
      setMessage('');
      setAte('');
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Não deu pra enviar o aviso.');
    } finally {
      setEnviando(false);
    }
  }

  const hoje = getDateKey();

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={() => !enviando && onClose?.()}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[90vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', ...estilo }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...alcaProps}
          className={`pt-3 pb-1 flex justify-center ${alcaProps.className}`}
        >
          <span className="block w-10 h-1.5 rounded-full bg-borderStrong" />
        </div>

        <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-text leading-tight inline-flex items-center gap-2">
              <Megaphone size={20} className="text-primary" />
              Avisar sem aula
            </h2>
            <p className="text-xs text-textMuted mt-1">
              Os responsáveis são notificados e a rota do dia já sai sem elas.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="tap w-9 h-9 rounded-full bg-neutro flex items-center justify-center text-textMuted shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4">
          {/* Escola */}
          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Escola
            </label>
            {opcoes.length === 0 ? (
              <p className="text-sm text-textMuted bg-sunken border border-dashed border-border rounded-xl p-4 text-center">
                Nenhuma criança com escola cadastrada.
              </p>
            ) : (
              <div className="space-y-2">
                {opcoes.map((o) => {
                  const ativa = escolaId === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setEscolaId(o.id)}
                      aria-pressed={ativa}
                      className={`tap w-full text-left rounded-2xl border-2 px-3 py-2.5 flex items-center gap-3 ${
                        ativa ? 'border-primary bg-primary/5' : 'border-border bg-card'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          ativa ? 'bg-primary text-white' : 'bg-neutro text-textMuted'
                        }`}
                      >
                        <School size={15} />
                      </div>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-text truncate">
                          {o.nome}
                        </span>
                        <span className="block text-[11px] text-textMuted">
                          {o.criancas.length}{' '}
                          {o.criancas.length === 1 ? 'criança' : 'crianças'}
                        </span>
                      </span>
                      {ativa && <Check size={17} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quando */}
          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Quando
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-[11px] text-textMuted mb-1">De</span>
                <input
                  type="date"
                  value={de}
                  min={hoje}
                  onChange={(e) => setDe(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-border bg-card px-3 text-sm text-text focus:outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="block text-[11px] text-textMuted mb-1">
                  Até <span className="opacity-60">(opcional)</span>
                </span>
                <input
                  type="date"
                  value={ate}
                  min={de}
                  onChange={(e) => setAte(e.target.value)}
                  className="w-full h-12 rounded-xl border-2 border-border bg-card px-3 text-sm text-text focus:outline-none focus:border-primary"
                />
              </label>
            </div>

            {truncado && (
              <p className="text-[11px] text-warning mt-2">
                O intervalo passa de {MAX_DIAS} dias. Vamos gravar só até{' '}
                {rotuloDoDia(dias[dias.length - 1])} — o resto fica de fora.
              </p>
            )}
            {dias.length > 0 ? (
              <p className="text-[11px] text-textMuted mt-2">
                {dias.length === 1
                  ? `1 dia · ${rotuloDoPeriodo(dias)}`
                  : `${dias.length} dias úteis · ${rotuloDoPeriodo(dias)}`}
                {ate && ' · sábado e domingo não contam'}
              </p>
            ) : (
              <p className="text-[11px] text-danger mt-2">
                Esse intervalo não tem dia útil{' '}
                {ate ? '(ou passa de ' + MAX_DIAS + ' dias).' : '.'}
              </p>
            )}
          </div>

          {/* Quem */}
          {escolhida && (
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-2">
                <label className="text-sm font-semibold text-text">
                  Quem avisar
                </label>
                <span className="text-[11px] text-textMuted inline-flex items-center gap-1">
                  <Users size={12} />
                  {alcancadas.length} de {escolhida.criancas.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {escolhida.criancas.map((c) => {
                  const marcada = !desmarcadas.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => alternar(c.id)}
                      aria-pressed={marcada}
                      className={`tap w-full text-left rounded-xl border px-3 py-2 flex items-center gap-2.5 ${
                        marcada
                          ? 'border-border bg-card'
                          : 'border-border bg-sunken opacity-60'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                          marcada
                            ? 'bg-primary border-primary text-white'
                            : 'border-borderStrong bg-card'
                        }`}
                      >
                        {marcada && <Check size={13} />}
                      </span>
                      <span
                        className={`flex-1 min-w-0 truncate text-sm ${
                          marcada ? 'text-text font-medium' : 'text-textMuted line-through'
                        }`}
                      >
                        {c.name}
                      </span>
                      {!c.parentUid && (
                        <span className="text-[10px] text-warningText shrink-0">
                          sem app
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-textMuted mt-2">
                Quem está sem o app não recebe notificação, mas a falta é
                registrada do mesmo jeito.
              </p>
            </div>
          )}

          {/* Recado */}
          <div>
            <label className="block text-sm font-semibold text-text mb-2">
              Recado <span className="text-textMuted font-normal">(opcional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Reunião do conselho de classe."
              className="w-full rounded-2xl border-2 border-border bg-card p-3 text-sm text-text placeholder:text-textMuted focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        <div className="px-5 pt-2 pb-3 border-t border-neutro bg-card">
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !escolhida || !dias.length || !alcancadas.length}
            className="tap w-full rounded-2xl py-3.5 bg-primary text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send size={18} />
            {enviando
              ? 'Enviando…'
              : `Avisar ${alcancadas.length} ${alcancadas.length === 1 ? 'família' : 'famílias'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
