import Header from '../../components/layout/Header';
import OperacaoDaRota from '../../components/route/OperacaoDaRota';

/**
 * "Rota agora" — a porta separada da operação.
 *
 * O miolo mora em `components/route/OperacaoDaRota` porque o Início mostra a
 * mesma coisa quando a rota está andando. Esta rota continua existindo de
 * propósito: com a operação dentro da home, um erro na home deixaria o
 * motorista sem rota no meio da rua. Duas portas, uma sala.
 */
export default function TioRouteNow() {
  return (
    <div className="min-h-screen pb-28">
      <Header title="Rota agora" />
      <OperacaoDaRota />
    </div>
  );
}
