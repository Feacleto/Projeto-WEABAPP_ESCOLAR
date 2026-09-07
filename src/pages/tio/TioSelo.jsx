import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, FileUp, Sticker } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { STORAGE_ENABLED } from '../../config/capabilities';
import {
  enviarAlvara,
  pedirAdesivo,
  watchPedidoAdesivo,
} from '../../services/seloService';
import {
  ESTADO as ADESIVO,
  CAMPOS,
  TEXTO as TEXTO_ADESIVO,
  situacaoDoPedido,
  validarEndereco,
} from '../../dominio/associacao/adesivo.js';
import {
  ESTADO as VERIF,
  TEXTO as TEXTO_SELO,
  estadoDaVerificacao,
  mesAno,
} from '../../dominio/identidade/verificacao.js';

/**
 * OS DOIS SELOS, DO LADO DO MOTORISTA — /tio/selo
 *
 * ── ELES SÃO OPOSTOS, E A TELA PRECISA DIZER ISSO
 * O adesivo se ganha PEDINDO; o certificado se ganha CONQUISTANDO. Tratá-los
 * como um só foi o que confundiu a conversa inicial do produto, e uma tela que
 * os empilhasse sem distinguir repetiria o erro para o motorista.
 *
 * Por isso são dois cartões com pesos diferentes: o adesivo é um formulário
 * curto e um botão; o certificado exige um documento e uma espera.
 *
 * ── VALOR NÃO VEM DE PREÇO, VEM DE EXIGÊNCIA
 * Se o certificado fosse pago, ele pareceria abusivo. Se fosse automático, não
 * valeria nada. Conquistado resolve os dois — e é por isso que a tela não
 * esconde que alguém vai conferir e pode recusar.
 *
 * ── A RECUSA VOLTA COM MOTIVO
 * Sem o motivo na tela, ele reenvia o mesmo documento e os dois perdem a
 * viagem. O texto vem de `alvaraMotivoRecusa`, escrito pelo dono.
 *
 * ── SEM STORAGE, O CERTIFICADO SOME EM VEZ DE FALHAR
 * Mesma regra do comprovante e da foto da criança (`config/capabilities.js`):
 * botão que aparece e devolve erro de rede é pior que botão que não aparece.
 */
export default function TioSelo() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg pb-16">
      <header className="border-b border-border bg-card px-5 py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="tap -ml-1 inline-flex items-center gap-1 p-1 text-xs text-textMuted"
        >
          <ArrowLeft size={14} /> Voltar
        </button>
        <h1 className="mt-2 text-lg font-extrabold tracking-tight text-text">
          Seu selo na van
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-textMuted">
          Duas coisas diferentes: um adesivo que você pede, e um certificado que
          você conquista.
        </p>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-4 px-5 py-5">
        <Adesivo uid={user?.uid} profile={profile} />
        {STORAGE_ENABLED && <Certificado uid={user?.uid} profile={profile} />}
      </main>
    </div>
  );
}

/* ─────────────── o adesivo ─────────────── */

