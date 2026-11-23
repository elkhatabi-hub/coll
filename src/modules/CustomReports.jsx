import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Sliders, Printer, User, Briefcase } from 'lucide-react';
import { openCustomReportPdf } from '../services/pdfReports';

const FALLBACK_TEMPLATES = [
  {
    code_modele: 'COMPORTEMENT_ELEVE',
    titre: 'تقرير سلوك تلميذ',
    cible: 'eleve',
    signataire_defaut: 'surveillant_general',
    corps_modele:
      'يشهد الموقع أسفله بأن التلميذ(ة) {{nom_complet}} (الرمز / ID: {{code_eleve}}) المتابع دراسته بالقسم {{classe}} برسم الموسم الدراسي {{annee_scolaire}}، قد سجل بشأنه الوقائع التالية بتاريخ {{date_rapport}}:\n\n{{details_personnalises}}'
  },
  {
    code_modele: 'ENGAGEMENT_ASSIDUITE',
    titre: 'التزام بالمواظبة',
    cible: 'eleve',
    signataire_defaut: 'surveillant_general',
    corps_modele:
      'أنا التلميذ(ة) {{nom_complet}} (الرمز / ID: {{code_eleve}}) بالقسم {{classe}}، ألتزم بالمواظبة على حضور جميع الحصص واحترام التوقيت خلال الموسم الدراسي {{annee_scolaire}} ابتداء من {{date_rapport}}.\n\n{{details_personnalises}}'
  },
  {
    code_modele: 'ENGAGEMENT_CONDUITE',
    titre: 'التزام بحسن السلوك',
    cible: 'eleve',
    signataire_defaut: 'directeur',
    corps_modele:
      'أنا التلميذ(ة) {{nom_complet}} (الرمز / ID: {{code_eleve}}) بالقسم {{classe}}، أتعهد باحترام القانون الداخلي وحسن السلوك خلال الموسم الدراسي {{annee_scolaire}} ابتداء من {{date_rapport}}.\n\n{{details_personnalises}}'
  },
  {
    code_modele: 'RAPPORT_PROFESSEUR',
    titre: 'تقرير أستاذ',
    cible: 'professeur',
    signataire_defaut: 'directeur',
    corps_modele:
      'تقرير الأستاذ(ة): {{nom_complet}} (رقم التأجير: {{matricule}}) بتاريخ {{date_rapport}}، الموسم الدراسي {{annee_scolaire}}.\n\n{{details_personnalises}}'
  },
  {
    code_modele: 'VISITE_SANTE',
    titre: 'زيارة المصالح الصحية',
    cible: 'eleve',
    signataire_defaut: 'les_deux',
    corps_modele:
      'بتاريخ {{date_rapport}}، تم توجيه التلميذ(ة) {{nom_complet}} (الرمز / ID: {{code_eleve}}) بالقسم {{classe}} إلى المصالح الصحية.\n\nولي الأمر: {{tuteur_nom}} | الهاتف: {{tuteur_telephone}}\n\n{{details_personnalises}}'
  },
  {
    code_modele: 'CONVOCATION_TUTEUR',
    titre: 'استدعاء ولي الأمر',
    cible: 'tuteur',
    signataire_defaut: 'directeur',
    corps_modele:
      'تحية طيبة، ندعوكم بصفتكم ولي أمر التلميذ(ة): {{nom_complet}} (الرمز / ID: {{code_eleve}}) بالقسم {{classe}} للحضور إلى المؤسسة بتاريخ {{date_rapport}} بخصوص: {{sujet_rapport}}.\n\n{{details_personnalises}}'
  }
];

