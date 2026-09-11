import {
  collection,
  addDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  getDateKey,
  normalizaHora,
  emMinutos,
  CAMPO_DA_DIRECAO,
} from '../dominio/rota/horarios';
import { playSound } from './soundService';
import { getEffectiveStatus } from './childrenService';
import { ABSENCE_TYPES } from './absencesService';
import { anotarMarco } from './ridesService';

/**
 * Máquina de status da criança na rota.
 *
 * Estava dentro do KanbanCard, que era o ÚNICO lugar do app capaz de mudar
 * o status de uma criança. Trazer pra cá foi pré-requisito das telas novas
 * de rota — sem isso, cada interface nova reimplementaria as transições.
 *
 * Fluxo por direção do turno:
 *   ida   (pickup):  home → onboard → atSchool
 *   volta (dropoff): atSchool → onboard → delivered
 */

export const STATUS_CYCLE = ['home', 'onboard', 'atSchool', 'delivered'];

/**
 * Decide qual ação mostrar baseado no status efetivo + direção do turno.
 * Retorna { label, shortLabel, nextStatus, variant } ou null quando não há
 * ação possível naquele turno.
 */
export function getActionForStatus(status, direction) {
  if (direction === 'pickup') {
    if (status === 'home') {
      return {
        label: 'Embarcar',
        shortLabel: 'EMBARQUEI',
        nextStatus: 'onboard',
        variant: 'primary',
      };
    }
    if (status === 'onboard') {
      return {
        label: 'Entregar na escola',
        shortLabel: 'ENTREGUEI NA ESCOLA',
        nextStatus: 'atSchool',
        variant: 'success',
      };
    }
    return null; // atSchool ou delivered: nada a fazer na ida
  }
  // dropoff
  if (status === 'atSchool') {
    return {
      label: 'Embarcar pra casa',
      shortLabel: 'EMBARQUEI',
      nextStatus: 'onboard',
      variant: 'primary',
    };
  }
  if (status === 'onboard') {
    return {
      label: 'Entregar em casa',
      shortLabel: 'ENTREGUEI',
      nextStatus: 'delivered',
      variant: 'success',
    };
  }
  return null;
}

/**
 * Avança UMA criança pro próximo status.
 * Mantido separado do batch pra continuar tocando o som de feedback.
 */
/**
 * ⚠️ A MARCAÇÃO NÃO GUARDA MAIS NADA SOBRE ONDE ELE ESTAVA — nem coordenada,
 * nem distância. Aqui existia `checkpointFrom`, e ela morreu em duas etapas.
 *
 * ── O QUE ELA FAZIA
 * A cada mudança de status ela gravava, em `children.lastStatusCheckpoint` e
 * em `rides/{dia}.checkpoints`, onde o veículo do motorista estava naquele
 * segundo. A justificativa era conferir depois: "ele estava longe da casa
 * quando marcou entregue?".
 *
 * ── POR QUE SAIU
 * Primeiro saíram `lat` e `lng` (10/09/2026): `children` é lido pela
 * RESPONSÁVEL, e um registro por criança por dia deixa o trajeto do carro de
 * um autônomo reconstruível por terceiros — a mesma coisa que `/acompanhar`
 * recusa fazer. Sobrou a distância, que confere sem dizer onde.
 *
 * Depois saiu a distância também, por decisão do dono (11/09/2026): **o app
 * registra que entregou e a que horas, e nada sobre onde.** O registro do dia
 * é o marco com a hora, e só.
 *
 * ── O QUE SE PERDEU, DITO POR INTEIRO
 * O único sinal que denunciaria alguém usando o botão de "marcar todos" longe
 * das casas. Ele **nunca foi lido por tela nenhuma** — existia no banco e
 * ninguém olhava —, então na prática não se perdeu uma conferência que era
 * feita, e sim uma que poderia um dia ser feita.
 *
 * ⚠️ E SE ELA VOLTAR, VOLTA COMO AVISO, NUNCA COMO REGISTRO: "você está a
 * 5 km da casa do Lucas. Marcar mesmo?", na hora, sem gravar nada. Pega o
 * erro antes de ele acontecer, que é melhor que guardar prova dele.
 */

