import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, ChevronRight, Circle, Medal } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNivelDaFamilia } from '../../hooks/useNivelDaFamilia';
import { fraseDoNivel } from '../../dominio/identidade/nivelDaFamilia.js';
import Sheet from '../common/Sheet';
import SeloDoNivel from './SeloDoNivel';
import EstradaDosNiveis from './EstradaDosNiveis';
import { ESTRADA_DA_FAMILIA, NOME_DO_NIVEL, fraseDoSonho } from './rotuloDoNivel';

/**
 * O NÍVEL DA FAMÍLIA — Bronze, Prata e Ouro
 * (`dominio/identidade/nivelDaFamilia.js`).
 *
 * SÓ ELA VÊ. O motorista não tem tela nenhuma com este selo, e o nível não é
 * gravado: o hook calcula no aparelho dela.
 *
 * ── O QUE A FOLHA DIZ
 * O selo grande, UMA frase sobre o combinado (nunca "bom pagador": a regra só
 * é dita a quem tocou para perguntar) e o que falta para o próximo nível, com
 * o caminho para cada item. Perder o Ouro não tem aviso — o selo só muda, e a
 * folha diz como ele volta. Ganhar o Ouro tem UM aviso por aparelho.
 */
const ITENS = [
  {
    chave: 'avisosLigados',
    nivel: 'bronze',
    texto: 'Ativar os avisos do app',
    destino: '/pai/profile',
  },
  {
    chave: 'segundoResponsavel',
    nivel: 'prata',
    texto: 'Cadastrar o segundo responsável',
    destino: '/pai/child',
  },
  {
    chave: 'ultimaAvisadaNoApp',
    nivel: 'prata',
    texto: 'Avisar pelo "Já paguei" quando pagar a mensalidade',
    destino: '/pai/finance',
  },
  {
    chave: 'mesesEmDia',
    nivel: 'ouro',
    texto: 'As 2 últimas mensalidades até o vencimento',
    destino: '/pai/finance',
  },
  {
    chave: 'faltasAvisadas',
    nivel: 'ouro',
    texto: 'Falta avisada até 1 hora antes da perua',
    destino: null,
  },
];

function dataCurta(chave) {
  if (!chave) return null;
  const [, m, d] = chave.split('-');
  return `${d}/${m}`;
}

/**
 * UM aviso quando ela chega ao Ouro, por aparelho. Mora no Início do /pai
 * (era o selo do cabeçalho do Início quem fazia isso, até 04/10/2026).
 * Guardado só o último nível visto — nunca valor nem data de pagamento.
 */
export function AvisoDoOuroDaFamilia() {
  const { user } = useAuth();
  const nivel = useNivelDaFamilia();
  const chave = nivel?.nivel || 'sem_nivel';

  useEffect(() => {
    if (!user?.uid || !nivel) return;
    const k = `nivelDaFamilia:${user.uid}`;
    let antes;
    try {
      antes = localStorage.getItem(k);
    } catch {
      return;
    }
    if (chave === 'ouro' && antes && antes !== 'ouro') {
      toast.success('Você chegou ao Ouro. O combinado com o tio anda certinho.');
    }
    try {
      localStorage.setItem(k, chave);
    } catch {
      /* sem armazenamento, sem aviso — o selo continua certo */
    }
  }, [user?.uid, nivel, chave]);

  return null;
}

/**
 * O NÍVEL NO MENU DO PERFIL DA FAMÍLIA (modelo D2, 04/10/2026): o mesmo
 * desenho do motorista — selo de metal, a estrada (três níveis), a próxima
 * coisa a fazer e o botão forte que abre a folha com o caminho inteiro.
 *
 * ⚠️ SEM "FEITO ONTEM": o nível dela é calculado no aparelho e nada é
 * gravado (nota de pagamento guardada seria cadastro de consumidor), então
 * não existe data de quando cada item foi feito. Só monta com o menu aberto.
 */
