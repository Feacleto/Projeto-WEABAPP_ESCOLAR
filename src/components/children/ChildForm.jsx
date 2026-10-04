import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  MapPin,
  Phone,
  Search,
  Check,
  Home,
  School,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Paperclip,
  ThumbsUp,
  UserPlus,
  Plus,
  Circle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../common/Card';
import MapPicker from '../map/MapPicker';
import LiveMap from '../map/LiveMap';
import InviteShare from './InviteShare';
import NovaEscolaSheet from './NovaEscolaSheet';
import BuscaDeRua from '../endereco/BuscaDeRua';
import Input from '../common/Input';
import CampoDeValor from '../common/CampoDeValor';
import Button from '../common/Button';
import { addChild, updateChild, reservarIdDeCrianca } from '../../services/childrenService';
import { uploadContratoAnterior } from '../../services/photoService';
import { STORAGE_ENABLED } from '../../config/capabilities';
import { usePerguntaDaChavePix } from '../payments/PerguntaDaChavePix';
import { formatCurrency } from '../../compartilhado/formatters';
import { searchAddress, buscarCep } from '../../services/locationService';
import { normalizaHora, periodoDaHora, horaCurta } from '../../dominio/rota/horarios';
import { useEscolas } from '../../hooks/useEscolas';
import { childAvatarUrl } from '../../marca/avatarUrl';
import { useChild } from '../../hooks/useChild';
import {
  maskPhone,
  unmaskPhone,
  isValidPhone,
  maskCep,
  unmaskCep,
  isValidCep, mascaraHora } from '../../compartilhado/masks';
import { montarEndereco } from '../../compartilhado/formatters';
import CampoVigencia from '../contract/CampoVigencia';
import { vigenciaPadrao, erroDaVigencia } from '../../dominio/cobranca/contratoDaFamilia.js';
import BotaoDeFalar from '../common/BotaoDeFalar';

const GENDERS = [
  { value: 'male', label: 'Menino' },
  { value: 'female', label: 'Menina' },
];

const TOTAL_STEPS = 4;

const EMPTY_FORM = {
  // A DECLARAÇÃO DE AUTORIZAÇÃO — camada 1 do consentimento.
  //
  // Ver `docs/consentimento-saude.md`. Ela NÃO é o consentimento da família:
  // é a afirmação do motorista de que tem autorização dela, e existe porque
  // hoje ninguém declarava nada — a criança é cadastrada ANTES do convite, e a
  // responsável pode nunca resgatá-lo.
  //
  // Fica registrada no documento (não só na tela) porque o valor dela é ser
  // rastreável: quem declarou e quando.
  autorizacaoDeclarada: false,
  name: '',
  // VAZIO, E NÃO 'male'.
  //
  // Vinha pré-selecionado como menino. O tio passava direto pelo passo sem
  // tocar em nada e a criança era gravada como menino em silêncio — não
  // havia como distinguir, depois, quem tinha sido escolhido de quem tinha
  // sido herdado. O avatar saía errado e ninguém sabia por quê.
  //
  // Vazio força a escolha e torna o erro impossível de acontecer calado.
  gender: '',
  birthDate: '', // YYYY-MM-DD — usado pra parabenizar no aniversário
  parentName: '',
  parentEmail: '',
  parentPhone: '',
  parent2Name: '',
  parent2Phone: '',
  address: '',
  // O CEP É GRAVADO; NÚMERO E COMPLEMENTO NÃO.
  //
  // Os três entram no `address`, que é a única string que a rota, o mapa, o
  // contrato e a tela do pai leem. Guardar o número num campo próprio TAMBÉM
  // criaria duas versões do mesmo dado e um jeito de elas discordarem — e
  // discordância silenciosa em endereço de criança é o pior tipo.
  //
  // O CEP é a exceção porque ele não é texto de endereço, é a CHAVE dele:
  // guardado, dá pra reconsultar a rua e recalcular a coordenada depois sem
  // pedir nada a ninguém. `addChild` persiste só o que está na lista dele, e
  // os outros dois morrem no formulário de propósito.
  cep: '',
  numero: '',
  complemento: '',
  // O que o ViaCEP devolveu, guardado pra montar a consulta do Nominatim com
  // as partes separadas. `null` significa "este endereço é digitado à mão", e
  // é o que faz o campo livre parar de ser reescrito — ver `Step2Home`.
  cepPartes: null,
  // "NÃO SEI O NÚMERO AGORA" (02/10/2026). O motorista cadastra pela rua e a
  // família completa o número no primeiro acesso dela — quem sabe o número
  // da casa é quem mora nela. Grava `numeroPendente` e as partes da rua.
  semNumero: false,
  lat: '',
  lng: '',
  schoolId: '',
  school: '',
  schoolAddress: '',
  schoolLat: '',
  schoolLng: '',
  // O que foi COMBINADO com o pai: a hora que a perua encosta na porta e a
  // hora que a criança volta. É isto que organiza o dia do motorista e é isto
  // que o pai vê — não o horário da escola, que é outra coisa.
  horaPega: '',
  horaEntrega: '',
  period: 'morning',
  pickupPeriod: 'morning',
  dropoffPeriod: 'afternoon',
  monthlyFee: '',
  dueDay: '10',
  turma: '',
  professora: '',
  notes: '',
};

function vigenciaDoForm() {
  const v = vigenciaPadrao();
  return { vigenciaInicio: v.inicio, vigenciaFim: v.fim };
}

/**
 * Cadastro de criança em wizard (4 passos curtos).
 * Cada passo valida antes de avançar. Voltar é livre. Os nomes abaixo são os
 * de `STEP_LABELS`, e o título de cada passo é o MESMO nome (eram dois: a
 * barra dizia "Onde estuda" e a tela dizia "Escola e horários").
 *   1. Quem é a criança          — nome, menino ou menina, a declaração de
 *                                  autorização (o período sai da hora, no 3)
 *   2. Onde mora                 — endereço (CEP, busca pela rua, mapa)
 *   3. Escola e horários         — escola, turma, hora de pegar e de entregar
 *   4. Responsável e mensalidade — nome/telefone, mensalidade, vencimento, prazo
 *
 * Após salvar, mostra a tela de sucesso com o convite pro responsável.
 *
 * ERRO LEVA AO CAMPO. Ao falhar a validação, além do aviso, a tela rola até o
 * primeiro campo marcado e põe o cursor nele — com o teclado aberto, o campo
 * errado costumava ficar escondido embaixo dele, e o "confira o que tá
 * destacado" mandava procurar algo que a pessoa não via.
 */
