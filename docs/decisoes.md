# Decisões de arquitetura

Fonte normativa. Cada decisão tem **contexto**, **decisão**, **consequência** e **como verificar** — essa última linha é a que importa: enquanto a regra não tiver um teste, ela é só prosa, e prosa não impede ninguém (humano ou agente) de "melhorar" o código quebrando-a.

> **Se uma mudança parece uma melhoria óbvia e contraria algo aqui, a decisão vence** até alguém mudá-la explicitamente neste arquivo, com a razão.

Estado: `aceita` = vale agora · `alvo` = vale a partir da refatoração · `firme` = não reabrir sem fato novo.

---

## 1. Papéis se chamam motorista, responsável e dono — nunca `admin`

**Estado:** alvo

**Contexto.** `role: 'admin'` significa **motorista**, não administrador. O próprio `CLAUDE.md` chama isso de "o erro mais caro possível aqui" — aviso que existe porque o erro se repete. Três Cloud Functions (`runBillingNow`, `runPaymentRemindersNow`, `backfillTestimonialPrivacy`) já checam `role === 'admin'` achando que checam o dono, e por isso **qualquer motorista aprovado dispara cobrança e purga de toda a plataforma**.

**Decisão.** `papel: 'motorista' | 'responsavel' | 'dono'`. `children` → `alunos`, `rides` → `viagens`. Sem produção, é find-and-replace mais um seed novo — sem dual-read, sem backfill.

**Consequência.** Nomear certo é o mecanismo de segurança mais barato que existe: todo agente raciocina a partir do nome antes de qualquer documentação.

**Como verificar.** Lint proibindo os literais `'admin'`, `'parent'` e `'owner'` fora da camada de migração. Teste que falha se alguma callable autorizar por `'admin'`.

---

## 2. Escrita tem três camadas, definidas por ameaça × latência

**Estado:** alvo · **firme**

**Contexto.** "Toda escrita sensível vai para o servidor" é regra errada aqui. O motorista toca "embarcou" no meio-fio, às vezes sem sinal; o SDK escreve otimisticamente no cache local e a tela responde na hora. Trocar isso por uma callable é esperar *cold start* com o passageiro na porta — regressão de produto em troca de proteger algo que ninguém tem incentivo para atacar.

**Decisão.**

- **Camada A — comando no servidor** (Zod → domínio → transação → evento): fechar e quitar fatura, definir limite de vagas, cadastrar aluno, confirmar recebimento e estorno, aprovar e suspender parceiro, resgatar convite, broadcast, excluir conta.
- **Camada B — escrita direta com rule + trigger de auditoria**: avançar status do aluno, marcos da viagem, `liveLocation`, declarar falta, buzina, aceite de contrato.
- **Camada C — só rule**: `readAt`, preferências, foto e turma escritas pelo responsável.

**Consequência.** As rules encolhem para ~500–600 linhas em vez de sumir. O `CHUNK = 15` de `advanceMany` continua existindo, e é preço aceitável por manter a escrita local.

**Como verificar.** Teste que falha se uma escrita da camada A for possível pelo cliente. Teste de rule negativo para cada invariante de dinheiro.

---

## 3. Escopo por caminho, não por campo carimbado

**Estado:** alvo

**Contexto.** `adminUid` está replicado em 8 coleções. Toda consulta precisa lembrar do filtro, senão é negada inteira — e `users` não tem o campo obrigatório, então nenhuma listagem é escopável por parceiro.

**Decisão.** `operacoes/{id}/alunos`, `.../viagens`, `.../mensalidades`, `.../escolas`. Escopo vira prefixo de caminho: esquecer o filtro deixa de ser possível. Custo hoje: escrever o nome certo.

**Consequência.** **Consulta de `collectionGroup` NÃO herda o escopo do caminho.** A rule `match /{caminho=**}/mensalidades/{id}` entra no **mesmo commit** da primeira consulta cruzada, nunca depois.

**Como verificar.** Teste de rule que prova que um `collectionGroup` sem escopo é negado.

---

