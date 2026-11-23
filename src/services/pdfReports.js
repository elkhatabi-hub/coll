import pdfMake from 'pdfmake/build/pdfmake';
import { buildCenteredPdfHeader } from './pdfHeader';

const SIGNATORY_LABELS = {
  surveillant_general: 'الحارس العام / Surveillant Général',
  directeur: 'المدير(ة) / Directeur(trice)',
  les_deux: 'الحارس العام والمدير(ة)'
};

export function compileTemplateText(templateText = '', variables = {}) {
  return templateText.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const val = variables[key];
    return val !== undefined && val !== null && String(val).trim() !== ''
      ? String(val)
      : '—';
  });
}

function buildSignaturesBlock(signataireChoice = 'surveillant_general', includeRecipientSignature = false) {
  const blocks = [];

  if (signataireChoice === 'les_deux') {
    blocks.push({
      columns: [
        {
          stack: [
            { text: 'توقيع الحارس العام', bold: true, alignment: 'center', fontSize: 10 },
            { text: '\n\n______________________', alignment: 'center', fontSize: 9, color: '#555555' }
          ]
        },
        {
          stack: [
            { text: 'توقيع المدير(ة)', bold: true, alignment: 'center', fontSize: 10 },
            { text: '\n\n______________________', alignment: 'center', fontSize: 9, color: '#555555' }
          ]
        }
      ],
      margin: [0, 24, 0, 10]
    });
  } else {
    const label = SIGNATORY_LABELS[signataireChoice] || SIGNATORY_LABELS.surveillant_general;
    blocks.push({
      stack: [
        { text: `توقيع: ${label}`, bold: true, alignment: 'right', fontSize: 10 },
        { text: '\n\n______________________', alignment: 'right', fontSize: 9, color: '#555555' }
      ],
      margin: [0, 24, 0, 10]
    });
  }

  if (includeRecipientSignature) {
    blocks.push({
      text: 'توقيع المعني بالأمر / ولي الأمر: ______________________',
      alignment: 'left',
      fontSize: 9.5,
      color: '#374151',
      margin: [0, 12, 0, 0]
    });
  }

  return blocks;
}

export function buildCustomReportDocDefinition({
  settings,
  schoolYearLabel,
  reportTitle,
  reportSubject,
  reportDate,
  targetType,
  targetData,
  bodyTemplate,
  extraNotes = '',
  signataire = 'surveillant_general',
  includeRecipientSignature = false
}) {
  const vars = {
    annee_scolaire: schoolYearLabel || '',
    date_rapport: reportDate || '',
    sujet_rapport: reportSubject || '',
    details_personnalises: extraNotes || '',
    nom_complet: targetData?.nom_complet || '',
    code_eleve: targetData?.code_eleve || targetData?.id || '',
    classe: targetData?.classe || '',
    matricule: targetData?.matricule || '',
    tuteur_nom: targetData?.tuteur_nom || '',
    tuteur_telephone: targetData?.tuteur_telephone || ''
  };

  const compiledBody = compileTemplateText(bodyTemplate, vars);

  let identitySummary = `التاريخ: ${reportDate}`;
  if (targetType === 'eleve' || targetType === 'tuteur') {
    const idLabel = vars.code_eleve || '—';
    identitySummary = `التلميذ(ة): ${vars.nom_complet}   |   ID / الرمز: ${idLabel}   |   القسم: ${vars.classe || '—'}   |   التاريخ: ${reportDate}`;
    if (targetType === 'tuteur') {
      identitySummary += `\nولي الأمر: ${vars.tuteur_nom || vars.nom_complet}   |   الهاتف: ${vars.tuteur_telephone || '—'}`;
    }
  } else if (targetType === 'professeur') {
    identitySummary = `الأستاذ(ة): ${vars.nom_complet}   |   رقم التأجير: ${vars.matricule || '—'}   |   التاريخ: ${reportDate}`;
  }

  const content = [
    ...buildCenteredPdfHeader(
      settings,
      schoolYearLabel,
      reportTitle || 'تقرير إداري / تربوي',
      reportSubject ? `الموضوع: ${reportSubject}` : ''
    ),
    {
      text: identitySummary,
      fontSize: 9.5,
      bold: true,
      fillColor: '#F3F4F6',
      margin: [0, 0, 0, 12]
    },
    {
      text: compiledBody,
      fontSize: 11,
      lineHeight: 1.5,
      margin: [0, 4, 0, 12]
    },
    ...buildSignaturesBlock(signataire, includeRecipientSignature)
  ];

  return {
    pageSize: 'A4',
    pageMargins: [32, 24, 32, 24],
    content
  };
}

export function openCustomReportPdf(params) {
  const docDef = buildCustomReportDocDefinition(params);
  pdfMake.createPdf(docDef).open();
}
