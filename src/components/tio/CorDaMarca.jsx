import { useState } from 'react';
import { Check, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import { setMarca } from '../../services/userService';
import { lerCoresDoLogo } from '../../services/coresDoLogoService';
import { opcoesDoLogo, paletaDaMarca } from '../../marca/corDaMarca.js';
import Sheet from '../common/Sheet';

/** O verde da casa — a volta garantida, sempre a última opção. */
const VERDE_DA_CASA = '#1F5F3F';

/**
 * A COR DO APP DELE, ESCOLHIDA ENTRE AS DO LOGO (03/10/2026, pedido do dono).
 *
 * Três bolinhas: a cor principal do logo, a segunda e o verde do Alô Buzinou.
 * Trocar é um toque, sem confirmar nada — cor é preferência e volta atrás com
 * outro toque. A amostra é a COR VIVA que o app vai usar nas faixas e nos
 * botões (`marca`), não a cor crua: mostrar uma e aplicar outra seria a tela
 * mentindo.
 *
 * Logo sem cor viva (preto, branco, cinza) não oferece nada, e a linha diz
 * por quê. Logo antigo, subido antes da cor existir, ganha "Usar as cores do
 * meu logo".
 */
export default function CorDaMarca({ uid, logoURL, cor, cores = [], onChanged }) {
  const [salvando, setSalvando] = useState(false);
  const [lidas, setLidas] = useState(null); // null = não tentou ler

  const sugeridas = cores.length ? cores : lidas || [];
  const escolher = async (nova) => {
    setSalvando(true);
    try {
      await setMarca(uid, { cor: nova, ...(lidas ? { cores: lidas } : {}) });
      await onChanged?.();
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra trocar a cor agora.');
    } finally {
      setSalvando(false);
    }
  };

  const lerDoLogo = async () => {
    setSalvando(true);
    const achadas = await lerCoresDoLogo(logoURL);
    setLidas(achadas);
    if (achadas.length) {
      try {
        await setMarca(uid, { cor: achadas[0], cores: achadas });
        await onChanged?.();
      } catch (err) {
        console.error(err);
        toast.error('Não deu pra salvar a cor agora.');
      }
    }
    setSalvando(false);
  };

  const opcoes = opcoesDoLogo(sugeridas);

  return (
    <div className="space-y-2.5 border-t border-neutro pt-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
        <Palette size={16} className="text-primary" />
        Cor do seu app
      </p>

      <div className="flex flex-wrap items-center gap-2.5">
        {opcoes.map((c, i) => (
          <Amostra
            key={c}
            cor={paletaDaMarca(c).marca}
            ativa={cor?.toUpperCase() === c.toUpperCase()}
            rotulo={i === 0 ? 'Cor principal do logo' : 'Segunda cor do logo'}
            disabled={salvando}
            onClick={() => escolher(c)}
          />
        ))}
        {/* O verde da casa sempre aparece: é a volta garantida. */}
        <Amostra
          cor={VERDE_DA_CASA}
          ativa={!cor || !paletaDaMarca(cor)}
          rotulo="Verde do Alô Buzinou"
          disabled={salvando}
          onClick={() => escolher(null)}
        />
      </div>

      {logoURL && !cores.length && lidas === null && (
        <button
          type="button"
          onClick={lerDoLogo}
          disabled={salvando}
          className="tap min-h-12 text-base font-semibold text-primary underline underline-offset-2"
        >
          Usar as cores do meu logo
        </button>
      )}
      {lidas !== null && !lidas.length && (
        <p className="text-sm text-textMuted">
          Não achamos uma cor forte no logo. Envie o logo de novo, ou fique com o verde do Alô Buzinou.
        </p>
      )}
      <p className="text-sm leading-relaxed text-textMuted">
        A cor do logo, a segunda cor do logo, ou o verde do Alô Buzinou. Vale
        para você e para as famílias que você atende.
      </p>
    </div>
  );
}

/**
 * A PERGUNTA, LOGO DEPOIS DE TROCAR O LOGO (04/10/2026, aprovado pelo dono).
 *
 * Antes a cor mais forte do logo era aplicada sozinha — e ela muda o app das
 * FAMÍLIAS dele também, que é decisão demais para acontecer calada. Agora a
 * folha mostra uma prévia do app pintado na cor e pergunta. Nada muda para
 * ninguém antes do "Usar esta cor"; "Ficar com o verde" grava o verde.
 *
 * A prévia é desenhada com a cor do CANDIDATO (estilo em linha), não com o
 * tema da tela: o app atrás continua na cor de antes enquanto ele decide.
 */
export function PerguntaDaCor({ open, cores = [], logoURL, nome, salvando, onUsar, onVerde, onClose }) {
  const opcoes = opcoesDoLogo(cores);
  const [tocada, setEscolhida] = useState(null);
  // Logo novo, cores novas: a escolha que não está mais entre elas volta
  // para a principal.
  const escolhida = opcoes.includes(tocada) ? tocada : opcoes[0] || null;

  const p = escolhida ? paletaDaMarca(escolhida) : null;
  if (!p) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Achamos a cor do seu logo">
      <div className="space-y-4 pb-1">
        {/* A PRÉVIA: o cabeçalho do Início e o botão principal, na cor. */}
        <div className="overflow-hidden rounded-2xl border border-border bg-bg">
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: `linear-gradient(135deg, ${p.marca}, ${p.marcaEscuro})`, color: p.naMarca }}
          >
            {logoURL && (
              <img src={logoURL} alt="" className="h-11 w-auto max-w-[120px] rounded-lg bg-white object-contain p-[3px]" />
            )}
            <span className="truncate font-display text-lg font-bold">{nome || 'Seu app'}</span>
          </div>
          <div className="p-3">
            <span
              className="flex h-12 items-center justify-center rounded-xl text-base font-bold"
              style={{ background: p.marca, color: p.naMarca }}
            >
              Iniciar a rota
            </span>
          </div>
        </div>

        <p className="text-lg font-semibold leading-snug text-text">
          Usar assim no seu app e no de todas as suas famílias?
        </p>

        {opcoes.length > 1 && (
          <div className="flex items-center gap-2.5">
            {opcoes.map((c, i) => (
              <Amostra
                key={c}
                cor={paletaDaMarca(c).marca}
                ativa={c === escolhida}
                rotulo={i === 0 ? 'Cor principal do logo' : 'Segunda cor do logo'}
                disabled={salvando}
                onClick={() => setEscolhida(c)}
              />
            ))}
            <span className="text-sm text-textMuted">as cores do seu logo</span>
          </div>
        )}

        <button
          type="button"
          disabled={salvando}
          onClick={() => onUsar(escolhida)}
          className="tap flex min-h-14 w-full items-center justify-center rounded-xl text-lg font-bold disabled:opacity-60"
          style={{ background: p.marca, color: p.naMarca }}
        >
          Usar esta cor
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={onVerde}
          className="tap flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-base font-semibold text-textBody disabled:opacity-60"
        >
          Ficar com o verde do Alô Buzinou
        </button>
      </div>
    </Sheet>
  );
}

function Amostra({ cor, ativa, rotulo, disabled, onClick }) {
  const p = paletaDaMarca(cor);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      aria-pressed={ativa}
      title={rotulo}
      className={`tap flex h-12 w-12 items-center justify-center rounded-full ring-offset-2 ${
        ativa ? 'ring-2 ring-text' : ''
      }`}
      style={{ backgroundColor: cor }}
    >
      {ativa && <Check size={20} style={{ color: p?.naMarca || '#FFFFFF' }} />}
    </button>
  );
}
