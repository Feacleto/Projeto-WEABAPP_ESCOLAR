import Header from '../../components/layout/Header';
import OperacaoDaRota from '../../components/route/OperacaoDaRota';
import RotaAoVivoDoTio from '../../components/route/RotaAoVivoDoTio';

/**
 * "Rota agora" — a porta separada da operação.
 *
 * O miolo mora em `components/route/OperacaoDaRota` porque o Início mostra a
 * mesma coisa quando a rota está andando. Esta rota continua existindo de
 * propósito: com a operação dentro da home, um erro na home deixaria o
 * motorista sem rota no meio da rua. Duas portas, uma sala.
 *
 * A ROTA AO VIVO (05/10/2026): no topo, o que a auxiliar marcou e as zonas
 * da viagem (`RotaAoVivoDoTio`), com os dados que a operação já escuta.
 */
export default function TioRouteNow() {
  return (
    <div className="min-h-screen pb-28">
      <Header title="Rota" tituloNaBarra />
      <OperacaoDaRota aoVivo={(dados) => <RotaAoVivoDoTio {...dados} />} />
    </div>
  );
}
