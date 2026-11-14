import { useState } from 'react';
import { FileText, NotebookPen, CircleSlash } from 'lucide-react';
import Avatar from '../common/Avatar';
import CampoDeValor from '../common/CampoDeValor';
import NovaEscolaSheet from './NovaEscolaSheet';
import PassarParaOutroTio from '../transferencia/PassarParaOutroTio';
import { ConviteEnxuto } from './InviteShare';
import CampoDaRua from './CampoDaRua';
import { CampoQueSalva, EscolhaQueSalva, RotuloDoCampo } from './CamposDaLinha';
import { useSalvarNaLista } from '../../hooks/useSalvarNaLista';
import { camposDaEscola } from '../../services/listaDaTurmaService';
import { fraseDeEstado, resumoDaLinha, NOME_DA_FALTA, FALTA } from '../../dominio/escola/listaDaTurma.js';
import { formatCurrency } from '../../compartilhado/formatters';
import { ROTULOS } from '../../marca/textosDaLista.js';

/**
 * UMA CRIANÇA DA LISTA DA TURMA (RC2) — fechada no padrão do WhatsApp, aberta
 * NO LUGAR, como acordeão. Abrir nunca troca de tela: o que ele sabe de
 * cabeça se preenche aqui, e cada campo grava sozinho ao sair dele.
 *
 * FECHADA: o rosto, o nome, escola · hora · rua, uma frase do que falta — só
 * "falta hora de pegar" em âmbar, porque é ela que decide a rota; o resto é
 * neutro (falta de dado não é alarme) — e o convite à direita.
 *
 * ABERTA: os campos na ordem em que ele os sabe — nome, menino ou menina,
 * escola, hora de pegar, nome da mãe, rua e número, WhatsApp da mãe (se
 * souber) e mensalidade (se quiser). Sem botão "Salvar" e sem "tem certeza?".
 *
 * ⚠️ DUAS COISAS NÃO SE MEXEM DAQUI, E A FICHA CONTINUA SENDO O CAMINHO:
 *  - o RESPONSÁVEL de quem já entrou no app (a ficha também só deixa editar
 *    antes de a família entrar — depois, o número é dela);
 *  - a MENSALIDADE com contrato aceito ou emitido: mudar ali é reajuste, que
 *    vira aditivo assinado pela família. Um campo que grava ao sair seria o
 *    reajuste de um toque que o dono recusou.
 */
export default function LinhaDaTurma({
  child,
  escolas,
  aberta,
  onAlternar,
  tocou,
  onEnviado,
  onLinkNovo,
  onAbrirFicha,
  onRecado,
  onTirar,
}) {
  const sub = resumoDaLinha(child);
  const frase = fraseDeEstado(child);
  return (
    <li className={aberta ? 'bg-surface' : ''}>
      <div className="flex items-center gap-2 py-1 pl-2 pr-2">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberta}
          className="tap flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left"
        >
          <Avatar photoURL={child.photoURL} gender={child.gender} seed={child.id} kind="child" size="sm" />
          <span className="min-w-0 flex-1 leading-snug">
            <span className="block truncate text-base font-bold text-text">{child.name}</span>
            {sub && <span className="block truncate text-sm text-textMuted">{sub}</span>}
            {(frase.faltaHora || frase.texto) && (
              <span className="block truncate text-sm text-textBody">
                {frase.faltaHora && (
                  <span className="font-semibold text-warningText">
                    <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full bg-warning align-middle" />
                    falta {NOME_DA_FALTA[FALTA.HORA]}
                  </span>
                )}
                {frase.faltaHora && frase.texto ? ' · ' : ''}
                {frase.texto}
              </span>
            )}
          </span>
        </button>
        <ConviteEnxuto crianca={child} tocou={tocou} onEnviado={onEnviado} onLinkNovo={onLinkNovo} />
      </div>
      {aberta && (
        <CorpoDaLinha
          child={child}
          escolas={escolas}
          onAbrirFicha={onAbrirFicha}
          onRecado={onRecado}
          onTirar={onTirar}
        />
      )}
    </li>
  );
}

