# PATCHES — trecho por trecho

Todos os caminhos são relativos à raiz do repo. Os trechos "ANTES" são o código
atual em `WebApp-oficial-v1`.

---

## A. `src/components/tio/MeuTransporteSheet.jsx` — arquivo NOVO

Copiar `MeuTransporteSheet.jsx` deste pacote como está.

---

## B. `src/pages/tio/TioDashboard.jsx`

### B1. Imports

Adicionar:

```js
import { LayoutGrid } from 'lucide-react'; // junto dos outros ícones lucide
import MeuTransporteSheet from '../../components/tio/MeuTransporteSheet';
```

Remover dos imports lucide (ficam sem uso): `ListOrdered`, `Notebook`,
`HelpCircle`, `CalendarDays`, `Megaphone`, `History`, `Eye`, `EyeOff`.
Manter `Users` e `School` (usados no estado `vazio`) e `Clock`, `CircleAlert`,
`AlertTriangle`, `MailWarning`, `ChevronRight`, `CheckCircle2` (pendências).

Remover import agora sem uso: `formatCurrency` de `utils/formatters`
(`getCurrentMonthKey` continua).

### B2. Estado

```js
// ANTES
const [mostrarReceber, setMostrarReceber] = useState(false);

// DEPOIS
const [indiceAberto, setIndiceAberto] = useState(false);
```

O `useMemo` de `{ aReceber, atrasados, marcados }` continua — `atrasados` e
`marcados` alimentam as pendências. Só o campo `aReceber` deixa de ser lido;
pode sair da desestruturação e do retorno do memo.

### B3. Trocar `<AcoesDeCadastro />` pela linha do índice

Nos estados `antes`, `entre` e `vazio`, substituir cada ocorrência de:

```jsx
<AcoesDeCadastro
  totalCriancas={children.length}
  totalEscolas={escolas.length}
  semHorario={semHorario.length}
  onBroadcast={() => setBroadcastOpen(true)}
  navigate={navigate}
/>
```

por:

```jsx
<LinhaMeuTransporte onClick={() => setIndiceAberto(true)} />
```

Ela é sempre o **último** elemento da rolagem daquele estado.

### B4. Apagar `ReceberRow` e o "Como usar o app"

No estado `entre`, remover o bloco:

```jsx
<ReceberRow
  amount={aReceber}
  visivel={mostrarReceber}
  onToggle={() => setMostrarReceber((v) => !v)}
  onClick={() => navigate('/tio/finance')}
/>

<button
  type="button"
  onClick={() => openTutorial?.()}
  className="tap w-full flex items-center gap-2 text-xs text-textMuted justify-center py-2"
>
  <HelpCircle size={14} />
  Como usar o app
</button>
```

E apagar as funções locais `ReceberRow` e `AcoesDeCadastro` no fim do arquivo.
O componente local `Linha` **fica** (a folha tem o dela; se preferir, exporte
este e reutilize).

### B5. A linha do índice no estado `dirigindo`

```jsx
// ANTES
{estado === 'dirigindo' && (
  <OperacaoDaRota mostrarRodape={false} mostrarControle={false} />
)}

// DEPOIS
{estado === 'dirigindo' && (
  <>
    <OperacaoDaRota mostrarRodape={false} mostrarControle={false} />
    {/* O CADASTRO DEIXA DE SUMIR DURANTE A ROTA.
      * Ele sumia inteiro aqui, e a rota é justamente quando o motorista fica
      * parado no portão da escola com seis minutos livres. Pra avisar uma
      * escola ele tinha que ENCERRAR a rota — o que apaga a perua do mapa de
      * todas as famílias — e ligar de novo. Uma linha de 56px no fim da
      * rolagem é o preço de não ter mais esse buraco. */}
    <div className="px-5 pt-2">
      <LinhaMeuTransporte
        dirigindo
        onClick={() => setIndiceAberto(true)}
      />
    </div>
  </>
)}
```

### B6. Montar a folha

Junto das outras folhas no fim do JSX (`ChildDetailSheet`,
`SchoolBroadcastSheet`, `AbsenceListSheet`):

```jsx
<MeuTransporteSheet
  open={indiceAberto}
  onClose={() => setIndiceAberto(false)}
  onBroadcast={() => setBroadcastOpen(true)}
  onTutorial={() => openTutorial?.()}
/>
```

