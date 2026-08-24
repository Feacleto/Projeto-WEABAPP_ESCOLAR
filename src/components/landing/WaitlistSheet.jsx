import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bus, Check, Gift, Handshake, Mail, MapPin, User } from 'lucide-react';
import toast from 'react-hot-toast';
import Input from '../common/Input';
import Sheet, { SheetCard, SheetCTA, SheetGhost } from '../common/Sheet';
import PartnerPitch from './PartnerPitch';
import ConsultorButton from './ConsultorButton';
import AssociadosCard from './AssociadosCard';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { submitDriverWaitlist } from '../../services/waitlistService';
import {
  isValidEmail,
  isValidPhone,
  maskPhone,
  unmaskPhone,
} from '../../utils/masks';

const FLEET_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2-3', label: '2 a 3' },
  { value: '4+', label: '4 ou +' },
];

/**
 * Folha da vaga de associado — o mesmo cadastro de
 * /quero-fazer-parte, sem tirar o motorista da home.
 *
 * ISTO NÃO É AUTOCADASTRO, E O TEXTO NÃO FINGE QUE É
 * O motorista não cria conta sozinho: ele manda os dados, e a conta nasce
 * quando a gente libera. Por isso o botão diz "entrar na lista" e o retorno
 * é uma POSIÇÃO NA FILA, não uma senha. Chamar isso de "cadastro" e depois
 * não deixar entrar seria a pior sequência possível — promete acesso e
 * entrega espera.
 *
 * Cidade e tamanho da frota não são curiosidade: são os dois campos que
 * transformam a lista de espera em decisão de "vale construir multi-tio".
 */
