// `formatBRL` mora em `compartilhado/formatters.js`. Ele nao precisa de Firestore,
// e cinco componentes importavam ESTE service so pra formatar moeda.
import { formatBRL } from '../compartilhado/formatters';
import {
  vigenciaDaCrianca,
  parcelasDaVigencia,
  dataBR,
  VERSAO_DO_TEXTO,
} from '../dominio/cobranca/contratoDaFamilia.js';

export { formatBRL };

/**
 * Contrato de prestação de serviço de transporte escolar.
 *
 * - Conteúdo gerado a partir dos dados de admin (CONTRATADA) + child/parent
 *   (CONTRATANTE). Versionado via `CONTRACT_VERSION` pra evolução.
 * - `buildContractData` monta o TEXTO de uma versão. Quem grava a versão é
 *   `contratosDaFamiliaService`, e quem registra o aceite é o servidor.
 * - Sem os dados da parte contratada, não há contrato (ver abaixo).
 */

// 2 (02/10/2026): a vigência passou a ser a do motorista, e as parcelas, as
// que cabem nela (antes: sempre 01/01–31/12 e 12 parcelas). Fica gravada em
// cada versão (`dados.version`), para saber qual texto ela usou.
export const CONTRACT_VERSION = 2;

/**
 * ⚠️ O PLACEHOLDER FOI REMOVIDO EM 06/09/2026, e ele era um problema jurídico.
 *
 * Havia três valores fictícios de reserva — `'Tio Nino Transporte Escolar'`,
 * CNPJ `'00.000.000/0000-00'` e `'São Paulo - SP'` — usados sempre que o
 * motorista não tinha preenchido o perfil. O comentário justificava: "pra
 * preservar a alta fidelidade visual do MVP".
 *
 * O efeito real: todo motorista que cadastrava a primeira criança antes de
 * preencher o perfil fazia o responsável DIGITAR O NOME COMPLETO, marcar "li e
 * aceito todas as cláusulas" e gravar hash SHA-256, data e user agent — sobre
 * um contrato cuja CONTRATADA era uma empresa que não existe, com CNPJ zerado.
 *
 * Fidelidade visual num documento com valor probatório declarado é a única
 * coisa que ele não podia ter.
 *
 * Agora a função devolve `null` quando falta o dado da parte contratada, e
 * quem chama mostra o que falta em vez de inventar. Contrato sem parte não é
 * contrato — e um documento assinado com parte inventada é pior que nenhum.
 */
export function dadosDaContratadaFaltando(admin) {
  const faltando = [];
  if (!admin?.companyName?.trim()) faltando.push('nome');
  if (!admin?.companyDocument?.trim()) faltando.push('CPF ou CNPJ');
  if (!admin?.companyAddress?.trim()) faltando.push('cidade');
  return faltando;
}

/**
 * `versaoDoTexto`: qual redação das cláusulas este documento usa (ver
 * `VERSAO_DO_TEXTO` em `contratoDaFamilia.js`). Toda versão EMITIDA sai na
 * atual. O único que pede outra é a tela do aceite ANTIGO (anterior às
 * versões gravadas, só `contractAcceptedAt`), que remonta o documento dos
 * campos: ela pede o texto 1, que é o que aquela família leu ao aceitar.
 */
export function buildContractData({ child, admin, versaoDoTexto = VERSAO_DO_TEXTO }) {
  // Sem a parte contratada identificada, não há documento a montar.
  if (dadosDaContratadaFaltando(admin).length > 0) return null;

  const today = new Date();
  const monthlyFee = Number(child?.monthlyFee) || 0;
  const dueDay = Number(child?.dueDay) || 10;
  // A VIGÊNCIA É DO MOTORISTA (02/10/2026). Era sempre 01/01–31/12 do ano
  // corrente com 12 parcelas — quem entrava em outubro assinava doze parcelas
  // de um ano com três meses. `vigenciaDaCrianca` devolve a padrão para a
  // criança cadastrada antes do campo existir.
  const vig = vigenciaDaCrianca(child, today);
  const year = Number(vig.inicio.slice(0, 4));

  return {
    version: CONTRACT_VERSION,
    // DENTRO de `dados`, então entra no hash do aceite e no `mesmoConteudo`.
    // O texto 1 é gravado como AUSENTE, igual ao que já existe no banco:
    // gravar `1` faria o documento remontado diferir do original.
    ...(versaoDoTexto > 1 ? { versaoDoTexto } : {}),
    issuedAt: today.toISOString(),
    contractedYear: year,

    // CONTRATADA — o motorista, com os dados que ELE preencheu.
    company: {
      name: admin.companyName.trim(),
      document: admin.companyDocument.trim(),
      address: admin.companyAddress.trim(),
      // A CIDADE do local de assinatura. O contrato pegava o primeiro pedaço
      // do endereço e escrevia "Rua das Palmeiras, 02 de outubro" (teste no
      // navegador, 02/10/2026); a cidade ele já deu no primeiro acesso.
      city: admin?.city?.trim() || '',
      representative: admin?.name?.trim() || 'Representante legal',
      phone: admin?.phone || '',
      email: admin?.email || '',
    },

    // CONTRATANTE — Responsável
    parent: {
      name: child?.parentName?.trim() || '',
      // O e-mail com que a família ENTROU vence o digitado no cadastro antigo.
      email: child?.linkedEmail?.trim() || child?.parentEmail?.trim() || '',
      phone: child?.parentPhone || '',
      address: child?.address?.trim() || '',
    },

    // ALUNO
    student: {
      name: child?.name?.trim() || '',
      homeAddress: child?.address?.trim() || '',
      school: child?.school?.trim() || '',
      schoolAddress: child?.schoolAddress?.trim() || '',
    },

    // FINANCEIRO
    finance: {
      monthlyFee, // numérico — formatamos na renderização
      dueDay,     // dia do mês 1-28
      // Uma parcela por mês que a vigência toca, INCLUINDO férias (regra
      // explícita da cláusula 7ª).
      installments: parcelasDaVigencia(vig.inicio, vig.fim),
    },

    // VIGÊNCIA — o texto lê as datas brasileiras; a régua, as ISO.
    period: {
      startDate: dataBR(vig.inicio),
      endDate: dataBR(vig.fim),
      inicio: vig.inicio,
      fim: vig.fim,
      year,
    },

    // META
    inviteCode: child?.inviteCode || '',
    childId: child?.id || '',
  };
}

/*
 * O ACEITE SAIU DESTE ARQUIVO EM 02/10/2026. `acceptContract`,
 * `computeContractHash` e `hasAcceptedContract` gravavam e conferiam o aceite
 * pelo celular da família, com um hash de um contrato remontado na hora (com
 * a hora da abertura dentro) — que nunca podia ser conferido. Agora cada
 * versão é gravada (`contratosDaFamiliaService`) e o aceite e o hash são do
 * servidor (`functions/lib/aceitarContrato.js`). O estado do contrato é
 * `estadoDoContrato`, em `dominio/cobranca/contratoDaFamilia.js`.
 */
