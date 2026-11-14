/**
 * OS TEXTOS DA FILA "RENOVAR CONTRATOS" (14/11/2026, tela N1b). Puro, sem
 * React (`npm run testar:renovacao`).
 *
 * Mesma regra de `valorDoConvite.js`: cada frase carrega `sustenta` (a
 * funcionalidade que o app cumpre hoje, provada por leitura de arquivo no
 * teste) e, quando depende de algo para ser verdade, `condicao`.
 *
 * ⚠️ NENHUMA FRASE DIZ QUE O CONTRATO "FOI RENOVADO". O toque manda um
 * contrato novo; renovado ele fica quando a família assina. Dizer antes seria
 * o motorista contando com a mensalidade de janeiro que ainda não existe.
 *
 * ⚠️ A REDAÇÃO DO CONTRATO NÃO MORA AQUI. O que a família lê e assina é o
 * texto do contrato que já existe (`ContractView`, versão do texto em
 * `contratoDaFamilia.js`), com o prazo novo — nada jurídico foi escrito para
 * a renovação.
 */
import { dataBR } from '../dominio/cobranca/contratoDaFamilia.js';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0];

export const TITULO = 'Renovar contratos';

/** O parágrafo de cima: o que acontece quando ela assina. */
export const COMO_FUNCIONA = {
  texto: 'Quando a família assina no app dela, o contrato continua com o mesmo valor e vencimento.',
  sustenta: 'aditivo-so-vale-no-aceite',
  condicao: 'familia-assina',
};

/** "A família de Ana" — o sujeito é a família; a criança é o endereço. */
export function nomeDaLinha(nomeDaCrianca) {
  const n = primeiroNome(nomeDaCrianca);
  return n ? `A família de ${n}` : 'Uma família';
}

/** A linha de baixo de quem precisa renovar. */
export function textoDoFim(fimISO) {
  return `Contrato até ${dataBR(fimISO)}`;
}

/** O botão. O ano é o do fim NOVO, que é o que ele vai cobrar. */
export function rotuloDoBotao(novoFimISO) {
  return `Renovar para ${String(novoFimISO || '').slice(0, 4)}`;
}

/** O que acontece se ela não assinar — o mês sai da régua, nunca escrito. */
export function textoDoMesSemMensalidade(mesAAAAMM) {
  const [, me] = String(mesAAAAMM || '').split('-').map(Number);
  const nome = MESES[me - 1];
  return nome
    ? `Sem a assinatura, a mensalidade de ${nome} não é gerada.`
    : 'Sem a assinatura, a mensalidade não é gerada.';
}
export const SUSTENTA_DO_MES_SEM_MENSALIDADE = 'mensalidade-respeita-vigencia';

export const ESPERANDO = {
  texto: 'Esperando a família assinar',
  sustenta: 'contrato-novo-no-app-da-familia',
};

export const SEM_ACEITE = {
  texto: 'O primeiro contrato ainda não foi assinado',
  sustenta: 'primeiro-contrato-espera-aceite',
};
export const VER_CONTRATO = 'Ver contrato';

/** A nota de baixo, só quando há criança sem a família no app. */
export const SEM_FAMILIA = {
  texto: 'A família que não está no app precisa entrar para assinar. Mande o convite antes.',
  sustenta: 'aceite-pela-conta-da-familia',
};

export const NADA_PARA_RENOVAR = {
  texto: 'Nenhum contrato para renovar agora.',
  sustenta: 'mensalidade-respeita-vigencia',
};

/** O aviso depois do toque. */
export function textoDoEnviado(nomeDaCrianca, novoFimISO) {
  const n = primeiroNome(nomeDaCrianca);
  const quem = n ? `à família de ${n}` : 'à família';
  return `Contrato novo enviado ${quem}. Quando ela assinar, vale até ${dataBR(novoFimISO)}.`;
}
export const SUSTENTA_DO_ENVIADO = 'contrato-novo-no-app-da-familia';

/** A porta na tela "Turma e contratos". */
export function textoDaPorta(n) {
  return n === 1 ? '1 contrato acabando' : `${n} contratos acabando`;
}

/** Todas as afirmações com a sua origem, para o teste varrer. */
export function todasAsAfirmacoes() {
  return [
    { id: 'comoFunciona', ...COMO_FUNCIONA },
    { id: 'mesSemMensalidade', texto: textoDoMesSemMensalidade('2027-01'), sustenta: SUSTENTA_DO_MES_SEM_MENSALIDADE },
    { id: 'esperando', ...ESPERANDO },
    { id: 'semAceite', ...SEM_ACEITE },
    { id: 'semFamilia', ...SEM_FAMILIA },
    { id: 'nada', ...NADA_PARA_RENOVAR },
    { id: 'enviadoComNome', texto: textoDoEnviado('Ana Clara', '2027-12-31'), sustenta: SUSTENTA_DO_ENVIADO },
    { id: 'enviadoSemNome', texto: textoDoEnviado('', '2027-12-31'), sustenta: SUSTENTA_DO_ENVIADO },
  ];
}
