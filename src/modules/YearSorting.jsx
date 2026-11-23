import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import {
  ArrowLeftRight,
  Search,
  FileSpreadsheet,
  Printer,
  ArrowUpDown,
  Filter
} from 'lucide-react';
import { buildCenteredPdfHeader } from '../services/pdfHeader';

const EVOLUTION_LABELS = {
  passage: { text: 'انتقال / Passage', badgeClass: 'bg-emerald-100 text-emerald-800' },
  maintien: { text: 'تكرار / Maintien', badgeClass: 'bg-amber-100 text-amber-800' },
  nouveau: { text: 'وافد جديد / Nouveau', badgeClass: 'bg-blue-100 text-blue-800' },
  absent_suivante: { text: 'غير مدرج بالسنة الموالية', badgeClass: 'bg-rose-100 text-rose-800' }
};

export function buildCrossYearRecords(prevStudents = [], nextStudents = []) {
  const prevMap = new Map();
  for (const s of prevStudents) {
    if (s.code_eleve) prevMap.set(String(s.code_eleve).trim(), s);
  }

  const nextMap = new Map();
  for (const s of nextStudents) {
    if (s.code_eleve) nextMap.set(String(s.code_eleve).trim(), s);
  }

  const allCodes = Array.from(new Set([...prevMap.keys(), ...nextMap.keys()]));

  return allCodes.map((code) => {
    const p = prevMap.get(code) || null;
    const n = nextMap.get(code) || null;

    const prevClass = p?.classe_nom || p?.classe || '';
    const nextClass = n?.classe_nom || n?.classe || '';

    let type_evolution = 'passage';
    if (p && n) {
      type_evolution =
        prevClass && nextClass && prevClass.trim() === nextClass.trim()
          ? 'maintien'
          : 'passage';
    } else if (!p && n) {
      type_evolution = 'nouveau';
    } else {
      type_evolution = 'absent_suivante';
    }

    return {
      code_eleve: code,
      nom: (n?.nom || p?.nom || '').trim(),
      prenom: (n?.prenom || p?.prenom || '').trim(),
      classe_precedente: prevClass || '—',
      classe_suivante: nextClass || '—',
      tuteur_nom: n?.tuteur_nom || p?.tuteur_nom || '',
      tuteur_telephone: n?.tuteur_telephone || p?.tuteur_telephone || '',
      type_evolution
    };
  });
}

