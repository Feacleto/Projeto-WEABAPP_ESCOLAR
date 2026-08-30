import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Home as HomeIcon,
  Lock,
  Send,
  Star,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from '../common/Avatar';
import Sheet, { SheetCTA, SheetCard, SheetGhost } from '../common/Sheet';
import { ReviewCard } from '../landing/ReviewsBlock';
import {
  PUBLIC_COMMENT_MAX,
  submitFeedback,
} from '../../services/feedbackService';
import { STORAGE_ENABLED } from '../../config/capabilities';
import { USE_OPTIONS_PAI, USE_OPTIONS_TIO, WISH_OPTIONS } from './surveyOptions';

/**
 * Folha de avaliação — uma pra motorista, uma pra responsável, mesmo motor.
 *
 * O QUE MUDA ENTRE OS DOIS (e por quê)
 * O depoimento do MOTORISTA vai pra home: ele é a prova social que convence
 * outro motorista. Então, pra ele, a folha é explícita sobre isso ANTES da
 * primeira estrela — o que vai aparecer, onde, com foto e nome — e mostra um
 * preview do card exatamente como ele vai sair. Publicar depoimento de
 * alguém que não entendeu que era público seria a pior coisa que este app
 * poderia fazer com a confiança de um parceiro.
 *
 * A avaliação do RESPONSÁVEL nunca é publicada. Ela é igualmente valiosa,
 * mas como MÉTRICA: é ela que diz se o app está servindo a ponta que não
 * paga pela ferramenta. A folha dele diz isso com a mesma clareza — "só a
 * gente vê" — porque prometer privacidade e publicar depois é o mesmo erro
 * ao contrário.
 *
 * OS DOIS ANDARES
 * 1. O que é público (motorista) ou o recado direto (responsável): estrelas,
 *    depoimento de até 200 caracteres, foto.
 * 2. Opcional, pra quem quiser ajudar de verdade: as perguntas de métrica
 *    (o que mais usa, o que mais ajudaria). É UM documento só no fim — duas
 *    submissões contariam duas vezes na média.
 *
 * A FOTO É REQUISITO DO CARD, NÃO DA OPINIÃO
 * Sem foto o card na home fica com um monograma e perde metade da força, e
 * é o rosto do parceiro que faz outro motorista confiar. Então publicar
 * exige foto — mas quem não tem (ou não quer) continua podendo mandar a
 * avaliação em modo privado, com um toque. Ninguém fica sem voz por causa
 * de um upload.
 */

const STAR_LABELS = {
  1: 'Tá ruim',
  2: 'Podia melhorar',
  3: 'Tá ok',
  4: 'Tá bom',
  5: 'Tá ótimo!',
};

