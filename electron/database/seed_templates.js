function seedTemplates(db) {
  const templates = [
    {
      code_modele: 'COMPORTEMENT_ELEVE',
      categorie: 'rapport',
      titre: 'تقرير سلوك تلميذ',
      cible: 'eleve',
      langue: 'ar',
      signataire_defaut: 'surveillant_general',
      corps_modele:
        'يشهد الموقع أسفله بأن التلميذ(ة) {{nom_complet}} (الرمز: {{code_eleve}}) المتابع دراسته بالقسم {{classe}} برسم الموسم الدراسي {{annee_scolaire}}، قد سجل بشأنه الوقائع التالية بتاريخ {{date_rapport}}:\n\n{{details_personnalises}}\n\nحرر هذا التقرير لاتخاذ الإجراءات التربوية والإدارية المناسبة.'
    },
    {
      code_modele: 'ENGAGEMENT_ASSIDUITE',
      categorie: 'rapport',
      titre: 'التزام بالمواظبة',
      cible: 'eleve',
      langue: 'ar',
      signataire_defaut: 'surveillant_general',
      corps_modele:
        'أنا الموقع(ة) أسفله: {{nom_complet}} (الرمز: {{code_eleve}}) بالقسم {{classe}}، ألتزم التزاما تاما وصارما بالمواظبة على حضور جميع الحصص الدراسية واحترام التوقيت الرسمي للمؤسسة خلال الموسم الدراسي {{annee_scolaire}}، وأتحمل كامل المسؤولية في حالة الإخلال بهذا الالتزام ابتداء من تاريخ {{date_rapport}}.\n\n{{details_personnalises}}'
    },
    {
      code_modele: 'ENGAGEMENT_CONDUITE',
      categorie: 'rapport',
      titre: 'التزام بحسن السلوك',
      cible: 'eleve',
      langue: 'ar',
      signataire_defaut: 'directeur',
      corps_modele:
        'أنا التلميذ(ة) {{nom_complet}} (الرمز: {{code_eleve}}) بالقسم {{classe}}، أتعهد باحترام القانون الداخلي للمؤسسة وحسن السلوك مع الأطر الإدارية والتربوية وزملائي التلاميذ خلال الموسم الدراسي {{annee_scolaire}}، وذلك ابتداء من {{date_rapport}}.\n\n{{details_personnalises}}'
    },
    {
      code_modele: 'RAPPORT_PROFESSEUR',
      categorie: 'rapport',
      titre: 'تقرير أستاذ',
      cible: 'professeur',
      langue: 'ar',
      signataire_defaut: 'directeur',
      corps_modele:
        'تقرير صادر عن الأستاذ(ة): {{nom_complet}} (رقم التأجير: {{matricule}}) بتاريخ {{date_rapport}}، برسم الموسم الدراسي {{annee_scolaire}}.\n\nموضوع التقرير وملاحظاته:\n{{details_personnalises}}'
    },
    {
      code_modele: 'VISITE_SANTE',
      categorie: 'rapport',
      titre: 'زيارة المصالح الصحية',
      cible: 'eleve',
      langue: 'ar',
      signataire_defaut: 'les_deux',
      corps_modele:
        'بتاريخ {{date_rapport}}، تم توجيه التلميذ(ة) {{nom_complet}} (الرمز: {{code_eleve}})، القسم {{classe}}، إلى المصالح الصحية / التتبع الصحي، وذلك للأسباب التالية:\n\n{{details_personnalises}}\n\nولي الأمر: {{tuteur_nom}} | الهاتف: {{tuteur_telephone}}'
    },
    {
      code_modele: 'CONVOCATION_TUTEUR',
      categorie: 'rapport',
      titre: 'استدعاء ولي الأمر',
      cible: 'tuteur',
      langue: 'ar',
      signataire_defaut: 'directeur',
      corps_modele:
        'تحية طيبة وبعد،\n\nيشرفنا إخباركم بصفتكم ولي أمر التلميذ(ة): {{nom_complet}} (الرمز / ID: {{code_eleve}}) المتابع دراسته بالقسم {{classe}} برسم الموسم الدراسي {{annee_scolaire}}، بضرورة الحضور إلى إدارة المؤسسة بتاريخ {{date_rapport}} وذلك بخصوص:\n\nالموضوع: {{sujet_rapport}}\n\n{{details_personnalises}}\n\nنرجو منكم الحرص على الحضور في الموعد المحدد، وشكرا على تعاونكم.'
    }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO modeles_rapports
      (code_modele, categorie, titre, cible, langue, corps_modele, signataire_defaut)
    VALUES
      (@code_modele, @categorie, @titre, @cible, @langue, @corps_modele, @signataire_defaut)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) stmt.run(item);
  });
  insertMany(templates);
}

module.exports = seedTemplates;