## 4. Papel é derivado de vínculo, não campo em `users`

**Estado:** alvo

**Contexto.** `users.adminUid` é escalar. Um responsável com filhos em motoristas diferentes é irrepresentável — e **já está quebrado**: `invites.js:216` faz `adminUid: existing?.adminUid || child.adminUid`, então o segundo filho entra em `childIds` mas o escopo fica preso no primeiro motorista.

**Decisão.** `vinculos/{uid}_{operacaoId}` com `papel`, `alunoIds`, `ativoDesde`, `ativoAte`. É ele que alimenta a custom claim `operacoes: {id: papel}`. Desligar encerra com `ativoAte` — nunca apaga, porque histórico de acesso é exigência de LGPD.

**Consequência.** Pai com dois motoristas = dois vínculos. Cobertura mútua entre motoristas = vínculo com expiração. Solicitação de vaga = vínculo pendente. Três features, um modelo.

**Como verificar.** Teste com um responsável em duas operações lendo o dado certo de cada uma.

---

## 5. Login é aberto; o convite prova o vínculo, não cria a conta

**Estado:** alvo

**Contexto.** Hoje há três superfícies de login com comportamentos **opostos** — o mesmo botão do Google cria conta no `AuthSheet` e apaga a conta órfã em `Login.jsx` (`authService.js:338-343`). E não existe recuperação: quem perdeu acesso ou trocou de aparelho não tem caminho.

**Decisão.** Uma superfície de login, aberta a todos (Google, e-mail, **telefone**). A conta nasce sem papel. Zero vínculos não é bloqueio: é sala de espera com duas saídas — "tenho um convite" e "sou motorista, quero criar minha operação".

O convite continua, como **prova**: escopado por operação, com validade, em coleção própria (hoje vive dentro de `children`), notificando o motorista no resgate. Prova primária passa a ser o **telefone** que o motorista já cadastrou — OTP naquele número e o vínculo aparece sozinho, sem código que viaje em WhatsApp encaminhado.

**Consequência.** Login deixa de depender de Cloud Function. O link do WhatsApp continua sendo a porta permanente, mas leva a *entrar*, não a *criar conta*.

**Como verificar.** Teste de que uma conta sem vínculo não lê nada. Teste de que código expirado é recusado. Teste de colisão de código entre duas operações.

---

## 6. Verificação é selo — nunca bloqueia operar

**Estado:** aceita · **firme**

**Contexto.** Boca a boca morre em fila de aprovação. E o que torna isso seguro aqui é um fato do modelo: **a plataforma não apresenta motorista a família** — ele traz as famílias que já o conhecem offline.

**Decisão.** Criar operação, cadastrar aluno, convidar responsável, rodar rota e cobrar são livres no minuto zero. A verificação é estado (`nao_iniciada` → `enviada` → `verificada` | `recusada`), visível para a família na tela em que ela aceita o convite. A pressão é social, não técnica; verificado paga régua melhor. Aviso nunca é modal.

**Consequência.** Se um dia houver descoberta (evolução, estágio 4), **o portão vai na listagem pública, nunca na operação**. Um portão, dois caminhos.

**Como verificar.** Teste de que nenhum caso de uso operacional consulta o estado de verificação.

---

## 7. Escola é entidade compartilhada

**Estado:** alvo

**Contexto.** `schools` é **por motorista** (`adminUid`). A mesma escola existe N vezes, com o nome digitado de N jeitos. `schoolBroadcasts` idem.

**Decisão.** Um registro por escola real; motoristas se referenciam a ela. O aviso pertence à **escola**, não à operação.

**Consequência.** Paga sozinha hoje (aviso coerente entre motoristas do mesmo portão, nome que não varia) e é pré-requisito de tudo que a evolução prevê. Depois, quem publica o aviso pode ser a própria escola — mesma coleção, autor diferente, permissão por tipo de vínculo, **sem rearquitetura**.

**Como verificar.** Teste de que dois motoristas da mesma escola leem o mesmo documento de aviso.

---

## 8. URL do Storage nunca é persistida

