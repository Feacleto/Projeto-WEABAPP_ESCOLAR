import { useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAuxiliaresDoMotorista } from '../../hooks/useAuxiliares';
import { useRegistroDaRota } from '../../hooks/useRegistroDaRota';
import { getDateKey } from '../../dominio/rota/horarios';
import { zonasDaRota } from '../../dominio/rota/zonasDaRota.js';
import RegistroDaAuxiliar from './RegistroDaAuxiliar';
import ZonasDaRota from './ZonasDaRota';
import FichaRapidaDoTio from './FichaRapidaDoTio';

/**
 * A ROTA AO VIVO, DO LADO DO TIO (05/10/2026, decisão do dono) — o topo da
 * tela da rota, acima da linha do tempo:
 *   1. "O que a {auxiliar} marcou", só com auxiliar ATIVA;
 *   2. as zonas da viagem (em casa / na perua / na escola);
 *   3. a ficha rápida de quem ele tocar nas zonas.
 *
 * Tudo o que é da turma chega por props, da `OperacaoDaRota` (ver `aoVivo`
 * lá): a fila, as declarações do dia e quem busca hoje. As duas escutas
 * próprias daqui são UMA consulta das auxiliares dele e UM documento do
 * registro do dia — nenhuma por criança.
 *
 * Ele continua marcando pela linha do tempo e pelo rodapé, como sempre: as
 * zonas só mostram, e o toque nelas abre a ficha, não marca nada.
 */
export default function RotaAoVivoDoTio({ fila, direcao, escolasPorId, declaracoes, quemBusca, vez }) {
  const { user } = useAuth();
  const auxiliares = useAuxiliaresDoMotorista();
  const nomes = useMemo(
    () => (auxiliares || [])
      .filter((a) => a.ativa === true)
      .map((a) => String(a.nome || '').trim().split(/\s+/)[0])
      .filter(Boolean),
    [auxiliares]
  );
  const eventos = useRegistroDaRota(user?.uid, getDateKey(), nomes.length > 0);
  const zonas = useMemo(
    () => (direcao && fila?.length ? zonasDaRota(fila, { direcao, escolasPorId }) : null),
    [fila, direcao, escolasPorId]
  );
  const [aberta, setAberta] = useState(null); // id da criança da ficha

  // A ficha lê o item ATUAL da fila (não o do toque): se a auxiliar marcar
  // com a folha aberta, o lugar muda na hora.
  const item = aberta ? fila?.find((q) => q.child.id === aberta) || null : null;

  return (
    <>
      <RegistroDaAuxiliar nomes={nomes} eventos={eventos} />
      {zonas && <ZonasDaRota zonas={zonas} vez={vez} onTocar={(q) => setAberta(q.child.id)} />}
      {item && (
        <FichaRapidaDoTio
          item={item}
          direcao={direcao}
          declaracao={declaracoes?.[item.child.id] || null}
          quemBusca={quemBusca?.[item.child.id] || null}
          onClose={() => setAberta(null)}
        />
      )}
    </>
  );
}
