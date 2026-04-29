import LegalDocument from './LegalDocument';
import {
  TERMS_SECTIONS,
  LEGAL_VERSION,
  LEGAL_DATE,
  COMPANY_INFO,
} from './legalContent';

export default function Terms() {
  return (
    <LegalDocument
      title="Termos de Uso"
      version={LEGAL_VERSION}
      date={LEGAL_DATE}
      sections={TERMS_SECTIONS}
      headerExtra={
        <p className="text-sm text-textMuted leading-relaxed">
          Estes Termos regem o uso do aplicativo {COMPANY_INFO.name}. Leia com
          atenção antes de aceitar.
        </p>
      }
    />
  );
}
