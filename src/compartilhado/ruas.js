/**
 * A BUSCA DE RUA PELO NOME — a parte pura (02/10/2026).
 *
 * O motorista quase nunca sabe o CEP da escola, e às vezes nem o da casa.
 * Ele sabe o NOME DA RUA. O ViaCEP faz a busca ao contrário — estado, cidade
 * e um pedaço do nome da rua — e devolve as ruas com bairro e CEP. Grátis e
 * sem chave, como a consulta por CEP que já usávamos.
 *
 * ⚠️ NÃO É O NOMINATIM: a política de uso dele proíbe autocompletar enquanto
 * a pessoa digita. Ele continua sendo chamado UMA vez, depois da escolha,
 * para achar o ponto no mapa.
 *
 * Este arquivo não busca nada — lê a resposta. Quem busca é o
 * `locationService.buscarRuas`, e a tela é `components/endereco/BuscaDeRua`.
 */

/** As 27 unidades da federação, para quem não tem a UF gravada no perfil. */
export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

/** O ViaCEP só busca com cidade e rua de 3 letras ou mais. */
export const MINIMO_DA_BUSCA = 3;

/** Dá para buscar? Evita chamada que o ViaCEP responderia com erro. */
export function podeBuscarRua({ uf, cidade, rua }) {
  return (
    UFS.includes(String(uf || '').toUpperCase()) &&
    String(cidade || '').trim().length >= MINIMO_DA_BUSCA &&
    String(rua || '').trim().length >= MINIMO_DA_BUSCA
  );
}

/**
 * A resposta do ViaCEP vira a lista que a tela mostra.
 *
 * Avenida longa tem um CEP por FAIXA de número, e o ViaCEP devolve uma linha
 * por faixa — com o trecho em `complemento` ("de 1001 ao fim - lado ímpar").
 * Ele vira `faixa`, para o motorista escolher a mais provável. Resposta que
 * não é lista (o `{ erro: true }` dele) vira lista vazia.
 */
export function sugestoesDeRua(resposta, limite = 8) {
  if (!Array.isArray(resposta)) return [];
  const vistas = new Set();
  const lista = [];
  for (const r of resposta) {
    if (!r || !r.cep || !r.logradouro) continue;
    if (vistas.has(r.cep)) continue;
    vistas.add(r.cep);
    lista.push({
      cep: String(r.cep),
      logradouro: String(r.logradouro || '').trim(),
      bairro: String(r.bairro || '').trim(),
      localidade: String(r.localidade || '').trim(),
      uf: String(r.uf || '').trim(),
      faixa: String(r.complemento || '').trim(),
    });
    if (lista.length >= limite) break;
  }
  return lista;
}

/** A UF a partir do código ISO do endereço reverso ("BR-SP" → "SP"). */
export function ufDoIso(iso) {
  const uf = String(iso || '').toUpperCase().replace(/^BR-/, '');
  return UFS.includes(uf) ? uf : '';
}
