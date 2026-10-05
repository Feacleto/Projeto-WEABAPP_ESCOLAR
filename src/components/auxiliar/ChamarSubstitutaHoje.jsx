import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link2 } from 'lucide-react';
import ConfirmDialog from '../common/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import {
  encerrarAcessoDeSubstituta,
  gerarAcessoDeSubstituta,
} from '../../services/substitutaDeUmDiaService';
import { acessoAbertoDeHoje, mensagemDaSubstituta } from '../../dominio/rota/rotaDaSubstituta.js';
import { linkDoZap } from '../../dominio/identidade/auxiliar.js';

/**
 * "CHAMAR HOJE" — o link de um dia da substituta (F3, 05/10/2026).
 *
 * Um botão de CONTORNO (o verde cheio da tela é outro): gera o link de hoje
 * e abre o WhatsApp dela com a mensagem pronta. Ela vê a ordem da rota, sem
 * conta, só hoje. Com o link aberto, a linha diz "Com o link de hoje" e
 * oferece "Encerrar" — que pede confirmação, porque ela pode estar na porta
 * de uma criança lendo a lista.
 *
 * `acessos` é a lista de hoje que a tela já escuta (`useAcessosDeSubstituta`).
 */
export default function ChamarSubstitutaHoje({ substituta, acessos, hoje, rotulo = 'Chamar hoje' }) {
  const { profile } = useAuth();
  const [ocupado, setOcupado] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const aberto = acessoAbertoDeHoje(acessos, substituta?.id, hoje);
  const primeiro = String(substituta?.nome || '').trim().split(/\s+/)[0] || 'ela';

  async function chamar() {
    setOcupado(true);
    try {
      const link = await gerarAcessoDeSubstituta(substituta.id, hoje);
      const texto = mensagemDaSubstituta({ nome: substituta.nome, marca: profile?.marcaNome, link, gender: profile?.gender });
      window.open(linkDoZap(substituta.telefone, texto), '_blank');
    } catch (err) {
      toast.error(err?.message || 'Não deu para criar o link. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  }

  const contorno =
    'tap flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-card px-4 text-base font-bold text-text disabled:opacity-60';

  if (acessos === null) return null;

  return (
    <>
      {aberto ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-primarySoft px-4 py-2">
          <p className="flex items-center gap-2 text-base font-bold text-primary">
            <Link2 size={18} aria-hidden="true" />
            Com o link de hoje
          </p>
          <button
            type="button"
            onClick={() => setEncerrando(true)}
            className="tap min-h-12 rounded-xl px-3 text-base font-bold text-text underline"
          >
            Encerrar
          </button>
        </div>
      ) : (
        <button type="button" onClick={chamar} disabled={ocupado} className={contorno}>
          <Link2 size={18} aria-hidden="true" />
          {ocupado ? 'Criando o link...' : rotulo}
        </button>
      )}

      <ConfirmDialog
        open={encerrando}
        title={`Encerrar o link da ${primeiro}?`}
        description="Ela deixa de ver a rota de hoje na hora."
        confirmLabel="Encerrar"
        loading={ocupado}
        onConfirm={async () => {
          setOcupado(true);
          try {
            if (aberto) await encerrarAcessoDeSubstituta(aberto.id);
          } catch (err) {
            toast.error(err?.message || 'Não deu para encerrar. Tente de novo.');
          } finally {
            setOcupado(false);
            setEncerrando(false);
          }
        }}
        onCancel={() => setEncerrando(false)}
      />
    </>
  );
}
