import { useEffect, useMemo, useState } from 'react';
import { Bus, Check, MessageSquare, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '../common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { listarUsuarios } from '../../services/userService';
import {
  fecharChamado,
  marcarRespondido,
  rotuloDaCategoria,
  watchChamados,
} from '../../services/supportService';
import {
  aguardando,
  diasEsperando,
  mensagemDeResposta,
  ordenarChamados,
  resumirChamados,
} from '../../dominio/suporte/chamados.js';
import { linkDaProposta } from '../../dominio/associacao/proposta.js';

/**
 * A CAIXA DE CHAMADOS — a maior lacuna que o painel tinha.
 *
 * ── ELA RECEBIA DESDE SEMPRE, E NINGUÉM LIA
 * O motorista e o responsável abrem chamado pelo menu de perfil, `supportTickets`
 * grava, as rules liberam o dono — e nenhuma tela existia. Quem pediu ajuda e
 * não recebeu resposta cancela, e não diz por quê.
 *
 * ── A ORDEM É A ESPERA, NÃO A DATA
 * Quem aguarda vem primeiro, e entre eles o MAIS ANTIGO na frente — o oposto de
 * uma caixa de e-mail. Ordenar por recente enterra exatamente quem espera há
 * três dias, que é quem some sem avisar. A regra está em
 * `dominio/suporte/chamados.js`, com teste.
 *
 * ── CHAMADO DE RESPONSÁVEL NÃO É CHAMADO DE MOTORISTA
 * O responsável é cliente do MOTORISTA, não da plataforma. Responder direto a
 * ele passa por cima de quem presta o serviço — e dá a ele um canal com a
 * plataforma que o motorista não sabe que existe.
 *
 * Os dois aparecem na mesma caixa (ignorar um seria o problema de novo), mas a
 * tela DIZ de qual dos dois se trata, e o de responsável sugere avisar o
 * motorista dele em vez de responder por cima.
 *
 * ── A RESPOSTA SAI PELO WHATSAPP, EDITÁVEL
 * Mesma regra da proposta ao motorista: o texto é montado com o que a pessoa
 * escreveu — porque entre abrir o chamado e receber a resposta passaram dias e
 * ela já não lembra qual dos problemas dela é este — e quem responde lê antes
 * de mandar.
 */
export default function ChamadosTab() {
  const { user } = useAuth();
  const [chamados, setChamados] = useState(null);
  const [pessoas, setPessoas] = useState({});
  const [ocupado, setOcupado] = useState(null);

  useEffect(() => watchChamados(setChamados, () => setChamados(false)), []);

  // Quem abriu o chamado — nome e telefone. `supportTickets` guarda só o `uid`
  // e o papel, então o contato vem de `users`, que o dono já lista.
  //
  // TODOS os usuários, não só os parceiros: o chamado vem dos dois lados, e
  // `listarParceiros` traz apenas `role == 'admin'` — usá-la aqui deixaria
  // todo chamado de família sem nome e sem botão de responder.
  useEffect(() => {
    listarUsuarios()
      .then(({ lista }) => {
        const m = {};
        lista.forEach((u) => {
          m[u.uid] = u;
        });
        setPessoas(m);
      })
      .catch(() => {});
  }, []);

  const agora = new Date();
  const lista = useMemo(
    // A ordem não depende do relógio — só de status e data de criação. Se
    // dependesse, a lista se reordenaria debaixo do dedo de quem está lendo.
    () => (Array.isArray(chamados) ? ordenarChamados(chamados) : null),
    [chamados]
  );
  const resumo = useMemo(
    () => resumirChamados(Array.isArray(chamados) ? chamados : [], agora),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chamados]
  );

  /* `dono` é o uid de quem ABRIU o chamado, e vai adiante porque
     `marcarRespondido` avisa essa pessoa. O objeto do chamado já está na tela
     — ler o documento de novo só pra descobrir o dono seria uma ida ao banco
     por um dado que a linha já mostra. */
  const agir = async (fn, id, msg, dono) => {
    setOcupado(id);
    try {
      await fn(id, user?.uid, dono);
      toast.success(msg);
    } catch (err) {
      toast.error(err.message || 'Não deu pra atualizar.');
    } finally {
      setOcupado(null);
    }
  };

  if (chamados === false) {
    return (
      <p className="rounded-2xl border border-dangerBorder bg-dangerSoft p-4 text-xs text-dangerText">
        Não deu pra carregar os chamados.
      </p>
    );
  }
  if (lista === null) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* O CABEÇALHO SÓ APARECE QUANDO HÁ ESPERA. Uma linha permanente de
        * "0 aguardando" vira moldura, e moldura não é lida — e aí não é vista
        * no dia em que tem número. */}
      {resumo.esperando > 0 && (
        <div className="rounded-2xl border border-warningBorder bg-warningSoft p-4">
          <p className="text-sm font-bold text-warningText">
            {resumo.esperando}{' '}
            {resumo.esperando === 1 ? 'chamado aguardando' : 'chamados aguardando'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-warningText/85">
            {resumo.deMotorista > 0 && (
              <>
                {resumo.deMotorista} de motorista
                {resumo.deResponsavel > 0 ? ' · ' : '. '}
              </>
            )}
            {resumo.deResponsavel > 0 && <>{resumo.deResponsavel} de família. </>}
            {/* A contagem sozinha não distingue um chamado de três dias de dez
              * que chegaram hoje, e as duas situações pedem coisas diferentes. */}
            {resumo.esperandoHaMais > 0 && (
              <>
                O mais antigo espera há <strong>{resumo.esperandoHaMais}</strong>{' '}
                {resumo.esperandoHaMais === 1 ? 'dia' : 'dias'}.
              </>
            )}
          </p>
        </div>
      )}

      {!lista.length ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <MessageSquare size={22} className="mx-auto text-textMuted" />
          <p className="mt-2 text-xs text-textMuted">
            Nenhum chamado ainda. Quando alguém pedir ajuda pelo app, ele
            aparece aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((c) => (
            <Chamado
              key={c.id}
              chamado={c}
              pessoa={pessoas[c.uid]}
              dias={diasEsperando(c, agora)}
              ocupado={ocupado === c.id}
              onResponder={() =>
                agir(marcarRespondido, c.id, 'Marcado como respondido.', c.uid)
              }
              onFechar={() => agir(fecharChamado, c.id, 'Chamado fechado.')}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Chamado({ chamado, pessoa, dias, ocupado, onResponder, onFechar }) {
  const espera = aguardando(chamado);
  const deMotorista = chamado.role === 'admin';
  const rotulo = rotuloDaCategoria(chamado.category);

  const texto = mensagemDeResposta({ ...chamado, nome: pessoa?.name }, rotulo);
  const link = linkDaProposta(pessoa?.phone, texto);

  return (
    <li
      className={`rounded-2xl border p-4 text-xs ${
        espera ? 'border-border bg-card' : 'border-border bg-surface opacity-70'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-text">{pessoa?.name || chamado.uid}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-textMuted">
            {deMotorista ? <Bus size={11} /> : <Users size={11} />}
            {deMotorista ? 'motorista' : 'família'} · {rotulo}
          </p>
        </div>
        {espera ? (
          <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warningText">
            {dias === 0 ? 'hoje' : `${dias}d esperando`}
          </span>
        ) : (
          <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-textMuted">
            {chamado.status === 'fechado' ? 'fechado' : 'respondido'}
          </span>
        )}
      </div>

      <p className="mt-2 whitespace-pre-line rounded-xl bg-surface p-3 leading-relaxed text-text">
        {chamado.description}
      </p>

      {/* ⚠️ O QUE FAZER COM UM CHAMADO DE FAMÍLIA, dito na tela.
        *
        * O responsável é cliente do MOTORISTA. Responder por cima passa sobre
        * quem presta o serviço, e cria um canal que o motorista não sabe que
        * existe. Na maior parte das vezes o certo é avisar ele. */}
      {!deMotorista && espera && (
        <p className="mt-2 leading-relaxed text-textMuted">
          Esta pessoa é cliente de um motorista. Normalmente o caminho é avisar
          <strong> ele</strong>, não responder por cima.
        </p>
      )}

      {espera && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="tap inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 font-bold text-white"
            >
              <MessageSquare size={13} />
              Responder no WhatsApp
            </a>
          ) : (
            <span className="inline-flex h-9 items-center rounded-xl bg-neutro px-3 text-textMuted">
              Sem telefone cadastrado
            </span>
          )}
          <button
            type="button"
            onClick={onResponder}
            disabled={ocupado}
            className="tap inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 font-bold text-text disabled:opacity-40"
          >
            <Check size={13} />
            Marquei como respondido
          </button>
          <button
            type="button"
            onClick={onFechar}
            disabled={ocupado}
            className="tap inline-flex h-9 items-center rounded-xl border border-border px-3 font-bold text-textMuted disabled:opacity-40"
          >
            Fechar
          </button>
        </div>
      )}
    </li>
  );
}
