import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { getChild } from '../../services/childrenService';
import { recusarIrmao } from '../../services/authService';

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
 */
const chaveVisto = (id) => `irmao-visto-${id}`;

function jaViu(id) {
  try {
    return localStorage.getItem(chaveVisto(id)) === '1';
  } catch {
    return false;
  }
}

export default function AvisoDeIrmao() {
  const { childIds, setActiveChildId, refreshProfile } = useAuth();
  const [novos, setNovos] = useState([]);
  const [desfazendo, setDesfazendo] = useState(null);

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
