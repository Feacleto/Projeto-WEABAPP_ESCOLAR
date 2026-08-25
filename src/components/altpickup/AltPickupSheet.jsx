import { useState } from 'react';
import {
  X,
  UserCheck,
  Phone,
  User as UserIcon,
  Plus,
  Trash2,
  Heart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Input from '../common/Input';
import Button from '../common/Button';
import { maskPhone, unmaskPhone, isValidPhone } from '../../utils/masks';
import {
  addAltResponsible,
  removeAltResponsible,
  setDailyAltPickup,
  clearDailyAltPickup,
  notifyAltPickup,
} from '../../services/altPickupService';

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
export default function AltPickupSheet({
  open,
  onClose,
  child,
  parentUid,
  dateKey,
  currentPickup,
}) {
  const [mode, setMode] = useState('default');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const altResponsibles = child?.altResponsibles || [];

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
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex justify-center sticky top-0 bg-card z-10">
          <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
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
              className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {mode === 'default' && (
            <>
              {/* Status atual */}
              {currentPickup && (
                <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200 p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <UserCheck size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900 leading-tight">
                      Hoje quem pega: {currentPickup.name}
                    </p>
                    <p className="text-xs text-amber-800 mt-0.5">
                      {currentPickup.relationship && (
                        <span>{currentPickup.relationship} · </span>
                      )}
                      {currentPickup.phone}
                    </p>
                  </div>
                  <button
                    onClick={handleClear}
                    disabled={submitting}
                    className="tap text-xs font-semibold text-amber-900 underline"
                  >
                    Trocar
                  </button>
                </div>
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

              {/* Lista de responsáveis pré-cadastrados */}
              {altResponsibles.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted px-1 pt-2">
                    Outros responsáveis
                  </p>
                  <div className="space-y-2">
                    {altResponsibles.map((resp) => (
                      <button
                        key={resp.id}
                        type="button"
                        onClick={() => handleSelect(resp)}
                        disabled={submitting}
                        className="tap w-full text-left rounded-2xl bg-card border border-gray-200 p-3 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                          <UserIcon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-text truncate">
                            {resp.name}
                          </p>
                          <p className="text-[11px] text-textMuted truncate">
                            {resp.relationship && (
                              <span>{resp.relationship} · </span>
                            )}
                            {resp.phone}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="pt-2 space-y-2">
                <Button
                  variant="secondary"
                  icon={Plus}
                  onClick={() => setMode('new')}
                >
                  Cadastrar outro
                </Button>
                {altResponsibles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMode('manage')}
                    className="tap w-full text-xs text-textMuted py-2 hover:text-text"
                  >
                    Gerenciar lista de responsáveis
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

          {mode === 'manage' && (
            <ManageList
              child={child}
              altResponsibles={altResponsibles}
              onBack={() => setMode('default')}
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
      await addAltResponsible(child.id, {
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
                  : 'bg-card text-text border-gray-200'
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
                : 'bg-card text-text border-gray-200'
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
            className="mt-2 w-full h-12 rounded-2xl border-2 border-gray-200 bg-card text-text px-4 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
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

/* ─────────────── Gerenciar lista ─────────────── */

function ManageList({ child, altResponsibles, onBack }) {
  return (
    <div className="space-y-2">
      {altResponsibles.length === 0 ? (
        <p className="text-sm text-textMuted text-center py-6">
          Sem responsáveis cadastrados.
        </p>
      ) : (
        altResponsibles.map((resp) => (
          <div
            key={resp.id}
            className="bg-card border border-gray-200 rounded-2xl p-3 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <UserIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text truncate">{resp.name}</p>
              <p className="text-[11px] text-textMuted truncate">
                {resp.relationship && <span>{resp.relationship} · </span>}
                {resp.phone}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await removeAltResponsible(child.id, resp.id);
                  toast.success(`${resp.name} removido.`);
                } catch (err) {
                  console.error(err);
                  toast.error('Não foi possível remover.');
                }
              }}
              className="tap text-danger p-2"
              aria-label="Remover"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))
      )}

      <Button variant="secondary" onClick={onBack}>
        Voltar
      </Button>
    </div>
  );
}
