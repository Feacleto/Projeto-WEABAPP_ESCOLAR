import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer, CheckCircle2, Clock3, History } from 'lucide-react';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import Button from '../../components/common/Button';
import WhatsAppIcon from '../../components/common/WhatsAppIcon';
import ContractView from '../../components/contract/ContractView';
import CartaoDoCombinado from '../../components/contract/CartaoDoCombinado';
import { useAuth } from '../../hooks/useAuth';
import { useChild } from '../../hooks/useChild';
import { useContratos } from '../../hooks/useContratos';
import { inviteUrl } from '../../dominio/identidade/inviteUrl';
import { doDa } from '../../compartilhado/formatters';
import {
  buildContractData,
  dadosDaContratadaFaltando,
} from '../../services/contractService';
import { estadoDoContrato } from '../../dominio/cobranca/contratoDaFamilia.js';

const ROTULO = {
  aguardando: 'esperando assinatura',
  aceito: 'assinado',
  substituido: 'substituído',
  retirado: 'trocada',
};

function quando(ts) {
  const d = ts?.toDate?.();
  return d ? d.toLocaleDateString('pt-BR') : '';
}

/**
 * Tela do motorista: o contrato da criança — a versão que vale, a que espera
 * aceite, e todas as anteriores.
 *
 * Rota: /tio/children/:id/contract
 *
 * Desde 02/10/2026 o contrato é um DOCUMENTO GRAVADO por versão
 * (`children/{id}/contratos/{n}`), não um texto remontado a cada abertura —
 * ver `dominio/cobranca/contratoDaFamilia.js`. Esta tela mostra a versão
 * gravada, e o histórico é o que se abre numa discordância sobre o combinado.
 */
export default function TioContract() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { child, loading } = useChild(id);
  const { contratos, vigente, aguardando } = useContratos(child);
  const [aberta, setAberta] = useState(null);

  // Aceite antigo, anterior aos documentos: o texto é o que os campos dizem.
  const legado = useMemo(() => {
    if (!child || !profile || vigente || aguardando) return null;
    return buildContractData({ child, admin: profile });
  }, [child, profile, vigente, aguardando]);

  if (loading || !contratos) {
    return (
      <>
        <Header title="Contrato" showBack />
        <div className="p-5 space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </>
    );
  }

  // ⚠️ O QUE FALTA, DITO — E ESTA É A TELA DELE, NÃO A DA FAMÍLIA. Sem os
  // dados da parte contratada o contrato não é emitido (o placeholder de
  // empresa fictícia saiu em 06/09/2026).
  const faltando = dadosDaContratadaFaltando(profile);
  if (faltando.length > 0) {
    return (
      <>
        <Header title="Contrato" showBack />
        <div className="p-5">
          <div className="rounded-2xl border border-warningBorder bg-warningSoft p-4">
            <p className="text-sm font-bold text-warningText">
              Falta o seu cadastro para emitir o contrato
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-warningText">
              O contrato precisa dizer quem é a parte contratada — você. Sem{' '}
              <strong>{faltando.join(', ')}</strong>, ele não pode ser emitido, e
              a família não tem o que assinar.
            </p>
            <button
              type="button"
              onClick={() => navigate('/tio/profile')}
              className="tap mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white"
            >
              Completar meu cadastro
            </button>
          </div>
        </div>
      </>
    );
  }

  const estado = estadoDoContrato(child);
  // O que a tela mostra: a versão escolhida no histórico; senão a que espera
  // aceite (é o assunto em aberto); senão a que vale.
  const mostrada =
    contratos.find((c) => c.numero === aberta) || aguardando || vigente || null;
  const dados = mostrada?.dados || legado;
  const acceptanceInfo =
    mostrada?.status === 'aceito' || mostrada?.status === 'substituido'
      ? {
          name: mostrada.aceitoNome,
          acceptedAt: mostrada.aceitoEm?.toDate?.()?.toISOString() || null,
          hash: mostrada.hash,
        }
      : !mostrada && child.contractAcceptedAt
        ? {
            name: child.contractAcceptedName,
            acceptedAt: child.contractAcceptedAt?.toDate?.()?.toISOString() || null,
            hash: child.contractHash,
            version: child.contractVersion,
          }
        : null;

  // A família ainda não entrou: manda o LINK do convite (o código saiu de
  // toda tela em 02/10/2026). Já entrou: manda ela abrir o app, onde o
  // contrato espera o aceite.
  const primeiro = String(child.name || '').trim().split(/\s+/)[0];
  const texto = child.parentUid
    ? `Oi! Mandei um contrato novo do transporte ${doDa(primeiro, child.gender)}. ` +
      `Abra o app para ler e assinar: ${window.location.origin}/pai/contrato`
    : `Oi! Aqui é do transporte escolar ${doDa(primeiro, child.gender)}. ` +
      `Abra este link para entrar no app e ler o contrato: ${inviteUrl(child.inviteCode)}`;
  const fone = String(child.parentPhone || '').replace(/\D/g, '');
  const waHref = `https://wa.me/${fone ? (fone.startsWith('55') ? fone : `55${fone}`) : ''}?text=${encodeURIComponent(texto)}`;
  const pedeAceite = estado === 'aguardando' || estado === 'mudanca';

  return (
    <>
      <Header title="Contrato" showBack />

      <div className="p-5 space-y-4">
        <div className="print:hidden">
          <CartaoDoCombinado child={child} />
        </div>

        <div className="grid grid-cols-1 gap-2 print:hidden">
          {pedeAceite && (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="tap inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-4 py-3 text-center font-bold leading-tight text-onAccent"
            >
              <WhatsAppIcon size={20} colored={false} />
              Avisar a família no WhatsApp
            </a>
          )}
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
            Imprimir ou salvar em PDF
          </Button>
        </div>

        {/* O HISTÓRICO: cada versão, com o que aconteceu com ela. */}
        {contratos.length > 1 && (
          <section className="space-y-2 print:hidden">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <History size={16} className="text-primary" />
              Versões do contrato
            </h3>
            <ul className="space-y-1.5">
              {contratos.map((c) => {
                const ativa = mostrada?.numero === c.numero;
                return (
                  <li key={c.numero}>
                    <button
                      type="button"
                      onClick={() => setAberta(c.numero)}
                      className={`tap flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-sm ${
                        ativa ? 'border-primary bg-primarySoft' : 'border-border bg-card'
                      }`}
                    >
                      <span className="font-semibold text-text">
                        Versão {c.numero}
                        {c.tipo === 'aditivo' ? ' · aditivo' : ''}
                      </span>
                      <span className="flex items-center gap-1 text-textMuted">
                        {c.status === 'aceito' ? (
                          <CheckCircle2 size={14} className="text-accentText" />
                        ) : (
                          <Clock3 size={14} />
                        )}
                        {ROTULO[c.status] || c.status} · {quando(c.aceitoEm || c.emitidoEm)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {dados ? (
          <div className="bg-card rounded-3xl shadow-sm p-6 print:p-0 print:shadow-none print:rounded-none">
            <ContractView
              data={dados}
              numero={mostrada?.numero || null}
              tipo={mostrada?.tipo}
              mudancas={mostrada?.status === 'aguardando' ? mostrada?.mudancas : null}
              acceptanceInfo={acceptanceInfo}
            />
          </div>
        ) : (
          <Skeleton className="h-60" />
        )}
      </div>
    </>
  );
}
