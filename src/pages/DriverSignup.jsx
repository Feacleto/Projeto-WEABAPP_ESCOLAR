import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Bus, Check, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import WhatsAppIcon from '../components/common/WhatsAppIcon';
import { submitDriverWaitlist } from '../services/waitlistService';
import { maskPhone, unmaskPhone, isValidPhone, isValidEmail } from '../utils/masks';

const FLEET_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2-3', label: '2 a 3' },
  { value: '4+', label: '4 ou +' },
];

/**
 * Inscrição de motorista — /quero-fazer-parte
 *
 * A exclusividade aqui é real, não marketing: o app roda hoje com um único
 * motorista porque a arquitetura ainda é de um só. Por isso o texto diz o
 * que acontece com franqueza e NÃO promete prazo — prazo perdido custa mais
 * caro que prazo não prometido.
 *
 * Cidade e tamanho da frota não são curiosidade: são os dois campos que
 * transformam a lista de espera em decisão de "vale construir multi-tio".
 */
export default function DriverSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    fleet: '1',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const set = (key) => (e) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Diga seu nome.';
    if (!isValidPhone(form.phone)) errs.phone = 'WhatsApp com DDD.';
    if (form.email && !isValidEmail(form.email)) errs.email = 'Email inválido.';
    if (!form.city.trim()) errs.city = 'Em qual cidade você roda?';
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Confira o que está destacado.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitDriverWaitlist({
        ...form,
        phone: unmaskPhone(form.phone),
      });
      setResult(res);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return <Confirmation result={result} onHome={() => navigate('/')} />;
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-textMuted mb-4 tap self-start p-1 -ml-1"
      >
        <ArrowLeft size={16} /> Voltar
      </Link>

      <div className="space-y-1 mb-5">
        <h1 className="text-2xl font-bold text-text">Vagas por convite</h1>
        <p className="text-sm text-textMuted">
          Entre na lista e a gente chama quando abrir.
        </p>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 space-y-1">
        <p className="text-sm font-bold text-text">
          Hoje rodamos com um motorista parceiro.
        </p>
        <p className="text-xs text-emerald-900/75 leading-relaxed">
          Abrimos vaga aos poucos porque acompanhamos cada parceiro de perto
          no começo — dá pra ajustar o app junto com quem usa.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Seu nome"
          placeholder="Nome completo"
          icon={User}
          value={form.name}
          onChange={set('name')}
          autoComplete="name"
          error={errors.name}
          required
        />
        <Input
          label="WhatsApp"
          placeholder="(11) 90000-0000"
          inputMode="tel"
          value={form.phone}
          onChange={(e) =>
            setForm((p) => ({ ...p, phone: maskPhone(e.target.value) }))
          }
          autoComplete="tel"
          error={errors.phone}
          hint="É por aqui que falamos com você."
          required
        />
        <Input
          type="email"
          inputMode="email"
          label="Email (opcional)"
          placeholder="seu@email.com"
          icon={Mail}
          value={form.email}
          onChange={set('email')}
          autoComplete="email"
          error={errors.email}
        />
        <Input
          label="Cidade onde você roda"
          placeholder="Ex: Guarulhos, SP"
          icon={MapPin}
          value={form.city}
          onChange={set('city')}
          error={errors.city}
          required
        />

        <div>
          <p className="block text-sm font-semibold text-text mb-2">
            Quantas peruas
          </p>
          <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-2xl">
            {FLEET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, fleet: opt.value }))}
                className={`tap py-3 text-sm font-semibold rounded-xl transition-colors ${
                  form.fleet === opt.value
                    ? 'bg-card text-text shadow-sm'
                    : 'text-textMuted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="msg"
            className="block text-sm font-semibold text-text mb-2"
          >
            Quer contar algo? (opcional)
          </label>
          <textarea
            id="msg"
            rows={3}
            value={form.message}
            onChange={set('message')}
            placeholder="Há quanto tempo roda, quantas crianças atende..."
            className="w-full rounded-2xl border-2 border-gray-200 bg-card text-text p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
          />
        </div>

        <Button type="submit" loading={submitting} icon={Bus}>
          Entrar na lista
        </Button>
        <p className="text-xs text-textMuted text-center">
          Sem cobrança e sem compromisso.
        </p>
      </form>

      <div className="mt-auto pt-6 text-[11px] text-textMuted flex items-center justify-center gap-3">
        <Link to="/termos" className="hover:underline">
          Termos de Uso
        </Link>
        <span aria-hidden>·</span>
        <Link to="/privacidade" className="hover:underline">
          Política de Privacidade
        </Link>
      </div>
    </div>
  );
}

/**
 * Confirmação com posição na fila.
 *
 * A posição torna a escassez concreta em vez de insinuada — e o "não
 * prometemos prazo" é deliberado: é mais honesto e mais barato que um prazo
 * que a gente não controla.
 */
function Confirmation({ result, onHome }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-primary text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
        <Check size={38} strokeWidth={3} />
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-text">
          {result.alreadyOnList ? 'Você já está na lista' : 'Recebemos seu pedido'}
        </h1>
        {result.alreadyOnList && (
          <p className="text-sm text-textMuted">
            Achamos seu email na fila — não criamos pedido duplicado.
          </p>
        )}
      </div>

      <div className="bg-card border border-gray-200 rounded-2xl px-8 py-5 shadow-sm">
        <p className="text-xs text-textMuted uppercase tracking-widest font-semibold">
          sua posição na fila
        </p>
        <p className="text-5xl font-extrabold text-primary mt-1">
          {result.position}º
        </p>
      </div>

      <p className="text-sm text-textMuted max-w-xs leading-relaxed">
        Falamos com você pelo WhatsApp quando abrir vaga.{' '}
        <span className="text-text font-semibold">
          Não prometemos prazo
        </span>{' '}
        — quando for, a gente chama.
      </p>

      <div className="w-full max-w-xs space-y-2">
        <Button variant="secondary" onClick={onHome}>
          Voltar pro início
        </Button>
        <p className="text-[11px] text-textMuted inline-flex items-center gap-1 justify-center w-full">
          <WhatsAppIcon size={13} />
          Deixe o WhatsApp aberto pra nossa mensagem
        </p>
      </div>
    </div>
  );
}