export default function CustomReports({
  settings,
  schoolYear,
  templates = FALLBACK_TEMPLATES,
  classes = [],
  students = [],
  teachers = []
}) {
  const listTemplates = templates && templates.length > 0 ? templates : FALLBACK_TEMPLATES;

  const [selectedCode, setSelectedCode] = useState(listTemplates[0].code_modele);
  const [fullCustomMode, setFullCustomMode] = useState(false);

  const [reportTitle, setReportTitle] = useState(listTemplates[0].titre);
  const [reportSubject, setReportSubject] = useState('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [targetType, setTargetType] = useState(listTemplates[0].cible || 'eleve');

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  const [customPersonName, setCustomPersonName] = useState('');
  const [customPersonId, setCustomPersonId] = useState('');
  const [customClassName, setCustomClassName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  const [bodyTemplate, setBodyTemplate] = useState(listTemplates[0].corps_modele);
  const [extraNotes, setExtraNotes] = useState('');
  const [signataire, setSignataire] = useState(listTemplates[0].signataire_defaut || 'surveillant_general');
  const [includeRecipientSignature, setIncludeRecipientSignature] = useState(false);

  const handleSelectTemplate = (code) => {
    setSelectedCode(code);
    const tpl = listTemplates.find((t) => t.code_modele === code);
    if (tpl) {
      setReportTitle(tpl.titre);
      setTargetType(tpl.cible || 'eleve');
      setBodyTemplate(tpl.corps_modele);
      setSignataire(tpl.signataire_defaut || 'surveillant_general');
      setIncludeRecipientSignature(code.startsWith('ENGAGEMENT') || code === 'CONVOCATION_TUTEUR');
    }
  };

  const filteredStudents = useMemo(() => {
    if (!selectedClassId) return students;
    return students.filter((s) => String(s.classe_id) === String(selectedClassId));
  }, [students, selectedClassId]);

  const activeStudent = useMemo(
    () => students.find((s) => String(s.id) === String(selectedStudentId)) || null,
    [students, selectedStudentId]
  );

  const activeTeacher = useMemo(
    () => teachers.find((t) => String(t.id) === String(selectedTeacherId)) || null,
    [teachers, selectedTeacherId]
  );

  useEffect(() => {
    if (activeStudent) {
      const fullName = `${activeStudent.nom || ''} ${activeStudent.prenom || ''}`.trim();
      const cls = classes.find((c) => String(c.id) === String(activeStudent.classe_id));
      setCustomPersonName(fullName);
      setCustomPersonId(activeStudent.code_eleve || String(activeStudent.id));
      setCustomClassName(cls?.nom || activeStudent.classe_nom || '');
      setGuardianName(activeStudent.tuteur_nom || '');
      setGuardianPhone(activeStudent.tuteur_telephone || '');
    }
  }, [activeStudent, classes]);

  useEffect(() => {
    if (activeTeacher && targetType === 'professeur') {
      const fullName = `${activeTeacher.nom || ''} ${activeTeacher.prenom || ''}`.trim();
      setCustomPersonName(fullName);
      setCustomPersonId(activeTeacher.matricule || '');
    }
  }, [activeTeacher, targetType]);

  const handleGeneratePdf = () => {
    const targetData =
      targetType === 'professeur'
        ? {
            id: activeTeacher?.id || '',
            matricule: customPersonId || activeTeacher?.matricule || '',
            nom_complet: customPersonName
          }
        : {
            id: activeStudent?.id || '',
            code_eleve: customPersonId || activeStudent?.code_eleve || '',
            nom_complet: customPersonName,
            classe: customClassName,
            tuteur_nom: guardianName,
            tuteur_telephone: guardianPhone
          };

    openCustomReportPdf({
      settings,
      schoolYearLabel: schoolYear?.libelle || '',
      reportTitle,
      reportSubject,
      reportDate,
      targetType,
      targetData,
      bodyTemplate,
      extraNotes,
      signataire,
      includeRecipientSignature
    });
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              التقارير والوثائق المخصصة (PDF) — Rapports & Documents
            </h1>
            <p className="text-xs text-gray-500">
              الموسم الدراسي: {schoolYear?.libelle || '—'} • اختيار النموذج، تخصيص المحتوى وتحديد التوقيع
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFullCustomMode((prev) => !prev)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${
            fullCustomMode
              ? 'bg-amber-100 border-amber-400 text-amber-900'
              : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          {fullCustomMode ? 'وضع التخصيص الكامل: مفعل' : 'تخصيص كامل (Titre / Sujet / Cible)'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4 bg-white p-5 rounded-xl shadow-sm border">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              نوع التقرير / الوثيقة (Liste déroulante)
            </label>
            <select
              value={selectedCode}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {listTemplates.map((tpl) => (
                <option key={tpl.code_modele} value={tpl.code_modele}>
                  {tpl.titre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">التاريخ / Date</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">المعني / Cible</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="eleve">تلميذ (Élève + ID + Classe)</option>
                <option value="tuteur">ولي الأمر (Tuteur)</option>
                <option value="professeur">أستاذ (Professeur)</option>
              </select>
            </div>
          </div>

          {targetType !== 'professeur' ? (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                <User className="w-4 h-4" /> بيانات التلميذ والقسم
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">القسم / Classe</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setSelectedStudentId('');
                    }}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white"
                  >
                    <option value="">-- كل الأقسام --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">التلميذ(ة)</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white"
                  >
                    <option value="">-- اختر تلميذا --</option>
                    {filteredStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nom} {s.prenom} ({s.code_eleve})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">ID / الرمز</label>
                  <input
                    type="text"
                    value={customPersonId}
                    onChange={(e) => setCustomPersonId(e.target.value)}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">القسم</label>
                  <input
                    type="text"
                    value={customClassName}
                    onChange={(e) => setCustomClassName(e.target.value)}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    value={customPersonName}
                    onChange={(e) => setCustomPersonName(e.target.value)}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-sm"
                  />
                </div>
              </div>

              {(targetType === 'tuteur' ||
                fullCustomMode ||
                selectedCode === 'CONVOCATION_TUTEUR' ||
                selectedCode === 'VISITE_SANTE') && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">اسم ولي الأمر</label>
                    <input
                      type="text"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">هاتف ولي الأمر</label>
                    <input
                      type="text"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      className="w-full border rounded-lg px-2.5 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                <Briefcase className="w-4 h-4" /> بيانات الأستاذ(ة)
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">الأستاذ(ة)</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white"
                >
                  <option value="">-- اختر أستاذا --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nom} {t.prenom} ({t.matricule})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    value={customPersonName}
                    onChange={(e) => setCustomPersonName(e.target.value)}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">رقم التأجير / ID</label>
                  <input
                    type="text"
                    value={customPersonId}
                    onChange={(e) => setCustomPersonId(e.target.value)}
                    className="w-full border rounded-lg px-2.5 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <label className="block text-xs font-bold text-gray-700">
              التوقيع في أسفل التقرير / Signature
            </label>
            <select
              value={signataire}
              onChange={(e) => setSignataire(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="surveillant_general">الحارس العام (Surveillant Général)</option>
              <option value="directeur">المدير(ة) (Directeur)</option>
              <option value="les_deux">الحارس العام والمدير(ة) معا</option>
            </select>

            <label className="flex items-center gap-2 text-xs text-gray-600 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRecipientSignature}
                onChange={(e) => setIncludeRecipientSignature(e.target.checked)}
              />
              إضافة خانة توقيع المعني بالأمر / ولي الأمر
            </label>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4 bg-white p-5 rounded-xl shadow-sm border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                عنوان التقرير / Titre
              </label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                الموضوع / Sujet
              </label>
              <input
                type="text"
                value={reportSubject}
                onChange={(e) => setReportSubject(e.target.value)}
                placeholder="مثال: تتبع المواظبة، سلوك، زيارة صحية..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              نص التقرير / Corps du rapport
            </label>
            <textarea
              rows={8}
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              تفاصيل إضافية أو ملاحظات خاصة / Observations
            </label>
            <textarea
              rows={3}
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleGeneratePdf}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              توليد ملف PDF / Générer PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
