/**
 * OS MODELOS DE CONTRATO QUE O DONO LÊ NA ABA JURÍDICO (05/10/2026).
 *
 * Os dois contratos só se liam depois de emitidos, na ficha de alguém. O dono
 * que vai ao advogado precisa do texto VIGENTE sem fingir uma assinatura.
 *
 * ⚠️ O de assinatura passa pela MESMA régua que emite o contrato
 * (`montarContrato`): um modelo escrito à mão envelhece no dia em que a versão
 * sobe e passa a mostrar um documento que o app não emite. Aqui só entram as
 * PARTES fictícias (CPF 000.000.000-00).
 *
 * ⚠️ Nada daqui é aceite, hash ou gravação.
 */
import { montarContrato, VERSAO_CONTRATO } from './contratoAssociacao.js';
import { PLANO } from './planos.js';
import { VERSAO_DO_TEXTO, dataBR, parcelasDaVigencia } from '../cobranca/contratoDaFamilia.js';

export const ROTULO_DO_MODELO = 'MODELO — dados fictícios';

// Data fixa: o modelo não deve mudar a cada abertura, e a régua recebe o
// "agora" por parâmetro.
const DATA_DO_MODELO = new Date('2026-01-15T12:00:00-03:00');

/** Contrato de Assinatura (motorista e plataforma), no formato emitido. */
export function modeloDoContratoDeAssinatura(agora = DATA_DO_MODELO) {
  return montarContrato({
    motorista: {
      uid: 'modelo',
      name: 'Fulano de Tal',
      documentoDaAssinatura: '000.000.000-00',
      city: 'Cidade Exemplo',
      email: 'fulano@exemplo.com',
      phone: '(00) 00000-0000',
    },
    plano: PLANO.MENSAL,
    criancas: 12,
    descontos: [],
    diaVencimento: 10,
    agora,
  });
}

/**
 * Contrato com a família, no formato que `buildContractData` grava.
 *
 * ⚠️ Montado aqui e não chamando `buildContractData`: aquele mora em
 * `services/` (import sem extensão, que o Node não carrega) e domínio não
 * importa service. Se o formato mudar lá, o ContractView do modelo quebra à
 * vista na aba.
 */
export function modeloDoContratoDaFamilia() {
  const inicio = '2026-02-01';
  const fim = '2026-12-31';
  return {
    version: 2,
    ...(VERSAO_DO_TEXTO > 1 ? { versaoDoTexto: VERSAO_DO_TEXTO } : {}),
    issuedAt: '2026-01-15T15:00:00.000Z',
    contractedYear: 2026,
    company: {
      name: 'Fulano de Tal',
      document: '000.000.000-00',
      address: 'Rua Exemplo, 1, Cidade Exemplo',
      city: 'Cidade Exemplo',
      representative: 'Fulano de Tal',
      phone: '00000000000',
      email: 'fulano@exemplo.com',
    },
    parent: {
      name: 'Beltrana de Tal',
      email: 'beltrana@exemplo.com',
      phone: '00000000000',
      address: 'Rua Exemplo, 123, Bairro Exemplo, Cidade Exemplo',
    },
    student: {
      name: 'Criança Exemplo',
      homeAddress: 'Rua Exemplo, 123, Bairro Exemplo, Cidade Exemplo',
      school: 'Escola Exemplo',
      schoolAddress: 'Avenida Exemplo, 456, Cidade Exemplo',
    },
    finance: { monthlyFee: 300, dueDay: 10, installments: parcelasDaVigencia(inicio, fim) },
    period: { startDate: dataBR(inicio), endDate: dataBR(fim), inicio, fim, year: 2026 },
    inviteCode: 'MODELO00',
    childId: 'modelo',
  };
}

export function tituloDoModelo(versao) {
  return `Modelo vigente — versão ${versao}`;
}

export { VERSAO_CONTRATO, VERSAO_DO_TEXTO };
