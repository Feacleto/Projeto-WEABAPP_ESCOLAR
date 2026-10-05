import { useState } from 'react';
import { HeartPulse, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import AppSheet from '../common/AppSheet';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import {
  salvarSaudeDaCrianca,
  apagarSaudeDaCrianca,
} from '../../services/childrenService';
import { formatDate } from '../../compartilhado/formatters';

/**
 * A INFORMAÇÃO DE SAÚDE DA CRIANÇA, NA FICHA (03/10/2026).
 *
 * O mecanismo existia desde 09/09/2026 (as rules deixam só a responsável
 * titular escrever `saudeNotas`, sempre junto de `saudeConsentidaEm`) e
 * faltava a tela dela. O desenho e os textos são os de
 * `docs/consentimento-saude.md`:
 *
 *   - OPCIONAL: o app funciona inteiro sem isto, e a tela diz isso antes de
 *     qualquer campo. Condicionar o serviço a dado sensível é o outro jeito
 *     de violar o art. 11.
 *   - O CONSENTIMENTO É UMA CAIXA PRÓPRIA, desmarcada, com o texto DENTRO
 *     dela — não um link, não o aceite dos Termos. É o que "destacado" quer
 *     dizer no art. 11, I.
 *   - EDITAR É CONSENTIR DE NOVO: o texto muda, a data muda. Uma data velha
 *     autorizando um texto novo não prova nada.
 *   - APAGAR EXISTE DE VERDADE (art. 18, VI): um botão, e os dois campos saem
 *     juntos.
 *
 * ⚠️ OS TEXTOS SÃO O RASCUNHO DO DOCUMENTO, que pede revisão jurídica antes
 * de ir ao ar. Decisão do dono: construir agora, publicar depois da revisão.
 * Revisados em 05/10/2026: a caixa diz que quem AUTORIZA é o responsável e o
 * que ele autoriza (guardar no app e mostrar só ao motorista) — "autorizo o
 * Alô Buzinou" punha a plataforma como quem decide, e para a turma quem
 * decide é o motorista (Política, seção 2). E a folha diz que NÃO autorizar
 * não muda nada, e onde se apaga: consentimento só é livre quando recusar
 * não custa nada (art. 8º e 11, I).
 *
 * QUEM VÊ O QUÊ: a titular (`parentUid`) lê e escreve; o motorista da
 * criança só lê, e só quando existe — sem informação, nada aparece para ele
 * (a ausência não é aviso). A rule é a tranca; esconder o botão aqui é só
 * não oferecer o que seria recusado.
 */
export default function SaudeDaCrianca({ child, isAdmin }) {
  const { user } = useAuth();
  const [editando, setEditando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const notas = (child?.saudeNotas || '').trim();
  const ehTitular = !isAdmin && child?.parentUid && child.parentUid === user?.uid;
  const primeiroNome = (child?.name || '').trim().split(/\s+/)[0] || 'a criança';

  if (!notas && !ehTitular) return null;

  const apagar = async () => {
    setOcupado(true);
    try {
      await apagarSaudeDaCrianca(child.id);
      toast.success('Informação de saúde apagada.');
      setApagando(false);
    } catch (err) {
      console.error('[saude] falha ao apagar:', err);
      toast.error('Não deu pra apagar. Tente de novo.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex min-h-12 items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-base font-bold text-text">
          <HeartPulse size={18} className="shrink-0 text-dangerText" />
          {isAdmin ? 'Saúde (a família informou)' : 'Saúde (opcional)'}
        </p>
        {ehTitular && notas && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            aria-label="Editar a informação de saúde"
            className="tap -mr-2 inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-primary"
          >
            <Pencil size={18} />
            Editar
          </button>
        )}
      </div>

      {notas ? (
        <>
          <p className="mt-1 whitespace-pre-line text-lg leading-snug text-text">
            {notas}
          </p>
          <p className="mt-2 text-sm text-textMuted">
            {isAdmin
              ? 'Para usar só em caso de emergência no trajeto.'
              : `Você autorizou em ${formatDate(child.saudeConsentidaEm)}. Só o motorista de ${primeiroNome} vê.`}
          </p>
          {ehTitular && (
            <button
              type="button"
              onClick={() => setApagando(true)}
              className="tap mt-2 inline-flex min-h-12 items-center gap-1.5 text-base font-semibold text-dangerText"
            >
              <Trash2 size={18} />
              Apagar esta informação
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-base leading-relaxed text-textBody">
            Se quiser, informe alergias, remédios ou condições de saúde que o
            motorista precise saber numa emergência no trajeto. É opcional: sem
            isso, o app e o transporte funcionam igual.
          </p>
          <Button
            variant="secondary"
            size="md"
            className="mt-3"
            onClick={() => setEditando(true)}
          >
            Informar saúde
          </Button>
        </>
      )}

      {ehTitular && (
        <FolhaDaSaude
          open={editando}
          onClose={() => setEditando(false)}
          child={child}
          primeiroNome={primeiroNome}
        />
      )}

      <ConfirmDialog
        open={apagando}
        title="Apagar a informação de saúde?"
        description={`O motorista deixa de ver o que você escreveu sobre a saúde de ${primeiroNome}. Você pode informar de novo quando quiser.`}
        confirmLabel="Apagar"
        cancelLabel="Manter"
        variant="danger"
        loading={ocupado}
        onConfirm={apagar}
        onCancel={() => setApagando(false)}
      />
    </div>
  );
}

/**
 * A folha onde ela escreve e consente — no MESMO gesto, como as rules exigem.
 * A caixa nasce desmarcada a cada abertura: editar é consentir de novo.
 */
function FolhaDaSaude({ open, onClose, child, primeiroNome }) {
  // "dele"/"dela" pelo gênero do cadastro; sem gênero, a frase neutra.
  const dele =
    child?.gender === 'female' ? 'dela' : child?.gender === 'male' ? 'dele' : 'da criança';
  const [texto, setTexto] = useState(child?.saudeNotas || '');
  const [autorizo, setAutorizo] = useState(false);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Reabrir a folha recomeça: o texto salvo e a caixa desmarcada.
  const [abertaAntes, setAbertaAntes] = useState(open);
  if (open !== abertaAntes) {
    setAbertaAntes(open);
    if (open) {
      setTexto(child?.saudeNotas || '');
      setAutorizo(false);
      setErro(null);
    }
  }

  const salvar = async () => {
    // O botão nunca fica apagado e mudo: ele diz o que falta.
    if (!texto.trim()) {
      setErro('Escreva a informação antes de salvar.');
      return;
    }
    if (!autorizo) {
      setErro('Para salvar, marque a autorização logo acima.');
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await salvarSaudeDaCrianca(child.id, texto);
      toast.success('Informação de saúde salva.');
      onClose();
    } catch (err) {
      console.error('[saude] falha ao salvar:', err);
      setErro('Não deu pra salvar. Confira a internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppSheet
      open={open}
      onClose={() => !salvando && onClose()}
      title="Informações de saúde"
      subtitle="Opcional"
      icon={HeartPulse}
      size="tall"
    >
      <div className="space-y-4 pb-2">
        <p className="text-base leading-relaxed text-textBody">
          Você pode informar alergias, medicamentos ou condições de saúde que o
          motorista precise saber em caso de emergência no trajeto.
        </p>
        <p className="text-base leading-relaxed text-textBody">
          <strong className="font-bold text-text">Isso é opcional.</strong> Se
          você não autorizar, nada muda no uso do app nem no transporte. E você
          pode apagar a informação nesta ficha, a qualquer momento.
        </p>

        <label className="block">
          <span className="text-sm font-semibold text-text">
            O que o motorista precisa saber
          </span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Digite aqui"
            className="mt-1 w-full rounded-xl border border-border bg-card p-3 text-base text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-primaryBorder bg-primarySoft p-3">
          <input
            type="checkbox"
            checked={autorizo}
            onChange={(e) => setAutorizo(e.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0 accent-primary"
          />
          <span className="text-base leading-relaxed text-text">
            Autorizo que as informações de saúde de{' '}
            <strong className="font-bold">{child?.name || primeiroNome}</strong>{' '}
            sejam guardadas no app e mostradas só ao motorista do transporte{' '}
            {dele}, para uso em caso de emergência no trajeto.
          </span>
        </label>

        <p className="text-base leading-relaxed text-textMuted">
          Essa informação não aparece para outros motoristas nem para a
          auxiliar, não é usada para mais nada e é apagada junto com o
          cadastro da criança.
        </p>

        {erro && (
          <p role="alert" className="text-sm font-semibold text-dangerText">
            {erro}
          </p>
        )}

        <Button onClick={salvar} loading={salvando}>
          Salvar
        </Button>
      </div>
    </AppSheet>
  );
}
