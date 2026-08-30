import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarParceiros } from '../../services/userService';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
  PADRAO,
  carregarBasePorMotorista,
  watchNegociacoes,
  watchTaxaConfig,
} from '../../services/taxaService';
import FunilKanban from './FunilKanban';
import OrcamentoSheet from './OrcamentoSheet';

/**
 * A COSTURA entre o funil e o orçamento.
 *
 * `FunilKanban` e `OrcamentoSheet` foram escritos soltos — nenhum dos dois sabe
 * que o outro existe, e o kanban só avisa `onOrcar(lead)`. Este arquivo é o
 * ponto onde os dois se encontram, e existe separado do `AdminPanel` porque o
 * estado que ele carrega (base de todo mundo, negociações vigentes) não
 * interessa às outras abas: montá-lo lá faria a Visão geral pagar por leitura
 * que ela não usa.
 *
 * ORÇAR EXIGE CONTA, E A RECUSA É EXPLÍCITA
 * O id do lead é o uid QUANDO a pessoa se inscreveu pelo app; quem chegou por
 * fora (ligação, indicação, papel numa feira) tem id gerado. Salvar o orçamento
 * grava `taxaParceiros/{id}` e emite um contrato em `contratosAssociacao` — e
 * pra um id que não é de ninguém isso produz um contrato que ninguém consegue
 * aceitar, porque não existe login que chegue nele. As rules deixam passar: a
 * escrita é do dono, e o dono pode. Então quem impede é esta tela, dizendo o
 * motivo — um botão que grava lixo em silêncio é pior que um botão desligado.
 */
export default function FunilTab() {
  const { user } = useAuth();
  const [parceiros, setParceiros] = useState(null);
  const [falhouParceiros, setFalhouParceiros] = useState(false);
  const [bases, setBases] = useState({});
  const [negociacoes, setNegociacoes] = useState({});
  const [config, setConfig] = useState(PADRAO);
  const [orcando, setOrcando] = useState(null);

  // Contador de recarga em vez de função que grava estado: salvar o orçamento
  // muda a base do parceiro, e o efeito abaixo relê. Mesmo padrão do TaxaTab.
  const [recarga, setRecarga] = useState(0);
  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  useEffect(() => watchNegociacoes(setNegociacoes), []);
  useEffect(() => watchTaxaConfig(setConfig), []);

  useEffect(() => {
    let vivo = true;
    // `falhou` importa aqui mais que em qualquer outra tela: `abrirOrcamento`
    // recusa lead sem conta aprovada procurando NESTA lista. Uma leitura que
    // falhou virava "este motorista não tem conta aprovada", e mandava o dono
    // aprovar um cadastro que já estava aprovado.
    listarParceiros().then(({ lista, falhou }) => {
      if (!vivo) return;
      setParceiros(lista);
      setFalhouParceiros(falhou);
    });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    carregarBasePorMotorista()
      .then(({ resumos }) => vivo && setBases(resumos))
      .catch((err) => {
        console.error('[funil] não deu pra ler a base:', err);
        if (vivo) setBases({});
      });
    return () => {
      vivo = false;
    };
  }, [recarga]);

  const contaDe = useMemo(() => {
    const m = {};
    (parceiros || []).forEach((p) => {
      m[p.uid] = p;
    });
    return m;
  }, [parceiros]);

  const abrirOrcamento = (lead) => {
    if (parceiros === null) {
      toast('Ainda lendo os parceiros — tente de novo em um segundo.');
      return;
    }
    // A LEITURA FALHOU ≠ NÃO EXISTE CONTA.
    //
    // As duas terminavam em lista vazia, e a recusa abaixo tratava as duas
    // igual: o dono lia "ainda não tem conta aprovada" e era mandado aprovar
    // um cadastro que já estava aprovado — atrás de um erro de rede que
    // ninguém tinha visto.
    if (falhouParceiros) {
      toast.error(
        'Não deu pra ler a lista de parceiros agora, então não dá pra saber ' +
          'se este lead já tem conta. Recarregue a tela e tente de novo.',
        { duration: 8000 }
      );
      return;
    }
    const conta = contaDe[lead.id];
    if (!conta) {
      toast.error(
        `${lead.nome || 'Esse lead'} ainda não tem conta de motorista aprovada. ` +
          'O contrato precisa de alguém que consiga entrar pra aceitar — aprove ' +
          'o cadastro dele antes de orçar.',
        { duration: 8000 }
      );
      return;
    }
    // A conta manda no que vai pro contrato; o lead preenche o que faltar.
    // Nome digitado numa ligação não deve sobrescrever o nome da conta que
    // assina o documento.
    setOrcando({
      uid: conta.uid,
      name: conta.name || lead.nome || '',
      city: conta.city || lead.cidade || '',
      email: conta.email || lead.email || '',
      phone: conta.phone || lead.telefone || '',
      // O teto vigente, pra folha abrir com o número que já vale em vez de
      // sugerir um novo por cima de um acordo existente.
      limiteCriancas: conta.limiteCriancas ?? null,
    });
  };

  return (
    <>
      <FunilKanban onOrcar={abrirOrcamento} />

      <OrcamentoSheet
        // A `key` faz a folha RENASCER a cada parceiro: os campos são estado
        // local inicializado da prop, e sem isso o segundo orçamento abriria
        // com os números do primeiro.
        key={orcando?.uid || 'vazio'}
        open={!!orcando}
        onClose={() => setOrcando(null)}
        parceiro={orcando}
        base={orcando ? bases[orcando.uid] : null}
        config={config}
        negociacaoAtual={orcando ? negociacoes[orcando.uid] : null}
        ownerUid={user?.uid}
        onSalvo={recarregar}
      />
    </>
  );
}
