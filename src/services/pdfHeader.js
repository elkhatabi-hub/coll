const fs = require('fs');

export function buildCenteredPdfHeader(settings = {}, schoolYearLabel = '', docTitle = '', docSubtitle = '') {
  const headerStack = [];

  if (settings.logo_path && fs.existsSync(settings.logo_path)) {
    const base64Img = fs.readFileSync(settings.logo_path).toString('base64');
    const ext = settings.logo_path.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
    headerStack.push({
      image: `data:image/${ext};base64,${base64Img}`,
      width: 56,
      alignment: 'center',
      margin: [0, 0, 0, 4]
    });
  }

  if (settings.ministere) {
    headerStack.push({
      text: settings.ministere,
      alignment: 'center',
      fontSize: 9,
      bold: true,
      margin: [0, 0, 0, 1]
    });
  }

  const areaLine = [
    settings.academie ? `الأكاديمية: ${settings.academie}` : '',
    settings.direction_provinciale ? `المديرية: ${settings.direction_provinciale}` : ''
  ]
    .filter(Boolean)
    .join('  —  ');

  if (areaLine) {
    headerStack.push({
      text: areaLine,
      alignment: 'center',
      fontSize: 8.5,
      margin: [0, 0, 0, 1]
    });
  }

  if (settings.nom_etablissement) {
    headerStack.push({
      text: `المؤسسة: ${settings.nom_etablissement}`,
      alignment: 'center',
      fontSize: 10.5,
      bold: true,
      margin: [0, 1, 0, 2]
    });
  }

  const metaLine = [
    schoolYearLabel ? `الموسم الدراسي: ${schoolYearLabel}` : '',
    settings.telephone ? `الهاتف: ${settings.telephone}` : ''
  ]
    .filter(Boolean)
    .join('  |  ');

  if (metaLine) {
    headerStack.push({
      text: metaLine,
      alignment: 'center',
      fontSize: 8,
      color: '#444444',
      margin: [0, 0, 0, 6]
    });
  }

  headerStack.push({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 1, lineColor: '#333333' }],
    margin: [0, 0, 0, 6]
  });

  if (docTitle) {
    headerStack.push({
      text: docTitle,
      alignment: 'center',
      fontSize: 12,
      bold: true,
      margin: [0, 0, 0, 2]
    });
  }

  if (docSubtitle) {
    headerStack.push({
      text: docSubtitle,
      alignment: 'center',
      fontSize: 9,
      color: '#222222',
      margin: [0, 0, 0, 8]
    });
  }

  return headerStack;
}
