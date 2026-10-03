# Achados do teste no navegador

Cada linha tem a gravidade, a lente, a tela e a prova (print em
`resultados/<jornada>/`). Gravidade: **Bloqueia** (não termina), **Atrapalha**
(termina com dúvida ou erro), **Melhoria** (funciona, mas poderia ser mais fácil).

Ambiente: emuladores (`demo-alobuzinou`), Chrome 360×740 com toque, pt-BR.

---

## M1 · Motorista chega pelo site, cria a conta, primeiro acesso e tutorial — 02/10/2026

Terminou: **sim**. 20 telas, 0 erro no console.

| # | Gravidade | Lente | Tela | O que acontece | Prova | Sugestão |
|---|---|---|---|---|---|---|
| 1 | **Bloqueia** (confiança) — ✅ **corrigido** | UI | Início do motorista | Um comentário do código aparecia como texto ("/* A ÂNCORA DO TUTORIAL MORA AQUI…"), ocupando a tela inteira e empurrando "Cadastrar a primeira criança" para fora da vista. **Em produção desde o commit `c809b7c`**, para todo motorista antes de iniciar a rota. Causa: `/* */` sem chaves dentro do JSX. | 1ª rodada (substituída) | Corrigido em `ControleDeRota.jsx` (`{/* … */}`); varredura não achou outro caso. **Precisa de deploy.** |
| 2 | **Atrapalha** | 40+ | Todas as telas do app | O zoom com dois dedos está desligado (`user-scalable=no` no viewport). Quem enxerga pouco não consegue ampliar nada. | axe em todas as telas | Tirar `user-scalable=no` e `maximum-scale=1` do `index.html`. |
| 3 | **Atrapalha** | UX | Aceite dos termos | A conta acabou de nascer e a primeira tela diz "Atualização dos termos — Atualizamos os Termos de Uso…". O cadastro não pede aceite, então todo motorista novo lê que algo mudou. O botão fica apagado até marcar as duas caixas, sem dizer por quê. | 09-termos-conta-nova | Pedir o aceite no cadastro, ou outro texto quando não há aceite anterior ("Antes de começar: os termos do app"). |
| 4 | **Atrapalha** | 40+ | Cadastro do motorista | O aviso de cookies que ficou sem resposta no login cobre o botão "Criar minha conta e entrar". | 06-cadastro-vazio | O aviso não pode cobrir o botão principal (barra fina, ou reservar espaço). |
| 5 | **Atrapalha** | UX | Login, fim da apresentação | O aviso de cookies aparece junto com o foco final: o "Aceitar todos" (verde cheio) compete com o "Entrar com Google" que a apresentação acabou de destacar. | 05-login-foco-final | Aviso de cookies discreto, sem botão cheio da cor principal. |
| 6 | **Atrapalha** | UX / AI | Início vazio | Com a turma vazia, o maior botão da tela é "INICIAR ROTA", fixo no topo, acima de "Cadastrar a primeira criança", que é o próximo passo de verdade. Iniciar rota sem criança não faz nada útil. | 19-inicio | Esconder "Iniciar rota" (ou deixar discreto) até haver criança com horário. |
| 7 | **Melhoria** | UX | Tutorial, passo 4 | "Com a turma pronta, o botão Iniciar rota aparece aqui" — mas o botão já está ali com a turma vazia. O texto contradiz a tela. | 18-tutorial-4 | Resolve junto com o #6; ou trocar o texto. |
| 8 | **Melhoria** | UX | Início vazio | "As famílias veem sua perua no mapa" aparece antes de existir família. | 19-inicio | Mostrar a chave só com turma cadastrada (ou no início da rota). |
| 9 | **Melhoria** | 40+ | Cabeçalho (todas as telas) | Sino e perfil com 36×36px (mínimo recomendado 44–48). | axe/medida | Área de toque de 44px+. |
| 10 | **Melhoria** | 40+ | Aceite dos termos | Caixas de marcar com 20×20px. | 09 | Linha inteira tocável e caixa maior. |
| 11 | **Melhoria** | 40+ | Login e cadastro | Textos de 10–11px: "Termos de Uso", "Política de Privacidade", "Exemplo", "a casa / a escola", "como você entra na sua conta". | medida | Mínimo de 12px; 14px no que é para ler. |
| 12 | **Melhoria** | UI | Início | Botão festivo 🎃 sem rótulo ao lado do "Boa noite" (o que é isso?). | 19-inicio | Rótulo ou explicação no primeiro toque. |
| 13 | **Melhoria** | UI | Início | A data sai "Sexta, 2 De Outubro" ("De" maiúsculo). | inicio-de-novo | "Sexta, 2 de outubro". |
| 14 | **Melhoria** | 40+ | Site (home) | Os rótulos pequenos de seção (verde sobre cinza, 11px) têm contraste 3,9:1 (mínimo 4,5). Links do rodapé com 15–22px de altura. | 01-site-topo | Verde mais escuro nos rótulos; links do rodapé maiores. |

