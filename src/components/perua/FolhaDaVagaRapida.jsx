import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sheet from '../common/Sheet';
import Input from '../common/Input';
import Button from '../common/Button';
import { addChild } from '../../services/childrenService';
import { criancaRapida, frasesDaPerua, ocupacao } from '../../dominio/identidade/vagasDaPerua.js';

/**
 * O CADASTRO RÁPIDO PELO ASSENTO (05/10/2026, pedido do dono): tocou na vaga
 * livre, diz SÓ o nome (e menino ou menina, que decide o avatar). O assento
 * acende com o rosto e a folha já oferece a próxima vaga livre — ele enche a
 * perua em sequência. O resto se completa depois, na ficha ("Falta completar
 * o cadastro"). "Cadastro completo" leva ao formulário de sempre.
 *
 * Um botão cheio só: "Pôr na perua". Menino/menina é escolha, não protagonista.
 */
const GENEROS = [
  { value: 'male', label: 'Menino' },
  { value: 'female', label: 'Menina' },
];

export default function FolhaDaVagaRapida({ aberta, onFechar, vagas, criancas }) {
  const frases = frasesDaPerua({ vagas, criancas });
  // O corpo só existe com a folha aberta: cada abertura começa limpa.
  return (
    <Sheet open={aberta} onClose={onFechar} title="Pôr na perua" subtitle={frases.contagem}>
      {aberta && <CorpoDaVagaRapida onFechar={onFechar} vagas={vagas} criancas={criancas} />}
    </Sheet>
  );
}

function CorpoDaVagaRapida({ onFechar, vagas, criancas }) {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [genero, setGenero] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [ultima, setUltima] = useState(null);
  const campo = useRef(null);

  const { livres } = ocupacao({ vagas, criancas });

  const salvar = async (ev) => {
    ev.preventDefault();
    const dados = criancaRapida({ nome, genero });
    if (!dados) {
      setErro('Escreva o nome da criança.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await addChild(dados);
      setUltima(dados.name.split(/\s+/)[0]);
      setNome('');
      setGenero('');
      // O foco fica no nome: a próxima vaga é digitar de novo.
      setTimeout(() => campo.current?.focus?.(), 0);
    } catch (err) {
      console.error('[vaga rápida] não salvou:', err);
      toast.error('Não deu pra salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <form onSubmit={salvar} className="space-y-3">
        {ultima && (
          <p className="rounded-xl bg-primarySoft px-3 py-2.5 text-base font-semibold text-text">
            {ultima} está na perua.{' '}
            {livres > 0 ? 'Quem vem agora?' : 'A perua está cheia.'}
          </p>
        )}
        <Input
          ref={campo}
          falar="nome"
          label="Nome da criança"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          error={erro}
          autoFocus
        />
        <div role="radiogroup" aria-label="Menino ou menina" className="grid grid-cols-2 gap-2">
          {GENEROS.map((g) => (
            <button
              key={g.value}
              type="button"
              role="radio"
              aria-checked={genero === g.value}
              onClick={() => setGenero(genero === g.value ? '' : g.value)}
              className={`tap min-h-12 rounded-xl border-2 px-2 text-base font-semibold ${
                genero === g.value ? 'border-primary bg-primarySoft text-text' : 'border-border bg-card text-textMuted'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <Button type="submit" loading={salvando} className="shadow-focus">
          Pôr na perua
        </Button>
        <button
          type="button"
          onClick={() => {
            onFechar();
            navigate('/tio/children/new');
          }}
          className="tap flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-border bg-card text-base font-bold text-primary"
        >
          Cadastro completo
        </button>
        <p className="text-base text-textMuted">O resto você completa depois, na ficha.</p>
      </form>
    </>
  );
}
