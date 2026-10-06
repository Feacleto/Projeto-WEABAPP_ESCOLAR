/**
 * A ABA ESG E OS MODELOS DE CONTRATO DO PAINEL DO DONO.
 *
 * O QUE ELE TRAVA
 *   1. as contas do ESG (crianças por perua, carros a menos) e o "null, nunca
 *      zero" quando a base não veio;
 *   2. a contagem do registro (só contagens; suspensão sem motivo não conta);
 *   3. nenhum texto da régua usa as raízes "seguro" / "seguran";
 *   4. os modelos de contrato: versão vigente, partes fictícias e o formato
 *      do documento emitido.
 *
 * COMO RODAR
 *   node scripts/testar-esg-do-painel.mjs
 */
import {
  carrosAMenos,
  contagemDoRegistro,
  criancasPorPerua,
  textosDaRegua,
} from '../src/dominio/associacao/esgDoPainel.js';
import {
  modeloDoContratoDaFamilia,
  modeloDoContratoDeAssinatura,
  tituloDoModelo,
  ROTULO_DO_MODELO,
  VERSAO_CONTRATO,
  VERSAO_DO_TEXTO,
} from '../src/dominio/associacao/modelosDeContrato.js';

let ok = 0;
let falhas = 0;
function caso(nome, cond) {
  if (cond) ok++;
  else {
    falhas++;
    console.error('FALHOU:', nome);
  }
}

// 1. contas
caso('perua: 30 crianças, 10 motoristas = 3', criancasPorPerua({ criancasAtivas: 30, rodaram: 10 }) === 3);
caso('perua: arredonda a 1 casa', criancasPorPerua({ criancasAtivas: 10, rodaram: 3 }) === 3.3);
caso('perua: ninguém rodou = null, não zero', criancasPorPerua({ criancasAtivas: 30, rodaram: 0 }) === null);
caso('perua: contagem que falhou = null', criancasPorPerua({ criancasAtivas: null, rodaram: 5 }) === null);
caso('perua: sem argumento = null', criancasPorPerua() === null);
caso('carros: 30 - 10 = 20', carrosAMenos({ criancasAtivas: 30, rodaram: 10 }) === 20);
caso('carros: nunca negativo', carrosAMenos({ criancasAtivas: 2, rodaram: 5 }) === 0);
caso('carros: null quando não veio', carrosAMenos({ criancasAtivas: null, rodaram: 5 }) === null);

// 2. registro
const reg = contagemDoRegistro([
  { acao: 'suspender', motivo: 'fraude' },
  { acao: 'suspender', motivo: '  ' },
  { acao: 'aviso', motivo: 'x' },
  { acao: 'reativar', motivo: 'y' },
]);
caso('registro: 4 ações', reg.acoes === 4);
caso('registro: 1 suspensão com motivo', reg.suspensoesComMotivo === 1);
caso('registro: leitura que falhou = null', contagemDoRegistro(null).acoes === null);
caso('registro: lista vazia = zero real', contagemDoRegistro([]).acoes === 0);

// 3. vocabulário proibido
const textos = textosDaRegua();
caso('régua tem textos', textos.length >= 5);
const proibido = /seguro|seguran/i;
for (const t of textos) caso(`sem raiz proibida: ${t.slice(0, 30)}`, !proibido.test(t));
caso('sonda: detecta "seguro"', proibido.test('é seguro'));
caso('sonda: detecta "segurança"', proibido.test('com segurança'));
caso('rodapé diz a conta que explica', textos.some((t) => t.includes('conta que o explica')));

// 4. modelos
const a = modeloDoContratoDeAssinatura();
caso('assinatura: versão vigente', a.versao === VERSAO_CONTRATO);
caso(
  'assinatura: parte fictícia',
  a.assinante.nome === 'Fulano de Tal' && a.assinante.documento === '000.000.000-00'
);
caso('assinatura: valor mensal numérico', typeof a.valores.valorMensal === 'number');
caso('assinatura: determinístico', JSON.stringify(a) === JSON.stringify(modeloDoContratoDeAssinatura()));
const f = modeloDoContratoDaFamilia();
caso('família: gerado (não null)', f !== null);
caso('família: texto vigente', (f?.versaoDoTexto ?? 1) === VERSAO_DO_TEXTO);
caso(
  'família: parte fictícia',
  f?.company.document === '000.000.000-00' && f?.parent.name === 'Beltrana de Tal'
);
caso('família: parcelas de fev a dez = 11', f?.finance.installments === 11);
caso('título do modelo', tituloDoModelo(8) === 'Modelo vigente — versão 8');
caso('rótulo diz fictício', ROTULO_DO_MODELO.includes('fictícios'));

console.log(`${ok} casos ok, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
