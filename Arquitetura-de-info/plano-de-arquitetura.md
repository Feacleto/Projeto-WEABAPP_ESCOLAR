# Plano de arquitetura — Alô Buzinou

**Data:** 30/08/2026 · **Estado:** proposta · **Escopo:** arquitetura do que já
existe. Não contém funcionalidade nova, nem tela nova.

**Como foi feito.** Cinco varreduras paralelas (rules e Storage · camada de
serviços · rotas, telas e bundle · Cloud Functions · modelo de dados e custo),
mais uma passada própria sobre build, testes, churn e invariantes. Depois,
segunda leitura do código conferindo as afirmações — as que não se sustentaram
foram corrigidas ou removidas, e o que mudou está registrado no fim.

**Linha de base medida:** 165 commits · 50.707 linhas em `src/` + `functions/lib/`
· `npm run lint` com 0 erros e 3 avisos pré-existentes · `npm run testar` verde
(bateria de 5 scripts) · `npm run build` em 1,67 s.

---

## 1. Diagnóstico

### Tese 1 — O sistema é mono-inquilino exatamente nos pontos que resolvem identidade

Esta é a espinha, e ela atravessa todas as camadas. O projeto vem migrando de
"um motorista" para "vários" **um incidente por vez**, e a migração parou em
lugares diferentes em cada camada. O padrão é sempre o mesmo: um ponteiro
global — `appState/init.adminUid` — respondendo à pergunta "de quem é isto?".

Sete lugares, verificados um a um:

