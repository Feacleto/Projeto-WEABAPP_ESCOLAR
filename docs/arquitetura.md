# Arquitetura — referência

Diagnóstico do estado atual e desenho alvo. Escrito em 30/08/2026, com o projeto **em desenvolvimento, sem usuário real** — premissa que torna barato quase tudo aqui, porque não há dado para migrar.

Para as regras que não podem ser quebradas, veja [`decisoes.md`](decisoes.md). Este arquivo é o contexto por trás delas.

---

## 1. Onde o projeto está

| | |
|---|---|
| Coleções na raiz | 25 |
| `firestore.rules` | 1.393 linhas · 87 `allow` · 31 `match` |
| Services | 36 (o `CLAUDE.md` diz 38) |
| Cloud Functions | 15 exportadas · **12 no `deploy.ps1`** — `confirmarAusencias` nunca foi para produção |
| Telas > 20 KB | 12 |
| Maior chunk | `config-*.js` com **556.830 bytes** — o SDK do Firebase inteiro, porque `firebase/config.js` importa auth + firestore + storage + functions no topo |

A arquitetura é **SPA falando direto com o BaaS**: tela → hook → service → Firestore. As Cloud Functions cobrem só o que o cliente não conseguia fazer. A única fronteira de segurança são as rules — que hoje acumulam três papéis ao mesmo tempo: modelo de autorização, validador de payload e motor de invariantes de negócio.

### O que está bem-feito e deve ser preservado

- **A disciplina de comentário.** Os cabeçalhos de service contam a decisão, a alternativa descartada e o bug que motivou. É documentação de arquitetura de verdade, e é raro.
- **`horariosService.js`** — o dia do motorista como lista de paradas ordenada, sem estado persistido e **sem nenhum import**. É o modelo de camada de domínio que o alvo generaliza.
- **Testes puros com hora injetada** (`testar:aviso`, `testar:faltas`, `testar:horarios`) e **teste de rules contra emulador** com sonda positiva e negativa.
- **Decisões de produto defensáveis**: os dois dinheiros separados (mensalidade pai→motorista vs. taxa motorista→plataforma), aceite único de contrato, trilha append-only em `payments/events`, `registerType: 'prompt'` no PWA, escassez real em `rodada.js`.
- **`liveLocation` não guarda histórico.** Está certo e deve continuar — rastro de van escolar é dado que só cria risco.

### Os seis problemas estruturais

1. **Sem fronteira de escrita.** `fecharFatura` calcula `taxaCobrada`/`total` no navegador do dono; a rule é só `if isOwner()`. `criancasAtivas` sobe por `increment()` do cliente.
2. **Rules como backend.** Vaga validada com `getAfter()`. Whitelist de campos à mão em 87 lugares. O teto de 20 `get()` por batch já vazou para o domínio (`CHUNK = 15` em `advanceMany`).
3. **Papel resolvido por leitura.** Zero custom claims — todo acesso faz `get(users/$(uid))`. `storage.rules` mantém uma **cópia manual** do `isAdmin()`.
4. **Tenancy por carimbo.** `adminUid` em 8 coleções; `users.adminUid` escalar; `appState/init.adminUid` — ponteiro single-tenant — ainda lido em três caminhos, um deles mandando a **chave PIX do motorista errado** no e-mail de cobrança (o doc é carregado uma vez e cacheado para a execução inteira).
5. **Sem contrato tipado.** JS puro, sem TS. Regex do convite em 3 arquivos; `PIX_TYPE_LABELS` duplica `PIX_KEY_TYPES` e **já divergiu**.
6. **Um projeto, deploy manual, zero observabilidade.** `.firebaserc` sem alias — produção é o ambiente de teste (`semear-teste.cjs` escreve nela). Sem CI, sem Sentry, ~40 `console.error` invisíveis.

### Sintomas de escala já presentes

- `carregarBasePorMotorista` lê **todas as crianças ativas da plataforma** no navegador do dono.
- **Listeners duplicados na mesma tela:** na home do motorista, `children` é assinado 3×, `escolas` 2×, `absences` 2×, `liveLocation` 2×. Leitura Firestore paga em triplicado.
- **Fan-out no cliente sem transação** — `createSchoolBroadcast` gera *crianças × dias* ausências com `.catch(console.error)`. Falha parcial é invisível.
- Ordenação e filtro em JS para evitar índice composto. Funciona em dezenas, não em milhares.

