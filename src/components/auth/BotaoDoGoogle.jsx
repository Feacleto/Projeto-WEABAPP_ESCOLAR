import Button from '../common/Button';
import GoogleIcon from '../common/GoogleIcon';

/**
 * O BOTÃO DO GOOGLE — um nome e um estilo em toda tela de entrada
 * (03/10/2026).
 *
 * Eram três: "Entrar com Google" cheio e verde no login, "Entrar com Google"
 * de contorno na folha do site e "Continuar com Google" de contorno na folha
 * do link do convite — a primeira tela que a mãe vê. A mesma porta com três
 * caras faz a pessoa que entrou por uma desconfiar da outra. Agora é este, e
 * ele é CHEIO porque é a ação principal de todas elas: o e-mail é o caminho
 * de quem não tem Google, não uma alternativa do mesmo peso.
 *
 * O "G" colorido vai num círculo branco: sobre o verde ele sumiria, e a
 * marca do Google não pode ser recolorida.
 *
 * O rótulo NÃO é prop de propósito — um segundo nome volta pela porta da
 * conveniência. `className` existe para o teatro do login (o pulso).
 */
export default function BotaoDoGoogle({ loading = false, onClick, className = '', ...rest }) {
  return (
    <Button
      loading={loading}
      onClick={onClick}
      className={`!whitespace-nowrap ${className}`}
      {...rest}
    >
      {!loading && (
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-card">
          <GoogleIcon size={16} />
        </span>
      )}
      Entrar com Google
    </Button>
  );
}

/**
 * O caminho do e-mail quando o Google funciona: um link discreto, mas com
 * alvo de 48 px — discreto no peso, não no tamanho do dedo.
 */
export function LinkDoEmail({ onClick, aberto, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto}
      className="tap inline-flex min-h-12 w-full items-center justify-center gap-1.5 text-center text-base font-semibold text-textMuted underline-offset-4 hover:text-text hover:underline"
      {...rest}
    >
      Entrar com e-mail
    </button>
  );
}