/**
 * Avança UMA criança pro próximo status.
 *
 * `context` é opcional: { dateKey, adminUid, parentUid, combinado }. Ele
 * NÃO carrega mais posição — ver o bloco acima.
 */
export async function advanceChild(childId, nextStatus, context = null) {
  if (!childId || !nextStatus) return;

  const updates = {
    status: nextStatus,
    statusUpdatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.update(doc(db, 'children', childId), updates);

  // O marco vai no MESMO batch. Escrita separada poderia deixar "entregue" sem
  // a hora da entrega — e a hora que falta é justamente a que alguém procura.
  if (context?.dateKey) {
    anotarMarco(batch, {
      childId,
      dateKey: context.dateKey,
      status: nextStatus,
      contexto: {
        adminUid: context.adminUid,
        parentUid: context.parentUid,
      },
    });
  }

  await batch.commit();

  await avisarChegadas([
    {
      parentUid: context?.parentUid,
      childId,
      childName: context?.childName,
      status: nextStatus,
    },
  ]);

  /* E QUEM VEM DEPOIS FICA SABENDO QUE É A VEZ DELA. Só nos dois marcos que
     movem a fila: embarcar avança a ida, entregar avança a volta. `atSchool`
     não move ninguém — é o meio do caminho da mesma criança. */
  if (context?.adminUid && (nextStatus === 'onboard' || nextStatus === 'delivered')) {
    avisarProximo({
      adminUid: context.adminUid,
      direcao: nextStatus === 'onboard' ? 'ida' : 'volta',
    });
  }

  playSound('status_change');
}

/**
 * Avança VÁRIAS crianças de uma vez — "embarquei todos", "cheguei na escola".
 *
 * Uma parada é um evento, não vinte: marcar criança por criança custava mais
 * de quarenta toques precisos com vinte crianças, em veículo em movimento.
 *
 * Recebe uma lista de { childId, nextStatus } pra que crianças em estados
 * diferentes possam avançar no mesmo lote. Ignora entradas sem nextStatus
 * (criança que já não tem ação naquele turno).
 *
 * Firestore aceita 500 operações por batch, mas o limite que morde aqui é
 * outro: 20 `get()` por requisição. Ver o CHUNK abaixo.
 */
export async function advanceMany(moves, context = null) {
  const valid = (moves || []).filter((m) => m?.childId && m?.nextStatus);
  if (!valid.length) return 0;

  // 15, E O TETO AQUI NÃO É O DE 500 OPERAÇÕES — É O DE 20 `get()`.
  //
  // A regra de `children/{id}/rides/{dia}` resolve a permissão com um
  // `get()` no doc da criança. Cada documento do lote aponta pra uma criança
  // DIFERENTE, então nada cacheia, e o Firestore corta em 20 acessos por
  // requisição de batch — não por operação.
  //
  // Medido no emulador (scripts/testar-regras.mjs trava isso): 18 crianças
  // passa, 19 devolve 403. E batch é atômico: nada salva. Uma perua escolar
  // leva 15 a 20 crianças, então o lote inteiro do "embarquei todos" caía
  // exatamente na faixa de uso normal — e o erro morria num console.error,
  // sem ninguém no app perceber.
  //
  // 15 deixa folga pros acessos que a própria regra faz por fora (users/{uid})
  // e pra regra ganhar mais um `get()` sem quebrar de novo em produção.
  const CHUNK = 15;
  for (let i = 0; i < valid.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const m of valid.slice(i, i + CHUNK)) {
      const updates = {
        status: m.nextStatus,
        statusUpdatedAt: serverTimestamp(),
      };

      // ⚠️ ESTE É O CAMINHO QUE MAIS PEDIA UM ANTI-ERRO, e hoje ele não tem
      // nenhum. O botão de lote marca VINTE crianças como entregues em casa
      // de uma vez; se for apertado cedo demais, vinte famílias leem "chegou"
      // com o filho ainda na perua. A distância por criança denunciava isso —
      // e saiu com a marcação inteira, por decisão do dono (ver o bloco no
      // topo do arquivo).
      //
      // Quando voltar, volta como AVISO na hora ("as três últimas estão a
      // mais de 3 km — marcar mesmo?"), não como registro guardado.
      batch.update(doc(db, 'children', m.childId), updates);

      if (context?.dateKey) {
        anotarMarco(batch, {
          childId: m.childId,
          dateKey: context.dateKey,
          status: m.nextStatus,
          contexto: {
            adminUid: context.adminUid,
            parentUid: m.parentUid,
          },
        });
      }
    }
    await batch.commit();
  }

  await avisarChegadas(
    valid.map((m) => ({
      parentUid: m.parentUid,
      childId: m.childId,
      childName: m.childName,
      status: m.nextStatus,
    }))
  );

  // Som PRÓPRIO do lote, e não o mesmo do toque individual.
  //
  // Marcar cinco de uma vez soava exatamente igual a marcar uma. Com o
  // veículo em movimento ele não tinha como distinguir "peguei a Ana" de
  // "peguei todas" sem conferir a lista — e conferir lista dirigindo é o que
  // esta tela existe pra evitar.
  playSound('lote');
  return valid.length;
}