---

## 2. Achados de permissão verificados

Lidos diretamente nas rules. Sem usuário real nenhum é incidente — importam como **evidência do mecanismo** que a arquitetura precisa eliminar: uma lista de campos mantida à mão num arquivo grande demais para caber na cabeça de quem edita.

| Achado | Onde | Efeito |
|---|---|---|
| `adminUid` fora da lista proibida de `users.update` | `firestore.rules:443` + `:701` | Um responsável reescreve o próprio `adminUid` e **lê o GPS ao vivo da perua de outro motorista**. Também permite criar notificação para qualquer uid. |
| `limiteCriancas` e `criancasAtivas` idem | `firestore.rules:429-446` | O motorista escreve o próprio limite de vagas. O comentário da linha 428 afirma que isso é proibido. |
| Callables administrativas aceitam `role === 'admin'` | `functions/index.js` | `admin` é **motorista**. Qualquer parceiro aprovado dispara cobrança, `purgeOld` e e-mails de toda a plataforma. |
| `waitlistParents`: `read, update, delete: if isAdmin()` | `firestore.rules:1072` | Qualquer motorista lê e **apaga** os leads de responsáveis. |
| `pendingCalls` `update` sem escopo | `firestore.rules:1095` | O `read` foi escopado, o `update` não. |
| `payments/{id}/events` com `isAdmin()` nu | bloco `payments/events` | Qualquer motorista lê e injeta na trilha de auditoria de qualquer pagamento. |
| `feedbacks` e `entryBonuses` em `list` | `:1208`, `:1300` | Varredura por qualquer motorista. |
| `getInvitePreview` anônima e sem throttle | `functions/lib/invitePreview.js` | Devolve nome da criança e mensalidade. O limite de 12/hora cobre só o resgate, e só logado. |
| `confirmarAusencias` fora do deploy | `deploy.ps1` | 15 exportadas, 12 publicadas. |

**Três comentários afirmam proteções que o código não tem** (rules:428, `papeis.js`, `accountService.js:196`). Isso não é desleixo — é o que acontece quando a garantia mora em prosa. E é exatamente o que faz um agente errar com confiança: ele lê a promessa, acredita, e constrói em cima.

---

## 3. O princípio: três camadas de escrita

