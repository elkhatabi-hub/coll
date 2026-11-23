import * as XLSX from 'xlsx';

export function parseExcelFile(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  return rawRows.map((row, index) => {
    const normalized = {};
    for (const [key, val] of Object.entries(row)) {
      const cleanKey = String(key).trim().toLowerCase().replace(/\s+/g, '_');
      normalized[cleanKey] = typeof val === 'string' ? val.trim() : val;
    }
    return {
      _rowNumber: index + 2,
      ...normalized
    };
  });
}

export function validateStudentsBatch(rows) {
  const validRows = [];
  const errors = [];
  const seenCodes = new Set();

  for (const r of rows) {
    const codeEleve = String(r.code_eleve || r.code || r.massar || '').trim();
    const nom = String(r.nom || r.nom_ar || '').trim();
    const prenom = String(r.prenom || r.prenom_ar || '').trim();
    const classeNom = String(r.classe || r.section || '').trim();

    const rowIssues = [];
    if (!codeEleve) rowIssues.push('Code élève manquant');
    if (!nom && !prenom) rowIssues.push('Nom ou prénom manquant');
    if (!classeNom) rowIssues.push('Classe manquante');
    if (codeEleve && seenCodes.has(codeEleve)) {
      rowIssues.push(`Code élève en doublon dans le fichier (${codeEleve})`);
    }
    if (codeEleve) seenCodes.add(codeEleve);

    if (rowIssues.length > 0) {
      errors.push({ ligne: r._rowNumber, code_eleve: codeEleve || '-', raisons: rowIssues });
    } else {
      validRows.push({
        code_eleve: codeEleve,
        nom,
        prenom,
        genre: String(r.genre || r.sexe || '').trim(),
        date_naissance: String(r.date_naissance || '').trim(),
        classe_nom: classeNom
      });
    }
  }

  return { validRows, errors };
}

export function validateAndMergeGuardians(rows, existingStudentCodes) {
  const matchedToMerge = [];
  const orphanGuardians = [];
  const errors = [];

  for (const r of rows) {
    const codeEleve = String(r.code_eleve || r.code || r.massar || '').trim();
    const tuteurNom = String(r.tuteur_nom || r.nom_tuteur || r.tuteur || '').trim();
    const tuteurTel = String(r.tuteur_telephone || r.telephone || r.tel || '').trim();
    const tuteurLien = String(r.tuteur_lien || r.lien || r.lien_parente || '').trim();
    const tuteurCin = String(r.tuteur_cin || r.cin || '').trim();

    if (!codeEleve) {
      errors.push({
        ligne: r._rowNumber,
        code_eleve: '-',
        raisons: ['Code élève manquant pour associer le tuteur']
      });
      continue;
    }

    if (!tuteurNom && !tuteurTel) {
      errors.push({
        ligne: r._rowNumber,
        code_eleve: codeEleve,
        raisons: ['Nom et téléphone du tuteur tous deux vides']
      });
      continue;
    }

    const record = {
      code_eleve: codeEleve,
      tuteur_nom: tuteurNom,
      tuteur_lien: tuteurLien,
      tuteur_telephone: tuteurTel,
      tuteur_cin: tuteurCin
    };

    if (existingStudentCodes.has(codeEleve)) {
      matchedToMerge.push(record);
    } else {
      orphanGuardians.push({
        ...record,
        ligne: r._rowNumber,
        alerte: 'Élève introuvable dans la liste de cette année scolaire'
      });
    }
  }

  return { matchedToMerge, orphanGuardians, errors };
}