**Estado:** alvo · **firme**

**Contexto.** `photoService.js` usa `getDownloadURL()` em foto de criança, comprovante, contrato e logo. Essa função devolve `?alt=media&token=<uuid>` — um **portador permanente** que baixa o arquivo sem login e **ignorando as `storage.rules` inteiras**. E a URL fica guardada no Firestore (`photoURL`, `receiptURL`, `contratoAnteriorURL`).

**Decisão.** Guardar **caminho**, nunca URL. Servir por URL assinada de curta duração emitida por caso de uso que confere o vínculo na hora.

**Consequência.** Sem isso, quem um dia leu o documento fica com link eterno para a foto de uma criança — e tirar a permissão depois não revoga nada. Todas as demais correções de permissão continuam verdadeiras com essa porta aberta atrás delas.

**Como verificar.** Lint proibindo `getDownloadURL` fora da camada de assinatura.

---

## 9. O agregado do aluno é quebrado por sensibilidade

**Estado:** alvo

**Contexto.** As rules **não filtram campo**: `allow read` libera o documento inteiro. `children` carrega nome, nascimento, **endereço**, **lat/lng**, escola, horário, mensalidade e contrato no mesmo doc. Qualquer tela que precise só do nome recebe o endereço junto.

**Decisão.** `aluno` (nome, foto, turma) · `alunoOperacional` (endereço, coordenada, horário) · `alunoFinanceiro` (mensalidade, contrato). Cada tela assina só o que usa.

**Consequência.** É argumento de **segurança** para a modelagem, não só de design. E é o que permite uma projeção pública do motorista se um dia houver listagem.

**Como verificar.** Teste que prova que a tela do responsável não recebe `alunoFinanceiro` de outra família.

---

## 10. Observabilidade é superfície de dado

**Estado:** alvo

**Contexto.** Sentry, no padrão, captura *breadcrumbs*, estado de componente e corpo de requisição. Numa tela com lista de alunos isso é **nome, endereço e coordenada de criança saindo para um terceiro** a cada erro.

**Decisão.** `beforeSend` com **lista de permissão** (não de bloqueio), `sendDefaultPii: false`, nenhum dado de aluno em breadcrumb. Nas functions, auditar o que o `logger` imprime.

**Consequência.** Sentry entra já com scrubbing no primeiro commit — nunca "a gente ajusta depois".

**Como verificar.** Teste do `beforeSend` com um payload contendo endereço, provando que ele não passa.

---

## 11. Dois modos de produto, não duas branches

**Estado:** aceita · **firme**

**Contexto.** A tentação é manter uma branch `mvp` e outra de arquitetura. Branch estável existe para não quebrar quem usa — **não há usuário**. E o que diferencia "MVP" de "escala" é política de entrada, não arquitetura.

**Decisão.** Bandeiras no Remote Config: `MODO_ENTRADA_MOTORISTA` (`aprovacao` | `self_service`), `MODO_ENTRADA_FAMILIA` (`convite` | `convite_ou_telefone`), `EXIGE_SELO_PARA_CONVIDAR`, `CONSULTOR_OBRIGATORIO`. Uma trunk, branches curtas de feature, tags de release como rede de segurança.

**Consequência.** Tudo que é estrutural (decisões 1, 3, 4, 5) é **idêntico nos dois modos**. Não existe versão barata delas — criar a coleção com o nome certo custa o mesmo que com o errado. Branch MVP não economiza; adia com juros.

---

## 12. Nenhuma regra de negócio depende de lista de campos mantida à mão

**Estado:** alvo

**Contexto.** Todos os furos de permissão encontrados nasceram do mesmo jeito: uma whitelist de campos num arquivo de 1.393 linhas. `adminUid`, `limiteCriancas` e `criancasAtivas` ficaram **fora** da lista proibida de `users.update` (`firestore.rules:443`), o que hoje permite:

- um responsável reescrever o próprio `adminUid` e **ler o GPS ao vivo da perua de outro motorista** (`firestore.rules:701`);
- um motorista escrever o próprio `limiteCriancas` — a vaga contratada é editável pelo devedor.

