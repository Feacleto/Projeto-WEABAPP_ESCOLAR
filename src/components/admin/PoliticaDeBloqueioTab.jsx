import { AlertTriangle, Ban, Car, Gavel, Scale, Users, UserRound } from 'lucide-react';
import {
  DIAS_PARA_RESPONDER,
  MOTIVOS_DE_BLOQUEIO,
} from '../../dominio/identidade/registroDoDono.js';

/**
 * POLÍTICA DE BLOQUEIO — página explicativa, sem leitura e sem escrita.
 *
 * Existe para o dono não decidir um bloqueio de cabeça: o que cada papel pode
 * sofrer, em que grau, por qual motivo e o que NUNCA acontece. Só o motorista
 * tem a ação pronta (a folha "Suspender" da ficha); o resto é desenho.
 *
 * Os motivos e o prazo de resposta vêm de `registroDoDono.js` — a mesma lista
 * que a callable valida. Escrevê-los de novo aqui faria a política mostrar um
 * motivo que o servidor recusa.
 */

const PAPEIS = [
  {
    icone: Car,
    titulo: 'Motorista',
    estado: 'Existe hoje',
    corDoEstado: 'bg-primaryChip text-accentText',
    texto: `O dono suspende pela folha da ficha, com motivo, prazo de resposta de ${DIAS_PARA_RESPONDER} dias e registro.`,
  },
  {
    icone: Users,
    titulo: 'Família',
    estado: 'Ainda não existe',
    corDoEstado: 'bg-warningChip text-warningText',
    texto:
      'O dono bloquearia só o login. Tirar a criança da perua é decisão do motorista, nunca da plataforma.',
  },
  {
    icone: UserRound,
    titulo: 'Auxiliar',
    estado: 'Só o motorista desativa',
    corDoEstado: 'bg-infoChip text-infoText',
    texto: 'O dono só bloquearia por violação. Desativar a auxiliar do dia a dia é do motorista.',
  },
];

const GRAUS = [
  { n: 1, titulo: 'Aviso', texto: 'A conta continua funcionando. Fica registrado, com motivo.' },
  {
    n: 2,
    titulo: 'Suspensão temporária',
    texto: 'A conta para por um prazo. A pessoa tem direito de resposta.',
  },
  {
    n: 3,
    titulo: 'Encerramento',
    texto: 'A conta é encerrada. É o último passo, depois de resposta ou de urgência.',
  },
];

const NUNCA = [
  'Apagar dado.',
  'Desfazer o vínculo da família com a criança.',
  'Bloquear por nota baixa.',
  'Avisar as famílias que o motorista foi bloqueado.',
];

function Cartao({ icone: Icone, titulo, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-text">
        <Icone className="h-4 w-4 text-primary" aria-hidden="true" />
        {titulo}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function PoliticaDeBloqueioTab() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text">Política de bloqueio</h1>
        <p className="mt-1 text-sm text-textMuted">
          O que o dono pode fazer com cada conta, em que ordem, e o que nunca faz.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-warningChip p-3 text-sm text-warningText">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Família e auxiliar dependem da seção &quot;Suspensão e bloqueio&quot; dos Termos, ainda em
          escrita.
        </span>
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        {PAPEIS.map((p) => (
          <section key={p.titulo} className="rounded-2xl border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text">
              <p.icone className="h-4 w-4 text-primary" aria-hidden="true" />
              {p.titulo}
            </h2>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${p.corDoEstado}`}>
              {p.estado}
            </span>
            <p className="mt-3 text-sm text-text">{p.texto}</p>
          </section>
        ))}
      </div>

      <Cartao icone={Gavel} titulo="Três graus">
        <ol className="grid gap-3 sm:grid-cols-3">
          {GRAUS.map((g) => (
            <li key={g.n} className="rounded-xl border border-border p-3">
              <p className="text-xs text-textMuted">Grau {g.n}</p>
              <p className="text-sm font-semibold text-text">{g.titulo}</p>
              <p className="mt-1 text-sm text-text">{g.texto}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-textMuted">
          Urgência pula os graus: risco à criança ou ordem de autoridade não esperam o aviso.
        </p>
      </Cartao>

      <Cartao icone={Ban} titulo="Motivos aceitos">
        <ul className="flex flex-wrap gap-2">
          {MOTIVOS_DE_BLOQUEIO.map((m) => (
            <li key={m.id} className="rounded-full bg-primaryChip px-3 py-1 text-sm text-text">
              {m.rotulo}
              {m.soComCobranca && (
                <span className="text-xs text-textMuted"> (só com a cobrança ligada)</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-textMuted">
          É lista fechada: o servidor recusa motivo fora dela.
        </p>
      </Cartao>

      <Cartao icone={Scale} titulo="Direito de resposta">
        <ul className="space-y-1 text-sm text-text">
          <li>{DIAS_PARA_RESPONDER} dias para responder, por contato@alobuzinou.com.</li>
          <li>A resposta tem revisão humana.</li>
          <li>O registro fica guardado por 5 anos.</li>
        </ul>
      </Cartao>

      <section className="rounded-2xl border border-dangerBorder bg-dangerChip p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-dangerText">
          <Ban className="h-4 w-4" aria-hidden="true" />O que um bloqueio nunca faz
        </h2>
        <ul className="mt-3 space-y-1 text-sm text-dangerText">
          {NUNCA.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