Ver [decisão 2](decisoes.md#2-escrita-tem-três-camadas-definidas-por-ameaça--latência). Em resumo: a divisão **não** é "escrita vs. leitura", é **modelo de ameaça × tolerância a latência**.

- **A — comando no servidor.** Dinheiro, permissão, contador. Fraude compensa e o usuário tolera 1–2 s.
- **B — escrita direta + trigger de auditoria.** Rota, marcos, `liveLocation`, falta, buzina. Alta frequência, latência intolerável, fraude não compensa. A rule já cobre bem — o que falta é trilha, não fronteira.
- **C — só rule.** `readAt`, preferências.

Leitura continua `onSnapshot` direto — realtime é o produto. O que muda é o cache de assinatura por chave, que acaba com os listeners duplicados.

> **Ressalva conferida:** a persistência offline **não está ligada** (`getFirestore(app)` puro, `config.js:22`). A escrita otimista funciona com o app aberto — a tela responde na hora e queda curta de sinal se resolve — mas não sobrevive a fechar o app. Ligar a persistência é decisão consciente: melhora o offline do motorista e cria dado em repouso no aparelho. Recomendação: ligar só no app do motorista.

---

## 4. Camadas, e onde fica a fronteira

O plano original desta seção era um monorepo (`packages/core`, `packages/sdk`, `apps/web`, `apps/api`). **Não foi feito, e a decisão é para ficar.** O que ele comprava era uma fronteira; o que ele cobrava era build, versionamento e uma mudança de esqueleto num projeto de uma pessoa. A frase que sobreviveu do plano é esta, e ela era o ponto o tempo todo:

> **A fronteira que importa é a de import, não a de `package.json`.**

Então foi a de import que se construiu — sem monorepo, sem TypeScript, sem mudar o build.

```
src/
  dominio/         AS REGRAS, uma pasta por contexto. Puro.
    rota/ cobranca/ associacao/ identidade/ escola/ vitrine/
  marca/           a personalidade do app. Puro.
  compartilhado/   sem regra nenhuma. Puro, e não conhece o domínio.
  ─────────────────────────────────────────────────────────────
  services/        TODO acesso ao Firestore
  hooks/           assinam services
  pages/ components/
```

A linha no meio é verificada por `no-restricted-imports` em [eslint.config.js](../eslint.config.js), **nas duas direções**:

- de fora pra dentro — componente e tela não alcançam `firebase/*` (6 exceções nomeadas, cada uma com o motivo);
- de dentro pra fora — `dominio/`, `marca/` e `compartilhado/` não alcançam service, hook, componente, tela, Firebase **nem React**; e `compartilhado/` não alcança nem o domínio.

**A segunda direção é a que adoece calada.** A primeira falha alto: a tela quebra, alguém vê. A segunda não quebra nada — a regra de negócio "só precisa de uma consulta rápida", importa um service, e o custo aparece meses depois, quando o módulo não carrega mais no Node e o teste dele nunca foi escrito. Foi assim que a máquina de estado da criança e o teto de vagas ficaram sem verificação: não por descuido, mas porque moravam atrás de um `import { db }`.

**Regra pura é regra testável.** É essa a troca, e é a única razão da fronteira.

### O que a mudança de 31/08/2026 fez, exatamente

Os 27 módulos de `src/utils/` **já eram puros** — nenhum importava Firebase. O domínio existia; não tinha nome nem endereço, e por isso ninguém sabia se um módulo novo pertencia a ele. Foram distribuídos nos seis contextos, mais `marca/` e `compartilhado/`.

Uma única seta estava ao contrário, e era invisível justamente porque os dois lados se chamavam "utils": `masks.js` importava `generateInviteCode` para validar o código que ele mascarava — um formatador genérico dependendo de uma regra de identidade. `maskInviteCode` foi morar com o formato que ela obedece, e `masks.js` voltou a ser só formatação.

Nada de lógica mudou. 363 testes seguiram verdes, o que é a prova de que foi mudança de endereço e não de comportamento.

---

## 5. Os seis contextos

Derivados do código, não inventados — e agora **são diretórios**, não uma tabela num documento. Regra nova mora no contexto de quem decide sobre ela.

| Contexto | A pergunta | Quem decide | Tipo |
|---|---|---|---|
| **`rota`** | onde a criança está, e o que o app sabe da perua | motorista | core |
| **`cobranca`** | quanto a família deve, e como ela paga | motorista ↔ família | core |
| **`associacao`** | quanto o motorista paga à plataforma | dono | suporte |
| **`identidade`** | quem é essa pessoa, e a que ela está ligada | plataforma | suporte |
| **`escola`** | que escola é essa, e quem avisar | motorista | suporte |
| **`vitrine`** | o que cada porta pública promete | dono | genérico |

**`cobranca` e `associacao` são separados de propósito.** São os dois dinheiros, e misturá-los quebra o item 7 dos Termos — a plataforma não intermedeia a mensalidade. Enquanto era tudo "utils", a mistura só apareceria quando alguém a escrevesse; agora ela aparece como um import cruzando pasta.

### O que ainda não tem endereço

**`comunicacao` não é uma pasta, e a ausência é informação.** Não sobrou nenhum módulo puro para ela porque o fan-out de notificação está *dentro* dos services de rota, agenda e broadcast, rodando no navegador. É o contexto mais mal posicionado do sistema, e a pasta vazia seria mentira: o dia em que ele tiver uma regra pura é o dia em que ele deixou de ser chamado pelos services e passou a consumir evento (`AlunoEmbarcou` → push, `MensalidadeQuitada` → notificação, `EscolaSemAula` → falta + aviso).

**`escola` tem um módulo só** (`nomeEscola`), e é honesto dizer que a evidência para separá-lo de `rota` é fina. Ficou separado porque quem avisa a escola e quem dirige a perua respondem a perguntas diferentes — mas se em seis meses ele continuar com um arquivo, a resposta certa é dobrá-lo em `rota`.

**`config/` não virou domínio.** São constantes que o dono ajusta — o CNPJ da contratada, o piso da vitrine, a régua de vagas. São dados, não camada; o domínio pode lê-los sem passar a depender de infraestrutura.

---

## 6. Autorização em três camadas

1. **Custom claims** — quem é e em qual operação. Escrita só por function. Elimina o `get(users/uid)` de toda regra e o teto de 10 acessos por requisição.
2. **Rules** — esse dado é dele? Só leitura e escrita B/C, escopadas por caminho e por claim.
3. **Caso de uso** — pode fazer isso, com esse dado, agora? Matriz de permissões + invariante + estado (suspenso, contrato não aceito, fora da janela de estorno).

**Revogação imediata:** claim leva até 1h para propagar. `users/{uid}.versaoDaClaim` é assinado pelo cliente; ao mudar, o app chama `getIdToken(true)`. E todo caso de uso sensível revalida `suspenso` no servidor — a claim é *hint*, a decisão é do comando.

**A matriz** vive em `core/permissoes.ts` e é consumida por quatro coisas: o `exige:` do caso de uso, o `podeFazer()` da UI, o gerador de rules e o teste que percorre cada célula negada. Hoje são três fontes que se contradizem: rules, `capabilities.js` e a UI.

Duas regras que a matriz torna explícitas: **o dono não opera** (aprova, precifica, suspende, lê número — não avança status nem confirma pagamento de família), e **ninguém dispara cobrança à mão**.

---

## 7. Portas de entrada

Três coisas independentes estão fundidas num mecanismo só: autenticação, vínculo e aquisição comercial. Ver [decisões 5 e 6](decisoes.md#5-login-é-aberto-o-convite-prova-o-vínculo-não-cria-a-conta).

Correção importante: o `CLAUDE.md` diz que `redeemInvite` cria a conta do responsável. **Não cria** — a conta nasce no cliente e a callable apenas vincula. A separação já está metade feita.

Defeitos que pioram com o segundo motorista:

- **Pai com filhos em motoristas diferentes já quebra** (`invites.js:216`).
- **Código de convite pode colidir**: unicidade conferida por motorista, busca global com `limit(1)`.
- **Convite não expira.**
- **`/first-admin` grava `role:'admin'`** — cria um *motorista* achando que cria um dono. A porta do dono não existe; ele só nasce pelo console.
- **Três superfícies de login** com comportamentos opostos.

Lado comercial: cadastro self-service, régua padrão da casa aceita no contrato emitido junto, `taxaParceiros` só quando há negociação, verificação como selo. `leadsFunil` deixa de ser porta e vira sales-assist por gatilho. Hoje `waitlistDrivers` e `leadsFunil` são listas paralelas sem ligação — toda inscrição pública é **redigitada à mão** no kanban.

---

## 8. Vazamento de dado

Autorização certa não impede vazamento pelas outras portas. Três vetores que só apareceram numa segunda leitura:

- **Toda URL do Storage é credencial permanente** — ver [decisão 8](decisoes.md#8-url-do-storage-nunca-é-persistida). O mais grave da lista.
- **Rules não filtram campo** — ver [decisão 9](decisoes.md#9-o-agregado-do-aluno-é-quebrado-por-sensibilidade).
- **Sentry sem scrubbing** — ver [decisão 10](decisoes.md#10-observabilidade-é-superfície-de-dado).

Outras superfícies no inventário: push mandando `title`/`body` como notificação de exibição (aparece na **tela bloqueada** e passa pela infra do Google); `api.dicebear.com` recebendo id + gênero da criança em toda renderização de avatar; Resend recebendo nome e valor; bucket de backup sem proteção declarada; exportação em massa por usuário legítimo, que o Firestore não sabe limitar; e ausência de processo de incidente.

**O princípio:** a defesa mais barata é não ter o dado; a segunda é não mandar para a tela. A pergunta mais importante do documento talvez seja se a **coordenada exata da casa** precisa ficar guardada — endereço de criança é o dado de maior consequência do sistema.

---

## 9. Segurança cibernética num BaaS

**Não existe perímetro: o cliente é o backend.** A API do Firestore está aberta a qualquer usuário autenticado; as rules são o único filtro. Qualquer pessoa instancia o SDK no console com a própria sessão. Logo, **toda falha de rule é diretamente explorável, sem cadeia de exploração** — é por isso que a seção 2 pesa.

Sendo justo: BaaS ainda é boa decisão aqui. Você ganha sem esforço o que um servidor levaria meses para igualar — nenhum SO para corrigir, nenhum banco exposto, DDoS absorvido, TLS gerenciado, autenticação feita por quem faz isso em escala. O preço é que o controle se concentra em três lugares: rules, App Check e cabeçalhos do hosting. **Dois deles hoje não existem.**

Achados verificados:

- **`firebase.json` não tem nenhum cabeçalho de segurança** — só `Cache-Control`. Sem CSP, HSTS, `nosniff`, `Referrer-Policy`. Num app onde a sessão vive no cliente, a CSP com `connect-src` restrito é o controle antiexfiltração mais forte disponível. Ponto a favor: **zero `dangerouslySetInnerHTML`**, então aplicar é barato.
- **Negação de carteira.** Firebase não cai — cobra. Quatro callables públicas e anônimas, `getInvitePreview` lendo crianças e pagamentos por chamada, **nenhuma function declarando `maxInstances`, `timeoutSeconds` ou `enforceAppCheck`**, e alerta de orçamento que avisa sem desligar. Falta App Check, throttle e uma chave geral no Remote Config.
- **Senhas de teste no repositório**, criadas contra produção (`scripts/criar-contas-teste.cjs`).
- **Conta do dono sem MFA** e sem revogação de sessão (`multiFactor` e `revokeRefreshTokens`: zero ocorrências). Mitigação arquitetural: o painel do dono lê **resumos**, não documentos crus — assim uma conta comprometida vaza agregado, não endereço de criança.
- **A máquina de build está dentro da fronteira de confiança** — `deploy.ps1` publica de uma máquina Windows de dev, e o service worker do PWA sobrevive à correção da falha que o instalou.
- **Armadilha latente:** o login anônimo está **desligado** hoje, mas rules e comentários assumem que existe. Religar para consertar a fila de espera transforma todo `read: if isSignedIn()` em leitura pública.

---

## 10. Arquitetura legível por agente

Você vai construir isto com apoio de IA por meses. A pergunta não é como escrever um bom prompt — é **que propriedades o código precisa ter para que um agente competente não consiga quebrá-lo em silêncio**. As mesmas servem a você daqui a seis meses.

| Causa de erro | Evidência aqui | Resposta |
|---|---|---|
| Nome que mente | `role: 'admin'` = motorista | Renomear (decisão 1) |
| Garantia em prosa | 3 comentários afirmam proteções inexistentes | Garantia vira teste com o nome da regra |
| Arquivo maior que uma leitura | rules com 1.393 linhas; uma rule já caiu 230 linhas fora do bloco certo | Rules por contexto; teto de tamanho no lint |
| Nada falha quando o agente erra | Sem tipos; teste de rules fora do `npm run testar` | Portão rápido e obrigatório no CI |
| Regra duplicada | Regex do convite em 3 arquivos | Fonte única em `core` |
| Fronteira só em prosa | 8 violações da regra de camada documentada | Lint — para um agente, precedente no código vale mais que regra na doc |
| O índice envelhece | `CLAUDE.md` diz 38 services (são 36) | Gerar o que é gerável, com check de CI |

**O risco maior não é código ruim — é código plausível.** Um agente raramente escreve algo que não compila; ele escreve algo razoável que viola uma regra não escrita. Exemplos que viriam como "melhoria": falta gerando desconto proporcional (contraria a cláusula 7ª); unificar `payments` e `faturasParceiro` (quebra o item 7 dos Termos); "consertar" o `PISO_DA_VITRINE`; transformar `altResponsibles` em lista que cresce.

Contra isso não existe prompt. Existe **teste nomeado como a regra** — `falta_marcada_para_frente_nao_conta_como_falta`, `fatura_aberta_nao_entra_na_receita`, `pai_so_escreve_claimed`. O agente vê vermelho e lê o nome, e o nome é a explicação.

Cinco coisas concretas: `seed` determinístico + emulador com um comando (hoje `semear-teste.cjs` escreve em **produção**); testes rápidos; contratos Zod como documentação executável; `docs/decisoes.md`; e tarefas pequenas — que é o que toda a estrutura acima torna possível pedir.

---

## 11. Roadmap

Estimativas de dev solo com apoio de agente. Total até a primeira família real: **4 a 6 meses**. A ordem é acertar o alicerce enquanto ele é barato, e só então construir tela.

**Fase 1 — Fundação (4–6 semanas).** pnpm workspaces · TypeScript estrito no código novo · renomear papéis · modelo de dados por caminho + `vinculos/` · portas de entrada · quebrar o agregado do aluno por sensibilidade · guardar caminho em vez de URL do Storage · escola como entidade compartilhada · matriz de permissões · ESLint de fronteira · CI com teste de rules obrigatório · projeto de staging · bandeiras de modo.

**Fase 2 — Domínio e comandos (6–8 semanas).** Domínio puro extraído · casos de uso da camada A na ordem do risco · trigger de auditoria da camada B · custom claims · comunicação por evento · `readModel` com cache · testes nomeados pela regra.

**Fase 3 — Pronto para a primeira família (3–5 semanas).** App Check e throttle · Sentry **já com scrubbing** · cabeçalhos de segurança · `maxInstances` · MFA do dono · PITR e export protegido · modelo de custo · LGPD (base legal para dado de menor, canal do titular, subprocessadores, incidente) · **piloto fechado** com um motorista e três famílias · `manualChunks` e precache.

**Fase 4 — Lojas (8–12 semanas).** Expo para o motorista (é ele que precisa de GPS em segundo plano — nenhum navegador dá isso, e o `closeStaleRoutes` existe para limpar o rastro dessa limitação) · TWA do responsável na Play Store · exclusão de conta no app · versionamento de callable antes da primeira submissão.

### Esta semana, sem depender de nada

Cabeçalhos de segurança no `firebase.json` · senhas de teste fora do repositório e contas rotacionadas · `maxInstances` em todas as functions.

---

## 12. O que eu não faria

- **Trocar Firestore por Postgres.** Perderia o realtime que é o produto. Se o relatório do dono pesar, a resposta é BigQuery via export — não migrar o operacional.
- **Microserviços.** Os contextos são fronteiras de módulo, não de deploy.
- **Reescrever a UI.** Os arquivos grandes se quebram sozinhos quando a lógica sai deles.
- **Trocar os testes puros em Node por um framework.** Vitest entra *ao lado*, para o código novo.
- **Começar pelo app nativo.** Antes de `core` existir, cada tela nativa reimplementa regra — e as duas versões passam a discordar sobre quanto o pai deve.

---

---

## 13. Dívida técnica aberta

Restou de uma varredura de arquitetura executada em 30/08/2026 (14 commits;
testes de lógica de 182 → 363, de rules de 69 → 113). O que foi **feito** está
no git e não precisa de documento. O que ficou **de fora** precisa, porque
senão vira descoberta de novo daqui a seis meses.

Cada item diz por que parou, e o motivo é sempre o mesmo tipo de coisa: ou
exige olho humano, ou é decisão de produto, ou o palpite custaria mais que a
espera.

### A16 · Oito arquivos acima de 900 linhas

O maior volume e o menor risco removido do backlog inteiro, e o único que
exige **verificar tela a tela**. Mover subcomponente é mecânico; o que prova
que deu certo é olhar a tela. `npm run lint` e `npm run build` pegam import
quebrado — não pegam layout quebrado.

Os oito, com o corte já mapeado: `Profile.jsx` (1145), `Home.jsx` (1090),
`ChildForm.jsx` (1085), `TioFinance.jsx` (1062), `AdminPanel.jsx` (1011),
`OperacaoDaRota.jsx` (954), `PaiDashboard.jsx` (938), `ChildDetail.jsx` (932).

`OperacaoDaRota` é o pior: um único componente de 765 linhas. A regra de "quem
falta ser marcado" deveria sair para `dominio/rota/horarios.js`, que é puro e testável.

**É aqui que o tamanho dói, e não na organização de pastas** — churn e tamanho
coincidem quase perfeitamente nesses arquivos.

### A migração das nove folhas para `AppSheet`

Mesma razão: mecânico, mas verificável só a olho. O cabeçalho de
`AppSheet.jsx` já diz a verdade sobre a promessa não cumprida, e o `grep` que
encontra as pendentes está escrito dentro dele.

### `Home` e `Familia` sob demanda — decisão de produto

O ganho é real: a mãe baixa a home do motorista inteira para abrir
`/convite/:codigo`. Mas `App.jsx` registra por escrito que "adiantado fica só o
caminho de quem chega de fora", e primeira pintura da página que vende não é
decisão de arquitetura.

### A15 · Reconciliação de índices

Três índices declarados parecem mortos, e quatro pares de igualdade pura
parecem desnecessários. Os dois grupos ficaram como estão: **remover índice que
na verdade é usado quebra em produção sem quebrar no emulador**, e o ganho é
custo de escrita. Precisa de medição contra projeto limpo, não de palpite.

### A fronteira de import — FEITA (31/08/2026)

Era o passo mais barato que restava, e virou as duas regras da seção 4. Ficou aqui o que ela **não** consertou.

As 6 exceções de `firebase/*` continuam de pé, cada uma nomeada em [eslint.config.js](../eslint.config.js). A regra não as conserta — impede a sétima.

| Onde | O quê | Veredicto |
|---|---|---|
| `AuthContext.jsx` | `onAuthStateChanged` | legítimo — é a raiz da sessão |
| `useLiveLocation` · `useLimiteCriancas` | `onSnapshot` direto | hooks, não telas; os únicos 2 de 23 |
| `Home` · `Familia` · `AdminPanel` | `httpsCallable` | 3 telas chamando callable direto |

O conserto dos dois hooks é `watchLiveLocation` em `locationService` e `watchLimite` em `userService`. O das três telas é passar por `exigirCloud()` — hoje `AdminPanel` chama sem, e sem Blaze o erro chega ao usuário como "falha de rede".

**A dívida que a mudança expôs:** `escola` tem um módulo só, e `comunicacao` não tem nenhum — ver o fim da seção 5. Nenhuma das duas é urgente; ambas são visíveis agora, que é o que a pasta comprou.

### O que depende de você, não de código

1. **Deploy.** As rules endurecidas, os tetos das functions e os cabeçalhos de
   segurança **não estão no ar**.
2. **Secrets do CI** — `VITE_FIREBASE_*` no GitHub, senão o passo de build falha.
3. **A CSP está em `Report-Only`** esperando uma passada de navegador. Ver
   [`deploy.md`](deploy.md).
4. **Contas de teste em produção** — as senhas antigas estão no histórico do
   git; rotacionar ou apagar pelo console.

---

## O que este plano não vê

- **Erro de domínio passa pelo tipo.** "Mensalidade com o mês errado" é um tipo válido. Falta reconciliação — um job que confere que a soma das faturas bate com a base real.
- **Qualidade do dado de entrada.** Um `lat/lng` errado é a perua na porta errada. Confirmação no mapa deveria ser portão do cadastro.
- **"Não vai cair" — propus detectar, não resistir.** Sem teste de carga, sem fila para push, sem plano para queda regional (a resposta honesta é aceitar, e garantir que o app **diga a verdade** quando cair).
- **A busca por terceiro (`altPickups`) é o fluxo mais perigoso do produto** e nem o código nem este plano o tratam assim. Autorizar um estranho a levar uma criança merece código de retirada de uso único, confirmação de duas pontas e registro de quem levou.
- **O motorista é o modelo de ameaça que ninguém modela.** Suspender bloqueia escrita futura; não desfaz o que ele já viu.
- **LGPD além do wipe** — base legal para dado de menor, DPO, prazo do titular, subprocessadores, incidente. Não é código.
- **Análise estática.** Não rodei o app, não subi o emulador, não medi nada. Corrida entre listeners, memória e bateria num Android barato: invisível daqui.
- **Nada sobre o produto funcionar.** Arquitetura não conserta fluxo errado — o piloto é o único instrumento que enxerga isso.

Se eu escolhesse três coisas fora deste plano: **redesenhar a busca por terceiro**, **um piloto fechado de um mês**, e **algumas horas com um advogado de proteção de dados**. Nenhuma é código, e as três protegem mais criança do que a seção 3 inteira.
