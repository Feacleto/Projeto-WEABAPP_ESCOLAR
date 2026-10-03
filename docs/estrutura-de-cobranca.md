# A estrutura de cobrança da plataforma

**Escrito em 02/10/2026.** Explica tudo o que já foi construído para a
plataforma cobrar o **motorista** pelo uso do app, e a chave que pausa essa
cobrança enquanto o foco é acostumar o usuário com o app.

> **Hoje (02/10/2026) a cobrança está DESLIGADA por padrão, em módulos.** A
> base (Plano padrão) liga em painel admin → Manutenção → "Habilitar a
> cobrança"; cada desconto (escada, indicação) liga no próprio interruptor.
> Ver a seção 6.

> **Não confundir com a mensalidade das famílias.** A mensalidade que a família
> paga ao motorista (o PIX dele, `payments`, `functions/lib/billing.js`) é outra
> coisa: é a ferramenta que o motorista usa no dia a dia, e ela fica ligada.
> Este documento trata só do que o **motorista paga à plataforma**.

Preços, valores e regras de desconto detalhados estão em
[descontos.md](descontos.md) e [negocio.md](negocio.md). Aqui está a estrutura:
quais peças existem, em que ordem elas entram na vida do motorista e onde cada
uma mora no código.

---

## 1. Resumo em uma tela

| Peça | O que faz | Onde mora |
|---|---|---|
| **Teste (trial)** | 90 dias grátis, contados do **primeiro uso** (não do cadastro) | `src/dominio/associacao/trial.js`, `functions/lib/relogioDoTeste.js` |
| **Planos e preço** | Taxa por criança ativa, plano mensal ou anual | `src/dominio/associacao/planos.js` |
| **Fatura mensal** | Todo dia 1º o servidor fecha a fatura de cada motorista | `functions/lib/fechamento.js` |
| **Pagamento** | Cobrança gerada no Asaas e confirmada por webhook | `functions/lib/asaasCobranca.js`, `asaasWebhook.js` |
| **Contratação** | O motorista escolhe o plano e aceita o contrato da plataforma | `functions/lib/contratacao.js`, `/tio/planos`, `/tio/contrato-plataforma` |
| **Escada de desconto** | Quem fecha cedo no teste ganha desconto para sempre | `src/dominio/associacao/ofertaDaPrimeiraRota.js`, [descontos.md](descontos.md) |
| **Indicação** | Cada colega indicado que paga dá desconto | `planos.js` (`DESCONTO_POR_INDICACAO`), `/tio/indicar` |
| **Isenção e concessão** | O dono isenta um motorista por até 12 meses, com motivo | `src/dominio/associacao/concessao.js`, `isencaoDaFatura.js` |
| **Multa e encerramento** | Saída do plano anual antes do prazo tem multa | `src/dominio/associacao/multa.js`, `/tio/encerrar` |
| **Avisos de venda** | Pushes que lembram do teste, do desconto e da fatura | `functions/lib/avisosComerciais.js`, `enviarAvisos.js`, `enviarAvisosDoDia.js` |
| **Bloqueio** | Teste vencido sem plano = o motorista perde o acesso | `firestore.rules` (`isAdmin()`), `GuardaDaConta.jsx`, `ContaInativa.jsx` |

---

## 2. A vida de um motorista, do cadastro ao pagamento

1. **Cadastro.** Ele cria a conta. **Nada é cobrado e o relógio ainda não anda.**
2. **Primeiro uso → o teste começa.** O relógio liga no primeiro destes três
   gestos, o que vier antes:
   - ele dá partida na rota (GPS), em `src/hooks/useGeolocation.js` →
     `trialService.ligarRelogioDoTrial`;
   - uma família resgata o convite dele, em `functions/lib/invites.js`;
   - a primeira mensalidade de uma família é gerada, em `functions/lib/billing.js`.

   O campo gravado é `users.trialInicio`. Ele é **gravável uma vez e nunca
   alterável**, nem pelo dono: as `firestore.rules` travam isso, para ninguém
   reiniciar o próprio teste.
