> ## ⚠️ JÁ IMPLEMENTADO — e o código daqui está DEFASADO
>
> Isto virou o commit `13e2a13` em `WebApp-oficial-v1`. A partir daqui esta
> pasta é **registro histórico da decisão**, não fonte de código. Os arquivos
> que valem são:
>
> - `src/components/tio/MeuTransporteSheet.jsx`
> - `LinhaMeuTransporte` como componente local em `src/pages/tio/TioDashboard.jsx`
>
> **Não copie os `.jsx` desta pasta.** Eles têm três problemas corrigidos na
> implementação:
>
> 1. **Leitura duplicada.** O `MeuTransporteSheet.jsx` daqui chama
>    `useChildren()` e `useEscolas()` por conta própria. Quem monta a folha é
>    o `TioDashboard`, que já assina as duas — e o hook roda mesmo com a folha
>    FECHADA. Seriam duas assinaturas permanentes do mesmo dado, e duas fontes
>    que podem discordar. Na versão real as contagens vão por **prop**.
>
> 2. **O tutorial quebraria em silêncio.** O handoff não mencionou que
>    `data-tour="turma"` e `anchor: 'horarios'` apontavam pras linhas que
>    foram pra dentro da folha. Passo que ilumina elemento escondido não
>    quebra: vira um balão no rodapé e o tour segue, ensinando sem mostrar.
>    Os passos foram repontados pra linha "Meu transporte".
>
> 3. **Uma citação inventada.** A seção 1 justifica apagar "A receber no mês"
>    com "ver o cabeçalho de `FinanceHero`". Esse cabeçalho não existe — o
>    `FinanceHero` não tem comentário nenhum. A decisão continua certa, mas
>    por outro caminho: o Financeiro mostra "Recebido" real e a lista de quem
>    está devendo. A razão verdadeira está no cabeçalho do `TioDashboard`.
>
> O resto do documento — a análise, os movimentos e o porquê de cada um — se
> sustenta, e foi conferido contra o código antes da implementação.

# Handoff — Arquitetura de informação do MOTORISTA (Alô Buzinou)

Repositório: `Feacleto/Projeto-WEABAPP_ESCOLAR` · branch `WebApp-oficial-v1`
Escopo: papel `admin` (= MOTORISTA). **Nada do responsável (`parent`) nem do dono (`owner`).**

---

## 1. O que muda, em uma tela

| # | Movimento | Arquivos |
|---|---|---|
| 1 | As 6 linhas de cadastro/avisos saem do Início e viram a folha **"Meu transporte"** | novo `src/components/tio/MeuTransporteSheet.jsx`, `TioDashboard.jsx` |
| 2 | A linha **"A receber no mês"** é **apagada** (não movida) | `TioDashboard.jsx` |
| 3 | A linha **"Como usar o app"** sai do corpo do Início e entra na folha | `TioDashboard.jsx` |
| 4 | A faixa fixa da rota passa a dizer **"MODO ROTA · levando pra escola / trazendo pra casa"** | `src/components/route/ControleDeRota.jsx` |
| 5 | A linha **"Meu transporte"** aparece em TODOS os estados do Início — inclusive `dirigindo` | `TioDashboard.jsx` |

**Nenhuma restrição do produto foi quebrada:** continuam duas abas (`TioLayout` intocado), nenhuma tela nova, nenhuma rota nova, folha continua ganhando de navegação. Nenhuma tela existente é removida — as 15 telas de trás continuam nas mesmas rotas.

### Por que (é isso que justifica o merge)
- O bloco de cadastro é atravessado 2x por dia e usado ~3x por mês. Ele cobra rolagem com o pé no freio.
- E ele **desaparece** no estado `dirigindo`, que é exatamente quando o motorista está parado no portão da escola com 6 minutos livres. Hoje, pra avisar uma escola durante a rota, ele encerra a rota (apaga a perua do mapa de todas as famílias) e liga de novo. Esse é o pior atrito do dia e é o que o movimento 1 + 5 conserta.
- "A receber no mês" é previsão. O `TioFinance` já decidiu que previsão não vira número de topo (ver o cabeçalho de `FinanceHero`). Manter no Início é duas superfícies pra mesma pergunta.
- O Início troca de cara 3x por dia sem se anunciar. O rótulo do modo custa 18px numa faixa que já existe.

Resultado: Início fora de rota vai de 9 blocos para 5, e cabe em uma tela de celular barato no estado que mais importa (antes de sair). Em 320px, sai de ~3 telas de rolagem para pouco mais de 1.

---

## 2. Arquivos deste pacote

| Arquivo | O que é |
|---|---|
`MeuTransporteSheet.jsx` | **Código pronto.** Copiar para `src/components/tio/MeuTransporteSheet.jsx`
`LinhaMeuTransporte.jsx` | **Código pronto.** A linha que abre a folha. Colar dentro de `TioDashboard.jsx` (é um componente local, junto de `Linha`/`ReceberRow`) — ou mover pra arquivo próprio se preferir.
`PATCHES.md` | As edições exatas em `TioDashboard.jsx` e `ControleDeRota.jsx`, trecho por trecho.
`Alo Buzinou - IA do Motorista.dc.html` | **Referência visual.** É um protótipo em HTML — abre no navegador. Não é código de produção: serve pra conferir o resultado. Os 4 artboards: jornada, arquitetura, telas, antes/depois.

