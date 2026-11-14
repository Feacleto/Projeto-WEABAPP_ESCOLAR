import { useId, useState } from 'react';
import { mascaraHora, maskPhone, unmaskPhone, isValidPhone } from '../../compartilhado/masks';
import { normalizaHora } from '../../dominio/rota/horarios.js';
import { ROTULOS } from '../../marca/textosDaLista.js';

/**
 * OS CAMPOS DA LINHA ABERTA DA LISTA DA TURMA (RC2) — salvam SOZINHOS, ao
 * sair do campo, e dizem "salvo ✓" só quando o servidor confirmou.
 *
 * ⚠️ POR QUE NÃO É O `<Input>` COMUM. O `Input` acende "Pronto" com a borda
 * verde ao sair do campo, ANTES de qualquer escrita — certo no passo a passo,
 * em que nada vai ao banco até o fim, e falso aqui, em que o sinal tem de ser
 * a confirmação do servidor. Dois sinais de "pegou" para a mesma coisa, um
 * deles cedo demais, ensinariam a desconfiar dos dois.
 *
 * O exemplo dentro do campo é sempre "Digite aqui" (`testar:formularios`).
 */

/** O rótulo do campo e, à direita, o estado da escrita. */
export function RotuloDoCampo({ htmlFor, rotulo, extra, estado, onTentar }) {
  const erro = estado && typeof estado === 'object' && estado.erro;
  return (
    <div className="mb-1.5 flex min-h-6 items-baseline justify-between gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-base font-semibold text-text">
          {rotulo} {extra && <span className="text-sm font-normal text-textMuted">{extra}</span>}
        </label>
      ) : (
        <span className="text-base font-semibold text-text">
          {rotulo} {extra && <span className="text-sm font-normal text-textMuted">{extra}</span>}
        </span>
      )}
      <EstadoDoSalvar estado={estado} onTentar={onTentar} erro={erro} />
    </div>
  );
}

function EstadoDoSalvar({ estado, onTentar, erro }) {
  if (estado === 'salvando') {
    return <span role="status" className="shrink-0 text-sm text-textMuted">{ROTULOS.salvando}</span>;
  }
  if (estado === 'salvo') {
    return <span role="status" className="shrink-0 whitespace-nowrap text-sm font-bold text-accentText">{ROTULOS.salvo}</span>;
  }
  if (erro) {
    return (
      <span role="alert" className="flex shrink-0 items-center gap-1 text-sm font-semibold text-dangerText">
        {ROTULOS.naoSalvou}
        <button type="button" onClick={onTentar} className="tap min-h-11 px-1.5 font-bold text-primary underline">
          {ROTULOS.tentarDeNovo}
        </button>
      </span>
    );
  }
  return null;
}

export const CLASSE_DO_CAMPO =
  'h-12 w-full min-w-0 rounded-xl border-2 border-border bg-card px-3 text-base text-text placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-4 focus:ring-accent/25';

const TIPOS = {
  texto: { mascara: (v) => v, valido: (v) => v.trim() !== '', paraGravar: (v) => v.trim(), mode: 'text', vazioOk: false },
  textoOpcional: { mascara: (v) => v, valido: () => true, paraGravar: (v) => v.trim(), mode: 'text', vazioOk: true },
  hora: {
    mascara: mascaraHora,
    valido: (v) => !!normalizaHora(v),
    paraGravar: (v) => normalizaHora(v),
    mode: 'numeric',
    vazioOk: false,
    erro: 'Hora inválida. Ex: 06:20',
  },
  telefone: {
    mascara: maskPhone,
    valido: (v) => !v.trim() || isValidPhone(v),
    paraGravar: (v) => unmaskPhone(v),
    mode: 'tel',
    vazioOk: true,
    erro: 'Telefone com DDD.',
  },
  numero: { mascara: (v) => v.slice(0, 12), valido: (v) => v.trim() !== '', paraGravar: (v) => v.trim(), mode: 'text', vazioOk: false },
};

/**
 * Um campo de texto que grava ao sair. `valorSalvo` é o do banco (a escuta);
 * quem chama remonta o campo quando ele muda (`key`), então o que aparece é
 * sempre o que está gravado — menos enquanto ele digita.
 *
 * Só grava quando MUDOU e é válido. Vazio, num campo que não aceita vazio
 * (nome, hora), volta ao valor salvo: apagar o nome sem querer não pode virar
 * criança sem nome.
 */
export function CampoQueSalva({ rotulo, extra, tipo = 'texto', valorSalvo = '', estado, onSalvar, onTentar, autoFocus }) {
  const id = useId();
  const t = TIPOS[tipo];
  const [valor, setValor] = useState(() => t.mascara(String(valorSalvo || '')));
  const [erro, setErro] = useState('');

  const sair = () => {
    const limpo = String(valor || '');
    if (!limpo.trim() && !t.vazioOk) {
      setValor(t.mascara(String(valorSalvo || '')));
      setErro('');
      return;
    }
    if (!t.valido(limpo)) {
      setErro(t.erro || '');
      return;
    }
    setErro('');
    const novo = limpo.trim() ? t.paraGravar(limpo) : '';
    if (novo === (tipo === 'telefone' ? unmaskPhone(valorSalvo) : String(valorSalvo || '').trim())) return;
    onSalvar(novo);
  };

  return (
    <div>
      <RotuloDoCampo htmlFor={id} rotulo={rotulo} extra={extra} estado={estado} onTentar={onTentar} />
      <input
        id={id}
        type="text"
        inputMode={t.mode}
        autoComplete="off"
        autoFocus={autoFocus}
        value={valor}
        aria-invalid={erro ? true : undefined}
        onChange={(e) => {
          setErro('');
          setValor(t.mascara(e.target.value));
        }}
        onBlur={sair}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        enterKeyHint="done"
        placeholder="Digite aqui"
        className={`${CLASSE_DO_CAMPO} ${erro ? '!border-danger' : ''}`}
      />
      {erro && <p className="mt-1 text-sm font-semibold text-dangerText">{erro}</p>}
    </div>
  );
}

/** Duas escolhas grandes lado a lado (menino/menina). Grava no toque. */
export function EscolhaQueSalva({ rotulo, opcoes, valor, estado, onSalvar, onTentar }) {
  return (
    <div>
      <RotuloDoCampo rotulo={rotulo} estado={estado} onTentar={onTentar} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={rotulo}>
        {opcoes.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={valor === o.value}
            onClick={() => valor !== o.value && onSalvar(o.value)}
            className={`tap min-h-12 rounded-xl border-2 px-2 text-base font-semibold ${
              valor === o.value ? 'border-primary bg-primarySoft text-text' : 'border-border bg-card text-textMuted'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
