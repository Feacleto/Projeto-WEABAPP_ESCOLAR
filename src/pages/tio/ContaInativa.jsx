import { Link } from 'react-router-dom';
import { ArrowRight, LogOut, MessageCircle } from 'lucide-react';
import Logo from '../../components/common/Logo';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import { salesWhatsAppLink } from '../../config/developer';

/**
 * A CONTA INATIVA — uma tela para três motivos, e ela NÃO CARREGA NADA.
 *
 * ⚠️ ESTA É A PARTE QUE PRECISA CONTINUAR VERDADEIRA
 * O desenho original era "o card sobre o app desfocado", e ele tem uma
 * armadilha que o `negocio.md` já nomeou: **`filter: blur()` é CSS, não
 * proteção**. Uma tela que CARREGA as crianças para borrá-las entrega nome,
 * endereço e coordenada a quem abrir o inspetor — vazamento com aparência de
 * segurança, que é pior que vazamento visível.
 *
 * Por isso esta tela não é uma camada por cima do painel: ela é renderizada
 * NO LUGAR dele, antes de o `TioLayout` montar. Nenhum `onSnapshot` de
 * `children`, `rides`, `liveLocation` ou `payments` chega a existir. O borrão
 * que sobrou é uma forma abstrata — enfeite sobre uma tela que já não tem
 * conteúdo real, que é exatamente como o documento pediu.
 *
 * Quem mexer aqui: não acrescente nada que leia dado de operação. Se algum dia
 * esta tela precisar mostrar quantas crianças ele tem, esse número vem de
 * `users.criancasAtivas` — o contador que já está no perfil — e nunca de uma
 * consulta à coleção.
 *
 * TRÊS MOTIVOS, UMA TELA, e a frase é a única coisa que muda. A situação é a
 * mesma nos três: existe conta, existe dado, falta acordo. O que muda é o que
 * a pessoa precisa fazer em seguida — e é por isso que o botão difere.
 *
 * O DADO DELE NÃO SUMIU, e a tela diz isso com todas as letras. Quem rodou três
 * meses sabe exatamente o que tem ali dentro, e a dúvida que aparece primeiro é
 * "perdi tudo?". Deixar essa pergunta sem resposta transforma cobrança em
 * medo.
 */

const TEXTO = {
  trial: {
    titulo: 'Seu teste terminou',
    corpo:
      'Seus três meses de teste chegaram ao fim, e por isso a conta está pausada. Escolha um plano para voltar a operar — suas crianças, horários e histórico continuam salvos.',
    acao: { para: '/tio/planos', rotulo: 'Ver planos' },
  },
  atraso: {
    titulo: 'Sua conta está pausada',
    corpo:
      'Sua associação está em aberto há mais de dez dias, e por isso o acesso foi suspenso. Ele volta assim que o pagamento for confirmado.',
    acao: { para: '/tio/taxa', rotulo: 'Pagar agora' },
  },
  // ⚠️ COBERTURA VENCIDA NÃO É INADIMPLÊNCIA, E O TEXTO NÃO PODE CITAR PRAZO.
  //
  // Este caso vinha com `motivo: 'atraso'` e lia a frase acima — "em aberto há
  // mais de dez dias" — no dia seguinte ao fim da cobertura, com `dias` vindo
  // `null`. Quem só não renovou era acusado de dez dias de atraso.
  //
  // Aqui não há fatura em mão, então a frase afirma só o que é verdade: o
  // período pago terminou.
  renovar: {
    titulo: 'Seu período pago terminou',
    corpo:
      'O período que você pagou chegou ao fim. Renove para voltar a operar — suas crianças, horários e histórico continuam salvos.',
    acao: { para: '/tio/taxa', rotulo: 'Renovar agora' },
  },
  // Suspensão é decisão de uma pessoa, e por isso não tem botão de
  // autoatendimento: não existe pagamento que a desfaça. O caminho é conversa.
  suspenso: {
    titulo: 'Sua conta está suspensa',
    corpo:
      'A suspensão foi uma decisão da plataforma, não uma cobrança em aberto. Fale com a gente para resolver.',
    acao: null,
  },
};

export default function ContaInativa({ motivo = 'trial' }) {
  const { logout } = useAuth();
  const t = TEXTO[motivo] || TEXTO.trial;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-6 py-10">
      {/* O BORRÃO É FORMA, NÃO DADO.
        * Duas manchas desfocadas nas cores da marca. Elas existem para a tela
        * não ser uma folha em branco — e não para esconder nada, porque não há
        * nada por trás. Ver o cabeçalho deste arquivo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-[380px] space-y-5 rounded-2xl border border-border bg-card p-7 text-center shadow-float">
        <Logo variant="stacked" height={64} className="mx-auto max-w-full" />

        <div>
          <h1 className="text-xl font-bold text-text">{t.titulo}</h1>
          <p className="mt-2 text-sm leading-relaxed text-textMuted">{t.corpo}</p>
        </div>

        {t.acao ? (
          <Link to={t.acao.para} className="block">
            <Button>
              {t.acao.rotulo}
              <ArrowRight size={18} />
            </Button>
          </Link>
        ) : (
          <a
            href={salesWhatsAppLink(
              'Oi! Minha conta do Alô Buzinou está suspensa e eu quero entender.'
            )}
            target="_blank"
            rel="noopener"
            className="block"
          >
            <Button>
              <MessageCircle size={18} />
              Falar com a gente
            </Button>
          </a>
        )}

        {/* A saída sempre existe. Conta bloqueada sem botão de sair prende a
          * pessoa numa tela, e prender não cobra — irrita. */}
        <button
          type="button"
          onClick={logout}
          className="tap mx-auto flex items-center gap-1.5 text-sm text-textMuted hover:text-text"
        >
          <LogOut size={15} /> Sair da conta
        </button>
      </div>

      {/* As famílias continuam com o app delas funcionando. Dizer isso aqui não
        * é gentileza: é o que impede o motorista de achar que os clientes dele
        * foram bloqueados junto, e ligar para vinte pessoas por engano. */}
      <p className="relative z-10 mt-6 max-w-[340px] text-center text-xs leading-relaxed text-textMuted">
        As famílias continuam com o app delas. Elas não perdem o acesso.
      </p>
    </div>
  );
}
