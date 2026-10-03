/**
 * O IRMÃO SE RECONHECE PELO WHATSAPP DO RESPONSÁVEL — régua pura.
 *
 * ── A DECISÃO (dono, 02/10/2026)
 * Não existe "cadastrar irmão". Irmão é uma criança nova como qualquer outra.
 * Quando o motorista a cadastra com o WhatsApp de um responsável que JÁ USA o
 * app, o servidor entende que é irmão e a criança aparece sozinha no app dela
 * — sem convite. Ela recebe um aviso com "Não é meu filho", que desfaz.
 *
 * ── ⚠️ SÓ O WHATSAPP, NUNCA O NOME
 * Nome igual não vincula: duas "Maria Silva" virariam a mesma família, e o
 * vínculo errado entrega endereço, escola e foto de uma criança a outra
 * família. O número é uma chave que o motorista digitou para AQUELA família.
 * A comparação é por `chaveDoTelefone` (a mesma da indicação): com o nono
 * dígito, `(11) 8765-4321` e `(11) 98765-4321` são a mesma pessoa.
 *
 * ── ⚠️ AMBÍGUO NÃO VINCULA
 * Se o número casar com DUAS contas diferentes, ninguém é escolhido: a
 * criança segue pelo convite normal. Escolher uma das duas seria sorteio
 * sobre dado de criança.
 *
 * ── POR QUE MORA AQUI E NÃO NO GATILHO
 * `testar:imports` derruba a bateria se um script alcançar o SDK. A escolha é
 * régua — este arquivo não requer nada além de outra régua pura.
 */

const { chaveDoTelefone } = require('./indicacao');

/**
 * Quem é o responsável já existente desta criança nova, ou `null`.
 *
 *   telefone   — `parentPhone` da criança recém-cadastrada
 *   contas     — [{ uid, role, phoneChave }] candidatos lidos de `users`.
 *                ⚠️ Compara `phoneChave`, NUNCA `phone`: `phone` o próprio
 *                responsável edita no perfil, e pôr ali o número de outra mãe
 *                daria a ele os filhos dela. `phoneChave` só o servidor grava,
 *                do número que o MOTORISTA digitou (proibida nas rules).
 *   criancas   — [{ parentUid, parentPhone }] crianças JÁ VINCULADAS (o
 *                caminho para contas antigas, sem `phoneChave` gravado)
 *
 *   motorista  — `adminUid` da criança nova.
 *                ⚠️ SÓ VINCULA QUEM JÁ É FAMÍLIA DESTE MOTORISTA (03/10/2026).
 *                A conta era procurada na plataforma inteira: um motorista
 *                recém-cadastrado, sabendo só o WhatsApp de uma mãe de OUTRA
 *                perua, cadastrava uma "criança" com ele e passava a ler o
 *                documento dela, mandar recado e gerar cobrança. Filho em
 *                perua nova entra pelo link do convite, como qualquer um.
 *
 * Devolve o uid só quando exatamente UMA conta de responsável casa.
 */
function ehFamiliaDe(conta, motorista) {
  if (!motorista) return false;
  if (conta.adminUid === motorista) return true;
  return Array.isArray(conta.adminUids) && conta.adminUids.includes(motorista);
}

function responsavelDoIrmao({ telefone, motorista = null, contas = [], criancas = [] }) {
  const chave = chaveDoTelefone(telefone);
  if (!chave) return null;

  const uids = new Set();
  for (const c of contas) {
    if (c && c.uid && c.role === 'parent' && c.phoneChave === chave && ehFamiliaDe(c, motorista)) {
      uids.add(c.uid);
    }
  }
  for (const k of criancas) {
    if (k && k.parentUid && chaveDoTelefone(k.parentPhone) === chave) {
      uids.add(k.parentUid);
    }
  }
  return uids.size === 1 ? [...uids][0] : null;
}

/**
 * AS CRIANÇAS QUE ESPERAM ESTE RESPONSÁVEL — para o pedido de acesso sem
 * link (02/10/2026).
 *
 * Quem chega sem o link informa o WhatsApp. As crianças ainda SEM
 * responsável cadastradas com esse número viram um PEDIDO ao motorista de
 * cada uma — nunca um vínculo. O número não é segredo (o ex-marido sabe), e
 * quem conhece a família é o motorista: ele aprova com um toque.
 *
 *   telefone — o que a pessoa digitou
 *   criancas — [{ id, parentUid, parentPhone, adminUid, name }]
 */
function criancasQueEsperam({ telefone, criancas = [] }) {
  const chave = chaveDoTelefone(telefone);
  if (!chave) return [];
  return criancas.filter(
    (k) => k && k.id && !k.parentUid && k.adminUid && chaveDoTelefone(k.parentPhone) === chave
  );
}

module.exports = { responsavelDoIrmao, criancasQueEsperam, chaveDoTelefone };