/**
 * AVISA O RESPONSÁVEL QUE A CRIANÇA CHEGOU.
 *
 * POR QUE FALTAVA, E POR QUE DÓI
 * O app avisava bem sobre dinheiro, falta e recado — e era mudo justamente
 * sobre a criança. O tracker mostrava "na escola" e "voltou", mas só pra quem
 * estivesse com o app ABERTO. Quem está no trabalho não tinha como saber que o
 * filho chegou sem parar o que estava fazendo e abrir o app.
 *
 * Escrever em `notifications` já vira push: a Cloud Function
 * `sendPushOnNotification` dispara em qualquer documento criado ali.
 *
 * SÓ AS DUAS CHEGADAS, E NÃO OS QUATRO PASSOS
 * Embarcou na ida, chegou na escola, embarcou na volta, chegou em casa — quatro
 * pushes por dia por criança é o caminho mais curto pra ele desligar as
 * notificações do app, levando junto o aviso de falta e o de pagamento. As
 * chegadas são as que respondem a pergunta que ele tem de verdade.
 *
 * FORA DO BATCH, E ISSO NÃO É DESCUIDO
 * A tentação é gravar junto com o status, pelo mesmo motivo do marco da
 * viagem: atomicidade. Mas a regra de `notifications` resolve o destinatário
 * com um `get()` em `users/{userId}` — um documento DIFERENTE por família.
 * Somado ao `get()` que a regra de `rides` já faz, o lote de "embarquei todos"
 * passaria do teto de 20 acessos por requisição, voltaria 403, e o batch é
 * atômico: NADA salvaria, com as crianças já embarcadas de verdade. É o mesmo
 * buraco que o CHUNK de 15 existe pra evitar.
 *
 * Fora do batch a ordem fica até melhor: o status grava primeiro, e o aviso
 * sai depois de ele existir. O preço é que uma falha aqui custa a notificação
 * — e notificação perdida é muito mais barato que marcação perdida.
 */
/**
 * A PERUA SAIU — o único momento do dia em que a família precisa DECIDIR algo.
 *
 * Ela pergunta "já saiu?" porque a resposta muda o que ela faz nos próximos
 * cinco minutos: descer com a criança ou esperar. Até agora ligar o GPS não
 * avisava ninguém — a informação existia (a perua aparecia no mapa) e cabia a
 * ela ficar conferindo.
 *
 * ── ⚠️ UMA VEZ POR DIA, E A TRAVA É LOCAL
 * `startTracking` roda a cada rota: ida e volta são duas. Sem trava, a família
 * receberia "a perua saiu" duas vezes por dia, todo dia — e a segunda não
 * ajuda ninguém, porque na volta ela já está em casa.
 *
 * A marca fica no `localStorage` do celular DELE, e não no documento dele: é
 * um sinal de conveniência, não uma cláusula, e não vale abrir mais um campo
 * gravável em `users` por causa disso. O pior caso de trocar de aparelho é uma
 * família receber o aviso duas vezes num dia.
 *
 * ── ENGOLE O ERRO, como o `avisarChegadas` logo abaixo
 * Isto roda no meio-fio, no gesto que liga o GPS. Nada aqui pode atrasar nem
 * derrubar o início da rota.
 */
