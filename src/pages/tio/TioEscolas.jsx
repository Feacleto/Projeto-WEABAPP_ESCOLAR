import { useMemo, useState } from 'react';
import {
  School,
  Plus,
  MapPin,
  Users,
  Pencil,
  Trash2,
  Wand2,
  X,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useChildren } from '../../hooks/useChildren';
import { useEscolas } from '../../hooks/useEscolas';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';
import {
  addEscola,
  updateEscola,
  removeEscola,
  criarEscolaEVincular,
  proporEscolasDasCriancas,
} from '../../services/escolasService';
import { searchAddress, buscarCep } from '../../services/locationService';
import { maskCep, unmaskCep, isValidCep } from '../../compartilhado/masks';
import { montarEndereco } from '../../compartilhado/formatters';

/**
 * "Escolas" — as que este motorista atende.
 *
 * POR QUE ESTA TELA EXISTE
 * A escola era três campos soltos dentro do cadastro da criança, digitados de
 * novo a cada criança. Cinco alunos da mesma escola eram cinco digitações e
 * cinco geocodings — e o aviso em massa, que agrupa por `c.school ===`,
 * alcançava só quem tivesse a grafia idêntica.
 *
 * ONDE ELA FICA E POR QUÊ
 * Em `/tio/children/escolas`, alcançada por um botão no topo da lista de
 * crianças. Não virou aba: já são quatro (Início, Crianças, Rota, Financeiro)
 * e a quinta aperta o polegar. Escola é assunto de cadastro — fica onde o
 * motorista já está quando pensa nisso.
 */
