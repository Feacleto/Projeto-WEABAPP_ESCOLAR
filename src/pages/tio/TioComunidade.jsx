import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { School, Send, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { useMinhasFotos } from '../../hooks/useFotosDaTurma';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import PublicarFoto from '../../components/comunidade/PublicarFoto';
import NotaDasFamilias from '../../components/comunidade/NotaDasFamilias';
import IndicarParceiro from '../../components/comunidade/IndicarParceiro';
import FotoNaLista from '../../components/comunidade/FotoNaLista';
import PedidosParaVoce from '../../components/transferencia/PedidosParaVoce';
import { fotosDaComunidade, meusParceiros, pedirSimDaFoto } from '../../services/comunidadeService';
import { STORAGE_ENABLED } from '../../config/capabilities';
import {
  PUBLICO,
  quemFaltaResponder,
  rotuloDoParceiro,
  semContaParaPerguntar,
} from '../../dominio/identidade/comunidade.js';

/**
 * A COMUNIDADE DO TIO — /tio/comunidade (05/10/2026, etapa 1, aprovada pelo
 * dono).
 *
 * Mora FORA da Central de propósito: fora da rota a Central pede a senha do
 * Financeiro, e quem tira a foto da turma é a auxiliar, que não tem a senha.
 *
 * Duas abas, como ESTADO (uma tela só):
 * - "Minhas famílias": a foto da turma na época festiva, só com o "sim" de
 *   cada família marcada, e as fotos que ainda valem (com "Apagar").
 * - "Tios parceiros": quem ele indicou e quem o indicou (a indicação é o que
 *   cria a amizade), e os posts deles — sempre sem criança.
 *
 * ETAPA 2 (05/10/2026): a NOTA DAS FAMÍLIAS no topo de "Minhas famílias"
 * (só a média do semestre fechado) e o "Indicar para uma família" em cada
 * parceiro — indicação que a família aceita, nunca transferência.
 *
 * FASE 1 DA REDE (05/10/2026): as escolas de cada parceiro, o aviso ao
 * parceiro indicado e o "Perguntar às famílias" do sim da foto.
 *
 * F1.5 (05/10/2026): a AUXILIAR também posta para as famílias, em nome dele
 * (pelo app dela, em /aux/foto). A foto aparece aqui como dele, com
 * "Postada pela Cida", e ele pode apagá-la.
 */
export default function TioComunidade() {
  const { user } = useAuth();
  const location = useLocation();
  // Quem volta dos planos para aceitar uma família (F2.4) cai direto na aba
  // em que o pedido mora.
  const [aba, setAba] = useState(location.state?.pedidoAberto ? PUBLICO.PARCEIROS : PUBLICO.FAMILIAS);

  return (
    <div className="min-h-screen bg-bg pb-16">
      <Header title="Comunidade" showBack backLabel="Início" backTo="/tio" />
      <main className="mx-auto w-full max-w-lg space-y-4 px-5 py-5">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-card p-1" role="tablist">
          {[
            [PUBLICO.FAMILIAS, 'Minhas famílias'],
            [PUBLICO.PARCEIROS, 'Tios parceiros'],
          ].map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={aba === chave}
              onClick={() => setAba(chave)}
              className={`min-h-12 rounded-xl text-base font-bold ${
                aba === chave ? 'bg-primary text-white' : 'text-text'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {aba === PUBLICO.FAMILIAS ? <MinhasFamilias uid={user?.uid} /> : <Parceiros uid={user?.uid} />}
      </main>
    </div>
  );
}

function MinhasFamilias({ uid }) {
  const { children } = useChildren();
  const fotos = useMinhasFotos(uid);
  const [postando, setPostando] = useState(false);
  const minhas = (fotos || []).filter((f) => f.publico === PUBLICO.FAMILIAS);

  return (
    <>
      <NotaDasFamilias />
      <PerguntarAsFamilias turma={children} />
      <p className="text-base leading-relaxed text-textMuted">
        A foto da turma numa data especial. As famílias veem no app por 30 dias,
        e depois ela some.
      </p>
      {!STORAGE_ENABLED ? null : postando ? (
        <PublicarFoto uid={uid} publico={PUBLICO.FAMILIAS} turma={children} onPronto={() => setPostando(false)} />
      ) : (
        <Button onClick={() => setPostando(true)}>Postar foto da turma</Button>
      )}
      <ListaDeFotos fotos={minhas} vazio="Nenhuma foto no ar agora." />
    </>
  );
}

/**
 * A ABA DOS PARCEIROS. Desde 05/10/2026 o tio posta aqui PARA A COMUNIDADE:
 * os tios parceiros e as famílias deles veem, e a foto pode ter criança com
 * o "sim" da comunidade. As fotos chegam pela callable (link de 15 minutos);
 * os posts antigos "só para os parceiros" continuam aparecendo até vencer.
 */
function Parceiros({ uid }) {
  const { children } = useChildren();
  const [dados, setDados] = useState(null);
  const [comunidade, setComunidade] = useState([]);
  const [erro, setErro] = useState(null);
  const [postando, setPostando] = useState(false);
  const [versao, setVersao] = useState(0);
  const fotos = useMinhasFotos(uid);
  const minhas = (fotos || []).filter((f) => f.publico === PUBLICO.PARCEIROS);

  useEffect(() => {
    let vivo = true;
    meusParceiros()
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, []);
  useEffect(() => {
    let vivo = true;
    fotosDaComunidade()
      .then((lista) => vivo && setComunidade(lista))
      .catch(() => vivo && setComunidade([]));
    return () => {
      vivo = false;
    };
  }, [versao]);

  if (erro) return <p className="rounded-2xl bg-card p-4 text-base text-textMuted">{erro}</p>;
  if (!dados) return <p className="text-base text-textMuted">Carregando…</p>;

  const marcaDe = Object.fromEntries(dados.parceiros.map((p) => [p.uid, p.marca]));
  return (
    <>
      {/* As famílias que um parceiro quer passar para ele (fase 2). */}
      <PedidosParaVoce />
      <p className="text-base leading-relaxed text-textMuted">
        Os tios que você indicou e os que indicaram você. A foto para a
        comunidade aparece para eles e para as famílias deles.
      </p>
      {!dados.parceiros.length ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center">
          <Users size={28} className="mx-auto text-primary" aria-hidden="true" />
          <p className="mt-2 text-base text-text">
            Seus parceiros aparecem aqui quando um colega que você indicou criar a conta.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {dados.parceiros.map((p) => (
            <li key={p.uid} className="rounded-2xl bg-card p-3">
              <div className="flex items-center gap-3">
              {p.logoURL ? (
                <img src={p.logoURL} alt="" className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primarySoft text-base font-bold text-primary">
                  {String(p.marca || '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-base font-bold text-text">{p.marca}</span>
                <span className="block truncate text-sm text-textMuted">
                  {rotuloDoParceiro(p.papel)}
                  {p.lugar ? ` · ${p.lugar}` : ''}
                </span>
              </span>
              </div>
              {p.escolas?.length > 0 && (
                <p className="mt-2 flex items-start gap-2 text-base text-text">
                  <School size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{p.escolas.join(' · ')}</span>
                </p>
              )}
              <IndicarParceiro parceiro={p} />
            </li>
          ))}
        </ul>
      )}
      {STORAGE_ENABLED && dados.parceiros.length > 0 && (postando ? (
        <PublicarFoto
          uid={uid}
          publico={PUBLICO.COMUNIDADE}
          turma={children}
          onPronto={() => {
            setPostando(false);
            setVersao((v) => v + 1);
          }}
        />
      ) : (
        <Button variant="secondary" onClick={() => setPostando(true)}>Postar para a comunidade</Button>
      ))}
      {comunidade.length > 0 && (
        <ul className="space-y-3">
          {comunidade.map((f) => (
            <FotoNaLista
              key={f.id}
              foto={{ ...f, autor: f.minha ? null : f.marca }}
              podeApagar={f.minha}
              onApagada={() => setVersao((v) => v + 1)}
            />
          ))}
        </ul>
      )}
      <ListaDeFotos
        fotos={dados.fotos.map((f) => ({ ...f, autor: marcaDe[f.adminUid] }))}
        vazio={dados.parceiros.length && !comunidade.length ? 'Nenhum parceiro postou nada agora.' : null}
      />
      {minhas.length > 0 && (
        <>
          <p className="pt-2 text-base font-semibold text-text">As suas, para os parceiros</p>
          <ListaDeFotos fotos={minhas} />
        </>
      )}
    </>
  );
}

/**
 * "Perguntar às famílias": quem ainda não respondeu se o filho pode
 * aparecer na foto recebe um aviso que leva ao Início dela. Some quando
 * todas responderam. Quem não tem conta no app não recebe — a linha diz
 * quantas são, para o tio perguntar no portão.
 */
function PerguntarAsFamilias({ turma }) {
  const { profile } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  const faltam = quemFaltaResponder(turma || []);
  const semConta = semContaParaPerguntar(turma || []).length;
  if (!faltam.length && !semConta) return null;

  const perguntar = async () => {
    setEnviando(true);
    try {
      const novos = await pedirSimDaFoto(faltam, profile?.marcaNome || profile?.name);
      setFeito(true);
      toast.success(novos ? 'Pergunta enviada.' : 'Você já perguntou este mês.');
    } catch {
      toast.error('Não deu para enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="text-base font-bold text-text">
        {faltam.length === 1
          ? '1 família ainda não respondeu sobre a foto.'
          : faltam.length > 1
            ? `${faltam.length} famílias ainda não responderam sobre a foto.`
            : 'Todas as famílias com o app já responderam.'}
      </p>
      {semConta > 0 && (
        <p className="mt-1 text-base text-textMuted">
          {semConta === 1 ? '1 família ainda não entrou no app.' : `${semConta} famílias ainda não entraram no app.`}
        </p>
      )}
      {faltam.length > 0 && (
        <button
          type="button"
          onClick={perguntar}
          disabled={enviando || feito}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary text-base font-bold text-primary disabled:opacity-60"
        >
          <Send size={18} aria-hidden="true" />
          {feito ? 'Pergunta enviada' : 'Perguntar às famílias'}
        </button>
      )}
    </div>
  );
}

function ListaDeFotos({ fotos, vazio = null }) {
  if (!fotos.length) return vazio ? <p className="text-base text-textMuted">{vazio}</p> : null;
  return (
    <ul className="space-y-3">
      {fotos.map((f) => (
        // Só as do próprio tio vêm com `caminho` (as dos parceiros chegam
        // pela callable, sem ele): é o que decide se há "Apagar". A que a
        // auxiliar postou também é dele, e mostra "Postada pela Cida".
        <FotoNaLista key={f.id} foto={f} podeApagar={!!f.caminho} />
      ))}
    </ul>
  );
}
