import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import Spinner from '../common/Spinner';
import { listarSeguranca } from '../../services/segurancaDoAppService';
import { NAO_ENXERGA, resumoDaTela } from '../../dominio/identidade/segurancaDoApp.js';

/**
 * A ABA "SEGURANÇA" — uma visão curta do que o app enxerga de ataque
 * (05/10/2026). SÓ LÊ `segurancaDoApp`, gravado de hora em hora pela vigia.
 * Diz também o que o app NÃO enxerga: sem isso, zero bloqueio pareceria paz.
 */
const hojeDeBrasilia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function Linha({ rotulo, hoje, seteDias, extra }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-text">
        {rotulo}
        {extra && <span className="block text-xs text-textMuted">{extra}</span>}
      </span>
      <span className="shrink-0 text-right text-sm text-text">
        <strong>{hoje}</strong> hoje · {seteDias} em 7 dias
      </span>
    </li>
  );
}

export default function SegurancaTab() {
  const [dias, setDias] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    listarSeguranca()
      .then((d) => vivo && setDias(d))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, []);

  if (erro) return <p className="text-sm text-dangerText">Não consegui ler a segurança agora.</p>;
  if (!dias) return <Spinner />;

  const r = resumoDaTela(dias, hojeDeBrasilia());
  // Sem nenhum dia gravado também conta como desligado: hoje ele está.
  const appCheckDesligado = r.appCheckLigado !== true;

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        Segurança
      </h1>

      {appCheckDesligado && (
        <p className="rounded-xl border border-dangerBorder bg-dangerSoft p-3 text-sm font-semibold text-dangerText">
          App Check desligado
        </p>
      )}

      {!r.temDado ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-textMuted">
          A primeira vigia roda na primeira hora depois de publicar.
        </p>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-base font-semibold text-text">Ataques que o app vê</h2>
            <ul className="mt-1 divide-y divide-border">
              {r.escopos.map((e) => (
                <Linha
                  key={e.id}
                  rotulo={e.rotulo}
                  hoje={e.hoje}
                  seteDias={e.seteDias}
                  extra={e.horaDePico ? `Hora com mais bloqueios: ${e.horaDePico}h` : null}
                />
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-base font-semibold text-text">Fraudes</h2>
            <ul className="mt-1 divide-y divide-border">
              <Linha rotulo="Comprovantes duplicados" {...r.comprovantesDuplicados} />
              <Linha rotulo="Suspensões por fraude (veja na aba Registro)" {...r.fraudes} />
            </ul>
            <p className="mt-2 text-xs text-textMuted">
              CPF já usado por outra conta: ainda não contado.
            </p>
          </section>
        </>
      )}

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-text">Saúde da segurança</h2>
        <ul className="mt-2 space-y-1 text-sm text-text">
          <li className={appCheckDesligado ? 'font-semibold text-dangerText' : ''}>
            App Check: {appCheckDesligado ? 'DESLIGADO' : 'ligado'}
          </li>
          <li>Regras de acesso: testadas a cada lote no emulador, fora do CI</li>
          <li>Senha do Financeiro com teclado de banco</li>
          <li>IP guardado só como hash</li>
          <li>Posição da perua arredondada em 150 m</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-text">O que o app não enxerga</h2>
        <ul className="mt-2 space-y-2 text-sm text-textMuted">
          {NAO_ENXERGA.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
