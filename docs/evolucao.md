# Evolução do produto

Quatro estágios, cada um com **gatilho medível em vez de data**. O motor de crescimento não é o pai escolhendo motorista — é o motorista trazendo outro motorista, e a escola trazendo vários de uma vez. A descoberta vem por último, e talvez venha menos necessária do que parece.

O ponto deste documento é a última seção: **o que modelar agora para não refazer nada**.

---

## Estágio 1 — Ferramenta `hoje`

**Gatilho:** nenhum, é onde você está.

O motorista traz as famílias que já transporta. O convite é a porta, e **a plataforma não apresenta ninguém a ninguém** — é essa frase que sustenta cadastro aberto e verificação como selo em vez de portão ([decisão 6](decisoes.md#6-verificação-é-selo--nunca-bloqueia-operar)).

**Crescimento:** motorista indicando motorista (eles fazem fila no mesmo portão todo dia — rede densa, de alta confiança, custo zero) e pai convidando o motorista dele.

**A métrica que decide se existe produto:** **famílias ativas por motorista**. Se ele migra 20 de 25, funciona e todo estágio adiante acelera. Se migra 5, nenhum estágio adiante salva. É a pergunta do piloto.

---

## Estágio 2 — Comunidade da escola

**Gatilho:** dois motoristas atendendo a mesma escola.

Motorista de perua vive em comunidade: concorrem pela criança, mas combinam rota, portão e aviso. Isso já acontece — no WhatsApp. A plataforma deve fazer o que o WhatsApp faz mal:

- **Aviso único da escola.** Hoje cada motorista registra a própria versão de "amanhã não tem aula", e elas divergem. Um aviso, ligado à escola, chegando a quem atende aquele portão.
- **Cobertura mútua.** A van quebra e outro motorista cobre as crianças por um dia. Acontece de verdade, e o WhatsApp não resolve porque falta o repasse de dado. Arquiteturalmente é um **vínculo temporário com `ativoAte`** — acesso que se fecha sozinho.
- **Encaminhamento entre motoristas.** *"Não tenho vaga, mas o Zé atende essa escola."*

> **O encaminhamento é a descoberta, resolvida antes.** Quando um motorista encaminha uma família para outro, **quem avaliza é um humano que conhece o outro** — não a plataforma. Isso entrega boa parte do valor do estágio 4 sem nenhuma das consequências dele.

**Não construir chat.** Ver [decisão 13](decisoes.md#13-não-construir-chat-de-comunidade-dentro-do-app).

---

## Estágio 3 — A escola entra `maior alavanca`

**Gatilho:** uma escola pedir, ou você ter três motoristas no mesmo portão.

A escola ganha conta e publica os próprios avisos: sem aula, reunião, mudança de horário, saída antecipada. Quarto papel no sistema. Três razões independentes:

- **É o dado de maior consequência do sistema inteiro.** "Não tem aula" errado é van indo a escola vazia — ou criança esperando sozinha. Hoje a informação viaja de pai para motorista por WhatsApp, degradando a cada repasse.
- **Inverte a aquisição.** Uma escola com seis vans que adota puxa seis motoristas de uma vez. E "a Escola X usa" vale mais para um motorista do que qualquer peça de marketing.
- **É barato de verificar.** Instituição tem CNPJ e domínio de e-mail próprio.

**Dois cuidados desde o primeiro dia:**

- **Caminho de retratação.** Uma conta de escola comprometida — ou um engano — transmite para muitos motoristas de uma vez. Aviso precisa de autoria visível e de "cancelado pela escola às 19h", senão a correção vira outro WhatsApp.
- **A escola não vê quem vai em qual van.** Ela tem os próprios alunos e não precisa da lista do transporte — seria um fluxo de dado que o responsável não consentiu para essa finalidade.

**Modelo:** a tenancy passa a ter duas raízes de escopo — `operacoes/{id}` e `escolas/{id}`.

> **A cunha: é a mesma feature pelos dois lados.** Se o aviso pertencer à **escola compartilhada** e não à operação do motorista, no estágio 2 quem publica é o motorista e no 3 é a própria escola. Mesma coleção, autor diferente, permissão por tipo de vínculo — **nenhuma rearquitetura entre um e outro**. Isso já existe em embrião: `schoolBroadcasts` está no código, só que carimbado com `adminUid`.

---

## Estágio 4 — Descoberta por escola `só com densidade`

**Gatilho:** três ou mais motoristas verificados na mesma escola.

O pai escolhe a escola, vê quem atende, solicita. O motorista aceita ou recusa — e a recusa não vira beco: o pedido fica como demanda registrada naquela escola.

Escola é o eixo certo, e melhor que região: é o ponto de convergência de toda rota, é o único fato que o pai declara com certeza absoluta, e o conjunto é pequeno. **Abaixo do gatilho, descoberta entrega tela vazia e recusa** — e queima a confiança de que você vai precisar depois.

**Aqui a responsabilidade muda de patamar.** A partir do momento em que a plataforma **apresenta**, ela provavelmente entra na cadeia de fornecimento de uma atividade regulada. Transporte escolar exige veículo registrado para o fim, vistoria anual e identificação; condutor com 21+, CNH categoria D, curso especializado e sem infração grave nos últimos 12 meses — mais alvará municipal em boa parte das cidades. No estágio 1 isso é conformidade do motorista; apresentando, provavelmente não é mais só dele.

Três pré-requisitos: conformidade **conferida, não declarada**; parecer jurídico antes da primeira linha de código; e apresentação neutra — fatos, nunca ranking ou destaque que leia como recomendação.

> **O portão vai na descoberta, nunca na operação.** Mesmo aqui, o motorista que traz as próprias famílias continua entrando e operando no minuto zero. A verificação só decide quem aparece na lista pública. Um portão, dois caminhos — e o caminho que gera boca a boca nunca é o que trava.

---

## O que modelar agora para não refazer nada

Com estes cinco itens no formato certo, os estágios 2, 3 e 4 viram trabalho de produto — sem migração, sem mudar formato de dado. Quatro já estão no plano de arquitetura.

| Item | Como está | Serve a | |
|---|---|---|---|
| **Escola como entidade compartilhada** | `schools` é **por motorista** — a mesma escola existe N vezes, com o nome digitado de N jeitos | Estágios 2, 3 e 4 inteiros | **falta** |
| **Vínculo com estado pendente e expiração** | Convite ou vincula ou falha | Solicitação é vínculo pendente; cobertura mútua é vínculo que expira | no plano |
| **Projeção pública do motorista** | Cadastro inteiro num doc só; rules não filtram campo | É o que a lista do estágio 4 lê, sem expor o resto | no plano |
| **Verificação como estado, não booleano** | Aprovado ou aguardando | Selo no estágio 1, portão de listagem no 4 — mesmo campo, política por bandeira | no plano |
| **Escola e horário no pedido** | Existem, mas presos ao aluno já vinculado | São a chave de casamento; um pedido sem vínculo precisa carregá-los | no plano |

> **O único a fazer agora, sem esperar gatilho: escola como entidade compartilhada.** Ela se justifica sozinha no produto de hoje — aviso coerente entre motoristas do mesmo portão e nome de escola que não varia por quem digitou. Pela mesma razão de tudo o mais: não há dado para migrar, então hoje ela custa escrever o nome certo.

---

## O que decidimos não construir

Registrado porque é o tipo de decisão que volta à mesa a cada seis meses.

| | Por quê | Em vez disso |
|---|---|---|
| **Chat de comunidade** | (1) Motoristas conversando sobre "tipo de pai" é cadastro negativo informal sobre pessoas físicas, hospedado por você. (2) Motoristas da mesma escola são **concorrentes diretos** — canal onde discutem preço é coordenação entre concorrentes facilitada pela plataforma. | Funcionalidade estruturada: aviso que chega a quem precisa, cobertura com repasse de dado, encaminhamento com vínculo de verdade. |
| **Motorista avaliando responsável** | Nota de "bom pagador" sobre pessoa física é, no efeito, score de crédito — atividade regulada. E o efeito é uma criança sem transporte por causa de uma dívida. | O motorista já tem o histórico da própria relação em `payments`. O medo real é não conseguir se desligar — resolve-se com contrato de saída clara. |
| **Responsável avaliando motorista (antes do estágio 4)** | Antes de a plataforma apresentar alguém, não resolve problema nenhum e cria um: com poucas respostas, um pai irritado derruba um sustento. | Quando entrar, estruturada e agregada a partir de um mínimo de respostas — nunca média pública de cinco estrelas. |
| **Descoberta por região** | A van tem itinerário fixo. Um pai a 2 km pode ser inservível e um a 8 km pode caber. Busca por região produz majoritariamente recusa. | Escola como eixo, sempre. É a restrição real e o único fato que o pai declara com certeza. |