export function NivelDaFamiliaNoMenu({ onAbrir, onIr }) {
  const nivel = useNivelDaFamilia();
  const chave = nivel?.nivel || 'sem_nivel';
  const [vendo, setVendo] = useState(null);
  if (!nivel || chave === 'sem_nivel') return null;

  const olhando = vendo || chave;
  const itens = ITENS.filter((i) => nivel.temMensalidades || i.nivel !== 'ouro');
  const proxima = itens.find((i) => !nivel.itens[i.chave]) || null;
  const iAlvo = ESTRADA_DA_FAMILIA.indexOf(olhando);
  const faltam = iAlvo > ESTRADA_DA_FAMILIA.indexOf(chave)
    ? itens.filter((i) => ESTRADA_DA_FAMILIA.indexOf(i.nivel) <= iAlvo && !nivel.itens[i.chave]).length
    : null;

  return (
    <div className="space-y-2.5 border-t border-neutro p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold text-text">Meu nível</span>
        <SeloDoNivel nivel={olhando} />
      </div>
      <EstradaDosNiveis estrada={ESTRADA_DA_FAMILIA} atual={chave} vendo={olhando} onVer={setVendo} />
      {fraseDoSonho({ vendo: olhando, atual: chave, estrada: ESTRADA_DA_FAMILIA, faltam }) && (
        <p className="text-sm leading-snug text-textMuted">
          {fraseDoSonho({ vendo: olhando, atual: chave, estrada: ESTRADA_DA_FAMILIA, faltam })}
        </p>
      )}
      {proxima && (
        <button
          type="button"
          role="menuitem"
          onClick={() => (proxima.destino ? onIr(proxima.destino) : onAbrir())}
          className="tap flex w-full items-center gap-2.5 rounded-xl border-2 border-border bg-card px-3 py-2.5 text-left"
        >
          <Circle size={20} className="shrink-0 text-textMuted" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-textMuted">Próxima</span>
            <span className="block text-base font-bold leading-snug text-text">{proxima.texto}</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-textMuted" aria-hidden />
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={onAbrir}
        className="tap flex h-12 w-full items-center justify-center gap-1 rounded-xl border-2 border-primary bg-card text-base font-bold text-primary"
      >
        Abrir missões
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}

/**
 * A folha do nível da família, aberta pelo menu do perfil. Montada só depois
 * do primeiro toque (quem nunca abre não paga a conta).
 */
export function FolhaDoNivelDaFamilia({ open, onClose }) {
  const nivel = useNivelDaFamilia();
  const navigate = useNavigate();
  const chave = nivel?.nivel || 'sem_nivel';

  if (!nivel || chave === 'sem_nivel') return null;

  const vence = nivel.proximoVencimento ? new Date(nivel.proximoVencimento).getDate() : null;
  const frase = fraseDoNivel(nivel, { diaDoVencimento: vence });
  // Sem mensalidade no app, o Ouro não existe — a lista não o promete.
  const itens = ITENS.filter((i) => nivel.temMensalidades || i.nivel !== 'ouro');
  const ir = (destino) => {
    onClose();
    navigate(destino);
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Família ${NOME_DO_NIVEL[chave]}`} icon={Medal}>
      <div className="space-y-5 pb-1">
        <div className="flex justify-center pt-1">
          <SeloDoNivel nivel={chave} tamanho="grande" />
        </div>
        <p className="text-lg leading-relaxed text-text">{frase}</p>
        {chave !== 'ouro' && !nivel.itens.faltasAvisadas && nivel.faltaSaiDaJanelaEm && (
          <p className="text-base text-textMuted">
            A falta avisada em cima da hora deixa de contar em {dataCurta(nivel.faltaSaiDaJanelaEm)}.
          </p>
        )}

        <div>
          <p className="mb-2 text-base font-bold text-text">
            {chave === 'ouro' ? 'Para continuar no Ouro' : 'O caminho até o Ouro'}
          </p>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {itens.map((item) => {
              const feito = !!nivel.itens[item.chave];
              const conteudo = (
                <>
                  {feito ? (
                    <Check size={22} className="shrink-0 text-accentText" aria-hidden />
                  ) : (
                    <Circle size={22} className="shrink-0 text-textMuted" aria-hidden />
                  )}
                  <span className={`flex-1 text-base ${feito ? 'text-textMuted' : 'text-text'}`}>
                    {item.texto}
                  </span>
                  <span className="text-sm font-semibold text-textMuted">{NOME_DO_NIVEL[item.nivel]}</span>
                  {!feito && item.destino && <ChevronRight size={20} className="shrink-0 text-textMuted" aria-hidden />}
                </>
              );
              return (
                <li key={item.chave}>
                  {!feito && item.destino ? (
                    <button
                      type="button"
                      onClick={() => ir(item.destino)}
                      className="tap flex min-h-14 w-full items-center gap-3 px-4 text-left"
                    >
                      {conteudo}
                    </button>
                  ) : (
                    <div className="flex min-h-14 items-center gap-3 px-4">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-sm text-textMuted">
          Só você vê o seu selo. O tio não vê.
        </p>
      </div>
    </Sheet>
  );
}
