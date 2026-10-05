import { Plus } from 'lucide-react';
import RostoDaVaga from './RostoDaVaga';
import {
  ehBancoDeTras,
  fileirasDaPerua,
  vagasDesenhadas,
} from '../../dominio/identidade/vagasDaPerua.js';

/**
 * A PERUA INTEIRA, como o mapa de assentos de um avião (05/10/2026,
 * protótipo aprovado pelo dono).
 *
 * Na frente o volante ("Tio") e a auxiliar ("Aux", na cor da marca dele), que
 * não contam como vaga. Atrás, fileiras de três com o corredor; a última é o
 * banco de trás, com o que sobrar (`fileirasDaPerua`).
 *
 * ⚠️ AS VAGAS NÃO TÊM NÚMERO, e as crianças entram na ordem do cadastro: o
 * desenho conta vagas, não diz onde cada uma senta.
 *
 * ⚠️ PASSOU DAS VAGAS NÃO É ERRO: as crianças que sobram aparecem embaixo,
 * num quadro tracejado "Acima das vagas".
 *
 * `onVagaLivre` torna as vagas livres tocáveis (cadastrar criança). Sem ele,
 * a perua só mostra — é assim no card do primeiro acesso, que cobre o app.
 *
 * NA ROTA AO VIVO (`naRota`, 05/10/2026, decisão do dono): é a MESMA perua
 * das zonas da rota ("Na perua"), com as crianças que estão nela acesas e os
 * outros assentos APAGADOS. `vagas` aqui é só o número de ASSENTOS a
 * desenhar: o tio passa as vagas dele; a auxiliar, que não vê vagas, passa
 * as crianças da viagem — então nada desta peça diz "vaga" no modo da rota,
 * e ela não mostra número nenhum.
 */
export default function DesenhoDaPerua({ vagas, criancas = [], onVagaLivre, naRota = false }) {
  const fileiras = fileirasDaPerua(vagas);
  const { vagas: celulas, acima } = vagasDesenhadas({ vagas, criancas });
  const vaga = (i) => <Vaga key={i} crianca={celulas[i]?.crianca} onVagaLivre={naRota ? null : onVagaLivre} naRota={naRota} />;

  return (
    <div className="relative mx-auto w-[264px] max-w-full rounded-[64px_64px_22px_22px] border-[3px] border-borderStrong bg-surface px-4 pb-5 pt-16">
      {/* O para-brisa: só desenho. */}
      <span
        aria-hidden="true"
        className="absolute left-8 right-8 top-4 h-8 rounded-[40px_40px_8px_8px] border border-borderStrong bg-neutro"
      />
      <div className="mb-4 grid grid-cols-[48px_1fr_48px] items-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-[10px_10px_7px_7px] bg-primaryDark text-base font-bold text-white">
          Tio
        </span>
        <span />
        <span className="flex h-12 w-12 items-center justify-center rounded-[10px_10px_7px_7px] bg-marca text-base font-bold text-naMarca">
          Aux
        </span>
      </div>
      {fileiras.map((f, k) =>
        ehBancoDeTras(fileiras, k) ? (
          <div key={k} className="mb-1.5 flex justify-between gap-1.5">
            {f.map(vaga)}
          </div>
        ) : (
          <div key={k} className="mb-1.5 grid grid-cols-[48px_48px_1fr_48px] gap-1.5">
            {vaga(f[0])}
            {vaga(f[1])}
            <span aria-hidden="true" />
            {vaga(f[2])}
          </div>
        )
      )}
      {acima.length > 0 && (
        <div className="mt-3 rounded-xl border-2 border-dashed border-borderStrong p-2">
          <p className="text-base font-bold text-textBody">{naRota ? 'Também na perua' : 'Acima das vagas'}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {acima.map((c) => (
              <Vaga key={c.id} crianca={c} naRota={naRota} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const FORMA =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px_10px_7px_7px] border-2';

function Vaga({ crianca, onVagaLivre, naRota = false }) {
  if (crianca) {
    return (
      <span
        role="img"
        aria-label={crianca.name || 'Criança'}
        title={crianca.name || undefined}
        className={`${FORMA} border-primary bg-primarySoft`}
      >
        <RostoDaVaga crianca={crianca} className="h-9 w-9" />
      </span>
    );
  }
  if (onVagaLivre) {
    return (
      <button
        type="button"
        onClick={onVagaLivre}
        aria-label="Vaga livre: cadastrar criança"
        className={`tap ${FORMA} border-dashed border-borderStrong bg-card text-primary hover:border-primary hover:bg-primarySoft`}
      >
        <Plus size={20} aria-hidden="true" />
      </button>
    );
  }
  // Na rota, o assento sem ninguém AGORA fica apagado — não é vaga livre:
  // a criança dele pode estar em casa ou na escola.
  if (naRota) {
    return <span role="img" aria-label="Assento vazio" className={`${FORMA} border-dashed border-borderStrong bg-card opacity-50`} />;
  }
  return (
    <span role="img" aria-label="Vaga livre" className={`${FORMA} border-dashed border-borderStrong bg-card`} />
  );
}
