import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, User, Mail, Bus, MapPin, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import FundoNoturno from '../components/common/FundoNoturno';
import { SITE_INSTITUCIONAL } from '../config/vitrine';
import { ArtRoad } from '../components/landing/BlockArt';
import { inscreverAssociado } from '../services/associadoService';
import { useAuth } from '../hooks/useAuth';
import { maskPhone, unmaskPhone, isValidPhone, isValidEmail } from '../compartilhado/masks';
import { resolverOrigem } from '../dominio/identidade/origem.js';

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
  const location = useLocation();

  // DE ONDE ELE VEIO DECIDE PRA ONDE O "VOLTAR" LEVA.
  //
  // Quem chega pela bifurcação do login está NO MEIO de uma escolha, e jogar
  // essa pessoa pra fora do app (pro site institucional) desfaz mais do que
  // ela pediu — ela queria trocar de porta, não sair. Quem chega por link
  // direto ou pela landing continua saindo pro site, que é de onde veio.
  const veioDaEscolha = location.state?.de === 'escolha';

  // DE ONDE ELE VEIO — lido da URL, nunca perguntado.
  //
  // A landing repassa `?o=` (o `utm_source` que a casa publicou) e `?r=` (o
  // host de onde a pessoa clicou). Quem traduz isso num canal da lista
  // fechada é `dominio/identidade/origem.js` — aqui só se lê e se guarda.
  //
  // ⚠️ É TEXTO DE URL, logo é de quem visita: qualquer pessoa edita `?o=` na
  // barra de endereço. `resolverOrigem` devolve sempre um canal da lista, e o
  // texto cru sobrevive truncado em `detalhe` — nada disso vira permissão,
  // preço ou prazo, então mentir aqui só suja a própria contagem.
  //
  // `useState` com inicializador, e não `useMemo`: a origem é do INSTANTE em
  // que a tela abriu. Se a pessoa mexer na URL depois, o que valeu é o que
  // trouxe ela até aqui.
  const [origem] = useState(() => {
    const q = new URLSearchParams(location.search);
    return resolverOrigem({
      utmSource: q.get('o') || q.get('utm_source') || '',
      referrer: q.get('r') || '',
    });
  });
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    senha: '',
    city: '',
    criancas: '',
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
      // A CONTA NASCE OPERANDO — não há mais lista, nem fila, nem espera.
      //
      // Antes daqui saíam DUAS escritas: um lead em `waitlistDrivers` e a
      // conta em `aguardando`. A lista existia porque quem decidia era uma
      // pessoa, e o pedido não podia se perder enquanto ela não decidisse.
      //
      // Ninguém decide mais: ele entra e roda. O que o segura é o teste de
      // três meses, que começa na primeira rota — e o registro de intenção
      // virou o próprio cadastro, que é um documento só.
      await inscreverAssociado({
        email: form.email,
        senha: form.senha,
        nome: form.name,
        telefone: unmaskPhone(form.phone),
        cidade: form.city,
        criancas: form.criancas,
        origem,
      });

      await refreshProfile();
      toast.success('Pronto! Sua conta está criada. Bem-vindo ao Alô Buzinou.');
      navigate('/tio', { replace: true });
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

  // A TELA DE CONFIRMAÇÃO SAIU DAQUI, E DEPOIS A SALA DE ESPERA TAMBÉM.
  //
  // A primeira mostrava "recebemos seu pedido" e um botão de voltar — o ponto
  // exato em que o interesse esfriava. A segunda mostrava a posição na fila,
  // e era persistente, o que era melhor.
  //
  // Agora não há o que esperar: quem termina o formulário cai no painel dele,
  // com a perua vazia e o cadastro de turma na frente. A melhor tela pós-
  // cadastro é o produto.

  return (
    /**
     * DUAS COLUNAS NO MONITOR, EMPILHADO NO CELULAR.
     *
     * Esta tela vivia só dentro dos 480px do #root, e é a tela onde o
     * MOTORISTA decide entrar — ele costuma abrir isso sentado, no
     * computador, depois de conversar com o consultor. Numa tira estreita no
     * meio de um monitor vazio, um formulário de sete campos lê como
     * formulário sem fim.
     *
     * `data-painel="web"` solta o teto pela regra `:has()` do index.css, e o
     * `w-screen` com translate é a garantia pra navegador sem `:has()` — o
     * mesmo par que a tela de login usa. Aqui ele é seguro porque nada nesta
     * tela é `sticky`.
     */
    <div
      data-painel="web"
      className="relative left-1/2 w-screen -translate-x-1/2 bg-bg"
    >
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
      {/* Tampa escura, corpo claro — a mesma regra da folha modal e das
        * outras portas: marca em cima, produto embaixo. Assim o motorista
        * que vem do cartão "sou motorista escolar" não sente que trocou de
        * aplicativo no meio do caminho. */}
      <header className="relative overflow-hidden rounded-b-[28px] bg-[#0B1210] px-6 pb-7 pt-5 text-white lg:flex lg:flex-col lg:justify-between lg:rounded-none lg:px-14 lg:py-14">
        <FundoNoturno />

        {/* TRÊS FILHOS NO FLEX DA COLUNA ESCURA: o voltar no alto, o miolo no
          * meio, o domínio embaixo. É o mesmo arranjo da tela de login, e é o
          * que impede o texto de flutuar no meio de um vazio de 300px quando
          * a coluna tem a altura de um monitor. */}
        <div className="relative">
          {/* Quem veio da bifurcação volta PRA ELA — trocar de porta é o
            * arrependimento provável aqui, e ele é de dentro do app. Quem
            * chegou de fora volta pro site institucional, que é OUTRO
            * domínio: por isso `<a>` e não `<Link>`, que montaria caminho
            * relativo. Ver SITE_INSTITUCIONAL em config/vitrine.js. */}
          {veioDaEscolha ? (
            <Link
              to="/login?criar=1"
              className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-white/60 hover:text-white"
            >
              <ArrowLeft size={16} /> Voltar para a escolha
            </Link>
          ) : (
            <a
              href={SITE_INSTITUCIONAL}
              className="tap -ml-1 inline-flex items-center gap-1 p-1 text-sm text-white/60 hover:text-white"
            >
              <ArrowLeft size={16} /> Voltar
            </a>
          )}
        </div>

        <div className="relative">
          {/* ⚠️ ESTA TELA PROMETIA UMA FILA E UMA LIGAÇÃO, e o botão dela cria
            * a conta e entra no app. O texto sobreviveu à decisão 16.
            *
            * "Vaga limitada por estrutura" e "a gente chama" descreviam o
            * modelo em que alguém aprovava — e prometer uma conversa que não
            * vai acontecer é pior que não prometer nada: a pessoa fica
            * esperando o telefone tocar em vez de usar o app que já é dela. */}
          {/* O CHAPÉU DIZ DE QUEM É A PORTA, e antes dizia o prazo do teste.
            *
            * "3 meses de teste" é a oferta, e oferta no chapéu obriga a frase
            * de baixo a explicar a oferta em vez de explicar a tela. "Pra quem
            * dirige" faz o par com "pra quem espera na porta" da tela da
            * família: quem trocou de porta por engano descobre no chapéu, que
            * é a primeira coisa acima do título. */}
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-onNightAccent/80 lg:mt-0">
            pra quem dirige
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight lg:text-[2.1rem]">
            Comece a usar hoje
          </h1>
          {/* ⚠️ A FRASE RESPONDE "O QUE ACONTECE DEPOIS QUE EU MANDAR".
            *
            * Ela falava de quando o relógio do teste começa — informação
            * verdadeira e da tela ERRADA: quem está com o dedo no formulário
            * não pergunta pelo prazo, pergunta se vai ter que esperar alguém.
            * Esta tela já foi a porta de uma fila, e o texto dela prometeu
            * uma ligação que não acontece mais (decisão 16). Dizer que não há
            * fila é desfazer essa promessa no único lugar onde ela ainda
            * podia ser lida. */}
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            Você preenche, entra e já cadastra a sua turma.{' '}
            <strong className="font-semibold text-white">
              Não tem fila e não tem ninguém pra aprovar
            </strong>{' '}
            — a conta é sua no fim do formulário.
          </p>

          <div className="mt-5">
            <ArtRoad />
          </div>
        </div>

        <p className="relative hidden text-xs text-white/40 lg:block">
          alobuzinou.com.br
        </p>
      </header>

      {/* A costura entre marca e produto só existe empilhado: lado a lado, a
        * borda entre as duas colunas já faz esse trabalho. */}
      <div
        aria-hidden
        className="h-[2px] shrink-0 bg-gradient-to-r from-primary via-accent to-primary lg:hidden"
      />

      {/* ⚠️ O FORMULÁRIO VIROU UM CARTÃO SOBRE CINZA, e antes era uma coluna
        * branca colada na faixa escura.
        *
        * Sem o cartão, os campos flutuavam no branco da página e a fronteira
        * entre a marca e o trabalho era só a troca de cor de fundo — o que
        * lia como duas metades do mesmo pôster. O cartão é a folha que se
        * preenche: ele tem borda, sombra e fim, e é isso que diz "o que você
        * tem que fazer é aqui dentro".
        *
        * É a mesma superfície do login, e de propósito: quem vem da
        * bifurcação atravessa as duas telas na mesma sessão. */}
      <div className="flex flex-1 flex-col bg-bg px-4 py-6 sm:px-6 lg:px-12 lg:py-16">
        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col rounded-2xl border border-border bg-card p-5 shadow-float sm:p-7 lg:p-8">
        {/* ⚠️ O CARTÃO DE ESCASSEZ SAIU DAQUI EM 06/09/2026.
          *
          * Ele mostrava "1 associado atendido hoje" — número FIXO no código,
          * sem prop, sem `getShowcase` — ao lado de "vaga limitada por
          * estrutura", numa página pública de aquisição onde o cadastro é
          * ABERTO. Escassez declarada onde qualquer um se cadastra em trinta
          * segundos é falsa por construção, e contador inventado em peça de
          * aquisição é o mesmo passivo de CDC art. 37 que desligou o
          * `PISO_DA_VITRINE` e apagou o `config/rodada.js`.
          *
          * Era o último resto da fila: a decisão 16 tirou a porta, e a
          * promessa de porta estreita ficou. */}

        <div className="mb-6">
          {/* "CRIAR SUA CONTA", e não "a gente vai preparar o seu ambiente".
            *
            * O título de um formulário nomeia o que o formulário FAZ. A frase
            * antiga era promessa de marca — bonita, e no lugar de quem tem
            * seis campos para preencher ela vira ruído entre o dedo e o
            * primeiro campo. A promessa já está na faixa ao lado. */}
          <h2 className="text-xl font-extrabold leading-tight tracking-tight text-text lg:text-[1.55rem]">
            Criar sua conta
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-textMuted">
            Seis campos, em três linhas. No fim deles você entra direto no seu
            painel.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* ⚠️ TRÊS GRUPOS COM RÓTULO, e antes eram seis campos numa pilha.
            *
            * Seis campos sem agrupamento se leem como seis perguntas
            * independentes, e a pessoa não sabe quantas faltam. Em três linhas
            * rotuladas ela vê o tamanho do trabalho de uma vez — e o subtítulo
            * pode prometer "seis campos, em três linhas" porque agora isso é
            * verificável na tela.
            *
            * OS RÓTULOS DIZEM O ASSUNTO, NÃO O TIPO DE DADO: "quem você é",
            * "como você entra na sua conta", "sobre a sua operação". Ninguém
            * pensa em "dados de acesso" — pensa em como vai voltar amanhã.
            *
            * E OS PARES MUDARAM DE COMPANHIA. A cidade estava ao lado do
            * WhatsApp, e ela não é contato: é a operação. Agora ela desce para
            * o grupo dela, junto do número de crianças, que é o outro dado que
            * descreve o tamanho do que ele roda. */}
          <Grupo rotulo="quem você é">
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
              required
            />
          </Grupo>

          <Grupo rotulo="como você entra na sua conta">
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
            />
            {/* A senha aparece aqui porque a inscrição CRIA A CONTA. Google
              * fica de fora de propósito: dentro da webview do WhatsApp o
              * OAuth é recusado, e este formulário costuma ser aberto a partir
              * de um link compartilhado. Caminho que falha em metade dos
              * aparelhos é pior que um campo a mais. */}
            <Input
              type="password"
              revealable
              label="Senha"
              placeholder="mínimo 6"
              icon={Lock}
              value={form.senha}
              onChange={set('senha')}
              autoComplete="new-password"
              error={errors.senha}
            />
          </Grupo>

          <Grupo rotulo="sobre a sua operação">
            <Input
              label="Cidade onde você roda"
              placeholder="Cidade Ademar, SP"
              icon={MapPin}
              value={form.city}
              onChange={set('city')}
              error={errors.city}
              required
            />
            {/* Criança, e não van — é sobre ela que o contrato é
              * dimensionado. */}
            <Input
              id="signup-criancas"
              label="Quantas crianças hoje"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="Ex.: 18"
              value={form.criancas}
              onChange={(e) =>
                setForm((p) => ({ ...p, criancas: e.target.value }))
              }
            />
          </Grupo>

          {/* ⚠️ O CAMPO DE MENSAGEM SAIU EM 08/09/2026, e ele era um campo
            * MORTO: `form.message` não era enviado a lugar nenhum. Ele
            * sobrou de quando esta tela era um pedido de entrada na fila, e
            * alguém do outro lado leria "há quanto tempo você roda".
            *
            * Sem fila não há leitor, e um textarea que a pessoa preenche para
            * ninguém é pior que campo nenhum: ela gasta o tempo mais caro do
            * formulário — o de escrever texto livre — no único campo que não
            * produz efeito.
            *
            * E ele fazia o subtítulo mentir: "seis campos" com sete na tela. */}

          {/* "E ENTRAR" no rótulo do botão. Ele não manda um pedido: ele cria
            * a conta e abre o painel. Um botão que diz só "criar minha conta"
            * deixa a pessoa esperando uma confirmação que não vem — ela já
            * está dentro. */}
          <Button type="submit" loading={submitting} icon={Bus}>
            Criar minha conta e entrar
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
      </div>
    </div>
  );
}

/**
 * UM GRUPO DE CAMPOS, com o assunto escrito em cima.
 *
 * Par no monitor, um por linha no celular — e o rótulo é o que transforma
 * seis perguntas soltas em três linhas com tamanho conhecido.
 */
function Grupo({ rotulo, children }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
        {rotulo}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}
