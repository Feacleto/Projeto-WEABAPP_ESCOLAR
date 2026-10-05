import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, FileUp, Sticker } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import ConviteParaIndicar from '../../components/tio/ConviteParaIndicar';
import AdesivoDaPerua from '../../components/selo/AdesivoDaPerua';
import { useNivel } from '../../hooks/useNivel';
import { STORAGE_ENABLED } from '../../config/capabilities';
import {
  enviarAlvara,
  pedirAdesivo,
  watchPedidoAdesivo,
} from '../../services/seloService';
import {
  ESTADO as ADESIVO,
  CAMPOS,
  FRASES,
  FRASE_PADRAO,
  podePedir,
  situacaoDoPedido,
  validarEndereco,
} from '../../dominio/associacao/adesivo.js';
import {
  ESTADO as VERIF,
  TEXTO as TEXTO_SELO,
  diasParaVencer,
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
 * ── ⚠️ O `profile` NÃO É UM STREAM, E ISSO JÁ FOI UM BUG AQUI
 * `AuthContext` lê `users/{uid}` uma vez, no login — não há `onSnapshot`. Sem
 * `updateProfile`, o motorista enviava o alvará, via o toast de sucesso e a
 * tela continuava dizendo "Enviar meu alvará": ele mandava de novo, e de novo.
 *
 * `updateProfile` existe exatamente para isto — atualizar o estado local
 * quando já se sabe o que mudou no banco, sem refetch.
 *
 * ── E O VENCIMENTO É DITO, NÃO SILENCIADO
 * `estadoDaVerificacao` faz o selo cair sozinho no dia seguinte ao vencimento,
 * e isso é certo. Mas o campo `verificacao` continua dizendo `verificada`:
 * quem só olhasse o estado derivado mostraria a tela de primeiro envio a quem
 * teve o selo por dois anos, sem uma palavra sobre por que ele sumiu.
 *
 * ── SEM STORAGE, O CERTIFICADO SOME EM VEZ DE FALHAR
 * Mesma regra do comprovante e da foto da criança (`config/capabilities.js`):
 * botão que aparece e devolve erro de rede é pior que botão que não aparece.
 *
 * ── O VOLTAR É O DO `Header` (03/10/2026)
 * Era um "Voltar" de 12px com `navigate(-1)` puro: quem chegava pelo aviso de
 * alvará vencendo (sem história na aba) tocava e saía do app. O `Header` cai
 * no Início quando não há para onde voltar — é de lá, pelo "Meu transporte",
 * que se chega aqui. O corpo, que era quase todo 12px, foi para 16px.
 */
export default function TioSelo() {
  const { user, profile } = useAuth();

  return (
    <div className="min-h-screen bg-bg pb-16">
      <Header title="Seu selo na van" showBack backLabel="Início" backTo="/tio" />

      <main className="mx-auto w-full max-w-lg space-y-4 px-5 py-5">
        <p className="text-base leading-relaxed text-textMuted">
          Duas coisas diferentes: um adesivo com a sua marca, que chega na
          Platina, e um certificado do alvará.
        </p>
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
  const [frase, setFrase] = useState(FRASE_PADRAO);
  const [salvando, setSalvando] = useState(false);
  // O documento de nível que o menu do perfil já lê: o marco `platinaEm`
  // decide se o adesivo pode ser pedido (o prêmio não oscila com a Platina).
  const { dados: nivel, carregando } = useNivel(uid);

  useEffect(() => {
    if (!uid) return undefined;
    return watchPedidoAdesivo(uid, setPedido, () => setPedido(null));
  }, [uid]);

  const { ok } = validarEndereco(form);
  const situacao = situacaoDoPedido(pedido, new Date());
  const jaPediu = pedido && pedido.estado !== ADESIVO.NAO_PEDIDO;
  const liberado = podePedir({ uid, ...profile }, nivel);
  // Depois de pedido, o desenho é o que FOI pedido (a foto da marca no
  // instante do pedido), e não o perfil de hoje.
  const desenho = jaPediu
    ? {
        marcaNome: pedido.marca?.nome || profile?.marcaNome,
        logoURL: pedido.marca?.logoURL,
        cor: pedido.marca?.cor,
        frase: pedido.frase || FRASE_PADRAO,
      }
    : {
        marcaNome: profile?.marcaNome || profile?.name,
        logoURL: profile?.marcaLogoURL,
        cor: profile?.marcaCor,
        frase,
      };

  const enviar = async () => {
    setSalvando(true);
    try {
      await pedirAdesivo({ uid, ...profile }, form, { frase, nivel });
      toast.success('Pedido registrado. Vamos postar em breve.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra pedir.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="inline-flex items-center gap-2 text-lg font-bold text-text">
        <Sticker size={20} aria-hidden="true" />
        Adesivo da sua perua
      </h2>

      {/* O QUE VAI IMPRESSO, ANTES DE ELE PEDIR: a marca dele em destaque e
        * o Alô Buzinou na faixa. Não dá para voltar atrás depois de impresso. */}
      <AdesivoDaPerua {...desenho} className="mx-auto mt-3 block w-full max-w-[240px]" />

      {pedido === undefined || carregando ? null : jaPediu ? (
        <>
          <p className="mt-3 rounded-xl bg-primarySoft p-3 text-base font-bold text-primary">
            {situacao.texto}
          </p>
          {/* ⚠️ O CONVITE A INDICAR MORA AQUI PORQUE É O MESMO GESTO: quem cola
            * a marca na traseira fala com quem anda atrás dele, e quem anda
            * atrás dele, no portão da escola, é outro motorista. */}
          <ConviteParaIndicar
            className="mt-3"
            titulo="O adesivo fala com quem vem atrás. Você também pode"
          />
        </>
      ) : !liberado ? (
        // PRÊMIO DA 1ª PLATINA (04/10/2026). Antes dela, a tela mostra o que
        // ele vai ganhar e onde ver o caminho, nunca um botão que falha.
        <div className="mt-3 space-y-3">
          <p className="text-base leading-relaxed text-text">
            O adesivo é presente nosso quando você chega à <b>Platina</b>, com
            frete por nossa conta.
          </p>
          <Link
            to="/tio/nivel"
            className="flex h-12 w-full items-center justify-center rounded-xl border-2 border-primary text-base font-bold text-primary"
          >
            Ver o caminho até a Platina
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-base leading-relaxed text-textMuted">
            Você chegou à Platina: o adesivo é presente nosso, com frete por
            nossa conta.
          </p>
          {/* A FRASE É DELE, de uma lista fechada (as rules repetem a lista).
            * O pedido guarda a escolhida, e o dono vê qual sai mais. */}
          <p className="text-base font-semibold text-text">O que vai escrito na faixa</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Frase do adesivo">
            {FRASES.map((opcao) => (
              <button
                key={opcao}
                type="button"
                role="radio"
                aria-checked={frase === opcao}
                onClick={() => setFrase(opcao)}
                className={`min-h-12 rounded-xl border-2 px-2 text-base font-bold ${
                  frase === opcao
                    ? 'border-primary bg-primarySoft text-primary'
                    : 'border-border bg-surface text-text'
                }`}
              >
                {opcao}
              </button>
            ))}
          </div>
          <p className="pt-2 text-base font-semibold text-text">Para onde enviamos</p>
          {/* O ENDEREÇO FICA NUMA COLEÇÃO SÓ DO DONO. Ele não entra em `users`,
            * que as famílias dele leem, e a perua costuma sair da casa dele. */}
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
                <span className="mb-1 block text-sm text-textMuted">
                  {rotulo}
                  {CAMPOS.includes(campo) ? '' : ' (opcional)'}
                </span>
                <input
                  value={form[campo] || ''}
                  onChange={(e) => setForm((v) => ({ ...v, [campo]: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-border bg-surface px-3 text-base text-text"
                />
              </label>
            ))}
          </div>
          <p className="text-sm text-textMuted">
            Só nós vemos este endereço. Ele não aparece para as famílias.
          </p>
          <Button onClick={enviar} disabled={!ok || salvando}>
            {salvando ? 'Pedindo…' : 'Pedir meu adesivo'}
          </Button>
        </div>
      )}
    </section>
  );
}

/* ─────────────── o certificado ─────────────── */

function Certificado({ uid, profile }) {
  const { updateProfile } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const estado = estadoDaVerificacao(profile, new Date());

  // O selo caiu porque o alvará venceu — e não porque ele nunca enviou. O
  // estado derivado é o mesmo (`nao_iniciada`); o que os separa é o campo.
  const venceu =
    profile?.verificacao === VERIF.VERIFICADA && estado !== VERIF.VERIFICADA;
  const diasVencido = venceu ? Math.abs(diasParaVencer(profile, new Date()) || 0) : 0;

  const escolher = async (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);
    try {
      await enviarAlvara(uid, arquivo);
      // ⚠️ SEM ISTO A TELA NÃO MUDA. `profile` é lido uma vez no login, não é
      // stream — ele veria o toast de sucesso e o mesmo botão de enviar.
      updateProfile({ verificacao: VERIF.ENVIADA, alvaraEnviadoEm: new Date() });
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
      <h2 className="inline-flex items-center gap-2 text-lg font-bold text-text">
        <BadgeCheck size={20} aria-hidden="true" />
        Certificado de alvará
      </h2>

      {estado === VERIF.VERIFICADA ? (
        <div className="mt-3 rounded-xl border border-primary bg-primarySoft p-3">
          <p className="text-base font-bold text-primary">{TEXTO_SELO.familia}</p>
          <p className="mt-0.5 text-sm text-primary">
            Conferido em {mesAno(profile?.verificadoEm) || '—'}. As famílias que
            recebem seu convite veem isto.
          </p>
        </div>
      ) : estado === VERIF.ENVIADA ? (
        <p className="mt-3 rounded-xl bg-warningSoft p-3 text-base font-bold text-warningText">
          Recebemos seu alvará. Vamos conferir e te avisar.
        </p>
      ) : (
        <>
          {/* O VENCIMENTO, DITO. Sem esta linha ele veria a tela de primeiro
            * envio depois de dois anos com o selo, sem uma palavra sobre por
            * que ele sumiu — e concluiria que o app perdeu o documento dele. */}
          {venceu && (
            <p className="mt-3 rounded-xl border border-warningBorder bg-warningSoft p-3 text-base leading-relaxed text-warningText">
              <strong>Seu alvará venceu</strong>
              {diasVencido > 0 ? ` há ${diasVencido} ${diasVencido === 1 ? 'dia' : 'dias'}` : ''}, e
              o selo saiu do ar. Envie o renovado para ele voltar.
            </p>
          )}

          {/* A RECUSA VOLTA COM O MOTIVO. Sem ele, ele reenvia o mesmo
            * documento e os dois perdem a viagem. */}
          {profile?.verificacao === VERIF.RECUSADA && profile?.alvaraMotivoRecusa && (
            <p className="mt-3 rounded-xl border border-dangerBorder bg-dangerSoft p-3 text-base leading-relaxed text-dangerText">
              <strong>Precisamos de outro envio:</strong> {profile.alvaraMotivoRecusa}
            </p>
          )}

          <p className="mt-3 text-base leading-relaxed text-textMuted">
            Envie o seu <strong>alvará municipal de transporte escolar</strong>.
            A gente confere e as famílias que recebem seu convite passam a ver
            que ele está em dia, com o mês da conferência.
          </p>
          {/* ⚠️ POR QUE ALVARÁ E NÃO CNH, dito para ele. Ele vai perguntar, e a
            * resposta o favorece: é menos documento pessoal na mão de terceiro. */}
          <p className="mt-2 text-base leading-relaxed text-textMuted">
            Só o alvará — não pedimos CNH nem documento pessoal. Para emitir o
            alvará a prefeitura já conferiu tudo isso, e quanto menos documento
            seu ficar guardado por aí, melhor para você.
          </p>

          <label className="tap mt-4 flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-marca text-base font-bold text-naMarca">
            <FileUp size={18} aria-hidden="true" />
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
