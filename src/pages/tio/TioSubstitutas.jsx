import { useState } from 'react';
import { MessageCircle, Pencil, UserPlus } from 'lucide-react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import FolhaDaSubstituta from '../../components/auxiliar/FolhaDaSubstituta';
import ChamarSubstitutaHoje from '../../components/auxiliar/ChamarSubstitutaHoje';
import { useAcessosDeSubstituta } from '../../hooks/useAcessosDeSubstituta';
import { useSubstitutas } from '../../hooks/useSubstitutas';
import { useAuxiliaresDoMotorista } from '../../hooks/useAuxiliares';
import { historicoDeAuxiliares, linkDoZap } from '../../dominio/identidade/auxiliar.js';
import { jaFoiAuxiliar, linhaDoCartao, ordenarSubstitutas } from '../../dominio/identidade/faltaDaAuxiliar.js';
import { formatPhone } from '../../compartilhado/formatters';

/**
 * MINHAS SUBSTITUTAS — `/tio/finance/auxiliar/substitutas` (05/10/2026, fase 5).
 *
 * "Ele precisa ter uma lista de substitutas" — quem ele chama quando a
 * auxiliar falta. Cada substituição registrada no "Hoje" entra aqui sozinha
 * (a contagem é recontada das faltas, não digitada). Ela não precisa ter
 * conta: é um contato, e por isso guarda só nome e WhatsApp.
 *
 * "Já foi sua auxiliar" sai do telefone batendo com o histórico — quem já
 * trabalhou com ele e continua disponível para um dia avulso.
 *
 * Sem estrelas nem avaliação nesta fase: quem vê a nota de quem ainda é
 * decisão do dono.
 *
 * F3: "Chamar hoje" manda a ela o link de um dia — a ordem da rota, sem
 * conta (`ChamarSubstitutaHoje`).
 */
export default function TioSubstitutas() {
  const { substitutas } = useSubstitutas();
  const { acessos, hoje } = useAcessosDeSubstituta();
  const vinculos = useAuxiliaresDoMotorista();
  const [folha, setFolha] = useState(null); // { substituta } | { nova: true }
  const historico = historicoDeAuxiliares(vinculos || []).filter((h) => !h.ativa);
  const lista = ordenarSubstitutas(substitutas || []);

  return (
    <>
      <Header title="Minhas substitutas" showBack backLabel="Auxiliar" backTo="/tio/finance/auxiliar" />
      <div className="space-y-4 p-4">
        <p className="text-base text-textBody">
          Quem você chama quando a auxiliar falta. Cada substituição registrada entra aqui sozinha.
        </p>

        {substitutas === null ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : lista.length === 0 ? (
          <section className="rounded-2xl bg-card p-5 shadow-rest">
            <p className="text-base text-textBody">Nenhuma substituta ainda.</p>
          </section>
        ) : (
          lista.map((s) => (
            <section key={s.id} className="space-y-3 rounded-2xl bg-card p-5 shadow-rest">
              <div>
                <p className="font-display text-lg font-bold text-text">{s.nome}</p>
                <p className="text-base text-textBody">{formatPhone(s.telefone)}</p>
                <p className="text-sm text-textMuted">{linhaDoCartao(s)}</p>
                {jaFoiAuxiliar(s.telefone, historico) && (
                  <span className="mt-2 inline-block rounded-full bg-primarySoft px-3 py-1 text-sm font-bold text-primary">
                    já foi sua auxiliar
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={linkDoZap(s.telefone)}
                  target="_blank"
                  rel="noreferrer"
                  className="tap flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primaryBorder bg-primarySoft text-base font-bold text-primary"
                >
                  <MessageCircle size={20} aria-hidden="true" />
                  Falar
                </a>
                <button
                  type="button"
                  onClick={() => setFolha({ substituta: s })}
                  className="tap flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card text-base font-bold text-text"
                >
                  <Pencil size={18} aria-hidden="true" />
                  Editar
                </button>
              </div>
              <ChamarSubstitutaHoje substituta={s} acessos={acessos} hoje={hoje} />
            </section>
          ))
        )}

        <Button icon={UserPlus} onClick={() => setFolha({ nova: true })} className="shadow-focus">
          Acrescentar substituta
        </Button>
        <p className="text-center text-sm text-textMuted">Só nome e WhatsApp. Ela não precisa ter conta no app.</p>
      </div>

      {folha && (
        <FolhaDaSubstituta
          key={folha.substituta?.id || 'nova'}
          open
          onClose={() => setFolha(null)}
          substituta={folha.substituta || null}
        />
      )}
    </>
  );
}