export default function ReviewSheet({ open, onClose, uid, role, profile }) {
  const navigate = useNavigate();
  const isTio = role === 'admin';

  const [step, setStep] = useState('nota'); // nota | metricas | pronto
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [autoriza, setAutoriza] = useState(false);
  const [uses, setUses] = useState([]);
  const [wish, setWish] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [publicou, setPublicou] = useState(false);

  // Anexo de arquivo pode estar desligado no ambiente (ver capabilities).
  // Quando está, o editor de foto do perfil nem existe — então exigir foto
  // aqui criava um beco sem saída: o botão de publicar ficava travado pra
  // sempre, e o atalho "enviar foto agora" levava a uma tela que não tem
  // onde enviar. Requisito que ninguém pode cumprir é o mesmo erro de
  // correção que ninguém pode executar.
  const podeEnviarFoto = STORAGE_ENABLED;
  const temFoto = podeEnviarFoto && !!profile?.photoURL;
  const texto = comment.trim();
  const restam = PUBLIC_COMMENT_MAX - comment.length;

  // Publicar exige o que o card mostra: nota, texto e autorização explícita.
  // A foto entra na conta só quando o ambiente permite enviar uma — sem
  // Storage, o card sai com o avatar gerado pelo app (todo mundo tem um) e o
  // depoimento continua podendo ir pra home.
  const podePublicar =
    isTio &&
    rating >= 1 &&
    texto.length >= 8 &&
    autoriza &&
    (temFoto || !podeEnviarFoto);

  const fechar = () => {
    setStep('nota');
    setRating(0);
    setComment('');
    setAutoriza(false);
    setUses([]);
    setWish(null);
    setPublicou(false);
    onClose?.();
  };

  const enviar = async ({ publicar }) => {
    if (rating < 1) {
      toast.error('Dá uma nota em estrelas primeiro!');
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        uid,
        role,
        answers: { rating, uses, wish },
        comment,
        allowTestimonial: publicar,
        allowPhoto: publicar && temFoto,
        // Manda o nome como está: quem CORTA é o serviço, que grava
        // `authorFirstName` e nunca o nome completo.
        //
        // Eu cortava aqui também, por um tempo, e tirei de propósito. O
        // documento de feedback com `allowTestimonial: true` é legível por
        // qualquer um sem login (é o que alimenta a vitrine da home), então
        // sobrenome ali é vazamento — mas garantia de CAMPO tem que morar
        // onde o campo é escrito, senão ela vale só pro caminho que passa
        // por esta tela. Duas truncagens em dois arquivos também tiram do
        // leitor a resposta pra "quem manda aqui?" no dia em que uma das
        // duas mudar.
        authorName: profile?.name || null,
        authorPhotoURL: publicar && temFoto ? profile.photoURL : null,
      });
      setPublicou(publicar);
      setStep('pronto');
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra enviar. Tenta de novo.');
    } finally {
      setSubmitting(false);
    }
  };

  const irProFoto = () => {
    const destino = isTio ? '/tio/profile' : '/pai/profile';
    fechar();
    navigate(destino);
  };

  /* ─────────── fim: confirmação ─────────── */
  if (step === 'pronto') {
    return (
      <Sheet
        open={open}
        onClose={fechar}
        icon={CheckCircle2}
        eyebrow="obrigado"
        title={publicou ? 'Publicado na home' : 'Avaliação enviada'}
        subtitle={
          publicou
            ? 'Seu depoimento já aparece pra quem visita o app.'
            : 'Sua opinião chegou aqui — é ela que decide o que a gente melhora.'
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-primary text-white shadow-focus">
            <Check size={32} strokeWidth={3} />
          </span>
          <p className="text-sm leading-relaxed text-textMuted">
            {publicou
              ? 'Se mudar de ideia, fale com a gente e a gente tira do ar.'
              : 'Nada do que você escreveu aqui aparece pra ninguém além de nós.'}
          </p>
          {publicou && (
            <SheetGhost icon={HomeIcon} onClick={() => { fechar(); navigate('/'); }}>
              Ver na home
            </SheetGhost>
          )}
          <SheetCTA onClick={fechar}>Fechar</SheetCTA>
        </div>
      </Sheet>
    );
  }

  /* ─────────── andar 2: métricas (opcional) ─────────── */
  if (step === 'metricas') {
    const useOptions = isTio ? USE_OPTIONS_TIO : USE_OPTIONS_PAI;
    return (
      <Sheet
        open={open}
        onClose={fechar}
        icon={Target}
        eyebrow="opcional · ajuda o app"
        title="Duas perguntas rápidas"
        subtitle="Isso não vai pra lugar nenhum público — serve pra decidir o que construir."
      >
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-bold text-text">
              O que você mais usa?
            </p>
            <p className="mb-3 text-xs text-textMuted">
              Pode marcar quantos quiser.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {useOptions.map(({ value, icon: Icon, label }) => {
                const on = uses.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setUses((p) =>
                        p.includes(value)
                          ? p.filter((v) => v !== value)
                          : [...p, value]
                      )
                    }
                    className={`tap flex items-center gap-2 rounded-2xl border-2 p-3 text-left text-xs font-semibold transition-colors ${
                      on
                        ? 'border-primary bg-primary/5 text-text'
                        : 'border-border bg-card text-textMuted'
                    }`}
                  >
                    <Icon
                      size={16}
                      className={on ? 'text-primary' : 'text-textMuted'}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-bold text-text">
              O que ajudaria mais?
            </p>
            <div className="space-y-2">
              {WISH_OPTIONS.map(({ value, icon: Icon, label }) => {
                const on = wish === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWish(value)}
                    className={`tap flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left text-sm font-semibold transition-colors ${
                      on
                        ? 'border-primary bg-primary/5 text-text'
                        : 'border-border bg-card text-textMuted'
                    }`}
                  >
                    <Icon
                      size={17}
                      className={on ? 'text-primary' : 'text-textMuted'}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <SheetCTA
              icon={Send}
              loading={submitting}
              onClick={() => enviar({ publicar: podePublicar })}
            >
              {podePublicar ? 'Publicar e enviar' : 'Enviar avaliação'}
            </SheetCTA>
            <button
              type="button"
              onClick={() => setStep('nota')}
              className="block w-full py-2 text-sm text-textMuted hover:text-text"
            >
              Voltar
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  /* ─────────── andar 1: a nota ─────────── */
  return (
    <Sheet
      open={open}
      onClose={fechar}
      icon={Star}
      eyebrow={isTio ? 'sua avaliação vai pra home' : 'sua avaliação é privada'}
      title={isTio ? 'Conte como tem sido' : 'Como está sendo pra você?'}
      subtitle={
        isTio
          ? 'Associado é quem convence outro motorista a entrar.'
          : 'Sua resposta ajuda a melhorar o app — e não aparece pra ninguém.'
      }
    >
      <div className="space-y-5">
        {/* O contrato, antes da primeira estrela. */}
        {isTio ? (
          <SheetCard className="!border-primaryBorder !bg-primarySoft">
            <p className="text-sm font-bold text-text">
              O que aparece na home do app
            </p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-primary/80">
              <li>· suas estrelas</li>
              <li>· seu depoimento, até {PUBLIC_COMMENT_MAX} caracteres</li>
              <li>
                {podeEnviarFoto
                  ? '· seu primeiro nome e sua foto'
                  : '· seu primeiro nome e o avatar do app'}
              </li>
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-primary/70">
              Nada é publicado sem você marcar a autorização no fim.
            </p>
          </SheetCard>
        ) : (
          <SheetCard>
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text">
              <Lock size={14} className="text-primary" />
              Só a gente vê
            </p>
            <p className="mt-1 text-xs leading-relaxed text-textMuted">
              A avaliação de responsável não vai pra parte pública do app. Ela
              serve pra gente saber o que melhorar.
            </p>
          </SheetCard>
        )}

        {/* Estrelas — grandes, com nome no que cada uma quer dizer. */}
        <div>
          <p className="mb-2 text-sm font-bold text-text">Sua nota</p>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
                className="tap p-0.5"
              >
                <Star
                  size={38}
                  className={
                    n <= rating
                      ? 'fill-ouro text-ouro'
                      : 'fill-border text-borderStrong'
                  }
                />
              </button>
            ))}
          </div>
          <p className="mt-1.5 h-5 text-sm font-semibold text-textMuted">
            {rating ? STAR_LABELS[rating] : ''}
          </p>
        </div>

        {/* Depoimento */}
        <div>
          <div className="mb-2 flex items-end justify-between">
            <label htmlFor="review-comment" className="text-sm font-bold text-text">
              {isTio ? 'Seu depoimento' : 'Quer contar algo?'}
            </label>
            {isTio && (
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  restam < 0
                    ? 'text-danger'
                    : restam < 30
                      ? 'text-warning'
                      : 'text-textMuted'
                }`}
              >
                {comment.length}/{PUBLIC_COMMENT_MAX}
              </span>
            )}
          </div>
          <textarea
            id="review-comment"
            rows={4}
            value={comment}
            maxLength={isTio ? PUBLIC_COMMENT_MAX : 1000}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              isTio
                ? 'O que mudou no seu dia a dia desde que você usa o app?'
                : 'O que está bom, o que está ruim…'
            }
            className="w-full rounded-2xl border-2 border-border bg-card p-4 text-sm text-text placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Foto — só importa pra quem vai pra vitrine, e só quando o ambiente
          * deixa enviar arquivo. */}
        {isTio && podeEnviarFoto && (
          <div>
            <p className="mb-2 text-sm font-bold text-text">Sua foto</p>
            {temFoto ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <Avatar
                  photoURL={profile.photoURL}
                  kind="admin"
                  name={profile?.name}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">
                    Vamos usar esta foto
                  </p>
                  <p className="text-xs text-textMuted">
                    É a foto do seu perfil. Pode trocar quando quiser.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-warningBorder bg-warningSoft p-4">
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-text">
                  <Camera size={15} className="text-warning" />
                  Falta sua foto
                </p>
                <p className="mt-1 text-xs leading-relaxed text-warningText/80">
                  Pra aparecer na home o card precisa do seu rosto — é ele que
                  faz outro motorista confiar. Sem foto, você ainda pode mandar
                  a avaliação em modo privado.
                </p>
                <button
                  type="button"
                  onClick={irProFoto}
                  className="tap mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-white"
                >
                  Enviar foto agora
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Autorização + preview: ele vê o card antes de dizer sim. */}
        {isTio && (
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <input
                type="checkbox"
                checked={autoriza}
                onChange={(e) => setAutoriza(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-borderStrong text-primary focus:ring-primary/40"
              />
              <span className="text-xs leading-relaxed text-text">
                Autorizo publicar meu <strong>primeiro nome</strong>,{' '}
                {podeEnviarFoto ? (
                  <>
                    minha <strong>foto</strong>,{' '}
                  </>
                ) : null}
                minhas <strong>estrelas</strong> e este{' '}
                <strong>depoimento</strong> na home do Alô Buzinou.
              </span>
            </label>

            {rating > 0 && texto.length >= 8 && (
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-textMuted">
                  como vai aparecer
                </p>
                {/* Fundo escuro de propósito: é o fundo real da home. */}
                <div className="overflow-hidden rounded-2xl bg-[#0B1210] p-4">
                  <ReviewCard
                    review={{
                      id: 'preview',
                      firstName: (profile?.name || '').split(' ')[0] || 'Você',
                      photoURL: temFoto ? profile.photoURL : null,
                      rating,
                      comment: texto,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="space-y-2 pt-1">
          {isTio ? (
            <>
              <SheetCTA
                icon={Send}
                loading={submitting}
                disabled={!podePublicar}
                onClick={() => enviar({ publicar: true })}
              >
                Publicar na home
              </SheetCTA>
              {!podePublicar && (
                <p className="text-center text-[11px] text-textMuted">
                  {rating < 1
                    ? 'Dê a nota em estrelas.'
                    : texto.length < 8
                      ? 'Escreva seu depoimento.'
                      : podeEnviarFoto && !temFoto
                        ? 'Envie uma foto pra poder publicar.'
                        : 'Marque a autorização pra publicar.'}
                </p>
              )}
              <SheetGhost
                loading={submitting}
                onClick={() => enviar({ publicar: false })}
                disabled={rating < 1}
              >
                Enviar sem publicar
              </SheetGhost>
            </>
          ) : (
            <SheetCTA
              icon={Send}
              loading={submitting}
              disabled={rating < 1}
              onClick={() => enviar({ publicar: false })}
            >
              Enviar avaliação
            </SheetCTA>
          )}

          <button
            type="button"
            onClick={() => {
              if (rating < 1) {
                toast.error('Dá uma nota em estrelas primeiro!');
                return;
              }
              setStep('metricas');
            }}
            className="tap flex w-full items-center justify-center gap-1.5 py-2 text-sm font-semibold text-primary hover:underline"
          >
            Responder 2 perguntas que ajudam o app
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </Sheet>
  );
}