3. **Primeira rota → a oferta.** Ao rodar a primeira rota, o app abre a oferta
   de fechar o plano com desconto (`ControleDeRota.jsx` → `ofertaEstado:
   'pendente'` → `OfertaDoFechamento`).
4. **Durante o teste (dias 1 a 90).**
   - O topo do painel mostra a contagem do teste (`AvisoDoTrial`).
   - A **escada de desconto** desce a cada 30 dias: quem fecha no 1º mês ganha
     mais do que quem fecha no 3º. O desconto é vitalício. Detalhes em
     [descontos.md](descontos.md).
   - Todo dia 1º sai uma fatura **isenta** (R$ 0), só para ele conhecer o valor
     antes de valer.
   - Os pushes de venda (`comercial_teste_comecou`, `comercial_degrau_vira`) saem
     às 10h.
5. **Fim do teste (dia 91).**
   - **Com plano contratado:** a fatura do dia 1º passa a ser cobrada (Asaas);
     o webhook confirma o pagamento e renova `assinaturaAte`.
   - **Sem plano:** a conta fica inativa. A tela `ContaInativa` substitui o
     painel, e as regras do Firestore recusam as gravações dele. Há 30 dias de
     "retorno" com push `comercial_retorno`.
6. **Atraso.** Fatura vencida → push `fatura_vence` (9h) → card de fatura em
   aberto no painel (`AvisoDaPlataforma`) → pode virar conta suspensa.
7. **Saída.** No plano anual, sair antes dos 12 meses tem multa (`multa.js`,
   tela `/tio/encerrar`).

---

## 3. Quanto custa (resumo do `planos.js`)

| | Mensal | Anual |
|---|---|---|
| Taxa por criança ativa | R$ 5,90 | R$ 2,90 |
| Acima de 40 crianças | R$ 4,90 | R$ 2,40 |
| Mínimo por mês | R$ 49 | R$ 29 |
| Prazo | sem prazo, sem multa | 12 meses |

Indicação: 5% de desconto por colega indicado que paga. Os demais descontos
estão em [descontos.md](descontos.md).

---

## 3b. Comparação com concorrentes

> **Pesquisado em 02/10/2026, nos sites públicos.** Preço de concorrente muda
> sem aviso: confirme antes de usar num argumento de venda. As linhas marcadas
> "não confirmado" apareceram só em resumo de busca, e o site oficial não mostrou
> o valor.

### Como cada um cobra o motorista

