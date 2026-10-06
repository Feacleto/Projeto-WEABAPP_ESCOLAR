import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { LogoMark } from '../components/common/Logo';
import Spinner from '../components/common/Spinner';
import { useCartaoDoTio } from '../hooks/useCartaoDoTio';
import { paletaDaMarca } from '../marca/corDaMarca.js';
import { iniciaisDaMarca, subtituloDoTio } from '../marca/folhaDaMarca.js';
import {
  MENSAGEM_DE_QUEM_VIU_O_CARTAO,
  botaoDoCartaoDoTio,
  fraseDoCartaoDoTio,
} from '../marca/mensagensDoLink.js';
import { linkDoZap } from '../dominio/identidade/auxiliar.js';

/**
 * CONHEÇA O TIO — `/conheca/:uid` (05/10/2026, decisão do dono).
 *
 * A página que o "Mandar meu cartão a uma família" da folha da marca abre:
 * uma família NOVA conhece o tio. Pública, sem conta e sem sessão. Ela só
 * APRESENTA: o logo e a cor dele, o nome da marca, de onde ele é, uma frase
 * sobre o app e UM botão cheio, que abre o WhatsApp dele com a mensagem
 * pronta. Não é porta de entrada no app — a família só entra pelo convite de
 * uma criança cadastrada.
 *
 * ⚠️ SEM DADO DE CRIANÇA E SEM PREÇO. Os dados vêm da callable pública
 * `verCartaoDoTio`, que devolve seis campos e nada mais.
 * ⚠️ SEM LINK PARA OUTROS TIOS NEM LISTA NENHUMA: não existe busca de
 * motorista (docs/marca.md, declaração 5). Quem chega aqui chegou pelo link
 * que ELE mandou.
 * ⚠️ NUNCA INDEXADA: o hosting manda `X-Robots-Tag: noindex` em
 * `/conheca/**`, e a página repete a meta (o index.html já diz `noindex`;
 * aqui ela vira também `nofollow`).
 */
export default function Conheca() {
  const { uid } = useParams();
  const cartao = useCartaoDoTio(uid);

  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]');
    const antes = meta?.getAttribute('content');
    meta?.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (meta && antes) meta.setAttribute('content', antes);
    };
  }, []);

  if (!cartao) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface">
        <Spinner size={28} />
      </main>
    );
  }

  if (!cartao.vale) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4 text-center">
        <p className="font-display text-2xl font-extrabold text-text">{cartao.frase}</p>
        <Assinatura />
      </main>
    );
  }

  const cor = paletaDaMarca(cartao.cor);
  const faixa = cor ? { backgroundColor: cor.marca, color: cor.naMarca } : undefined;
  const circulo = cor ? { backgroundColor: cor.marca, color: cor.naMarca } : undefined;

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <div className="mx-auto flex w-full max-w-mobile flex-1 flex-col">
        <section style={faixa} className={`flex flex-col items-center gap-4 px-4 pb-8 pt-12 text-center ${cor ? '' : 'bg-primary text-white'}`}>
          {cartao.logoURL ? (
            <span className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full bg-white p-5" style={{ boxShadow: '0 0 0 8px rgba(255,255,255,.35)' }}>
              <img src={cartao.logoURL} alt="" className="h-full w-full object-contain" />
            </span>
          ) : (
            <span aria-hidden="true" className="flex h-40 w-40 items-center justify-center rounded-full bg-white font-display text-6xl font-extrabold" style={{ color: cor?.primary || undefined, boxShadow: '0 0 0 8px rgba(255,255,255,.35)' }}>
              <span className={cor ? '' : 'text-primary'}>{iniciaisDaMarca(cartao.marca)}</span>
            </span>
          )}
          <h1 className="font-display text-4xl font-extrabold leading-tight">{cartao.marca}</h1>
          <p className="text-lg font-semibold">{subtituloDoTio({ regiao: cartao.bairro, city: cartao.cidade })}</p>
        </section>

        <section className="flex flex-1 flex-col gap-6 px-4 py-8">
          <p className="text-lg leading-relaxed text-text">{fraseDoCartaoDoTio(cartao.marca)}</p>
          {cartao.whatsapp && (
            <a
              href={linkDoZap(cartao.whatsapp, MENSAGEM_DE_QUEM_VIU_O_CARTAO)}
              target="_blank"
              rel="noreferrer"
              style={circulo}
              className={`tap flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 text-lg font-bold shadow-focus ${cor ? '' : 'bg-primary text-white'}`}
            >
              <MessageCircle size={22} aria-hidden="true" />
              {botaoDoCartaoDoTio(cartao.marca)}
            </a>
          )}
        </section>

        <Assinatura />
      </div>
    </main>
  );
}

/** O Alô Buzinou assina discreto, pela cor e não pelo tamanho (16px). */
function Assinatura() {
  return (
    <p className="flex items-center justify-center gap-2 pb-8 pt-2 text-base text-textMuted">
      <LogoMark height={22} />
      Alô Buzinou
    </p>
  );
}
