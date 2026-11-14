import { useEffect, useState } from 'react';
import { UserPlus, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { getChild } from '../../services/childrenService';
import { recusarIrmao, responderIrmao } from '../../services/authService';
import { useNotificacoesDaSessao } from '../../hooks/useNotifications';

/**
 * O IRMÃO QUE APARECEU SOZINHO — e a saída, se não for (02/10/2026).
 *
 * O motorista cadastrou uma criança com o WhatsApp dela, e o servidor a pôs
 * nesta conta sem convite (`functions/lib/vincularIrmao.js`). Este cartão diz
 * isso no Início, com dois botões: ver a criança, ou "Não é meu filho" — que
 * desfaz o vínculo e avisa o motorista para conferir o número.
 *
 * "Ver" só esconde o cartão NESTE aparelho (localStorage): não é aceite de
 * nada, é só "já vi". O aviso que vale está no sino, que não some.
 *
 * ── "É SEU FILHO?" (14/11/2026)
 * Quando o motorista digita o WhatsApp dela DEPOIS, numa criança já
 * cadastrada, o servidor não vincula: pergunta
 * (`functions/lib/perguntaDoIrmao.js`). A pergunta chega como aviso
 * `irmao_pergunta`, e o cartão dela vem ANTES do de cima, com "Sim, é meu
 * filho" e "Não é meu filho". Só o primeiro nome aparece — o resto da
 * criança ela só vê depois do sim. Quem decide se a resposta vale é o
 * servidor (a pergunta aberta no registro dele), não o aviso.
 */
const chaveVisto = (id) => `irmao-visto-${id}`;

function jaViu(id) {
  try {
    return localStorage.getItem(chaveVisto(id)) === '1';
  } catch {
    return false;
  }
}

/** O primeiro nome, curto: o aviso é a única fonte, e ela não precisa de mais. */
function nomeDaPergunta(aviso) {
  const nome = String(aviso?.primeiroNome || '').trim().split(/\s+/)[0] || '';
  return nome.slice(0, 30) || 'Uma criança';
}

function PerguntaDoIrmao({ aviso }) {
  const { setActiveChildId, refreshProfile } = useAuth();
  const [respondendo, setRespondendo] = useState(null);
  const [respondida, setRespondida] = useState(false);
  const nome = nomeDaPergunta(aviso);

  if (respondida) return null;

  const responder = async (resposta) => {
    setRespondendo(resposta);
    try {
      await responderIrmao(aviso.childId, resposta);
      setRespondida(true);
      if (resposta === 'sim') {
        await refreshProfile();
        setActiveChildId(aviso.childId);
        toast.success(`${nome} está no seu app.`);
      } else {
        toast.success('Pronto. O motorista foi avisado para conferir o número.');
      }
    } catch (err) {
      toast.error(err.message || 'Não deu pra responder agora.');
    } finally {
      setRespondendo(null);
    }
  };

  return (
    <div className="rounded-2xl border border-primaryBorder bg-primarySoft p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
          <HelpCircle size={19} />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-text">{nome} é seu filho?</p>
          <p className="mt-0.5 text-sm text-textMuted">
            O motorista cadastrou {nome} com o seu WhatsApp. Se for, {nome}{' '}
            aparece no seu app.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="md" loading={respondendo === 'sim'} disabled={!!respondendo} onClick={() => responder('sim')}>
          Sim, é meu filho
        </Button>
        <Button
          size="md"
          variant="secondary"
          loading={respondendo === 'nao'}
          disabled={!!respondendo}
          onClick={() => responder('nao')}
        >
          Não é meu filho
        </Button>
      </div>
    </div>
  );
}

export default function AvisoDeIrmao() {
  const { childIds, setActiveChildId, refreshProfile } = useAuth();
  const { notifications } = useNotificacoesDaSessao();
  const [novos, setNovos] = useState([]);
  const [desfazendo, setDesfazendo] = useState(null);
  // A pergunta mais recente ainda sem resposta (uma de cada vez).
  const pergunta = notifications.find(
    (n) => n.type === 'irmao_pergunta' && !n.respondida && n.childId && !(childIds || []).includes(n.childId)
  );

  useEffect(() => {
    if (!childIds?.length) return undefined;
    let vivo = true;
    Promise.all(childIds.map((id) => getChild(id).catch(() => null))).then((lista) => {
      if (!vivo) return;
      setNovos(lista.filter((c) => c && c.vinculadoPor === 'irmao' && !jaViu(c.id)));
    });
    return () => {
      vivo = false;
    };
  }, [childIds]);

  if (pergunta) return <PerguntaDoIrmao key={pergunta.id} aviso={pergunta} />;
  if (!novos.length) return null;
  const crianca = novos[0];
  const nome = String(crianca.name || '').trim().split(/\s+/)[0] || 'A criança';

  const tirar = () => setNovos((l) => l.filter((c) => c.id !== crianca.id));

  const ver = () => {
    try {
      localStorage.setItem(chaveVisto(crianca.id), '1');
    } catch {
      // sem storage o cartão volta na próxima abertura, e tudo bem
    }
    setActiveChildId(crianca.id);
    tirar();
  };

  const naoEMeu = async () => {
    setDesfazendo(crianca.id);
    try {
      await recusarIrmao(crianca.id);
      await refreshProfile();
      toast.success(`${nome} saiu do seu app. O motorista foi avisado.`);
      tirar();
    } catch (err) {
      toast.error(err.message || 'Não deu pra desfazer agora.');
    } finally {
      setDesfazendo(null);
    }
  };

  return (
    <div className="rounded-2xl border border-primaryBorder bg-primarySoft p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
          <UserPlus size={19} />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-text">{nome} foi adicionado ao seu app</p>
          <p className="mt-0.5 text-sm text-textMuted">
            O motorista cadastrou com o seu WhatsApp.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="md" onClick={ver}>
          Ver {nome}
        </Button>
        <Button
          size="md"
          variant="secondary"
          loading={desfazendo === crianca.id}
          onClick={naoEMeu}
        >
          Não é meu filho
        </Button>
      </div>
    </div>
  );
}