| App | Modelo | Preço | Teste grátis | Fonte |
|---|---|---|---|---|
| **Alô Buzinou** | Por criança ativa | Mensal R$ 5,90 (mín. R$ 49) · Anual R$ 2,90 (mín. R$ 29) | **até 90 dias**, contados do 1º uso | `planos.js`, `trial.js` |
| **Via Van** | Por aluno | Mensal R$ 7,90 · Anual R$ 3,90 | 14 dias | [viavan.com.br](https://viavan.com.br/); preço: [Garagem360, fev/2024](https://garagem360.com.br/uber-de-van-escolar-entenda-o-novo-servico-que-promete-facilitar-a-vida-dos-pais/) |
| **Rotasegura** | Por aluno, pós-pago | A partir de R$ 8, sem mínimo | não tem ("sem trial, sem adesão") | [rotasegura.app](https://rotasegura.app/) |
| **Van Inteligente** | Assinatura + extras | Grátis (1 veículo, básico) · Premium R$ 29,90/mês · cobrança automática R$ 4 por passageiro/mês · contrato digital R$ 12 por contrato/ano | plano grátis permanente | [vaninteligente.com.br](https://vaninteligente.com.br/) |
| TransEscolar | Faixa de alunos | R$ 59 (até 30) · R$ 129 (até 100) · R$ 249 (ilimitado) — **não confirmado** | ? | [transescolar.com.br](https://www.transescolar.com.br/) |
| Mapix | Assinatura | R$ 59,90/mês — **não confirmado** | ? | [mapixapp.com](https://mapixapp.com/) |
| VanApp | ? | não publicado | 14 dias (resumo de busca) | [vanapp.com.br](https://www.vanapp.com.br/) |
| SchoolVan | ? | não publicado | ? | [schoolvan.com.br](https://schoolvan.com.br/) |

### Quanto o motorista pagaria por mês

Preço de tabela, sem descontos. Van Inteligente = Premium + cobrança automática,
que é o pacote mais parecido com o nosso (não inclui os contratos, cobrados à parte).

| Crianças | Alô Buzinou mensal | Alô Buzinou anual | Via Van mensal | Via Van anual | Rotasegura | Van Inteligente |
|---|---|---|---|---|---|---|
| 10 | **R$ 59** | **R$ 29** | R$ 79 | R$ 39 | R$ 80 | R$ 69,90 |
| 20 | **R$ 118** | **R$ 58** | R$ 158 | R$ 78 | R$ 160 | R$ 109,90 |
| 30 | **R$ 177** | **R$ 87** | R$ 237 | R$ 117 | R$ 240 | R$ 149,90 |

### O que a tabela mostra

- **Contra quem cobra por aluno (Via Van, Rotasegura), o Alô Buzinou é ~25%
  mais barato** nos dois planos, em qualquer tamanho de turma.
- **A Van Inteligente fica mais barata que o nosso mensal a partir de 16
  crianças** (R$ 29,90 + R$ 4 por criança contra R$ 5,90 por criança), porque a
  parte fixa pesa menos numa turma grande. No anual o Alô
  Buzinou continua abaixo em todos os tamanhos.
- **A Van Inteligente tem plano grátis permanente.** É o concorrente direto da
  fase atual: enquanto a cobrança estiver pausada, o Alô Buzinou também é grátis
  e mais completo (mapa ao vivo, aviso de chegada, falta avisada pela família).
- **Nosso teste é o mais longo** que encontramos: até 90 dias contra 14 da Via
  Van e nenhum da Rotasegura. E ele começa no primeiro uso, não no cadastro.
- **O argumento que a tabela não mostra:** a mensalidade da família vai direto
  pro PIX do motorista, sem percentual da plataforma. Nenhum site acima deixa
  claro se cobra taxa sobre o pagamento dos pais (a Van Inteligente cobra R$ 4
  por passageiro pela cobrança automática). Antes de dizer "os outros cobram
  percentual", confirme caso a caso.

---

## 4. O que roda sozinho no servidor

Todas exportadas em `functions/index.js`. Horários de São Paulo.

| Função | Quando | O que faz |
|---|---|---|
| `fecharMesDosParceiros` | dia 1º, 05:00 | Fecha a fatura de todos os motoristas (isenta no teste, cobrada depois) |
| `enviarAvisosComerciais` | todo dia, 10:00 | Pushes de venda: teste começou, desconto vai cair, retorno |
| `enviarAvisosDoDia` | todo dia, 09:00 | Inclui `varrerFaturas` (fatura vencendo) e `varrerEncerramentos`. **As outras varreduras desta função não são cobrança** (mensalidades das famílias, convites, alvarás) |
| `varrerOfertas` | a cada 10 min, 6h–19h | Segundo push da oferta da primeira rota |
| `asaasWebhook` | quando o Asaas chama | Confirma pagamento |
| `fecharMesAgora`, `criarCobrancaDaFatura`, `contratarPlano` | sob demanda | Fechamento manual (dono), gerar cobrança (dono), contratar plano (motorista) |

---

## 5. O que o motorista vê no app

- **No topo do painel** (`src/components/layout/TioLayout.jsx`):
  - `AvisoDoTrial`: a contagem do teste;
  - `AvisoDaPlataforma`: fatura em aberto ou vencida;
  - `AvisoDoEncerramento`;
  - a folha `OfertaDoFechamento`.
- **Telas:**
  - `/tio/planos` e `/tio/taxa` ("Minha associação");
  - `/tio/contrato-plataforma`;
  - `/tio/encerrar`;
  - `/tio/indicar`.
- **Atalhos para essas telas:**
  - menu do perfil: "Minha associação";
  - folha "Meu transporte": "Planos e valores", "Contrato da plataforma";
  - notificações `comercial_*`;
  - o convite de indicação (`ConviteParaIndicar`) dentro das telas de plano.
- **Bloqueio:** `GuardaDaConta` + `ContaInativa` ("Ver planos" / "Pagar agora").

---

## 6. A chave da cobrança e os módulos

**Implementada em 02/10/2026.** Antes dela não havia como pausar a cobrança: a
isenção (`users.isencaoAte`) é por motorista, dura no máximo 12 meses e continua
gerando fatura.

### Como funciona: uma base e módulos

A cobrança é feita de **módulos**, cada um com o seu interruptor no **painel
admin → Manutenção → "Cobrança da plataforma"**. **Todos nascem desligados, e
cada um liga sozinho.**

| Módulo | O que é | Onde fica gravado | Como liga |
|---|---|---|---|
| **Plano padrão** (a base) | Teste de 90 dias, plano mensal/anual por criança, fatura do dia 1º, bloqueio de quem não paga | `platformConfig/app.cobrancaLigada` | Botão **"Habilitar a cobrança"** (pede confirmação) |
| **Escada de desconto** | 30% / 20% / 10% para quem contrata durante o teste | `platformConfig/app.modulos.escada` | Interruptor próprio |
| **Desconto por indicação** | Desconto por motorista indicado que paga | `platformConfig/app.modulos.indicacao` | Interruptor próprio |

Três regras:

1. **Ausente é desligado**, na base e em cada módulo. Depois do deploy, sem
   ninguém apertar nada, o app não cobra nem desconta.
2. **"Habilitar a cobrança" liga só a base.** Escada e indicação continuam
   desligadas até você ligar cada uma.
3. **Os descontos dependem da base.** Eles descontam a fatura do plano, e sem
   plano não há fatura. Você pode ligar a indicação com a base desligada: o
   interruptor fica ligado, o painel mostra "só vale com o Plano padrão ligado",
   e ela passa a valer no dia em que a base ligar.

> **O campo antigo `janelaEscada` não manda mais.** A escada morava nele
> (ausente = aberta). Desde 02/10/2026 ela é o módulo `modulos.escada`
> (ausente = desligada), e nem a tela nem o servidor leem o campo antigo.

### Período: o caminho para módulos sazonais

O valor de um módulo pode ser só ligado/desligado, ou um **período**:
`{ ativo: true, de: '2027-01-15', ate: '2027-02-15' }`. Com período, o módulo só
vale dentro dele (as datas são do calendário de São Paulo), sem ninguém precisar
lembrar de desligar. O painel mostra o período quando ele existe.

**Para criar um módulo novo** (ex.: um desconto de volta às aulas):

1. Acrescentar o módulo em `MODULOS_DE_COBRANCA`
   (`src/dominio/associacao/modulosDeCobranca.js`), com `id`, `nome`, `descricao`
   e os `tiposDeAviso` que ele dispara. O painel admin desenha o interruptor
   sozinho.
2. Acrescentar o mesmo `id` em `MODULOS` de `functions/lib/reguaDaCobranca.js`
   (o espelho do servidor). O `npm run testar:modulos` falha se esquecer.
3. Nas telas, perguntar `useModuloDeCobranca(id)`. Nas functions,
   `moduloAtivo(db, id)`.

### Onde a regra está escrita

| Lado | Arquivo |
|---|---|
| App (cliente) | `src/dominio/associacao/modulosDeCobranca.js` e `cobrancaLigada.js`, e os hooks em `src/hooks/useCobrancaLigada.js` |
| Servidor | `functions/lib/reguaDaCobranca.js` (a regra pura) e `cobrancaLigada.js` (lê o banco; falha de leitura conta como desligada) |
| Regras do Firestore | `cobrancaDesligada()` em `firestore.rules`: só a base importa ali |
| Teste | `npm run testar:modulos` confere que cliente e servidor respondem igual |

### O que cada módulo desligado faz

**Base desligada (o estado de hoje): nada conta para cobrança nem para desconto.**

| Parte | Com a base desligada |
|---|---|
| **Bloqueio (regras)** | `isAdmin()` aceita quem está com o teste vencido. **É a parte mais importante**: sem ela, no dia 91 o app pararia de gravar para o motorista |
| **Relógio do teste** | `trialInicio` não é gravado em nenhum dos 3 gatilhos (rota, convite resgatado, primeira mensalidade). O teste de 90 dias só começa quando a base for ligada |
| **Servidor** | `fecharMes` não fecha fatura; `varrerFaturas` e `varrerEncerramentos` não mandam nada; `contratarPlano` e `criarCobrancaDaFatura` recusam |
| **Painel do motorista** | Somem a contagem do teste, o cartão de fatura e o aviso de encerramento. O aviso de **suspensão manual** continua |
| **Bloqueio no app** | `GuardaDaConta` só tranca por suspensão manual |
| **Menus e telas** | Somem "Minha associação", "Planos e valores" e "Contrato da plataforma". `/tio/planos`, `/tio/taxa`, `/tio/contrato-plataforma` e `/tio/encerrar` voltam para `/tio` |
| **Imagem do convite** | A peça `convite.jpg` (diz "até 3 meses de teste grátis" dentro da arte) não aparece nem vai junto no WhatsApp da família |
| **Preferências de aviso** | A frase da chave "Novidades e condições" deixa de falar em teste e desconto |

**Escada desligada:** sem oferta da primeira rota (folha e push), sem
porcentagem no aviso do teste, `contratarPlano` não concede o desconto, e o push
`comercial_degrau_vira` não sai. Quem já ganhou o desconto mantém: ele é
vitalício e está no contrato.

**Indicação desligada:** some "Indicar outro motorista", o convite de indicação
e a tela `/tio/indicar`. O push `comercial_indicacao` e o aviso "sua indicação
criou a conta" não saem. **O vínculo "quem indicou quem" continua sendo
gravado** quando o indicado se cadastra. Ele não desconta nada sozinho, e pular
o vínculo perderia para sempre quem foi indicado durante a pausa.

**O sino de notificações:** avisos antigos de cobrança ("seu teste começou",
"sua fatura vence", "seu desconto cai em…") somem do sino e do contador
enquanto o módulo deles estiver desligado, e voltam quando ligar. Nada é
apagado.

**O que fica sempre ligado:** a mensalidade das famílias, o PIX do motorista, os
lembretes de pagamento para as famílias e a suspensão manual pelo dono.

**O site** (`landing/`) é HTML estático e não lê a chave. A home diz "em fase de
teste: por enquanto, é grátis". Ao ligar a cobrança, os textos do site precisam
mudar à mão (ver "Para religar depois").

**Testes:** `testar-regras.mjs` liga a base para medir a tranca e confere que,
desligada, o motorista com teste vencido continua gravando. `testar-modulos.mjs`
trava as três regras acima e o espelho do servidor.

### Quem já tinha o relógio ligado

Motoristas que usaram o app antes de 02/10/2026 podem ter `trialInicio` gravado,
e o campo não pode ser reescrito pelas regras (nem pelo dono). Com a chave
desligada isso não importa: ninguém é bloqueado e nada é cobrado. Mas, no dia em
que a chave for ligada, a data antiga volta a valer, e quem passou de 90 dias
fica bloqueado na hora.

### Para religar depois

1. **Antes de ligar**, decidir o que fazer com o `trialInicio` de quem já tinha:
   - rodar um script com Admin SDK que apaga o campo de todos, para cada um
     ganhar os 90 dias inteiros a partir do próximo uso (recomendado);
   - ou dar uma concessão para cada um.
2. Ligar a base no painel admin ("Habilitar a cobrança"). Depois, ligar um a
   um os módulos de desconto que valerem (escada, indicação, sazonais).
3. Voltar a frase do site para a oferta que valer ("até 3 meses de teste
   grátis" ou outra), nos dois lugares da home e na `/saiba-mais`.
