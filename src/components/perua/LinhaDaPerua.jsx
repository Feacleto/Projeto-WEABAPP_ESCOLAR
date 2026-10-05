import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Sheet from '../common/Sheet';
import MiniPerua from './MiniPerua';
import DesenhoDaPerua from './DesenhoDaPerua';
import SeletorDeVagas from './SeletorDeVagas';
import { useAuth } from '../../hooks/useAuth';
import { useVagasDaPerua } from '../../hooks/useVagasDaPerua';
import { definirVagasDaPerua } from '../../services/configFinanceiroService';
import { frasesDaPerua, ocupacao } from '../../dominio/identidade/vagasDaPerua.js';

/**
 * "SUA PERUA" NO INÍCIO (05/10/2026, protótipo aprovado pelo dono).
 *
 * Uma linha com a perua em miniatura e "14 de 15 vagas", logo abaixo do
 * cartão do dia. ⚠️ NÃO COMPETE COM ELE: é branca, sem botão cheio, no molde
 * das outras linhas do Início — o verde cheio da tela continua sendo o
 * "Iniciar a rota".
 *
 * Tocar abre a perua inteira numa folha. Ali, cada vaga livre é tocável e
 * leva ao mesmo "Cadastrar criança" de sempre (`/tio/children/new`) — é o
 * caminho "tocar na vaga para cadastrar" do protótipo, fora do card do
 * primeiro acesso. A folha também deixa mudar o número (a perua pode ser
 * trocada); o "Salvar" é contorno, pelo mesmo motivo.
 *
 * Sem o número dito, não desenha nada: quem pergunta é o card do primeiro
 * acesso. Só o motorista vê — a família e a auxiliar não têm vagas.
 */
export default function LinhaDaPerua({ criancas = [] }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { vagas } = useVagasDaPerua();
  const [aberta, setAberta] = useState(false);
  const [mudando, setMudando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  if (typeof vagas !== 'number') return null;
  const frases = frasesDaPerua({ vagas, criancas });
  const { livres } = ocupacao({ vagas, criancas });

  const fechar = () => {
    setAberta(false);
    setMudando(null);
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await definirVagasDaPerua(user?.uid, mudando);
      setMudando(null);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="tap mt-3 block w-full rounded-xl border border-border bg-card px-3 py-3 text-left"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-base font-semibold text-text">Sua perua</span>
          <span className="font-display text-lg font-bold text-text">{frases.contagem}</span>
        </span>
        <span className="my-2.5 block">
          <MiniPerua vagas={vagas} criancas={criancas} />
        </span>
        <span className="flex items-center justify-between gap-2 text-base text-textMuted">
          {frases.situacao} · Toque para ver a perua
          <ChevronRight size={16} className="shrink-0" aria-hidden="true" />
        </span>
      </button>

      <Sheet open={aberta} onClose={fechar} title="Sua perua" subtitle={frases.contagem}>
        <p className="mb-3 text-base text-textBody">
          {livres > 0 ? 'Toque numa vaga livre para cadastrar criança.' : frases.situacao}
        </p>
        <DesenhoDaPerua
          vagas={vagas}
          criancas={criancas}
          onVagaLivre={() => {
            fechar();
            navigate('/tio/children/new');
          }}
        />
        <div className="mt-5 border-t border-border pt-4">
          {mudando === null ? (
            <button
              type="button"
              onClick={() => setMudando(vagas)}
              className="tap flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border bg-card text-base font-bold text-primary"
            >
              Mudar o número de vagas
            </button>
          ) : (
            <div className="space-y-3">
              <SeletorDeVagas valor={mudando} onChange={setMudando} />
              <button
                type="button"
                onClick={salvar}
                disabled={salvando || mudando === vagas}
                className="tap flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-primary bg-card text-base font-bold text-primary disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
