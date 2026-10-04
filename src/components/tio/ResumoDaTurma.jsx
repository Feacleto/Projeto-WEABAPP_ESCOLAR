import { CircleCheck, Clock, School } from 'lucide-react';
import Avatar from '../common/Avatar';

/**
 * O CARTÃO VERDE DO INÍCIO — o próximo passo, e a turma quando ainda não há
 * viagem.
 *
 * DUAS CARAS, e a pergunta que decide é "já existe uma viagem?":
 *
 *   - COM VIAGEM (o desenho aprovado do design system, 03/10/2026): o nome da
 *     viagem ("Levando pra escola"), o intervalo das paradas, quantas escolas,
 *     e os rostos de quem vai hoje — com quem falta apagado na mesma fila.
 *     De manhã, antes de sair, o que ele quer saber é QUEM vai, não quantos
 *     tem na turma.
 *   - SEM VIAGEM: "12 crianças, 3 escolas". Pedido do dono (03/10/2026):
 *     conforme o motorista cadastra, é aqui que ele vê a operação crescer — o
 *     número muda no instante em que a criança é salva.
 *
 * ⚠️ É O ÚNICO BLOCO VERDE DA TELA (design system: a sombra colorida é uma
 * por tela).
 *
 * ⚠️ O INTERVALO É DAS PARADAS COMBINADAS, NUNCA DA CHEGADA NA ESCOLA. A
 * parada de escola não tem hora (ver `diaCompleto`), e inventar "→ 07:30"
 * seria trazer de volta o número que ninguém combinou.
 *
 * A AÇÃO VEM POR `children`: a chave do mapa (ControleDeRota, `destaque`,
 * `parte="chave"`) quando há viagem — o "Iniciar a rota" mora na barra de
 * baixo do Início desde 03/10/2026 —, o iniciar em contorno depois da última
 * viagem, ou "Definir os horários da rota" quando a turma existe mas a rota
 * ainda não tem de onde se montar. Este cartão não sabe de GPS.
 *
 * `viagem`: { titulo, horario, escolas, rostos: [{ child, fora }], vao, faltam }
 *
 * `concluido` (03/10/2026, auditoria de UX): o dia teve viagem e ninguém
 * espera mais a perua. O cartão diz "Tudo entregue hoje" em vez de voltar à
 * contagem seca — e quem monta deixa o "Iniciar a rota" em contorno, porque
 * depois da última viagem iniciar não é a ação do momento.
 */
const ROSTOS_NA_FILA = 6;

export default function ResumoDaTurma({
  rotulo,
  criancas,
  escolas,
  linha,
  viagem,
  concluido = false,
  children,
}) {
  return (
    // `shadow-rest`, não `shadow-focus` (04/10/2026): o cartão é LEITURA.
    // A sombra colorida da tela é do "Iniciar a rota", na barra de baixo.
    <section
      data-tour="hero"
      className="rounded-2xl bg-primary p-5 text-white shadow-rest"
    >
      <p className="rotulo text-menta">{rotulo}</p>

      {viagem ? (
        <>
          <h2 className="mt-1.5 text-[26px] font-extrabold leading-tight text-white">
            {viagem.titulo}
          </h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[15px] font-semibold text-primaryChip">
            {viagem.horario && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={16} />
                {viagem.horario}
              </span>
            )}
            {viagem.escolas > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <School size={16} />
                {viagem.escolas} {viagem.escolas === 1 ? 'escola' : 'escolas'}
              </span>
            )}
          </p>
          {viagem.rostos.length > 0 && (
            <div className="mt-3.5 flex items-center gap-3">
              <div className="flex -space-x-2">
                {viagem.rostos.slice(0, ROSTOS_NA_FILA).map(({ child, fora }) => (
                  <span
                    key={child.id}
                    className={`rounded-full ring-2 ring-primary ${fora ? 'opacity-45' : ''}`}
                    title={child.name}
                  >
                    <Avatar
                      photoURL={child.photoURL}
                      gender={child.gender}
                      seed={child.id}
                      kind="child"
                      size="sm"
                    />
                  </span>
                ))}
                {viagem.rostos.length > ROSTOS_NA_FILA && (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white ring-2 ring-primary">
                    +{viagem.rostos.length - ROSTOS_NA_FILA}
                  </span>
                )}
              </div>
              <p className="text-[15px] text-primaryChip">
                {viagem.vao} {viagem.vao === 1 ? 'vai' : 'vão'} hoje
                {viagem.faltam > 0 && ` · ${viagem.faltam} ${viagem.faltam === 1 ? 'falta' : 'faltam'}`}
              </p>
            </div>
          )}
          {linha && <p className="mt-2 text-[15px] text-primaryChip">{linha}</p>}
        </>
      ) : concluido ? (
        <>
          <h2 className="mt-1.5 flex items-center gap-2 text-[26px] font-extrabold leading-tight text-white">
            <CircleCheck size={26} className="shrink-0 text-menta" />
            Tudo entregue hoje
          </h2>
          <p className="mt-1 text-[15px] text-primaryChip">
            {contagem(criancas, 'criança', 'crianças')},{' '}
            {contagem(escolas, 'escola', 'escolas')} na sua turma.
          </p>
          {linha && <p className="mt-1 text-[15px] text-primaryChip">{linha}</p>}
        </>
      ) : (
        <>
          <h2 className="mt-1.5 text-[26px] font-extrabold leading-tight text-white">
            {contagem(criancas, 'criança', 'crianças')},{' '}
            {contagem(escolas, 'escola', 'escolas')}
          </h2>
          {linha && <p className="mt-1 text-[15px] text-primaryChip">{linha}</p>}
        </>
      )}

      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function contagem(n, um, varios) {
  if (!n) return `nenhuma ${um}`;
  return `${n} ${n === 1 ? um : varios}`;
}