export default function ChildForm() {
  const navigate = useNavigate();
  // A vigência nasce pronta (de hoje até o fim do ano) — ver `vigenciaPadrao`.
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...vigenciaDoForm() }));
  const [step, setStep] = useState(1);
  // As escolas moram AQUI, e não só no passo 3, porque o rodapé precisa
  // saber se há alguma: sem escola, o protagonista do passo é "Cadastrar
  // escola", e o "Avançar" vira contorno (04/10/2026). Uma escuta só.
  const { escolas, loading: carregandoEscolas } = useEscolas();
  const semEscola = step === 3 && !carregandoEscolas && escolas.length === 0;
  // O id da criança, reservado já no começo: é ele que sorteia o avatar, e o
  // topo mostra a criança desde o passo 2 com o MESMO rosto da ficha.
  const [idReservado, setIdReservado] = useState(() => reservarIdDeCrianca());
  // CADA PASSO ABRE NO TOPO, como uma tela nova (03/10/2026): o passo muda
  // sem mudar o endereço, e ele tocava em Avançar no fim da página e caía
  // no meio do passo seguinte, sem ver o título.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);
  const [createdId, setCreatedId] = useState(null);
  const [errors, setErrors] = useState({});
  const { perguntarPix, folhaDoPix } = usePerguntaDaChavePix();
  const [pixPerguntado, setPixPerguntado] = useState(false);

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setPhone = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: maskPhone(e.target.value) }));

  function validateStep(s) {
    const errs = {};
    if (s === 1) {
      if (!form.name.trim()) errs.name = 'Diga o nome da criança.';
      // Obrigatório agora que o campo não vem pré-respondido. É o que decide
      // o rosto que a criança vai ter na lista, e um chute do sistema custa
      // mais caro do que um toque a mais aqui.
      if (!form.gender) errs.gender = 'Escolha menino ou menina.';
      // OBRIGATÓRIA, e é o ponto: uma declaração opcional não declara nada.
      // Fica no passo 1, junto do nome, porque é sobre a criança inteira — e
      // não no fim, onde ela seria um pedágio no momento em que ele já quer
      // salvar.
      if (!form.autorizacaoDeclarada) {
        errs.autorizacaoDeclarada =
          'Confirme que você tem autorização do responsável.';
      }
    }
    if (s === 2) {
      // Só o texto do endereço é obrigatório. A coordenada NÃO bloqueia:
      // o Nominatim não conhece boa parte dos endereços de periferia, e
      // exigir o geocoding deixava o tio sem conseguir cadastrar a criança.
      // Quem ficar sem coordenada é salvo com geoPending e resolve depois.
      if (!form.address.trim()) errs.address = 'Diga o endereço de casa.';
      // O NÚMERO SÓ É EXIGIDO DE QUEM USOU O CEP, e a assimetria é o ponto.
      //
      // Com a rua preenchida pelo ViaCEP, o número é a única coisa que separa
      // "a rua certa" da "casa certa" — e é exatamente o que se esquece num
      // campo livre. Aqui ele tem campo próprio, então pode ser cobrado.
      //
      // Quem NÃO consultou o CEP segue digitando tudo numa linha, como sempre:
      // cobrar o campo separado de quem não tem a rua preenchida devolveria o
      // pedágio que o CEP veio tirar.
      if (form.cepPartes?.logradouro && !form.semNumero && !form.numero.trim()) {
        errs.numero = 'Falta o número da casa.';
      }
    }
    // Escola é OPCIONAL: o tio muitas vezes cadastra a criança no meio da
    // rota e completa a ficha depois. Validamos só o que foi preenchido.
    if (s === 3) {
      // Horário é o que organiza o dia inteiro. Se ele digitou alguma coisa,
      // ela precisa ser uma hora de verdade — '7' vira 07:00, 'manhã' não vira
      // nada e não pode ser salvo como se fosse.
      if (form.horaPega.trim() && !normalizaHora(form.horaPega)) {
        errs.horaPega = 'Hora inválida. Ex: 06:20';
      }
      if (form.horaEntrega.trim() && !normalizaHora(form.horaEntrega)) {
        errs.horaEntrega = 'Hora inválida. Ex: 12:35';
      }
    }
    // Responsável e financeiro: só o telefone é indispensável — é por ele
    // que o convite chega. Email e mensalidade podem vir depois.
    if (s === 4) {
      if (!isValidPhone(form.parentPhone))
        errs.parentPhone = 'Telefone com DDD — é por aqui que o convite vai.';
      if (form.parent2Phone && !isValidPhone(form.parent2Phone))
        errs.parent2Phone = 'Telefone inválido.';
      const fee = parseFloat(form.monthlyFee);
      if (String(form.monthlyFee).trim() && (!fee || fee <= 0))
        errs.monthlyFee = 'Valor precisa ser maior que zero.';
      const day = parseInt(form.dueDay, 10);
      if (form.dueDay && (!day || day < 1 || day > 28))
        errs.dueDay = 'Dia entre 1 e 28.';
      const vig = erroDaVigencia(form.vigenciaInicio, form.vigenciaFim);
      if (vig) errs.vigencia = vig;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const onAdvance = async () => {
    if (!validateStep(step)) {
      toast.error('Confira o que tá destacado.');
      focarPrimeiroErro();
      return;
    }
    // O PONTO NO MAPA SAI SOZINHO quando a rua veio da busca ou do CEP: uma
    // consulta só, ao sair do passo. Não achar não trava — a criança é salva
    // com `geoPending`, como sempre.
    if (step === 2 && form.cepPartes?.logradouro && (form.lat === '' || form.lat == null)) {
      try {
        const r = await searchAddress(form.address, { ...form.cepPartes, numero: form.numero });
        setForm((prev) => ({ ...prev, lat: r.lat, lng: r.lng }));
      } catch {
        // segue sem coordenada
      }
    }
    if (step < TOTAL_STEPS) setStep(step + 1);
    else onSubmit();
  };

  const onBack = () => {
    setErrors({});
    if (step > 1) setStep(step - 1);
    else navigate(-1);
  };

  // A partir do passo 2 a criança já tem o mínimo pra existir (nome +
  // endereço). Deixar o tio salvar aqui é o que evita o abandono no meio do
  // formulário — ele volta na ficha e completa quando estiver parado.
  const canSaveEarly = step >= 2 && !!form.name.trim() && !!form.address.trim();

  const onSaveEarly = () => {
    if (!validateStep(step)) {
      toast.error('Confira o que tá destacado.');
      focarPrimeiroErro();
      return;
    }
    onSubmit();
  };

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const horaPega = normalizaHora(form.horaPega);
      const horaEntrega = normalizaHora(form.horaEntrega);
      // (os dados do contrato são pedidos DEPOIS de salvar, no lugar do
      // convite — ver `InviteShare`. Salvar primeiro é deliberado: barrar
      // aqui perderia o que ele acabou de digitar.)
      const { id, inviteCode } = await addChild({
        id: idReservado,
        ...form,
        horaPega: horaPega || '',
        horaEntrega: horaEntrega || '',
        // `period` alimenta o filtro da lista de crianças e os rótulos de
        // ChildCard/ChildDetail. `pickupPeriod`/`dropoffPeriod` são ponte pro
        // cadastro anterior ao modelo de horários, lidos só por
        // `horariosCombinados`. Derivados da hora: o motorista informa uma
        // vez e o rótulo se acerta sozinho, em vez de virar mais dois botões.
        //
        // (Dizia "o Kanban dos seis turnos lê esses campos" — o Kanban foi
        // apagado nos mesmos commits.)
        ...(horaPega ? { pickupPeriod: periodoDaHora(horaPega), period: periodoDaHora(horaPega) } : {}),
        ...(horaEntrega ? { dropoffPeriod: periodoDaHora(horaEntrega) } : {}),
        // Sem número: a rua vai partida para a família completar depois
        // (`PrimeiroAcessoDoPai`), e o ponto fica no meio da rua.
        numeroPendente: !!(form.cepPartes?.logradouro && form.semNumero && !form.numero.trim()),
        enderecoPartes:
          form.cepPartes?.logradouro && form.semNumero && !form.numero.trim()
            ? {
                logradouro: form.cepPartes.logradouro || '',
                bairro: form.cepPartes.bairro || '',
                localidade: form.cepPartes.localidade || '',
                uf: form.cepPartes.uf || '',
              }
            : null,
        parentPhone: unmaskPhone(form.parentPhone),
        parent2Phone: form.parent2Phone ? unmaskPhone(form.parent2Phone) : '',
        monthlyFee: parseFloat(form.monthlyFee) || 0,
        dueDay: parseInt(form.dueDay, 10) || 10,
        vigenciaInicio: form.vigenciaInicio,
        vigenciaFim: form.vigenciaFim,
        // A DATA da declaração, não só o `true`. Um booleano sozinho não diz
        // QUANDO, e é o quando que a torna uma declaração em vez de uma
        // caixa marcada.
        autorizacaoDeclaradaEm: new Date().toISOString(),
      });
      setCreatedCode(inviteCode);
      setCreatedId(id);
      setPixPerguntado(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  /* A PRÓXIMA CRIANÇA JÁ VEM COM A ESCOLA DA ANTERIOR. Quem cadastra a turma
   * cadastra várias crianças da mesma escola em sequência, e escolher de novo
   * a cada uma é o toque mais repetido do dia. Um toque troca. Nome, casa e
   * responsável voltam vazios — esses nunca se repetem por acaso. */
  /* ACABOU DE COMBINAR UMA MENSALIDADE: é a hora em que a chave PIX passa a
   * fazer falta. ⚠️ MAS A PERGUNTA VEM DEPOIS DO CONVITE, e não por cima dele
   * (04/10/2026, aprovado pelo dono): ela cobria o "Mandar convite", que é o
   * gesto da tela. Agora aparece quando ele manda o convite, ou quando sai
   * da tela (outra criança, ver a turma) — uma vez por criança, e o "agora
   * não" vale a sessão inteira. Ver `PerguntaDaChavePix`. */
  const perguntarPixDepois = (depois) => {
    const fee = parseFloat(form.monthlyFee) || 0;
    if (fee <= 0 || pixPerguntado) {
      depois?.();
      return;
    }
    setPixPerguntado(true);
    perguntarPix({
      motivo: 'mensalidade',
      texto: `Você combinou ${formatCurrency(fee)} por mês com a família de ${
        form.name?.trim().split(/\s+/)[0] || 'esta criança'
      }. Pra ela pagar pelo app, falta a sua chave PIX.`,
      depois,
    });
  };

  const cadastrarOutra = () => {
    setForm({
      ...EMPTY_FORM,
      // A próxima criança herda a vigência da anterior: a turma costuma ter
      // o mesmo combinado de prazo.
      vigenciaInicio: form.vigenciaInicio,
      vigenciaFim: form.vigenciaFim,
      schoolId: form.schoolId,
      school: form.school,
      schoolAddress: form.schoolAddress,
      schoolLat: form.schoolLat,
      schoolLng: form.schoolLng,
    });
    setCreatedCode(null);
    setCreatedId(null);
    setErrors({});
    setStep(1);
    setIdReservado(reservarIdDeCrianca());
    window.scrollTo(0, 0);
  };

  if (createdCode) {
    return (
      <>
      {folhaDoPix}
      <InviteCodeSuccess
        code={createdCode}
        childId={createdId}
        childName={form.name}
        gender={form.gender}
        parentName={form.parentName}
        parentPhone={unmaskPhone(form.parentPhone)}
        onEnviado={() => perguntarPixDepois()}
        onOutra={() => perguntarPixDepois(cadastrarOutra)}
        onDone={() =>
          perguntarPixDepois(() => navigate('/tio/children', { replace: true }))
        }
        onVerContratos={() =>
          perguntarPixDepois(() => navigate('/tio/finance/turma'))
        }
      />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header próprio do wizard — sem o Header global pra ter mais espaço */}
      <header className="sticky top-0 z-20 bg-bg px-5 pt-4 pb-3 space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="tap -ml-2 inline-flex min-h-12 items-center gap-1 px-2 text-base font-semibold text-primary"
        >
          <ArrowLeft size={20} />
          {step === 1 ? 'Cancelar' : 'Voltar'}
        </button>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <p className="rotulo">
              Passo {step} de {TOTAL_STEPS}
            </p>
            <p className="text-sm font-semibold text-textMuted">
              {STEP_LABELS[step - 1]}
            </p>
          </div>
          <ProgressBar step={step} total={TOTAL_STEPS} />
        </div>

        {/* DE QUAL CRIANÇA É ESTE CADASTRO (03/10/2026, pedido do dono): do
          * passo 2 em diante, o rosto e o nome dela no topo. Ele cadastra
          * várias seguidas e, no endereço ou na mensalidade, não sabia mais
          * de quem estava falando. */}
        {step > 1 && form.name.trim() && (
          <div className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5 shadow-rest">
            <img
              src={childAvatarUrl({ id: idReservado, gender: form.gender })}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full bg-primaryChip"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-textMuted">Cadastrando</span>
              <span className="block truncate text-lg font-bold text-text">{form.name.trim()}</span>
            </span>
          </div>
        )}
      </header>

      <main className="flex-1 px-5 pt-3 pb-44 space-y-5">
        {step === 1 && (
          <Step1Child
            form={form}
            idReservado={idReservado}
            setForm={setForm}
            setField={setField}
            errors={errors}
          />
        )}
        {step === 2 && (
          <Step2Home form={form} setForm={setForm} errors={errors} />
        )}
        {step === 3 && (
          <Step3School
            escolas={escolas}
            loading={carregandoEscolas}
            form={form}
            setForm={setForm}
            setField={setField}
            errors={errors}
          />
        )}
        {step === 4 && (
          <Step4Parent
            form={form}
            setForm={setForm}
            setField={setField}
            setPhone={setPhone}
            errors={errors}
          />
        )}
      </main>

      {/* Footer com botão "Avançar" / "Cadastrar" fixo.
        * z-40 fica acima do BottomNav (z-30) — esse era o bug que impedia
        * o usuário de avançar do passo 1 em diante (o toque caía no nav).
        * Fundo branco com gradient pra cobrir o nav visualmente. */}
      <footer
        className="fixed bottom-0 left-0 right-0 max-w-mobile mx-auto z-40 px-5 pt-3 bg-bg border-t border-neutro"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 1rem)' }}
      >
        <Button
          onClick={onAdvance}
          // O "Salvar" do último campo de cada passo aciona este botão.
          data-avancar
          loading={submitting}
          icon={step === TOTAL_STEPS ? Check : ArrowRight}
          variant={semEscola ? 'secondary' : 'primary'}
          className={
            semEscola
              ? '!h-14 !text-base'
              : 'shadow-focus !bg-primary hover:!bg-primary !h-14 !text-base'
          }
        >
          {step === TOTAL_STEPS ? 'Cadastrar criança' : 'Avançar'}
        </Button>

        {/* Saída antecipada: a criança já tem o mínimo pra existir. Sem este
          * botão, quem não sabe o CEP da escola ou o valor combinado ficava
          * preso no meio do cadastro e desistia. */}
        {canSaveEarly && step < TOTAL_STEPS && (
          <button
            type="button"
            onClick={onSaveEarly}
            disabled={submitting}
            className="tap w-full min-h-12 text-base font-semibold text-textMuted disabled:opacity-50"
          >
            Salvar e completar depois
          </button>
        )}
      </footer>
    </div>
  );
}

// O nome de cada passo é UM SÓ: o mesmo texto no topo (ao lado de "Passo N
// de 4") e no título da tela — ver `Heading` em cada passo.
const STEP_LABELS = [
  'Quem é a criança',
  'Onde mora',
  'Escola e horários',
  'Responsável e mensalidade',
];

/**
 * Leva o cursor ao primeiro campo com erro. Espera dois quadros: o erro só
 * aparece no DOM depois de o React desenhar o `setErrors`. Campo de texto
 * recebe foco (abre o teclado no lugar certo); o que não é campo (menino ou
 * menina, a declaração) é marcado com `data-erro` e só rola até a vista.
 */
function focarPrimeiroErro() {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const alvo = document.querySelector(
        'main [aria-invalid="true"], main [data-erro]'
      );
      if (!alvo) return;
      alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const campo = alvo.matches('input, textarea, select, button')
        ? alvo
        : alvo.querySelector('input, textarea, select, button');
      campo?.focus({ preventScroll: true });
    })
  );
}

