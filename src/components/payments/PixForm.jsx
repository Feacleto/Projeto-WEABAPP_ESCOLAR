import { useState } from 'react';
import { Key, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import Input from '../common/Input';
import ConfirmDialog from '../common/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import {
  PIX_KEY_TYPES,
  setAdminPixKey,
  clearAdminPixKey,
  validatePixKey,
} from '../../services/userService';
import { formatPhone } from '../../utils/formatters';

/**
 * O formulário da chave PIX — o conteúdo, sem casca.
 *
 * Ele é chamado de TRÊS lugares: o perfil, o banner do financeiro e o bloco
 * de pendências de cobrança. Nos três, a intenção é a mesma — "resolve isso e
 * me devolve pra onde eu estava" — e nos três ele virava uma página, que é
 * exatamente o oposto disso. Quem estava conferindo o mês perdia o mês.
 *
 * Então o conteúdo mora aqui e as cascas ficam por fora (ver PixSheet e
 * pages/tio/TioPixConfig). `onDone` é o que a casca usa pra se fechar depois
 * do salvamento: a página navega de volta, a folha só some.
 */
export default function PixForm({ onDone }) {
  const { user, profile, refreshProfile } = useAuth();

  // O QUE ELE DIGITOU VENCE O QUE VEIO DO PERFIL — e o perfil é a base.
  //
  // Antes eram dois estados semeados no primeiro render mais um efeito que os
  // reescrevia quando o perfil chegasse. Isso é um render a mais e uma janela
  // real: o perfil chega enquanto ele digita, e o efeito apaga o que ele
  // escreveu. Guardar só a EDIÇÃO (null = ainda não mexeu) e derivar na
  // leitura resolve os dois — sem `setState` dentro de efeito.
  const [tipoEditado, setTipoEditado] = useState(null);
  const [chaveEditada, setChaveEditada] = useState(null);
  const type = tipoEditado ?? profile?.pixKeyType ?? 'phone';
  const key = chaveEditada ?? profile?.pixKey ?? '';
  const setType = setTipoEditado;
  const setKey = setChaveEditada;
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const onTypeChange = (newType) => {
    setType(newType);
    setKey(''); // limpa pra evitar formato errado
    setError('');
  };

  const onKeyChange = (e) => {
    let value = e.target.value;
    if (type === 'phone') value = formatPhone(value);
    setKey(value);
    if (error) setError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const validationErr = validatePixKey(type, key);
    if (validationErr) {
      setError(validationErr);
      toast.error(validationErr);
      return;
    }

    setSaving(true);
    try {
      await setAdminPixKey(user.uid, { pixKey: key.trim(), pixKeyType: type });
      await refreshProfile();
      toast.success('Chave PIX salva!');
      onDone?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar chave PIX.');
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    setClearing(true);
    try {
      await clearAdminPixKey(user.uid);
      await refreshProfile();
      setKey('');
      toast.success('Chave PIX removida.');
      setConfirmClear(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover chave PIX.');
    } finally {
      setClearing(false);
    }
  };

  const hasExistingKey = !!profile?.pixKey;

  return (
    <>
      <div className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Tipo de chave
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PIX_KEY_TYPES).map(([value, { label }]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onTypeChange(value)}
                  className={`h-12 rounded-xl text-xs font-semibold tap border ${
                    type === value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-text border-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* maxLength e type específicos por tipo:
            *   phone → 15 chars (formato mascarado (11) 99999-9999)
            *   email → type="email" pra validação HTML nativa + teclado
            *   random → uuid v4 (36 chars com hífens) */}
          <Input
            label="Chave PIX"
            placeholder={PIX_KEY_TYPES[type].placeholder}
            icon={Key}
            value={key}
            onChange={onKeyChange}
            type={type === 'email' ? 'email' : 'text'}
            inputMode={
              type === 'phone'
                ? 'tel'
                : type === 'email'
                ? 'email'
                : 'text'
            }
            maxLength={
              type === 'phone' ? 15 : type === 'random' ? 36 : 80
            }
            autoComplete="off"
            autoCapitalize={type === 'random' ? 'none' : 'off'}
            error={error}
            required
          />

          <Button type="submit" icon={Save} loading={saving}>
            Salvar chave PIX
          </Button>

          {hasExistingKey && (
            <Button
              type="button"
              variant="ghost"
              icon={Trash2}
              onClick={() => setConfirmClear(true)}
              className="!text-danger"
            >
              Remover chave PIX
            </Button>
          )}
        </form>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Remover chave PIX?"
        description="Os pais não vão mais ver uma chave pra pagar até você cadastrar outra. Tem certeza?"
        confirmLabel="Remover"
        variant="danger"
        loading={clearing}
        onConfirm={onClear}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}