E o comentário da linha 428 afirma que isso é proibido.

**Decisão.** Invariante de negócio vira caso de uso da camada A, com teste. Rule fica com escopo e forma, não com regra.

**Como verificar.** Para **cada** furo, um teste de rule negativo escrito **antes** do conserto.

---

## 13. Não construir chat de comunidade dentro do app

**Estado:** aceita · **firme**

**Contexto.** Motoristas de perua vivem em comunidade e combinam rota, portão e aviso. O reflexo é oferecer um grupo por escola.

**Decisão.** Não. Funcionalidade **estruturada**, não conversa livre.

**Consequência.** Dois riscos previsíveis, e uso previsível conta: **(1)** motoristas conversando sobre "tipo de pai" é um cadastro negativo informal sobre pessoas físicas, hospedado por você, sob seus termos; **(2)** motoristas da mesma escola são **concorrentes diretos** — canal onde discutem preço é coordenação entre concorrentes facilitada pela plataforma.

Em vez disso, o que o WhatsApp faz mal: aviso que chega só a quem atende aquela escola, cobertura mútua com repasse de dado (vínculo temporário), e encaminhamento entre motoristas com vínculo de verdade.

---

## 14. Motorista não avalia responsável — em nenhum estágio

**Estado:** aceita · **firme**

**Contexto.** O motorista quer saber quem paga em dia.

**Decisão.** Não existe nota, score ou sinal de adimplência sobre responsável, nem agregado, nem privado entre motoristas.

**Consequência.** Nota de "bom pagador" sobre pessoa física é, no efeito, score de crédito — atividade regulada (Lei 12.414/2011; CDC art. 43). Chamar de estrela não muda o efeito, e o efeito é uma criança sem transporte por causa de uma dívida. O motorista já tem o histórico da **própria** relação em `payments`, privado dele. E o medo real não é o mau pagador: é não conseguir se desligar dele — o que se resolve com contrato de saída clara, cláusula que a `VERSAO_CONTRATO = 2` já tem.

Avaliação do responsável **sobre o motorista** só faz sentido a partir do momento em que a plataforma apresenta alguém (evolução, estágio 4), e mesmo assim estruturada e agregada a partir de um mínimo de respostas — nunca média pública de cinco estrelas.

---

## 15. Preço não aparece na vitrine

**Estado:** aceita (herdada) · **firme**

**Contexto.** Decisão já existente no projeto (`config/vitrine.js`, `CLAUDE.md`), tomada com o CDC na mesa: número solto vira âncora antes de existir proposta. Cadastro self-service com preço publicado parece contrariá-la.

**Decisão.** O preço fica fora da vitrine e aparece **no momento do contrato, dentro do app** — depois de o motorista cadastrar a operação dele e ver funcionando. Self-service preservado, raciocínio original preservado.

**Consequência.** Registrada aqui porque é exatamente o tipo de decisão deliberada que uma "melhoria" plausível apaga sem perceber.

---

## 16. A porta é aberta, e o teto substitui a fila

**Estado:** aceita — em vigor desde 06/09/2026, verificada em `npm run testar:regras`

**Contexto.** Duas dores chegaram como assuntos separados e eram a mesma. Indicar um colega era estranho porque `indicar` significava **mandar alguém para uma porta que não abre**. E a fila cobrava caro por pouco: o motorista se inscrevia, saía com conta criada e caía numa sala de espera com o app desfocado atrás, aguardando uma aprovação negociada fora do sistema. Ele queria entrar e saber que já pode usar; recebeu vidro fosco.

O [canvas do negócio](canvas-negocio.md) nomeava o custo real: *"o canal é escalável e a conversão não é — o consultor fecha um por vez"*. A fila não protegia o produto, protegia a agenda de uma pessoa, e era ela o teto de crescimento.

