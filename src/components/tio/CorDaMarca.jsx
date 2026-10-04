import { useState } from 'react';
import { Check, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import { setMarca } from '../../services/userService';
import { lerCoresDoLogo } from '../../services/coresDoLogoService';
import { paletaDaMarca } from '../../marca/corDaMarca.js';

/**
 * A COR DO APP DELE, ESCOLHIDA ENTRE AS DO LOGO (03/10/2026, pedido do dono).
 *
 * Trocar o logo já aplica a cor mais forte sozinho (ver `MarcaCard`). Aqui
 * ele vê as outras sugestões do logo e o verde do Alô Buzinou, e troca com um
 * toque — sem confirmar nada, porque cor é preferência e volta atrás com
 * outro toque. A amostra é a cor JÁ AJUSTADA para leitura (a mesma que o app
 * vai usar), não a cor crua do logo: mostrar uma e aplicar outra seria a
 * tela mentindo.
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

  const opcoes = sugeridas.filter((c) => paletaDaMarca(c));

  return (
    <div className="space-y-2.5 border-t border-neutro pt-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
        <Palette size={16} className="text-primary" />
        Cor do seu app
      </p>

      <div className="flex flex-wrap items-center gap-2.5">
        {opcoes.map((c) => (
          <Amostra
            key={c}
            cor={paletaDaMarca(c).primary}
            ativa={cor?.toUpperCase() === c.toUpperCase()}
            rotulo="Cor do logo"
            disabled={salvando}
            onClick={() => escolher(c)}
          />
        ))}
        {/* O verde da casa sempre aparece: é a volta garantida. */}
        <Amostra
          cor="#1F5F3F"
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
          className="tap text-sm font-semibold text-primary underline underline-offset-2"
        >
          Usar as cores do meu logo
        </button>
      )}
      {lidas !== null && !lidas.length && (
        <p className="text-sm text-textMuted">
          Não achamos uma cor forte no logo. Envie o logo de novo, ou fique com o verde do Alô Buzinou.
        </p>
      )}
      <p className="text-xs leading-relaxed text-textMuted">
        É a cor do seu app e do app das famílias que você atende.
      </p>
    </div>
  );
}

function Amostra({ cor, ativa, rotulo, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      aria-pressed={ativa}
      title={rotulo}
      className={`tap flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 ${
        ativa ? 'ring-2 ring-text' : ''
      }`}
      style={{ backgroundColor: cor }}
    >
      {ativa && <Check size={20} className="text-white" />}
    </button>
  );
}
