/**
 * Casamento de nomes de escola — a parte PURA da migração.
 *
 * Mora fora de `escolasService` de propósito: aquele arquivo importa o
 * Firestore, e esta lógica é a que precisa de teste. Se ela errar, o aviso de
 * "não vai ter aula" alcança metade da turma e a outra metade manda a criança
 * pro portão fechado.
 */

/**
 * Reduz o nome ao que ele tem de identidade, pra comparar grafias diferentes
 * da mesma escola.
 *
 * A pontuação é REMOVIDA, não virada em espaço. Trocar por espaço parecia mais
 * seguro e falhava justamente no caso mais comum: "E.M. Rui Barbosa" virava
 * "e m rui barbosa" e não casava com "EM Rui Barbosa". Que é a grafia que o
 * motorista alterna sem perceber, uma criança por vez.
 */
export function chaveDoNome(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Agrupa os nomes de escola que as crianças já têm, pra tela poder oferecer
 * "encontrei 3 escolas nos seus cadastros — confirma?".
 *
 * PROPÕE, não cria. Dois nomes parecidos podem ser mesmo duas escolas, e
 * juntar sozinho misturaria as famílias de duas escolas no aviso em massa —
 * exatamente o problema que a migração existe pra resolver.
 *
 * Retorna [{ chave, nome, endereco, lat, lng, criancas, variacoes }],
 * do grupo maior pro menor.
 */
export function proporEscolasDasCriancas(children) {
  const grupos = new Map();

  for (const c of children || []) {
    if (c?.active === false) continue;
    if (c?.schoolId) continue; // já migrada
    const nome = c?.school?.trim();
    if (!nome) continue;
    const chave = chaveDoNome(nome);
    if (!chave) continue;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        nome,
        endereco: c.schoolAddress || '',
        lat: c.schoolLat ?? null,
        lng: c.schoolLng ?? null,
        criancas: [],
        variacoes: new Set(),
      });
    }
    const g = grupos.get(chave);
    g.criancas.push(c);
    g.variacoes.add(nome);

    // Fica com a primeira grafia que TEM coordenada: é a que o motorista
    // chegou a geocodificar, então é a que ele conferiu no mapa.
    if (g.lat == null && c.schoolLat != null) {
      g.lat = c.schoolLat;
      g.lng = c.schoolLng;
      g.endereco = c.schoolAddress || g.endereco;
      g.nome = nome;
    }
  }

  return [...grupos.values()]
    .map((g) => ({ ...g, variacoes: [...g.variacoes].sort() }))
    .sort((a, b) => b.criancas.length - a.criancas.length);
}
