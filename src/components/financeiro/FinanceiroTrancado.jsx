import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ChevronRight, Fuel, LockKeyhole, ReceiptText, Users } from 'lucide-react';
import IconePix from '../common/IconePix';
import MolduraDoFinanceiro from './MolduraDoFinanceiro';
import DigiteASenhaDoFinanceiro from './DigiteASenhaDoFinanceiro';
import FolhaDeDespesa from './FolhaDeDespesa';
import PixSheet from '../payments/PixSheet';
import { useAuth } from '../../hooks/useAuth';
import { useChildren } from '../../hooks/useChildren';
import { useCriancasInativas } from '../../hooks/useCriancasInativas';
import { useCobrancaLigada } from '../../hooks/useCobrancaLigada';
import { useFaturaPlataforma } from '../../hooks/useFaturaPlataforma';
import { useTrancaDoFinanceiro } from '../../hooks/useTrancaDoFinanceiro';
import { biometriaLigada, conferirBiometria } from '../../services/biometriaService';
import { BUZI, CAIXA, TAXA, TURMA } from '../../dominio/identidade/trancaDoFinanceiro.js';
import { boletimParaAnunciar, nomeDoMes } from '../../dominio/cobranca/boletim.js';
import { lerBoletimVisto } from '../../hooks/useBoletim';
// A MESMA régua da porta "Turma e contratos" do caixa e da tela da turma —
// eram duas na integração (03/10/2026), e duas contas da mesma turma acabam
// discordando no dia em que uma muda.
import { frasesDoMovimento, resumoDaTurma } from '../../dominio/identidade/movimentoDaTurma.js';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
import { seloDoPlano } from '../../dominio/associacao/seloDoPlano.js';

/**
 * A TELA TRANCADA DO FINANCEIRO (03/10/2026) — o protótipo aprovado pelo
 * dono, com o desenho de um app de banco: a saudação, a porta grande, e o que
 * se pode ver SEM a senha.
 *
 * A PORTA GRANDE É O ÚNICO VERDE CHEIO (04/10/2026, item 15). Era branca, e o
 * verde era o Abastecer: quem chega cansado toca no que mais chama, e a tela
 * cujo nome é "Financeiro" mandava para o posto. O resto é branco.
 * ⚠️ DESDE 04/10/2026 (mais tarde, decisão do dono) O VERDE É O BUZI —
 * "Boletim do seu negócio", o assistente que responde em linguagem simples.
 * "Abrir caixa" continua logo abaixo, branco: é a mesma senha,
 * para quem quer o caixa inteiro. Do dia 1 ao 7 o cartão anuncia o Boletim
 * do mês que fechou, até ele abrir (`boletimParaAnunciar`).
 *
 * O QUE APARECE SEM SENHA É O QUE NÃO É DINHEIRO:
 *   - Minha turma: quantas crianças, quantas entraram e saíram no mês
 *   - Mostrar meu PIX: só mostrar, nunca trocar (ver PixSheet)
 *   - Lançar despesa: lança, e o histórico aparece sem os valores
 *   - Meu plano: o nome e o selo — o valor da fatura só com senha
 * Os dois quadrados do meio funcionam sem senha de propósito: são as duas
 * coisas que ele faz no portão, com alguém do lado.
 *
 * Tocar num destino pede a digital primeiro (se ligada neste aparelho);
 * cancelar a digital cai no teclado. Entrar por "Minha turma" ou "Meu plano"
 * abre SÓ aquela tela — o voltar de lá traz de novo a tela trancada (regra
 * em `dominio/identidade/trancaDoFinanceiro.js`).
 */
