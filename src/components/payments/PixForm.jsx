import { useState } from 'react';
import { Key, Save, Trash2, Smartphone } from 'lucide-react';
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
  maskCpf,
} from '../../services/userService';
import { formatPhone } from '../../compartilhado/formatters';

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

  // ── A PERGUNTA ANTES DO FORMULÁRIO (02/10/2026) ───────────────────────
  //
  // Quem ainda não tem chave e já deu o WhatsApp no cadastro ouve primeiro uma
  // pergunta só: "usar este número?". A maioria dos motoristas usa o celular
  // como chave, e fazer essa pessoa escolher "Celular" numa grade e digitar de
  // novo um número que o app JÁ TEM é o formulário pedindo o que ele sabe.
  //
  // "Não" abre o formulário de sempre, com o campo vazio para ele escrever ou
  // colar a chave dele. Quem já tem chave nunca vê a pergunta: ali o assunto é
  // trocar, e trocar começa pelo formulário.
  const telefoneDoCadastro = profile?.phone ? formatPhone(profile.phone) : '';
  const podePerguntar =
    !profile?.pixKey && !!telefoneDoCadastro && !validatePixKey('phone', telefoneDoCadastro);
  const [respondeu, setRespondeu] = useState(false);
  const perguntando = podePerguntar && !respondeu;

  const onTypeChange = (newType) => {
    setType(newType);
    setKey(''); // limpa pra evitar formato errado
    setError('');
  };

  const onKeyChange = (e) => {
    let value = e.target.value;
    if (type === 'phone') value = formatPhone(value);
    if (type === 'cpf') value = maskCpf(value);
    setKey(value);
    if (error) setError('');
  };

  const usarTelefone = async () => {
    setSaving(true);
    try {
      await setAdminPixKey(user.uid, { pixKey: telefoneDoCadastro, pixKeyType: 'phone' });
      await refreshProfile();
      toast.success('Chave PIX salva: o seu celular.');
      onDone?.({ pixKey: telefoneDoCadastro, pixKeyType: 'phone' });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar chave PIX.');
    } finally {
      setSaving(false);
    }
  };

  const outraChave = () => {
    setRespondeu(true);
    // Abre no tipo que ele mais provavelmente tem, com o campo VAZIO: se
    // fosse o celular, ele teria dito sim.
    setTipoEditado('random');
    setChaveEditada('');
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
      // A chave salva vai junto: quem abriu o formulário no meio de uma ação
      // (cobrar pelo WhatsApp) segue com ela, e não com o perfil de antes.
      onDone?.({ pixKey: key.trim(), pixKeyType: type });
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

  if (perguntando) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-text">
            <Smartphone size={16} className="text-primary" />
            Seu celular é sua chave PIX?
          </p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-text">
            {telefoneDoCadastro}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-textMuted">
            É o número que você deu no cadastro. Só use se ele estiver
            cadastrado como chave PIX no seu banco — é pra ela que as famílias
            vão mandar o dinheiro.
          </p>
        </div>

        <Button onClick={usarTelefone} loading={saving}>
          Sim, usar este número
        </Button>
        <Button variant="secondary" onClick={outraChave} disabled={saving}>
          Não, minha chave é outra
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Tipo de chave
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PIX_KEY_TYPES).map(([value, { label }]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onTypeChange(value)}
                  className={`h-12 rounded-xl text-sm font-semibold tap border ${
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
          {respondeu && (
            <p className="text-sm text-textMuted">
              Escreva ou cole aqui a sua chave PIX, do jeito que está no app do
              seu banco.
            </p>
          )}

          <Input semSalvar
            label="Chave PIX"
            placeholder={PIX_KEY_TYPES[type].placeholder}
            icon={Key}
            value={key}
            onChange={onKeyChange}
            type={type === 'email' ? 'email' : 'text'}
            inputMode={
              type === 'phone'
                ? 'tel'
                : type === 'cpf'
                ? 'numeric'
                : type === 'email'
                ? 'email'
                : 'text'
            }
            maxLength={
              type === 'phone' ? 15 : type === 'cpf' ? 14 : type === 'random' ? 36 : 80
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
              className="!text-dangerText"
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
