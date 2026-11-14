/**
 * OS TEXTOS DA LISTA DA TURMA (RC2, 14/11/2026) — catálogo irmão de
 * `valorDoConvite.js`. Puro, sem React (`npm run testar:lista-da-turma`).
 *
 * ── A MESMA REGRA DO IRMÃO: AFIRMAÇÃO CARREGA DE ONDE VEM
 * Tudo o que AFIRMA algo ao motorista (o que acontece, o que se perde, o que
 * o app faz depois) mora em `AFIRMACOES_DA_LISTA`, com `sustenta` — a chave de
 * uma funcionalidade que o app cumpre hoje, provada no teste por leitura de
 * arquivo — e, quando a frase só é verdade sob uma condição, `condicao`.
 * Rótulo de botão e de campo não afirma nada: fica em `ROTULOS`, e o teste só
 * confere que é curto e limpo.
 *
 * ── O QUE NÃO ENTRA
 * Cobrar por ele, saber quando o PIX chega, segurança, "grátis", prazo de
 * função nova e número solto (os números da tela saem da régua, por função).
 * "Recebeu" também não: o app sabe que ELE tocou em mandar, não que a mensagem
 * chegou.
 */
import { DIGA_O_VALOR } from './valorDoConvite.js';

/** O contador do topo. O número vem de `resumoDosConvites`, nunca escrito. */
export function contadorDeFamilias(entraram, total) {
  const e = Math.max(0, Number(entraram) || 0);
  const t = Math.max(0, Number(total) || 0);
  if (t === 1) return e ? 'A família está no app' : 'A família ainda não está no app';
  return `${e} de ${t} famílias no app`;
}

/** As crianças que a rota ainda não leva. */
export function textoForaDaRota(n) {
  return n === 1
    ? '1 criança fica fora da rota até ter rua e hora de pegar.'
    : `${n} crianças ficam fora da rota até ter rua e hora de pegar.`;
}

/** O cabeçalho do grupo: "Escola Alvorada · 6 crianças". */
export function cabecalhoDaEscola(nome, n) {
  return `${nome || ROTULOS.semEscola} · ${n} ${n === 1 ? 'criança' : 'crianças'}`;
}

/** A posição na fila da caixa "A completar": "2 de 7". */
export function progressoDaFila(posicao, total) {
  return `${posicao} de ${total}`;
}

/**
 * "TIRAR DA TURMA" DIZ O QUE SE PERDE — TUDO, e só o que acontece de verdade
 * (achado A2 da auditoria: a frase citava vínculo, aceite e foto, e calava o
 * resto).
 *
 * `deactivateChildAndParent` (services/accountService.js) faz, nesta ordem:
 *   1. apaga as faltas de hoje em diante, o "quem busca" (`altPickups`) e os
 *      recados da criança (`agendaEntries`);
 *   2. desvincula a família (`desvincularResponsavel`, no servidor): se esta é
 *      a ÚNICA criança dela no app, o documento da conta dela é APAGADO — ela
 *      não entra mais;
 *   3. desativa a criança, zera o aceite do contrato e a versão esperando
 *      aceite, e apaga o responsável avulso (`altResponsibles`, "quem busca");
 *   4. apaga a foto.
 * Não existe reativar (`updateChild` recusa `active`): por isso não há
 * "Desfazer". Os pagamentos ficam (o histórico do Financeiro).
 *
 * ⚠️ A CONTA DA FAMÍLIA. A lista só vê as crianças DESTE motorista. Com um
 * irmão na turma, a conta certamente fica; sem irmão aqui, ela pode ter filho
 * em outra perua — e a frase diz a condição em vez de afirmar.
 *
 * `npm run testar:lista-da-turma` (7b) lê o serviço e confere que cada efeito
 * citado existe lá e que nenhum efeito que apaga dado ficou de fora.
 */
export function textoDeTirar({
  nome,
  temFamilia = false,
  irmaoNaTurma = false,
  temAceite = false,
  temContratoEsperando = false,
  temFoto = false,
} = {}) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || 'A criança';
  const linhas = [`${primeiro} sai da turma e da rota.`];
  if (temFamilia) {
    linhas.push(
      irmaoNaTurma
        ? 'A família continua no app com o outro filho.'
        : `A família deixa de ver ${primeiro} no app, e a conta dela continua.`
    );
  }
  linhas.push(APAGADOS_AO_TIRAR);
  if (temAceite) linhas.push('O aceite do contrato é apagado.');
  if (temContratoEsperando) linhas.push('O contrato que esperava aceite é retirado.');
  if (temFoto) linhas.push('A foto é apagada.');
  linhas.push('Não dá para voltar.');
  return {
    titulo: `Tirar ${primeiro === 'A criança' ? 'a criança' : primeiro} da turma?`,
    linhas,
    corpo: linhas.join(' '),
    pagamentos: PAGAMENTOS_FICAM,
  };
}