### Correções da M1 (02/10/2026) — conferidas em nova rodada

| # | Status | O que mudou |
|---|---|---|
| 1 | ✅ | Comentário com chaves em `ControleDeRota.jsx`. |
| 2 | ✅ | `index.html` sem `maximum-scale`/`user-scalable=no`. axe: **0 violações em todas as telas do app**. |
| 3 | ✅ | `TermsAcceptanceGate`: conta nova vê "Antes de começar"; "Atualização dos termos" só para quem já tinha aceite. Aviso "Marque as duas caixas acima para continuar" enquanto o botão está apagado. |
| 4, 5 | ✅ | `CookieBanner`: uma frase, três botões de contorno do mesmo peso (nenhum verde cheio), e a página ganha espaço no fim enquanto ele está aberto. |
| 6, 8 | ✅ | `TioDashboard`: a barra "Iniciar rota" e a chave do mapa não aparecem com a turma vazia (nem enquanto carrega). |
| 7 | ✅ | Com o #6, o passo 4 do tutorial cai no cartão da turma vazia, e o texto passou a ser verdade. |
| 9 | ✅ | Sino e perfil com 44×44. |
| 10 | ✅ | Termos: linha inteira tocável (48px), caixa 24px, texto 15px. |
| 11 | ✅ | Textos de leitura das telas da M1 em 12px+ (login, cadastro, Início, controle da rota). Os mockups do fundo do login seguem menores — são ilustração. |
| 12 | — | Sem mudança: o 🎃 tem nome para leitor de tela e abre um balão explicando ao tocar. |
| 13 | ✅ | "Sexta, 2 de outubro". |
| 14 | ✅ | Site: rótulos em #0A6E3E (5,5:1), 12px; links do topo, da família e do rodapé com 44px de altura; textos da tela de exemplo em cinza legível. axe: **0**. |
| — | ✅ | Extras: "Criar conta grátis" (42px), "Ver o site" (44px), "Voltar" do cadastro (44px), links legais (40px). |

**Sobra (melhoria pequena):** "Usar email" (36px), "Mostrar senha" (40px) e os links legais (40px) ficam um pouco abaixo de 44px.

