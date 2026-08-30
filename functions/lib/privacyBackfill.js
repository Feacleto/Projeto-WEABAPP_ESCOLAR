/**
 * Backfill de privacidade nos depoimentos públicos.
 *
 * O QUE ACONTECEU
 * `feedbacks/{id}` é legível por QUALQUER UM, sem login, quando
 * `allowTestimonial == true` — é assim que a landing mostra depoimento pra
 * visitante. E o serviço gravava, nesse mesmo documento:
 *   - `authorName` COMPLETO (a tela só exibia o primeiro nome)
 *   - `authorPhotoURL` sem checar `allowPhoto` (rosto de quem não autorizou)
 *
 * O commit e005363 fechou a escrita. Mas fechar a porta não recolhe o que já
 * está do lado de fora: documento gravado ANTES continua com nome completo e
 * foto, e continua público. Quem vaza é o DOCUMENTO — o caminho de leitura
 * preferir `authorFirstName` não muda nada pra quem pede o doc direto.
 *
 * Daí este backfill. Ele roda com Admin SDK porque precisa APAGAR campo, e as
 * rules de `feedbacks` proíbem update pra todos (`allow update: if false`) —
 * de propósito: depoimento é imutável. O Admin SDK não passa por rules.
 *
 * POR QUE CALLABLE E NÃO SCRIPT LOCAL
 * Script local exigiria baixar chave de service account pra máquina de alguém.
 * Chave de admin em disco é risco permanente pra resolver um problema de uma
 * vez. Como callable, a credencial nunca sai do Google.
 *
 * TEM DRY-RUN, e o padrão é ele. Migração que apaga campo sem deixar ver
 * primeiro o que vai apagar é como a gente perde dado achando que corrigiu.
 */

const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { exigirDono } = require('./papeis');

const REGION = 'southamerica-east1';
const BATCH_LIMIT = 400;

function firstNameOf(full) {
  const first = String(full || '').trim().split(/\s+/)[0];
  return first || null;
}

function makeBackfillTestimonialPrivacy(db) {
  return onCall({ region: REGION }, async (request) => {
    // ESTA FUNÇÃO É DO DONO, E PEDIA PAPEL DE MOTORISTA.
    //
    // Ela é chamada de `/admin` (AdminPanel.jsx) e reescreve a privacidade dos
    // depoimentos PÚBLICOS de todos os usuários. Com `role === 'admin'` — que
    // neste projeto significa MOTORISTA — qualquer parceiro podia rodá-la, e o
    // dono só passava porque a conta dele ainda carrega o legado `superAdmin`.
    // Depois da migração para `role: 'owner'` o dono perderia o acesso e o
    // motorista manteria.
    await exigirDono(db, request);

    // Padrão é NÃO escrever. Quem quer aplicar manda { apply: true }.
    const apply = request.data?.apply === true;

    // Só os públicos importam: os privados já são legíveis apenas pelo dono
    // e pelo admin, e nesses o nome completo é legítimo.
    const snap = await db
      .collection('feedbacks')
      .where('allowTestimonial', '==', true)
      .get();

    const found = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      const temNomeCompleto = !!d.authorName;
      // Foto sem consentimento: a URL está lá e allowPhoto não é true.
      const temFotoSemConsentimento = !!d.authorPhotoURL && d.allowPhoto !== true;
      if (!temNomeCompleto && !temFotoSemConsentimento) continue;

      found.push({
        id: doc.id,
        // Não devolvemos o nome — só o que será feito. Um relatório que
        // repete o dado vazado só amplia o problema, inclusive no log.
        removeNomeCompleto: temNomeCompleto,
        removeFotoSemConsentimento: temFotoSemConsentimento,
        preservaPrimeiroNome: !d.authorFirstName && temNomeCompleto,
      });
    }

    if (!apply) {
      return {
        dryRun: true,
        avaliados: snap.size,
        aCorrigir: found.length,
        detalhes: found,
      };
    }

    let corrigidos = 0;
    for (let i = 0; i < found.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const item of found.slice(i, i + BATCH_LIMIT)) {
        const ref = db.collection('feedbacks').doc(item.id);
        const original = snap.docs.find((d) => d.id === item.id).data();

        const updates = {};

        // Preserva o primeiro nome ANTES de apagar o completo — senão o
        // depoimento perde a atribuição e vira "Anônimo" na landing.
        if (item.preservaPrimeiroNome) {
          updates.authorFirstName = firstNameOf(original.authorName);
        }
        if (item.removeNomeCompleto) {
          updates.authorName = admin.firestore.FieldValue.delete();
        }
        if (item.removeFotoSemConsentimento) {
          updates.authorPhotoURL = admin.firestore.FieldValue.delete();
        }

        batch.update(ref, updates);
        corrigidos += 1;
      }
      await batch.commit();
    }

    logger.info(
      `backfillTestimonialPrivacy: ${corrigidos} depoimento(s) corrigido(s) de ${snap.size} público(s).`
    );

    return { dryRun: false, avaliados: snap.size, corrigidos };
  });
}

module.exports = { makeBackfillTestimonialPrivacy };
