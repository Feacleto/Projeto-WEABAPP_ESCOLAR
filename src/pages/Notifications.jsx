import { useNavigate } from 'react-router-dom';
import { Camera, ChevronRight } from 'lucide-react';
import Header from '../components/layout/Header';
import NotificationsBody from '../components/notifications/NotificationsBody';
import { useAuth } from '../hooks/useAuth';

/**
 * A PÁGINA de notificações — a casca de quem chega DE FORA.
 *
 * Dentro do app o sino abre uma folha (components/notifications/
 * NotificationsSheet): assim o motorista não perde a rolagem e o filtro da
 * tela em que estava só pra dar uma olhada.
 *
 * Mas a rota tinha que continuar viva. Notificação pushada abre
 * `/tio/notifications` direto, sem nenhuma tela por baixo — e uma folha
 * flutuando sobre o nada não é uma tela, é um erro de desenho. Quem chega
 * assim recebe página de verdade, com cabeçalho e seta de voltar.
 *
 * As duas cascas montam o MESMO corpo. Uma lista só, dois lugares.
 *
 * ⚠️ PARA A FAMÍLIA, ESTA PÁGINA É A ABA "NOVIDADES" (05/10/2026, decisão do
 * dono): mora no meio do menu, então não tem "Voltar", e as fotos da
 * comunidade (a foto da turma que o tio posta) moram aqui dentro, numa linha
 * no topo — é novidade, e ela não tem outro lugar no menu.
 */
export default function Notifications() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const ehFamilia = profile?.role === 'parent';
  return (
    <>
      {ehFamilia ? (
        <Header title="Novidades" />
      ) : (
        <Header title="Notificações" showBack backLabel="Voltar" />
      )}
      <div className="p-4 space-y-3">
        {ehFamilia && (
          <button
            type="button"
            onClick={() => navigate('/pai/comunidade')}
            className="tap flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primarySoft text-primary">
              <Camera size={18} />
            </span>
            <span className="min-w-0 flex-1 text-base font-bold text-text">Fotos da turma</span>
            <ChevronRight size={18} className="shrink-0 text-textMuted" />
          </button>
        )}
        <NotificationsBody
          onNavigate={(to, state) => navigate(to, state ? { state } : undefined)}
        />
      </div>
    </>
  );
}