export default function YearSorting({
  settings = {},
  schoolYears = [],
  prevStudents = [],
  nextStudents = [],
  fromYearId,
  toYearId,
  onChangeFromYear,
  onChangeToYear
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPrevClass, setFilterPrevClass] = useState('');
  const [filterNextClass, setFilterNextClass] = useState('');
  const [filterEvolution, setFilterEvolution] = useState('all');
  const [sortBy, setSortBy] = useState('next_class');
  const [sortAsc, setSortAsc] = useState(true);

  const fromYearLabel =
    schoolYears.find((y) => String(y.id) === String(fromYearId))?.libelle || '2025/2026';
  const toYearLabel =
    schoolYears.find((y) => String(y.id) === String(toYearId))?.libelle || '2026/2027';

  const allRecords = useMemo(
    () => buildCrossYearRecords(prevStudents, nextStudents),
    [prevStudents, nextStudents]
  );

  const prevClassesList = useMemo(() => {
    const set = new Set(
      allRecords.map((r) => r.classe_precedente).filter((c) => c && c !== '—')
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [allRecords]);

  const nextClassesList = useMemo(() => {
    const set = new Set(
      allRecords.map((r) => r.classe_suivante).filter((c) => c && c !== '—')
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [allRecords]);

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = allRecords.filter((rec) => {
      if (filterPrevClass && rec.classe_precedente !== filterPrevClass) return false;
      if (filterNextClass && rec.classe_suivante !== filterNextClass) return false;
      if (filterEvolution !== 'all' && rec.type_evolution !== filterEvolution) return false;

      if (q) {
        const hay = `${rec.code_eleve} ${rec.nom} ${rec.prenom} ${rec.classe_precedente} ${rec.classe_suivante}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let valA = '';
      let valB = '';
      if (sortBy === 'next_class') {
        valA = a.classe_suivante === '—' ? 'zzz' : a.classe_suivante;
        valB = b.classe_suivante === '—' ? 'zzz' : b.classe_suivante;
      } else if (sortBy === 'prev_class') {
        valA = a.classe_precedente === '—' ? 'zzz' : a.classe_precedente;
        valB = b.classe_precedente === '—' ? 'zzz' : b.classe_precedente;
      } else if (sortBy === 'code') {
        valA = a.code_eleve;
        valB = b.code_eleve;
      } else {
        valA = `${a.nom} ${a.prenom}`;
        valB = `${b.nom} ${b.prenom}`;
      }

      const cmp = String(valA).localeCompare(String(valB), 'fr', { numeric: true });
      if (cmp !== 0) return cmp * dir;
      return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr');
    });
  }, [allRecords, filterPrevClass, filterNextClass, filterEvolution, searchQuery, sortBy, sortAsc]);

  const stats = useMemo(
    () => ({
      total: filteredAndSorted.length,
      passages: filteredAndSorted.filter((r) => r.type_evolution === 'passage').length,
      maintiens: filteredAndSorted.filter((r) => r.type_evolution === 'maintien').length,
      nouveaux: filteredAndSorted.filter((r) => r.type_evolution === 'nouveau').length
    }),
    [filteredAndSorted]
  );

  const handleToggleSort = (columnKey) => {
    if (sortBy === columnKey) setSortAsc((prev) => !prev);
    else {
      setSortBy(columnKey);
      setSortAsc(true);
    }
  };

  const handleExportExcel = () => {
    const rowsForExcel = filteredAndSorted.map((r, index) => ({
      'N°': index + 1,
      'Code Élève / ID': r.code_eleve,
      'Nom': r.nom,
      'Prénom': r.prenom,
      [`Classe (${fromYearLabel})`]: r.classe_precedente,
      [`Classe (${toYearLabel})`]: r.classe_suivante,
      'Situation': EVOLUTION_LABELS[r.type_evolution]?.text || r.type_evolution,
      'Tuteur': r.tuteur_nom,
      'Téléphone': r.tuteur_telephone
    }));

    const worksheet = XLSX.utils.json_to_sheet(rowsForExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tri_Dossiers');
    XLSX.writeFile(
      workbook,
      `Tri_Dossiers_${fromYearLabel.replace(/\//g, '-')}_vers_${toYearLabel.replace(/\//g, '-')}.xlsx`
    );
  };

  const handleExportPdf = () => {
    const subtitle = `من ${fromYearLabel} إلى ${toYearLabel}${
      filterPrevClass ? ` | القسم السابق: ${filterPrevClass}` : ''
    }${filterNextClass ? ` | القسم الجديد: ${filterNextClass}` : ''}`;

    const headerBloc = buildCenteredPdfHeader(
      settings,
      `${fromYearLabel} → ${toYearLabel}`,
      'جدول فرز وترتيب ملفات التلاميذ بين موسمين دراسيين',
      subtitle
    );

    const tableBody = [
      [
        { text: 'N°', bold: true, fontSize: 8.5, fillColor: '#E5E7EB', alignment: 'center' },
        { text: 'ID / الرمز', bold: true, fontSize: 8.5, fillColor: '#E5E7EB', alignment: 'center' },
        { text: 'الاسم الكامل / Élève', bold: true, fontSize: 8.5, fillColor: '#E5E7EB' },
        { text: `القسم (${fromYearLabel})`, bold: true, fontSize: 8.5, fillColor: '#DBEAFE', alignment: 'center' },
        { text: `القسم (${toYearLabel})`, bold: true, fontSize: 8.5, fillColor: '#D1FAE5', alignment: 'center' },
        { text: 'الوضعية', bold: true, fontSize: 8.5, fillColor: '#E5E7EB', alignment: 'center' }
      ]
    ];

    filteredAndSorted.forEach((r, idx) => {
      tableBody.push([
        { text: String(idx + 1), fontSize: 8, alignment: 'center' },
        { text: r.code_eleve, fontSize: 8, alignment: 'center' },
        { text: `${r.nom} ${r.prenom}`.trim(), fontSize: 8 },
        { text: r.classe_precedente, fontSize: 8, bold: true, alignment: 'center' },
        { text: r.classe_suivante, fontSize: 8, bold: true, alignment: 'center' },
        { text: EVOLUTION_LABELS[r.type_evolution]?.text || r.type_evolution, fontSize: 7.5, alignment: 'center' }
      ]);
    });

    pdfMake
      .createPdf({
        pageSize: 'A4',
        pageMargins: [24, 20, 24, 20],
        content: [
          ...headerBloc,
          {
            table: {
              headerRows: 1,
              widths: [28, 75, '*', 95, 95, 95],
              body: tableBody
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => '#CBD5E1',
              vLineColor: () => '#CBD5E1',
              paddingTop: () => 3,
              paddingBottom: () => 3
            }
          }
        ]
      })
      .open();
  };

  return (
    <div className="p-6 space-y-5 bg-gray-50 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex items-center gap-3">
          <ArrowLeftRight className="w-6 h-6 text-emerald-600" />
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              فرز ملفات التلاميذ بين موسمين دراسيين — Tri des dossiers inter-années
            </h1>
            <p className="text-xs text-gray-500">
              مقارنة أقسام التلاميذ بين السنة السابقة ({fromYearLabel}) والسنة الموالية ({toYearLabel}) لتسهيل ترتيب الملفات
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            تصدير Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition"
          >
            <Printer className="w-4 h-4" />
            تصدير PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              السنة الدراسية السابقة (مثال: 1AC)
            </label>
            <select
              value={fromYearId || ''}
              onChange={(e) => onChangeFromYear?.(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {schoolYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.libelle}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              السنة الدراسية الموالية (مثال: 2AC)
            </label>
            <select
              value={toYearId || ''}
              onChange={(e) => onChangeToYear?.(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {schoolYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.libelle}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">إجمالي الملفات المعروضة</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
            انتقال: {stats.passages}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">تكرار / وافدون جدد</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">
              تكرار: {stats.maintiens} • جدد: {stats.nouveaux}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو ID أو القسم..."
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>

        <div>
          <select
            value={filterPrevClass}
            onChange={(e) => setFilterPrevClass(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">القسم السابق ({fromYearLabel}) : الكل</option>
            {prevClassesList.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterNextClass}
            onChange={(e) => setFilterNextClass(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">القسم الجديد ({toYearLabel}) : الكل</option>
            {nextClassesList.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500 shrink-0" />
          <select
            value={filterEvolution}
            onChange={(e) => setFilterEvolution(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="all">كل الوضعيات</option>
            <option value="passage">انتقال إلى مستوى أعلى</option>
            <option value="maintien">تكرار / نفس القسم</option>
            <option value="nouveau">وافد جديد في السنة الموالية</option>
            <option value="absent_suivante">غير مدرج في السنة الموالية</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100 text-gray-700 text-xs uppercase border-b">
            <tr>
              <th className="py-3 px-3 text-center w-12">N°</th>
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => handleToggleSort('code')}
                  className="inline-flex items-center gap-1 font-semibold hover:text-blue-600"
                >
                  ID / الرمز <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>
              <th className="py-3 px-3">
                <button
                  type="button"
                  onClick={() => handleToggleSort('name')}
                  className="inline-flex items-center gap-1 font-semibold hover:text-blue-600"
                >
                  التلميذ(ة) / Élève <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>
              <th className="py-3 px-3 text-center">
                <button
                  type="button"
                  onClick={() => handleToggleSort('prev_class')}
                  className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                >
                  القسم ({fromYearLabel}) <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>
              <th className="py-3 px-3 text-center">
                <button
                  type="button"
                  onClick={() => handleToggleSort('next_class')}
                  className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
                >
                  القسم الجديد ({toYearLabel}) <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>
              <th className="py-3 px-3 text-center">الوضعية</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  لا توجد ملفات مطابقة للمعايير المحددة.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((rec, index) => {
                const evo = EVOLUTION_LABELS[rec.type_evolution] || EVOLUTION_LABELS.passage;
                return (
                  <tr key={rec.code_eleve} className="hover:bg-gray-50 transition">
                    <td className="py-2.5 px-3 text-center text-gray-500 font-medium">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-gray-700">
                      {rec.code_eleve}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-900">
                      {rec.nom} {rec.prenom}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-800 font-semibold text-xs border border-blue-200">
                        {rec.classe_precedente}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold text-xs border border-emerald-200">
                        {rec.classe_suivante}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${evo.badgeClass}`}>
                        {evo.text}
                      </span>
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
