import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import Spinner from '../common/Spinner';
import ContratoDoc from './ContratoDoc';
import ContractView from '../contract/ContractView';
import {
  modeloDoContratoDaFamilia,
  modeloDoContratoDeAssinatura,
  ROTULO_DO_MODELO,
  tituloDoModelo,
} from '../../dominio/associacao/modelosDeContrato.js';
import { carregarConsole, getAceitesDosTermos } from '../../services/adminMetricsService';
import { formatDate } from '../../compartilhado/formatters.js';
import { LEGAL_VERSION } from '../../pages/legal/legalContent';
import { VERSAO_CONTRATO } from '../../dominio/associacao/contratoAssociacao.js';
import { VERSAO_DO_TEXTO } from '../../dominio/cobranca/contratoDaFamilia.js';
import { planoValido } from '../../dominio/associacao/planos.js';

/**
 * A ABA JURÍDICO (05/10/2026, desenho aprovado pelo dono no canvas "Painel do
 * dono"): os documentos em vigor, quem aceitou a versão atual, quem está
 * suspenso e o que ainda falta no papel.
 *
 * SÓ LÊ. As versões vêm das constantes que o próprio app usa para emitir e
 * pedir aceite — nunca escritas à mão aqui, senão esta tela diria uma versão
 * e o app pediria outra. Os aceites são duas contagens no servidor.
 *
 * "SUSPENSOS" é o `suspenso` do motorista, com a data. Desde 05/10/2026 o
 * motivo, o prazo de resposta e quem decidiu moram no `registroDoDono` (aba
 * Registro), gravados pela callable `suspenderConta`.
 */
/**
 * A FOLHA DO MODELO: o texto vigente com dados fictícios, só para leitura.
 * Não gera aceite e não grava nada. Folha própria (e não `Sheet`) porque o
 * contrato precisa de mais largura que os 480 px da folha de celular.
 */
function FolhaDoModelo({ modelo, onClose }) {
  useEffect(() => {
    const aoTeclar = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onClose]);

  const titulo = tituloDoModelo(modelo.versao);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-night/45 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-card shadow-float sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 className="text-base font-bold text-text">{titulo}</h2>
            <p className="text-xs font-bold text-warningText">{ROTULO_DO_MODELO}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="tap inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-bg text-text"
          >
            <X size={18} />
          </button>
        </header>
        <div className="overflow-y-auto p-5">{modelo.corpo}</div>
      </div>
    </div>
  );
}

