import { useState } from 'react';
import {
  X,
  UserCheck,
  Phone,
  User as UserIcon,
  Plus,
  Heart,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Input from '../common/Input';
import Button from '../common/Button';
import { maskPhone, unmaskPhone, isValidPhone } from '../../compartilhado/masks';
import {
  lembrarAvulso,
  ultimoAvulso,
  esquecerAvulso,
  setDailyAltPickup,
  clearDailyAltPickup,
  notifyAltPickup,
} from '../../services/altPickupService';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';
import { gerarAcessoDoDia } from '../../services/acompanhamentoService';

/**
 * Sheet "Quem vai buscar hoje?" — pai indica quem pega a criança.
 *
 * Modos:
 *   - default: lista de pré-cadastrados + botão "Cadastrar outro" + opção "Sou eu"
 *   - new: form de cadastro novo (nome, telefone, parentesco)
 *   - manage: gerenciar a lista (remover entradas antigas)
 *
 * Ao selecionar um responsável, grava em `altPickups/{date}_{child}` e
 * notifica o Tio.
 */
/**
 * O botão que abre o WhatsApp com o link do dia.
 *
 * ⚠️ O TOKEN NÃO FICA EM ESTADO NEM EM VARIÁVEL DE MÓDULO. Ele é pedido no
 * toque, entra na URL do WhatsApp e sai de cena. É uma credencial: cada cópia
 * que a gente guarda é uma cópia a mais para vazar, e no banco só mora o hash
 * dela.
 *
 * ⚠️ E CADA TOQUE GERA UM LINK NOVO, derrubando o anterior. Não é desperdício:
 * é a rotação. Se ele mandou pra pessoa errada, mandar de novo pra certa
 * invalida o primeiro — sem tela de gerenciamento, sem lista, sem nada pra
 * ele aprender.
 */
function BotaoDoLink({ child, pickup }) {
  const [gerando, setGerando] = useState(false);

  const mandar = async () => {
    if (gerando) return;
    setGerando(true);
    try {
      const url = await gerarAcessoDoDia(child.id);
      const nome = (child.name || '').split(' ')[0] || 'a criança';
      const texto = encodeURIComponent(
        `Oi! Você vai pegar ${nome} hoje. ` +
          `Neste link dá pra acompanhar a entrega: ${url}` +
          `\n\nEle vale só hoje.`
      );
      const fone = (pickup.phone || '').replace(/\D/g, '');
      const destino = fone
        ? `https://wa.me/${fone.startsWith('55') ? fone : `55${fone}`}?text=${texto}`
        : `https://wa.me/?text=${texto}`;
      window.open(destino, '_blank', 'noopener');
    } catch (err) {
      toast.error(err.message || 'Não deu pra criar o link.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Button variant="secondary" icon={Send} loading={gerando} onClick={mandar}>
        Mandar o link pra {(pickup.name || '').split(' ')[0]}
      </Button>
      <p className="px-1 text-[11px] leading-relaxed text-textMuted">
        Ela vê só se a criança embarcou e a que horas chegou — sem endereço,
        sem telefone e sem o mapa. O link vale até meia-noite.
      </p>
    </div>
  );
}

export default function AltPickupSheet({
  open,
  onClose,
  child,
  parentUid,
  dateKey,
  currentPickup,
}) {
  const { alcaProps, estilo } = useArrastarPraFechar(onClose);
  const [mode, setMode] = useState('default');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  // UM SÓ, o último. A lista que crescia saiu — ver `lembrarAvulso`.
  const avulso = ultimoAvulso(child);

  const handleSelect = async (resp) => {
    setSubmitting(true);
    try {
      await setDailyAltPickup({
        dateKey,
        childId: child.id,
        parentUid,
        adminUid: child.adminUid || null,
        name: resp.name,
        phone: resp.phone,
        relationship: resp.relationship,
      });
      notifyAltPickup({
        childName: child.name,
        name: resp.name,
        phone: resp.phone,
        dateKey,
        // Sem isto o aviso cai no ponteiro global e a rule nega a escrita.
        adminUid: child.adminUid,
      });
      toast.success(`Avisamos o motorista que ${resp.name} vai buscar hoje.`);
      onClose?.();
    } catch (err) {
      console.error('Falha ao indicar responsável:', err);
      toast.error('Não foi possível avisar. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async () => {
    setSubmitting(true);
    try {
      await clearDailyAltPickup({ dateKey, childId: child.id });
      toast.success('Você mesmo vai buscar hoje.');
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível remover.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', ...estilo }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...alcaProps}
          className={`pt-3 pb-1 flex justify-center sticky top-0 bg-card z-10 ${alcaProps.className}`}
        >
          <span className="block w-10 h-1.5 rounded-full bg-borderStrong" />
        </div>

        <div className="px-5 pt-2 pb-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-text leading-tight">
                {mode === 'new'
                  ? 'Cadastrar responsável'
                  : mode === 'manage'
                  ? 'Meus responsáveis'
                  : 'Quem vai buscar hoje?'}
              </h2>
              <p className="text-xs text-textMuted mt-1">
                {mode === 'new'
                  ? 'Quem mais pode pegar a criança'
                  : mode === 'manage'
                  ? 'Pessoas que podem buscar quando você não puder'
                  : 'Indique no app pra o motorista saber'}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="tap w-9 h-9 rounded-full bg-neutro flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {mode === 'default' && (
            <>
              {/* Status atual */}
              {currentPickup && (
                <div className="rounded-2xl bg-gradient-to-br from-warningSoft to-warningChip border border-warningBorder p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning text-white flex items-center justify-center shrink-0">
                    <UserCheck size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-warningText leading-tight">
                      Hoje quem pega: {currentPickup.name}
                    </p>
                    <p className="text-xs text-warningText mt-0.5">
                      {currentPickup.relationship && (
                        <span>{currentPickup.relationship} · </span>
                      )}
                      {currentPickup.phone}
                    </p>
                  </div>
                  <button
                    onClick={handleClear}
                    disabled={submitting}
                    className="tap text-xs font-semibold text-warningText underline"
                  >
                    Trocar
                  </button>
                </div>
              )}

              {/* MANDAR O LINK PRA ELA — e o lugar é este, não uma tela nova.
                *
                * O pai acabou de dizer ao app quem vai pegar a criança, e o
                * app avisava só o MOTORISTA (`alt_pickup`). A pessoa que vai
                * ficar na calçada não sabia de nada: pra descobrir se a perua
                * saiu ela ligava pro pai, que ligava pro motorista. O
                * telefone dela está aqui na tela, digitado dez segundos
                * atrás.
                *
                * ⚠️ O LINK SÓ EXISTE DEPOIS DA INDICAÇÃO, e é isso que faz a
                * revogação ser de graça: ele vive no MESMO documento. Tocar
                * em "Trocar" apaga os dois juntos. */}
              {currentPickup && (
                <BotaoDoLink child={child} pickup={currentPickup} />
              )}

              {/* Botão "Sou eu mesmo" */}
              {!currentPickup && (
                <button
                  type="button"
                  onClick={onClose}
                  className="tap w-full text-left rounded-2xl bg-card border-2 border-primary p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <UserCheck size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text leading-tight">
                      Sou eu mesmo
                    </p>
                    <p className="text-xs text-textMuted mt-0.5">
                      Padrão — você vai buscar
                    </p>
                  </div>
                </button>
              )}

              {/* O ÚLTIMO AVULSO — atalho, não cadastro.
                *
                * É quase sempre a mesma pessoa duas vezes seguidas: a avó que
                * pega quando o pai não pode. Um toque resolve esse caso; o
                * resto é digitar de novo, que leva quinze segundos e é o
                * certo pra quem só vai pegar a criança uma vez.
                *
                * "Esquecer" fica à vista de propósito: é o telefone de um
                * terceiro guardado no app, e quem entregou o dado precisa
                * conseguir tirá-lo sem procurar. */}
              {avulso && (
                <>
                  <p className="px-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-textMuted">
                    Da última vez
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelect(avulso)}
                    disabled={submitting}
                    className="tap flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-escolaChip text-escola">
                      <UserIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-text">
                        {avulso.name}
                      </p>
                      <p className="truncate text-[11px] text-textMuted">
                        {avulso.relationship && (
                          <span>{avulso.relationship} · </span>
                        )}
                        {maskPhone(avulso.phone)}
                      </p>
                    </div>
                  </button>
                </>
              )}

              <div className="space-y-2 pt-2">
                <Button
                  variant="secondary"
                  icon={Plus}
                  onClick={() => setMode('new')}
                >
                  {avulso ? 'Outra pessoa' : 'Indicar quem vai pegar'}
                </Button>
                {avulso && (
                  <button
                    type="button"
                    onClick={async () => {
                      await esquecerAvulso(child.id);
                      toast.success('Esquecido.');
                    }}
                    className="tap w-full py-2 text-xs text-textMuted hover:text-text"
                  >
                    Esquecer {avulso.name.split(' ')[0]}
                  </button>
                )}
              </div>
            </>
          )}

          {mode === 'new' && (
            <NewAltForm
              child={child}
              parentUid={parentUid}
              dateKey={dateKey}
              onCancel={() => setMode('default')}
              onSaved={onClose}
            />
          )}

        </div>
      </div>
    </div>
  );
}

/* ─────────────── Form "Cadastrar outro" ─────────────── */

// Parentescos mais comuns — chips clicáveis em vez de digitar. "Outro" abre
// input livre pra casos fora da lista (madrinha, vizinho, cuidador etc).
const COMMON_RELATIONSHIPS = [
  'Tio(a)',
  'Avô',
  'Avó',
  'Primo(a)',
  'Irmão',
  'Irmã',
];

function NewAltForm({ child, parentUid, dateKey, onCancel, onSaved }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const pickPredef = (rel) => {
    setIsCustom(false);
    setRelationship(relationship === rel ? '' : rel);
  };

  const pickCustom = () => {
    setIsCustom(true);
    setRelationship('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!name.trim()) errs.name = 'Diga o nome.';
    if (!isValidPhone(phone)) errs.phone = 'Telefone inválido.';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error('Confira os campos.');
      return;
    }

    setSaving(true);
    try {
      const cleanPhone = unmaskPhone(phone);
      // Salva na lista do pai (pra usar depois) + indica como pickup do dia
      await lembrarAvulso(child.id, {
        name,
        phone: cleanPhone,
        relationship,
      });
      await setDailyAltPickup({
        dateKey,
        childId: child.id,
        parentUid,
        adminUid: child.adminUid || null,
        name,
        phone: cleanPhone,
        relationship,
      });
      notifyAltPickup({
        childName: child.name,
        name,
        phone: cleanPhone,
        dateKey,
        adminUid: child.adminUid,
      });
      toast.success(`${name} cadastrado e avisado pro motorista.`);
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        label="Nome completo"
        icon={UserIcon}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        required
        autoFocus
      />
      <Input
        label="Telefone"
        icon={Phone}
        inputMode="tel"
        placeholder="(11) 99999-9999"
        value={phone}
        onChange={(e) => setPhone(maskPhone(e.target.value))}
        maxLength={15}
        error={errors.phone}
        required
      />
      <div>
        <label className="block text-sm font-semibold text-text mb-2 inline-flex items-center gap-1.5">
          <Heart size={14} className="text-textMuted" />
          Parentesco{' '}
          <span className="text-textMuted font-normal">(opcional)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_RELATIONSHIPS.map((rel) => (
            <button
              key={rel}
              type="button"
              onClick={() => pickPredef(rel)}
              className={`tap h-9 px-3 rounded-full text-sm font-semibold border transition-colors ${
                relationship === rel && !isCustom
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-text border-border'
              }`}
            >
              {rel}
            </button>
          ))}
          <button
            type="button"
            onClick={pickCustom}
            className={`tap h-9 px-3 rounded-full text-sm font-semibold border transition-colors ${
              isCustom
                ? 'bg-primary text-white border-primary'
                : 'bg-card text-text border-border'
            }`}
          >
            Outro
          </button>
        </div>
        {isCustom && (
          <input
            type="text"
            placeholder="Ex: madrinha, vizinho, cuidador..."
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            maxLength={40}
            autoFocus
            className="mt-2 w-full h-12 rounded-2xl border-2 border-border bg-card text-text px-4 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
          />
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Voltar
        </Button>
        <Button type="submit" loading={saving}>
          Cadastrar e avisar
        </Button>
      </div>
    </form>
  );
}

