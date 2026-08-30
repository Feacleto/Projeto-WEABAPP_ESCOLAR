import { useEffect, useState } from 'react';

/**
 * A HORA ATUAL, QUE ANDA SOZINHA.
 *
 * Uma tela que escreve a hora e nunca re-renderiza mostra a hora em que foi
 * aberta. Num app instalado na tela de início isso não é detalhe: o motorista
 * abre pelo ícone de manhã e não fecha o dia inteiro — o relógio pararia às
 * 06h12 e passaria a tarde mentindo com cara de informação. Hora errada é pior
 * que hora nenhuma, porque ninguém desconfia de um relógio.
 *
 * DE MINUTO EM MINUTO, e não de segundo em segundo: o que a tela mostra é
 * `HH:MM`, então tique de segundo seria re-render que não muda pixel nenhum.
 *
 * ELE ACERTA O PASSO NA PRIMEIRA BATIDA. O intervalo começa no resto do
 * minuto corrente em vez de sessenta segundos cheios: aberto às 06h12m50s, o
 * relógio vira pra 06h13 em dez segundos, e não em cinquenta. Sem isso a
 * virada fica desalinhada do relógio do sistema pelo tempo que o app ficar
 * aberto, e o motorista vê 06h12 no app e 06h13 na barra de status.
 *
 * PARA QUANDO A ABA SOME e acerta ao voltar. Contar minutos com a tela
 * apagada gasta bateria pra desenhar o que ninguém está vendo — e é a mesma
 * decisão que o GPS já toma neste app.
 */
export function useRelogio() {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    let timer = null;

    const parar = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const agendar = () => {
      parar();
      const d = new Date();
      // O que falta pro próximo minuto cheio.
      const restante = 60000 - (d.getSeconds() * 1000 + d.getMilliseconds());
      timer = setTimeout(() => {
        setAgora(new Date());
        agendar();
      }, restante);
    };

    const aoTrocarVisibilidade = () => {
      if (document.visibilityState === 'visible') {
        // Acerta ANTES de reagendar: voltar de uma hora em segundo plano tem
        // que corrigir a tela no mesmo quadro, não no próximo minuto.
        setAgora(new Date());
        agendar();
      } else {
        parar();
      }
    };

    agendar();
    document.addEventListener('visibilitychange', aoTrocarVisibilidade);
    return () => {
      parar();
      document.removeEventListener('visibilitychange', aoTrocarVisibilidade);
    };
  }, []);

  return agora;
}
