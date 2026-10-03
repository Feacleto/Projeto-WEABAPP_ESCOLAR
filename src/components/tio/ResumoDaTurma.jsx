/**
 * O CARTÃO VERDE DO INÍCIO — a turma em uma frase, e o próximo passo.
 *
 * "12 crianças, 3 escolas", a hora da primeira parada e o botão. Pedido do
 * dono (03/10/2026): conforme o motorista cadastra crianças e escolas, é aqui
 * que ele vê a operação dele crescer — o número muda no mesmo instante em que
 * a criança nova é salva, porque vem da mesma assinatura que monta a rota.
 *
 * ⚠️ É O ÚNICO BLOCO VERDE DA TELA (design system: a sombra colorida é uma
 * por tela). Antes eram três cartões disputando o topo — a barra fixa de
 * INICIAR ROTA, o cartão branco da "próxima viagem" e o "Nada agora" — e os
 * três falavam da mesma viagem.
 *
 * A AÇÃO VEM POR `children`: o botão de iniciar (ControleDeRota, variante
 * `destaque`) quando há viagem, ou "Definir horários" quando a turma existe
 * mas a rota ainda não tem de onde se montar. Este cartão não sabe de GPS.
 */
export default function ResumoDaTurma({ rotulo, criancas, escolas, linha, children }) {
  return (
    <section
      data-tour="hero"
      className="rounded-2xl bg-primary p-5 text-white shadow-focus"
    >
      <p className="rotulo text-menta">{rotulo}</p>
      <h2 className="mt-1.5 text-[26px] font-extrabold leading-tight text-white">
        {contagem(criancas, 'criança', 'crianças')},{' '}
        {contagem(escolas, 'escola', 'escolas')}
      </h2>
      {linha && <p className="mt-1 text-[15px] text-primaryChip">{linha}</p>}
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function contagem(n, um, varios) {
  if (!n) return `nenhuma ${um}`;
  return `${n} ${n === 1 ? um : varios}`;
}