export default function WaitlistSheet({
  open,
  onClose,
  associados = 1,
  // Quem chegou da pergunta "você é pai ou motorista?" já disse que é
  // motorista e já pediu a vaga: mostrar as cinco telas de explicação ali
  // seria responder uma pergunta que ele acabou de fazer. Cai no formulário,
  // e o "Voltar" do cabeçalho leva à explicação pra quem quiser.
  pularPitch = false,
}) {
  // O pitch vem ANTES do formulário e existe por um motivo específico: é
  // onde a TAXA é dita. Descobrir que existe taxa na terceira conversa faz o
  // motorista se sentir enganado; ler isso antes de digitar o nome faz ele
  // chegar pra negociar. Quem já leu pode pular.
  const [fase, setFase] = useState(pularPitch ? 'form' : 'pitch'); // pitch | form
  // O passo do pitch mora aqui (e não dentro dele) pro "Voltar" do cabeçalho
  // poder recuar uma tela — ver a nota em PartnerPitch.
  const [passoPitch, setPassoPitch] = useState(0);
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

  // Formulário em passos: cada campo aparece quando o anterior recebe o dedo.
  // Seis campos de uma vez fazem desistir antes de começar; um por vez parece
  // conversa. Uso FOCO (e não "está válido") como gatilho — validar antes de
  // a pessoa terminar de digitar é o jeito mais rápido de irritar.
  const [tocou, setTocou] = useState({});
  const marcar = (campo) => () =>
    setTocou((p) => (p[campo] ? p : { ...p, [campo]: true }));

  // Toda vez que a folha abre, o pitch abre com ela. A explicação da taxa
  // não é aviso de cookie: não é "leu uma vez, nunca mais". Quem já conhece
  // pula em um toque; quem voltou pra reler encontra no mesmo lugar.
  // (Se já enviou, a folha continua sendo o comprovante.)
  //
  // O ajuste acontece DURANTE O RENDER, comparando com o valor anterior, e
  // não num efeito: é o padrão do React pra "corrigir estado quando uma prop
  // muda" — sem o render extra (e sem o aviso) que o efeito causaria.
  const [estavaAberta, setEstavaAberta] = useState(open);
  if (open !== estavaAberta) {
    setEstavaAberta(open);
    if (open && !result) {
      setFase(pularPitch ? 'form' : 'pitch');
      setPassoPitch(0);
    }
  }

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

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
      setResult(
        await submitDriverWaitlist({ ...form, phone: unmaskPhone(form.phone) })
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Depois de enviado, a folha vira o comprovante: a posição na fila torna a
  // escassez concreta em vez de insinuada.
  if (result) {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        icon={Check}
        eyebrow="lista de associados"
        title={
          result.alreadyOnList ? 'Você já está na lista' : 'Recebemos seu pedido'
        }
        subtitle={
          result.alreadyOnList
            ? 'Achamos seu email na fila — não criamos pedido duplicado.'
            : 'Falamos com você pelo WhatsApp quando abrir vaga.'
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span
              aria-hidden
              className="demo-ping absolute inset-0 rounded-full bg-emerald-400/25"
            />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-primary text-white shadow-lg shadow-emerald-500/25">
              <Check size={32} strokeWidth={3} />
            </span>
          </div>

          <SheetCard className="!px-10 !py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
              sua posição na fila
            </p>
            <p className="mt-1 text-5xl font-extrabold tabular-nums text-primary">
              {result.position}º
            </p>
          </SheetCard>

          <p className="text-sm leading-relaxed text-textMuted">
            <span className="font-bold text-text">Não prometemos prazo</span> —
            quando abrir, a gente chama.
          </p>

          {/* O bônus de entrada é anunciado aqui, mas SORTEADO dentro do app,
            * no primeiro acesso, com a conta já criada. Sorteio em página
            * pública seria uma tentativa por aba aberta. */}
          <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text">
              <Gift size={15} className="text-warning" />
              Sua condição de entrada
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
              O sistema está em teste, então você não começa pagando: no seu
              <strong>primeiro acesso</strong> você gira a roleta uma vez e
              pode tirar <strong>de 1 a 4 meses sem taxa</strong>. Uma
              tentativa por associado — o resultado fica registrado na sua
              conta.
            </p>
          </div>

          <SheetGhost onClick={onClose}>Voltar pra home</SheetGhost>
          <p className="inline-flex items-center gap-1.5 text-[11px] text-textMuted">
            <WhatsAppIcon size={13} />
            Deixe o WhatsApp aberto pra nossa mensagem
          </p>
        </div>
      </Sheet>
    );
  }

  if (fase === 'pitch') {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        icon={Handshake}
        eyebrow="antes do formulário"
        title="Como funciona a associação"
        subtitle="Cinco telas. A quarta fala de dinheiro — de propósito."
      >
        {/* O "Voltar" do pitch mora no rodapé dele, colado no "Continuar":
          * andar pra frente e pra trás é o mesmo gesto, na mesma mão. Na
          * primeira tela não há passo anterior — aí ele fecha a folha. */}
        <PartnerPitch
          indice={passoPitch}
          onIndice={setPassoPitch}
          onSair={onClose}
          onDone={() => setFase('form')}
        />
      </Sheet>
    );
  }

  // A cadeia nunca trava: o email é opcional e tem "pular", e o fim aparece
  // também quando a cidade já foi preenchida.
  const mostraFone = tocou.nome || form.name.length > 0;
  const mostraEmail = mostraFone && (tocou.fone || form.phone.length > 0);
  const mostraCidade =
    mostraEmail && (tocou.email || form.email.length > 0 || tocou.pulouEmail);
  const mostraVans = mostraCidade && (tocou.cidade || form.city.length > 0);
  const mostraFim = mostraVans && (tocou.vans || form.city.trim().length >= 2);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      icon={Bus}
      // Do formulário, o passo atrás é a explicação — inclusive (e
      // principalmente) pra quem pulou ou entrou direto nos campos.
      onBack={() => {
        setPassoPitch(0);
        setFase('pitch');
      }}
      eyebrow="vaga limitada por estrutura"
      title="Quero ser associado"
      subtitle="Entrar na fila não custa nada e não compromete você."
    >
      <AssociadosCard associados={associados} className="mb-5" />

      {/* Antes do primeiro campo: quem prefere conversar não deveria ter que
        * preencher um formulário pra conseguir falar com alguém. */}
      <div className="mb-5">
        <ConsultorButton
          tone="light"
          assunto="a vaga de associado e a taxa"
        />
        <p className="mt-2 text-center text-[11px] text-textMuted">
          prefere conversar antes de preencher? é por aqui
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Seu nome"
          placeholder="Nome completo"
          icon={User}
          value={form.name}
          onChange={set('name')}
          onFocus={marcar('nome')}
          autoComplete="name"
          error={errors.name}
          required
        />

        {mostraFone && (
          <div className="animate-step-in">
            <Input
              label="WhatsApp"
              placeholder="(11) 90000-0000"
              inputMode="tel"
              value={form.phone}
              onChange={(e) =>
                setForm((p) => ({ ...p, phone: maskPhone(e.target.value) }))
              }
              onFocus={marcar('fone')}
              autoComplete="tel"
              error={errors.phone}
              hint="É por aqui que falamos com você."
              required
            />
          </div>
        )}

        {mostraEmail && (
          <div className="animate-step-in">
            <Input
              type="email"
              inputMode="email"
              label="Email (opcional)"
              placeholder="seu@email.com"
              icon={Mail}
              value={form.email}
              onChange={set('email')}
              onFocus={marcar('email')}
              autoComplete="email"
              error={errors.email}
            />
            {!mostraCidade && (
              <button
                type="button"
                onClick={() => setTocou((p) => ({ ...p, pulouEmail: true }))}
                className="tap mt-1.5 text-xs font-semibold text-textMuted hover:text-text"
              >
                não uso email — pular
              </button>
            )}
          </div>
        )}

        {mostraCidade && (
          <div className="animate-step-in">
            <Input
              label="Cidade onde você roda"
              placeholder="Ex: Guarulhos, SP"
              icon={MapPin}
              value={form.city}
              onChange={set('city')}
              onFocus={marcar('cidade')}
              error={errors.city}
              required
            />
          </div>
        )}

        {mostraVans && (
        <div className="animate-step-in">
          <p className="mb-2 block text-sm font-semibold text-text">
            Quantas vans
          </p>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 p-1">
            {FLEET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setForm((p) => ({ ...p, fleet: opt.value }));
                  setTocou((p) => (p.vans ? p : { ...p, vans: true }));
                }}
                className={`tap rounded-xl py-3 text-sm font-bold transition-colors ${
                  form.fleet === opt.value
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-textMuted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {mostraFim && (
        <div className="animate-step-in">
          <label
            htmlFor="waitlist-msg"
            className="mb-2 block text-sm font-semibold text-text"
          >
            Quer contar algo? (opcional)
          </label>
          <textarea
            id="waitlist-msg"
            rows={3}
            value={form.message}
            onChange={set('message')}
            placeholder="Há quanto tempo roda, quantas crianças atende..."
            className="w-full rounded-2xl border-2 border-gray-200 bg-card p-4 text-sm text-text placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <SheetCTA
            type="submit"
            loading={submitting}
            icon={Bus}
            className="mt-4"
          >
            Quero minha vaga
          </SheetCTA>
        </div>
        )}

        <p className="flex items-center justify-center gap-3 text-[11px] text-textMuted">
          <Link to="/termos" className="hover:underline">
            Termos de Uso
          </Link>
          <span aria-hidden>·</span>
          <Link to="/privacidade" className="hover:underline">
            Privacidade
          </Link>
        </p>
      </form>
    </Sheet>
  );
}
