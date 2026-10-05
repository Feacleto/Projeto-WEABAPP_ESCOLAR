import { useState } from 'react';
import { UserX, Sunrise, Sunset, Check, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ABSENCE_TYPES,
  declareAbsence,
  removeAbsence,
  notifyAbsence,
} from '../../services/absencesService';
import { getDateKey, horaCurta, horariosCombinados } from '../../dominio/rota/horarios';
import { dataDaChave } from '../../dominio/rota/faltas.js';
import RecadoDoDia from './RecadoDoDia';

/**
 * O AVISO EM UM TOQUE — direto na home do responsável.
 *
 * POR QUE ELE SUBSTITUI O BOTÃO QUE ABRIA A FOLHA
 * Avisar falta custava dois toques e uma folha no meio: tocar em "vai faltar
 * hoje?", esperar a folha subir, escolher a opção. Não é muito — até você
 * lembrar de QUANDO a pessoa faz isso: de manhã, atrasada, com a criança
 * doente do lado. Nesse minuto, uma tela a mais é a diferença entre avisar e
 * mandar mensagem no WhatsApp — que é onde a rota deixa de enxergar.
 *
 * As respostas possíveis já estão na tela, escritas. Um toque envia.
 *
 * O DIA VEM PRIMEIRO, E SÃO TRÊS PORTAS DO MESMO TAMANHO (03/10/2026)
 * "Hoje", o próximo dia de aula ("Amanhã", ou "Segunda" numa sexta) e "Outro
 * dia". O outro dia era um "mais opções" de 12px no canto — a ÚNICA porta
 * para avisar a consulta de quinta, com alvo de 16px. Agora ele é um botão
 * igual aos outros dois e abre a mesma folha de antes (com o calendário e o
 * teto de 14 dias de `dominio/rota/faltas.js`).
 *
 * NO SÁBADO E NO FERIADO NÃO HÁ "HOJE": oferecer "Não vai" para um dia sem
 * rota é perguntar o que não existe (`dominio/rota/calendario.js`). O dia de
 * aula seguinte continua — é ali que o aviso serve.
 *
 * DESFAZER É O MESMO BOTÃO
 * Sem diálogo de confirmação: enviar é um toque, e o botão fica aceso. Tocar
 * de novo desfaz. Confirmação protegeria contra o toque errado, mas cobraria
 * um toque de todo mundo pra proteger de poucos — e o estrago aqui é
 * reversível em um segundo.
 *
 * O RECADO DO DIA (05/10/2026, decisão do dono): no fim do bloco, só com
 * "Hoje" aceso, o campo "Recado para o tio (hoje)" (`RecadoDoDia`) — o tio o
 * lê em âmbar na ficha rápida da rota.
 */
