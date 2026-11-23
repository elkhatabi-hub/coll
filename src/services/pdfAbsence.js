import pdfMake from 'pdfmake/build/pdfmake';
import { buildCenteredPdfHeader } from './pdfHeader';

const DAY_LABELS = {
  1: 'الإثنين (Lundi)',
  2: 'الثلاثاء (Mardi)',
  3: 'الأربعاء (Mercredi)',
  4: 'الخميس (Jeudi)',
  5: 'الجمعة (Vendredi)',
  6: 'السبت (Samedi)'
};

export function resolveSelectedDays(mode, customDays = []) {
  if (mode === 'half_week_1') return [1, 2, 3];
  if (mode === 'half_week_2') return [4, 5, 6];
  if (mode === 'full_week') return [1, 2, 3, 4, 5, 6];
  return [...customDays].sort((a, b) => a - b);
}

export function buildAbsenceSheetDocDefinition({
  settings,
  schoolYearLabel,
  classInfo,
  students,
  schedules,
  selectedDays,
  periodLabel = ''
}) {
  const content = [];

  selectedDays.forEach((dayNum, dayIdx) => {
    const dayTitle = DAY_LABELS[dayNum] || `Jour ${dayNum}`;

    content.push(
      ...buildCenteredPdfHeader(
        settings,
        schoolYearLabel,
        'ورقة تتبع الغياب اليومية — FICHE D\'ABSENCE',
        `القسم / Classe: ${classInfo.nom}   |   اليوم / Jour: ${dayTitle}${periodLabel ? `   |   ${periodLabel}` : ''}`
      )
    );

    const scheduleBySession = {};
    for (const item of schedules) {
      if (Number(item.jour) === Number(dayNum)) {
        scheduleBySession[Number(item.seance)] = item;
      }
    }

    const formatSessionHeader = (sNum) => {
      const slot = scheduleBySession[sNum];
      if (!slot || (!slot.matiere && !slot.prof_nom)) {
        return {
          stack: [
            { text: `S${sNum}`, bold: true, fontSize: 8, alignment: 'center' },
            { text: '—', fontSize: 7, color: '#888888', alignment: 'center' }
          ],
          fillColor: '#F3F4F6'
        };
      }
      return {
        stack: [
          { text: `S${sNum}`, bold: true, fontSize: 8, alignment: 'center' },
          { text: slot.matiere || '', fontSize: 6.5, alignment: 'center' },
          { text: slot.prof_nom || '', fontSize: 6, color: '#374151', alignment: 'center' }
        ],
        fillColor: '#E5E7EB'
      };
    };

    const tableBody = [
      [
        { text: 'N°', bold: true, fontSize: 8, alignment: 'center', fillColor: '#DBEAFE' },
        { text: 'التلميذ(ة) / Élève', bold: true, fontSize: 8, alignment: 'center', fillColor: '#DBEAFE' },
        formatSessionHeader(1),
        formatSessionHeader(2),
        formatSessionHeader(3),
        formatSessionHeader(4),
        { text: 'N°', bold: true, fontSize: 8, alignment: 'center', fillColor: '#FEF3C7' },
        formatSessionHeader(5),
        formatSessionHeader(6),
        formatSessionHeader(7),
        formatSessionHeader(8)
      ]
    ];

    students.forEach((student, idx) => {
      const orderNum = idx + 1;
      const studentFullName = `${student.nom || ''} ${student.prenom || ''}`.trim();

      const buildCell = (sNum) => {
        const hasCourse = Boolean(
          scheduleBySession[sNum] &&
            (scheduleBySession[sNum].matiere || scheduleBySession[sNum].prof_nom)
        );
        return {
          text: '',
          fillColor: hasCourse ? null : '#F9FAFB'
        };
      };

      tableBody.push([
        { text: String(orderNum), bold: true, fontSize: 8, alignment: 'center', fillColor: '#EFF6FF' },
        { text: studentFullName, fontSize: 8, noWrap: false },
        buildCell(1),
        buildCell(2),
        buildCell(3),
        buildCell(4),
        { text: String(orderNum), bold: true, fontSize: 8, alignment: 'center', fillColor: '#FFFBEB' },
        buildCell(5),
        buildCell(6),
        buildCell(7),
        buildCell(8)
      ]);
    });

    content.push({
      table: {
        headerRows: 1,
        widths: [24, '*', 34, 34, 34, 34, 24, 34, 34, 34, 34],
        body: tableBody
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => '#9CA3AF',
        vLineColor: () => '#9CA3AF',
        paddingTop: () => 4,
        paddingBottom: () => 4,
        paddingLeft: () => 3,
        paddingRight: () => 3
      },
      pageBreak: dayIdx < selectedDays.length - 1 ? 'after' : undefined
    });
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [20, 18, 20, 18],
    content
  };
}

export function openAbsenceSheetPdf(params) {
  const docDef = buildAbsenceSheetDocDefinition(params);
  pdfMake.createPdf(docDef).open();
}