function CorpoDaLinha({ child, escolas, onAbrirFicha, onRecado, onTirar }) {
  const { estado, salvar, tentarDeNovo } = useSalvarNaLista(child);
  const [novaEscola, setNovaEscola] = useState(false);
  const comFamilia = !!child.parentUid;
  const contratoFeito = !!(child.contratoVigente || child.contractAcceptedAt || child.contratoAguardando);
  const campo = (nome) => ({ estado: estado[nome], onTentar: () => tentarDeNovo(nome) });

  return (
    <div className="space-y-4 px-3 pb-4 pt-1">
      <CampoQueSalva
        key={`nome:${child.name}`}
        rotulo={ROTULOS.nome}
        valorSalvo={child.name}
        onSalvar={(v) => salvar('nome', { name: v })}
        {...campo('nome')}
      />

      <EscolhaQueSalva
        rotulo={ROTULOS.meninoOuMenina}
        opcoes={[
          { value: 'male', label: ROTULOS.menino },
          { value: 'female', label: ROTULOS.menina },
        ]}
        valor={child.gender}
        onSalvar={(v) => salvar('genero', { gender: v })}
        {...campo('genero')}
      />

      <div>
        <RotuloDoCampo rotulo={ROTULOS.escola} {...campo('escola')} />
        <div className="flex flex-wrap gap-2">
          {escolas.map((e) => {
            const marcada = child.schoolId === e.id;
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={marcada}
                onClick={() => !marcada && salvar('escola', camposDaEscola(e))}
                className={`tap min-h-12 rounded-full border-2 px-4 text-base font-semibold ${
                  marcada ? 'border-primary bg-primarySoft text-text' : 'border-border bg-card text-textMuted'
                }`}
              >
                {e.nome}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setNovaEscola(true)}
            className="tap min-h-12 rounded-full border-2 border-dashed border-borderStrong bg-card px-4 text-base font-semibold text-primary"
          >
            {ROTULOS.novaEscola}
          </button>
        </div>
        {!child.schoolId && child.school && (
          <p className="mt-1 text-sm text-textMuted">{child.school}</p>
        )}
      </div>

      <CampoQueSalva
        key={`hora:${child.horaPega || ''}`}
        rotulo={ROTULOS.horaDePegar}
        tipo="hora"
        valorSalvo={child.horaPega || ''}
        onSalvar={(v) => salvar('hora', { horaPega: v })}
        {...campo('hora')}
      />

      {comFamilia ? (
        <p className="text-base text-textBody">{child.parentName || ''}</p>
      ) : (
        <CampoQueSalva
          key={`mae:${child.parentName || ''}`}
          rotulo={ROTULOS.nomeDaMae}
          tipo="textoOpcional"
          valorSalvo={child.parentName || ''}
          onSalvar={(v) => salvar('mae', { parentName: v })}
          {...campo('mae')}
        />
      )}

      <CampoDaRua crianca={child} salvar={salvar} {...campo('rua')} />

      {!comFamilia && (
        <CampoQueSalva
          key={`fone:${child.parentPhone || ''}`}
          rotulo={ROTULOS.whatsappDaMae}
          extra={ROTULOS.seSouber}
          tipo="telefone"
          valorSalvo={child.parentPhone || ''}
          onSalvar={(v) => salvar('fone', { parentPhone: v })}
          {...campo('fone')}
        />
      )}

      {contratoFeito ? (
        <div>
          <RotuloDoCampo rotulo={ROTULOS.mensalidade} />
          <p className="text-base text-textBody">
            {Number(child.monthlyFee) > 0 ? formatCurrency(child.monthlyFee) : '—'} · <button type="button" onClick={onAbrirFicha} className="tap min-h-11 font-semibold text-primary underline">{ROTULOS.abrirFicha}</button>
          </p>
        </div>
      ) : (
        <CampoDaMensalidade key={`fee:${child.monthlyFee || 0}`} child={child} salvar={salvar} {...campo('mensalidade')} />
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <AcaoDaLinha icone={FileText} onClick={onAbrirFicha}>{ROTULOS.abrirFicha}</AcaoDaLinha>
        <AcaoDaLinha icone={NotebookPen} onClick={onRecado}>{ROTULOS.mandarRecado}</AcaoDaLinha>
        <AcaoDaLinha icone={CircleSlash} perigo onClick={onTirar}>{ROTULOS.tirarDaTurma}</AcaoDaLinha>
      </div>
      {/* Só aparece quando a passagem é possível — a peça decide. */}
      <PassarParaOutroTio child={child} />

      <NovaEscolaSheet
        open={novaEscola}
        onClose={() => setNovaEscola(false)}
        onCriada={(e) => {
          setNovaEscola(false);
          salvar('escola', camposDaEscola({ ...e, telefone: e.telefone || '' }));
        }}
      />
    </div>
  );
}

/** A mensalidade grava ao sair do campo; o extenso embaixo é a conferência. */
function CampoDaMensalidade({ child, salvar, estado, onTentar }) {
  const inicial = Number(child.monthlyFee) > 0 ? Number(child.monthlyFee).toFixed(2) : '';
  const [valor, setValor] = useState(inicial);
  const sair = () => {
    const n = Number(valor);
    if (!(n > 0) || valor === inicial) return;
    salvar('mensalidade', { monthlyFee: n });
  };
  return (
    <div onBlur={sair}>
      <RotuloDoCampo rotulo={ROTULOS.mensalidade} extra={ROTULOS.seQuiser} estado={estado} onTentar={onTentar} />
      <CampoDeValor value={valor} onChange={setValor} />
    </div>
  );
}

function AcaoDaLinha({ icone: Icone, perigo = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 px-3 text-base font-semibold ${
        perigo ? 'border-dangerBorder bg-card text-dangerText' : 'border-border bg-card text-text'
      }`}
    >
      <Icone size={18} aria-hidden="true" />
      {children}
    </button>
  );
}