function Adesivo({ uid, profile }) {
  const [pedido, setPedido] = useState(undefined);
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    return watchPedidoAdesivo(uid, setPedido, () => setPedido(null));
  }, [uid]);

  const { ok } = validarEndereco(form);
  const situacao = situacaoDoPedido(pedido, new Date());
  const jaPediu = pedido && pedido.estado !== ADESIVO.NAO_PEDIDO;

  const enviar = async () => {
    setSalvando(true);
    try {
      await pedirAdesivo({ uid, ...profile }, form);
      toast.success('Pedido registrado. Vamos postar em breve.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra pedir.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold text-text">
        <Sticker size={15} />
        Adesivo para a traseira
      </h2>

      {/* O QUE VAI ESCRITO, ANTES DE ELE PEDIR. Ele vai colar isso no veículo
        * dele — e não dá para voltar atrás depois de impresso. */}
      <div className="mt-3 rounded-xl border border-dashed border-border bg-surface p-3 text-center">
        <p className="text-xs font-bold text-text">{TEXTO_ADESIVO.linha1}</p>
        <p className="mt-0.5 text-[11px] text-textMuted">{TEXTO_ADESIVO.linha2}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-primary">
          {TEXTO_ADESIVO.site}
        </p>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-textMuted">
        É por nossa conta — inclusive o frete. Ele fala com quem anda atrás de
        você e ainda não sabe que a família pode acompanhar a rota.
      </p>

      {pedido === undefined ? null : jaPediu ? (
        <p className="mt-3 rounded-xl bg-primarySoft p-3 text-xs font-bold text-primary">
          {situacao.texto}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
            Para onde enviamos
          </p>
          {/* O ENDEREÇO FICA NUMA COLEÇÃO SÓ DO DONO. Ele não entra em `users`,
            * que as famílias dele leem — e a perua costuma sair da casa dele. */}
          <div className="grid grid-cols-2 gap-2">
            {[
              ['cep', 'CEP'],
              ['numero', 'Número'],
              ['logradouro', 'Rua'],
              ['complemento', 'Complemento'],
              ['bairro', 'Bairro'],
              ['cidade', 'Cidade'],
              ['uf', 'UF'],
            ].map(([campo, rotulo]) => (
              <label
                key={campo}
                className={campo === 'logradouro' ? 'col-span-2 block' : 'block'}
              >
                <span className="mb-1 block text-[11px] text-textMuted">
                  {rotulo}
                  {CAMPOS.includes(campo) ? '' : ' (opcional)'}
                </span>
                <input
                  value={form[campo] || ''}
                  onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-xs text-text"
                />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-textMuted">
            Só nós vemos este endereço. Ele não aparece para as famílias.
          </p>
          <button
            type="button"
            onClick={enviar}
            disabled={!ok || salvando}
            className="tap h-11 w-full rounded-xl bg-primary text-xs font-bold text-white disabled:opacity-40"
          >
            {salvando ? 'Pedindo…' : 'Pedir meu adesivo'}
          </button>
        </div>
      )}
    </section>
  );
}

/* ─────────────── o certificado ─────────────── */

function Certificado({ uid, profile }) {
  const [enviando, setEnviando] = useState(false);
  const estado = estadoDaVerificacao(profile, new Date());

  const escolher = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);
    try {
      await enviarAlvara(uid, arquivo);
      toast.success('Alvará enviado. Vamos conferir e te avisar.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra enviar.');
    } finally {
      setEnviando(false);
      e.target.value = '';
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-extrabold text-text">
        <BadgeCheck size={15} />
        Certificado de alvará
      </h2>

      {estado === VERIF.VERIFICADA ? (
        <div className="mt-3 rounded-xl border border-primary bg-primarySoft p-3">
          <p className="text-xs font-bold text-primary">{TEXTO_SELO.familia}</p>
          <p className="mt-0.5 text-[11px] text-primary/80">
            Conferido em {mesAno(profile?.verificadoEm) || '—'}. As famílias que
            recebem seu convite veem isto.
          </p>
        </div>
      ) : estado === VERIF.ENVIADA ? (
        <p className="mt-3 rounded-xl bg-warningSoft p-3 text-xs font-bold text-warningText">
          Recebemos seu alvará. Vamos conferir e te avisar.
        </p>
      ) : (
        <>
          {/* A RECUSA VOLTA COM O MOTIVO. Sem ele, ele reenvia o mesmo
            * documento e os dois perdem a viagem. */}
          {profile?.verificacao === VERIF.RECUSADA && profile?.alvaraMotivoRecusa && (
            <p className="mt-3 rounded-xl border border-dangerBorder bg-dangerSoft p-3 text-xs leading-relaxed text-dangerText">
              <strong>Precisamos de outro envio:</strong> {profile.alvaraMotivoRecusa}
            </p>
          )}

          <p className="mt-3 text-xs leading-relaxed text-textMuted">
            Envie o seu <strong>alvará municipal de transporte escolar</strong>.
            A gente confere e as famílias que recebem seu convite passam a ver
            que ele está em dia, com o mês da conferência.
          </p>
          {/* ⚠️ POR QUE ALVARÁ E NÃO CNH, dito para ele. Ele vai perguntar, e a
            * resposta o favorece: é menos documento pessoal na mão de terceiro. */}
          <p className="mt-2 text-[11px] leading-relaxed text-textMuted">
            Só o alvará — não pedimos CNH nem documento pessoal. Para emitir o
            alvará a prefeitura já conferiu tudo isso, e quanto menos documento
            seu ficar guardado por aí, melhor para você.
          </p>

          <label className="tap mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-white">
            <FileUp size={14} />
            {enviando ? 'Enviando…' : 'Enviar meu alvará'}
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={escolher}
              disabled={enviando}
              className="hidden"
            />
          </label>
        </>
      )}
    </section>
  );
}