const CHAVE_DA_SAIDA = 'ab_aviso_de_saida';

export async function avisarSaidaDaRota(adminUid) {
  if (!adminUid) return 0;
  const hoje = getDateKey();
  try {
    if (localStorage.getItem(CHAVE_DA_SAIDA) === `${adminUid}_${hoje}`) return 0;
  } catch {
    /* sem storage a trava não existe; seguir é melhor que não avisar */
  }

  try {
    const snap = await getDocs(
      query(collection(db, 'children'), where('adminUid', '==', adminUid))
    );
    // Um responsável com dois filhos na mesma perua recebe UM aviso: a perua
    // é uma só, e dois pushes iguais em sequência leem como defeito.
    const paraQuem = new Set();
    snap.docs.forEach((d) => {
      const c = d.data();
      if (c.active === false) return;
      if (c.parentUid) paraQuem.add(c.parentUid);
    });
    if (!paraQuem.size) return 0;

    // ⚠️ A TRAVA DO DIA SÓ É GRAVADA SE ALGUÉM FOI AVISADO DE VERDADE.
    //
    // Antes, cada escrita tinha `.catch(() => {})` — mudo, sem log — e a
    // trava era gravada logo abaixo, incondicionalmente. O cenário: ele toca
    // "iniciar rota" no meio-fio com 3G ruim, as vinte escritas falham, a
    // função devolve 20 e grava a trava. Nenhuma mãe recebe "A perua saiu",
    // nada aparece no console, e a trava de uma-vez-por-dia garante que
    // NENHUMA tentativa posterior daquele dia vai acontecer — nem com o
    // sinal voltando dois minutos depois.
    //
    // `allSettled` em vez de `all` pelo mesmo motivo de sempre: uma família
    // que falha não pode impedir as outras dezenove. O que mudou é que agora
    // contamos quantas passaram, e a trava depende disso.
    const idas = await Promise.allSettled(
      [...paraQuem].map((uid) =>
        addDoc(collection(db, 'notifications'), {
          userId: uid,
          type: 'rota_iniciada',
          title: 'A perua saiu',
          // ⚠️ O CORPO DIZIA O TÍTULO COM OUTRAS PALAVRAS — "O transporte
          // começou a rota agora" não acrescenta nada a "A perua saiu". O
          // corpo do formato carrega o que o título não cabe: aqui, o que ela
          // pode fazer com a informação.
          body: 'A rota começou. Acompanhe pelo mapa.',
          createdAt: serverTimestamp(),
        })
      )
    );

    const avisadas = idas.filter((r) => r.status === 'fulfilled').length;
    const falhas = idas.length - avisadas;
    if (falhas) {
      // Silêncio total era o defeito: sem isto, ninguém nunca saberia.
      console.error(`Falha ao avisar a saída para ${falhas} de ${idas.length} famílias.`);
    }

    // Zero avisadas = nada aconteceu. Não trava o dia, para a próxima
    // tentativa (a rota é ligada mais de uma vez num dia ruim) valer.
    if (avisadas > 0) {
      try {
        localStorage.setItem(CHAVE_DA_SAIDA, `${adminUid}_${hoje}`);
      } catch {
        /* idem */
      }
    }
    return avisadas;
  } catch (err) {
    console.error('Falha ao avisar a saída da rota:', err);
    return 0;
  }
}

/**
 * VOCÊ É O PRÓXIMO — a resposta para "falta muito?".
 *
 * É a pergunta que a família faz todo dia, e a única coisa que respondia era
 * o mapa: ela ficava olhando o pontinho andar. A fila já existe (`horaPega` /
 * `horaEntrega` ordenam o dia inteiro), e um aviso quando ela vira a próxima
 * troca vinte minutos de vigília por dez segundos de leitura.
 *
 * ── ⚠️ UMA VEZ POR CRIANÇA, POR DIA, POR DIREÇÃO
 * O motorista avança de parada em parada, e sem trava a mesma família
 * receberia "você é a próxima" a cada toque dele até chegar nela. A marca é
 * local, no celular dele — mesma escolha do aviso de saída, e pelo mesmo
 * motivo: é conveniência, não cláusula.
 *
 * ── ⚠️ E O "PRÓXIMO" SAI DA HORA COMBINADA, NÃO DA ORDEM DE MARCAÇÃO
 * Ele marca fora de ordem o tempo todo — uma criança desce correndo, outra
 * atrasa, ele inverte duas ruas por causa do trânsito. A ordem das marcações
 * não é a ordem da rua; a hora combinada é a única fila que a família também
 * conhece, porque foi ela que combinou.
 */
