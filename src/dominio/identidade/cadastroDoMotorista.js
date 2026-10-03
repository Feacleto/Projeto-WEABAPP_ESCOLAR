/**
 * O CADASTRO DO MOTORISTA ESTÁ COMPLETO? — regra pura.
 *
 * Desde 11/09/2026 a conta nasce magra (e-mail, WhatsApp e senha — ou só o
 * e-mail, quando ela vem do Google) e o resto é pedido do lado de dentro, num
 * card por cima do app. Alguém precisa dizer o que ainda falta — e esse
 * alguém é uma função pura, porque ela decide um DESVIO: errar aqui ou prende
 * quem já preencheu, ou deixa passar quem não preencheu.
 *
 * ── O CARD PERGUNTA SÓ O QUE FALTA (02/10/2026)
 * Era uma tela cheia com seis campos, a mesma para todo mundo. Quem vinha do
 * Google passava antes por `/quero-fazer-parte` e digitava de novo o e-mail
 * que o Google tinha acabado de confirmar, mais uma senha que o serviço
 * descartava. Agora são TRÊS PASSOS, e cada um só aparece se algum campo dele
 * estiver vazio: quem criou com e-mail já deu o WhatsApp e não o vê de novo.
 *
 * ── ⚠️ A CIDADE CONTINUA OBRIGATÓRIA, E SÓ DEIXOU DE SER DIGITADA
 * `name` e `city` viram a PARTE em `contratoAssociacao.js` (e `city` alimenta
 * o BR Code do PIX). O dono pediu para não perguntar cidade nem bairro: eles
 * saem da permissão de localização, no último passo, e só os NOMES são
 * gravados. Quem nega a permissão digita a cidade — sem ela o contrato nasce
 * com a parte incompleta, e documento assinado sem quem assinou não é
 * documento.
 *
 * ── ⚠️ `regiao` SAIU DA TRAVA, e não do cadastro
 * Ela vem junto da cidade quando a localização responde, e é o que o dono
 * usa para saber onde ele roda. Mas o endereço reverso nem sempre traz
 * bairro (zona rural, cidade pequena), e travar o app por um dado que o
 * próprio geocodificador não tem seria prender alguém sem saída.
 *
 * ── `marcaNome` ENTROU NA TRAVA, `criancasEstimadas` SAIU DO CARD
 * A marca é o cabeçalho do `/tio` e do `/pai`, e o dono decidiu que não há
 * "fazer depois". O número de crianças sai porque o real aparece sozinho
 * quando ele cadastra a turma — estimativa ao lado do número verdadeiro é
 * uma segunda verdade.
 *
 * ── ⚠️ E "AUSENTE" NÃO É "VAZIO"
 * `inscreverAssociado` OMITE os campos que não foram perguntados. Esta função
 * trata os dois do mesmo jeito, e a omissão é o que mantém a intenção legível
 * no banco para quem for ler depois.
 */

import { ufDoIso } from '../../compartilhado/ruas.js';

/** Os três passos do card, na ordem em que aparecem. */
export const PASSOS = [
  { id: 'voce', campos: ['name', 'phone'] },
  { id: 'marca', campos: ['marcaNome'] },
  { id: 'local', campos: ['city'] },
];

/** Os campos que travam a entrada — a união dos passos. */
export const CAMPOS_OBRIGATORIOS = PASSOS.flatMap((p) => p.campos);

function vazio(v) {
  return !String(v || '').trim();
}

/** Os campos de um passo que ainda estão vazios no perfil. */
export function camposQueFaltam(profile, passoId) {
  const passo = PASSOS.find((p) => p.id === passoId);
  if (!passo) return [];
  return passo.campos.filter((campo) => vazio(profile?.[campo]));
}

/**
 * Os passos que o card ainda precisa mostrar, na ordem.
 *
 * Lista vazia para quem não é motorista e para perfil ausente — quem decide
 * o desvio não pode desviar a mãe, nem quem ainda está carregando.
 */
export function passosQueFaltam(profile) {
  if (!profile || profile.role !== 'admin') return [];
  return PASSOS.filter((p) => camposQueFaltam(profile, p.id).length > 0).map(
    (p) => p.id
  );
}

/** `true` quando o motorista ainda deve algum passo do primeiro acesso. */
export function faltaCompletarCadastro(profile) {
  return passosQueFaltam(profile).length > 0;
}

/**
 * Cidade e bairro a partir do `address` do endereço reverso do Nominatim.
 *
 * O formato varia com o lugar: capital vem em `city`, cidade pequena em
 * `town` ou `village`, e o bairro pode estar em `suburb`, `neighbourhood`,
 * `city_district` ou `quarter`. A ordem abaixo vai do mais preciso para o
 * mais amplo. Devolve strings vazias quando não acha — quem chama decide se
 * pede para digitar.
 */
export function lugarDoEndereco(address) {
  const a = address || {};
  const primeiro = (...chaves) =>
    chaves.map((k) => String(a[k] || '').trim()).find(Boolean) || '';
  return {
    city: primeiro('city', 'town', 'municipality', 'village'),
    regiao: primeiro('suburb', 'neighbourhood', 'city_district', 'quarter'),
    // A UF vem no código ISO ("BR-SP"). É ela que deixa a busca de rua pelo
    // nome (ViaCEP) começar na cidade dele sem perguntar nada.
    uf: ufDoIso(a['ISO3166-2-lvl4']),
  };
}
