# Teste de código — 03/10/2026

Sete leituras do código (regras incluídas), uma por área. Os itens marcados
**✔ conferido** foram verificados linha a linha depois do relatório; os demais
vêm da leitura e serão conferidos na hora da correção.

## CRÍTICO — segurança e dinheiro

| # | Achado | Onde | |
|---|---|---|---|
| C1 | O motorista pode reescrever `parentUid`, `childId` e `amount` de um pagamento dele e plantar uma cobrança falsa (com o PIX dele e os lembretes) numa família que não é dele | `firestore.rules` payments update | ✔ conferido |
| C2 | Qualquer motorista recém-cadastrado anexa uma "criança" a uma mãe de OUTRO motorista só sabendo o WhatsApp dela — passa a ler o doc dela, mandar avisos, recados e gerar cobrança | `functions/lib/vincularIrmao.js` + `reguaDoIrmao.js` (procura a conta na plataforma inteira) | ✔ conferido |
| C3 | Buzina: depois de "Estou indo!", o "Fechar" fica carregando para sempre — a tela cheia não fecha | `IncomingCallModal.jsx` `onAck` | ✔ conferido |
| C4 | Buzina: a chamada nunca expira nem é fechada pela rota — volta a tocar na próxima abertura do app, até no dia seguinte | `pendingCallService.js`, `OperacaoDaRota.jsx` | |

## ALTO

| # | Achado | Onde | |
|---|---|---|---|
| A1 | Push: `fcmOptions.link` relativo ("/pai") — o FCM exige HTTPS absoluto; a recusa (`invalid-argument`) é tratada como token morto e APAGA o token | `functions/lib/push.js` | ✔ estrutura conferida; falta um envio real |
| A2 | E-mail de mensalidade sai do remetente sandbox do Resend (só entrega ao dono da conta) — os marcos de 3 dias antes e 3 de atraso, que são só e-mail, não chegam a ninguém | `functions/index.js` FROM_EMAIL | |
| A3 | A cobrança do mês ignora a vigência do contrato (cobra antes do início e depois do fim — em janeiro, todo mundo com contrato até 31/12) | `functions/lib/billing.js` | |
| A4 | A trilha do pagamento aceita evento forjado (`actorRole`, `type`, `at` livres) — "Motorista confirmou" escrito pela família, e não se apaga | `firestore.rules` payments/events | |
| A5 | Excluir conta (família e motorista) apaga os dados ANTES do `deleteUser`, que costuma falhar por login antigo — dados somem, o login fica | `accountService.js` | ✔ conferido |
| A6 | A família seguinte herda o contrato pendente e as versões antigas (com nome e dados da família anterior) | `accountService.js` + rules `contratos` | |
| A7 | Avisos do sino: mais de 20 tipos não levam a lugar nenhum ao tocar; o push de vários abre "/" | `NotificationsBody.jsx`, `push.js` | |
| A8 | "Respondemos seu chamado" e "indicação ativou" escritos pelo DONO são recusados pelas regras | `firestore.rules` notifications | |
| A9 | O motorista não vê na rota quem vai buscar hoje (responsável temporário), e o "Trocar" da mãe não o avisa | `AltPickupSheet.jsx`, rota | |
| A10 | "Está chegando" toca quando a perua vai EMBORA e para famílias de outra viagem; o mapa da família tem um segundo alerta com "Tio Nino" e emoji | `PaiDashboard.jsx`, `PaiMap.jsx`, alvos | |
| A11 | A tela da família diz "AO VIVO" para criança que não está nesta viagem, e some com o "avisar falta" durante a rota | `PaiDashboard.jsx` `estadoDoDia` | |
| A12 | Mãe com filhos em duas peruas: o "paguei" vai para o motorista errado, e a chave PIX mostrada é a do outro | `PaiFinance.jsx` | |
| A13 | O nome completo da criança chega ao celular de quem pede acesso só pelo WhatsApp (o dado vem, a tela esconde) | `pedidosDeVinculo` + rules | |
| A14 | Dois "encerrar" para o motorista: "Encerrar operação" APAGA TUDO e é o mais fácil de achar; a saída segura some com a cobrança desligada | `Profile.jsx`, `ProfileMenu.jsx` | |
| A15 | Lembretes de atraso vão para quem já marcou "paguei" (claimed) | `enviarAvisosDoDia.js`, `index.js` | |
| A16 | Varredura de lembretes com `limit(500)` sem ordem — passando de 500 em aberto, sempre as mesmas crianças ficam sem aviso | `enviarAvisosDoDia.js` | |

## MÉDIO (resumo)

- Faltas: a folha mostra a falta de HOJE e age na data escolhida; regras não amarram o id do doc à criança (motorista cria falta de criança alheia).
- "Avisar que não tem aula": sem desfazer, não atômico, sobrescreve "Eu busco".
- "Atrasado" a partir das 9h do dia do vencimento; criança cadastrada no meio do mês já nasce atrasada.
- Comprovante pode ser trocado/apagado depois da baixa.
- Contrato do irmão nunca pedido (o portão só olha a criança ativa); "Não é meu filho" pode sumir.
- Recados antigos continuam legíveis depois de "Não é meu filho".
- Número da casa pode sobrescrever a correção do motorista.
- Alvará: foto de celular passa de 2 MB e falha com erro em inglês.
- Chave PIX: CPF sem dígito verificador; CNPJ não pode ser cadastrado.
- Sair da conta deixa o celular recebendo os pushes da conta anterior (com nomes de crianças).
- iPhone sem o app instalado: sem push e sem explicação.
- Encontrabilidade: ficha da criança a 4–5 toques sem rótulo; recado para uma família a 6+; sem visão das faltas do mês; nomes diferentes para a mesma coisa; links com destino errado ("Histórico de pagamentos", "Visão completa", "Rota → Ajustar horários").

## Precisa de decisão do dono

1. **Responsável secundário**: hoje é só contato (não entra, não recebe nada, e se abrir o convite primeiro fica com a criança). Dar conta a ele?
2. **E-mail**: domínio próprio no Resend (sem ele, nenhum e-mail chega).
3. **Faltas "Eu levo"/"Eu busco"** contam como falta no resumo?
4. **Vínculo de irmão entre motoristas diferentes**: só no mesmo motorista (seguro), ou pedir confirmação à mãe?

## Navegador — só o essencial e o que o código apontou

1. Rota com as duas pessoas ao mesmo tempo (status, buzina C3/C4, "está chegando" A10, previsão com relógio simulado).
2. Um push de verdade (A1) e o clique no aviso (A7).
3. Excluir conta com sessão antiga (A5).
4. Mãe com dois filhos em peruas diferentes (A12, contrato do irmão).