export const APAGADOS_AO_TIRAR = 'As faltas marcadas, quem busca e os recados são apagados.';

export const PAGAMENTOS_FICAM = 'Os pagamentos que já existem continuam no Financeiro.';

/** Os rótulos: nomes de botão e de campo. Não afirmam nada. */
export const ROTULOS = {
  // Convite
  convidar: 'Convidar',
  enviado: 'Enviado',
  mandarDeNovo: 'Mandar de novo',
  entrou: 'Entrou',
  linkNovo: 'Link novo',
  mandarParaQuemFalta: 'Mandar convite para quem falta',
  convidarAFamiliaDe: (nome) => `Convidar a família de ${nome}`,
  linkNovoPara: (nome) => `Link novo para a família de ${nome}`,
  porOValor: 'Pôr o valor',
  porOValorDe: (nome) => `Pôr o valor de ${nome}`,
  abrirWhatsApp: 'Abrir o WhatsApp',
  escolhaOContato: 'Sem o número da mãe',
  // Lista
  titulo: 'Minha turma',
  vaziaTitulo: 'Sua turma começa aqui',
  adicionar: '+ Nome da criança',
  naEscola: (nome) => `Entra na escola ${nome}`,
  ok: 'OK',
  semEscola: 'Sem escola',
  entrada: 'Entrada',
  entradaChip: (hora) => `Entrada ${hora}`,
  porEntrada: 'Pôr entrada',
  buscar: 'Buscar pelo nome',
  cadastroCompleto: 'Cadastro completo, passo a passo',
  // Campos, na ordem em que ele sabe
  nome: 'Nome',
  meninoOuMenina: 'Menino ou menina',
  menino: 'Menino',
  menina: 'Menina',
  escola: 'Escola',
  novaEscola: '+ Nova escola',
  horaDePegar: 'Hora de pegar',
  nomeDaMae: 'Nome da mãe',
  rua: 'Rua',
  trocarRua: 'Trocar a rua',
  numeroDaCasa: 'Número da casa',
  naoSeiONumero: 'Não sei o número',
  whatsappDaMae: 'WhatsApp da mãe',
  seSouber: '(se souber)',
  mensalidade: 'Mensalidade',
  // A mensalidade é OBRIGATÓRIA no cadastro (decisão do dono, 14/11/2026):
  // o "(se quiser)" saiu daqui e da linha aberta.
  erroSemValor: DIGA_O_VALOR, // a mesma frase do formulário completo (RC1)
  venceNoDia: (dia) => `vence todo dia ${dia}`,
  mesmoValorDaAnterior: 'O mesmo valor da criança anterior.',
  // Salvar sozinho
  salvo: 'salvo ✓',
  salvando: 'salvando…',
  esperandoSinal: 'esperando sinal',
  naoSalvou: 'Não salvou.',
  tentarDeNovo: 'Tentar de novo',
  // Ações da linha aberta
  abrirFicha: 'Abrir a ficha',
  mandarRecado: 'Mandar recado',
  tirarDaTurma: 'Tirar da turma',
  voltar: 'Voltar',
  // Hora proposta
  propor: 'Propor a hora de pegar de quem está sem',
  propostaTitulo: 'Proposta do app',
  confirmarHorarios: 'Confirmar estes horários',
  agoraNao: 'Agora não',
  // A completar
  aCompletar: 'A completar',
  salvarEProxima: 'Salvar e ir para a próxima',
  pularEProxima: 'Ainda não sei · próxima',
  irParaProxima: 'Ir para a próxima',
  fimDaFila: 'Fim desta lista.',
  verDeNovo: 'Ver de novo quem ficou',
  voltarAosGrupos: 'Voltar',
  foraDaRota: 'Fora da rota',
  horaInvalida: 'Hora inválida. Ex: 06:20',
};

/**
 * ANTES DE ABRIR O WHATSAPP SEM NÚMERO (achado M5). Sem o número, o WhatsApp
 * abre a escolha de contato — e na sequência "família por família" é fácil
 * escolher o contato errado. Ter o link é ter o vínculo (a família vê o
 * endereço e a escola), então a tela diz para QUEM é, com o nome completo.
 */
export function confirmacaoSemNumero(nomeCompleto) {
  const nome = String(nomeCompleto || '').trim().replace(/\s+/g, ' ');
  return `Vai para a família de ${nome || 'esta criança'}. Escolha o contato certo.`;
}

/** "R$ 3,50? Confira." — o valor muito baixo, sem bloquear. */
export function confiraOValor(valorFormatado) {
  return `${valorFormatado}? Confira.`;
}

/** A proposta conferida: quem ganhou hora no meio-tempo ficou como estava. */
export function textoJaTinhamHora(n) {
  return n === 1
    ? '1 criança já tinha hora e ficou como estava.'
    : `${n} crianças já tinham hora e ficaram como estavam.`;
}

