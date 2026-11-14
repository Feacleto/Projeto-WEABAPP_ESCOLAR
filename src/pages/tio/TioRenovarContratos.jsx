import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, FileSignature } from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from '../../components/common/Avatar';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Skeleton from '../../components/common/Skeleton';
import Spinner from '../../components/common/Spinner';
import { useTurmaInteira } from '../../hooks/useTurmaInteira';
import { useAuth } from '../../hooks/useAuth';
import { renovarContrato } from '../../services/contratosDaFamiliaService';
import {
  filaDeRenovacao,
  primeiroMesSemParcela,
} from '../../dominio/cobranca/renovacaoDoContrato.js';
import {
  BOTAO_AGORA_NAO,
  BOTAO_MANDAR,
  COMO_FUNCIONA,
  DIFERENCA,
  ESPERANDO,
  NADA_PARA_RENOVAR,
  SEM_ACEITE,
  SEM_FAMILIA,
  TITULO,
  VER_CONTRATO,
  consequenciaDeMandar,
  perguntaDeMandar,
  nomeDaLinha,
  rotuloDoBotao,
  textoDoEnviado,
  textoDoFim,
  textoDoMesSemMensalidade,
} from '../../marca/textosDaRenovacao.js';

/**
 * RENOVAR CONTRATOS — /tio/finance/renovar (14/11/2026, tela N1b do protótipo
 * aprovado). Uma família por linha; o toque manda à família um contrato novo
 * com o prazo esticado, pelo MESMO caminho do aditivo (`renovarContrato` →
 * `salvarCombinado`). Ela assina no app dela; até lá, vale o contrato de
 * antes, e a vigência que a cobrança lê não muda.
 *
 * Quem entra, e a vigência que o contrato novo propõe, é régua pura:
 * `dominio/cobranca/renovacaoDoContrato.js`. Os textos moram em
 * `marca/textosDaRenovacao.js`.
 *
 * Um toque por família, nunca "renovar todos": cada toque é um contrato
 * novo no app de uma família, e ele precisa ver de quem é.
 */
export default function TioRenovarContratos() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { criancas, loading } = useTurmaInteira();
  const [enviando, setEnviando] = useState(null);
  // O AVISO À FAMÍLIA NÃO VOLTA: o toque na linha só abre a pergunta, e é o
  // "Mandar" dela que envia. A versão pendente pode ser retirada; o push não.
  const [confirmando, setConfirmando] = useState(null);

  const fila = useMemo(() => filaDeRenovacao(criancas, new Date()), [criancas]);

  const renovar = async (linha) => {
    setEnviando(linha.child.id);
    try {
      const r = await renovarContrato({ child: linha.child, admin: profile });
      if (r === 'aditivo') toast.success(textoDoEnviado(linha.child.name, linha.nova.fim));
      else toast('Nada mudou no contrato.');
    } catch (err) {
      console.error('renovarContrato', err?.code || err?.message);
      toast.error(
        err?.message?.startsWith('Complete') ? err.message : 'Não deu para enviar. Tente de novo.'
      );
    } finally {
      setEnviando(null);
      setConfirmando(null);
    }
  };

  // O mês que deixa de nascer: o da linha que acaba primeiro.
  const primeira = fila.renovar[0] || fila.esperando[0] || fila.semAceite[0];
  const mesSem = primeira
    ? primeiroMesSemParcela(primeira.child.vigenciaInicio, primeira.fimAtual, new Date())
    : null;

  return (
    <div className="min-h-[100dvh] bg-bg">
      <header
        className="bg-primary px-5 pb-6 text-white"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
      >
        <div className="mx-auto flex max-w-lg flex-col gap-1">
          <button
            type="button"
            onClick={() => navigate('/tio/finance/turma')}
            className="tap -ml-2 inline-flex min-h-12 items-center gap-1 self-start px-2 text-base font-semibold text-menta"
          >
            <ChevronLeft size={22} aria-hidden="true" />
            Voltar
          </button>
          <h1 className="font-display text-[28px] font-extrabold leading-tight">{TITULO}</h1>
        </div>
      </header>

      <main className="px-4 pb-28 pt-4">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          {loading ? (
            <Skeleton className="h-48 rounded-3xl" />
          ) : fila.total === 0 ? (
            <p className="rounded-2xl bg-card p-4 text-center text-base text-textMuted shadow-rest">
              {NADA_PARA_RENOVAR.texto}
            </p>
          ) : (
            <>
              <p className="text-base leading-relaxed text-textBody">
                {COMO_FUNCIONA.texto}
                {mesSem && <> {textoDoMesSemMensalidade(mesSem)}</>}
              </p>
              {(fila.esperando.length > 0 || fila.semAceite.length > 0) && (
                <p className="text-base leading-relaxed text-textBody">{DIFERENCA.texto}</p>
              )}

              {fila.renovar.map((linha) => (
                <Linha key={linha.child.id} child={linha.child} sub={textoDoFim(linha.fimAtual)}>
                  <button
                    type="button"
                    disabled={!!enviando}
                    onClick={() => setConfirmando(linha)}
                    className="tap inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card text-base font-bold text-primaryDark disabled:opacity-60"
                  >
                    {enviando === linha.child.id ? (
                      <Spinner size={18} />
                    ) : (
                      <FileSignature size={18} aria-hidden="true" />
                    )}
                    {rotuloDoBotao(linha.nova?.fim)}
                  </button>
                </Linha>
              ))}

              {fila.esperando.map((linha) => (
                <Linha
                  key={linha.child.id}
                  child={linha.child}
                  sub={`${textoDoFim(linha.fimAtual)} · ${ESPERANDO.texto}`}
                />
              ))}

              {fila.semAceite.map((linha) => (
                <Linha key={linha.child.id} child={linha.child} sub={SEM_ACEITE.texto}>
                  <button
                    type="button"
                    onClick={() => navigate(`/tio/children/${linha.child.id}/contract`)}
                    className="tap h-12 self-start px-1 text-base font-bold text-primary underline"
                  >
                    {VER_CONTRATO}
                  </button>
                </Linha>
              ))}
            </>
          )}

          {!loading && fila.semFamilia > 0 && (
            <p className="px-1 text-sm leading-relaxed text-textMuted">{SEM_FAMILIA.texto}</p>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={!!confirmando}
        title={confirmando ? perguntaDeMandar(confirmando.child.name) : ''}
        description={confirmando ? consequenciaDeMandar(confirmando.nova?.fim) : ''}
        confirmLabel={BOTAO_MANDAR}
        cancelLabel={BOTAO_AGORA_NAO}
        loading={!!enviando}
        onConfirm={() => renovar(confirmando)}
        onCancel={() => setConfirmando(null)}
      />
    </div>
  );
}

function Linha({ child, sub, children }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-3.5 shadow-rest">
      <div className="flex min-h-12 items-center gap-3">
        <Avatar photoURL={child.photoURL} gender={child.gender} seed={child.id} kind="child" size="md" />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-text">{nomeDaLinha(child.name)}</span>
          <span className="block text-base text-textMuted">{sub}</span>
        </span>
      </div>
      {children}
    </div>
  );
}