const CHAVE_DO_PROXIMO = 'ab_aviso_de_proximo';

export async function avisarProximo({ adminUid, direcao }) {
  if (!adminUid || !direcao) return null;
  const campo = CAMPO_DA_DIRECAO[direcao];
  const esperado = direcao === 'ida' ? 'home' : 'atSchool';

  try {
    const snap = await getDocs(
      query(collection(db, 'children'), where('adminUid', '==', adminUid))
    );

    const fila = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => c.active !== false && c.parentUid && normalizaHora(c[campo]))
      .sort((a, b) => String(a[campo]).localeCompare(String(b[campo])));

    const proximo = fila.find((c) => getEffectiveStatus(c) === esperado);
    if (!proximo) return null;

    const chave = `${proximo.id}_${getDateKey()}_${direcao}`;
    try {
      if (localStorage.getItem(CHAVE_DO_PROXIMO) === chave) return null;
      localStorage.setItem(CHAVE_DO_PROXIMO, chave);
    } catch {
      /* sem storage a trava não existe; avisar é melhor que calar */
    }

    const nome = String(proximo.name || '').trim().split(/\s+/)[0] || 'Seu filho';
    await addDoc(collection(db, 'notifications'), {
      userId: proximo.parentUid,
      type: 'proxima_parada',
      title: 'Vocês são os próximos',
      // Dois períodos, não um com travessão: o segundo pedaço de uma frase
      // emendada é o que se perde na tela bloqueada, e aqui ele é o nome.
      body:
        direcao === 'ida'
          ? `${nome} é a próxima parada. A perua está a caminho.`
          : `${nome} é a próxima entrega. A perua está a caminho.`,
      childId: proximo.id,
      createdAt: serverTimestamp(),
    });
    return proximo.id;
  } catch (err) {
    console.error('Falha ao avisar a próxima parada:', err);
    return null;
  }
}

/**
 * QUEM FICOU PRA TRÁS — e o gatilho é o FIM DA ROTA, não o pulo de parada.
 *
 * ── ⚠️ ESTE É O AVISO MAIS PERIGOSO DO APP, E O GATILHO É O QUE O TORNA
 * SEGURO
 * A tentação é disparar quando ele marca uma criança DEPOIS de outra que ficou
 * pra trás. Não dá: ele marca fora de ordem o tempo todo — inverte duas ruas
 * por causa do trânsito, deixa uma criança pro fim porque ela sempre atrasa.
 * Ordem de marcação não é ordem da rua, e inferir dali é dizer a uma mãe que o
 * filho ficou na calçada quando ele está sentado na perua. Nenhuma
 * conveniência paga esse erro.
 *
 * No fim da rota não há inferência: a rota acabou e a criança não foi marcada.
 * É fato.
 *
 * ── ⚠️ E A FRASE DIZ O QUE O APP SABE, NÃO O QUE ELA TEME
 * O app sabe que ninguém MARCOU. Ele não sabe se a criança embarcou — marcar é
 * manual, e esquecer é comum no meio de vinte paradas. Escrever "seu filho não
 * foi pego" seria afirmar o que não se sabe, no assunto em que o erro é mais
 * caro. A frase fala do registro e manda confirmar com ele.
 *
 * ── ⚠️ SÓ QUEM JÁ PASSOU DA HORA COM FOLGA
 * Ele pode encerrar no meio (bateria, pausa, engano). Quem ainda nem tinha
 * horário de ser pego não pode receber "ficou pra trás" — daí a folga.
 */
const FOLGA_DO_ESQUECIDO = 20; // minutos depois da hora combinada
const CHAVE_DO_ESQUECIDO = 'ab_aviso_esquecido';