/** A faixa do topo: escritas que o servidor ainda não confirmou. */
export function textoEsperandoSinal(n) {
  return n === 1
    ? '1 alteração esperando sinal. Se fechar o app agora, ela se perde.'
    : `${n} alterações esperando sinal. Se fechar o app agora, elas se perdem.`;
}

/** O nome de cada grupo da caixa "A completar" (chave = `FALTA`). */
export const GRUPO_A_COMPLETAR = {
  hora: 'Hora de pegar',
  rua: 'Rua',
  numero: 'Número da casa',
  whatsapp: 'WhatsApp da mãe',
  mensalidade: 'Mensalidade',
};

/**
 * AS AFIRMAÇÕES, cada uma com a origem. O teste mantém a lista fechada das
 * chaves de `sustenta` e de `condicao` e prova cada uma no código.
 */
export const VAZIA_TEXTO = {
  texto: 'Digite o nome da primeira criança. O resto você completa depois.',
  sustenta: 'crianca-so-com-nome',
};

export const TODAS_CONVIDADAS = {
  texto: 'Você já mandou o convite para todas as famílias.',
  sustenta: 'convite-enviado-no-toque',
};

export const DECLARACAO_UMA_VEZ = {
  texto: 'Pedido uma vez. Vale para as crianças que você cadastrar agora.',
  sustenta: 'declaracao-por-sessao',
};

export const FORA_DA_ROTA = {
  // A frase com o número sai de `textoForaDaRota`; esta é a que a sustenta.
  texto: textoForaDaRota(2),
  sustenta: 'cadastro-rapido-fora-da-viagem',
};

export const NUMERO_PELA_FAMILIA = {
  texto: 'A família completa o número no primeiro acesso dela.',
  sustenta: 'numero-pela-familia',
  condicao: 'mae-no-app',
};

export const SEM_VALOR = {
  // Só cai aqui quem foi cadastrado ANTES de o valor virar obrigatório, quem
  // foi salvo como rascunho ("Salvar e completar depois") e a vaga rápida da
  // perua — a tela diz isso, senão parece que o cadastro deixou passar.
  texto: 'Cadastro antigo ou salvo para completar depois. Sem valor, a mensalidade não é gerada.',
  sustenta: 'sem-valor-sem-mensalidade',
};

export const PROPOSTA_NOTA = {
  texto: 'A hora de pegar é na porta de cada casa. Confira e mude o que precisar.',
  sustenta: 'hora-pega-na-porta',
};

export const PROPOSTA_AVISO = {
  texto: 'Ao confirmar, as famílias no app recebem o aviso do horário.',
  sustenta: 'aviso-de-horario',
  condicao: 'mae-no-app',
};

export const PONHA_A_ENTRADA = {
  texto: 'Ponha a entrada da escola para o app propor a hora de pegar.',
  sustenta: 'proposta-pela-entrada',
};

export const PULADOS_FICAM = {
  texto: 'Quem você pulou continua aqui para depois.',
  sustenta: 'a-completar-recalcula',
};

export function todasAsAfirmacoesDaLista() {
  const tirar = textoDeTirar({ nome: 'Ana Clara', temFamilia: true, temFoto: true, temAceite: true });
  return [
    { id: 'vazia', ...VAZIA_TEXTO },
    { id: 'todasConvidadas', ...TODAS_CONVIDADAS },
    { id: 'declaracaoUmaVez', ...DECLARACAO_UMA_VEZ },
    { id: 'foraDaRota', ...FORA_DA_ROTA },
    { id: 'numeroPelaFamilia', ...NUMERO_PELA_FAMILIA },
    { id: 'semValor', ...SEM_VALOR },
    { id: 'propostaNota', ...PROPOSTA_NOTA },
    { id: 'propostaAviso', ...PROPOSTA_AVISO },
    { id: 'ponhaAEntrada', ...PONHA_A_ENTRADA },
    { id: 'puladosFicam', ...PULADOS_FICAM },
    { id: 'tirarComTudo', texto: tirar.corpo, sustenta: 'tirar-da-turma' },
    {
      id: 'tirarComIrmao',
      texto: textoDeTirar({ nome: 'Ana', temFamilia: true, irmaoNaTurma: true }).corpo,
      sustenta: 'tirar-da-turma',
    },
    { id: 'semNumero', texto: confirmacaoSemNumero('Ana Clara Souza'), sustenta: 'link-sem-numero' },
    { id: 'esperandoSinal', texto: textoEsperandoSinal(2), sustenta: 'cache-em-memoria' },
    { id: 'jaTinhamHora', texto: textoJaTinhamHora(2), sustenta: 'proposta-conferida' },
    { id: 'tirarSemNada', texto: textoDeTirar({ nome: 'Ana' }).corpo, sustenta: 'tirar-da-turma' },
    { id: 'pagamentosFicam', texto: PAGAMENTOS_FICAM, sustenta: 'pagamentos-ficam' },
  ];
}