**O que funcionou bem:** o cadastro tem três campos e diz o que fazer quando
falta algo; o primeiro acesso em três passos curtos, com barra de progresso;
"Permitir localização" achou a cidade sozinho; o tutorial de quatro paradas
aponta para os botões certos (depois da correção do #1); nenhum erro no console.

**Não conta como achado:** "Configurar primeiro administrador" no login
aparece só porque o banco de teste não tem dono.

---

## M3 · Motorista cadastra a primeira criança e manda o convite — 02/10/2026

| # | Gravidade | Lente | Tela | O que acontece | Prova | Status |
|---|---|---|---|---|---|---|
| 15 | **Bloqueia** | UX/UI | Cadastro da criança, passo 1 | A barra de baixo (Início/Financeiro) fica POR CIMA do botão "Avançar": o motorista não sai do passo 1. A tela mora no `div` da animação de entrada do `TioLayout`, que cria um contexto de empilhamento — o `z-40` do rodapé do formulário só vale lá dentro. O comentário do código dizia que isso estava resolvido. | 03-onde-parou (1ª rodada) | ✅ O cadastro da criança não mostra a barra de baixo (`TioLayout`). |
| 16 | **Atrapalha** | UX | Cadastro da criança, passo 4 | Pedia o **e-mail do responsável** (marcado como obrigatório). O motorista quase nunca sabe e achava que precisava descobrir o de toda família. | 15-p4-inteiro | ✅ Campo removido (pedido do dono). O `redeemInvite` passa a gravar SEMPRE `linkedEmail` (o e-mail com que a família entrou), e o contrato e a ficha leem esse. |
| 17 | **Atrapalha** | 40+ | Cadastro da criança, passo 3 | Os horários abriam o relógio do Android; o motorista quer digitar. | 07-p3 | ✅ Campo de texto numérico com máscara (`0640` → `06:40`), também em Horários. |
| 18 | **Atrapalha** | UI | Criança cadastrada | Botão "Mandar convite" com texto branco sobre o verde do WhatsApp (1,98:1), quebrando em duas linhas e cortando o ícone. | 20-sucesso-inteiro | ✅ Texto escuro (passa AA), rótulo curto com o nome de quem recebe ("Mandar convite para Mariana"), ícone que não encolhe. |
| 19 | **Atrapalha** | AI | Criança cadastrada | O aviso amarelo "Falta o seu cadastro para o contrato" vinha ANTES do convite, que é o que ele veio fazer. | 20-sucesso-inteiro | ✅ O aviso desceu para depois do convite. |
| 20 | **Melhoria** | UX | Mensagem do convite | "do transporte escolar **do/da** Pedro", com o gênero já marcado. | mensagem interceptada | ✅ `doDa()` usa o gênero ("do Pedro"); vale também no reenvio e na ficha. |
| 21 | **Melhoria** | 40+ | Mensagens de erro (app todo) | Vermelho de preenchimento usado como texto (3,3:1). | 03-p1-erros | ✅ 10 lugares trocados para `dangerText` (6,5:1). |
| 22 | **Melhoria** | 40+ | Cadastro da criança | Alvos pequenos: Cancelar/Voltar (28px), Trocar/trocar (16px), "+ Cadastrar outra escola" (24px), X do popup (28px), "Mais opções" (28px); "Passo 1 de 4" em 11px. | medidas | ✅ Todos com 44px de toque; textos em 12px+. |
| 23 | **Melhoria** | UX | Cadastro da criança | "Complemento" sem dizer que é opcional; "Em que dia do mês o pai paga". | — | ✅ "Complemento (opcional)" (cadastro e editar endereço); "a família paga". |

**O que funcionou bem na M3:** a busca da rua pelo nome achou a rua e o CEP
sozinha (casa e escola); a escola nasceu no popup sem perder o cadastro; o
passo 1 diz exatamente o que falta; **a pergunta da chave PIX apareceu na hora
certa**, com o valor e o nome da criança, e o "seu celular é sua chave?" salvou
em um toque. Conferido numa segunda rodada: **0 violações de acessibilidade**
em todas as 21 telas.

**Ambiente:** emuladores e site passaram para Docker
(`testes-navegador/docker/compose.yml`) — a sessão de teste derrubava os
processos aos 30 minutos.

---

## M3b · Motorista completa os dados do contrato e confere o contrato — 02/10/2026

| # | Gravidade | Lente | Tela | O que acontece | Status |
|---|---|---|---|---|---|
| 24 | **Bloqueia** (contrato) | UX | Convite | Era possível mandar o convite sem os dados do motorista: a família entrava e **não havia contrato** para assinar (o contrato não é gerado sem nome, CPF/CNPJ e endereço). | ✅ **Obrigatório** (decisão do dono): o `InviteShare` mostra "Antes do convite: seus dados para o contrato" no lugar do botão, em todo caminho de convite. Formulário único `DadosDoContratoForm`, com o nome e a cidade já preenchidos do primeiro acesso. |
| 25 | **Atrapalha** | UX | Dados do contrato | CPF/CNPJ sem conferência: um dígito errado ia para o contrato assinado. | ✅ Máscara e conferência dos dígitos (`documentoValido`); CPF errado é recusado com "confira os números". |
| 26 | **Bloqueia** (confiança) | UI | **Contrato assinado pela família** | O texto do contrato dizia "aplicativo **Tio Nino Digital**" (nome antigo), duas vezes. Também no rodapé do perfil, na mensagem ao responsável e nos dois relatórios financeiros. | ✅ Trocado por "Alô Buzinou". ⚠️ Decisão do dono: subir `CONTRACT_VERSION` para quem já aceitou com o nome antigo. |
| 27 | **Atrapalha** | AI | Perfil | Seção "Dados da empresa": o motorista autônomo não se reconhece. O texto prometia "o app usa placeholders" — falso, o contrato não é gerado. Exemplo com a marca antiga. | ✅ "Dados para o seu contrato com o responsável" (pedido do dono), texto verdadeiro, mesmo formulário. |
| 28 | **Atrapalha** | UX | Contrato | "Vencimento todo dia 12" com 10 digitado: o campo era `type="number"`, que muda sozinho com a roda/rolagem e aceita "e". | ✅ Campo de texto só com números (2 dígitos). Conferido: dia 10. |
| 29 | **Melhoria** | UX | Contrato | O local de assinatura saía "Rua das Palmeiras, 02 de outubro" (o 1º pedaço do endereço). | ✅ Usa a cidade dele. |
| 30 | **Melhoria** | UX | Contrato (motorista) | "O responsável aceita quando entrar no app com o código de convite" — o código saiu do app. | ✅ "pelo link do convite". |
| 31 | **Melhoria** | 40+ | Minha turma | Título cortado ("Min…") pelo botão "+ Nova criança" em 360px; seta de voltar (32px, em todas as telas internas), filtros (36px), "Ver mais" (28px), "Ver ficha completa" (12px). | ✅ Rótulo do botão só a partir de 400px; todos com 44px. |

**Para o dono decidir (jurídico, não mexi):** o contrato diz vigência de
**01/01 a 31/12/2026** e **12 parcelas**, mas a criança entrou em outubro — a
família estaria assinando por meses que já passaram.

**Observado, sem mudança:** tocar no nome da criança na turma expande o cartão;
a ficha abre pela foto ou por "Ver ficha completa" (agora um botão de verdade).
É desenho de propósito (consultar sem sair da lista).

## M3c · Motorista confere e muda o combinado do Pedro — 02/10/2026 (Fase 1 do contrato)

Passou de ponta a ponta: ficha → "Contrato e mensalidade" → Mudar (R$ 500, 12 meses)
→ o contrato diz 12 parcelas de R$ 500,00, vigência 02/10/2026 a 01/10/2027,
com o histórico de versões.

| # | Achado | Estado |
|---|---|---|
| 32 | Salvar dava "Não deu pra salvar" com o dado JÁ salvo: a escuta da ficha emitia a versão nova antes do próprio salvar, que tentava emitir a mesma | corrigido (um lote só + não emite com as escutas fora de compasso) |
| 33 | As duas datas lado a lado cortavam o ano em 360px ("02/10/202") | corrigido (uma embaixo da outra) |
| 34 | O motorista escolhe datas mas pensa em meses (pedido do dono) | corrigido ("Contrato de N meses" em destaque, sozinho) |
| 35 | "Trocar foto" com `aria-label` num `<label>` (axe, sério) e 40px | corrigido (texto escondido, 44px) |
| 36 | Título do fim do cadastro (pedido do dono) | "Pedro entrou na sua turma" |
| 37 | Versão trocada antes do aceite aparecia como "desfeito" | "trocada" |

⚠️ Os dados de teste anteriores se perderam no primeiro reinício do contêiner
(a exportação falhava no disco do Windows). Hoje moram no volume
`dados-emuladores`; M1 e M3 foram refeitas.

## R1 · R2 · R2b · A mãe abre o convite, aceita o contrato e depois o aditivo — 03/10/2026

Passou de ponta a ponta: link → conta por e-mail → contrato gravado (12 × R$ 500)
→ aceite → card do primeiro acesso → tour → Início. Depois, o aditivo:
R$ 500 → 520 → 540, cada um só valendo depois do aceite dela.

| # | Achado | Estado |
|---|---|---|
| 38 | Aviso de cookies POR CIMA da folha de entrar — tampava "entrar com email" | corrigido (aviso abaixo das folhas) |
| 39 | Aviso de cookies tampava o botão "Aceitar contrato" | corrigido (painel de aceite acima) |
| 40 | A prévia dizia "José Aparecido da Silva te convidou" (nome civil) | corrigido (a marca: "Tio Zé") |
| 41 | "O transporte do …" fixo no masculino | corrigido (`doDa` com o gênero) |
| 42 | **`redeemInvite` caía com 500 depois de criar a conta da mãe** | corrigido (`FieldValue` modular) |
| 43 | **Depois de aceitar o contrato, o app ficava INERTE sem card nenhum** | corrigido (passos vêm do portão) |
| 44 | O tour abria por baixo do card do primeiro acesso | corrigido (espera a criança) |
| 45 | "PED…": o nome da criança cortado no cartão de hoje | corrigido (linha própria) |
| 46 | Botão dentro de botão (o enfeite festivo no cartão) | corrigido |
| 47 | A escuta da falta e do "quem busca hoje" morria antes de o documento existir | corrigido nas rules (+5 casos) |
| 48 | "Versão 3" no primeiro contrato que ela lê | só o aditivo leva número |
| 49 | A barra de abas tampava "Aceitar a mudança"; o que muda ficava abaixo da dobra | corrigido (portal; mudança no topo) |
| 50 | Turma e professora no cadastro, sem sala (pedido do dono) | feito |

⚠️ Pendente de conferir: outros 8 módulos das functions ainda usam
`admin.firestore.FieldValue` (billing, push, routes…). O do convite quebrou no
emulador; os outros podem quebrar igual.

## M5 · A rota com quatro crianças — 03/10/2026 (código + navegador)

Turma de `semear-turma.mjs`: Pedro e Lia no Colégio Santa Maria, Caio e Duda
na Escola Estadual Funchal, Duda com falta avisada. Passou no navegador:
aba Rota aparece e some; o foco anda Pedro → Lia → Caio; "ENTREGUEI NA ESCOLA —
TODOS OS 2 · Pedro, Lia"; Duda "Falta hoje · avisado há 2 dias"; encerrar
mostra "Ainda na perua: Pedro, Lia, Caio".

| # | Achado | Estado |
|---|---|---|
| 51 | **A rota se encerrava sozinha** com a perua parada 20 min ou a tela apagada | corrigido (pulso de 1 min, tela acesa, 90 min no servidor) |
| 52 | **App recarregado no meio da rota: GPS não voltava** | corrigido (religa sozinho) |
| 53 | **O foco travava depois do 1º EMBARQUEI** | corrigido (`focoDaViagem`, testado) |
| 54 | **"TODOS" juntava casas e escolas diferentes** | corrigido (só o mesmo lugar) |
| 55 | **"A rota não começou" toda tarde, até para quem já foi entregue** | corrigido (teto de 90 min + status de hoje) |
| 56 | **"Vocês são os próximos" para a família errada** (volta lida como ida, tarde às 6h40, quem faltou) | corrigido |
| 57 | "A perua saiu" uma vez por DIA e para quem faltou | corrigido (por viagem, sem quem está fora) |
| 58 | "Está chegando" contava quem faltou | corrigido |
| 59 | Encerrar não avisava quem ficou na perua; o "faltou registrar" adivinhava a direção pelo relógio | corrigido |
| 60 | "Tio Nino chega em uns 5 minutos" (nome falso e previsão inventada) | corrigido (a marca dele, sem minutos) |
| 61 | Mapa desligado e a barra dizendo "o responsável está te vendo" | corrigido |
| 62 | "Faltou"/"Buzinar" para criança já dentro da perua | corrigido |
| 63 | Só a criança em foco tinha botões | corrigido (tocar na lista põe em foco) |
| 64 | Fechamento automático deixava a última posição gravada | corrigido |
| 65 | Botão "TODOS" em âmbar; contrastes de 3,5–3,9:1 | corrigido |

### Guardado para a etapa das notificações (decisão do dono)
- Família avisada quando o motorista marca "Faltou" / desfaz.
- Buzina tocar com o app da mãe FECHADO (hoje só com ele aberto).
- "Está chegando" como notificação (hoje só com o app aberto).

### Construído em seguida (03/10/2026) — R3 e M6 passaram no navegador
- Telefone da escola: a mãe informou pela ficha; apareceu para ela, foi
  copiado para a Lia (outra família, mesma escola) e para o "Ligar para a
  escola" no passo da escola do motorista.
- Desfazer: Pedro voltou de "na perua" para "em casa".
- Sem sinal: aviso "sem sinal", o foco seguiu para a Lia em 2,5 s, e a
  marcação subiu quando a internet voltou.
- Recado e "Vou atrasar" enviados de dentro da rota.
- "Ninguém em casa": Pedro foi para o fim; o foco passou para a Lia.

| # | Achado no M6 | Estado |
|---|---|---|
| 66 | **A escolha manual do foco prendia a criança** depois de marcada (o travamento voltando por outro caminho) | corrigido (vale um toque; teste na régua) |
| 67 | "Voltar um passo" quebrava em duas linhas | "Desfazer" |
| 68 | "Você está 318 min adiantado" com a rota iniciada fora de hora | a leitura cala acima de 90 min |

## M7 · Mapa desligado, perua quebrada e o sábado, dos dois lados — 03/10/2026

Passou sem nenhum erro de console: "Hoje é sábado" no lugar do botão (com
"Rodar mesmo assim"); a mãe viu "O motorista avisou um problema com a perua";
depois do "Resolvido", "Este motorista prefere não mostrar a perua no mapa".
M6 rodou de novo e passou inteiro.

| # | Achado | Estado |
|---|---|---|
| 69 | **Mapa desligado: NENHUMA posição era gravada** (`setDoc` sem `merge` com `deleteField`) | corrigido + teste com sonda |
| 70 | Painel da família sem `SEM_MAPA` — quebraria a tela assim que o 69 fosse corrigido | corrigido (+ padrão para estado novo) |
| 71 | **Cache persistente do Firestore derrubou a tela da mãe** (INTERNAL ASSERTION ca9) | desligado; sem sinal segue sem travar |
| 72 | Fim de semana e feriado nacional não existiam | `calendario.js` + espelho, Páscoa calculada |
| 73 | "Perua quebrou" e "passou mal" não eram estados | ocorrência na rota; "Levar de volta para casa" |
| 74 | Previsão de chegada | de volta: combinado + atraso real, só a hora |
| 75 | 400 isolado no console (R3) | era a instalação do Analytics com a chave falsa do emulador — some com o Analytics desligado no emulador |

### Ainda pendente
- Marcação feita sem sinal se perde se o app for fechado antes de o sinal
  voltar (o cache persistente quebrou a tela da família — ver 71).
- A previsão não foi vista no navegador: o teste roda de madrugada e a régua
  cala acima de 90 min de diferença. Está coberta na régua (`testar:viagem`).
- Motorista substituto: fora do escopo (decisão do dono).