export default function TioEscolas() {
  const { children, loading: carregandoCriancas } = useChildren();
  const { escolas, loading } = useEscolas();

  // { id?, nome, cep, endereco, numero, complemento, cepPartes, lat, lng }
  const [editando, setEditando] = useState(null);

  // O ARRASTO RESPEITA O SALVAMENTO — e é por isso que esta folha não entrou
  // no lote das outras.
  //
  // Aqui fechar não é incondicional: o toque fora já checa `!salvando`, porque
  // sumir com o formulário no meio da gravação deixa a pessoa sem saber se a
  // escola foi criada. O gesto precisa da mesma trava; sem ela, o caminho mais
  // fácil de fechar seria justamente o único que ignora a regra.
  const [salvando, setSalvando] = useState(false);
  const { alcaProps, estilo } = useArrastarPraFechar(() => {
    if (!salvando) setEditando(null);
  });
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  // null = nunca consultou · 'ok' · 'notFound' · 'offline'
  const [cepState, setCepState] = useState(null);
  const [cepConsultado, setCepConsultado] = useState('');
  const [paraApagar, setParaApagar] = useState(null);
  const [migrando, setMigrando] = useState(null);

  /** Quantas crianças ativas em cada escola — o número que dá sentido à lista. */
  const contagem = useMemo(() => {
    const m = {};
    for (const c of children || []) {
      if (!c.schoolId) continue;
      m[c.schoolId] = (m[c.schoolId] || 0) + 1;
    }
    return m;
  }, [children]);

  /** Escolas que ainda vivem como texto solto dentro das crianças. */
  const propostas = useMemo(
    () => proporEscolasDasCriancas(children),
    [children]
  );

  const abrirNova = () => {
    setCepState(null);
    setCepConsultado('');
    setEditando({
      nome: '',
      cep: '',
      endereco: '',
      numero: '',
      complemento: '',
      cepPartes: null,
      lat: null,
      lng: null,
    });
  };

  /**
   * O CEP DA ESCOLA PREENCHE A RUA, e o número fica num campo próprio.
   *
   * ── MAS AQUI ELE NÃO É COBRADO, e a diferença com o cadastro da criança é
   * deliberada. A casa da criança precisa do número porque a perua encosta numa
   * PORTA: errar o número é parar na calçada errada com a mãe esperando na
   * outra. Escola é prédio grande, muitas vezes numa esquina ou num campus sem
   * número útil — e o fluxo já aceita `geoPending`, porque o motorista está
   * tentando cadastrar uma criança, não catalogar a cidade.
   *
   * Cobrar o número aqui por simetria travaria o cadastro no caso em que a
   * informação legitimamente não existe.
   */
  const consultarCep = async (digitos) => {
    setBuscandoCep(true);
    setCepConsultado(digitos);
    setCepState(null);
    try {
      const partes = await buscarCep(digitos);
      setEditando((e) => ({
        ...e,
        cepPartes: partes,
        endereco: montarEndereco({
          ...partes,
          numero: e?.numero || '',
          complemento: e?.complemento || '',
        }),
        // Endereço novo, coordenada velha não vale — a mesma razão que já
        // estava escrita no `onChange` do campo de endereço logo abaixo.
        lat: null,
        lng: null,
      }));
      setCepState('ok');
    } catch (err) {
      setCepState(/consultar/.test(err?.message || '') ? 'offline' : 'notFound');
    } finally {
      setBuscandoCep(false);
    }
  };

  // Consulta sozinha no oitavo dígito: CEP tem tamanho fixo, então dá pra saber
  // que a pessoa terminou sem precisar de botão. `cepConsultado` evita uma
  // requisição por tecla depois disso.
  const onCepChange = (valorBruto) => {
    const cep = maskCep(valorBruto);
    setEditando((s) => ({ ...s, cep }));
    const digitos = unmaskCep(cep);
    if (digitos.length < 8) {
      setCepState(null);
      setCepConsultado('');
      return;
    }
    if (!isValidCep(cep) || digitos === cepConsultado) return;
    consultarCep(digitos);
  };

  // Número e complemento remontam o endereço enquanto ele for derivado do CEP.
  const setParteDoEndereco = (campo) => (valor) =>
    setEditando((s) => {
      if (!s?.cepPartes?.logradouro) return { ...s, [campo]: valor };
      return {
        ...s,
        [campo]: valor,
        endereco: montarEndereco({
          ...s.cepPartes,
          numero: campo === 'numero' ? valor : s.numero || '',
          complemento: campo === 'complemento' ? valor : s.complemento || '',
        }),
        lat: null,
        lng: null,
      };
    });

  async function buscarEndereco() {
    const q = editando?.endereco?.trim();
    if (!q) {
      toast.error('Digite o endereço da escola primeiro.');
      return;
    }
    setBuscandoEndereco(true);
    try {
      // Com as partes do CEP, a consulta vai montada (número na frente, sem o
      // complemento) — ver `consultaDoEndereco` no locationService.
      const partes = editando?.cepPartes
        ? { ...editando.cepPartes, numero: editando.numero || '' }
        : null;
      const r = await searchAddress(q, partes);
      setEditando((e) => ({
        ...e,
        lat: r.lat,
        lng: r.lng,
        // Vindo do CEP o texto NÃO é trocado pelo `display_name`: ele é verboso
        // e costuma perder o número que o campo próprio acabou de garantir.
        endereco: e.cepPartes ? e.endereco : r.displayName || e.endereco,
      }));
      toast.success('Encontramos a escola!');
    } catch (err) {
      toast.error(err.message || 'Não achamos esse endereço.');
    } finally {
      setBuscandoEndereco(false);
    }
  }

  async function salvar() {
    if (!editando?.nome?.trim()) {
      toast.error('Diga o nome da escola.');
      return;
    }
    setSalvando(true);
    try {
      if (editando.id) {
        await updateEscola(editando.id, {
          nome: editando.nome,
          endereco: editando.endereco,
          // Só escreve quando há CEP: `''` por cima de um CEP válido perderia
          // dado numa edição que nem tocou nele.
          ...(unmaskCep(editando.cep) ? { cep: maskCep(editando.cep) } : {}),
          lat: editando.lat,
          lng: editando.lng,
        });
        toast.success('Escola atualizada.');
      } else {
        await addEscola(editando);
        toast.success('Escola cadastrada.');
      }
      setEditando(null);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Não deu pra salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!paraApagar) return;
    setSalvando(true);
    try {
      await removeEscola(paraApagar.id);
      toast.success('Escola removida.');
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra remover.');
    } finally {
      setSalvando(false);
      setParaApagar(null);
    }
  }

  async function migrar(grupo) {
    setMigrando(grupo.chave);
    try {
      const { vinculadas } = await criarEscolaEVincular(grupo);
      toast.success(
        `${grupo.nome}: ${vinculadas} ${vinculadas === 1 ? 'criança vinculada' : 'crianças vinculadas'}.`
      );
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra criar a escola. Tente de novo.');
    } finally {
      setMigrando(null);
    }
  }

  const carregando = loading || carregandoCriancas;

  return (
    <div className="min-h-screen pb-28">
      <Header title="Escolas" showBack backLabel="Crianças" backTo="/tio/children" />

      <div className="px-5 pt-4 space-y-4">
        <p className="text-sm text-textMuted">
          As escolas que você atende. Cadastre uma vez e escolha na hora de
          cadastrar a criança — o aviso de “não vai ter aula” usa esta lista pra
          saber quem avisar.
        </p>

        {carregando && <Skeleton className="h-32 rounded-2xl" />}

        {/* Migração: escolas que ainda são texto solto dentro das crianças */}
        {!carregando && propostas.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-start gap-2.5 bg-warningSoft border border-warningBorder rounded-2xl p-3">
              <Wand2 size={18} className="text-warningText shrink-0 mt-0.5" />
              <div className="text-xs text-warningText leading-relaxed">
                <b className="block text-sm">
                  Achei {propostas.length}{' '}
                  {propostas.length === 1 ? 'escola' : 'escolas'} nos seus
                  cadastros
                </b>
                Elas estão salvas como texto dentro de cada criança. Confirme
                pra virarem escolas de verdade — aí o aviso em massa alcança a
                turma inteira.
              </div>
            </div>

            {propostas.map((g) => (
              <div
                key={g.chave}
                className="bg-card border border-border rounded-2xl p-3 space-y-2.5"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-neutro text-textMuted flex items-center justify-center shrink-0">
                    <School size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-text text-sm leading-tight">
                      {g.nome}
                    </p>
                    <p className="text-[11px] text-textMuted">
                      {g.criancas.length}{' '}
                      {g.criancas.length === 1 ? 'criança' : 'crianças'}
                      {g.lat == null && ' · sem localização'}
                    </p>
                  </div>
                </div>

                {/* As grafias diferentes são o motivo da tela existir —
                  * mostrar quais eram deixa claro o que está sendo unificado. */}
                {g.variacoes.length > 1 && (
                  <p className="text-[11px] text-textMuted bg-sunken rounded-lg px-2.5 py-1.5 leading-relaxed">
                    Escrita de {g.variacoes.length} jeitos:{' '}
                    {g.variacoes.map((v) => `“${v}”`).join(', ')}
                  </p>
                )}

                <Button
                  size="sm"
                  icon={Check}
                  loading={migrando === g.chave}
                  disabled={!!migrando}
                  onClick={() => migrar(g)}
                >
                  Criar e vincular {g.criancas.length}
                </Button>
              </div>
            ))}
          </section>
        )}

        {/* Lista */}
        {!carregando && escolas.length === 0 && propostas.length === 0 && (
          <EmptyState
            icon={School}
            title="Nenhuma escola cadastrada"
            description="Cadastre as escolas que você atende pra não digitar o mesmo endereço em cada criança."
            action={
              <Button fullWidth={false} icon={Plus} onClick={abrirNova}>
                Cadastrar escola
              </Button>
            }
          />
        )}

        {!carregando && escolas.length > 0 && (
          <section className="space-y-2">
            {escolas.map((e) => (
              <div
                key={e.id}
                className="bg-card border border-border rounded-2xl p-3 flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-escolaSoft text-escola flex items-center justify-center shrink-0">
                  <School size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-text text-sm leading-tight">
                    {e.nome}
                  </p>
                  {e.endereco && (
                    <p className="text-[11px] text-textMuted truncate mt-0.5">
                      {e.endereco}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] text-textMuted">
                      <Users size={12} />
                      {contagem[e.id] || 0}
                    </span>
                    {e.geoPending && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-warningText">
                        <MapPin size={12} />
                        sem localização
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`Editar ${e.nome}`}
                    onClick={() =>
                      setEditando({
                        id: e.id,
                        nome: e.nome || '',
                        cep: maskCep(e.cep || ''),
                        endereco: e.endereco || '',
                        numero: '',
                        complemento: '',
                        cepPartes: null,
                        lat: e.lat ?? null,
                        lng: e.lng ?? null,
                      })
                    }
                    className="tap w-9 h-9 rounded-xl border border-border text-textMuted flex items-center justify-center"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${e.nome}`}
                    onClick={() => setParaApagar(e)}
                    className="tap w-9 h-9 rounded-xl border border-border text-danger flex items-center justify-center"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}

            <Button variant="secondary" icon={Plus} onClick={abrirNova}>
              Cadastrar escola
            </Button>
          </section>
        )}
      </div>

      {/* Formulário */}
      {editando && (
        <div
          className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
          onClick={() => !salvando && setEditando(null)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[88vh] overflow-y-auto"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 0)',
              ...estilo,
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div
              {...alcaProps}
              className={`pt-3 pb-1 flex justify-center ${alcaProps.className}`}
            >
              <span className="block w-10 h-1.5 rounded-full bg-borderStrong" />
            </div>

            <div className="px-5 pt-2 pb-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-bold text-text">
                  {editando.id ? 'Editar escola' : 'Nova escola'}
                </h2>
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  aria-label="Fechar"
                  className="tap w-9 h-9 rounded-full bg-neutro flex items-center justify-center text-textMuted shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <Input
                label="Nome da escola"
                icon={School}
                placeholder="EM Rui Barbosa"
                value={editando.nome}
                onChange={(ev) =>
                  setEditando((s) => ({ ...s, nome: ev.target.value }))
                }
              />

              {/* O CEP É ATALHO, NUNCA REQUISITO — quem sabe a escola de cabeça
                * digita o endereço no campo de baixo, como antes. */}
              <Input
                label="CEP"
                icon={MapPin}
                placeholder="00000-000"
                value={editando.cep || ''}
                onChange={(ev) => onCepChange(ev.target.value)}
                inputMode="numeric"
                maxLength={9}
                hint="Opcional — preenche a rua sozinho."
              />

              {buscandoCep && (
                <p className="text-sm text-textMuted">Consultando o CEP…</p>
              )}

              {/* "Não achamos" e "está fora do ar" dizem coisas diferentes: a
                * primeira pede pra reconferir, a segunda avisa que não é ela. */}
              {cepState === 'notFound' && (
                <p className="rounded-xl bg-warningSoft px-4 py-3 text-sm leading-relaxed text-warningText">
                  Não achamos esse CEP. Confira os números — ou escreva o
                  endereço completo abaixo.
                </p>
              )}

              {cepState === 'offline' && (
                <p className="rounded-xl bg-warningSoft px-4 py-3 text-sm leading-relaxed text-warningText">
                  A consulta de CEP está fora do ar. Escreva o endereço completo
                  abaixo.
                </p>
              )}

              <Input
                label="Endereço"
                icon={MapPin}
                placeholder="Rua, número, bairro"
                value={editando.endereco}
                onChange={(ev) =>
                  setEditando((s) => ({
                    ...s,
                    endereco: ev.target.value,
                    // Digitar aqui torna a pessoa dona do texto: as partes do
                    // CEP são soltas e a remontagem para de acontecer.
                    cepPartes: null,
                    // Mexeu no endereço, a coordenada antiga não vale mais.
                    // Guardá-la seria manter a perua indo pro lugar antigo.
                    lat: null,
                    lng: null,
                  }))
                }
                hint={
                  editando.cepPartes
                    ? 'Preenchido pelo CEP. Se editar aqui, o texto passa a ser seu.'
                    : undefined
                }
              />

              {/* Número e complemento só aparecem depois do CEP: sem a rua
                * preenchida, "123" sozinho não é endereço. Aqui o número NÃO é
                * obrigatório — ver o comentário de `consultarCep`. */}
              {editando.cepPartes?.logradouro && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Número"
                    placeholder="123"
                    value={editando.numero || ''}
                    onChange={(ev) => setParteDoEndereco('numero')(ev.target.value)}
                    inputMode="numeric"
                  />
                  <Input
                    label="Complemento"
                    placeholder="bloco B"
                    value={editando.complemento || ''}
                    onChange={(ev) =>
                      setParteDoEndereco('complemento')(ev.target.value)
                    }
                  />
                </div>
              )}

              <Button
                variant="secondary"
                icon={MapPin}
                loading={buscandoEndereco}
                onClick={buscarEndereco}
              >
                Buscar no mapa
              </Button>

              {editando.lat != null && (
                <div className="flex items-center gap-2 text-sm text-primary bg-primarySoft border border-primaryBorder px-4 py-3 rounded-xl">
                  <Check size={18} />
                  <span>Local confirmado</span>
                </div>
              )}

              <Button loading={salvando} onClick={salvar}>
                {editando.id ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!paraApagar}
        title={paraApagar ? `Remover ${paraApagar.nome}?` : ''}
        description={
          contagem[paraApagar?.id]
            ? `${contagem[paraApagar.id]} ${contagem[paraApagar.id] === 1 ? 'criança usa' : 'crianças usam'} esta escola. O endereço fica salvo em cada uma, então a rota não muda — mas o aviso em massa deixa de agrupar por ela.`
            : 'Nenhuma criança usa esta escola.'
        }
        confirmLabel="Remover"
        variant="danger"
        loading={salvando}
        onConfirm={apagar}
        onCancel={() => setParaApagar(null)}
      />
    </div>
  );
}
