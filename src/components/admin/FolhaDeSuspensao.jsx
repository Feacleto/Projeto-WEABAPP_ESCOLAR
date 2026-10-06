import { useMemo, useState } from 'react';
import { Ban, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { suspenderConta } from '../../services/registroDoDonoService';
import {
  ACAO,
  PAPEL,
  bloqueioVigente,
  DIAS_PARA_RESPONDER,
  GRAU,
  LIMITE_DA_EVIDENCIA,
  LIMITE_DA_MENSAGEM,
  mensagemPadrao,
  motivosPara,
  validarPedido,
} from '../../dominio/identidade/registroDoDono.js';

/**
 * A FOLHA DE SUSPENDER, AVISAR OU REATIVAR um motorista OU UMA FAMÍLIA
 * (painel do dono, 05/10/2026 — o desenho "Bloquear Tio Gil" do canvas,
 * aprovado; a família entrou na alternativa A do dono).
 *
 * `papel` escolhe a lista de motivos (uma não serve para a outra). Para a
 * família, a conta é desativada e ela não entra mais no app: depois de
 * suspender, a folha oferece "Mandar a mensagem por e-mail", que abre o
 * e-mail do DONO com o texto pronto.
 *
 * Tudo o que ela oferece sai da régua espelhada (`registroDoDono.js`): os
 * motivos são lista fechada, a mensagem já vem escrita e o prazo de resposta
 * é calculado. A tela valida com a MESMA função que o servidor usa, então o
 * botão não deixa mandar o que a callable recusaria.
 *
 * O texto padrão cita a cláusula 11b dos Termos de Uso ("Suspensão e
 * bloqueio"), escrita pela revisão jurídica.
 */
export default function FolhaDeSuspensao({
  motorista,
  papel = PAPEL.MOTORISTA,
  cobrancaLigada = false,
  onFechar,
  onFeito,
}) {
  const daFamilia = papel === PAPEL.FAMILIA;
  const suspenso = daFamilia ? bloqueioVigente(motorista?.bloqueio) : motorista?.suspenso === true;
  const [acao, setAcao] = useState(suspenso ? ACAO.REATIVAR : ACAO.SUSPENDER);
  const [motivo, setMotivo] = useState('');
  const [grau, setGrau] = useState(GRAU.SUSPENSAO);
  const [ate, setAte] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [mensagem, setMensagem] = useState(() =>
    mensagemPadrao({ acao: suspenso ? ACAO.REATIVAR : ACAO.SUSPENDER, grau: GRAU.SUSPENSAO, papel })
  );
  // Depois de suspender a família: o endereço dela, para abrir o e-mail.
  const [paraOEmail, setParaOEmail] = useState(null);
  const [evidencia, setEvidencia] = useState('');
  const [enviando, setEnviando] = useState(false);

  const motivos = motivosPara(acao, { cobrancaLigada, papel });
  const pedido = {
    acao,
    alvoUid: motorista?.uid,
    alvoPapel: papel,
    motivo,
    grau: acao === ACAO.SUSPENDER ? grau : null,
    ate: acao === ACAO.SUSPENDER && grau === GRAU.SUSPENSAO ? ate || null : null,
    urgente,
    mensagem,
    evidencia,
  };
  const validacao = useMemo(
    () => validarPedido(pedido, { cobrancaLigada, alvo: { role: daFamilia ? 'parent' : 'admin' } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [acao, motivo, grau, ate, urgente, mensagem, evidencia, cobrancaLigada]
  );

  const trocarAcao = (nova) => {
    setAcao(nova);
    setMotivo('');
    setMensagem(mensagemPadrao({ acao: nova, grau, ate: ate || null, papel }));
  };

  const enviar = async () => {
    if (!validacao.ok || enviando) return;
    setEnviando(true);
    try {
      const r = await suspenderConta(pedido);
      toast.success(
        acao === ACAO.REATIVAR ? 'Reativado e registrado.' : acao === ACAO.AVISO ? 'Aviso registrado.' : 'Suspenso e registrado.'
      );
      // A família não entra mais no app: a mensagem vai por e-mail.
      if (daFamilia && acao !== ACAO.REATIVAR && r?.email) {
        setParaOEmail(r.email);
        return;
      }
      onFeito?.();
    } catch (err) {
      toast.error(err?.message || 'Não deu pra registrar. Nada foi mudado.');
    } finally {
      setEnviando(false);
    }
  };

  const nome = motorista?.marcaNome || motorista?.name || motorista?.uid;
  const titulo = acao === ACAO.REATIVAR ? `Reativar ${nome}` : acao === ACAO.AVISO ? `Avisar ${nome}` : `Suspender ${nome}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="folha-suspensao"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="folha-suspensao" className="inline-flex items-center gap-1.5 text-sm font-extrabold text-text">
            <Ban size={15} /> {titulo}
          </h3>
          <button type="button" onClick={onFechar} className="tap -mr-1 -mt-1 p-1 text-textMuted" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {!suspenso && (
          <div className="mt-3 flex gap-1 rounded-xl bg-neutro p-1" role="group" aria-label="O que fazer">
            {[
              [ACAO.SUSPENDER, 'Suspender'],
              [ACAO.AVISO, 'Só avisar'],
            ].map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                onClick={() => trocarAcao(id)}
                aria-pressed={acao === id}
                className={`tap min-h-[40px] flex-1 rounded-lg text-xs font-bold ${
                  acao === id ? 'bg-card text-text shadow-rest' : 'text-textMuted'
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        <fieldset className="mt-4">
          <legend className="text-xs font-bold text-text">Motivo</legend>
          <div className="mt-1.5 space-y-1">
            {motivos.map((m) => (
              <label key={m.id} className="flex min-h-[40px] items-center gap-2.5 text-xs text-text">
                <input
                  type="radio"
                  name="motivo"
                  checked={motivo === m.id}
                  onChange={() => setMotivo(m.id)}
                  className="h-4 w-4 accent-primary"
                />
                {m.rotulo}
              </label>
            ))}
          </div>
        </fieldset>

        {acao === ACAO.SUSPENDER && (
          <fieldset className="mt-4">
            <legend className="text-xs font-bold text-text">Até quando</legend>
            <label className="mt-1.5 flex min-h-[40px] flex-wrap items-center gap-2.5 text-xs text-text">
              <input
                type="radio"
                name="grau"
                checked={grau === GRAU.SUSPENSAO}
                onChange={() => setGrau(GRAU.SUSPENSAO)}
                className="h-4 w-4 accent-primary"
              />
              Suspender até
              <input
                type="date"
                value={ate}
                onChange={(e) => setAte(e.target.value)}
                aria-label="Data do fim da suspensão"
                className="min-h-[40px] rounded-lg border border-borderStrong px-2 text-xs"
              />
              <span className="text-textMuted">(vazio: até você reativar)</span>
            </label>
            <label className="flex min-h-[40px] items-center gap-2.5 text-xs text-text">
              <input
                type="radio"
                name="grau"
                checked={grau === GRAU.ENCERRAMENTO}
                onChange={() => setGrau(GRAU.ENCERRAMENTO)}
                className="h-4 w-4 accent-primary"
              />
              Encerrar a conta
            </label>
            <label className="mt-1 flex min-h-[40px] items-center gap-2.5 text-xs text-text">
              <input
                type="checkbox"
                checked={urgente}
                onChange={(e) => setUrgente(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              É urgente: risco à criança ou fraude em curso
            </label>
          </fieldset>
        )}

        <label className="mt-4 block">
          <span className="text-xs font-bold text-text">Mensagem para {nome}</span>
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={5}
            maxLength={LIMITE_DA_MENSAGEM}
            className="mt-1.5 w-full rounded-xl border border-borderStrong p-3 text-xs leading-relaxed"
          />
        </label>

        {acao !== ACAO.REATIVAR && (
          <label className="mt-4 block">
            <span className="text-xs font-bold text-text">Evidência (só você vê)</span>
            <textarea
              value={evidencia}
              onChange={(e) => setEvidencia(e.target.value)}
              rows={2}
              maxLength={LIMITE_DA_EVIDENCIA}
              className="mt-1.5 w-full rounded-xl border border-borderStrong p-3 text-xs leading-relaxed"
            />
          </label>
        )}

        <p className="mt-3 text-xs leading-relaxed text-textMuted">
          {acao === ACAO.REATIVAR
            ? 'A conta volta a funcionar na hora, e fica registrado quem reativou e por quê.'
            : daFamilia
              ? `A conta dela é desativada: ela não entra e não recebe os avisos. A criança continua na perua, e o tio de cada criança é avisado para combinar por telefone. Ela tem ${DIAS_PARA_RESPONDER} dias para responder por contato@alobuzinou.com. O motivo e a evidência ficam só no registro.`
              : `Ele recebe a mensagem e tem ${DIAS_PARA_RESPONDER} dias para responder por contato@alobuzinou.com. O motivo e a evidência ficam só no registro. As famílias dele continuam vendo os próprios dados.`}
        </p>

        {!validacao.ok && motivo && (
          <p className="mt-2 text-xs font-semibold text-dangerText">{validacao.erro}</p>
        )}

        {paraOEmail && (
          <div className="mt-4 rounded-xl border border-primaryBorder bg-primarySoft p-3">
            <p className="text-xs leading-relaxed text-text">
              Registrado. A família não entra mais no app: mande a mensagem por e-mail para{' '}
              <strong>{paraOEmail}</strong>.
            </p>
            <a
              href={`mailto:${paraOEmail}?subject=${encodeURIComponent('Alô Buzinou — sua conta')}&body=${encodeURIComponent(mensagem)}`}
              onClick={() => onFeito?.()}
              className="tap mt-2 inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 text-xs font-bold text-white"
            >
              Mandar a mensagem por e-mail
            </a>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="tap min-h-[44px] flex-1 rounded-xl border border-borderStrong text-xs font-bold text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={!validacao.ok || enviando}
            className={`tap min-h-[44px] flex-1 rounded-xl text-xs font-bold text-white disabled:opacity-50 ${
              acao === ACAO.REATIVAR ? 'bg-primary' : 'bg-danger'
            }`}
          >
            {enviando ? 'Registrando…' : acao === ACAO.REATIVAR ? 'Reativar' : acao === ACAO.AVISO ? 'Mandar aviso' : 'Suspender e avisar'}
          </button>
        </div>
      </div>
    </div>
  );
}
