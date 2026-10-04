import { forwardRef, useId, useState } from 'react';
import { Check, CheckCircle2, Eye, EyeOff, Mic } from 'lucide-react';
import { avancarDoCampo } from '../../compartilhado/avancarCampo';
import { textoDitado } from '../../compartilhado/ditado.js';
import { useDitado } from '../../hooks/useDitado';

const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    icon: Icon,
    className = '',
    // Classes para o <input> em si. O `className` acima vai no INVÓLUCRO
    // (rótulo, campo, dica), e usá-lo para estilizar o campo deixava o
    // rótulo e a dica em mono espaçado — ilegíveis. São dois alvos
    // diferentes, e agora têm dois nomes.
    inputClassName = '',
    id: idProp,
    type = 'text',
    revealable = false,
    // O "Salvar" ao lado do campo (03/10/2026). `avancar={false}` o tira —
    // campo de busca, por exemplo, em que o Enter já faz a busca.
    avancar = true,
    // Esconde SÓ o botão e mantém o Enter levando ao próximo (04/10/2026,
    // decisão do dono). O botão se chama "Salvar" mas não grava nada — ele
    // avança —, e onde a tela já tem o botão de verdade ("Entrar", "Lançar",
    // "Salvar" do perfil) ou só um campo, quem tem 40+ toca nele achando que
    // guardou e sai. Fica só nos formulários longos, em que o teclado cobre
    // o botão do fim da tela.
    semSalvar = false,
    // O MICROFONE DENTRO DO CAMPO (04/10/2026, pedido do dono): 'nome',
    // 'telefone' ou 'texto' — o tipo diz como o que foi falado vira texto
    // (compartilhado/ditado.js). Ausente, não há microfone. Nunca em senha,
    // data, CPF, chave PIX, CEP, km ou saúde: ali o certo é digitar e
    // conferir (ver testar:ditado).
    falar,
    ...rest
  },
  ref
) {
  const generated = useId();
  const id = idProp || generated;
  const [revealed, setRevealed] = useState(false);

  // Senha revelável substitui o campo "confirme a senha": o usuário confere
  // o que digitou olhando, em vez de digitar duas vezes. Menos atrito e
  // menos erro pra quem tem pouca familiaridade com teclado de celular.
  const isPassword = type === 'password';
  const showReveal = revealable && isPassword;
  const effectiveType = showReveal && revealed ? 'text' : type;

  /* ⚠️ NENHUM EXEMPLO DENTRO DO CAMPO (03/10/2026, pedido do dono). "Ex:
   * Pedro Silva", "00000-000", "450,00" — o motorista lia o exemplo cinza
   * como resposta já dada e passava adiante com o campo vazio. Todo campo
   * diz a mesma coisa: "Digite aqui". O formato, quando importa, vai na
   * `hint` embaixo, onde não se confunde com o que foi digitado. O que o
   * chamador passar em `placeholder` é ignorado de propósito, e
   * `testar:formularios` reprova exemplo novo no código. */
  const textoGuia = rest.disabled || rest.readOnly ? undefined : 'Digite aqui';
  // Data e senha nunca levam o botão: a data se escolhe no calendário do
  // celular, que fecha sozinho, e "Salvar" ao lado da senha soa como "o app
  // vai guardar minha senha".
  const comSalvar =
    avancar && !semSalvar && !rest.disabled && !rest.readOnly
    && type !== 'date' && type !== 'password';

  /* ⚠️ O CAMPO DIZ QUE VALEU (04/10/2026, pedido do dono). Quem tem 40+ não
   * sabe se o que digitou "pegou" sem ver um sinal. Ao tocar em Salvar, ao
   * dar Enter ou ao sair do campo preenchido, ele fica confirmado: borda
   * verde, um visto dentro e, no botão, "Pronto". É ESTADO, não animação —
   * fica até ele mudar o texto (nada se mexe sozinho; docs/design-system.md).
   * Diz "Pronto", nunca "Salvo": no passo a passo o dado só vai ao banco no
   * fim, e "Salvo" o deixaria sair da tela achando que estava guardado. */
  const [confirmado, setConfirmado] = useState(false);
  const preenchido = rest.value != null && String(rest.value).trim() !== '';
  const mostraPronto = confirmado && preenchido && !error && !rest.disabled && !rest.readOnly;
  const confirmar = () => {
    if (preenchido && !error) setConfirmado(true);
  };

  const ditado = useDitado();
  const comMicrofone =
    !!falar && ditado.suportado && !rest.disabled && !rest.readOnly
    && type !== 'password' && type !== 'date';
  const ditar = () => {
    if (ditado.ouvindo) return ditado.parar();
    ditado.comecar((bruto) => {
      const valor = textoDitado(bruto, falar);
      if (!valor) return;
      // Os campos do app são controlados e leem `e.target.value` — o ditado
      // entra pelo mesmo caminho do teclado, com a máscara do chamador.
      rest.onChange?.({ target: { value: valor, name: rest.name }, currentTarget: { value: valor } });
      setConfirmado(true);
    });
  };

  const aoTeclar = (e) => {
    rest.onKeyDown?.(e);
    if (e.defaultPrevented || e.key !== 'Enter' || !avancar) return;
    e.preventDefault();
    confirmar();
    avancarDoCampo(e.currentTarget);
  };
  const aoMudar = (e) => {
    setConfirmado(false);
    rest.onChange?.(e);
  };
  const aoSair = (e) => {
    rest.onBlur?.(e);
    confirmar();
  };

  return (
    <div className={`block ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-text mb-2"
        >
          {label}
        </label>
      )}
      {/* O "SALVAR" DESCE QUANDO NÃO CABE (04/10/2026, medido a 320px). Lado
        * a lado com o microfone, o campo de endereço ficava com "Digite…"
        * cortado. O campo pede pelo menos 11rem e cresce primeiro (grow-[999]);
        * sem esse espaço, o Salvar quebra para a linha de baixo e ali, sozinho,
        * ocupa a largura toda. */}
      <div className="flex flex-wrap items-start gap-2">
      <div className="relative min-w-[11rem] flex-1 grow-[999]">
        {Icon && (
          <Icon
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
          />
        )}
        <input
          ref={ref}
          id={id}
          type={effectiveType}
          // Diz ao leitor de tela que o campo está errado — e é por este
          // atributo que um formulário acha o primeiro erro para focar nele.
          aria-invalid={error ? true : undefined}
          className={`
            w-full h-14 rounded-xl border-2 bg-card text-text
            ${Icon ? 'pl-11' : 'pl-4'} ${showReveal || comMicrofone ? 'pr-14' : mostraPronto ? 'pr-12' : 'pr-4'}
            ${error ? 'border-danger' : mostraPronto || ditado.ouvindo ? 'border-primary' : 'border-border'}
            focus:outline-none focus:ring-4 focus:ring-accent/25 focus:border-primary
            transition-[border-color,box-shadow] duration-estado
            placeholder:text-textMuted disabled:bg-sunken disabled:text-textMuted
            ${inputClassName}
          `}
          {...rest}
          placeholder={textoGuia}
          onKeyDown={aoTeclar}
          onChange={aoMudar}
          onBlur={aoSair}
          enterKeyHint={rest.enterKeyHint || 'next'}
        />
        {comMicrofone && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={ditar}
            aria-label={ditado.ouvindo ? 'Parar de ouvir' : `Falar ${typeof label === 'string' ? label.toLowerCase() : 'o texto'}`}
            aria-pressed={ditado.ouvindo}
            className={`tap absolute right-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-xl ${
              ditado.ouvindo ? 'bg-primary text-white' : 'bg-primaryChip text-primary'
            }`}
          >
            <Mic size={22} aria-hidden="true" />
          </button>
        )}
        {mostraPronto && !showReveal && !comMicrofone && (
          <CheckCircle2
            size={22}
            aria-hidden="true"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none"
          />
        )}
        {showReveal && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Esconder senha' : 'Mostrar senha'}
            aria-pressed={revealed}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center text-textMuted hover:text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {revealed ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        )}
      </div>
      {comSalvar && (
        <button
          type="button"
          // Não rouba o foco antes do clique: o campo de onde ele saiu é a
          // referência para achar o próximo.
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            confirmar();
            avancarDoCampo(document.getElementById(id) || e.currentTarget);
          }}
          // Largura mínima fixa: "Salvar" e "Pronto" trocam no mesmo lugar,
          // sem empurrar o campo.
          className={`tap h-14 min-w-[104px] grow basis-[104px] rounded-xl px-4 text-base font-bold inline-flex items-center justify-center gap-1.5 transition-colors duration-estado ${
            // CONTORNO, não verde cheio (04/10/2026): com um Salvar cheio por
            // campo a tela tinha 3 a 6 botões verdes disputando com o
            // "Avançar" — e o design system quer UM protagonista por tela.
            mostraPronto ? 'border-2 border-primaryBorder bg-primarySoft text-primary' : 'border-2 border-primary bg-card text-primary'
          }`}
        >
          {mostraPronto ? (
            <>
              <Check size={18} aria-hidden="true" />
              Pronto
            </>
          ) : (
            'Salvar'
          )}
        </button>
      )}
      </div>
      {/* Para o leitor de tela, o mesmo sinal em palavras. */}
      <span role="status" className="sr-only">
        {mostraPronto ? `${typeof label === 'string' ? label : 'Campo'}: pronto` : ''}
      </span>
      {/* 14px, não 12: o erro é a frase que diz o que fazer, e o público de
        * 40+ não a lê sem óculos no tamanho de rodapé. */}
      {error && <p className="text-sm font-semibold text-dangerText mt-1.5">{error}</p>}
      {/* "Ouvindo…" parado, no lugar da dica: estado, não animação. */}
      {comMicrofone && (ditado.ouvindo || ditado.naoEntendi) && !error && (
        <p aria-live="polite" className={`text-sm font-semibold mt-1.5 ${ditado.ouvindo ? 'text-primary' : 'text-textMuted'}`}>
          {ditado.ouvindo ? 'Ouvindo… pode falar' : 'Não entendi. Toque no microfone e fale de novo.'}
        </p>
      )}
      {hint && !error && !(comMicrofone && (ditado.ouvindo || ditado.naoEntendi)) && (
        <p className="text-sm text-textMuted mt-1.5">{hint}</p>
      )}
    </div>
  );
});

export default Input;
