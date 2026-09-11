import { useState } from 'react';
import { User, MapPin, Bus, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import Logo from '../../components/common/Logo';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import FundoNoturno from '../../components/common/FundoNoturno';
import { useAuth } from '../../hooks/useAuth';
import { completarCadastro } from '../../services/associadoService';

/**
 * PRIMEIRO ACESSO DO MOTORISTA — o resto do cadastro, depois de entrar.
 *
 * ── POR QUE ELE EXISTE
 * A inscrição pedia seis campos antes de a pessoa ter visto qualquer coisa
 * do produto. Formulário longo é onde se perde quem estava decidido: ele
 * cobra confiança que a tela ainda não construiu. Agora a conta nasce com
 * três campos (e-mail, WhatsApp, senha) e o resto é pedido do lado de
 * DENTRO — quando ele já está no app, já viu que existe, e o pedido tem
 * contexto.
 *
 * ── ⚠️ E ISSO NÃO É SÓ UX: TRÊS DESTES CAMPOS SÃO CONTRATO
 * `name` e `city` vão para o contrato de associação
 * (`contratoAssociacao.js`), onde identificam a PARTE. É por isso que os
 * três primeiros bloqueiam e os dois últimos não: sem eles o contrato nasce
 * com a parte em branco, e um documento assinado sem quem assinou não é
 * documento.
 *
 * ── ⚠️ "CIDADE" E "ONDE VOCÊ RODA" SÃO PERGUNTAS DIFERENTES, e juntá-las
 * quebraria o contrato. `city` é a cidade da parte contratante e também
 * alimenta o BR Code do PIX; `regiao` é a resposta operacional — em São
 * Paulo, saber "São Paulo" não diz nada sobre onde a perua está. Uma
 * substituindo a outra faria o contrato dizer "Associado: João, Vila
 * Mariana".
 *
 * ── ⚠️ REGIÃO É TEXTO LIVRE, DE PROPÓSITO
 * Lista fechada agruparia melhor no painel do dono e engessaria quem roda em
 * duas regiões — e ninguém sabe ainda como essas respostas se parecem. Texto
 * livre primeiro; a lista, se vier, vem das respostas reais.
 *
 * ── NENHUMA RULE MUDOU
 * Isto é `update` do próprio documento, e a política de `users` para o
 * próprio dono é lista de PROIBIDOS (`role`, `trialInicio`, `plano`…).
 * Nenhum campo daqui está nela — pelo mesmo critério de `ultimaRota`: mentir
 * aqui não vira desconto, prazo nem permissão.
 */

export default function PrimeiroAcesso({ aoConcluir }) {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    name: profile?.name || '',
    city: profile?.city || '',
    regiao: profile?.regiao || '',
    marcaNome: profile?.marcaNome || '',
    criancas: profile?.criancasEstimadas ? String(profile.criancasEstimadas) : '',
  });
  const [errors, setErrors] = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Como está no seu documento.';
    if (!form.city.trim()) errs.city = 'A cidade vai no seu contrato.';
    if (!form.regiao.trim()) errs.regiao = 'Bairro ou região já serve.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Confira o que está destacado.');
      return;
    }

    setSalvando(true);
    try {
      await completarCadastro(user.uid, form);
      await refreshProfile();
      // Sem toast de sucesso: o que vem a seguir é o app dele com o próprio
      // nome no cabeçalho, e isso diz melhor que qualquer frase.
      if (aoConcluir) aoConcluir();
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      data-painel="web"
      className="relative left-1/2 w-screen -translate-x-1/2 bg-bg"
    >
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
        {/* A MESMA TAMPA ESCURA DAS OUTRAS PORTAS. Ele acabou de atravessar o
          * cadastro; trocar a cara aqui faria parecer outro aplicativo. */}
        <header className="relative overflow-hidden rounded-b-[28px] bg-[#0B1210] px-6 pb-7 pt-6 text-white lg:flex lg:flex-col lg:justify-between lg:rounded-none lg:px-14 lg:py-14">
          <FundoNoturno />

          <div className="relative">
            <Logo variant="lockup" tone="onDark" height={32} className="lg:hidden" />
            <Logo
              variant="lockup"
              tone="onDark"
              height={46}
              className="hidden lg:block"
            />
          </div>

          <div className="relative mt-6 lg:mt-0">
            <h1 className="text-2xl font-extrabold tracking-tight lg:text-[2.1rem]">
              Falta pouco pra sua conta ficar sua
            </h1>
            {/* ⚠️ A FRASE DIZ PARA QUE SERVE, e não "complete seu perfil".
              * Perfil é vocabulário de sistema; contrato e cabeçalho são
              * coisas que ele reconhece. Quem entende por que está digitando
              * digita. */}
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              São cinco linhas. Duas vão no seu contrato com a plataforma, e
              uma delas é o nome que as famílias vão ver no lugar de
              &ldquo;Início&rdquo;.
            </p>
          </div>

          <p className="relative hidden text-xs text-white/40 lg:block">
            alobuzinou.com.br
          </p>
        </header>

        <div
          aria-hidden
          className="h-[2px] shrink-0 bg-gradient-to-r from-primary via-accent to-primary lg:hidden"
        />

        <main className="flex items-start justify-center px-4 py-8 lg:items-center lg:px-10">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-[440px] space-y-5 rounded-3xl border border-border bg-card p-6 shadow-rest lg:p-8"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
                quem é você
              </p>
              <div className="mt-3 space-y-3">
                <Input
                  label="Seu nome completo"
                  placeholder="como está no documento"
                  icon={User}
                  value={form.name}
                  onChange={set('name')}
                  error={errors.name}
                  autoComplete="name"
                  required
                />
                <Input
                  label="Cidade"
                  placeholder="São Paulo"
                  icon={MapPin}
                  value={form.city}
                  onChange={set('city')}
                  error={errors.city}
                  hint="Vai no seu contrato com a plataforma."
                  required
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
                onde você roda
              </p>
              <div className="mt-3">
                {/* ⚠️ BAIRRO OU REGIÃO, NUNCA SÓ A CIDADE. "São Paulo" não
                  * diz nada sobre onde a perua está — e é a informação que o
                  * dono usa pra saber se dois motoristas se cruzam. */}
                <Input
                  label="Bairro ou região"
                  placeholder="Vila Mariana, Zona Sul, Grande ABC…"
                  icon={MapPin}
                  value={form.regiao}
                  onChange={set('regiao')}
                  error={errors.regiao}
                  hint="Pode ser amplo. Só precisamos saber a área."
                  required
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-textMuted">
                sua operação{' '}
                <span className="font-normal normal-case tracking-normal">
                  — pode deixar em branco
                </span>
              </p>
              <div className="mt-3 space-y-3">
                {/* O ÚNICO CAMPO DESTA TELA QUE MUDA O APP NA HORA. Ele vira
                  * o cabeçalho do /tio E do /pai, no lugar de "Início" — as
                  * famílias dele leem isso todo dia. Estava enterrado no
                  * perfil, onde quase ninguém chega. */}
                <Input
                  label="Como as famílias te chamam"
                  placeholder="Tio Nino"
                  icon={Sparkles}
                  value={form.marcaNome}
                  onChange={set('marcaNome')}
                  hint="Aparece no topo do app, pra você e pra elas."
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  label="Quantas crianças você transporta hoje"
                  placeholder="0"
                  icon={Bus}
                  value={form.criancas}
                  onChange={set('criancas')}
                  hint="Só pra gente entender seu tamanho. Não é cobrança."
                />
              </div>
            </div>

            <Button type="submit" loading={salvando}>
              Entrar no app
            </Button>

            {/* Sem "pular": os três de cima são contrato, e pular aqui só
              * empurra o bloqueio para o dia em que ele for emitir — com a
              * família esperando do outro lado. */}
          </form>
        </main>
      </div>
    </div>
  );
}
