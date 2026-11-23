import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  Upload,
  CalendarDays,
  FileText,
  UserPlus,
  ArrowLeftRight,
  Settings,
  Archive,
  GraduationCap,
  Users,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  DownloadCloud
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  parseExcelFile,
  validateStudentsBatch,
  validateAndMergeGuardians
} from './services/excelImporter';
import { resolveSelectedDays, openAbsenceSheetPdf } from './services/pdfAbsence';
import CustomReports from './modules/CustomReports';
import StudentMovements from './modules/StudentMovements';
import YearSorting from './modules/YearSorting';

const DEFAULT_YEARS = [
  { id: 1, libelle: '2025/2026', est_active: 0, est_archivee: 1 },
  { id: 2, libelle: '2026/2027', est_active: 1, est_archivee: 0 }
];

const DEFAULT_SETTINGS = {
  ministere: 'المملكة المغربية - وزارة التربية الوطنية والتعليم الأولي والرياضة',
  academie: '',
  direction_provinciale: '',
  nom_etablissement: 'مؤسسة تعليمية',
  code_gresa: '',
  adresse: '',
  telephone: '',
  logo_path: ''
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Tableau de bord', sub: 'لوحة القيادة', icon: LayoutDashboard },
  { id: 'imports', label: 'Imports Excel & Données', sub: 'استيراد المعطيات', icon: Upload },
  { id: 'absences', label: 'Fiches d\'absence PDF', sub: 'أوراق الغياب (8 حصص)', icon: CalendarDays },
  { id: 'reports', label: 'Rapports personnalisables', sub: 'التقارير والالتزامات', icon: FileText },
  { id: 'movements', label: 'Mouvements élèves', sub: 'الوافدون والمغادرون...', icon: UserPlus },
  { id: 'sorting', label: 'Tri dossiers inter-années', sub: 'فرز الملفات بين السنوات', icon: ArrowLeftRight },
  { id: 'settings', label: 'Établissement & Logo', sub: 'إعدادات المؤسسة', icon: Settings }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const [schoolYears, setSchoolYears] = useState(DEFAULT_YEARS);
  const [selectedYearId, setSelectedYearId] = useState(2);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');

  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [movements, setMovements] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [fromSortingYearId, setFromSortingYearId] = useState(1);
  const [toSortingYearId, setToSortingYearId] = useState(2);
  const [fromSortingStudents, setFromSortingStudents] = useState([]);
  const [toSortingStudents, setToSortingStudents] = useState([]);

  const [importKind, setImportKind] = useState('students');
  const [importReport, setImportReport] = useState(null);
  const [importBanner, setImportBanner] = useState('');

  const [absenceClassId, setAbsenceClassId] = useState('');
  const [periodMode, setPeriodMode] = useState('half_week_1');
  const [customDays, setCustomDays] = useState([1, 2, 3, 4, 5, 6]);
  const [periodLabel, setPeriodLabel] = useState('');

  const [backupMsg, setBackupMsg] = useState('');
  const [updateState, setUpdateState] = useState({ status: 'idle', version: '', message: '' });

  const currentYear = useMemo(
    () => schoolYears.find((y) => Number(y.id) === Number(selectedYearId)) || schoolYears[0],
    [schoolYears, selectedYearId]
  );

  useEffect(() => {
    if (!window.api?.onUpdaterStatus) return;
    const unsubscribe = window.api.onUpdaterStatus((payload) => {
      setUpdateState({
        status: payload?.status || 'idle',
        version: payload?.version || '',
        message: payload?.message || ''
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function bootstrap() {
      if (!window.api) return;
      try {
        const years = await window.api.getSchoolYears?.();
        if (Array.isArray(years) && years.length > 0) {
          setSchoolYears(years);
          const active = years.find((y) => y.est_active === 1) || years[years.length - 1];
          setSelectedYearId(active.id);
          const firstYear = years[0];
          setFromSortingYearId(firstYear.id);
          setToSortingYearId(active.id);
        }
        const cfg = await window.api.getSettings?.();
        if (cfg) {
          setSettings((prev) => ({ ...prev, ...cfg }));
        }
      } catch (err) {
        console.error('Erreur initialisation:', err);
      }
    }
    bootstrap();
  }, []);

  const loadYearData = useCallback(
    async (yearId) => {
      if (!window.api || !yearId) return;
      try {
        const data = await window.api.getYearData?.(yearId);
        if (!data) return;
        setClasses(data.classes || []);
        setStudents(data.students || []);
        setTeachers(data.teachers || []);
        setSchedules(data.schedules || []);
        setMovements(data.movements || []);
        if (Array.isArray(data.templates) && data.templates.length > 0) {
          setTemplates(data.templates);
        }
        if (data.classes?.length && !absenceClassId) {
          setAbsenceClassId(String(data.classes[0].id));
        }
      } catch (err) {
        console.error('Erreur chargement année:', err);
      }
    },
    [absenceClassId]
  );

  useEffect(() => {
    loadYearData(selectedYearId);
  }, [selectedYearId, loadYearData]);

  useEffect(() => {
    async function loadSortingYears() {
      if (!window.api) return;
      try {
        if (fromSortingYearId) {
          const dFrom = await window.api.getYearData?.(fromSortingYearId);
          setFromSortingStudents(dFrom?.students || []);
        }
        if (toSortingYearId) {
          const dTo = await window.api.getYearData?.(toSortingYearId);
          setToSortingStudents(dTo?.students || []);
        }
      } catch (err) {
        console.error('Erreur chargement années tri:', err);
      }
    }
    loadSortingYears();
  }, [fromSortingYearId, toSortingYearId, students]);

  const dashboardStats = useMemo(() => {
    const byMovement = {
      arrive: movements.filter((m) => m.type_mouvement === 'arrive').length,
      parti: movements.filter((m) => m.type_mouvement === 'parti').length,
      abandon: movements.filter((m) => m.type_mouvement === 'abandon').length,
      non_rejoint: movements.filter((m) => m.type_mouvement === 'non_rejoint').length
    };
    const missingGuardian = students.filter((s) => !s.tuteur_nom && !s.tuteur_telephone).length;

    return {
      studentsCount: students.length,
      classesCount: classes.length,
      teachersCount: teachers.length,
      missingGuardian,
      byMovement
    };
  }, [students, classes, teachers, movements]);

  const handleMainExcelFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportBanner('');

    const buffer = await file.arrayBuffer();
    const rawRows = parseExcelFile(buffer);

    if (importKind === 'students') {
      const { validRows, errors } = validateStudentsBatch(rawRows);
      setImportReport({ kind: 'students', validRows, errors });
    } else if (importKind === 'guardians') {
      const existingCodes = new Set(
        students.map((s) => String(s.code_eleve || '').trim()).filter(Boolean)
      );
      const { matchedToMerge, orphanGuardians, errors } = validateAndMergeGuardians(
        rawRows,
        existingCodes
      );
      setImportReport({ kind: 'guardians', validRows: matchedToMerge, orphanGuardians, errors });
    } else if (importKind === 'teachers') {
      const validRows = [];
      const errors = [];
      rawRows.forEach((r) => {
        const matricule = String(r.matricule || r.ppr || r.id || '').trim();
        const nom = String(r.nom || '').trim();
        const prenom = String(r.prenom || '').trim();
        if (!matricule || (!nom && !prenom)) {
          errors.push({
            ligne: r._rowNumber,
            code_eleve: matricule || '—',
            raisons: ['Matricule ou nom/prénom professeur manquant']
          });
        } else {
          validRows.push({
            matricule,
            nom,
            prenom,
            matiere: String(r.matiere || r.discipline || '').trim(),
            telephone: String(r.telephone || r.tel || '').trim()
          });
        }
      });
      setImportReport({ kind: 'teachers', validRows, errors });
    } else if (importKind === 'schedule') {
      const validRows = [];
      const errors = [];
      rawRows.forEach((r) => {
        const classeNom = String(r.classe || r.classe_nom || '').trim();
        const jour = Number(r.jour || r.day || 0);
        const seance = Number(r.seance || r.session || 0);
        if (!classeNom || jour < 1 || jour > 6 || seance < 1 || seance > 8) {
          errors.push({
            ligne: r._rowNumber,
            code_eleve: classeNom || '—',
            raisons: ['Classe, jour (1..6) ou séance (1..8) invalide']
          });
        } else {
          validRows.push({
            classe_nom: classeNom,
            jour,
            seance,
            matiere: String(r.matiere || '').trim(),
            prof_matricule: String(r.matricule_prof || r.prof_matricule || '').trim(),
            prof_nom: String(r.professeur || r.prof || r.enseignant || '').trim(),
            salle: String(r.salle || '').trim()
          });
        }
      });
      setImportReport({ kind: 'schedule', validRows, errors });
    }

    e.target.value = '';
  };

  const handleConfirmMainImport = async () => {
    if (!importReport?.validRows?.length) return;
    const { kind, validRows } = importReport;

    if (window.api) {
      if (kind === 'students') {
        await window.api.importStudentsExcel?.({ yearId: selectedYearId, rows: validRows });
      } else if (kind === 'guardians') {
        await window.api.importGuardiansExcel?.({ yearId: selectedYearId, rows: validRows });
      } else if (kind === 'teachers') {
        await window.api.importTeachersExcel?.({ yearId: selectedYearId, rows: validRows });
      } else if (kind === 'schedule') {
        await window.api.importScheduleExcel?.({ yearId: selectedYearId, rows: validRows });
      }
      await loadYearData(selectedYearId);
    }

    setImportBanner(`Importation réussie : ${validRows.length} ligne(s) enregistrée(s).`);
    setImportReport(null);
  };

  const handleGenerateAbsencePdf = () => {
    const cls = classes.find((c) => String(c.id) === String(absenceClassId)) || classes[0];
    if (!cls) return;

    const classStudents = students.filter((s) => String(s.classe_id) === String(cls.id));
    const classSchedules = schedules.filter((sc) => String(sc.classe_id) === String(cls.id));
    const daysToPrint = resolveSelectedDays(periodMode, customDays);

    openAbsenceSheetPdf({
      settings,
      schoolYearLabel: currentYear?.libelle || '',
      classInfo: cls,
      students: classStudents,
      schedules: classSchedules,
      selectedDays: daysToPrint,
      periodLabel
    });
  };

  const handleBackupClick = async () => {
    if (!window.api?.createBackup) return;
    const res = await window.api.createBackup();
    if (res?.success) {
      setBackupMsg(`Sauvegarde créée : ${res.path}`);
    }
  };

  const handleCheckUpdate = async () => {
    if (!window.api?.checkForUpdates) return;
    setUpdateState((prev) => ({ ...prev, status: 'checking', message: '' }));
    try {
      await window.api.checkForUpdates();
    } catch (err) {
      setUpdateState({ status: 'error', version: '', message: err?.message || 'Erreur' });
    }
  };

  const handleInstallUpdate = async () => {
    if (!window.api?.installUpdateNow) return;
    await window.api.installUpdateNow();
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (window.api?.updateSettings) {
      await window.api.updateSettings(settings);
    }
    setSettingsSavedMsg('Paramètres de l\'établissement enregistrés.');
    setTimeout(() => setSettingsSavedMsg(''), 3000);
  };

  const handleUploadLogoClick = async () => {
    if (!window.api?.uploadLogo) return;
    const newPath = await window.api.uploadLogo();
    if (newPath) {
      setSettings((prev) => ({ ...prev, logo_path: newPath }));
    }
  };

  const toggleCustomDay = (dayNum) => {
    setPeriodMode('custom');
    setCustomDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum]
    );
  };

  const handleExportStudentsExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      students.map((s, idx) => ({
        'N°': idx + 1,
        'Code Élève / ID': s.code_eleve,
        'Nom': s.nom,
        'Prénom': s.prenom,
        'Classe': s.classe_nom || '',
        'Tuteur': s.tuteur_nom || '',
        'Téléphone Tuteur': s.tuteur_telephone || ''
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Eleves_Tuteurs');
    XLSX.writeFile(wb, `Eleves_${(currentYear?.libelle || '').replace(/\//g, '-')}.xlsx`);
  };

  return (
    <div className="min-h-screen flex bg-gray-100 text-gray-800">
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0">
        <div>
          <div className="p-4 border-b border-slate-800 flex items-center gap-3">
            <GraduationCap className="w-7 h-7 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-bold tracking-wide">EduManager</p>
              <p className="text-[11px] text-slate-400 truncate">
                {settings.nom_etablissement || 'Gestion Éducative'}
              </p>
            </div>
          </div>

          <nav className="p-2.5 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
                    isActive
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs truncate">{item.label}</p>
                    <p className="text-[10px] opacity-75 truncate">{item.sub}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400">
          <p>
            Année active : <strong className="text-white">{currentYear?.libelle || '—'}</strong>
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">Mode local hors-ligne (SQLite)</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-500">
              الموسم الدراسي / Année scolaire :
            </span>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(Number(e.target.value))}
              className="border border-emerald-500 bg-emerald-50 text-emerald-950 font-bold rounded-lg px-3 py-1.5 text-sm"
            >
              {schoolYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.libelle} {y.est_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {backupMsg && <span className="text-xs text-emerald-700 font-medium">{backupMsg}</span>}

            {updateState.status === 'downloaded' ? (
              <button
                type="button"
                onClick={handleInstallUpdate}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <DownloadCloud className="w-4 h-4" />
                Installer v{updateState.version || 'nouvelle'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={updateState.status === 'checking'}
                className="flex items-center gap-1.5 border border-gray-300 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-medium transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${updateState.status === 'checking' ? 'animate-spin' : ''}`}
                />
                {updateState.status === 'checking' && 'Vérification...'}
                {updateState.status === 'available' && `Téléchargement v${updateState.version}...`}
                {(updateState.status === 'idle' || updateState.status === 'error') && 'Mises à jour'}
              </button>
            )}

            <button
              type="button"
              onClick={handleBackupClick}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition"
            >
              <Archive className="w-4 h-4" />
              Backup (.zip)
            </button>
          </div>
        </header>

        <main className="flex-1">
          {activeTab === 'dashboard' && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">التلاميذ / Élèves</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {dashboardStats.studentsCount}
                    </p>
                    <p className="text-[11px] text-amber-600 mt-1">
                      Sans tuteur : {dashboardStats.missingGuardian}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-blue-600 opacity-80" />
                </div>

                <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">الأقسام / Classes</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {dashboardStats.classesCount}
                    </p>
                  </div>
                  <BookOpen className="w-8 h-8 text-emerald-600 opacity-80" />
                </div>

                <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">الأساتذة / Professeurs</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {dashboardStats.teachersCount}
                    </p>
                  </div>
                  <GraduationCap className="w-8 h-8 text-indigo-600 opacity-80" />
                </div>

                <div className="bg-white p-5 rounded-xl border shadow-sm">
                  <p className="text-xs text-gray-500 mb-2">حركات التلاميذ (Mouvements)</p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 font-medium">
                      الوافدون: {dashboardStats.byMovement.arrive}
                    </span>
                    <span className="px-2 py-1 rounded bg-amber-50 text-amber-800 font-medium">
                      المغادرون: {dashboardStats.byMovement.parti}
                    </span>
                    <span className="px-2 py-1 rounded bg-rose-50 text-rose-800 font-medium">
                      المنقطعون: {dashboardStats.byMovement.abandon}
                    </span>
                    <span className="px-2 py-1 rounded bg-purple-50 text-purple-800 font-medium">
                      غير الملتحقين: {dashboardStats.byMovement.non_rejoint}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'imports' && (
            <div className="p-6 space-y-5">
              <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-800">
                      استيراد ملفات Excel وملاءمة المعطيات ({currentYear?.libelle})
                    </h2>
                    <p className="text-xs text-gray-500">
                      استيراد التلاميذ، دمج أولياء الأمور عبر الرمز الفريد، الأساتذة وجداول الحصص (8 حصص/يوم)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportStudentsExcel}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    Exporter Élèves + Tuteurs (.xlsx)
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                  <select
                    value={importKind}
                    onChange={(e) => {
                      setImportKind(e.target.value);
                      setImportReport(null);
                    }}
                    className="border rounded-lg px-3 py-2 text-xs font-semibold bg-white"
                  >
                    <option value="students">1. قائمة التلاميذ (Liste des élèves)</option>
                    <option value="guardians">2. أولياء الأمور ودمجهم مع التلاميذ (Tuteurs)</option>
                    <option value="teachers">3. قائمة الأساتذة (Professeurs)</option>
                    <option value="schedule">4. استعمال الزمن — 8 حصص/يوم (Emploi du temps)</option>
                  </select>

                  <label className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer">
                    Choisir fichier Excel (.xlsx / .csv)
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleMainExcelFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {importBanner && (
                  <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    {importBanner}
                  </div>
                )}

                {importReport && (
                  <div className="border border-amber-300 bg-amber-50/50 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-gray-800">
                        Lignes conformes : {importReport.validRows.length} • Erreurs :{' '}
                        {importReport.errors.length}
                        {importReport.orphanGuardians
                          ? ` • Tuteurs sans élève trouvé : ${importReport.orphanGuardians.length}`
                          : ''}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setImportReport(null)}
                          className="px-3 py-1.5 rounded-lg border bg-white text-xs"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={!importReport.validRows.length}
                          onClick={handleConfirmMainImport}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold"
                        >
                          Valider et enregistrer ({importReport.validRows.length})
                        </button>
                      </div>
                    </div>

                    {importReport.errors.length > 0 && (
                      <ul className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg space-y-1 max-h-32 overflow-y-auto">
                        {importReport.errors.map((err, i) => (
                          <li key={i}>
                            Ligne {err.ligne} ({err.code_eleve}) : {err.raisons.join(' — ')}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'absences' && (
            <div className="p-6 space-y-5">
              <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
                <div>
                  <h2 className="text-base font-bold text-gray-800">
                    توليد أوراق الغياب (PDF) — 8 حصص في اليوم مع تكرار الرقم الترتيبي
                  </h2>
                  <p className="text-xs text-gray-500">
                    نصف أسبوع، أسبوع كامل أو اختيار أيام محددة، مع تكرار رقم التلميذ بين حصص الصباح والمساء لتسهيل تسجيل الغياب
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      القسم / Classe
                    </label>
                    <select
                      value={absenceClassId}
                      onChange={(e) => setAbsenceClassId(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      الفترة الزمنية / Période
                    </label>
                    <select
                      value={periodMode}
                      onChange={(e) => setPeriodMode(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="half_week_1">نصف أسبوع 1 (الإثنين - الأربعاء)</option>
                      <option value="half_week_2">نصف أسبوع 2 (الخميس - السبت)</option>
                      <option value="full_week">أسبوع كامل (الإثنين - السبت)</option>
                      <option value="custom">اختيار أيام محددة</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      إشارة الأسبوع / التاريخ (اختياري)
                    </label>
                    <input
                      type="text"
                      value={periodLabel}
                      onChange={(e) => setPeriodLabel(e.target.value)}
                      placeholder="مثال: الأسبوع 05"
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {[
                    { d: 1, label: 'الإثنين / Lun' },
                    { d: 2, label: 'الثلاثاء / Mar' },
                    { d: 3, label: 'الأربعاء / Mer' },
                    { d: 4, label: 'الخميس / Jeu' },
                    { d: 5, label: 'الجمعة / Ven' },
                    { d: 6, label: 'السبت / Sam' }
                  ].map((item) => {
                    const activeDays = resolveSelectedDays(periodMode, customDays);
                    const checked = activeDays.includes(item.d);
                    return (
                      <button
                        key={item.d}
                        type="button"
                        onClick={() => toggleCustomDay(item.d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          checked
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGenerateAbsencePdf}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    Générer la fiche d'absence PDF
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <CustomReports
              settings={settings}
              schoolYear={currentYear}
              templates={templates}
              classes={classes}
              students={students}
              teachers={teachers}
            />
          )}

          {activeTab === 'movements' && (
            <StudentMovements
              settings={settings}
              schoolYear={currentYear}
              movements={movements}
              students={students}
              onImportMovements={async (catKey, validRows) => {
                if (window.api?.importMovementsExcel) {
                  await window.api.importMovementsExcel({
                    yearId: selectedYearId,
                    categoryKey: catKey,
                    rows: validRows
                  });
                  await loadYearData(selectedYearId);
                } else {
                  setMovements((prev) => [...prev, ...validRows]);
                }
              }}
            />
          )}

          {activeTab === 'sorting' && (
            <YearSorting
              settings={settings}
              schoolYears={schoolYears}
              prevStudents={fromSortingStudents}
              nextStudents={toSortingStudents}
              fromYearId={fromSortingYearId}
              toYearId={toSortingYearId}
              onChangeFromYear={setFromSortingYearId}
              onChangeToYear={setToSortingYearId}
            />
          )}

          {activeTab === 'settings' && (
            <div className="p-6">
              <form
                onSubmit={handleSaveSettings}
                className="bg-white p-6 rounded-xl border shadow-sm max-w-3xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-800">
                    معلومات المؤسسة والشعار (يظهر في أعلى وسط جميع الوثائق PDF)
                  </h2>
                  {settingsSavedMsg && (
                    <span className="text-xs text-emerald-700 font-semibold">
                      {settingsSavedMsg}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      اسم المؤسسة / Établissement
                    </label>
                    <input
                      type="text"
                      value={settings.nom_etablissement || ''}
                      onChange={(e) =>
                        setSettings({ ...settings, nom_etablissement: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      الأكاديمية / Académie
                    </label>
                    <input
                      type="text"
                      value={settings.academie || ''}
                      onChange={(e) => setSettings({ ...settings, academie: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      المديرية الإقليمية / Direction Provinciale
                    </label>
                    <input
                      type="text"
                      value={settings.direction_provinciale || ''}
                      onChange={(e) =>
                        setSettings({ ...settings, direction_provinciale: e.target.value })
                      }
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      الهاتف / Téléphone
                    </label>
                    <input
                      type="text"
                      value={settings.telephone || ''}
                      onChange={(e) => setSettings({ ...settings, telephone: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    الوزارة / Tutelle
                  </label>
                  <input
                    type="text"
                    value={settings.ministere || ''}
                    onChange={(e) => setSettings({ ...settings, ministere: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleUploadLogoClick}
                      className="px-3.5 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100 text-xs font-semibold"
                    >
                      Choisir le logo (.png / .jpg)
                    </button>
                    <span className="text-xs text-gray-500 truncate max-w-xs">
                      {settings.logo_path ? settings.logo_path : 'Aucun logo sélectionné'}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    Enregistrer les paramètres
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