| Onde | O que resolve errado |
|---|---|
| [functions/index.js:203-220](../functions/index.js#L203-L220) | a **chave PIX** do e-mail de cobrança, cacheada uma vez para todos os pagamentos |
| [absencesService.js:246](../src/services/absencesService.js#L246) | o destino do aviso de falta |
| [altPickupService.js:187](../src/services/altPickupService.js#L187) | o destino da troca de responsável |
| `functions/lib/billing.js:40-43` | lê `children` e `payments` de **toda** a plataforma |
| `functions/lib/invitePreview.js:66` · `invites.js:93` | o motorista mostrado na prévia do convite |
| `functions/lib/receiptGuard.js:36` | compara comprovantes **entre** operações |
| `taxaService.js:299` | baixa toda criança ativa da plataforma para o navegador do dono |

O resolvedor correto **já existe** e tem o bug escrito no cabeçalho:
[notificationsService.js:31-41](../src/services/notificationsService.js#L31-L41)
lê `users/{uid}.adminUid`. Ele foi aplicado ali e não foi aplicado ao lado.

**Duas consequências que não são hipóteses:**

1. **Dinheiro na conta errada.** Com dois motoristas, o responsável do B recebe
   o e-mail de cobrança com a chave PIX do A. `userService.js:76-86` documenta
   exatamente esse bug — corrigido no cliente, não no servidor.
2. **Aviso que morre em silêncio.** A rule de `notifications`
   ([firestore.rules:869-872](../firestore.rules#L869-L872)) exige
   `userId == userDoc().adminUid` para quem não é motorista. Com dois
   motoristas o aviso de falta é **negado**, cai num `console.error`, e a tela
   do pai mostra sucesso.

**Por que isto é urgente sendo latente.** Com um associado, nada disso aparece.
Tudo se materializa no dia em que o segundo entrar — que é o dia em que o
negócio deu certo. Se a decisão da porta aberta
([decisao-porta-aberta.md](decisao-porta-aberta.md)) for adiante, isto deixa de
ser preventivo e vira pré-requisito.

### Tese 2 — O projeto documenta decisões com rigor, e nada verifica se elas continuam verdadeiras

Os cabeçalhos deste repositório são a melhor documentação de arquitetura que
ele tem — e são confiáveis: os quatro invariantes estruturais que o `CLAUDE.md`
afirma **se sustentam** (nenhum util importa Firebase; `horariosService.js` e
`travessia.js` têm literalmente zero imports).

O problema é a outra metade: afirmações de garantia que o código ao lado não
cumpre. O próprio `firestore.rules:814-817` já cataloga sete ocorrências. São
mais:

- **`AppSheet.jsx:10-14`** afirma existir porque "onze arquivos tinham a mesma
  folha copiada à mão" e nomeia os onze. **Nenhum dos onze a usa.** Nove ainda
  copiam a casca (verificado: os dois conjuntos de arquivos são disjuntos).
- **`taxaService.js:35-39`** justifica o cálculo rodar no navegador porque "a
  Cloud Functions API está desativada". Existem 15 functions em produção.
- **`isOwner()`** ([firestore.rules:95-107](../firestore.rules#L95-L107)) diz em
  parágrafos consecutivos que `superAdmin` saiu e que continua valendo.
- **`callableError.js:29`** classifica `functions/internal` como "não publicada"
  — mas desde que `exigirCloud` passou a barrar antes, `internal` só chega
  quando a function existe e **crashou**.
- **`notificationsService.js:331`** justifica helpers locais para "evitar
  dependência circular com `utils/formatters`" — `formatters.js` não tem uma
  única linha `import`. A justificativa é falsa e é o que mantém a divergência.

Isso não é um problema de estilo. **É o mecanismo pelo qual os bugs voltam:**
um agente futuro lê a garantia, confia, e constrói em cima.

### O que a arquitetura já faz bem (não "consertar")

Registro explícito, porque metade disto parece problema à primeira vista:

- **Ids que carregam significado** dão idempotência de graça:
  `rides/{YYYY-MM-DD}`, `absenceDeclarations/{dia}_{criança}`,
  `faturasParceiro/{uid}_{mes}`, `entryBonuses/{uid}`,
  `notifications/confirm_{dia}_{criança}`.
- **Camada limpa no Storage:** nenhum componente importa `firebase/storage`.
- **Sem ciclos** no grafo de services.
- **Agregação no servidor** (`count()`/`sum()`) no painel do dono.
- **`horariosService.js`** — 587 linhas de regra pura, zero imports, com
  bateria de teste. **É o modelo do que a Fase 2 replica.**
- **`liveLocation`** é sobrescrito, não acumulado.
- **`deploy.ps1`** com guarda de branch e a ordem functions-antes-de-hosting.

---

## 2. Backlog

Ordenado por risco removido ÷ custo. Custo em dias de trabalho focado.

### A1 · O ponteiro único de inquilino · risco ALTO · custo 1,5d
**Problema.** Sete lugares resolvem "o motorista" por `appState/init.adminUid`.
**Evidência.** A tabela da Tese 1.
**Proposta.** Cliente: usar `child.adminUid`, que o chamador já tem. Servidor:
resolver por `payment.adminUid` / `child.adminUid`, com o `Map` virando cache
por uid. `getShowcase` fica como está — vitrine de um parceiro é decisão escrita.
**Raio.** `absencesService`, `altPickupService`, `functions/index.js`,
`lib/invites.js`, `lib/invitePreview.js`, `lib/receiptGuard.js`.
**Verificar.** Dois motoristas semeados; declarar falta como responsável de A e
conferir que a notificação nasce com `userId == A`; rodar
`runPaymentRemindersNow` e conferir duas chaves PIX diferentes.

### A2 · Cobertura de rules antes de tocar em rules · risco ALTO · custo 2d
**Problema.** 11 dos 24 blocos não têm um único caso de teste — incluindo
`payments` (o dinheiro do pai) e as cinco coleções da taxa. Faltam os dois
atores que mais importam: **anônimo** (a sessão que motivou metade das
correções) e **`aguardando`** (cujo isolamento inteiro depende de `isAppUser()`
excluí-lo).
**Evidência.** `scripts/testar-regras.mjs` — 4 atores, nenhum anônimo,
`payments` com 0 ocorrências.
**Proposta.** Atores novos + casos para os 11 blocos. Um script que extrai os
`match /colecao` do `firestore.rules` e falha se algum não aparecer no teste.
**Raio.** `scripts/`, `package.json`.
**Verificar.** O guarda nasce vermelho. Se nascer verde, está medindo errado.
**Nota de sequência.** Isto vem **antes** de A3. Mudar rules sem rede é o único
jeito de transformar uma correção em incidente.

### A3 · `isAdmin()` sem escopo · risco ALTO · custo 1d
**Problema.** Em 2 linhas `isAdmin()` é a regra inteira; em outras 7 ele é uma
alternativa não escopada dentro de um `||`. O efeito é o mesmo: qualquer
motorista aprovado passa.
**Evidência.** Terminais: [firestore.rules:1072](../firestore.rules#L1072)
(`waitlistParents` read/update/delete) e `:1300` (`entryBonuses list`).
Alternativas: `:240` (`users` get), `:796`, `:800`, `:1095`, `:1190`, `:1208`.
Compostos com outras regras corretas, dois viram cadeia:
`feedbacks` tem `allow list` **sem `isSignedIn()`** (`:1212-1216`, verificado) e
devolve o doc inteiro com `uid` e `role`; `users` get (`:238-242`) transforma
esse uid em nome, telefone e **chave PIX** de qualquer motorista.
**Proposta.** `users` get para responsável passa a exigir
`userDoc().get('adminUid','') == uid` — o mesmo predicado que `liveLocation` e
`agendaEntries` já usam. `taxaConfig` (`:1320`, hoje `isAppUser()`) passa a
`isAdmin() || isOwner()`. `waitlistParents` alinha com `waitlistDrivers`. O
ramo público de `feedbacks` sai para a callable `getShowcase`, que já é pública.
**Raio.** 6 blocos de rules; nenhuma consulta do cliente muda de forma.
**Verificar.** `pai1` lê `users/{tio2}` → NEGA; `users/{tio1}` → PASSA.

### A4 · Callables privilegiadas com o gate do papel errado · risco ALTO · custo 1d
**Problema.** `runBillingNow`, `runPaymentRemindersNow` e
`backfillTestimonialPrivacy` exigem `role === 'admin'` — que é **motorista**. E
operam sobre a plataforma inteira. Um parceiro tocando "gerar cobranças"
fatura a base dos outros. `backfillTestimonialPrivacy` é chamada pelo painel do
**dono** e exige papel de motorista: no dia da migração para `role: 'owner'`, o
dono perde o acesso e o motorista mantém.
**Evidência.** `functions/index.js:315-318`, `lib/billing.js:186-189`,
`lib/privacyBackfill.js:46-49`, chamada em `AdminPanel.jsx:522`.
**Proposta.** `functions/lib/papeis.js` espelhando `src/utils/papeis.js`
(inclusive o legado `superAdmin`), com `exigirMotorista` e `exigirDono`. As
callables manuais recebem o uid do chamador como escopo; a agendada continua
global — é ela que deve ser.
**Raio.** `functions/`, nenhuma assinatura muda no cliente.

### A5 · Regra pura trancada atrás do Firebase · risco ALTO · custo 3d
**Problema.** A causa-raiz dos dois bugs de dinheiro abaixo. Lógica pura vive
dentro de módulos que importam `db`, e neste projeto — que testa com scripts
Node puros, sem framework — **um import de Firebase é o que torna a regra
intestável**.
**Evidência de que o custo já foi cobrado, duas vezes:**
- **Contrato de R$ 0,00.** [contratoAssociacaoService.js:102](../src/services/contratoAssociacaoService.js#L102):
  `mesesCobrados = Math.max(0, (per === 'mensal' ? 1 : meses) - carencia)`. Com
  periodicidade mensal (o padrão de `setNegociacao`) e carência ≥ 1, dá **zero**
  → `totalPeriodo = 0` → `valorMensalReconhecido = 0`. O contrato sai R$ 0,00/mês
  para toda a vigência, é hasheado e assinado. **A carência de 1 a 4 meses é
  exatamente o que a roleta concede**, então o caminho comum dispara. E
  `taxaService.js:269-280` documenta o **mesmo bug**, por outro caminho,
  corrigido antes.
- **Nome truncado no push de cobrança.** [notificationsService.js:233](../src/services/notificationsService.js#L233):
  `split(/s+/)` sem a barra invertida — quebra na letra "s". "Vanessa Silva"
  vira "Vane".
**Proposta.** Extrair para `src/utils/`, no molde de `horariosService.js`:
`taxa.js` (9 funções, incl. `calcularTaxa` e a correção de fuso de
`dataDeVencimento`) · `contratoAssociacao.js` (`montarContrato`) ·
`statusPagamento.js` (`computeDisplayStatus`, `canUndoReceipt`,
`deriveParentReminders` — que já recebe `now` injetável) · `pix.js` (unificando
as duas `normalizePixKey` de assinaturas invertidas) · `authErrors.js`
(`mapAuthError`, hoje em 4 arquivos). Um script de teste por módulo.
**Raio.** ~15 arquivos de import; nenhuma mudança de comportamento além dos
dois bugs.
**Verificar.** `npm run testar:taxa` e `testar:contrato` rodam sem `firebase`.
Teste que emita `{periodicidade:'mensal', isencaoMeses:2}` e afirme
`valorMensalReconhecido > 0` — hoje falha.

### A6 · Sem CI · risco ALTO · custo 0,5d
**Problema.** 3.722 linhas de teste em `scripts/` e **nada as executa**. Não há
`.github/workflows`. A decisão de não usar framework é defensável, mas ela só
funciona se algo rodar os scripts — hoje é disciplina manual.
**Proposta.** Workflow com `npm run lint && npm run testar`. Emulador para
`testar:regras` entra junto de A2.
**Verificar.** Um PR com o regex de A5 revertido deve ficar vermelho.

### A7 · `payments` com id aleatório · risco MÉDIO-ALTO · custo 0,5d
**Problema.** A cobrança é criada com `doc()` sem id; a idempotência é
"consultar antes de criar", com o commit em lotes de 400 no meio. Duas
execuções concorrentes (agendada + `runBillingNow`, ou retry sobre commit
parcial) criam **duas cobranças da mesma criança no mesmo mês**. E
`paymentsService.js:411` afirma ao usuário que "chamar isto nunca duplica nada".
**Evidência.** `functions/lib/billing.js:98`, `:42`, `:114-118`.
**Proposta.** `payments/{childId}_{monthKey}` + `batch.create()`. O padrão da
casa já existe em cinco coleções. Some também a varredura global diária.
**Verificar.** `runBillingNow` duas vezes em paralelo no emulador; contar docs.

### A8 · Consultas sem teto · risco MÉDIO-ALTO · custo 1,5d
**Problema.** Quatro consultas baixam coleção inteira e recortam em JS.
**Evidência.** `notificationsService.js:162-181` (sem `limit`, assinada no
`Header`, montado em **todas** as telas) · `agendaService.js:366-372` e
`:407-413` · `absencesService.js:180-201` (histórico inteiro no **Início** do
pai) · `taxaService.js:299-302` (toda criança ativa, com endereço e telefone,
para o navegador do dono) · `billing.js:132-135` (`purgeOld` sem `limit`).
**Proposta.** `limit()` + janela onde couber; `purgeOld` em laço.
**Restrição descoberta no Passe 3:** limitar `notifications` a 50 muda o
significado do contador de não-lidas — passa a ser "não lidas entre as 50
recentes". Ou o badge ganha um `count()` separado, ou o limite é maior que
qualquer acúmulo plausível. **Não é troca gratuita.**

### A9 · `criancasAtivas` sem transação · risco MÉDIO · custo 0,5d
**Problema.** O contador que as rules usam para validar `limiteCriancas` tem
**dois** buracos: o decremento lê `active` **fora** do batch
(`childrenService.js:256-258` — duas abas leem `active: true` e descontam duas
vagas), e `updateChild` repassa `active` como campo qualquer sem tocar no
contador (`childrenService.js:192-206`), então reativar criaria criança ativa
que não ocupa vaga.
**Evidência.** `childrenService.js:244-265` e `:192-206`.
**Correção de rota (30/08).** Este item dizia um terceiro buraco — que
`accountService.deactivateChildAndParent` não decrementava. **É falso.** O
decremento existe em [accountService.js:200-208](../src/services/accountService.js#L200-L208),
com a guarda `child.active !== false` e a razão escrita para estar fora do
batch. Duas varreduras convergiram no mesmo erro; a leitura do arquivo o
desfez. Ficou como registro porque foi o único achado do plano que não
sobreviveu à execução.
**Alcance real hoje.** Nenhum chamador passa `active` para `updateChild`
(verificado nos 4 call sites), então o segundo buraco é **armadilha latente**,
não bug vivo — e é por isso que este item ficou na Fase 3 e não na Fase 0.
**Proposta.** Decremento em transação; `updateChild` recusa `active` no
payload; agendada `reconciliarContadores` recalculando por `count()`.
**Verificar.** Desativar a mesma criança de duas sessões e comparar
`criancasAtivas` com `count()` de `children where active == true`.

### A10 · Assinaturas duplicadas · risco MÉDIO · custo 2d
**Problema.** 12 `onSnapshot` no `/tio` dirigindo onde bastariam 4; 10 no `/pai`
onde bastariam 3. `SchoolBroadcastSheet` assina **com a folha fechada**.
**Evidência.** `children` ×4, `escolas` ×3, `liveLocation` ×3 no motorista;
`children/{id}` ×5 no responsável.
**Proposta.** Provedor de escopo nos dois layouts, exposto pelo
`useOutletContext` que o `TioDashboard` já consome. Montar o miolo das folhas
com `{open && ...}`, padrão que `ChildDetail.jsx:517` já usa.
**Aliado, não conflitante:** `MeuTransporteSheet.jsx:40` já decidiu que
"contagens vêm por prop, não de `useChildren` aqui dentro". Isto generaliza
essa decisão às outras três folhas da mesma tela.

### A11 · Violações de camada · risco MÉDIO · custo 0,5d
**Problema.** Três telas importam `firebase/firestore` direto; duas escrevem a
**mesma** query `users where role == 'admin'` byte a byte, com tratamento de
erro divergente. `FunilTab` trata `[]`-por-falha como `[]`-real e recusa orçar
um lead cuja conta **está** aprovada.
**Evidência.** `TaxaTab.jsx:14,97` · `FunilTab.jsx:2,52` · `TioDashboard.jsx:3,157`.
**Proposta.** `listarParceiros()` em `taxaService`; `TioDashboard` usa o
`useLiveLocation` que já existe; `watchLiveLocation`/`watchLimite` nos services.
**Verificar.** `grep -rn "firebase/firestore" src/pages src/components` vazio.

### A12 · Comentários que afirmam garantia falsa · risco MÉDIO · custo 0,5d
**Problema.** Cinco casos (Tese 2). É barato e é o que impede o próximo agente
de construir sobre premissa falsa.
**Proposta.** Corrigir os cinco cabeçalhos. `AppSheet` tem duas saídas: migrar
as 9 folhas, ou dizer a verdade sobre o que ela é hoje.

### A13 · Duplicação de helpers · risco BAIXO-MÉDIO · custo 1d
**Problema.** `formatBRL` ×4 (com neutros divergentes: `'—'` vs `'R$ 0,00'`) ·
`formatDistance` ×3 (as duas cópias erram o separador decimal: `1.2 km` em vez
de `1,2 km`) · `mapAuthError` ×4 · código de convite ×4 · `REGION` ×11 ·
`America/Sao_Paulo` ×4 · chave de mês ×11.
**Consequência visível.** `inviteCodeService.js:44` diz "São 2 letras e 4
números (ex: TN4582)" — o formato **legado**. Todo convite novo tem 6
caracteres. Quem errar um caractere lê a instrução errada.
**Proposta.** `functions/lib/constantes.js` e `lib/mes.js` no servidor; no
cliente, apagar as cópias locais.

### A14 · Bundle · risco BAIXO-MÉDIO · custo 1d
**Problema.** `config-*.js` tem **556,83 kB** (164,75 kB gzip) com
`modulepreload` em toda primeira pintura, porque `firebase/config.js` instancia
`getFirestore` e `getStorage` no topo — e as duas portas públicas não leem
Firestore. `Welcome` é o único import **eager** sem justificativa e nenhuma tela
aponta para ele. A responsável baixa a home do motorista inteira (`Home` 1090
linhas + `PhoneDemo` + `WaitlistSheet`) para abrir `/convite/:codigo`.
**Contexto que decide a prioridade.** `firebase/config.js:79-88` comemora ter
matado exatamente este bug com o analytics ("~56 KB baixados pelo responsável
que abre o link do WhatsApp em dado móvel"). Firestore é ~6× maior.
**Proposta.** `Welcome` e `PartnerPitch` para `lazy()` (baratos). `getStorage`
atrás de acessor preguiçoso. `db` assíncrono é invasivo (38 services importam no
escopo do módulo) — **medir antes de decidir**.

### A15 · Índices contraditórios · risco BAIXO-MÉDIO · custo 0,5d
**Problema.** Três índices declarados que nenhuma query usa (custo de escrita
sem retorno). E uma contradição: quatro pares de igualdade pura **são**
declarados enquanto consultas de igualdade pura idênticas em forma **não** são
(`pendingCalls (parentUid, status)`, `children (adminUid, inviteCode)`). As
duas leituras não podem ser verdade ao mesmo tempo — ou os quatro são
desperdício, ou a buzina e o resgate de convite estão a um deploy de falhar em
produção sem falhar no emulador.
**Proposta.** Rodar cada consulta contra emulador com índices zerados e
uniformizar.

### A16 · Arquivos que concentram churn · risco BAIXO · custo 3d
**Problema.** Oito arquivos acima de 900 linhas. Churn e tamanho coincidem
quase perfeitamente: em 165 commits, `PaiDashboard` (32 commits / 943 linhas),
`TioDashboard` (25 / 760), `TioFinance` (23 / 1.062), `ChildDetail` (20 / 932),
`Profile` (19 / 1.145), `ChildForm` (18 / 1.085). É a pressão apontando o dedo.
**Proposta.** Mover os subcomponentes **já nomeados** para
`src/components/<domínio>/`, preservando cada cabeçalho de decisão. Só
`OperacaoDaRota` (um componente de 765 linhas) exige trabalho real: a regra de
"quem falta marcar" sai para `horariosService`, que é puro de propósito.
`ChildForm` é destino de rota morando em `components/` — vai para `pages/tio/`.
**Nota.** Isto é refatoração de UI existente. **Nenhuma tela nova, nenhum
elemento novo de interface.**

### A17 · `.env` rastreado no git · risco BAIXO (hoje) · custo 5min
**Problema.** `.env` está em `git ls-files` **e** no `.gitignore:16` — o ignore
não destraqueia o que já entrou. Hoje só tem `VITE_FIREBASE_*`, públicas por
natureza. O próximo segredo entra no repositório sem aviso.
**Proposta.** `git rm --cached .env`.

---

## 3. Fases

Cada fase entrega sozinha e deixa o sistema melhor no ponto em que termina.

### Fase 0 — Parar o sangramento e ligar a rede · ~1,5 dia
**Objetivo.** Não refatorar em cima de erro de dinheiro, e ter uma rede antes
de mexer em qualquer coisa.
**Entra.** A6 (CI com lint + testar) · A17 · os dois bugs pontuais de A5 (o
regex e o contrato R$ 0,00, corrigidos **no lugar onde estão**, sem extração
ainda) · A9 parcial (o decremento que falta em `accountService`).
**Critério de pronto.** CI verde em PR; um contrato mensal com carência emite
valor > 0.
**Não entra.** Nenhuma extração, nenhuma mudança de rules.
**Por que primeiro.** É o único conjunto onde o custo é de horas e o que se
remove é dinheiro errado em documento assinado.

### Fase 1 — A fronteira do inquilino · ~5 dias
**Objetivo.** Que a pergunta "de quem é isto?" tenha uma resposta só, e que
`grep` consiga enumerar o que falta.
**Entra, nesta ordem interna:** A2 (cobertura de rules **primeiro**) → A1
(ponteiro único) → A3 (escopo nas rules) → A4 (gate de papel nas callables).
**Critério de pronto.** `appState/init.adminUid` não resolve identidade em
lugar nenhum; `isAdmin()` não aparece como termo terminal; os 24 blocos de rules
têm caso; atores anônimo e `aguardando` existem na suíte.
**Não entra.** Performance, tamanho de arquivo, bundle.
**Dependência externa.** Se a porta aberta for adiante, esta fase é
pré-requisito dela, não paralela.

### Fase 2 — A regra pura sai da jaula · ~4 dias
**Objetivo.** Que dinheiro e permissão sejam testáveis sem Firebase.
**Entra.** A5 completo (as 5 extrações + scripts) · mover `horariosService.js`
para `utils/horarios.js`, corrigindo a seta invertida (dois utils importam um
service hoje) · A13 (duplicação de helpers) · A12 (os cinco cabeçalhos).
**Critério de pronto.** `grep -rn "from '../services" src/utils` vazio;
`npm run testar` cobre taxa, contrato e status de pagamento.
**Por que depois da Fase 1.** Extrair função que ainda resolve o inquilino
errado congela o erro dentro de um teste que o abençoa.

### Fase 3 — Escala e custo · ~4 dias
**Objetivo.** Que o sistema não mude de comportamento entre 20 e 1.000 crianças.
**Entra.** A7 (id determinístico) · A8 (tetos) · A9 completo (transação +
reconciliação) · A10 (assinaturas) · A15 (índices).
**Critério de pronto.** Com 1.000 crianças semeadas, nenhuma tela baixa coleção
inteira; `/tio` dirigindo abre 4 alvos, não 12.
**Não entra.** Nada de UI.

### Fase 4 — Tamanho e forma · ~4 dias
**Objetivo.** Que os arquivos que mais mudam parem de ser os maiores.
**Entra.** A16 · A11 (violações de camada) · A14 (bundle) · a decisão sobre
`AppSheet` (migrar as 9 ou corrigir o cabeçalho).
**Critério de pronto.** Nenhuma página acima de ~400 linhas; nenhum componente
importa `firebase/*`; `index-*.js` bem abaixo de 430 kB.
**Por que por último.** É a de maior volume de arquivos e a de menor risco
removido. Fazer antes significa mover código que ainda vai mudar de dono.

---

## 4. Riscos

| Fase | O que pode dar errado | Reversão |
|---|---|---|
| 0 | O contrato passa a emitir valor onde antes emitia zero — contratos **já aceitos** com R$ 0,00 continuam gravados e hasheados | Não reverter: identificar os aceites afetados por consulta e reemitir. A correção não os toca, e é isso que precisa ser decidido junto |
| 1 | Rule mais estreita quebra tela que ninguém lembrou | A2 vem antes justamente por isso. Rules têm rollback por deploy, e o `deploy.ps1` já ordena |
| 1 | Escopar `users` get pode quebrar o `PixBlock` do pai | O vínculo `adminUid` já existe no doc dele; testar com dois motoristas antes |
| 2 | Extração muda comportamento por engano | Cada extração entra com o teste no mesmo commit; `npm run testar` é a rede |
| 3 | `limit()` em `notifications` muda o contador de não-lidas | Descrito em A8 — decidir o desenho do badge antes, não durante |
| 3 | Id determinístico convive com pagamentos antigos de id aleatório | Nada lê o id por convenção; a consulta é por campo |
| 4 | Mover subcomponente perde o cabeçalho de decisão | O cabeçalho viaja com a peça; revisão de diff olha isso |

**Risco transversal.** Este plano toca dinheiro em três frentes (contrato, taxa,
mensalidade). Nenhuma fase deve ir para produção sem `npm run testar:regras`
verde — que hoje cobre 13 dos 24 blocos, e é por isso que A2 é a primeira coisa
da Fase 1.

---

## 5. Considerado e descartado

**TypeScript.** É a proposta reflexa para metade dos achados (`normalizePixKey`
com assinaturas invertidas, `formatBRL` com neutros divergentes). Descartado:
o `CLAUDE.md` registra JS puro como decisão, e o custo de migrar 50 mil linhas
compete com as Fases 0 a 3 inteiras. A extração para `utils/` + testes resolve
a mesma classe de erro pelo caminho que o projeto já escolheu.

**Vitest/Jest.** Mesma razão. Os scripts Node em `scripts/` já são 3.722 linhas
e funcionam; o que falta não é framework, é **CI** (A6) — que custa meio dia e
resolve o problema real, que é ninguém rodar.

**Quebrar `firestore.rules` em vários arquivos.** Firebase não suporta import
entre arquivos de rules; a concatenação em build criaria um arquivo gerado onde
hoje há um arquivo lido. As 71 KB não são o problema — a falta de
correspondência entre parágrafo e caso de teste é, e A2 ataca isso.

**Mover `fecharFatura` para o servidor.** O cabeçalho tem duas metades: a
premissa ("não existe servidor") é falsa, mas o argumento ("quem calcula é o
credor, e o devedor não escreve em `faturasParceiro`") continua válido e as
rules o sustentam. Descartada a mudança; mantida a correção do comentário (A12).

**Unificar `renderAction` do motorista e do responsável.** São o mesmo estado
visto de dois lados com permissões diferentes. As rules garantem que o pai só
escreve `claimed`, mas unificar a UI convidaria ao botão errado.

**Congelar `agendaEntries.parentUids`.** Considerado ressincronizar o array
quando família nova entra. Descartado: aviso é fato datado, e reescrever
destinatário de aviso antigo é pior que o desalinhamento. O que precisa mudar é
`createBroadcastEntry` parar de devolver `alcance` como se fosse a família de
amanhã.

**Renomear `role: 'admin'` para `motorista`.** É a origem da armadilha central
do projeto. Descartado por ora: exige migração de dados, das rules e do cliente
simultaneamente, com uma janela em que os três precisam concordar — risco alto
demais para ganho de legibilidade, enquanto A2 não estiver pronto. Vira
candidato real depois da Fase 1.

---

## 6. Os três passes de revisão

### Passe 1 — Veracidade
Cada afirmação foi reaberta no arquivo. **O que mudou:**

- **Corrigido um exagero.** A varredura relatou "nove usos nus de `isAdmin()`".
  Verificado: **2** onde ele é a regra inteira, **7** onde é alternativa não
  escopada. O efeito prático é o mesmo, a formulação não era. A3 foi reescrito.
- **Confirmados por leitura direta,** e por isso mantidos como fato:
  `feedbacks` com `allow list` sem `isSignedIn()`; `users` get liberando
  qualquer motorista; `taxaConfig` em `isAppUser()`; `waitlistParents` em
  `isAdmin()`; o regex `split(/s+/)`; o contrato R$ 0,00; `.env` rastreado;
  `Welcome` eager; `formatDistance` ×3; `mapAuthError` ×4; os 9 arquivos com a
  casca de folha copiada contra os 9 que usam `AppSheet` — conjuntos disjuntos.
- **Elevada a gravidade de um item.** A varredura disse que o aviso de falta
  iria "para o motorista errado". Lendo `firestore.rules:869-872`: a rule exige
  `userId == userDoc().adminUid`, então com dois motoristas a escrita é
  **negada** e morre num `console.error` — o pai vê sucesso. Pior que o
  relatado.
- **Removido o que não se sustentou.** Números de chunk divergiam entre
  varreduras (builds diferentes). Ficaram apenas os que eu mesmo medi:
  `config-*.js` 556,83 kB e `index-*.js` 430,12 kB.

### Passe 2 — Sequência
**O que mudou — duas reordenações reais:**

- **CI subiu para a Fase 0.** Estava no fim. Errado: ele é o multiplicador de
  todas as outras fases, custa meio dia, e sem ele as Fases 1 a 4 são
  refatoração sem rede. Um plano que só liga o alarme depois de mexer na casa
  inteira está na ordem inversa.
- **Cobertura de rules (A2) passou à frente da correção de rules (A3).** O
  rascunho corrigia as rules e depois testava. Isso deixaria um ponto
  intermediário em que o sistema está **pior** que hoje: regras novas, não
  exercitadas, num arquivo que já acumulou sete casos de comentário divergindo
  do código.
- **Verificado que nenhuma fase piora o sistema no meio.** A única que chegou
  perto era a Fase 2: extrair função que ainda resolve o inquilino errado
  congelaria o erro dentro de um teste que o abençoa. Por isso ela ficou
  **depois** da Fase 1, e isso está escrito como razão, não como ordem.

### Passe 3 — Conflito com decisão registrada
Cada proposta foi confrontada com os cabeçalhos. **O que mudou:**

- **Um conflito real encontrado, e o item foi reescrito.** Pôr `limit(50)` em
  `notifications` parecia livre. Mas o contador de não-lidas do `Header` passa a
  significar "não lidas entre as 50 recentes" — um badge que mente por baixo. A8
  agora carrega essa restrição explícita, e a decisão do badge vem antes da
  mudança.
- **Três propostas confirmadas como alinhadas** (não conflitantes, ao contrário
  da primeira impressão): mover `horariosService` para `utils/` **fortalece** o
  "não importa nada de propósito" do cabeçalho dele; o provedor de assinaturas
  **generaliza** a decisão já tomada em `MeuTransporteSheet.jsx:40`; o id
  determinístico de `payments` torna **verdadeira** a frase que
  `paymentsService.js:411` já diz ao usuário.
- **Uma proposta retirada.** O rascunho sugeria mover `fecharFatura` para o
  servidor, tratando o cabeçalho como obsoleto. Lendo inteiro: só a **premissa**
  é falsa ("não existe servidor"); o argumento — o credor calcula, o devedor não
  escreve em `faturasParceiro`, e as rules sustentam — continua válido. Virou
  correção de comentário (A12) e entrada em "descartado".
- **Confirmado que nada do plano contraria a regra do escopo.** Nenhum item
  propõe funcionalidade nova, e nenhum acrescenta tela, rota, aba ou elemento de
  interface. A16 e A14 movem UI que já existe; A5 e A13 movem lógica; o resto é
  rules, functions, testes e modelo de dados.

---

## 7. Estado da execução — 30/08/2026

14 commits, 79 arquivos, +3.399/−993 linhas. Cada commit foi validado com
`npm run lint`, `npm run testar`, `npm run build` e, quando tocou rules,
`npm run testar:regras` contra o emulador.

**Testes: 182 → 363** casos de lógica · **69 → 101** casos de rules.

### Executado

| Item | Estado |
|---|---|
| **Fase 0** — bugs vivos, CI, `.env` | completa |
| **A1** ponteiro único de inquilino | completa (7 lugares) |
| **A2** cobertura de rules | completa (+2 atores, +8 coleções) |
| **A3** `isAdmin()` sem escopo | completa (7 furos) |
| **A4** gate de papel nas callables | completa |
| **A5** regra pura para `utils/` | completa (taxa, contrato, status, pix, auth) |
| **A6** CI | completa |
| **A7** id determinístico de `payments` | completa |
| **A8** tetos nas consultas | completa (4 tetos + 1 recusa deliberada) |
| **A9** contador de vagas | completa (transação + `updateChild` recusa `active`) |
| **A11** violações de camada | completa (`grep` sai vazio) |
| **A12** comentários com garantia falsa | completa (5) |
| **A13** duplicação de helpers | completa |
| **A14** bundle | parcial — ver abaixo |
| **A17** `.env` rastreado | completa |

### Não executado, e por quê

**A16 — os oito arquivos acima de 900 linhas.** É o item de maior volume e
menor risco removido do plano inteiro, e o único que exige **verificar tela a
tela**: mover subcomponente é mecânico, mas o que prova que deu certo é olhar
a tela, e eu não tenho como olhar. `npm run lint` e `npm run build` pegam
import quebrado; não pegam layout quebrado. Fica como o próximo trabalho, com
o corte de cada arquivo já mapeado na seção 2.

**A migração das nove folhas para `AppSheet`.** Mesma razão. O cabeçalho da
peça agora diz a verdade sobre isso, e o `grep` que encontra as pendentes está
escrito dentro dele.

**A14 (bundle), a metade que sobrou.** `Welcome`, `PartnerPitch` e o Cloud
Storage saíram do caminho crítico. `Home` e `Familia` NÃO foram tornadas lazy:
o ganho é real (a mãe baixa a home do motorista inteira para abrir
`/convite`), mas `App.jsx` registra por escrito que "adiantado fica só o
caminho de quem chega de fora", e primeira pintura da página que vende é
decisão de produto — não minha.

**A15 — reconciliação de índices.** Três índices declarados parecem mortos e
quatro pares de igualdade pura parecem desnecessários. Deixei os dois grupos
como estão: remover índice que na verdade é usado quebra em produção sem
quebrar no emulador, e o ganho é custo de escrita. Precisa da medição contra
projeto limpo que a seção 2 descreve, não de palpite. Os dois índices que as
consultas NOVAS exigem foram acrescentados.

**A10, a metade cara.** A consolidação por provedor não foi feita — e a
própria varredura concluiu que o preço não é rede duplicada (o SDK compartilha
target para consultas idênticas), e que os tetos de A8 resolvem o volume. Foi
feito o que ela recomendou de fato: a folha que assinava fechada, a assinatura
duplicada de `liveLocation` no `TioDashboard`, e o código morto de `altPickups`.

### O que precisa de você

1. **Deploy.** Nada disso está no ar. `deploy.ps1` já ordena functions antes de
   hosting. As rules e os dois índices novos vão junto.
2. **Secrets do CI** — `VITE_FIREBASE_*` no GitHub, senão o passo de build
   falha.
3. **`adminUids`** só passa a ser preenchido depois que `redeemInvite` subir.
   Sem dado real, não há backfill a fazer.
