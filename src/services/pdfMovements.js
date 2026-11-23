import pdfMake from 'pdfmake/build/pdfmake';
import { buildCenteredPdfHeader } from './pdfHeader';

export const MOVEMENT_CATEGORIES = {
  arrive: {
    key: 'arrive',
    labelAr: 'الوافدون',
    labelFr: 'Arrivants',
    docTitle: 'وثيقة / طلب تتبع تلميذ وافد',
    originDestLabel: 'المؤسسة الأصلية / Provenance',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  parti: {
    key: 'parti',
    labelAr: 'المغادرون',
    labelFr: 'Partants',
    docTitle: 'طلب / وثيقة تتبع تلميذ مغادر',
    originDestLabel: 'المؤسسة المستقبلة / Destination',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  abandon: {
    key: 'abandon',
    labelAr: 'المنقطعون',
    labelFr: 'Décrocheurs',
    docTitle: 'إشعار / طلب تتبع انقطاع عن الدراسة',
    originDestLabel: 'ملاحظة / جهة التوجيه',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200'
  },
  non_rejoint: {
    key: 'non_rejoint',
    labelAr: 'غير الملتحقين',
    labelFr: 'Non rejoints',
    docTitle: 'إشعار / طلب تتبع تلميذ غير ملتحق',
    originDestLabel: 'ملاحظة / إسناد سابق',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200'
  }
};

const SIGNATORY_TITLES = {
  surveillant_general: 'توقيع الحارس العام / Surveillant Général',
  directeur: 'توقيع المدير(ة) / Directeur(trice)',
  les_deux: 'الحارس العام والمدير(ة)'
};

function buildMovementSignatures(signataire = 'directeur') {
  if (signataire === 'les_deux') {
    return {
      columns: [
        {
          stack: [
            { text: 'توقيع الحارس العام', bold: true, alignment: 'center', fontSize: 9.5 },
            { text: '\n\n______________________', alignment: 'center', fontSize: 9, color: '#555555' }
          ]
        },
        {
          stack: [
            { text: 'توقيع المدير(ة)', bold: true, alignment: 'center', fontSize: 9.5 },
            { text: '\n\n______________________', alignment: 'center', fontSize: 9, color: '#555555' }
          ]
        }
      ],
      margin: [0, 22, 0, 0]
    };
  }

  return {
    stack: [
      {
        text: SIGNATORY_TITLES[signataire] || SIGNATORY_TITLES.directeur,
        bold: true,
        alignment: 'right',
        fontSize: 9.5
      },
      { text: '\n\n______________________', alignment: 'right', fontSize: 9, color: '#555555' }
    ],
    margin: [0, 22, 0, 0]
  };
}

function buildSingleStudentRequestPage(item, meta, isLastPage) {
  const { settings, schoolYearLabel, categoryConfig, customRequestText, signataire } = meta;

  const textBody = (customRequestText || '')
    .replace(/\{\{\s*nom_complet\s*\}\}/g, item.nom_complet || '—')
    .replace(/\{\{\s*code_eleve\s*\}\}/g, item.code_eleve || '—')
    .replace(/\{\{\s*classe\s*\}\}/g, item.classe_nom || '—')
    .replace(/\{\{\s*date_mouvement\s*\}\}/g, item.date_mouvement || '—')
    .replace(/\{\{\s*etablissement_origine_dest\s*\}\}/g, item.etablissement_origine_dest || '—')
    .replace(/\{\{\s*motif\s*\}\}/g, item.motif || '—')
    .replace(/\{\{\s*tuteur_nom\s*\}\}/g, item.tuteur_nom || '—')
    .replace(/\{\{\s*tuteur_telephone\s*\}\}/g, item.tuteur_telephone || '—')
    .replace(/\{\{\s*annee_scolaire\s*\}\}/g, schoolYearLabel || '—');

  return {
    stack: [
      ...buildCenteredPdfHeader(
        settings,
        schoolYearLabel,
        `${categoryConfig.docTitle} — ${categoryConfig.labelAr}`,
        `الفئة: ${categoryConfig.labelAr} (${categoryConfig.labelFr})   |   التاريخ: ${item.date_mouvement || '—'}`
      ),
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            [
              { text: 'الرمز / ID', bold: true, fontSize: 8.5, fillColor: '#F3F4F6' },
              { text: item.code_eleve || '—', fontSize: 8.5 },
              { text: 'القسم / Classe', bold: true, fontSize: 8.5, fillColor: '#F3F4F6' },
              { text: item.classe_nom || '—', fontSize: 8.5 }
            ],
            [
              { text: 'الاسم الكامل', bold: true, fontSize: 8.5, fillColor: '#F3F4F6' },
              { text: item.nom_complet || '—', fontSize: 8.5 },
              { text: 'تاريخ الحركة', bold: true, fontSize: 8.5, fillColor: '#F3F4F6' },
              { text: item.date_mouvement || '—', fontSize: 8.5 }
            ],
            [
              { text: 'ولي الأمر', bold: true, fontSize: 8.5, fillColor: '#F3F4F6' },
              { text: item.tuteur_nom || '—', fontSize: 8.5 },
              { text: 'هاتف ولي الأمر', bold: true, fontSize: 8.5, fillColor: '#F3F4F6' },
              { text: item.tuteur_telephone || '—', fontSize: 8.5 }
            ],
            [
              { text: categoryConfig.originDestLabel, bold: true, fontSize: 8.5, fillColor: '#F3F4F6' },
              { text: item.etablissement_origine_dest || '—', fontSize: 8.5 },
              { text: 'السبب / Motif', bold: true, fontSize: 8.5, fillColor: '#F3F4F6' },
              { text: item.motif || '—', fontSize: 8.5 }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#D1D5DB',
          vLineColor: () => '#D1D5DB',
          paddingTop: () => 4,
          paddingBottom: () => 4
        },
        margin: [0, 0, 0, 14]
      },
      {
        text: textBody,
        fontSize: 10.5,
        lineHeight: 1.5,
        margin: [0, 4, 0, 12]
      },
      buildMovementSignatures(signataire)
    ],
    pageBreak: !isLastPage ? 'after' : undefined
  };
}

function buildGroupSummaryPage(items, meta) {
  const { settings, schoolYearLabel, categoryConfig, signataire } = meta;

  const body = [
    [
      { text: 'N°', bold: true, fontSize: 8, fillColor: '#E5E7EB', alignment: 'center' },
      { text: 'ID / الرمز', bold: true, fontSize: 8, fillColor: '#E5E7EB', alignment: 'center' },
      { text: 'الاسم الكامل', bold: true, fontSize: 8, fillColor: '#E5E7EB' },
      { text: 'القسم', bold: true, fontSize: 8, fillColor: '#E5E7EB', alignment: 'center' },
      { text: 'التاريخ', bold: true, fontSize: 8, fillColor: '#E5E7EB', alignment: 'center' },
      { text: 'السبب / ملاحظة', bold: true, fontSize: 8, fillColor: '#E5E7EB' }
    ]
  ];

  items.forEach((item, idx) => {
    body.push([
      { text: String(idx + 1), fontSize: 8, alignment: 'center' },
      { text: item.code_eleve || '—', fontSize: 8, alignment: 'center' },
      { text: item.nom_complet || '—', fontSize: 8 },
      { text: item.classe_nom || '—', fontSize: 8, alignment: 'center' },
      { text: item.date_mouvement || '—', fontSize: 8, alignment: 'center' },
      { text: item.motif || item.etablissement_origine_dest || '—', fontSize: 8 }
    ]);
  });

  return [
    ...buildCenteredPdfHeader(
      settings,
      schoolYearLabel,
      `لائحة جماعية — ${categoryConfig.labelAr} (${categoryConfig.labelFr})`,
      `عدد التلاميذ المحددين: ${items.length}`
    ),
    {
      table: {
        headerRows: 1,
        widths: [26, 70, '*', 75, 75, 125],
        body
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#CBD5E1',
        vLineColor: () => '#CBD5E1',
        paddingTop: () => 3,
        paddingBottom: () => 3
      }
    },
    buildMovementSignatures(signataire)
  ];
}

export function openMovementRequestsPdf({
  items = [],
  mode = 'individual_pages',
  settings = {},
  schoolYearLabel = '',
  categoryKey = 'arrive',
  customRequestText = '',
  signataire = 'directeur'
}) {
  if (!items.length) return;
  const categoryConfig = MOVEMENT_CATEGORIES[categoryKey] || MOVEMENT_CATEGORIES.arrive;
  const meta = {
    settings,
    schoolYearLabel,
    categoryConfig,
    customRequestText,
    signataire
  };

  const content =
    mode === 'group_table'
      ? buildGroupSummaryPage(items, meta)
      : items.map((item, index) =>
          buildSingleStudentRequestPage(item, meta, index === items.length - 1)
        );

  pdfMake
    .createPdf({
      pageSize: 'A4',
      pageMargins: [24, 20, 24, 20],
      content
    })
    .open();
}
