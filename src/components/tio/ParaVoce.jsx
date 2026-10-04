import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Clock, FileBarChart2, Lock, Route, Target } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNivel } from '../../hooks/useNivel';
import { useFatosDoNivel } from '../../hooks/useFatosDoNivel';
import { useAtividadesDaPlatina } from '../../hooks/useAtividadesDaPlatina';
import { useCobrancaLigada } from '../../hooks/useCobrancaLigada';
import { lerBoletimVisto } from '../../hooks/useBoletim';
import { boletimParaAnunciar } from '../../dominio/cobranca/boletim.js';
import { calcularNivel } from '../../dominio/identidade/nivel.js';
import { faseDeHoje, itemDoParaVoce, posicao } from '../../dominio/identidade/paraVoce.js';
import { ZonaDaPlataforma } from '../common/TemaDaMarca';
import SeloDoNivel from '../nivel/SeloDoNivel';
import { chaveDoNivel, listaDeAtividades } from '../nivel/rotuloDoNivel';

/**
 * "PARA VOCÊ" — UMA linha no fim do Início, no verde da casa (04/10/2026).
 * Quem decide o que ela diz é `itemDoParaVoce` (dominio/identidade/paraVoce.js,
 * `npm run testar:para-voce`); aqui só se junta o que o aparelho e o banco
 * sabem e se desenha a linha no mesmo molde de "Meu transporte".
 *
 * Ela substituiu o aviso único do Bronze e o cartão do prazo da Platina, que
 * ficavam ACIMA do cartão verde: agora só um lugar fala de nível, e o topo
 * fica com o dia dele.
 */
const ICONES = {
  ambiente: Building2,
  boletim: FileBarChart2,
  missao: Target,
  senha: Lock,
  trilha: Route,
  platina: Clock,
};

// O último nível que a linha já celebrou, por aparelho. O aviso antigo do
// Bronze guardava a própria chave: quem já o viu não recebe o Bronze de novo.
const chaveDoVisto = (uid) => `alobuzinou:nivelVisto:${uid}`;
function lerNivelVisto(uid) {
  try {
    const salvo = window.localStorage.getItem(chaveDoVisto(uid));
    if (salvo) return salvo;
    return window.localStorage.getItem(`alobuzinou:avisoDoBronze:${uid}`) === '1' ? 'bronze' : 'sem_nivel';
  } catch {
    return 'sem_nivel';
  }
}
function gravarNivelVisto(uid, nivel) {
  try {
    window.localStorage.setItem(chaveDoVisto(uid), nivel);
  } catch {
    /* sem armazenamento: a celebração volta a aparecer, é o mal menor */
  }
}

export default function ParaVoce({ foraDaRota, emDia, criancas = 0, familias = 0, className = '' }) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const uid = user?.uid || null;
  const { nivel: nivelBruto } = useNivel(uid);
  const nivel = chaveDoNivel(nivelBruto);
  const { fatos } = useFatosDoNivel();
  const atividades = listaDeAtividades(useAtividadesDaPlatina());
  const cobrancaLigada = useCobrancaLigada();
  const [nivelVisto, setNivelVisto] = useState(() => (uid ? lerNivelVisto(uid) : 'sem_nivel'));

  const item = useMemo(() => {
    const agora = new Date();
    const resultado = fatos ? calcularNivel(fatos, { atividades, agora }) : null;
    const platina = resultado
      ? resultado.platina.atividades
          .filter((a) => !a.feita && !a.vencida)
          .sort((a, b) => a.diasRestantes - b.diasRestantes)[0] || null
      : null;
    const senha = resultado?.missoes.find((m) => m.id === 'senhaDoFinanceiro');
    return itemDoParaVoce({
      foraDaRota,
      emDia,
      teste: {
        cobrancaLigada: cobrancaLigada === true,
        jaContratou: Boolean(profile?.plano),
        trialInicio: profile?.trialInicio || null,
        criancas,
        familias,
      },
      boletimMes: uid ? boletimParaAnunciar(agora.getTime(), lerBoletimVisto(uid)) : null,
      nivel,
      nivelVisto,
      platina: platina ? { titulo: platina.titulo, diasRestantes: platina.diasRestantes } : null,
      proximo: resultado?.proximo || null,
      senhaCriada: senha ? senha.feita : true,
      faseDoNegocio: resultado ? faseDeHoje(resultado.trilha?.fases) : null,
      agora,
    });
  }, [foraDaRota, emDia, cobrancaLigada, profile, criancas, familias, uid, nivel, nivelVisto, fatos, atividades]);

  if (!item) return null;

  const Icone = ICONES[item.icone];
  const tocar = () => {
    // Celebrar um nível é uma vez: tocou, a linha não volta para ele.
    if (item.tipo === 'nivel' && uid && posicao(nivel) > posicao(nivelVisto)) {
      gravarNivelVisto(uid, nivel);
      setNivelVisto(nivel);
    }
    navigate(item.destino);
  };

  return (
    <ZonaDaPlataforma className={className}>
      <button
        type="button"
        onClick={tocar}
        className="tap flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left"
      >
        {item.icone === 'selo' ? (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center">
            <SeloDoNivel nivel={item.nivel} />
          </span>
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primaryChip text-primary">
            {Icone && <Icone size={20} aria-hidden="true" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-text">{item.frase}</span>
          <span className="block text-sm font-bold text-primary">{item.toque}</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-textMuted" aria-hidden="true" />
      </button>
    </ZonaDaPlataforma>
  );
}
