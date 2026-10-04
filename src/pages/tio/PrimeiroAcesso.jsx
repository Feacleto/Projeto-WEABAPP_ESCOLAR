import { useRef, useState } from 'react';
import { Check, ChevronLeft, FileText, ImagePlus, MapPin, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Spinner from '../../components/common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { completarCadastro, marcarCadastro } from '../../services/associadoService';
import { useChildren } from '../../hooks/useChildren';
import CadastroRapidoDaCrianca from '../../components/children/CadastroRapidoDaCrianca';
import { lugarDaPosicaoAtual } from '../../services/locationService';
import { uploadMarcaLogo, deleteMarcaLogo } from '../../services/photoService';
import { setMarca } from '../../services/userService';
import { updateProfile } from '../../services/profileService';
import { STORAGE_ENABLED } from '../../config/capabilities';
import {
  maskPhone,
  unmaskPhone,
  isValidPhone,
  maskCpfCnpj,
  documentoValido,
} from '../../compartilhado/masks';
import {
  camposQueFaltam,
  deveCadastrarATurma,
  passosQueFaltam,
} from '../../dominio/identidade/cadastroDoMotorista.js';

/**
 * PRIMEIRO ACESSO DO MOTORISTA — um card por cima do app.
 *
 * ── POR QUE VIROU CARD (02/10/2026)
 * Era uma tela cheia que substituía o `/tio`: a pessoa criava a conta e, em
 * vez do app, via um formulário de seis campos. Agora o app abre de verdade
 * por baixo (inerte, ver `PrimeiroAcessoGate` no App.jsx) e o card sobe por
 * cima — ela vê o que está liberando.
 *
 * ── ⚠️ O CARD É CURTO DE PROPÓSITO, e o dono pediu assim
 * Título, campos vazios e um botão. Sem placeholder de exemplo (um "Tio
 * Marcos" escrito dentro do campo confundia), sem pré-preencher o nome do
 * Google (ele quase nunca é o do documento), sem "confira se está como no seu
 * documento" (assusta), sem "já temos seu e-mail", sem "fazer depois". Quem
 * chega aqui só quer terminar. A ÚNICA linha de explicação é a da
 * localização, porque é a única pergunta que pede uma permissão do aparelho.
 *
 * ── SÓ O QUE FALTA
 * Os passos vêm de `passosQueFaltam`, congelados na abertura — senão a lista
 * encolheria a cada passo gravado e os pontinhos de progresso andariam para
 * trás. Dentro de cada passo, só os campos vazios aparecem.
 *
 * ── CIDADE PELA LOCALIZAÇÃO
 * O último passo pede a permissão e grava só os NOMES de cidade e bairro
 * (`lugarDaPosicaoAtual` nunca devolve a coordenada). A cidade é contrato,
 * então quem nega — ou quem está sem sinal — digita a cidade. Travar ali sem
 * campo seria prender alguém que o navegador não vai perguntar de novo.
 *
 * ── NENHUMA RULE MUDOU
 * Tudo é `update` do próprio documento, e a política de `users` para o
 * próprio dono é lista de PROIBIDOS. Nenhum campo daqui está nela.
 */
export default function PrimeiroAcesso() {
  const { user, profile, refreshProfile, logout } = useAuth();
  // ⚠️ A TURMA É O ÚLTIMO PASSO (04/10/2026): quem ainda não tem criança
  // cadastra as crianças aqui dentro, antes do "Pronto". Conta antiga, com
  // turma, nunca vê este passo (`deveCadastrarATurma`).
  const [passos] = useState(() => {
    const p = passosQueFaltam(profile);
    return !p.includes('turma') && deveCadastrarATurma(profile) ? [...p, 'turma'] : p;
  });
  const [indice, setIndice] = useState(0);
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;
  const proximo = passos[indice + 1];
  // A turma em quatro momentos: a frase, a ficha rápida, a criança salva, o pronto.
  const [momentoDaTurma, setMomentoDaTurma] = useState('intro');
  const [autorizou, setAutorizou] = useState(false);
  const [ultimaCrianca, setUltimaCrianca] = useState('');
  const { children: turma } = useChildren();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    gender: '',
    marcaNome: '',
    city: '',
    // O passo do contrato CONFERE o que já existir (ele pode ter preenchido
    // um dos dois no perfil antes) — não é placeholder, é o dado dele.
    companyDocument: maskCpfCnpj(profile?.companyDocument || ''),
    companyAddress: profile?.companyAddress || '',
  });
  // Depois de escolher homem ou mulher, o foco desce para o botão do passo:
  // quem toca numa opção está pronto para continuar.
  const botaoRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [salvando, setSalvando] = useState(false);
  // A localização falhou (negada, sem sinal, sem cidade): aparece o campo.
  const [digitarCidade, setDigitarCidade] = useState(false);

  const [logoURL, setLogoURL] = useState(profile?.marcaLogoURL || null);
  const [subindoLogo, setSubindoLogo] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const faltando = (campo) => camposQueFaltam(profile, passo).includes(campo);

  // Antes da turma, o cadastro da conta está completo: grava a data e marca
  // o começo da turma (é o que mantém o card aberto se ele fechar o app).
  // ⚠️ A MARCA DA TURMA VEM PRIMEIRO: se o perfil chegasse completo sem ela,
  // o card fecharia por um instante no meio do caminho.
  const irParaATurma = async () => {
    await marcarCadastro(user.uid, ['turmaIniciadaEm']);
    await completarCadastro(user.uid, {}, { ultimo: true });
  };

  const gravar = async (dados) => {
    setSalvando(true);
    try {
      await completarCadastro(user.uid, dados, { ultimo });
      if (ultimo) {
        await refreshProfile();
      } else {
        if (proximo === 'turma') await irParaATurma();
        setErrors({});
        setIndice((i) => i + 1);
      }
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const continuar = (e) => {
    e.preventDefault();
    const errs = {};
    if (passo === 'voce') {
      if (faltando('name') && !form.name.trim()) errs.name = 'Escreva seu nome.';
      if (faltando('phone') && !isValidPhone(form.phone)) errs.phone = 'WhatsApp com DDD.';
      if (faltando('gender') && !form.gender) errs.gender = 'Escolha uma opção.';
    }
    if (passo === 'marca' && !form.marcaNome.trim()) {
      errs.marcaNome = 'Escreva como as famílias te chamam.';
    }
    if (passo === 'local' && !form.city.trim()) errs.city = 'Escreva sua cidade.';
    if (passo === 'contrato') {
      if (!documentoValido(form.companyDocument)) {
        errs.companyDocument = 'CPF ou CNPJ inválido — confira os números.';
      }
      if (form.companyAddress.trim().length < 5) {
        errs.companyAddress = 'Escreva a rua e o número.';
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (passo === 'contrato') {
      gravarContrato();
      return;
    }

    gravar({
      ...(passo === 'voce'
        ? { name: form.name, phone: unmaskPhone(form.phone), gender: form.gender }
        : {}),
      ...(passo === 'marca' ? { marcaNome: form.marcaNome } : {}),
      ...(passo === 'local' ? { city: form.city } : {}),
    });
  };

  /* O CONTRATO GRAVA PELO MESMO CAMINHO DO `DadosDoContratoForm`
   * (`updateProfile`, os campos `company*` que o contrato e as rules já
   * leem). O nome não é perguntado de novo: é o que ele deu no passo 1 (ou o
   * que já estava no perfil). `completarCadastro` só entra para o carimbo de
   * fim, quando este é o último passo. */
  const gravarContrato = async () => {
    setSalvando(true);
    try {
      // A CIDADE NÃO É PEDIDA DE NOVO: ela veio do passo da localização e
      // entra no fim do endereço do contrato, se ele não a escreveu.
      const cidade = (form.city || profile?.city || '').trim();
      const rua = form.companyAddress.trim();
      const endereco =
        cidade && !rua.toLowerCase().includes(cidade.toLowerCase()) ? `${rua}, ${cidade}` : rua;
      await updateProfile(user.uid, {
        companyName: (profile?.companyName || form.name || profile?.name || '').trim(),
        companyDocument: form.companyDocument.trim(),
        companyAddress: endereco,
      });
      await depoisDoContrato();
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const depoisDoContrato = async () => {
    if (ultimo) {
      await completarCadastro(user.uid, {}, { ultimo: true });
      await refreshProfile();
    } else {
      if (proximo === 'turma') await irParaATurma();
      setErrors({});
      setIndice((i) => i + 1);
    }
  };

  // "PULAR POR AGORA" (04/10/2026, decisão do dono): o pedido volta na hora
  // de mandar o primeiro contrato (InviteShare), com o mesmo texto.
  const pularContrato = async () => {
    setSalvando(true);
    try {
      await marcarCadastro(user.uid, ['contratoPuladoEm']);
      await depoisDoContrato();
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const permitirLocalizacao = async () => {
    setSalvando(true);
    try {
      const lugar = await lugarDaPosicaoAtual();
      await gravar(lugar);
    } catch (err) {
      setSalvando(false);
      setDigitarCidade(true);
      if (err?.code !== 'negado') {
        toast.error('Não deu pra achar sua cidade. Escreva aqui.');
      }
    }
  };

  /* O logo é gravado na hora, como antes: o arquivo vai pro Storage e volta
   * uma URL, e segurar isso até o "Continuar" esconderia o upload atrás do
   * botão. Ele não trava o passo — exigir um arquivo trava quem está na rua
   * sem imagem pronta. */
  const escolherLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.uid) return;
    setSubindoLogo(true);
    try {
      const url = await uploadMarcaLogo(user.uid, file);
      await setMarca(user.uid, { logoURL: url });
      setLogoURL(url);
    } catch (err) {
      console.error('Upload do logo falhou:', err);
      toast.error('Não deu pra enviar a imagem.');
    } finally {
      setSubindoLogo(false);
    }
  };
  const removerLogo = async () => {
    if (!user?.uid) return;
    setSubindoLogo(true);
    try {
      await deleteMarcaLogo(user.uid);
      await setMarca(user.uid, { logoURL: null });
      setLogoURL(null);
    } catch (err) {
      console.error('Falha ao remover o logo:', err);
      toast.error('Não deu pra remover agora.');
    } finally {
      setSubindoLogo(false);
    }
  };

  const concluirTurma = async () => {
    setSalvando(true);
    try {
      await marcarCadastro(user.uid, ['turmaConcluidaEm']);
      setMomentoDaTurma('pronto');
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  const voltar = () => {
    setErrors({});
    setIndice((i) => Math.max(0, i - 1));
  };

  if (!passo) return null;

  const barra = passos.length > 1 && (
    <div className="mb-4 flex gap-1.5" aria-hidden>
      {passos.map((p, i) => (
        <span
          key={p}
          className={`h-1 flex-1 rounded-full ${i <= indice ? 'bg-primary' : 'bg-border'}`}
        />
      ))}
    </div>
  );
  // "VOLTAR" EM TODO PASSO (04/10/2026): o card só andava para a frente. No
  // primeiro, a saída é "Sair desta conta" (quem entrou com o Google errado).
  const topoDoCard =
    indice > 0 ? (
      <button
        type="button"
        onClick={voltar}
        className="tap -ml-1 mb-1 inline-flex min-h-11 items-center gap-1 text-base font-bold text-primary"
      >
        <ChevronLeft size={18} aria-hidden="true" /> Voltar
      </button>
    ) : null;

  // ── A TURMA, dentro do mesmo cartão ───────────────────────────────────────
  if (passo === 'turma') {
    const n = turma.length;
    return (
      <div
        className="animate-sheet-fade fixed inset-0 z-[70] flex items-end justify-center bg-night/45 p-3 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="primeiro-acesso-titulo"
      >
        <div className="max-h-[94dvh] w-full max-w-[420px] overflow-y-auto rounded-3xl bg-card p-5 shadow-float">
          {momentoDaTurma !== 'pronto' && momentoDaTurma !== 'salva' && topoDoCard}
          {momentoDaTurma !== 'pronto' && barra}

          {momentoDaTurma === 'intro' && (
            <>
              <h2 id="primeiro-acesso-titulo" className="text-xl font-extrabold text-text">
                Agora, a sua turma
              </h2>
              <p className="mt-1.5 text-base text-textMuted">Cadastre as crianças que você leva.</p>
              {/* A declaração do cadastro de hoje, uma vez para a turma toda. */}
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-primarySoft p-3 text-base text-text">
                <input
                  type="checkbox"
                  checked={autorizou}
                  onChange={(e) => setAutorizou(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-primary"
                />
                As famílias me autorizaram a cadastrar os dados das crianças.
              </label>
              <div className="mt-5">
                <Button
                  type="button"
                  disabled={!autorizou}
                  onClick={() => setMomentoDaTurma('ficha')}
                  className="shadow-focus"
                >
                  {n > 0 ? 'Cadastrar mais uma criança' : 'Cadastrar a primeira criança'}
                </Button>
                {n > 0 && (
                  <button
                    type="button"
                    onClick={concluirTurma}
                    className="tap mt-2 flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border bg-card text-base font-bold text-primary"
                  >
                    Já cadastrei todas as minhas crianças
                  </button>
                )}
              </div>
            </>
          )}

          {momentoDaTurma === 'ficha' && (
            <>
              <h2 id="primeiro-acesso-titulo" className="mb-4 text-xl font-extrabold text-text">
                Nova criança
              </h2>
              <CadastroRapidoDaCrianca
                onSalva={({ nome }) => {
                  setUltimaCrianca(nome);
                  setMomentoDaTurma('salva');
                }}
              />
            </>
          )}

          {momentoDaTurma === 'salva' && (
            <>
              <h2 id="primeiro-acesso-titulo" className="text-xl font-extrabold text-text">
                {ultimaCrianca ? `${ultimaCrianca} está na sua turma` : 'Criança cadastrada'}
              </h2>
              <p className="mt-1.5 text-base text-textMuted">
                Sua turma no app: {n} {n === 1 ? 'criança' : 'crianças'}
              </p>
              <div className="mt-5 space-y-2">
                <Button type="button" onClick={() => setMomentoDaTurma('ficha')} className="shadow-focus">
                  Cadastrar mais uma criança
                </Button>
                <button
                  type="button"
                  onClick={concluirTurma}
                  disabled={salvando}
                  className="tap flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border bg-card text-base font-bold text-primary disabled:opacity-60"
                >
                  Já cadastrei todas as minhas crianças
                </button>
              </div>
            </>
          )}

          {momentoDaTurma === 'pronto' && (
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primaryChip text-primary">
                <Check size={32} aria-hidden="true" />
              </span>
              <h2 id="primeiro-acesso-titulo" className="mt-3 text-xl font-extrabold text-text">
                Pronto! Seu ambiente digital de trabalho está configurado
              </h2>
              <p className="mt-1.5 text-base text-textMuted">
                {n} {n === 1 ? 'criança já está' : 'crianças já estão'} no app.
              </p>
              <div className="mt-5">
                <Button type="button" onClick={() => refreshProfile()} className="shadow-focus">
                  Começar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="animate-sheet-fade fixed inset-0 z-[70] flex items-end justify-center bg-night/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="primeiro-acesso-titulo"
    >
      <form
        onSubmit={continuar}
        className="max-h-[94dvh] w-full max-w-[420px] overflow-y-auto rounded-3xl bg-card p-5 shadow-float"
      >
        {topoDoCard}
        {barra}

        {passo === 'voce' && (
          <>
            <h2 id="primeiro-acesso-titulo" className="text-xl font-extrabold text-text">
              Seus dados
            </h2>
            <div className="mt-4 space-y-3">
              {faltando('name') && (
                <Input falar="nome"
                  label="Seu nome completo"
                  value={form.name}
                  onChange={set('name')}
                  error={errors.name}
                  autoComplete="name"
                  required
                />
              )}
              {faltando('phone') && (
                <Input
                  label="WhatsApp"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: maskPhone(e.target.value) }))}
                  error={errors.phone}
                  autoComplete="tel"
                  required
                />
              )}
              {faltando('gender') && (
                <div>
                  {/* O AVATAR SEGUE ESTA RESPOSTA: homem ganha cabelo curto,
                    * mulher cabelo comprido. Sem ela o desenho era sorteado. */}
                  <p className="mb-2 text-sm font-semibold text-text">Você é</p>
                  {/* `data-campo-escolha` + `tabIndex={-1}`: o Salvar do nome
                    * PARA aqui em vez de enviar o card (avancarCampo.js). */}
                  <div
                    className="grid grid-cols-2 gap-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    role="radiogroup"
                    aria-label="Você é"
                    data-campo-escolha
                    tabIndex={-1}
                  >
                    {[
                      { value: 'male', label: 'Homem' },
                      { value: 'female', label: 'Mulher' },
                    ].map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        role="radio"
                        aria-checked={form.gender === g.value}
                        onClick={() => {
                          setForm((p) => ({ ...p, gender: g.value }));
                          botaoRef.current?.focus();
                        }}
                        className={`tap min-h-12 rounded-xl border-2 px-2 text-sm font-semibold transition-colors duration-estado ${
                          form.gender === g.value
                            ? 'border-primary bg-primarySoft text-text'
                            : 'border-border bg-card text-textMuted'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                  {errors.gender && <p className="mt-1.5 text-xs text-dangerText">{errors.gender}</p>}
                </div>
              )}
            </div>
          </>
        )}

        {passo === 'marca' && (
          <>
            <h2 id="primeiro-acesso-titulo" className="text-xl font-extrabold text-text">
              Sua marca
            </h2>
            <div className="mt-4 space-y-3">
              <Input falar="texto"
                label="Como as famílias te chamam"
                value={form.marcaNome}
                onChange={set('marcaNome')}
                error={errors.marcaNome}
                required
              />
              {/* Escondido sem Cloud Storage, e não desabilitado — a regra de
                * `capabilities.js`. */}
              {STORAGE_ENABLED && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-text">Logo (opcional)</p>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-sunken px-3 py-2.5">
                    {subindoLogo ? (
                      <Spinner size={22} className="text-primary" />
                    ) : logoURL ? (
                      <img src={logoURL} alt="" className="h-9 w-auto max-w-[96px] shrink-0 rounded-lg object-contain" />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primaryChip text-primary">
                        <ImagePlus size={18} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-text">
                      {form.marcaNome.trim()}
                    </span>
                    {logoURL ? (
                      <button
                        type="button"
                        onClick={removerLogo}
                        disabled={subindoLogo}
                        aria-label="Remover o logo"
                        className="tap shrink-0 rounded-lg p-1.5 text-textMuted hover:text-text disabled:opacity-50"
                      >
                        <X size={16} />
                      </button>
                    ) : (
                      /* Botão SECUNDÁRIO de 48 px (04/10/2026): era um texto
                       * de 12px que a pessoa cansada não achava. */
                      <label className="tap inline-flex h-12 shrink-0 cursor-pointer items-center rounded-xl border border-border bg-card px-4 text-base font-bold text-text hover:bg-sunken">
                        Escolher imagem
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={subindoLogo}
                          onChange={escolherLogo}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {passo === 'local' && (
          <>
            <h2 id="primeiro-acesso-titulo" className="text-xl font-extrabold text-text">
              Localização
            </h2>
            {/* A única linha de explicação do card: para que serve. Desligar
              * mora na chave do início de cada rota (ControleDeRota). */}
            <p className="mt-1.5 text-sm text-textMuted">
              Para as famílias verem a perua chegando.
            </p>
            {digitarCidade && (
              <div className="mt-4">
                <Input falar="nome"
                  label="Sua cidade"
                  value={form.city}
                  onChange={set('city')}
                  error={errors.city}
                  autoComplete="address-level2"
                  required
                />
              </div>
            )}
          </>
        )}

        {passo === 'contrato' && (
          <>
            <h2 id="primeiro-acesso-titulo" className="text-xl font-extrabold text-text">
              Para o seu contrato com as suas famílias
            </h2>
            {/* A linha diz POR QUE pede: documento é o campo em que a pessoa
              * mais hesita, e sem motivo à vista ele parece cadastro de banco. */}
            <p className="mt-1.5 text-sm text-textMuted">
              Seu contrato com as famílias agora vai ser digital.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                label="CPF ou CNPJ"
                icon={FileText}
                inputMode="numeric"
                value={form.companyDocument}
                onChange={(e) =>
                  setForm((p) => ({ ...p, companyDocument: maskCpfCnpj(e.target.value) }))
                }
                error={errors.companyDocument}
                required
              />
              <Input falar="texto"
                label="Rua e número"
                icon={MapPin}
                value={form.companyAddress}
                onChange={set('companyAddress')}
                error={errors.companyAddress}
                autoComplete="street-address"
                required
              />
            </div>
          </>
        )}

        <div className="mt-5">
          {passo === 'local' && !digitarCidade ? (
            <>
              <Button
                type="button"
                icon={MapPin}
                loading={salvando}
                onClick={permitirLocalizacao}
                className="shadow-focus"
              >
                Permitir localização
              </Button>
              {/* Quem nega a permissão no reflexo não fica preso. */}
              <button
                type="button"
                onClick={() => setDigitarCidade(true)}
                className="tap mt-2 flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border bg-card text-base font-bold text-text"
              >
                Digitar minha cidade
              </button>
            </>
          ) : (
            <Button
              ref={botaoRef}
              type="submit"
              loading={salvando || subindoLogo}
              className="shadow-focus"
            >
              {ultimo ? 'Entrar no app' : 'Continuar'}
            </Button>
          )}
          {passo === 'contrato' && (
            <button
              type="button"
              onClick={pularContrato}
              disabled={salvando}
              className="tap mt-2 flex min-h-12 w-full items-center justify-center text-base font-bold text-primary disabled:opacity-60"
            >
              Pular por agora
            </button>
          )}
          {indice === 0 && (
            <button
              type="button"
              onClick={() => logout?.()}
              className="tap mt-2 flex min-h-12 w-full items-center justify-center text-base font-semibold text-textMuted"
            >
              Sair desta conta
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