export default function JuridicoTab() {
  const [aceites, setAceites] = useState(null);
  const [modeloAberto, setModeloAberto] = useState(null);
  const [parceiros, setParceiros] = useState(null);

  useEffect(() => {
    let vivo = true;
    getAceitesDosTermos(LEGAL_VERSION)
      .then((a) => vivo && setAceites(a))
      .catch(() => vivo && setAceites({ total: null, naVersao: null }));
    carregarConsole()
      .then((d) => vivo && setParceiros(d.parceiros || []))
      .catch(() => vivo && setParceiros(false));
    return () => {
      vivo = false;
    };
  }, []);

  const assinantes = Array.isArray(parceiros)
    ? parceiros.filter((p) => planoValido(p.plano)).length
    : null;
  const suspensos = Array.isArray(parceiros) ? parceiros.filter((p) => p.suspenso === true) : [];

  const documentos = [
    {
      nome: 'Termos de Uso',
      versao: LEGAL_VERSION,
      estado: 'Rascunho · não publicar antes do advogado',
      atencao: true,
      aceite:
        aceites?.naVersao === null || aceites?.total === null || !aceites
          ? '—'
          : `${aceites.naVersao} de ${aceites.total} contas na ${LEGAL_VERSION}`,
      ler: '/termos',
    },
    {
      nome: 'Política de Privacidade',
      versao: LEGAL_VERSION,
      estado: 'Rascunho · não publicar antes do advogado',
      atencao: true,
      aceite: 'aceita junto com os Termos',
      ler: '/privacidade',
    },
    {
      nome: 'Contrato de Assinatura',
      detalhe: 'motorista e plataforma',
      versao: String(VERSAO_CONTRATO),
      estado: 'Em vigor · assina quem contrata de novo',
      aceite: assinantes === null ? '—' : `${assinantes} com plano`,
      ler: null,
      modelo: () => ({
        versao: VERSAO_CONTRATO,
        corpo: <ContratoDoc dados={modeloDoContratoDeAssinatura()} aceite={null} />,
      }),
    },
    {
      nome: 'Contrato com a família',
      detalhe: 'motorista e família',
      versao: `texto ${VERSAO_DO_TEXTO}`,
      estado: 'Em vigor · o pendente é reemitido sozinho',
      aceite: 'na ficha de cada criança',
      ler: null,
      modelo: () => ({
        versao: VERSAO_DO_TEXTO,
        corpo: <ContractView data={modeloDoContratoDaFamilia()} />,
      }),
    },
  ];

  return (
    <div className="space-y-6">
      {modeloAberto && <FolhaDoModelo modelo={modeloAberto} onClose={() => setModeloAberto(null)} />}
      <section aria-labelledby="falta-no-papel" className="rounded-2xl border border-warningBorder bg-warningSoft p-4">
        <h2 id="falta-no-papel" className="text-sm font-bold text-warningText">
          O que falta no papel para bloquear com segurança
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-warningText">
          <li>
            Os Termos dizem só "violação, fraude ou inatividade". Falta a seção{' '}
            <strong>Suspensão e bloqueio</strong>: motivos numa lista fechada, os graus e o
            direito de resposta.
          </li>
          <li>
            O Contrato de Assinatura prevê suspender só por atraso. Falta a cláusula por conduta.
          </li>
          <li>A Política ainda não fala da auxiliar.</li>
          <li>A empresa é MEI: migrar para ME antes de ligar a cobrança.</li>
        </ul>
      </section>

      <section aria-labelledby="documentos" className="space-y-3">
        <h2 id="documentos" className="rotulo">
          Documentos
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-textMuted">
                <th className="px-4 py-2.5 font-semibold">Documento</th>
                <th className="px-3 py-2.5 font-semibold">Versão</th>
                <th className="px-3 py-2.5 font-semibold">Estado</th>
                <th className="px-3 py-2.5 font-semibold">Aceites</th>
                <th className="px-4 py-2.5 font-semibold">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((d) => (
                <tr key={d.nome} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="block font-bold text-text">{d.nome}</span>
                    {d.detalhe && <span className="block text-textMuted">{d.detalhe}</span>}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{d.versao}</td>
                  <td className={`px-3 py-2.5 ${d.atencao ? 'font-semibold text-warningText' : 'text-textMuted'}`}>
                    {d.estado}
                  </td>
                  <td className="px-3 py-2.5 text-textMuted">
                    {aceites === null && d.nome === 'Termos de Uso' ? <Spinner size={14} /> : d.aceite}
                  </td>
                  <td className="px-4 py-2.5">
                    {d.ler && (
                      <a
                        href={d.ler}
                        target="_blank"
                        rel="noreferrer"
                        className="tap inline-flex min-h-[40px] items-center gap-1 font-bold text-primary"
                      >
                        Ler <ExternalLink size={12} />
                      </a>
                    )}
                    {d.modelo && (
                      <button
                        type="button"
                        onClick={() => setModeloAberto(d.modelo())}
                        className="tap inline-flex min-h-[40px] items-center font-bold text-primary"
                      >
                        Ler o modelo
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs leading-relaxed text-textMuted">
          O texto de cada contrato aceito fica congelado na versão em que foi aceito. Os dois
          contratos se leem na ficha do motorista e na ficha da criança.
        </p>
      </section>

      <section aria-labelledby="suspensos" className="space-y-3">
        <h2 id="suspensos" className="rotulo">
          Contas suspensas
        </h2>
        {parceiros === null ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : parceiros === false ? (
          <p className="text-xs text-dangerText">Não deu pra carregar.</p>
        ) : suspensos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-textMuted">
            Nenhuma conta suspensa.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {suspensos.map((p, i) => (
              <li
                key={p.uid}
                className={`flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-xs ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <span className="font-bold text-text">{p.marcaNome || p.name || 'Sem nome'}</span>
                <span className="text-textMuted">
                  motorista · suspenso {p.suspensoEm ? `em ${formatDate(p.suspensoEm)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs leading-relaxed text-textMuted">
          O motivo, o prazo de resposta e quem decidiu ficam na aba Registro. Família e auxiliar
          ainda não podem ser bloqueadas pela plataforma.
        </p>
      </section>
    </div>
  );
}
