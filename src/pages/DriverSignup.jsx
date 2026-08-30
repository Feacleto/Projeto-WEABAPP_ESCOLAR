import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Bus, MapPin, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { ArtRoad } from '../components/landing/BlockArt';
import AssociadosCard from '../components/landing/AssociadosCard';
import { submitDriverWaitlist } from '../services/waitlistService';
import { inscreverAssociado } from '../services/associadoService';
import { useAuth } from '../hooks/useAuth';
import { maskPhone, unmaskPhone, isValidPhone, isValidEmail } from '../utils/masks';

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
    senha: '',
    city: '',
    criancas: '',
    message: '',
  });
  const { refreshProfile } = useAuth();
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Diga seu nome.';
    if (!isValidPhone(form.phone)) errs.phone = 'WhatsApp com DDD.';
    // Email e senha viraram OBRIGATÓRIOS porque a inscrição agora CRIA A
    // CONTA — não é mais só um lead. Sem eles não há como ele voltar.
    if (!isValidEmail(form.email)) errs.email = 'Precisamos do email pra criar sua conta.';
    if (form.senha.length < 6) errs.senha = 'Mínimo 6 caracteres.';
    if (!form.city.trim()) errs.city = 'Em qual cidade você roda?';
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Confira o que está destacado.');
      return;
    }

    setSubmitting(true);
    try {
      // A ORDEM IMPORTA: a lista primeiro, a conta depois.
      //
      // A lista é o registro de intenção e é o que o dono usa pra
      // decidir. Se a criação da conta falhar (email já usado com outra
      // senha, rede caindo), o pedido dele NÃO se perde — ele continua
      // na fila e alguém consegue chamar. O contrário deixaria uma conta
      // órfã sem ninguém saber que aquela pessoa quis entrar.
      await submitDriverWaitlist({
        ...form,
        phone: unmaskPhone(form.phone),
      });

      const { posicao } = await inscreverAssociado({
        email: form.email,
        senha: form.senha,
        nome: form.name,
        telefone: unmaskPhone(form.phone),
        cidade: form.city,
        criancas: form.criancas,
      });

      await refreshProfile();
      toast.success(
        posicao ? `Pronto! Você é o ${posicao}º da fila.` : 'Pronto! Você está na fila.'
      );
      navigate('/aguardando', { replace: true });
    } catch (err) {
      // Conta criada mas perfil recusado deixaria ele autenticado sem
      // lugar nenhum. A mensagem tem que dizer o que fazer, e a única
      // coisa acionável aqui é tentar entrar com a senha que ele já usou.
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        toast.error(
          'Esse email já tem conta aqui. Use a senha que você criou, ou entre pelo login.',
          { duration: 8000 }
        );
      } else {
        toast.error(err?.message || 'Não deu pra concluir. Tente de novo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // A TELA DE CONFIRMAÇÃO SAIU DAQUI.
  //
  // Ela mostrava a posição na fila e um botão de voltar pra home. Agora a
  // inscrição CRIA A CONTA e entra: quem termina o formulário cai na sala de
  // espera (/aguardando), que mostra a mesma posição, é persistente — ele
  // reencontra ao abrir o app de novo — e tem o caminho pro consultor.
  //
  // Uma tela de "recebemos seu pedido" que ele vê uma vez e nunca mais era o
  // ponto em que o interesse esfriava.

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Tampa escura, corpo claro — a mesma regra da folha modal e das
        * outras portas: marca em cima, produto embaixo. Assim o motorista
        * que vem do cartão "sou motorista escolar" não sente que trocou de
        * aplicativo no meio do caminho. */}
      <header className="relative overflow-hidden rounded-b-[28px] bg-[#0B1210] px-6 pb-7 pt-5 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-80 animate-glow-drift"
            style={{
              background:
                'radial-gradient(110% 80% at 10% 0%, rgba(31,95,63,.6) 0%, rgba(11,18,16,0) 62%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-60 animate-glow-drift-slow"
            style={{
              background:
                'radial-gradient(90% 70% at 100% 10%, rgba(82,196,26,.2) 0%, rgba(11,18,16,0) 58%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.06] animate-grid-drift"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
        </div>

        <div className="relative">
          <Link
            to="/"
            className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-white/60 hover:text-white"
          >
            <ArrowLeft size={16} /> Voltar
          </Link>

          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/80">
            vaga limitada por estrutura
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            Quero ser associado
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            Você manda seus dados, a gente chama e configura o app com você.
            Entrar na fila não custa nada e não compromete você.
          </p>

          <div className="mt-5">
            <ArtRoad />
          </div>
        </div>
      </header>

      <div
        aria-hidden
        className="h-[2px] shrink-0 bg-gradient-to-r from-primary via-accent to-primary"
      />

      <div className="flex flex-1 flex-col px-6 py-6">
        {/* Mesmo cartão da folha da home: um lugar só pra contagem, senão
          * uma tela diz "1" e a outra diz "um" no dia em que virar 2. */}
        <AssociadosCard className="mb-5" />

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
            label="Email"
            placeholder="seu@email.com"
            icon={Mail}
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            error={errors.email}
            hint="É por ele que você entra na sua conta."
          />
          {/* A senha aparece aqui porque a inscrição CRIA A CONTA. Google
            * fica de fora de propósito: dentro da webview do WhatsApp o
            * OAuth é recusado, e este formulário costuma ser aberto a
            * partir de um link compartilhado. Caminho que falha em metade
            * dos aparelhos é pior que um campo a mais. */}
          <Input
            type="password"
            revealable
            label="Crie uma senha"
            placeholder="mínimo 6 caracteres"
            icon={Lock}
            value={form.senha}
            onChange={set('senha')}
            autoComplete="new-password"
            error={errors.senha}
          />
          <Input
            label="Cidade onde você roda"
            placeholder="Ex: Cidade Ademar, SP"
            icon={MapPin}
            value={form.city}
            onChange={set('city')}
            error={errors.city}
            required
          />

          <div>
            {/* Criança, e não van — é sobre ela que o contrato é
              * dimensionado. Ver o mesmo campo no WaitlistSheet. */}
            <Input
              id="signup-criancas"
              label="Quantas crianças você transporta hoje"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="Ex.: 18"
              value={form.criancas}
              onChange={(e) =>
                setForm((p) => ({ ...p, criancas: e.target.value }))
              }
            />
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
              className="w-full rounded-2xl border-2 border-border bg-card text-text p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
            />
          </div>

          <Button type="submit" loading={submitting} icon={Bus}>
            Quero minha vaga
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
      </div>
    );
  }