/* ─────────────── Barra de progresso ─────────────── */

/**
 * TRÊS ESTADOS, TRÊS CARAS. Concluído e atual tinham a mesma cor, e a barra
 * não dizia em qual passo a pessoa estava — só quantos já tinha passado.
 * Agora o atual é cheio, o concluído leva um check e o que falta fica
 * apagado.
 */
function ProgressBar({ step, total }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const done = i + 1 < step;
        const current = i + 1 === step;
        return (
          <div
            key={i}
            aria-hidden
            className={`flex h-6 flex-1 items-center justify-center rounded-full transition-colors ${
              current
                ? 'bg-primary'
                : done
                ? 'bg-primaryChip text-accentText'
                : 'bg-neutro'
            }`}
          >
            {done && <Check size={14} strokeWidth={3} />}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────── Passo 1: Criança ─────────────── */

function Step1Child({ form, setForm, setField, errors, idReservado }) {
  const declaracaoRef = useRef(null);
  return (
    <>
      <Heading
        title={STEP_LABELS[0]}
        subtitle="Comece pelo básico — vamos um passo de cada vez."
      />

      <Input falar="nome"
        label="Nome completo"
        placeholder="Digite aqui"
        icon={User}
        value={form.name}
        onChange={setField('name')}
        error={errors.name}
        required
        autoFocus
      />

      <div data-erro={errors.gender ? true : undefined}>
        <p id="rotulo-menino-menina" className="block text-sm font-semibold text-text mb-2">
          É menino ou menina?
        </p>
        {/* `data-campo-escolha` + `tabIndex={-1}`: o Salvar do nome PARA aqui
          * em vez de apertar o "Avançar" (avancarCampo.js). Tocar numa opção
          * leva o foco adiante — à declaração, ou ao botão do passo. */}
        <div
          className="grid grid-cols-2 gap-2 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          role="group"
          aria-labelledby="rotulo-menino-menina"
          data-campo-escolha
          tabIndex={-1}
        >
          {GENDERS.map((g) => (
            <SelectorButton
              key={g.value}
              label={g.label}
              active={form.gender === g.value}
              onClick={() => {
                setForm((p) => ({ ...p, gender: g.value }));
                const alvo = form.autorizacaoDeclarada
                  ? document.querySelector('[data-avancar]:not([disabled])')
                  : declaracaoRef.current;
                alvo?.focus();
              }}
            />
          ))}
        </div>
        {errors.gender && (
          <p data-erro className="mt-1.5 text-sm font-semibold text-dangerText">
            {errors.gender}
          </p>
        )}
      </div>

      {/* O ROSTO APARECE AO ESCOLHER (04/10/2026, modelo aprovado pelo dono):
        * é o mesmo avatar da lista e da ficha (o id já está reservado), e
        * mostra na hora o que o menino/menina decide. */}
      {form.gender && form.name.trim() && (
        <div className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5 shadow-rest">
          <img
            src={childAvatarUrl({ id: idReservado, gender: form.gender })}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full bg-primaryChip"
          />
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-bold text-text">{form.name.trim()}</span>
            <span className="block text-sm text-textMuted">
              É assim que {form.gender === 'female' ? 'ela aparece' : 'ele aparece'} no app
            </span>
          </span>
        </div>
      )}

      {/* O ANIVERSÁRIO SAIU DAQUI (02/10/2026). O motorista quase nunca sabe
        * a data — o campo ficava vazio ou com um chute. Quem preenche agora é
        * o responsável, na ficha do filho, junto de turma e professora. */}

      {/* O seletor de período saiu daqui. Ele era um botão a mais pedindo
        * ao motorista que traduzisse "entra 7h" pra "manhã" — tradução que o
        * app faz sozinho a partir da hora combinada, no passo 3. */}

      {/* ⚠️ A DECLARAÇÃO DE AUTORIZAÇÃO — camada 1. Ver
        * `docs/consentimento-saude.md`.
        *
        * ELA NÃO É O CONSENTIMENTO DA FAMÍLIA, e o texto tem cuidado de não
        * parecer: fala dos dados OPERACIONAIS (nome, endereço, contato) e não
        * menciona saúde. Consentimento para dado sensível é da responsável, na
        * tela dela, e não pode ser coberto por uma caixa que outra pessoa
        * marca.
        *
        * O que ela resolve é a janela em que ninguém declarava nada: a criança
        * é cadastrada ANTES do convite, e a mãe pode nunca resgatá-lo. A
        * declaração é verossímil porque o modelo do produto já parte de que a
        * família conhece o motorista offline — a plataforma não apresenta
        * ninguém a ninguém.
        *
        * Fica no passo 1 porque é sobre a criança inteira, e no FIM do passo
        * porque ela confirma o que ele acabou de digitar. */}
      <label
        data-erro={errors.autorizacaoDeclarada ? true : undefined}
        className={`mt-1 flex cursor-pointer items-start gap-3 rounded-2xl border bg-surface p-3 ${
          errors.autorizacaoDeclarada ? 'border-danger' : 'border-border'
        }`}
      >
        <input
          ref={declaracaoRef}
          type="checkbox"
          checked={form.autorizacaoDeclarada}
          onChange={(e) =>
            setForm((p) => ({ ...p, autorizacaoDeclarada: e.target.checked }))
          }
          className="mt-0.5 h-6 w-6 shrink-0 accent-primary"
        />
        <span className="text-sm leading-relaxed text-text">
          Confirmo que tenho <strong>autorização do responsável legal</strong>{' '}
          desta criança para cadastrar no Alô Buzinou o nome, o endereço de
          embarque e os dados de contato, com a finalidade de operar o
          transporte escolar.
        </span>
      </label>
      {errors.autorizacaoDeclarada && (
        <p className="-mt-1 text-sm font-semibold text-dangerText">
          {errors.autorizacaoDeclarada}
        </p>
      )}
    </>
  );
}

/* ─────────────── Passo 2: Casa ─────────────── */

function Step2Home({ form, setForm, errors }) {
  const [searching, setSearching] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  // null = nunca buscou · 'found' · 'notFound' — controla a mensagem exibida
  const [searchState, setSearchState] = useState(null);
  // null = nunca consultou · 'ok' · 'notFound' · 'offline'
  const [cepState, setCepState] = useState(null);
  // O último CEP realmente consultado — ver `onCepChange`.
  const [cepConsultado, setCepConsultado] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasCoord = form.lat !== '' && form.lng !== '' && form.lat != null;
  const veioDoCep = !!form.cepPartes?.logradouro;

  /**
   * O ENDEREÇO OU É DERIVADO DO CEP, OU É DIGITADO À MÃO — nunca os dois.
   *
   * Enquanto `cepPartes` existir, o campo livre é remontado a cada mudança de
   * número ou complemento. No instante em que a pessoa digita NELE, ela passa
   * a ser dona dele: `cepPartes` vira `null` e nada mais reescreve o texto.
   *
   * Sem essa regra, corrigir "Rua" para "Estrada" à mão e depois ajustar o
   * número apagaria a correção — e o motorista não teria como saber o que comeu
   * o texto dele. Um estado, um dono.
   */
  const consultarCep = async (digitos) => {
    setBuscandoCep(true);
    setCepConsultado(digitos);
    setCepState(null);
    try {
      const partes = await buscarCep(digitos);
      setForm((prev) => ({
        ...prev,
        cepPartes: partes,
        address: montarEndereco({
          ...partes,
          numero: prev.numero,
          complemento: prev.complemento,
        }),
        // ENDEREÇO NOVO ZERA A COORDENADA VELHA.
        //
        // Sem isto a tela seguiria estampando "Local confirmado!" sobre o ponto
        // do endereço ANTERIOR — a mesma afirmação confiante em cima de
        // coordenada errada que motivou esta mudança inteira, agora causada por
        // ela.
        lat: '',
        lng: '',
      }));
      setSearchState(null);
      setCepState('ok');
    } catch (err) {
      setCepState(/consultar/.test(err?.message || '') ? 'offline' : 'notFound');
    } finally {
      setBuscandoCep(false);
    }
  };

  /**
   * A CONSULTA DISPARA SOZINHA NO OITAVO DÍGITO, e não num botão.
   *
   * CEP tem tamanho FIXO — é o único dado deste formulário com essa
   * propriedade, e é o que permite ao app saber que a pessoa terminou de
   * digitar sem precisar perguntar. Um botão "Buscar CEP" ao lado seria um
   * toque a mais num cadastro que é feito com uma mão, no portão da escola.
   *
   * `cepConsultado` existe porque o `onChange` continua disparando depois do
   * oitavo dígito — apagar e redigitar o último número, por exemplo. Sem a
   * guarda, cada tecla viraria uma requisição: o ViaCEP não cobra, mas
   * atropelar serviço de terceiro de graça é como se perde o de graça.
   */
  const focarNumero = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const campo = document.getElementById('numero-da-casa');
        if (!campo || campo.disabled) return;
        campo.focus({ preventScroll: true });
        campo.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      })
    );

  // A rua escolhida na busca pelo nome tem a mesma forma que a resposta do
  // CEP: o resto do passo não precisa saber de onde ela veio.
  const onRuaEscolhida = (s) => {
    const partes = {
      cep: s.cep,
      logradouro: s.logradouro,
      bairro: s.bairro,
      localidade: s.localidade,
      uf: s.uf,
    };
    setCepConsultado(unmaskCep(s.cep));
    setForm((prev) => ({
      ...prev,
      cep: maskCep(s.cep),
      cepPartes: partes,
      address: montarEndereco({ ...partes, numero: prev.numero, complemento: prev.complemento }),
      lat: '',
      lng: '',
    }));
    setSearchState(null);
    setCepState('ok');
    // O PRÓXIMO TOQUE É O NÚMERO (04/10/2026): a rua já veio inteira, e o
    // que falta é exatamente o que decide a calçada. O campo só existe
    // depois que `cepPartes` chega, então espera o React desenhá-lo.
    focarNumero();
  };

  const onCepChange = (e) => {
    const cep = maskCep(e.target.value);
    setForm((prev) => ({ ...prev, cep }));

    const digitos = unmaskCep(cep);
    if (digitos.length < 8) {
      setCepState(null);
      setCepConsultado('');
      return;
    }
    if (!isValidCep(cep) || digitos === cepConsultado) return;
    consultarCep(digitos);
  };

  // Número e complemento remontam o endereço — mas só enquanto ele for
  // derivado do CEP (ver o comentário de `consultarCep`).
  const setParteDoEndereco = (campo) => (e) => {
    const valor = e.target.value;
    setForm((prev) => {
      if (!prev.cepPartes?.logradouro) return { ...prev, [campo]: valor };
      return {
        ...prev,
        [campo]: valor,
        // Número novo, casa nova: o pino antigo sai e é procurado de novo.
        ...(campo === 'numero' ? { lat: '', lng: '' } : {}),
        address: montarEndereco({
          ...prev.cepPartes,
          numero: campo === 'numero' ? valor : prev.numero,
          complemento: campo === 'complemento' ? valor : prev.complemento,
        }),
      };
    });
  };

  const onEnderecoDigitado = (e) => {
    const valor = e.target.value;
    setForm((prev) => ({ ...prev, address: valor, cepPartes: null }));
  };

  const onSearch = async () => {
    if (!form.address.trim()) {
      toast.error('Digite o endereço primeiro.');
      return;
    }
    setSearching(true);
    try {
      // Com as partes do CEP em mão, a consulta vai MONTADA (número na frente
      // do nome da rua, sem o complemento) em vez de mandar a frase inteira —
      // ver `consultaDoEndereco` no locationService.
      const partes = form.cepPartes
        ? { ...form.cepPartes, numero: form.numero }
        : null;
      const result = await searchAddress(form.address, partes);
      setForm((prev) => ({
        ...prev,
        lat: result.lat,
        lng: result.lng,
        // O `display_name` do Nominatim SÓ substitui o texto quando o endereço
        // foi digitado à mão — ali ele costuma sair mais completo que a frase.
        //
        // Vindo do CEP é o contrário: ele é verboso, traz "Região
        // Metropolitana" e microrregião, e com frequência PERDE O NÚMERO.
        // Trocar o endereço dos Correios por ele desfaria exatamente o conserto
        // que o número em campo próprio acabou de fazer.
        address: prev.cepPartes
          ? prev.address
          : result.displayName || prev.address,
      }));
      setSearchState('found');
      toast.success('Encontramos o local!');
    } catch {
      // Não usamos toast.error aqui: falhar a busca é caso ESPERADO, não erro.
      // O aviso inline explica que dá pra seguir sem a coordenada.
      setSearchState('notFound');
    } finally {
      setSearching(false);
    }
  };

  /* O MAPA APARECE QUANDO O ENDEREÇO É ACHADO (04/10/2026, modelo aprovado
   * pelo dono). Com a rua escolhida e o número digitado (ou "não sei o
   * número"), o ponto é procurado sozinho depois de uma pausa de 1,5 s — o
   * Nominatim não aceita autocompletar a cada tecla, então é UMA consulta por
   * endereço assentado, e a fila do locationService segura o ritmo. */
  const numeroAssentado = form.semNumero ? 'sem' : form.numero.trim();
  useEffect(() => {
    if (!veioDoCep || !numeroAssentado || hasCoord) return undefined;
    let cancelado = false;
    const espera = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchAddress(form.address, { ...form.cepPartes, numero: form.numero });
        if (!cancelado) {
          setForm((prev) => ({ ...prev, lat: r.lat, lng: r.lng }));
          setSearchState('found');
        }
      } catch {
        if (!cancelado) setSearchState('notFound');
      } finally {
        if (!cancelado) setSearching(false);
      }
    }, 1500);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veioDoCep, numeroAssentado, hasCoord]);

  // TROCAR A RUA desfaz tudo o que veio dela: número, complemento e ponto.
  const trocarRua = () => {
    setForm((prev) => ({
      ...prev,
      cep: '',
      cepPartes: null,
      address: '',
      numero: '',
      complemento: '',
      semNumero: false,
      lat: '',
      lng: '',
    }));
    setCepState(null);
    setCepConsultado('');
    setSearchState(null);
  };

  const onPick = ({ lat, lng }) => {
    setForm((prev) => ({ ...prev, lat, lng }));
    setSearchState('found');
    setPickerOpen(false);
    toast.success('Ponto marcado!');
  };

  return (
    <>
      <Heading
        title={STEP_LABELS[1]}
        subtitle="O endereço da casa pra você passar todo dia."
      />

      {/* O CEP É ATALHO, NUNCA REQUISITO.
        * Ele preenche rua, bairro e cidade sozinho, e o ganho de verdade é o
        * que sobra: o NÚMERO ganha campo próprio, e é ele que decide em que
        * calçada a perua para. Quem não tem o CEP na mão digita tudo no campo
        * de baixo, como sempre — cadastro feito no meio da rota não pode passar
        * a depender de consultar papel. */}
      {/* PELO NOME DA RUA (02/10/2026). O motorista sabe a rua, quase nunca
        * o CEP: a lista traz o CEP junto. O CEP continua logo abaixo para
        * quem tem, e o campo livre para quando a busca não achar. */}
      {/* DOIS CAMINHOS (04/10/2026, modelo aprovado pelo dono). O comum: o nome
        * da rua, escolhido da lista — a rua vira um cartão e só sobram o número
        * e o complemento. O de reserva: o CEP ou o endereço digitado inteiro,
        * para quando a busca não acha a rua. */}
      {!veioDoCep && (
        <>
          <BuscaDeRua onEscolher={onRuaEscolhida} />

          <Input
            label="Ou o CEP"
            placeholder="Digite aqui"
            icon={MapPin}
            value={form.cep}
            onChange={onCepChange}
            inputMode="numeric"
            maxLength={9}
            hint="Se souber."
          />

          {buscandoCep && (
            <p className="text-sm text-textMuted">Consultando o CEP…</p>
          )}

          {/* CEP não encontrado e consulta fora do ar dizem coisas DIFERENTES:
            * uma é "confira o que você digitou", a outra é "não é você". */}
          {cepState === 'notFound' && (
            <div className="text-sm bg-warningSoft border border-warningBorder text-warningText px-4 py-3 rounded-xl space-y-1">
              <p className="font-semibold">Não achamos esse CEP.</p>
              <p>Confira os números — ou digite o endereço completo abaixo.</p>
            </div>
          )}
          {cepState === 'offline' && (
            <div className="text-sm bg-warningSoft border border-warningBorder text-warningText px-4 py-3 rounded-xl space-y-1">
              <p className="font-semibold">A consulta de CEP está fora do ar.</p>
              <p>Sem problema — digite o endereço completo abaixo.</p>
            </div>
          )}

          <Input falar="texto"
            label="Ou o endereço completo"
            placeholder="Digite aqui"
            icon={Home}
            value={form.address}
            onChange={onEnderecoDigitado}
            hint="Se a rua não aparecer na busca. Quanto mais completo, melhor."
            error={errors.address}
          />

          {form.address.trim() && !hasCoord && (
            <Button
              type="button"
              variant="secondary"
              icon={Search}
              onClick={onSearch}
              loading={searching}
            >
              Buscar endereço no mapa
            </Button>
          )}
        </>
      )}

      {veioDoCep && (
        <>
          <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-rest">
            <MapPin size={22} className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-bold text-text">
                {form.cepPartes.logradouro}
              </span>
              <span className="block truncate text-sm text-textMuted">
                {[form.cepPartes.bairro, form.cepPartes.localidade, form.cep].filter(Boolean).join(' · ')}
              </span>
            </span>
            <button
              type="button"
              onClick={trocarRua}
              className="tap -mr-1 min-h-12 shrink-0 px-2 text-base font-bold text-primary"
            >
              Trocar
            </button>
          </div>

          {/* Número e complemento: UM POR LINHA (04/10/2026) — lado a lado,
            * cada um com o seu Salvar, não cabia nem "Apto 12, bloco B". O
            * número é OBRIGATÓRIO — ver a validação do passo 2. */}
          <div className="space-y-3">
            <Input
              id="numero-da-casa"
              label="Número"
              placeholder={form.semNumero ? 'depois' : 'Digite aqui'}
              value={form.numero}
              onChange={setParteDoEndereco('numero')}
              inputMode="numeric"
              error={errors.numero}
              disabled={form.semNumero}
              required={!form.semNumero}
            />
            <Input falar="texto"
              label="Complemento (opcional)"
              placeholder="Digite aqui"
              value={form.complemento}
              onChange={setParteDoEndereco('complemento')}
            />
          </div>
          <button
            type="button"
            aria-pressed={form.semNumero}
            onClick={() =>
              setForm((prev) => ({ ...prev, semNumero: !prev.semNumero, numero: '', lat: '', lng: '' }))
            }
            className={`tap flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-base font-semibold ${
              form.semNumero
                ? 'border-primary bg-primarySoft text-primary'
                : 'border-border bg-card text-textMuted'
            }`}
          >
            {form.semNumero && <Check size={18} />}
            Não sei o número agora
          </button>
          {form.semNumero && (
            <p className="px-1 text-sm text-textMuted">
              A família confirma o número quando entrar no app, e ele aparece
              aqui para você.
            </p>
          )}
        </>
      )}

      {searching && veioDoCep && !hasCoord && (
        <p className="text-sm text-textMuted">Procurando a casa no mapa…</p>
      )}

      {/* O MAPA SÓ APARECE QUANDO HÁ PONTO: é para conferir, não para
        * preencher. A pergunta é a que importa na rua — a perua encosta numa
        * PORTA, e o pino no meio da quadra é o erro que ninguém percebe. */}
      {hasCoord && (
        <div className="space-y-2">
          <div className="h-44 overflow-hidden rounded-2xl border border-border">
            <LiveMap home={{ lat: Number(form.lat), lng: Number(form.lng) }} />
          </div>
          <div className="rounded-2xl border border-primaryBorder bg-primarySoft px-4 py-3">
            <p className="text-base font-bold text-text">O pino está na porta da casa?</p>
            <p className="text-sm text-textBody">
              {form.semNumero
                ? 'Sem o número, ele fica no meio da rua. A família acerta quando entrar.'
                : 'Se não estiver, ajuste no mapa.'}
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="tap mt-1 -ml-1 inline-flex min-h-12 items-center gap-1.5 px-1 text-base font-bold text-primary"
            >
              <MapPin size={18} />
              Ajustar no mapa
            </button>
          </div>
        </div>
      )}

      {/* Endereço não encontrado NÃO é erro de preenchimento — é limite do
        * mapa. A mensagem diz isso e oferece as duas saídas. */}
      {!hasCoord && searchState === 'notFound' && (
        <div className="text-sm bg-warningSoft border border-warningBorder text-warningText px-4 py-3 rounded-xl space-y-1">
          <p className="font-semibold">Não achamos esse endereço no mapa.</p>
          <p className="text-warningText">
            Sem problema — dá pra marcar na mão agora ou seguir e ajustar
            depois. A criança fica salva do mesmo jeito.
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="tap -ml-1 inline-flex min-h-12 items-center gap-1.5 px-1 text-base font-bold text-primary"
          >
            <MapPin size={18} />
            Marcar no mapa
          </button>
        </div>
      )}

      {pickerOpen && (
        <MapPicker
          kind="home"
          initial={hasCoord ? { lat: Number(form.lat), lng: Number(form.lng) } : null}
          addressLabel={form.address}
          onConfirm={onPick}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

/* ─────────────── Passo 3: Escola e horários ─────────────── */

/**
 * Aqui mora a informação que organiza o dia inteiro: a hora combinada com o
 * pai. Não é o horário da escola — é a hora em que a perua encosta na porta e
 * a hora em que a criança volta pra casa.
 *
 * A escola virou seleção. Antes eram três campos digitados por criança (nome,
 * endereço, geocoding), o que fazia cinco alunos da mesma escola custarem
 * cinco digitações — e um "E.M." no lugar de "EM" partia a turma em duas no
 * aviso de "não vai ter aula".
 */
function Step3School({ escolas, loading, form, setForm, errors }) {
  // A escola nova nasce num popup por cima do cadastro — ver NovaEscolaSheet.
  // Antes estes botões navegavam para a tela de escolas, e o formulário da
  // criança (estado local) se perdia inteiro no caminho.
  const [novaEscola, setNovaEscola] = useState(false);

  const escolhida = escolas.find((e) => e.id === form.schoolId) || null;

  const escolher = (e) =>
    setForm((prev) => ({
      ...prev,
      schoolId: e.id,
      // O nome e as coordenadas continuam copiados dentro da criança: é o que
      // a rota usa e o que o pai vê. Escola apagada por engano não pode apagar
      // o endereço de entrega de ninguém no meio da rota.
      school: e.nome || '',
      schoolAddress: e.endereco || '',
      schoolLat: e.lat ?? '',
      schoolLng: e.lng ?? '',
      // A cópia do telefone segue o desenho do endereço: a criança carrega o
      // que a ficha e a rota leem (a família não lê `schools`).
      schoolPhone: e.telefone || '',
    }));

  return (
    <>
      <Heading
        title={STEP_LABELS[2]}
        subtitle="Onde estuda e a que horas você vai pegar e entregar."
      />

      <div>
        <label className="block text-sm font-semibold text-text mb-2">
          Escola
        </label>

        {loading && <div className="h-12 rounded-2xl bg-neutro animate-pulse" />}

        {!loading && escolas.length === 0 && (
          <div className="bg-sunken border border-dashed border-border rounded-2xl p-4 text-center space-y-3">
            <p className="text-sm font-semibold text-text">
              Você não tem escola cadastrada
            </p>
            {/* O PROTAGONISTA DO PASSO quando não há escola (04/10/2026): largura
              * toda e a sombra que o "Avançar" cede enquanto isso. */}
            <Button
              icon={School}
              onClick={() => setNovaEscola(true)}
              className="shadow-focus"
            >
              Cadastrar escola
            </Button>
          </div>
        )}

        {!loading && escolas.length > 0 && (
          <div className="space-y-2">
            {escolas.map((e) => {
              const ativa = form.schoolId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => escolher(e)}
                  aria-pressed={ativa}
                  className={`tap w-full text-left rounded-2xl border-2 px-3.5 py-3 flex items-center gap-3 ${
                    ativa
                      ? 'border-primary bg-primarySoft'
                      : 'border-border bg-card'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      ativa ? 'bg-primary text-white' : 'bg-neutro text-textMuted'
                    }`}
                  >
                    <School size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-text leading-tight">
                      {e.nome}
                    </p>
                    {e.endereco && (
                      <p className="text-sm text-textMuted truncate">
                        {e.endereco}
                      </p>
                    )}
                  </div>
                  {ativa && <Check size={18} className="text-primary shrink-0" />}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setNovaEscola(true)}
              className="tap inline-flex min-h-12 items-center gap-1.5 px-1 text-base font-semibold text-primary"
            >
              <Plus size={18} />
              Cadastrar outra escola
            </button>
          </div>
        )}
      </div>

      <NovaEscolaSheet
        open={novaEscola}
        onClose={() => setNovaEscola(false)}
        onCriada={escolher}
      />

      {/* A ORDEM DO PASSO (04/10/2026, modelo aprovado pelo dono): a escola,
        * os dois horários lado a lado, e — com os dois preenchidos — o dia da
        * criança desenhado como a tela da rota (casa → escola → casa). Turma e
        * professora vêm por último: são o que ele diz no portão, e os dois são
        * opcionais. */}
      <div className="space-y-2">
        <p className="text-base font-bold text-text">O horário que você vai cumprir</p>
        <p className="text-sm text-textMuted">
          É o que a família vê para esperar na hora certa. O horário da escola
          é outra coisa e não entra aqui.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Pega em casa"
            // DIGITADA, não no relógio do Android: "0640" vira "06:40".
            type="text"
            inputMode="numeric"
            placeholder="Digite aqui"
            maxLength={5}
            semSalvar
            inputClassName="text-center font-display text-2xl font-extrabold tabular-nums"
            value={form.horaPega}
            onChange={(e) => setForm((p) => ({ ...p, horaPega: mascaraHora(e.target.value) }))}
            error={errors.horaPega}
          />
          <Input
            label="Entrega em casa"
            type="text"
            inputMode="numeric"
            placeholder="Digite aqui"
            maxLength={5}
            semSalvar
            inputClassName="text-center font-display text-2xl font-extrabold tabular-nums"
            value={form.horaEntrega}
            onChange={(e) => setForm((p) => ({ ...p, horaEntrega: mascaraHora(e.target.value) }))}
            error={errors.horaEntrega}
          />
        </div>
        {!(normalizaHora(form.horaPega) && normalizaHora(form.horaEntrega)) && (
          <p className="text-sm text-textMuted">
            Pode preencher depois, mas até lá a criança fica com horário presumido.
          </p>
        )}
      </div>

      {normalizaHora(form.horaPega) && normalizaHora(form.horaEntrega) && (
        <DiaDaCrianca
          nome={form.name}
          pega={normalizaHora(form.horaPega)}
          entrega={normalizaHora(form.horaEntrega)}
          casa={form.address}
          escola={form.school}
          escolaEndereco={form.schoolAddress}
        />
      )}

      {escolhida?.geoPending && (
        <p className="text-sm text-warningText bg-warningSoft border border-warningBorder rounded-xl px-3 py-2">
          {escolhida.nome} está sem localização no mapa. Dá pra resolver
          depois em Minha turma → Escolas.
        </p>
      )}

      {/* TURMA E PROFESSORA, OS DOIS OPCIONAIS (02/10/2026, pedido do dono).
        * É o que ele precisa para chamar a criança no portão ("a do 3º B, da
        * tia Cláudia"). A SALA saiu do cadastro: muda no meio do ano e ele não
        * entra na sala. A família corrige os dois na ficha do filho. */}
      <div className="grid grid-cols-1 gap-3">
        <Input falar="texto"
          label="Turma (opcional)"
          placeholder="Digite aqui"
          value={form.turma}
          onChange={(e) => setForm((p) => ({ ...p, turma: e.target.value }))}
        />
        <Input falar="nome"
          label="Professora (opcional)"
          placeholder="Digite aqui"
          value={form.professora}
          onChange={(e) => setForm((p) => ({ ...p, professora: e.target.value }))}
        />
      </div>
    </>
  );
}

/* ─────────────── Passo 4: Responsável + Financeiro ─────────────── */

/** Os dias de vencimento mais combinados; outro dia continua possível. */
const DIAS_COMUNS = ['5', '10', '15', '20'];

function Step4Parent({ form, setForm, setField, setPhone, errors }) {
  const [showSecondParent, setShowSecondParent] = useState(false);
  // "Outro dia" abre o campo; um dia fora dos comuns já começa aberto.
  const [outroDia, setOutroDia] = useState(() => !!form.dueDay && !DIAS_COMUNS.includes(form.dueDay));
  const primeiro = String(form.name || '').trim().split(/\s+/)[0];

  return (
    <>
      <Heading
        title={STEP_LABELS[3]}
        subtitle="Quem cuida e como é a cobrança."
      />

      <Card className="space-y-4">
        {/* TRÊS BLOCOS COM NOME (04/10/2026, modelo aprovado pelo dono): quem
          * cuida, a mensalidade e o contrato. */}
        <h3 className="text-sm font-bold uppercase tracking-wide text-textMuted">
          {primeiro ? `Quem cuida de ${primeiro}` : 'Quem cuida'}
        </h3>
        <Input falar="nome"
          label="Nome"
          placeholder="Digite aqui"
          icon={User}
          value={form.parentName}
          onChange={setField('parentName')}
          error={errors.parentName}
          required
        />
        {/* ⚠️ O E-MAIL DO RESPONSÁVEL SAIU DAQUI (02/10/2026, pedido do dono).
          * O motorista quase nunca sabe, e o campo à vista (marcado como
          * obrigatório) o fazia achar que precisava descobrir o e-mail de
          * toda família. Quem informa é a própria família, ao entrar pelo
          * convite: o `redeemInvite` grava `linkedEmail` com o e-mail da
          * conta dela, e o contrato e a ficha leem esse. */}
        <Input falar="telefone"
          label="WhatsApp"
          placeholder="Digite aqui"
          icon={Phone}
          inputMode="tel"
          value={form.parentPhone}
          onChange={setPhone('parentPhone')}
          maxLength={15}
          error={errors.parentPhone}
          hint="O convite vai para este número."
          required
        />

        <button
          type="button"
          onClick={() => setShowSecondParent((v) => !v)}
          className="tap w-full min-h-12 flex items-center justify-between text-base font-semibold text-primary"
        >
          <span>
            {showSecondParent
              ? 'Ocultar segundo responsável'
              : 'Adicionar segundo responsável (opcional)'}
          </span>
          {showSecondParent ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showSecondParent && (
          <div className="space-y-3 pt-1 border-t border-neutro">
            <Input falar="nome"
              label="Nome do segundo responsável"
              icon={User}
              value={form.parent2Name}
              onChange={setField('parent2Name')}
            />
            <Input falar="telefone"
              label="Telefone do segundo responsável"
              icon={Phone}
              inputMode="tel"
              value={form.parent2Phone}
              onChange={setPhone('parent2Phone')}
              maxLength={15}
              error={errors.parent2Phone}
            />
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-textMuted">Mensalidade</h3>
        <CampoDeValor
          label="Valor da mensalidade"
          value={form.monthlyFee}
          onChange={(v) => setForm((p) => ({ ...p, monthlyFee: v }))}
          error={errors.monthlyFee}
          /* O `required` daqui foi REMOVIDO porque era inerte e mentia.
           *
           * Este formulário é um assistente por etapas: o botão chama
           * onSubmit() direto, sem <form> nativo, então a validação do
           * navegador nunca roda e o atributo não bloqueava nada. E deixar
           * sem valor é DELIBERADO — a validação da etapa diz, com todas as
           * letras, que "email e mensalidade podem vir depois", porque nem
           * sempre o valor está combinado no dia do cadastro.
           *
           * O problema não era permitir vazio: era não contar o preço disso.
           * Mensalidade zerada faz a criança ser PULADA na geração de
           * cobrança do mês (billing.js ignora fee <= 0), sem erro nenhum na
           * hora. Quem cadastra trinta crianças e deixa dez sem valor
           * descobre no dia do fechamento, contando dez cobranças que não
           * nasceram. */
          hint={
            String(form.monthlyFee).trim()
              ? undefined
              : 'Sem valor, esta criança não entra na cobrança do mês. Dá pra preencher depois na ficha dela.'
          }
        />
        <div data-erro={errors.dueDay ? true : undefined}>
          <p id="rotulo-vencimento" className="mb-2 block text-sm font-semibold text-text">
            Vence todo dia
          </p>
          <div className="grid grid-cols-5 gap-2" role="group" aria-labelledby="rotulo-vencimento">
            {DIAS_COMUNS.map((d) => {
              const ativo = !outroDia && form.dueDay === d;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => {
                    setOutroDia(false);
                    setForm((p) => ({ ...p, dueDay: d }));
                  }}
                  className={`tap h-12 rounded-xl border-2 text-base font-bold ${
                    ativo ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-card text-text'
                  }`}
                >
                  {d}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={outroDia}
              onClick={() => setOutroDia(true)}
              className={`tap h-12 rounded-xl border-2 text-sm font-bold ${
                outroDia ? 'border-primary bg-primarySoft text-primary' : 'border-border bg-card text-text'
              }`}
            >
              Outro
            </button>
          </div>
        </div>
        {outroDia && (
          <Input
            // TEXTO SÓ COM NÚMEROS, não `type="number"`: esse muda o valor
            // sozinho com a roda do mouse (ou a rolagem) e aceita "e" e negativo
            // — no teste, o 10 digitado virou 12 no contrato.
            type="text"
            inputMode="numeric"
            min="1"
            max="28"
            label="Qual dia?"
            placeholder="Digite aqui"
            icon={Calendar}
            value={form.dueDay}
            maxLength={2}
            onChange={(e) => setForm((p) => ({ ...p, dueDay: e.target.value.replace(/\D/g, '').slice(0, 2) }))}
            hint="De 1 a 28."
            semSalvar
            error={errors.dueDay}
            required
          />
        )}
      </Card>

      {/* A VIGÊNCIA É DELE (02/10/2026). O contrato dizia sempre 01/01 a
        * 31/12 com 12 parcelas — a família que entrava em outubro assinava
        * doze parcelas de um ano com três meses. */}
      <Card className="space-y-3" data-erro={errors.vigencia ? true : undefined}>
        <h3 className="text-sm font-bold uppercase tracking-wide text-textMuted">Contrato</h3>
        <CampoVigencia
          inicio={form.vigenciaInicio}
          fim={form.vigenciaFim}
          erro={errors.vigencia}
          onChange={({ inicio, fim }) =>
            setForm((p) => ({ ...p, vigenciaInicio: inicio, vigenciaFim: fim }))
          }
        />
      </Card>

      {/* ⚠️ ESTE CAMPO PEDIA DADO DE SAÚDE DE MENOR, E NÃO HAVIA CONSENTIMENTO.
        *
        * O placeholder era "Alergias, instruções especiais..." — ou seja, o app
        * CONVIDAVA a escrever dado de saúde de uma criança. Pela LGPD isso é
        * dado sensível (art. 5º II), exige consentimento específico e
        * destacado (art. 11 I) e, tratando-se de criança, o art. 14 §1.
        *
        * A Política afirma que o consentimento é dado "no aceite do primeiro
        * acesso" — mas a criança é cadastrada ANTES do convite, e a mãe pode
        * nunca resgatá-lo. Quem digita aqui é o motorista, sobre um terceiro
        * que ainda não aceitou nada.
        *
        * O convite saiu. O campo fica, porque a operação precisa dele (portão
        * que fica atrás, quem busca de segunda) — o que mudou é que ele deixou
        * de PEDIR o que a plataforma não tem base para guardar.
        *
        * ⚠️ O CONSERTO COMPLETO É DECISÃO DO DONO e está registrado no
        * checklist de lançamento: declaração do motorista de que tem
        * autorização da família, mais consentimento específico dela no
        * primeiro acesso. Enquanto não existir, o app não deve sugerir o
        * assunto. */}
      <Card>
        <label className="block text-base font-bold text-text mb-2">
          Observações da parada (opcional)
        </label>
        {/* Falar em vez de escrever (04/10/2026): o ditado se soma ao texto. */}
        <BotaoDeFalar valor={form.notes} onChange={(v) => setField('notes')({ target: { value: v } })} />
        <textarea
          value={form.notes}
          onChange={setField('notes')}
          rows={3}
          placeholder="Digite aqui"
          className="w-full rounded-xl border border-border bg-card text-text p-3 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary placeholder:text-textMuted"
        />
        <p className="mt-2 text-sm leading-relaxed text-textMuted">
          Só o que ajuda na rota. Informação de saúde, remédio ou alergia é
          assunto para você combinar direto com a família — este campo não é o
          lugar de guardar isso.
        </p>
      </Card>
    </>
  );
}

/**
 * O DIA DA CRIANÇA — casa, escola, casa, com as horas combinadas. O mesmo
 * desenho da linha do tempo da rota (a escola é o marco violeta), para ele
 * conferir o que acabou de digitar no formato em que vai ver todo dia. Só
 * aparece com os dois horários: meia linha do tempo não confere nada.
 */
function DiaDaCrianca({ nome, pega, entrega, casa, escola, escolaEndereco }) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || 'da criança';
  const paradas = [
    { hora: horaCurta(pega), titulo: 'Pega em casa', detalhe: casa, escola: false },
    { hora: null, titulo: escola || 'A escola', detalhe: escolaEndereco || (escola ? '' : 'Escolha a escola acima'), escola: true },
    { hora: horaCurta(entrega), titulo: 'Entrega em casa', detalhe: `A família lê: chega às ${horaCurta(entrega)}`, escola: false },
  ];
  return (
    <div className="rounded-2xl bg-card px-4 py-3 shadow-rest">
      <p className="mb-1 text-sm font-bold text-textMuted">O dia {primeiro === 'da criança' ? primeiro : `de ${primeiro}`}</p>
      <ol>
        {paradas.map((p, i) => (
          <li key={i} className="grid grid-cols-[3.5rem_1.25rem_1fr] items-center gap-2 py-2">
            <span className={`text-right tabular-nums ${p.hora ? 'font-mono text-base text-text' : 'text-sm text-textMuted'}`}>
              {p.hora || 'escola'}
            </span>
            <span className="relative flex h-full items-center justify-center">
              {i < paradas.length - 1 && (
                <span aria-hidden className="absolute left-1/2 top-1/2 h-[calc(100%+1rem)] w-0.5 -translate-x-1/2 bg-borderStrong" />
              )}
              <span
                aria-hidden
                className={`relative h-3.5 w-3.5 ${p.escola ? 'rotate-45 rounded-sm bg-escola' : 'rounded-full bg-primary'}`}
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold text-text">{p.titulo}</span>
              {p.detalhe && <span className="block truncate text-sm text-textMuted">{p.detalhe}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ─────────────── Helpers visuais ─────────────── */

function Heading({ title, subtitle }) {
  return (
    <div className="mb-1">
      <h1 className="text-2xl font-bold text-text leading-tight">{title}</h1>
      {subtitle && (
        <p className="text-base text-textMuted mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function SelectorButton({ label, icon: Icon, active, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`tap h-14 rounded-2xl text-base font-semibold border-2 flex flex-col items-center justify-center gap-0.5 ${
        active
          ? 'bg-primary text-white border-primary'
          : 'bg-card text-text border-border'
      }`}
    >
      {Icon && <Icon size={16} />}
      {label}
    </button>
  );
}

/* ─────────────── Sucesso ─────────────── */

/**
 * Confirmação depois de cadastrar. O foco mudou: antes o tio saía daqui com
 * um código pra ditar; agora ele sai com um LINK pronto pra mandar no
 * WhatsApp. O código continua visível pra quando precisar ditar por telefone.
 */

/**
 * CRIANÇA CADASTRADA — a comemoração e o convite (02/10/2026).
 *
 * No meio da tela, a própria criança (o avatar dela, o mesmo da lista) chega
 * com um pulinho e faz joinha. É o momento de "deu certo", e o motorista vai
 * passar por ele uma vez por criança da turma: tem que ser rápido e alegre,
 * não um formulário de saída.
 *
 * Embaixo, UM botão grande: mandar o convite para o responsável daquela
 * criança. Link, código, QR e o contrato antigo ficam atrás de "Mais opções"
 * — eles empilhados escondiam o único gesto que importa aqui. Depois,
 * "Cadastrar outra criança", que já traz a escola marcada.
 */
function InviteCodeSuccess({
  code,
  childId,
  childName,
  gender,
  parentName,
  parentPhone,
  onEnviado,
  onOutra,
  onDone,
  onVerContratos,
}) {
  // Mandou o convite: o botão vira "Enviado ✓" (dentro do `InviteShare`) e o
  // destaque passa para "Cadastrar outra criança" — o próximo gesto.
  const [enviado, setEnviado] = useState(false);
  const primeiro = String(childName || '').trim().split(/\s+/)[0] || 'A criança';
  const responsavel = String(parentName || '').trim().split(/\s+/)[0];
  // O IRMÃO QUE ENTROU SOZINHO. Se o WhatsApp é de quem já usa o app, o
  // servidor vincula a criança à conta dela em segundos
  // (`functions/lib/vincularIrmao.js`) — e mandar convite aí seria pedir a
  // ela que faça o que já foi feito. A tela acompanha a criança ao vivo e
  // troca o botão pela notícia.
  const { child: aoVivo } = useChild(childId);
  const jaEntrou = aoVivo?.vinculadoPor === 'irmao' && !!aoVivo?.parentUid;
  // O CONVITE FICA MARCADO QUANDO ELE VOLTA (04/10/2026, pedido do dono): o
  // toque grava `conviteEnviadoEm` na criança, e a escuta ao vivo traz o
  // check mesmo que a tela tenha sido recarregada na volta do WhatsApp.
  const conviteFeito = enviado || !!aoVivo?.conviteEnviadoEm;
  const contratoAssinado = !!aoVivo?.contratoVigente;
  const mandarConvite = () =>
    document.querySelector('[data-convite-whatsapp]')?.click();

  return (
    <div className="min-h-screen flex flex-col px-6 pt-8 pb-6 gap-5">
      <div className="flex flex-col items-center text-center">
        {/* A criança feliz. Ela CHEGA uma vez e para: a respiração e o joinha
          * balançando eram laços infinitos, e no app nada se mexe sozinho além
          * do "ao vivo" (design system, Movimento). Com movimento reduzido,
          * ela só aparece. */}
        <div className="animate-crianca-chega motion-reduce:animate-none">
          <div className="relative">
            <img
              src={childAvatarUrl({ id: childId, gender })}
              alt=""
              className="h-40 w-40 rounded-full bg-primaryChip ring-4 ring-card shadow-float"
            />
            <span
              aria-hidden
              className="absolute -right-2 bottom-3 flex h-14 w-14 items-center justify-center rounded-full bg-marca text-naMarca shadow-float"
            >
              <ThumbsUp size={28} />
            </span>
          </div>
        </div>
        <h3 className="mt-5 text-2xl font-extrabold text-text">
          {primeiro} está na sua turma
        </h3>
      </div>

      {/* O QUE JÁ FOI E O QUE FALTA (04/10/2026, modelo aprovado pelo dono).
        * Três linhas, e cada pendência tem a ação na própria linha. O contrato
        * leva à tela de contratos — é lá que ele vai acompanhar quem assinou,
        * quem entrou e quem saiu, e a primeira visita é melhor agora. */}
      <ul className="divide-y divide-border rounded-2xl bg-card shadow-rest">
        <li className="flex min-h-14 items-center gap-3 px-4">
          <Check size={22} className="shrink-0 text-accentText" aria-hidden />
          <span className="flex-1 text-base text-text">Cadastro feito</span>
        </li>
        <li className="flex min-h-14 items-center gap-3 px-4">
          {jaEntrou || conviteFeito ? (
            <Check size={22} className="shrink-0 text-accentText" aria-hidden />
          ) : (
            <Circle size={22} className="shrink-0 text-textMuted" aria-hidden />
          )}
          <span className="flex-1 text-base text-text">
            {jaEntrou
              ? `${responsavel || 'A família'} já entrou no app`
              : conviteFeito
              ? 'Convite enviado'
              : 'Convite para a família'}
          </span>
          {!jaEntrou && !conviteFeito && (
            <button
              type="button"
              onClick={mandarConvite}
              className="tap -mr-2 min-h-12 px-2 text-base font-bold text-primary"
            >
              Mandar
            </button>
          )}
        </li>
        <li className="flex min-h-14 items-center gap-3 px-4">
          {contratoAssinado ? (
            <Check size={22} className="shrink-0 text-accentText" aria-hidden />
          ) : (
            <Circle size={22} className="shrink-0 text-textMuted" aria-hidden />
          )}
          <span className="flex-1 text-base text-text">Contrato assinado</span>
          <button
            type="button"
            onClick={onVerContratos}
            className="tap -mr-2 min-h-12 px-2 text-base font-bold text-primary"
          >
            Ver
          </button>
        </li>
      </ul>

      <div className="space-y-2">
        {!jaEntrou && (
        <InviteShare
          code={code}
          childId={childId}
          childName={childName}
          gender={gender}
          parentPhone={parentPhone}
          recolhido
          onEnviado={() => {
            setEnviado(true);
            onEnviado?.();
          }}
          // O NOME DE QUEM RECEBE, e não "o responsável de Pedro": é mais curto
          // (cabia em duas linhas e cortava o ícone) e é a pessoa que ele vai
          // ver na conversa do WhatsApp.
          rotulo={responsavel ? `Mandar convite para ${responsavel}` : `Mandar convite da família de ${primeiro}`}
        >
          {/* O contrato antigo: memória do que veio antes, nunca o contrato
            * que vale. Fica em "Mais opções" — com o mesmo peso do convite,
            * alguém acharia que anexar o papel dispensa o aceite. */}
          <AnexarContratoAnterior childId={childId} />
        </InviteShare>
        )}
        {jaEntrou && <AnexarContratoAnterior childId={childId} />}

        {/* O aviso amarelo do contrato SAIU daqui (02/10/2026): os dados do
          * contrato viraram obrigatórios para mandar o convite, e quem os pede
          * é o próprio `InviteShare` — no lugar do botão, no instante em que
          * eles fazem falta. Ver `DadosDoContratoForm`. */}

        {/* O DESTAQUE ANDA (04/10/2026): enquanto o convite não saiu, o
          * protagonista é ele; depois de mandado (ou quando a família já
          * entrou sozinha), é a próxima criança. Um botão cheio por vez. */}
        <Button
          variant={enviado || jaEntrou ? 'primary' : 'secondary'}
          icon={UserPlus}
          onClick={onOutra}
          className={enviado || jaEntrou ? 'shadow-focus' : ''}
        >
          Cadastrar outra criança
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="tap w-full min-h-12 py-2 text-base font-semibold text-textMuted hover:text-text"
        >
          Ver minha turma
        </button>
      </div>
    </div>
  );
}

/**
 * ANEXAR O CONTRATO QUE JÁ EXISTIA — foto ou arquivo.
 *
 * O QUE ESTE ANEXO É, E O QUE ELE NÃO É
 * Não é o contrato do app, e a tela diz isso em voz alta. O contrato que vale
 * é gerado dos campos que o motorista acabou de preencher — mensalidade,
 * vencimento, vigência — e passa a existir quando o responsável aceita. Este
 * arquivo é memória do que foi combinado ANTES, e serve pra uma discussão
 * sobre o passado que o contrato novo não cobre.
 *
 * A confusão é perigosa e por isso está escrita: quem achar que anexar o
 * papel dispensa o aceite fica operando sem contrato válido nenhum.
 *
 * SOME QUANDO NÃO HÁ STORAGE, como todo anexo do app: botão que não pode dar
 * certo não aparece.
 */
function AnexarContratoAnterior({ childId }) {
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  if (!STORAGE_ENABLED || !childId) return null;

  const escolher = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reenviar o mesmo arquivo
    if (!file) return;
    setEnviando(true);
    try {
      const url = await uploadContratoAnterior(childId, file);
      await updateChild(childId, {
        contratoAnteriorURL: url,
        contratoAnteriorEm: new Date().toISOString(),
      });
      setPronto(true);
      toast.success('Contrato guardado junto da criança.');
    } catch (err) {
      console.error('Falha ao anexar contrato anterior:', err);
      toast.error('Não deu pra enviar o arquivo.');
    } finally {
      setEnviando(false);
    }
  };

  if (pronto) {
    return (
      <p className="flex items-center justify-center gap-1.5 text-sm text-primary">
        <Check size={16} />
        Contrato anterior guardado na ficha
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-borderStrong p-3.5">
      <p className="text-base font-semibold text-text">
        Já tem contrato com essa família?
      </p>
      <p className="mt-0.5 text-sm leading-relaxed text-textMuted">
        Anexe o papel ou o PDF que vocês já assinaram. Ele fica guardado na
        ficha como registro do que foi combinado antes —{' '}
        <strong>o contrato que vale continua sendo o do app</strong>, com os
        valores que você acabou de preencher.
      </p>
      <label className="tap mt-2.5 flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-borderStrong text-base font-bold text-text">
        <Paperclip size={18} />
        {enviando ? 'Enviando…' : 'Anexar ou fotografar'}
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          disabled={enviando}
          onChange={escolher}
        />
      </label>
    </div>
  );
}