export default function FinanceiroTrancado() {
  const { user, profile } = useAuth();
  const tranca = useTrancaDoFinanceiro();
  const navigate = useNavigate();
  const comDigital = biometriaLigada(user?.uid);
  const [pedindo, setPedindo] = useState(null);
  const [folha, setFolha] = useState(null);

  // A turma: as ativas vêm do mesmo hook do layout (o SDK compartilha a
  // escuta da mesma consulta); as que saíram, de uma consulta própria.
  const { children: ativas } = useChildren();
  const inativas = useCriancasInativas();
  const agora = useMemo(() => new Date(), []);
  const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const resumo = resumoDaTurma({
    criancas: [...(ativas || []).map((c) => ({ ...c, active: true })), ...(inativas || [])],
    mes,
  });
  const frases = {
    ...frasesDoMovimento(resumo),
    total: resumo.ativas === 1 ? '1 criança' : `${resumo.ativas} crianças`,
  };

  // O plano só existe com a cobrança da plataforma ligada.
  const cobranca = useCobrancaLigada();
  const { fatura } = useFaturaPlataforma(cobranca ? user?.uid : null);
  const plano = seloDoPlano({
    plano: profile?.plano || null,
    fatura,
    trialInicio: profile?.trialInicio || null,
    assinaturaAte: profile?.assinaturaAte || null,
    agora,
  });

  const anunciar = boletimParaAnunciar(agora.getTime(), lerBoletimVisto(user?.uid));

  const acessar = async (destino) => {
    if (comDigital && (await conferirBiometria(user?.uid))) {
      tranca.abrirCom(destino);
      return;
    }
    setPedindo(destino);
  };

  if (pedindo) {
    return <DigiteASenhaDoFinanceiro destino={pedindo} onVoltar={() => setPedindo(null)} />;
  }

  const primeiroNome = (profile?.name || '').trim().split(/\s+/)[0] || '';
  const iniciais = iniciaisDe(profile?.marcaNome || profile?.name || '');

  return (
    <MolduraDoFinanceiro>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="w-[52px] h-[52px] shrink-0 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold"
        >
          {iniciais}
        </span>
        <div className="min-w-0">
          <p className="text-xl font-bold text-text truncate">
            {primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}
          </p>
          {profile?.marcaNome && (
            <p className="text-[15px] text-textMuted truncate">{profile.marcaNome}</p>
          )}
        </div>
      </div>

      {/* O MODELO B (04/10/2026, escolhido pelo dono entre três): UMA porta
        * verde com duas saídas. O Buzi é a de cima; "Acessar dados
        * financeiros" é a faixa branca dentro do mesmo cartão — as duas pedem
        * a mesma senha, então moram juntas. Embaixo, os quadrados iguais. */}
      <div className="rounded-3xl bg-primary shadow-focus p-2 text-white">
        <button
          type="button"
          onClick={() => acessar(BUZI)}
          className="tap w-full rounded-[20px] p-4 flex flex-col items-start gap-3 text-left"
        >
          <span className="flex w-full flex-wrap items-start justify-between gap-3">
            <Bot size={36} aria-hidden="true" />
            {anunciar && (
              <span className="whitespace-nowrap rounded-full bg-white px-3 py-1 text-sm font-bold text-primary">
                Boletim de {nomeDoMes(anunciar)} pronto
              </span>
            )}
          </span>
          <span>
            <span className="block text-[22px] font-bold">Boletim do seu negócio</span>
            <span className="block text-[16px] text-white/90">
              Resumo do mês
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => acessar(CAIXA)}
          className="tap mt-1 flex min-h-14 w-full items-center gap-3 rounded-2xl bg-card px-4 text-left"
        >
          <LockKeyhole size={24} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="flex-1 text-lg font-bold text-text">Abrir caixa</span>
          <ChevronRight size={20} className="text-textBody shrink-0" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => acessar(TURMA)}
          className="tap relative min-h-[132px] rounded-3xl bg-card shadow-rest p-5 flex flex-col justify-between items-start gap-2 text-left"
        >
          {/* A turma mostra os contratos: é o único quadrado que pede a senha,
            * e o cadeado no canto diz isso antes do toque. */}
          <LockKeyhole size={16} className="absolute right-4 top-4 text-textMuted" aria-label="Pede a senha" />
          <Users size={30} className="text-primary" aria-hidden="true" />
          <span>
            <span className="block text-lg font-bold text-text">Minha turma</span>
            <span className="block text-[15px] text-textBody">{frases.total}</span>
            <span className="block text-[15px] text-textBody">
              Em {MESES[agora.getMonth()]}: <strong className="text-accentText">{frases.entraram}</strong>
              {frases.sairam && (
                <>
                  {' · '}
                  <strong className="text-dangerText">{frases.sairam}</strong>
                </>
              )}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/tio/abastecer')}
          className="tap min-h-[132px] rounded-3xl bg-card shadow-rest p-5 flex flex-col justify-between items-start gap-2 text-left"
        >
          <Fuel size={30} className="text-primary" aria-hidden="true" />
          <span>
            <span className="block text-lg font-bold text-text">Abastecer</span>
            <span className="block text-[15px] text-textBody">Quanto dá e lançar</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setFolha('pix')}
          className="tap min-h-[132px] rounded-3xl bg-card shadow-rest p-5 flex flex-col justify-between items-start gap-2 text-left"
        >
          <IconePix size={30} className="text-primary" />
          <span className="text-lg font-bold text-text">Mostrar meu PIX</span>
        </button>
        <button
          type="button"
          onClick={() => setFolha('despesa')}
          className="tap min-h-[132px] rounded-3xl bg-card shadow-rest p-5 flex flex-col justify-between items-start gap-2 text-left"
        >
          <ReceiptText size={30} className="text-primary" aria-hidden="true" />
          <span className="text-lg font-bold text-text">Lançar despesa</span>
        </button>
      </div>

      {cobranca === true && (
        <button
          type="button"
          onClick={() => acessar(TAXA)}
          className="tap rounded-3xl bg-card shadow-rest px-5 py-4 flex items-center gap-3 text-left"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[15px] text-textMuted">Meu plano</p>
            <p className="text-lg font-bold text-text">
              {plano.nome}
              <span className={`ml-1.5 px-2.5 py-1 rounded-full text-sm font-bold ${TOM[plano.tom]}`}>
                {plano.selo}
              </span>
            </p>
          </div>
          <ChevronRight size={20} className="text-textBody shrink-0" aria-hidden="true" />
        </button>
      )}

      <PixSheet mostrar open={folha === 'pix'} onClose={() => setFolha(null)} />
      <FolhaDeDespesa open={folha === 'despesa'} onClose={() => setFolha(null)} comValores={false} />
    </MolduraDoFinanceiro>
  );
}

const TOM = {
  ok: 'bg-primaryChip text-accentText',
  perigo: 'bg-dangerChip text-dangerText',
  aviso: 'bg-warningChip text-warningText',
  neutro: 'bg-neutro text-textBody',
};

function iniciaisDe(nome) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  const primeira = partes[0][0] || '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}
