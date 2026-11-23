import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Upload,
  FileText,
  Users,
  Search,
  CheckSquare,
  Square,
  AlertTriangle
} from 'lucide-react';
import { parseExcelFile } from '../services/excelImporter';
import { MOVEMENT_CATEGORIES, openMovementRequestsPdf } from '../services/pdfMovements';

const DEFAULT_REQUEST_TEXTS = {
  arrive:
    'بناء على المعطيات الإدارية المسجلة برسم الموسم الدراسي {{annee_scolaire}}، نلتمس استكمال ملف التلميذ(ة) الوافد(ة) {{nom_complet}} (ID: {{code_eleve}}) بالقسم {{classe}} ابتداء من {{date_mouvement}}.\n\n{{motif}}',
  parti:
    'نحيطكم علما بأن التلميذ(ة) {{nom_complet}} (ID: {{code_eleve}}) المسجل(ة) سابقا بالقسم {{classe}} قد غادر(ت) المؤسسة بتاريخ {{date_mouvement}} نحو {{etablissement_origine_dest}}.\n\n{{motif}}',
  abandon:
    'نلتمس منكم تتبع وضعية انقطاع التلميذ(ة) {{nom_complet}} (ID: {{code_eleve}}) عن الدراسة بالقسم {{classe}} منذ {{date_mouvement}}، والتواصل مع ولي الأمر {{tuteur_nom}} ({{tuteur_telephone}}).\n\nالسبب: {{motif}}',
  non_rejoint:
    'نخبركم بأن التلميذ(ة) {{nom_complet}} (ID: {{code_eleve}}) المسند إلى القسم {{classe}} لم يلتحق بالمؤسسة إلى حدود {{date_mouvement}}.\n\n{{motif}}'
};

