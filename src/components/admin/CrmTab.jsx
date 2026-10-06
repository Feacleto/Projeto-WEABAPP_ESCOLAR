import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquarePlus, NotebookPen } from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '../common/Spinner';
import Sheet from '../common/Sheet';
import Button from '../common/Button';
import { carregarConsole } from '../../services/adminMetricsService';
import { anotarContato, listarContatos } from '../../services/contatosDoDonoService';
import {
  CANAIS,
  COLUNAS,
  agruparCorrecoes,
  LIMITE_DO_TEXTO,
  erroDoContato,
  montarQuadro,
} from '../../dominio/associacao/crmDoDono.js';

/**
 * CRM — cada motorista numa coluna e a próxima conversa (05/10/2026).
 *
 * A coluna de cada um sai de UMA função pura (`crmDoDono.js`). O cartão nunca
 * mostra telefone nem e-mail: quem quer falar abre a ficha, onde o canal
 * existe. Âmbar só quando o "retomar" é hoje ou já passou — é o único sinal
 * que pede ação, e âmbar que aparece em tudo deixa de ser lido.
 */
const ROTULO_DO_CANAL = Object.fromEntries(CANAIS.map((c) => [c.id, c.rotulo]));

function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).split('-');
  return `${d}/${m}/${a}`;
}

function quando(em) {
  const d = typeof em?.toDate === 'function' ? em.toDate() : em;
  return d instanceof Date ? d.toLocaleDateString('pt-BR') : 'agora';
}

function Cartao({ c }) {
  const urgente = Boolean(c.situacao);
  return (
    <li
      className={`rounded-2xl border p-3 ${
        urgente ? 'border-warningBorder bg-warningSoft' : 'border-border bg-card'
      }`}
    >
      <p className="truncate text-sm font-bold text-text">{c.nome}</p>
      <p className="mt-0.5 text-xs text-textMuted">
        {c.dias === null ? 'sem data' : `há ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'} aqui`}
      </p>
      {c.ultimo && (
        <p className="mt-1.5 line-clamp-2 text-xs text-text">
          <span className="font-bold">{ROTULO_DO_CANAL[c.ultimo.canal] || 'Contato'}:</span>{' '}
          {c.ultimo.texto}
        </p>
      )}
      {c.retomarEm && (
        <p className={`mt-1.5 text-xs font-bold ${urgente ? 'text-warningText' : 'text-textMuted'}`}>
          Retomar em {dataBR(c.retomarEm)}
        </p>
      )}
    </li>
  );
}

function FolhaDeContato({ aberta, onClose, motoristas, onSalvo, corrigindo }) {
  const [motoristaUid, setMotoristaUid] = useState('');
  const [canal, setCanal] = useState('whatsapp');
  const [texto, setTexto] = useState('');
  const [retomarEm, setRetomarEm] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    const uid = corrigindo ? corrigindo.motoristaUid : motoristaUid;
    const dados = {
      motoristaUid: uid,
      canal,
      texto,
      retomarEm: retomarEm || null,
      corrige: corrigindo?.id || null,
    };
    const erro = erroDoContato(dados);
    if (erro) {
      toast.error(erro);
      return;
    }
    setEnviando(true);
    try {
      await anotarContato(dados);
      toast.success('Contato anotado.');
      setTexto('');
      setRetomarEm('');
      onSalvo();
      onClose();
    } catch (err) {
      console.error('[admin] contato não gravou:', err);
      toast.error('Não deu pra anotar. Nada foi gravado.');
    } finally {
      setEnviando(false);
    }
  }

  const campo = 'mt-1.5 min-h-10 w-full rounded-xl border border-borderStrong bg-card p-3 text-sm';

  return (
    <Sheet open={aberta} onClose={onClose} title={corrigindo ? 'Corrigir anotação' : 'Anotar contato'} icon={NotebookPen}>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-xs text-textMuted">Escreva como se ele fosse ler: ele pode pedir.</p>

        {corrigindo ? (
          <p className="rounded-xl bg-sunken p-3 text-xs text-text">Corrigindo: {corrigindo.texto}</p>
        ) : (
        <label className="block">
          <span className="text-xs font-bold text-text">Motorista</span>
          <select value={motoristaUid} onChange={(e) => setMotoristaUid(e.target.value)} className={campo}>
            <option value="">Escolha</option>
            {motoristas.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.marcaNome || m.name || m.uid}
              </option>
            ))}
          </select>
        </label>
        )}

        <label className="block">
          <span className="text-xs font-bold text-text">Canal</span>
          <select value={canal} onChange={(e) => setCanal(e.target.value)} className={campo}>
            {CANAIS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-text">O que foi falado</span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            maxLength={LIMITE_DO_TEXTO}
            className={`${campo} leading-relaxed`}
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-text">Retomar em (opcional)</span>
          <input type="date" value={retomarEm} onChange={(e) => setRetomarEm(e.target.value)} className={campo} />
        </label>

        <Button type="submit" loading={enviando}>
          Anotar contato
        </Button>
      </form>
    </Sheet>
  );
}

