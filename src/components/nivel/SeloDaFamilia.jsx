import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, ChevronRight, Circle, Medal } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNivelDaFamilia } from '../../hooks/useNivelDaFamilia';
import { fraseDoNivel } from '../../dominio/identidade/nivelDaFamilia.js';
import Sheet from '../common/Sheet';
import SeloDoNivel from './SeloDoNivel';
import { NOME_DO_NIVEL } from './rotuloDoNivel';

/**
 * O SELO DA FAMÍLIA no cabeçalho do /pai — Bronze, Prata e Ouro
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

export default function SeloDaFamilia() {
  const { user } = useAuth();
  const nivel = useNivelDaFamilia();
  const navigate = useNavigate();
  const [aberta, setAberta] = useState(false);
  const chave = nivel?.nivel || 'sem_nivel';

  // UM aviso quando chega ao Ouro, por aparelho. Guardado só o último nível
  // visto — nunca valor nem data de pagamento.
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

  if (!nivel || chave === 'sem_nivel') return null;

  const vence = nivel.proximoVencimento ? new Date(nivel.proximoVencimento).getDate() : null;
  const frase = fraseDoNivel(nivel, { diaDoVencimento: vence });
  // Sem mensalidade no app, o Ouro não existe — a lista não o promete.
  const itens = ITENS.filter((i) => nivel.temMensalidades || i.nivel !== 'ouro');
  const ir = (destino) => {
    setAberta(false);
    navigate(destino);
  };

  return (
    <>
      <SeloDoNivel nivel={chave} tamanho="pequeno" onClick={() => setAberta(true)} />
      <Sheet
        open={aberta}
        onClose={() => setAberta(false)}
        title={`Família ${NOME_DO_NIVEL[chave]}`}
        icon={Medal}
      >
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
    </>
  );
}