O código dos dois `.jsx` já está no idioma do repo: Tailwind com os tokens de `tailwind.config.js`, lucide, hooks existentes (`useChildren`, `useEscolas`), `AppSheet` como casca, e cabeçalho de comentário explicando o **porquê** (convenção do `CLAUDE.md`).

---

## 3. Fidelidade

**Alta.** As cores, raios, alturas e tipografia são os que já estão em produção — foram lidos de `tailwind.config.js`, `Header.jsx`, `BottomNav.jsx`, `AppSheet.jsx`, `Card.jsx`, `Button.jsx`, `PageHeader.jsx`, `PaymentRow.jsx`, `ControleDeRota.jsx`, `OperacaoDaRota.jsx` e `TioDashboard.jsx`. **Não há componente novo de design** — a folha usa `AppSheet` (`size="tall"`) e a linha usa exatamente o `Linha` que já existe no Início. O implementador não precisa inventar estilo nenhum.

Tokens usados (todos já existentes): `bg #EEF1EF` · `card #FFFFFF` · `surface #F6F8F7` · `primary #1F5F3F` · `primaryDark #143F2A` · `secondary/warning #F5A623` · `accent/success #52C41A` · `danger #EF4444` · `text #111827` · `textMuted #6B7280`. Inter. `rounded-xl` nas linhas, `rounded-2xl/3xl` nos cartões, `rounded-t-3xl` na folha.

---

## 4. A folha "Meu transporte" — conteúdo final

Quatro grupos, com o rótulo de seção do Início (`text-[11px] uppercase tracking-widest text-textMuted`):

1. **quem anda na perua** — Minha turma (contagem) · Escolas (contagem) · Editar rota padrão (aviso "N a confirmar")
2. **a semana** — Faltas da semana
3. **avisos que vão pra agenda das famílias** — Avisar que não tem aula (abre `SchoolBroadcastSheet`) · Avisos enviados
4. **minha conta** — Contrato da plataforma · Como usar o app

**Chave PIX não entra aqui de propósito:** ela já é a `PixSheet` dentro do Financeiro, na tela onde a pergunta nasce. Segunda porta = duas superfícies pro mesmo assunto.

Rotas: `/tio/children` · `/tio/children/escolas` · `/tio/horarios` · `/tio/semana` · `/tio/agenda` · `/tio/contrato-plataforma`. Todas já existem.

### Dois detalhes que quebram se ignorados
- **Navegar fecha a folha primeiro** (`onClose()` antes do `navigate`). Sem isso ela fica montada por cima da tela nova e o "voltar" do Android fecha a folha em vez de voltar de tela.
- **Nunca duas folhas empilhadas.** "Avisar que não tem aula" fecha esta folha e só então abre o `SchoolBroadcastSheet` — senão a tampa da segunda esconde a primeira e o X devolve pra uma tela que a pessoa não vê.

---

## 5. Comportamento por estado do Início

| Estado (lógica atual, não muda) | O que a tela mostra |
|---|---|
`antes` (< 60 min da viagem) | barra fixa INICIAR ROTA · data/hora · saudação · cartão próxima viagem · lista da viagem · **linha Meu transporte** |
`dirigindo` | barra fixa **MODO ROTA + Encerrar** · `OperacaoDaRota` · **linha Meu transporte** (subtítulo "Dá pra avisar a escola aqui mesmo") |
`entre` | barra fixa · data/hora · saudação · cartão "Nada agora" · pendências · `BonusNudge`/`ReviewNudge` · **linha Meu transporte** |
`vazio` | inalterado (cartão "Sua turma ainda está vazia") + **linha Meu transporte** |

A máquina de estados (`JANELA_DE_PARTIDA`, `blocoDoMomento`, `paradasPendentes`) **não muda em nada**. Pendências continuam só em `entre` — a janela em que ele resolve pendência é essa.

---

## 6. Aceite

- [ ] Início `antes` em 390px cabe sem rolagem até a lista da viagem.
- [ ] Início `entre` em **320px** cabe em pouco mais de uma tela.
- [ ] Com a rota ATIVA, é possível chegar em "Avisar que não tem aula" em 2 toques, sem encerrar a rota.
- [ ] A faixa verde da rota diz o nome do modo e a direção da viagem.
- [ ] "A receber no mês" não existe mais em nenhum lugar do Início.
- [ ] Nenhuma rota nova no `App.jsx`; `TioLayout.jsx` intocado; ainda duas abas.
- [ ] Arrastar a folha pra baixo, tocar fora e o X fecham — e devolvem a rolagem do Início onde estava.
- [ ] `npm run lint` limpo.

## 7. Atualize o CLAUDE.md

O `CLAUDE.md` do repo pede atualização quando entra pasta/tela/componente novo. Aqui: registrar `MeuTransporteSheet` como o índice do painel do motorista e a razão (o cadastro sair do Início e continuar alcançável durante a rota).