export default function StudentMovements({
  settings = {},
  schoolYear = null,
  movements = [],
  students = [],
  onImportMovements
}) {
  const [activeCategory, setActiveCategory] = useState('arrive');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const [importPreview, setImportPreview] = useState(null);
  const [importStatusMsg, setImportStatusMsg] = useState('');

  const [pdfMode, setPdfMode] = useState('individual_pages');
  const [signataire, setSignataire] = useState('directeur');
  const [customRequestText, setCustomRequestText] = useState(DEFAULT_REQUEST_TEXTS.arrive);

  const studentByCode = useMemo(() => {
    const map = new Map();
    for (const s of students) {
      if (s.code_eleve) map.set(String(s.code_eleve).trim(), s);
    }
    return map;
  }, [students]);

  const handleCategorySwitch = (catKey) => {
    setActiveCategory(catKey);
    setSelectedIds([]);
    setImportPreview(null);
    setImportStatusMsg('');
    setCustomRequestText(DEFAULT_REQUEST_TEXTS[catKey] || '');
  };

  const categoryItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return movements
      .filter((m) => m.type_mouvement === activeCategory)
      .map((m) => {
        const matchedStudent = studentByCode.get(String(m.code_eleve || '').trim());
        return {
          ...m,
          classe_nom: m.classe_nom || matchedStudent?.classe_nom || '',
          tuteur_nom: m.tuteur_nom || matchedStudent?.tuteur_nom || '',
          tuteur_telephone: m.tuteur_telephone || matchedStudent?.tuteur_telephone || ''
        };
      })
      .filter((m) => {
        if (!q) return true;
        const hay = `${m.code_eleve || ''} ${m.nom_complet || ''} ${m.classe_nom || ''} ${m.motif || ''}`.toLowerCase();
        return hay.includes(q);
      });
  }, [movements, activeCategory, searchQuery, studentByCode]);

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatusMsg('');

    const buffer = await file.arrayBuffer();
    const rawRows = parseExcelFile(buffer);

    const validRows = [];
    const anomalies = [];
    const seenInBatch = new Set();

    for (const r of rawRows) {
      const codeEleve = String(r.code_eleve || r.code || r.massar || '').trim();
      const nomComplet = String(r.nom_complet || `${r.nom || ''} ${r.prenom || ''}`).trim();
      const classeNom = String(r.classe || r.classe_nom || r.section || '').trim();
      const dateMouvement = String(r.date_mouvement || r.date || '').trim();
      const etablissementOrigineDest = String(
        r.etablissement || r.etablissement_origine_dest || r.origine || r.destination || ''
      ).trim();
      const motif = String(r.motif || r.observation || r.remarque || '').trim();

      const reasons = [];
      if (!codeEleve) reasons.push('Code élève manquant');
      if (!nomComplet) reasons.push('Nom complet manquant');
      if (codeEleve && seenInBatch.has(codeEleve)) {
        reasons.push(`Doublon dans le fichier (${codeEleve})`);
      }
      if (codeEleve) seenInBatch.add(codeEleve);

      if (reasons.length > 0) {
        anomalies.push({ ligne: r._rowNumber, code_eleve: codeEleve || '—', raisons: reasons });
      } else {
        const linkedStudent = studentByCode.get(codeEleve);
        validRows.push({
          code_eleve: codeEleve,
          nom_complet: nomComplet,
          classe_nom: classeNom || linkedStudent?.classe_nom || '',
          type_mouvement: activeCategory,
          date_mouvement: dateMouvement || new Date().toISOString().slice(0, 10),
          etablissement_origine_dest: etablissementOrigineDest,
          motif,
          tuteur_nom: String(r.tuteur_nom || r.tuteur || linkedStudent?.tuteur_nom || '').trim(),
          tuteur_telephone: String(
            r.tuteur_telephone || r.telephone || r.tel || linkedStudent?.tuteur_telephone || ''
          ).trim()
        });
      }
    }

    setImportPreview({ validRows, anomalies });
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importPreview?.validRows?.length) return;
    if (onImportMovements) {
      await onImportMovements(activeCategory, importPreview.validRows);
    }
    setImportStatusMsg(
      `تم استيراد ${importPreview.validRows.length} سطر بنجاح ضمن فئة "${MOVEMENT_CATEGORIES[activeCategory].labelAr}".`
    );
    setImportPreview(null);
  };

  const toggleSelectItem = (itemKey) => {
    setSelectedIds((prev) =>
      prev.includes(itemKey) ? prev.filter((id) => id !== itemKey) : [...prev, itemKey]
    );
  };

  const allSelected =
    categoryItems.length > 0 &&
    categoryItems.every((item, idx) => selectedIds.includes(item.id ?? `${item.code_eleve}_${idx}`));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(categoryItems.map((item, idx) => item.id ?? `${item.code_eleve}_${idx}`));
    }
  };

  const selectedItems = useMemo(
    () =>
      categoryItems.filter((item, idx) =>
        selectedIds.includes(item.id ?? `${item.code_eleve}_${idx}`)
      ),
    [categoryItems, selectedIds]
  );

  const handleGeneratePdf = (targetList) => {
    if (!targetList.length) return;
    openMovementRequestsPdf({
      items: targetList,
      mode: targetList.length === 1 ? 'individual_pages' : pdfMode,
      settings,
      schoolYearLabel: schoolYear?.libelle || '',
      categoryKey: activeCategory,
      customRequestText,
      signataire
    });
  };

  const currentCatConfig = MOVEMENT_CATEGORIES[activeCategory];

  return (
    <div className="p-6 space-y-5 bg-gray-50 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex items-center gap-3">
          <UserPlus className="w-6 h-6 text-indigo-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              تدبير حركات التلاميذ والطلبات (PDF) — Mouvements des élèves
            </h1>
            <p className="text-xs text-gray-500">
              الموسم الدراسي: {schoolYear?.libelle || '—'} • الوافدون، المغادرون، المنقطعون وغير الملتحقين
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition">
          <Upload className="w-4 h-4" />
          استيراد Excel ({currentCatConfig.labelAr})
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleExcelUpload}
            className="hidden"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.values(MOVEMENT_CATEGORIES).map((cat) => {
          const count = movements.filter((m) => m.type_mouvement === cat.key).length;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => handleCategorySwitch(cat.key)}
              className={`p-3.5 rounded-xl border text-right transition flex items-center justify-between ${
                isActive
                  ? 'bg-white border-indigo-600 ring-2 ring-indigo-100 shadow-sm'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div>
                <p className="text-sm font-bold text-gray-800">{cat.labelAr}</p>
                <p className="text-[11px] text-gray-500">{cat.labelFr}</p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cat.badgeClass}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {importStatusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium">
          {importStatusMsg}
        </div>
      )}

      {importPreview && (
        <div className="bg-white p-4 rounded-xl border border-amber-300 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              معاينة الملف: {importPreview.validRows.length} سطر صالح • {importPreview.anomalies.length} ملاحظة/خطأ
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="px-3 py-1.5 rounded-lg border text-xs text-gray-600 hover:bg-gray-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!importPreview.validRows.length}
                onClick={handleConfirmImport}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold"
              >
                تأكيد وحفظ ({importPreview.validRows.length})
              </button>
            </div>
          </div>

          {importPreview.anomalies.length > 0 && (
            <ul className="text-xs text-rose-700 bg-rose-50 p-3 rounded-lg space-y-1 max-h-36 overflow-y-auto">
              {importPreview.anomalies.map((a, i) => (
                <li key={i}>
                  السطر {a.ligne} (ID: {a.code_eleve}) : {a.raisons.join(' — ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              صيغة إخراج PDF للمجموعة
            </label>
            <select
              value={pdfMode}
              onChange={(e) => setPdfMode(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
            >
              <option value="individual_pages">طلب / وثيقة مستقلة لكل تلميذ (صفحة لكل تلميذ)</option>
              <option value="group_table">لائحة جماعية في جدول واحد</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              التوقيع / Signature
            </label>
            <select
              value={signataire}
              onChange={(e) => setSignataire(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
            >
              <option value="directeur">المدير(ة) / Directeur</option>
              <option value="surveillant_general">الحارس العام / Surveillant Général</option>
              <option value="les_deux">الحارس العام والمدير(ة) معا</option>
            </select>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-2">
          <label className="block text-xs font-semibold text-gray-700">
            نص الطلب / الوثيقة الخاصة بفئة "{currentCatConfig.labelAr}"
          </label>
          <textarea
            rows={4}
            value={customRequestText}
            onChange={(e) => setCustomRequestText(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-xs leading-relaxed"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، ID أو القسم..."
            className="w-full border rounded-lg pl-9 pr-3 py-1.5 text-xs"
          />
        </div>

        <button
          type="button"
          disabled={!selectedItems.length}
          onClick={() => handleGeneratePdf(selectedItems)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition"
        >
          <Users className="w-4 h-4" />
          توليد PDF للمحددين ({selectedItems.length})
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-gray-100 text-gray-700 border-b">
            <tr>
              <th className="py-3 px-3 w-10 text-center">
                <button type="button" onClick={toggleSelectAll} className="text-gray-600 hover:text-indigo-600">
                  {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="py-3 px-3">ID / الرمز</th>
              <th className="py-3 px-3">التلميذ(ة)</th>
              <th className="py-3 px-3 text-center">القسم</th>
              <th className="py-3 px-3 text-center">التاريخ</th>
              <th className="py-3 px-3">ولي الأمر / الهاتف</th>
              <th className="py-3 px-3">السبب / {currentCatConfig.originDestLabel}</th>
              <th className="py-3 px-3 text-center">طلب فردي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categoryItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  لا توجد بيانات في فئة "{currentCatConfig.labelAr}". يمكنك استيراد ملف Excel أعلاه.
                </td>
              </tr>
            ) : (
              categoryItems.map((item, idx) => {
                const rowKey = item.id ?? `${item.code_eleve}_${idx}`;
                const isChecked = selectedIds.includes(rowKey);
                return (
                  <tr key={rowKey} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectItem(rowKey)}
                        className="text-indigo-600"
                      >
                        {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-700">{item.code_eleve}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">{item.nom_complet}</td>
                    <td className="py-2.5 px-3 text-center">{item.classe_nom || '—'}</td>
                    <td className="py-2.5 px-3 text-center">{item.date_mouvement || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-600">
                      {item.tuteur_nom || '—'} {item.tuteur_telephone ? `(${item.tuteur_telephone})` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">
                      {item.motif || item.etablissement_origine_dest || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleGeneratePdf([item])}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