export default function AvisoRapido({
  child,
  absenceHoje,
  // O aviso já feito para o PRÓXIMO DIA DE AULA (não necessariamente amanhã:
  // numa sexta, é a segunda). Quem calcula o dia é o Início, que é quem
  // também assina o aviso daquele dia.
  absenceProximo,
  proximoKey,
  // false no sábado, domingo e feriado nacional — some o "Hoje".
  hojeTemRota = true,
  // "Outro dia": abre a folha completa, com o calendário.
  onDetalhes,
  // A QUARTA RESPOSTA — quem vai buscar no lugar dela.
  //
  // "Não vai", "eu levo", "eu busco" e "quem busca" são quatro respostas da
  // MESMA pergunta: quem encosta na criança hoje. Moravam em dois cartões de
  // cores diferentes, e ela descobria a quarta rolando. Juntas, ela lê as
  // quatro de uma vez.
  //
  // ⚠️ SÓ PARA HOJE: a indicação de quem busca vale um dia (o id de
  // `altPickups` leva a data) e a folha grava sempre a de hoje. Oferecê-la
  // com "Amanhã" aceso gravaria hoje achando que era amanhã.
  onOutraPessoa,
  altPickup = null,
}) {
  const [escolhido, setEscolhido] = useState(null);
  const [enviando, setEnviando] = useState(null);

  if (!child) return null;

  const hoje = getDateKey();
  const proximo =
    proximoKey || getDateKey(new Date(new Date().setDate(new Date().getDate() + 1)));
  // Sem rota hoje, o dia aceso é o próximo — e nunca "hoje".
  const dia = !hojeTemRota ? 'proximo' : escolhido || 'hoje';
  const dateKey = dia === 'hoje' ? hoje : proximo;
  const declarado = dia === 'hoje' ? absenceHoje : absenceProximo;

  const { pega, entrega, presumido } = horariosCombinados(child);
  const nome = child.name?.split(' ')[0] || 'seu filho';

  async function alternar(tipo) {
    if (enviando) return;
    setEnviando(tipo);
    const quando = quandoPorExtenso(dateKey, hoje);
    try {
      if (declarado?.type === tipo) {
        await removeAbsence({ dateKey, childId: child.id });
        toast.success(`Aviso desfeito: ${nome} vai normal ${quando}.`);
      } else {
        await declareAbsence({
          dateKey,
          childId: child.id,
          childName: child.name,
          parentUid: child.parentUid || null,
          adminUid: child.adminUid || null,
          type: tipo,
          declaredBy: 'parent',
        });
        notifyAbsence({
          // `adminUid` já é passado à declaração logo acima; ele precisa vir
          // aqui também, senão a notificação cai no ponteiro global.
          child: {
            name: child.name,
            parentUid: child.parentUid,
            adminUid: child.adminUid,
          },
          type: tipo,
          dateKey,
          declaredBy: 'parent',
        });
        toast.success(confirmacao(tipo, quando, nome, pega, entrega, presumido));
      }
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra avisar. Tente de novo.');
    } finally {
      setEnviando(null);
    }
  }

  const OPCOES = [
    { tipo: ABSENCE_TYPES.FULL, icon: UserX, titulo: 'Não vai' },
    { tipo: ABSENCE_TYPES.NO_PICKUP, icon: Sunrise, titulo: 'Eu levo' },
    { tipo: ABSENCE_TYPES.NO_DROPOFF, icon: Sunset, titulo: 'Eu busco' },
  ];

  // A quarta NÃO é um ABSENCE_TYPE, e é a única que abre folha: precisa de
  // nome e telefone de terceiro. As outras três continuam sendo um toque.
  const outraAtiva = !!altPickup;
  const mostraQuemBusca = !!onOutraPessoa && dia === 'hoje';

  const DIAS = [
    hojeTemRota && { v: 'hoje', label: 'Hoje' },
    { v: 'proximo', label: rotuloDoProximo(proximo, hoje) },
  ].filter(Boolean);

  return (
    <section
      id="aviso-rapido"
      // Foco programático: a barra de baixo do Início ("Avisar falta ou
      // quem busca") traz a tela até aqui e põe o foco no bloco.
      tabIndex={-1}
      className="bg-card rounded-3xl shadow-sm p-4 space-y-3 outline-none"
    >
      <p className="text-lg font-bold text-text">Precisa avisar o motorista?</p>

      {/* O DIA, primeiro. Botões de 48px — "Outro dia" é porta igual às
        * outras, não um link no canto. */}
      <div
        className={`grid gap-2 ${DIAS.length === 2 ? 'grid-cols-3' : 'grid-cols-2'}`}
        role="group"
        aria-label="Para qual dia"
      >
        {DIAS.map((d) => (
          <button
            key={d.v}
            type="button"
            onClick={() => setEscolhido(d.v)}
            aria-pressed={dia === d.v}
            className={`tap h-12 rounded-xl border-2 px-1 text-base font-semibold transition-colors ${
              dia === d.v
                ? 'border-primary bg-primarySoft text-primary'
                : 'border-border bg-card text-text'
            }`}
          >
            {d.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onDetalhes}
          className="tap h-12 rounded-xl border-2 border-border bg-card px-1 text-base font-semibold text-text"
        >
          Outro dia
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {OPCOES.map((o) => {
          const ativo = declarado?.type === o.tipo;
          return (
            <button
              key={o.tipo}
              type="button"
              disabled={!!enviando}
              onClick={() => alternar(o.tipo)}
              aria-pressed={ativo}
              className={`tap min-h-14 rounded-2xl border-2 px-3 py-2 flex items-center gap-2 text-left transition-colors disabled:opacity-60 ${
                ativo ? 'border-primary bg-primarySoft' : 'border-border bg-card'
              }`}
            >
              <o.icon
                size={22}
                className={`shrink-0 ${ativo ? 'text-primary' : 'text-textMuted'}`}
              />
              <span className="min-w-0">
                <span
                  className={`block text-base font-bold leading-tight ${
                    ativo ? 'text-primary' : 'text-text'
                  }`}
                >
                  {o.titulo}
                </span>
                {ativo && (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    <Check size={14} /> avisado
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {/* A QUARTA: "quem busca". Abre folha porque precisa de nome e
          * telefone de um terceiro — as outras três resolvem num toque.
          * Acesa, mostra o primeiro nome de quem vai buscar; é o que
          * substitui o cartão separado de "Hoje quem busca: Vovó Cida". */}
        {mostraQuemBusca && (
          <button
            type="button"
            disabled={!!enviando}
            onClick={onOutraPessoa}
            aria-pressed={outraAtiva}
            className={`tap min-h-14 rounded-2xl border-2 px-3 py-2 flex items-center gap-2 text-left transition-colors disabled:opacity-60 ${
              outraAtiva ? 'border-primary bg-primarySoft' : 'border-border bg-card'
            }`}
          >
            <UserCheck
              size={22}
              className={`shrink-0 ${outraAtiva ? 'text-primary' : 'text-textMuted'}`}
            />
            <span className="min-w-0">
              <span
                className={`block text-base font-bold leading-tight ${
                  outraAtiva ? 'text-primary' : 'text-text'
                }`}
              >
                Quem busca
              </span>
              {outraAtiva && (
                <span className="block max-w-full truncate text-sm font-semibold text-primary">
                  {String(altPickup.name || '').split(' ')[0]}
                </span>
              )}
            </span>
          </button>
        )}
      </div>

      <p className="text-sm text-textMuted leading-relaxed">
        {declarado
          ? 'Toque de novo no mesmo botão pra desfazer.'
          : dia === 'hoje'
            ? 'Um toque avisa o motorista na hora.'
            : `Um toque avisa o motorista agora — vale ${quandoPorExtenso(proximo, hoje)}.`}
      </p>

      {dia === 'hoje' && hojeTemRota && <RecadoDoDia child={child} dateKey={hoje} />}
    </section>
  );
}

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "Amanhã" quando o próximo dia de aula é amanhã; senão o dia da semana. */
function rotuloDoProximo(chave, hoje) {
  const d = dataDaChave(chave);
  const h = dataDaChave(hoje);
  if (!d || !h) return 'Amanhã';
  const amanha = new Date(h.getFullYear(), h.getMonth(), h.getDate() + 1);
  if (d.getTime() === amanha.getTime()) return 'Amanhã';
  const nome = DIAS_DA_SEMANA[d.getDay()];
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/**
 * A DATA POR EXTENSO, no aviso que confirma: "na quinta, 9/10".
 *
 * "Avisado: não vai amanhã" é verdade no minuto em que se lê e vira dúvida
 * depois — quando ela relê, ou passa da meia-noite. O dia da semana com a
 * data não envelhece.
 */
function quandoPorExtenso(chave, hoje) {
  const d = dataDaChave(chave);
  if (!d) return chave === hoje ? 'hoje' : 'no dia marcado';
  const nome = DIAS_DA_SEMANA[d.getDay()];
  const data = `${d.getDate()}/${d.getMonth() + 1}`;
  if (chave === hoje) return `hoje (${nome}, ${data})`;
  const prep = d.getDay() === 0 || d.getDay() === 6 ? 'no' : 'na';
  return `${prep} ${nome}, ${data}`;
}

/**
 * A confirmação diz O QUE MUDOU, e não "salvo".
 *
 * "Aviso enviado" não responde a pergunta que o responsável tem depois de
 * tocar: preciso descer com ele às 6h20 ou não? Quando o horário está
 * combinado, a frase usa ele.
 */
function confirmacao(tipo, quando, nome, pega, entrega, presumido) {
  if (tipo === ABSENCE_TYPES.FULL) {
    return `Avisado: ${nome} não vai ${quando}.`;
  }
  if (tipo === ABSENCE_TYPES.NO_PICKUP) {
    return presumido
      ? `Avisado: você leva ${quando}. O motorista traz de volta.`
      : `Avisado: você leva ${quando}. O motorista não passa às ${horaCurta(pega)}, mas traz de volta às ${horaCurta(entrega)}.`;
  }
  return presumido
    ? `Avisado: você busca ${quando}. O motorista só leva.`
    : `Avisado: você busca ${quando}. O motorista pega às ${horaCurta(pega)} e não traz de volta.`;
}