export async function avisarQuemFicou({ adminUid, direcao, agora = new Date() }) {
  if (!adminUid || !direcao) return 0;
  const campo = CAMPO_DA_DIRECAO[direcao];
  const marco = direcao === 'ida' ? 'onboard' : 'delivered';
  const esperado = direcao === 'ida' ? 'home' : 'atSchool';
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  try {
    const snap = await getDocs(
      query(collection(db, 'children'), where('adminUid', '==', adminUid))
    );

    const esquecidos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => {
        if (c.active === false || !c.parentUid) return false;
        const hora = normalizaHora(c[campo]);
        if (!hora) return false;
        // Ainda não era a hora dele: encerrar cedo não faz dele um esquecido.
        if (emMinutos(hora) + FOLGA_DO_ESQUECIDO > minutosAgora) return false;
        return getEffectiveStatus(c) === esperado;
      });

    if (!esquecidos.length) return 0;

    /* ⚠️ UMA VEZ POR CRIANÇA, POR DIA. Quem não foi pego de manhã continua
       `home` à tarde — sem esta trava, o fim da rota da volta repetiria o
       mesmo aviso, e repetir "seu filho não foi marcado" é assustar duas
       vezes pelo mesmo fato. */
    const hoje = getDateKey();
    const marcados = new Set();
    try {
      const cru = localStorage.getItem(CHAVE_DO_ESQUECIDO);
      const salvo = cru ? JSON.parse(cru) : null;
      if (salvo && salvo.dia === hoje) (salvo.ids || []).forEach((i) => marcados.add(i));
    } catch {
      /* sem storage a trava não existe */
    }
    const novos = esquecidos.filter((c) => !marcados.has(c.id));
    if (!novos.length) return 0;

    // ⚠️ MESMA TRAVA, MESMO DEFEITO — ver `avisarSaidaDaRota`. A marca de
    // "uma vez por criança, por dia" era gravada mesmo quando a escrita
    // falhava, e o `.catch(() => {})` de cada item absorvia a rejeição antes
    // do `Promise.all`, então nem o `catch` da função inteira via.
    //
    // O caso concreto: o Lucas ficou `home` porque o motorista esqueceu de
    // marcar o embarque. O aviso é recusado (rule, ou rede), ninguém é
    // avisado, e o id do Lucas entra na trava — a mãe não recebe nada, a tela
    // dela mostra o filho em casa, e na volta a trava impede a segunda
    // chance. Só marcamos quem realmente foi avisado.
    const idas = await Promise.allSettled(
      novos.map((c) => {
        const nome = String(c.name || '').trim().split(/\s+/)[0] || 'Seu filho';
        return addDoc(collection(db, 'notifications'), {
          userId: c.parentUid,
          type: 'nao_embarcou',
          // ⚠️ O TÍTULO NÃO PODE SOAR COMO ACUSAÇÃO NEM COMO ALARME.
          //
          // "Lucas não foi marcado" é jargão do sistema: a mãe não sabe o que
          // é "ser marcado", e o que ela entende é que algo deu errado com o
          // filho. Este aviso é sobre uma falha de REGISTRO, e a chance
          // esmagadora é que a criança esteja em casa há uma hora.
          //
          // O título vira uma pergunta sobre o registro, e o corpo desarma
          // antes de sugerir a ação — mesma escolha de `rota_atrasada`.
          title: `Faltou registrar ${nome} hoje`,
          // ⚠️ O NOME NÃO SE REPETE NO CORPO. Ele já está no título, e a
          // frase inteira passava de 90 caracteres — o que sobra cortado na
          // tela bloqueada é sempre o fim, que aqui é a ação.
          body:
            `Ninguém marcou ${marco === 'onboard' ? 'o embarque' : 'a entrega'}. ` +
            'Provavelmente foi só o registro. Confirme com o motorista.',
          childId: c.id,
          createdAt: serverTimestamp(),
        }).then(() => c.id);
      })
    );

    const avisados = idas
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);
    const falhas = idas.length - avisados.length;
    if (falhas) {
      console.error(`Falha ao avisar registro faltando para ${falhas} criança(s).`);
    }

    if (avisados.length) {
      try {
        avisados.forEach((id) => marcados.add(id));
        localStorage.setItem(
          CHAVE_DO_ESQUECIDO,
          JSON.stringify({ dia: hoje, ids: [...marcados] })
        );
      } catch {
        /* idem */
      }
    }
    return avisados.length;
  } catch (err) {
    console.error('Falha ao avisar quem ficou:', err);
    return 0;
  }
}

