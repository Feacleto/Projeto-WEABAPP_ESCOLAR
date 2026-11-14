import { updateChild } from './childrenService';
import { notifyScheduleChanged } from './notificationsService';
import { searchAddress } from './locationService';
import { updateEscola } from './escolasService';
import { playSound } from './soundService';
import { salvarMensalidadeDaLista } from './contratosDaFamiliaService';
import { camposAoSalvar } from '../dominio/escola/listaDaTurma.js';
import { normalizaHora, periodoDaHora } from '../dominio/rota/horarios.js';

/**
 * A LISTA DA TURMA GRAVA CAMPO A CAMPO (RC2, 14/11/2026).
 *
 * Cada campo vai ao banco quando ele sai do campo — sem botão "Salvar" —, e
 * a tela só diz "salvo ✓" quando ESTA promessa resolve: o `updateDoc` do
 * Firestore só resolve depois de o servidor confirmar a escrita. Por isso
 * recarregar a tela não perde nada do que já apareceu como salvo.
 *
 * ⚠️ UM CAMPO POR ESCRITA. A mudança que chega aqui é só o que ele mexeu (e o
 * que vai junto por regra: o período que sai da hora; o fim do
 * `cadastroRapido` quando a criança passa a ter rua e hora — ver
 * `camposAoSalvar`). Mandar o formulário inteiro reescreveria, com o valor
 * velho da tela, um campo que outra pessoa (a família, no primeiro acesso)
 * acabou de corrigir.
 *
 * ⚠️ A HORA DE PEGAR AVISA A FAMÍLIA, como em "Horários da rota": depois de
 * gravar (nunca antes), e só se mudou de verdade. O "antes" sai do campo cru
 * — o horário presumido é um chute que a tela da família nunca mostrou.
 */
export async function salvarCampoDaLista(crianca, mudanca) {
  if (!crianca?.id) throw new Error('Sem criança.');
  const m = { ...mudanca };
  if ('horaPega' in m && m.horaPega) {
    const periodo = periodoDaHora(m.horaPega);
    m.pickupPeriod = periodo;
    m.period = periodo;
  }
  await updateChild(crianca.id, camposAoSalvar(crianca, m), { silencioso: true });
  if ('horaPega' in mudanca && mudanca.horaPega) {
    const antes = normalizaHora(crianca.horaPega) || null;
    if (antes !== mudanca.horaPega) {
      await notifyScheduleChanged({
        parentUid: crianca.parentUid || null,
        childId: crianca.id,
        childName: crianca.name,
        direcao: 'ida',
        de: antes,
        para: mudanca.horaPega,
      });
    }
  }
}

/**
 * A MENSALIDADE DIGITADA NA LINHA (achado M1). Com o contrato assinado a
 * linha nem mostra o campo (reajuste é pela ficha). Antes disso:
 *   - com versão esperando aceite, o valor e a versão mudam no MESMO lote
 *     (`salvarCombinado`, pelo serviço de contratos);
 *   - sem versão nenhuma, grava o campo direto — a primeira versão nasce no
 *     toque de "Convidar".
 */
export async function salvarMensalidadeNaLista(crianca, valor, admin) {
  const r = await salvarMensalidadeDaLista({ child: crianca, admin, valor });
  if (r === 'sem-contrato') await salvarCampoDaLista(crianca, { monthlyFee: valor });
  return r;
}

/**
 * ⚠️ O SOM DE "SALVO" É UM POR RAJADA. As escritas daqui são silenciosas, e
 * quem toca o som é o salvador da tela (`salvarPorCampo.js`), quando a última
 * escrita pendente termina — cinco campos seguidos, um som.
 */
export function somDeSalvo() {
  playSound('salvo');
}

/**
 * O PONTO DA CASA NO MAPA — uma consulta só, depois de a rua (e o número, ou
 * o "não sei o número") estar assentada. Não achar não é erro: a criança fica
 * com `geoPending`, como no cadastro completo. O Nominatim não aceita
 * autocompletar a cada tecla, e esta função nunca roda enquanto ele digita.
 */
export async function procurarPontoDaCasa(crianca, endereco, partes) {
  try {
    const r = await searchAddress(endereco, partes);
    await updateChild(crianca.id, { lat: r.lat, lng: r.lng }, { silencioso: true });
    return true;
  } catch {
    return false;
  }
}

/** Os campos que a criança copia da escola (a rota e a família leem a cópia). */
export function camposDaEscola(escola) {
  return {
    schoolId: escola.id,
    school: escola.nome || '',
    schoolAddress: escola.endereco || '',
    schoolLat: escola.lat ?? null,
    schoolLng: escola.lng ?? null,
    schoolPhone: String(escola.telefone || '').replace(/\D/g, ''),
  };
}

/** A hora de ENTRADA da escola — é dela que a hora de pegar é proposta. */
export function salvarEntradaDaEscola(escolaId, horaEntrada) {
  return updateEscola(escolaId, { horaEntrada: horaEntrada || '' }, { silencioso: true });
}