export default function CrmTab() {
  const [console_, setConsole] = useState(null);
  const [contatos, setContatos] = useState(null);
  const [folha, setFolha] = useState(false);
  const [corrigindo, setCorrigindo] = useState(null);

  const carregarContatos = useCallback(() => {
    listarContatos()
      .then(setContatos)
      // Sem a coleção (rules ainda não publicadas) o quadro continua útil.
      .catch((err) => {
        console.error('[admin] contatos não carregaram:', err);
        setContatos([]);
      });
  }, []);

  useEffect(() => {
    let vivo = true;
    carregarConsole()
      .then((c) => vivo && setConsole(c))
      .catch((err) => {
        console.error('[admin] CRM não carregou:', err);
        if (vivo) setConsole(false);
      });
    carregarContatos();
    return () => {
      vivo = false;
    };
  }, [carregarContatos]);

  const quadro = useMemo(() => {
    if (!console_ || !contatos) return null;
    return montarQuadro({
      parceiros: console_.parceiros,
      faturas: console_.faturas,
      notas: console_.notas,
      contatos,
      agora: new Date(),
    });
  }, [console_, contatos]);

  const nomes = useMemo(() => {
    const m = {};
    (console_?.parceiros || []).forEach((p) => {
      m[p.uid] = p.marcaNome || p.name || 'Sem nome';
    });
    return m;
  }, [console_]);

  if (console_ === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar o CRM.
      </p>
    );
  }
  if (!quadro) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-textMuted">O motorista pode pedir para ler o que está escrito aqui.</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold text-text">Para retomar hoje: {quadro.retomarHoje}</p>
        <div className="w-full sm:w-auto">
          <Button size="sm" fullWidth={false} onClick={() => {
              setCorrigindo(null);
              setFolha(true);
            }} className="min-h-10">
            <MessageSquarePlus size={16} aria-hidden className="mr-2" />
            Anotar contato
          </Button>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex gap-3">
          {COLUNAS.map((col) => {
            const lista = quadro.colunas[col.id];
            return (
              <section key={col.id} aria-label={col.rotulo} className="w-64 shrink-0 space-y-2">
                <h2 className="rotulo">
                  {col.rotulo} · {lista.length}
                </h2>
                {lista.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-textMuted">
                    Ninguém aqui.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {lista.map((c) => (
                      <Cartao key={c.uid} c={c} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <section className="space-y-2" aria-labelledby="ultimos-contatos">
        <h2 id="ultimos-contatos" className="rotulo">
          Últimos contatos
        </h2>
        {contatos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-textMuted">
            Nenhum contato anotado ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {agruparCorrecoes(contatos.slice(0, 30)).map((c) => (
              <li key={c.id} className="rounded-2xl border border-border bg-card p-3">
                <p className="text-xs text-textMuted">
                  {quando(c.em)} · {ROTULO_DO_CANAL[c.canal] || c.canal} ·{' '}
                  <span className="font-bold text-text">{nomes[c.motoristaUid] || 'Motorista'}</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-text">{c.texto}</p>
                {c.correcoes.map((k) => (
                  <div key={k.id} className="mt-2 border-l-2 border-borderStrong pl-3">
                    <p className="text-xs font-bold text-textMuted">Correção · {quando(k.em)}</p>
                    <p className="whitespace-pre-line text-sm text-text">{k.texto}</p>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCorrigindo(c);
                    setFolha(true);
                  }}
                  className="mt-2 min-h-10 text-xs font-bold text-primary"
                >
                  Corrigir
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FolhaDeContato
        aberta={folha}
        onClose={() => setFolha(false)}
        motoristas={console_.parceiros}
        onSalvo={carregarContatos}
        corrigindo={corrigindo}
      />
    </div>
  );
}