/**
 * ⚠️ O NOME VAI NO TÍTULO, e o corpo diz DE ONDE VEM a informação.
 *
 * O título era "Chegou em casa" e o nome ficava só no corpo — numa família
 * com dois filhos na mesma perua, a mãe tinha que abrir o aviso para saber
 * qual dos dois chegou, que é justamente o que ela não faz com o celular na
 * bolsa.
 *
 * E o corpo passou a dizer que quem marcou foi o motorista. O app não sabe
 * que a criança chegou: ele sabe que o motorista marcou. A diferença importa
 * no dia em que a marcação estiver errada — e é a mesma honestidade do aviso
 * "Faltou registrar {nome} hoje", que existe exatamente para esse caso.
 */
const TEXTO_DA_CHEGADA = {
  atSchool: {
    title: (nome) => `${nome} chegou na escola`,
    corpo: (hora) => `Às ${hora}, marcado pelo motorista.`,
  },
  delivered: {
    title: (nome) => `${nome} chegou em casa`,
    corpo: (hora) => `Às ${hora}, marcado pelo motorista.`,
  },
};

async function avisarChegadas(avisos) {
  const validos = (avisos || []).filter(
    (a) => a?.parentUid && TEXTO_DA_CHEGADA[a.status]
  );
  if (!validos.length) return;

  const agora = new Date();
  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(
    agora.getMinutes()
  ).padStart(2, '0')}`;

  await Promise.all(
    validos.map((a) => {
      const texto = TEXTO_DA_CHEGADA[a.status];
      const nome = (a.childName || '').split(' ')[0] || 'A criança';
      return addDoc(collection(db, 'notifications'), {
        userId: a.parentUid,
        type:
          a.status === 'delivered' ? 'child_arrived_home' : 'child_arrived_school',
        title: texto.title(nome),
        body: texto.corpo(hora),
        childId: a.childId,
        createdAt: serverTimestamp(),
      }).catch((err) => {
        // Silencioso de propósito: o motorista não pode ver erro de
        // notificação no meio da rota. A marcação — que é o que importa — já
        // está gravada quando isto roda.
        console.error('Falha ao avisar chegada:', err);
      });
    })
  );
}

/**
 * O status que VALE pra esta direção, considerando o que o pai declarou hoje.
 *
 * POR QUE ISTO EXISTE
 * Quando o pai declara "eu vou levar de manhã", nada marca a criança como
 * `atSchool`: `AbsenceSheet` só grava a declaração, e as rules — corretamente
 * — proíbem o pai de escrever `status`. À tarde, `getActionForStatus('home',
 * 'dropoff')` devolve null: a criança SOME da fila da volta e o tio não
 * consegue registrar a entrega dela em casa.
 *
 * Quando é o TIO que marca a mesma coisa, o Kanban chama `updateChildStatus`
 * na mão e funciona. Ou seja: o mesmo fato do mundo produzia dois resultados
 * diferentes dependendo de quem digitou.
 *
 * A correção não é dar escrita ao pai. É DERIVAR na leitura: a declaração do
 * dia é um fato tão bom quanto o campo, e derivar não precisa de permissão.
 */
export function statusNaDirecao(child, declaracao, direction) {
  // Parte do status EFETIVO, não do campo cru: `getEffectiveStatus` devolve
  // 'home' quando o `statusUpdatedAt` é de ontem. Sem isso o 'delivered' de
  // ontem vazaria pra hoje e a criança nasceria o dia já entregue.
  const base = getEffectiveStatus(child);
  if (!declaracao) return base;

  // "O pai leva de manhã": pra rota da VOLTA, a criança está na escola —
  // ainda que ninguém tenha tocado no botão de embarcar.
  if (
    direction === 'dropoff' &&
    declaracao.type === ABSENCE_TYPES.NO_PICKUP &&
    base === 'home'
  ) {
    return 'atSchool';
  }
  return base;
}