**Decisão.** O motorista se cadastra e a conta nasce `role: 'admin'`. Não há fila, não há aprovação, e o papel `aguardando` foi removido. Quem controla o acesso é o **teste de três meses**, que começa na primeira rota ([decisão 21](#21-o-relógio-do-teste-começa-na-primeira-rota-e-só-pode-ser-ligado-uma-vez)) e termina em conta inativa. O portão saiu da entrada e foi para o fim do teste, onde custa uma decisão de compra em vez de custar uma espera.

**⚠️ DIVERGÊNCIA DA PROPOSTA ORIGINAL, REGISTRADA DE PROPÓSITO.** A proposta dizia: *"a conta com `role: 'admin'` tem de nascer de Cloud Function; abrir esse ramo nas rules ao cliente reabre a escalada de privilégio"*. **Ela nasce pelas rules, no cliente.** O motivo de a proposta estar certa na época e não hoje:

A escalada que ela temia não vinha de "o cliente cria conta de motorista" — vinha de **create sem whitelist**. O ramo de bootstrap era o único sem lista de campos, e era o terceiro passo de uma escalada real: apagar `appState/init`, apagar o próprio doc, recriar-se com `superAdmin: true`. O ramo de hoje tem `hasOnly` exaustivo, e fora dele ficam `superAdmin`, `childIds`, `limiteCriancas`, `trialInicio`, `assinaturaAte`, `criancasAtivas`, `suspenso` e `termsVersion` — cada ausência é uma fraude que não acontece.

Além disso, a Cloud Function não acrescentaria segurança aqui: o Firebase Auth **já** deixa qualquer pessoa criar login com e-mail e senha, e o documento é o único portão. Fechá-lo numa function protegeria contra criação em massa, não contra escalada.

**O que empurraria isso para uma function:** abuso de volume. No dia em que contas falsas passarem a custar dinheiro (leitura, storage, push), a criação vai para uma callable com App Check e limite por IP. Não antes — function que não acrescenta garantia acrescenta só um lugar a mais para o cadastro quebrar.

**Consequência que vale mais que a decisão.** `isAdmin()` deixou de ser um conjunto escolhido a dedo e virou **"tem uma conta"**. Toda regra que parava num `isAdmin()` solto virou porta pública no mesmo dia — e duas estavam assim: o `allow get` de `users` (nome, e-mail, telefone e chave PIX de toda a base) e a leitura de `taxaConfig`. As duas foram fechadas **antes** de a porta abrir, e é essa a ordem correta de fazer esta mudança.

`VAGAS_NA_RODADA` e o `config/rodada.js` inteiro saíram junto: com cadastro aberto, "restam 2 vagas" é falso, e falso na tela é o que o próprio arquivo chamava de propaganda enganosa (CDC art. 37).

**Como verificar.** O ator `novato` em `scripts/testar-regras.mjs` — motorista legítimo, recém-cadastrado, zero vínculo — precisa ser negado em criança, agenda, recado de escola, mensalidade, régua de preço, doc de outro motorista, doc de responsável alheio, listagem de `users`, despesa e posição ao vivo. Onze casos, e o próprio documento dele passando.

---

## 17. A regra de negócio mora em `src/dominio/`, e não alcança nada

**Estado:** aceita — em vigor desde 31/08/2026, verificada no CI

**Contexto.** A lógica pura vivia em `src/utils/`: 27 módulos num saco plano, com `avatarUrl` ao lado de `taxa` ao lado de `travessia`. Todos já eram puros — nenhum importava Firebase —, então o domínio existia. O que não existia era **endereço**: nada dizia se um módulo novo pertencia a ele, e a resposta para "onde mora esta regra?" era "em algum lugar, procure". Quando a resposta é essa, a regra acaba escrita duas vezes — foi o que aconteceu com o avanço de status da criança (uma escada de `if` em `childrenService`) e a ação da tela (outra escada em `routeStatusService`), duas descrições da mesma coisa.

**Decisão.** O núcleo é `src/dominio/` (uma pasta por contexto), `src/marca/` (a personalidade) e `src/compartilhado/` (sem regra nenhuma). Os três são puros, e a pureza é **verificada**: o lint recusa que eles importem service, hook, componente, tela, Firebase ou React — e recusa que `compartilhado/` importe o domínio.

Regra nova nasce no contexto de quem decide sobre ela. Se ela precisa de dado do banco, quem busca é o service e **passa por parâmetro**.

**Consequência.**

1. **Regra atrás de `import { db }` deixa de ser possível**, e essa é a razão inteira. Não é organização: um módulo que importa Firebase não carrega no Node, e os testes deste projeto são Node puro rodando o arquivo direto. Regra impura é regra sem teste — foi assim que a máquina de estado da criança e o teto de vagas ficaram sem verificação nenhuma.
2. **Os dois dinheiros ficam em pastas diferentes** (`cobranca` é pai→motorista, `associacao` é motorista→plataforma). Misturá-los quebra o item 7 dos Termos, e agora a mistura aparece como um import cruzando contexto — antes só apareceria depois de escrita.
3. **`comunicacao` não tem pasta, e isso é o achado.** Não sobrou módulo puro para ela: o fan-out de notificação está dentro dos services, rodando no navegador. A ausência da pasta é o sintoma visível de um contexto mal posicionado.
4. **Não houve monorepo, e não vai haver.** O plano original pedia `packages/core` + `packages/sdk`; o que ele comprava era esta fronteira, e ela se compra com uma regra de lint. Ver [arquitetura.md](arquitetura.md), seção 4.

**Como verificar.** `npm run lint` — plante `import { db } from '../../services/childrenService'` em qualquer arquivo de `src/dominio/` e o CI reprova com a mensagem que diz o que fazer no lugar. O mesmo para um import de domínio dentro de `src/compartilhado/`. As duas direções foram plantadas e removidas na entrega desta decisão.

---

## 18. A unidade de cobrança é a criança ativa, e o app é completo em qualquer tamanho

**Estado:** aceita — desde 04/09/2026 · valor ainda pendente

**Contexto.** O produto foi construído antes do modelo de negócio, e a taxa era um número digitado caso a caso no orçamento. Sem unidade declarada, cada negociação inventava a própria régua — e nada no código dizia qual era a certa. Enquanto isso, `users.limiteCriancas` e `users.criancasAtivas` já existiam, já eram cobrados pelas rules via `getAfter`, e `fecharFatura` já contava as crianças reais: a unidade estava implementada e sem nome.

**Decisão.** O preço é **proporcional ao número de crianças ativas**. Não existe plano Básico, Pro ou Premium — todo motorista tem o app inteiro, e paga pelo tamanho da operação. Descartados: preço fixo único (perde o pequeno e subcobra o grande), planos por funcionalidade (obrigam o cliente a adivinhar do que precisa e criam duas versões do produto para manter) e percentual da mensalidade (quebra a decisão 19 e o item 7 dos Termos).

**Consequência.** A sazonalidade se resolve sem código: em janeiro o motorista desativa quem parou e a fatura cai sozinha, porque `criancasAtivas` já conta só o ativo — e é exatamente no mês em que ele não fatura que um autônomo cancela software. A expansão de receita também deixa de exigir venda nova. Em troca, **o preço passa a ser derivado e não digitado**: `taxaConfig` precisa carregar a régua, e o orçamento deixa de ser o lugar onde o valor nasce.

O raciocínio completo, com as alternativas e a faixa de referência, está em [negocio.md](negocio.md), seção 4.

**Como verificar.** Teste de que a fatura fechada para um parceiro com N crianças ativas bate com a régua de `taxaConfig` para N — e que desativar uma criança antes do fechamento muda o valor. Enquanto o preço não estiver definido, o teste existe com a régua de exemplo.

---

## 19. A plataforma nunca retém a mensalidade — split, nunca escrow

**Estado:** aceita · **firme**

**Contexto.** A dor mais forte relatada pelo cliente é cobrar a família todo mês: *"tem tio que quer receber a mensalidade dos pais pra não precisar ficar cobrando o pai toda vez."* O alvo declarado é pagamento recorrente por cartão. O caminho óbvio — a plataforma recebe e repassa — torna falsa a frase que está publicada hoje na home e no item 7 dos Termos: *"a plataforma não entra no caminho desse dinheiro e não fica com percentual nenhum dele."*

**Decisão.** Quando houver cartão recorrente, ele será feito por **split em PSP já regulado**: o dinheiro cai direto na subconta do motorista e a plataforma orquestra a cobrança sem nunca reter. **Escrow está recusado.** Enquanto o split não existir, o app continua apenas gerando o PIX e registrando o recebimento — e a comunicação diz isso com essas palavras, em vez de prometer data.

**Consequência.** A frase pública continua verdadeira sem ajuste, o item 7 dos Termos continua de pé, e nenhum valor da marca precisa ser reescrito — foi esse o critério da escolha, não a conveniência técnica. Evita também reter recurso de terceiro, que empurraria a operação para terreno de arranjo de pagamento sem necessidade. Em contrapartida, a plataforma fica dependente da política do PSP para abrir subconta de pessoa física ou MEI: se o motorista não conseguir cumprir o cadastro, o recurso não chega a ele — e isso precisa ser testado com um motorista real antes de virar promessa.

Subir a `VERSAO_CONTRATO` faz parte da entrega, não é etapa posterior.

**Como verificar.** Teste de que nenhum caso de uso credita valor de `payments` em conta da plataforma. Quando o PSP entrar: teste de que o `split` nomeia a subconta do motorista como destino do valor da mensalidade, e a da plataforma apenas da taxa.

---

## 20. A conta nasce sem papel — a porta não adivinha quem chegou

**Estado:** aceita — em vigor desde 06/09/2026

**Contexto.** O login com Google criava um usuário no Firebase Auth antes de qualquer verificação nossa, e o app apagava a conta órfã na hora. Isso valia enquanto a única entrada legítima era JÁ TER conta. Deixou de valer quando o Google virou também o caminho de quem chega — e a saída óbvia, criar a conta como motorista, tem um custo concreto: a mãe que recebe o convite no WhatsApp, ignora o link e toca em "Entrar com Google" viraria motorista. Ao abrir o convite depois, o `redeemInvite` recusaria (ele já barra conta de motorista virando responsável) e ela ficaria presa: e-mail queimado, convite morto, nenhuma saída dentro do app.

**Decisão.** A conta nasce **sem papel**, e a sala de espera (`/comecar`) pergunta **por onde a pessoa chegou** — não o que ela é. Nada é gravado antes da escolha, então nenhuma escolha errada é possível. Quem chega pelo link nunca vê essa tela: o código está na URL e a frente já é conhecida.

Perguntar "você é motorista ou responsável?" está recusado, e por três motivos: a pessoa não sabe responder na língua do sistema (ela pensa *"sou mãe do Pedro"*), quem é as duas coisas é obrigado a mentir, e o que separa os casos não é quem ela é — é o que ela tem na mão.

**Consequência.** O app parou de apagar a conta órfã, então sobra um registro de autenticação vazio por visitante que desistiu. Isso é aceitável porque a conta pendurada é **inerte**: toda leitura passa por `isAppUser()` nas rules, que exige o documento de `users`. Em troca, o `PrivateRoute` não pode mais devolver um loader quando há sessão sem perfil — seria tela travada para todo mundo que entra pela primeira vez.

**Como verificar.** `npm run testar:auth`, bloco 7: `painelDe` devolve `/comecar` para perfil ausente, vazio e com papel desconhecido. E os cinco papéis conhecidos continuam indo para os painéis deles.

---

## 21. O relógio do teste começa na primeira rota, e só pode ser ligado uma vez

**Estado:** aceita — em vigor desde 06/09/2026

**Contexto.** Não existia campo de trial em lugar nenhum: "três meses grátis" era frase de conversa comercial que o app não sabia contar. Contar do cadastro parece o óbvio e erra com o público real — motorista escolar tem calendário. Quem conhece o app em dezembro, entra em férias e volta a operar em fevereiro chegaria em fevereiro com três semanas, e a primeira experiência real dele com o produto seria a tela de cobrança.

**Decisão.** `users.trialInicio` é gravado no instante em que ele **inicia a primeira rota** — o momento em que o produto começa a entregar. Só o início é guardado; o fim, os dias restantes e o aviso do momento são conta pura em `dominio/associacao/trial.js`.

E o campo é **gravável uma vez e nunca alterável**, com a trava nas rules e não no cliente. Livre, o motorista roda uma rota, o campo grava, e três meses depois grava de novo e ganha mais três — seria `limiteCriancas` com outro nome, o devedor editando a própria cláusula.

**Consequência.** Quem cadastra criança e cobra mensalidade sem nunca iniciar rota usa de graça. É pouco (sem rota o app é meia agenda), e o contrário — cobrar de quem não recebeu nada — é pior. A escrita não é esperada pelo app: o GPS liga no meio-fio, às vezes sem sinal, e a rota não pode aguardar. Falhou, a próxima tenta; o pior caso é um dia a mais de teste.

**São três avisos, em FAIXAS e não em datas.** Cinco avisos (20, 15, 7, 5 e 3 dias) está recusado pela mesma lição de `dominio/rota/avisoDoMomento.js`: tarja semanal ensina a pular tarja, e o quinto aviso — o mais importante — seria o menos lido. Faixa também alcança quem não abriu o app no dia exato.

**Como verificar.** `npm run testar:trial` (28 casos, com a hora injetada). E `npm run testar:regras`, três casos: ele liga o próprio relógio, não consegue ligar de novo, e não encosta no do colega.

---

## 22. Só o fundador chega a zero, e o desconto nunca vira crédito

**Estado:** aceita — em vigor desde 06/09/2026

**Contexto.** O preço da associação era digitado à mão no orçamento, caso a caso pelo dono. Funciona com um parceiro e não funciona com autoatendimento, onde ninguém digita nada às 23h de um domingo. E com dois programas de desconto somando — condição de fundador e indicação —, soma sem teto vira fatura negativa.

**Decisão.** O preço sai de uma **faixa por número de crianças ativas** (`dominio/associacao/planos.js`), separada do modelo negociado que continua em `taxa.js` — os dois não podem valer para o mesmo parceiro, porque somá-los cobra duas vezes.

Sobre ela incidem dois descontos: **fundador** (o 1º motorista vitalício, os 12 seguintes com 50%) e **indicação** (10% por indicação ativa, teto de 50%, 12 meses, contando só a partir do 1º mês PAGO do indicado). O total é **cortado em 100%**.

O desenho está nesse corte: fundador de metade mais cinco indicações fecha exatamente em zero; quem não é fundador para em 50% pelo teto. **Gratuidade só existe para fundador, e só trazendo cinco clientes pagantes.**

**Consequência.** Sem o corte, seis indicações sobre um fundador de metade dariam 110% — dinheiro saindo da plataforma para quem devia estar pagando. Acima de 40 crianças o preço é `null` e nenhum desconto é aplicado: 50% sobre um preço inexistente produziria R$ 0, indistinguível de "não paga", e é exatamente o caso que precisa de conversa.

**O plano capa QUANTIDADE, nunca funcionalidade** — o app é completo em qualquer faixa, e o que muda é `users.limiteCriancas`. Escolher plano menor que o uso é permitido, e **quem aponta as crianças que saem é o motorista**: corte automático apagaria clientes que ele não escolheu perder.

**Como verificar.** `npm run testar:planos` (44 casos). Os quatro que travam a economia: vitalício não paga nunca; metade mais cinco fecha em zero; quem não é fundador para em 50% mesmo com vinte indicações; e o desconto somado passa de 100% e é cortado em 100%.

---

## Como adicionar uma decisão

Copie o formato. Contexto em duas linhas, decisão em uma, consequência no que ela custa, e **sempre** a linha de como verificar. Decisão sem teste é comentário — e comentário que promete garantia sem prová-la já foi problema recorrente neste repositório.