`openTutorial` já vem do `useOutletContext()` — não muda nada no `TioLayout`.

### B7. `LinhaMeuTransporte`

Colar o conteúdo de `LinhaMeuTransporte.jsx` deste pacote como componente
local, ao lado de `Linha`. Precisa de `LayoutGrid` e `ChevronRight` no escopo.

### B8. Atualizar o cabeçalho do arquivo

O comentário grande do topo do `TioDashboard.jsx` descreve o estado atual e
diz que as quatro ações "viraram linhas escritas e visíveis". Isso deixa de
ser verdade — o `CLAUDE.md` é explícito: comentário que promete o que o código
não faz já foi problema recorrente aqui. Substituir a seção "O QUE SAIU, E POR
QUÊ" por:

```
 * O QUE SAIU, E POR QUÊ
 * A gaveta "Mais opções" virou linhas escritas, e depois as linhas saíram
 * pra folha "Meu transporte". Não é a gaveta de volta: gaveta escondia sem
 * nome e sem lugar fixo. A folha tem nome escrito, mora sempre no mesmo
 * ponto, e — a diferença que motivou a mudança — CONTINUA ALCANÇÁVEL
 * DURANTE A ROTA, que é quando ele está parado e o cadastro antigo sumia.
 *
 * Os quatro cartões de contagem também saíram (ver ListaDaViagem), e o
 * "a receber no mês" foi apagado: previsão é pergunta que ele não faz, e o
 * Financeiro já responde melhor com "recebido" e "quem está devendo".
```

---

## C. `src/components/route/ControleDeRota.jsx` — o nome do modo

O botão de iniciar **não muda**. Muda só a faixa de rota ativa.

### C1. Nova prop

```js
export default function ControleDeRota({ onIniciar, direcao = null }) {
```

`direcao` é `'ida' | 'volta' | null` — vem do `blocoAtual.direcao`.

### C2. A faixa

```jsx
// ANTES
<div className="flex-1 min-w-0">
  <p className="text-sm font-bold text-emerald-900 leading-tight">
    Rota ativa
  </p>
  <p className="text-[11px] text-emerald-900/70">
    {semSinal ? 'procurando sinal de GPS…'
      : `o responsável está te vendo · precisão ${Math.round(precisao)} m`}
  </p>
</div>

// DEPOIS
{/* O NOME DO MODO, ESCRITO.
  * "Rota ativa" descreve o GPS, não a tela. E a tela inteira acabou de
  * trocar de papel — some a saudação, some o cadastro, aparece um botão de
  * 62px. Quem abre o app no meio da tarde não acompanhou a transição: ele
  * precisa ler onde está antes de tocar em qualquer coisa. Custa 18px numa
  * faixa que já existe. */}
<div className="flex-1 min-w-0">
  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 leading-tight">
    modo rota
    {direcao === 'ida' && ' · levando pra escola'}
    {direcao === 'volta' && ' · trazendo pra casa'}
  </p>
  <p className="text-[11px] text-emerald-900/75 mt-0.5">
    {semSinal ? 'procurando sinal de GPS…'
      : `o responsável está te vendo · precisão ${Math.round(precisao)} m`}
  </p>
</div>
```

### C3. Passar a direção

Em `TioDashboard.jsx`, na barra fixa do topo:

```jsx
<ControleDeRota onIniciar={publicarOrdem} direcao={bloco?.direcao} />
```

Em `OperacaoDaRota.jsx` (a porta de emergência `/tio/route/now`), onde ele é
renderizado com `mostrarControle`:

```jsx
{mostrarControle && (
  <ControleDeRota onIniciar={publicarOrdem} direcao={blocoAtual?.direcao} />
)}
```

`direcao` ausente degrada pra "MODO ROTA" seco — nunca fica pela metade.

---

## D. O que NÃO tocar

- `src/pages/tio/TioLayout.jsx` — as duas abas e o `AvisoDaPlataforma` ficam iguais.
- `src/pages/tio/TioFinance.jsx` — zero mudança. O "a receber" do Início **não** vem pra cá; ele deixa de existir.
- `App.jsx` / rotas — nenhuma rota nova, nenhuma removida.
- `firestore.rules` — não há mudança de permissão. Nenhuma escrita nova.
- `OperacaoDaRota.jsx` — só a linha do C3.
