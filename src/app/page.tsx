"use client";

import { useState, useMemo, Fragment } from "react";
import { UploadCloud, FileSpreadsheet, Search, Filter, Calendar as CalendarIcon, ChevronDown, ChevronUp, Clock, Printer } from "lucide-react";
import { parseExcelFile, ProcessedRecord, filterRecords, computeStats, StudentStats } from "@/lib/parser";
import { SCHOOL_PERIODS } from "@/lib/config";
import { format } from "date-fns";

/* ─── helpers ──────────────────────────────────────────────────────────────── */

function getPeriodLabel(selectedPeriod: string, customStart: string, customEnd: string): string {
  if (selectedPeriod === "all") return "Toute l'année";
  if (selectedPeriod === "custom") return `${customStart} → ${customEnd}`;
  return SCHOOL_PERIODS.find(p => p.id === selectedPeriod)?.name ?? selectedPeriod;
}

function buildListHtml(
  stats: StudentStats[],
  selectedNiveau: string,
  selectedClasse: string,
  selectedPeriod: string,
  customStart: string,
  customEnd: string
): string {
  const periodLabel = getPeriodLabel(selectedPeriod, customStart, customEnd);
  const niveauLabel = selectedNiveau === "Toutes" ? "Tous les niveaux" : `Niveau ${selectedNiveau}`;
  const classeLabel = selectedClasse === "Toutes" ? "Toutes les classes" : selectedClasse;

  const rows = stats.map(s => `
    <tr>
      <td>${s.nom}</td>
      <td>Niveau ${s.niveau}</td>
      <td>${s.classe}</td>
      <td class="center">${s.counts.Matin}</td>
      <td class="center">${s.counts["Après-midi"]}</td>
      <td class="center">${s.counts.Cours}</td>
      <td class="center bold ${s.totalRetards >= 3 ? "red" : s.totalRetards > 0 ? "orange" : ""}">${s.totalRetards}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Rapport retards – ${niveauLabel} · ${classeLabel}</title>
  <style>
    @page { size: A4 landscape; margin: 1.5cm; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 10px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; text-align: left; padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .red { color: #dc2626; }
    .orange { color: #ea580c; }
    .summary { margin-top: 16px; font-size: 10px; color: #64748b; }
  </style>
</head>
<body>
  <h1>Analyse des retards</h1>
  <p class="meta">${niveauLabel} &nbsp;·&nbsp; ${classeLabel} &nbsp;·&nbsp; ${periodLabel} &nbsp;·&nbsp; Imprimé le ${format(new Date(), "dd/MM/yyyy à HH:mm")}</p>
  <table>
    <thead>
      <tr>
        <th>Élève</th><th>Niveau</th><th>Classe</th>
        <th class="center">Matin</th><th class="center">Après-midi</th><th class="center">De cours</th>
        <th class="center">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="summary">${stats.length} élève(s) affiché(s) &nbsp;·&nbsp; ${stats.reduce((a, s) => a + s.totalRetards, 0)} retard(s) au total</p>
</body>
</html>`;
}

function buildStudentHtml(student: StudentStats, periodLabel: string): string {
  const sorted = [...student.records].sort((a, b) => b.debut.getTime() - a.debut.getTime());

  const rows = sorted.map(rec => {
    const typeLabel =
      rec.retardType === "Matin" ? "Retard Matin" :
      rec.retardType === "Après-midi" ? "Retard Après-midi" :
      "Retard de cours";
    const colorClass =
      rec.retardType === "Matin" ? "blue" :
      rec.retardType === "Après-midi" ? "orange" : "purple";
    const detail = rec.heureArrivee
      ? `Arrivée à ${rec.heureArrivee}`
      : "Pas d'heure d'arrivée (Inter-cours)";
    const justif = rec.justification ? ` · ${rec.justification}` : "";
    return `<tr>
      <td><span class="badge ${colorClass}">${typeLabel}</span></td>
      <td>${format(rec.debut, "dd/MM/yyyy")}</td>
      <td>${detail}${justif}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Retards – ${student.nom}</title>
  <style>
    @page { size: A4 portrait; margin: 1.5cm; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 10px; margin-bottom: 16px; }
    .counters { display: flex; gap: 24px; margin-bottom: 20px; }
    .counter { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 20px; text-align: center; }
    .counter .label { font-size: 9px; text-transform: uppercase; letter-spacing: .07em; color: #94a3b8; }
    .counter .val { font-size: 22px; font-weight: bold; margin-top: 2px; }
    .blue-v { color: #2563eb; } .orange-v { color: #ea580c; } .purple-v { color: #9333ea; } .total-v { color: #1e293b; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; text-align: left; padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; border-radius: 4px; padding: 2px 7px; font-size: 10px; font-weight: bold; }
    .blue { background: #eff6ff; color: #2563eb; }
    .orange { background: #fff7ed; color: #ea580c; }
    .purple { background: #faf5ff; color: #9333ea; }
  </style>
</head>
<body>
  <h1>${student.nom}</h1>
  <p class="meta">Classe : ${student.classe} &nbsp;·&nbsp; Niveau ${student.niveau} &nbsp;·&nbsp; ${periodLabel} &nbsp;·&nbsp; Imprimé le ${format(new Date(), "dd/MM/yyyy à HH:mm")}</p>
  <div class="counters">
    <div class="counter"><div class="label">Matin</div><div class="val blue-v">${student.counts.Matin}</div></div>
    <div class="counter"><div class="label">Après-midi</div><div class="val orange-v">${student.counts["Après-midi"]}</div></div>
    <div class="counter"><div class="label">De cours</div><div class="val purple-v">${student.counts.Cours}</div></div>
    <div class="counter"><div class="label">Total</div><div class="val total-v">${student.totalRetards}</div></div>
  </div>
  <table>
    <thead><tr><th>Type</th><th>Date</th><th>Détail</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function printHtml(html: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

/* ─── component ────────────────────────────────────────────────────────────── */

export default function Dashboard() {
  const [records, setRecords] = useState<ProcessedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const [selectedNiveau, setSelectedNiveau] = useState<string>("Toutes");
  const [selectedClasse, setSelectedClasse] = useState<string>("Toutes");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const data = await parseExcelFile(file);
      setRecords(data);
      setSelectedNiveau("Toutes");
      setSelectedClasse("Toutes");
      setSelectedPeriod("all");
      setSearchQuery("");
      setExpandedStudent(null);
    } catch (error) {
      console.error("Erreur lors de l'analyse du fichier :", error);
      alert("Une erreur s'est produite lors de la lecture du fichier Excel.");
    } finally {
      setLoading(false);
    }
  };

  const niveaux = useMemo(() => {
    const n = new Set(records.map(r => r.niveau));
    return Array.from(n).sort();
  }, [records]);

  const classes = useMemo(() => {
    let filtered = records;
    if (selectedNiveau !== "Toutes") {
      filtered = filtered.filter(r => r.niveau === selectedNiveau);
    }
    const c = new Set(filtered.map(r => r.classe));
    return Array.from(c).sort();
  }, [records, selectedNiveau]);

  const stats = useMemo(() => {
    let start: Date | undefined;
    let end: Date | undefined;
    if (selectedPeriod === "custom" && customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd);
    } else if (selectedPeriod !== "all" && selectedPeriod !== "custom") {
      const p = SCHOOL_PERIODS.find(p => p.id === selectedPeriod);
      if (p) { start = p.start; end = p.end; }
    }
    const filtered = filterRecords(records, {
      niveau: selectedNiveau === "Toutes" ? undefined : selectedNiveau,
      classe: selectedClasse === "Toutes" ? undefined : selectedClasse,
      startDate: start,
      endDate: end,
    });
    let computedStats = computeStats(filtered);
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      computedStats = computedStats.filter(s => s.nom.toLowerCase().includes(lowerQuery));
    }
    return computedStats;
  }, [records, selectedNiveau, selectedClasse, selectedPeriod, customStart, customEnd, searchQuery]);

  const periodLabel = getPeriodLabel(selectedPeriod, customStart, customEnd);

  const handlePrintList = () => {
    const html = buildListHtml(stats, selectedNiveau, selectedClasse, selectedPeriod, customStart, customEnd);
    printHtml(html);
  };

  const handlePrintStudent = (student: StudentStats, e: React.MouseEvent) => {
    e.stopPropagation();
    const html = buildStudentHtml(student, periodLabel);
    printHtml(html);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans">
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-md">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Sorry I&apos;m Late
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center px-4">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
              <UploadCloud className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Importez vos données</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8">
              Sélectionnez le fichier Excel pour analyser les retards des élèves.
            </p>
            <label className="relative cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-all duration-200 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
              <span>{loading ? "Analyse en cours..." : "Choisir un fichier Excel"}</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="sr-only"
                onChange={handleFileUpload}
                disabled={loading}
              />
            </label>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center space-x-2 mb-6">
                <Filter className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold">Recherche et Filtres</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400" /> Élève
                  </label>
                  <input
                    type="text"
                    placeholder="Nom ou prénom..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Niveau</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-indigo-500 transition-colors"
                    value={selectedNiveau}
                    onChange={(e) => { setSelectedNiveau(e.target.value); setSelectedClasse("Toutes"); }}
                  >
                    <option value="Toutes">Tous les niveaux</option>
                    {niveaux.map(n => <option key={n} value={n}>Niveau {n}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Classe</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                    value={selectedClasse}
                    onChange={(e) => setSelectedClasse(e.target.value)}
                    disabled={selectedNiveau === "Toutes"}
                  >
                    <option value="Toutes">Toutes les classes</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-slate-400" /> Période
                  </label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-indigo-500 transition-colors"
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                    <option value="all">Toute l&apos;année</option>
                    {SCHOOL_PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    <option value="custom">Personnalisée...</option>
                  </select>
                </div>
              </div>

              {selectedPeriod === "custom" && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Du</label>
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Au</label>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              )}
            </div>

            {/* Results Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Table header with print button */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{stats.length}</span> élève(s) &nbsp;·&nbsp;
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{stats.reduce((a, s) => a + s.totalRetards, 0)}</span> retard(s)
                </div>
                <button
                  onClick={handlePrintList}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-sm transition-all duration-150"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer la liste
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium">
                    <tr>
                      <th className="px-6 py-4">Élève</th>
                      <th className="px-6 py-4">Niveau</th>
                      <th className="px-6 py-4">Classe</th>
                      <th className="px-6 py-4 text-center">Total Retards</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {stats.map((student, idx) => (
                      <Fragment key={`${student.nom}-${idx}`}>
                        <tr
                          onClick={() => setExpandedStudent(expandedStudent === student.nom ? null : student.nom)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white flex items-center space-x-2">
                            {expandedStudent === student.nom ? (
                              <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                            )}
                            <span>{student.nom}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                              Niveau {student.niveau}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{student.classe}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-lg text-sm font-bold ${
                              student.totalRetards === 0
                                ? "bg-slate-100 text-slate-500 dark:bg-slate-800"
                                : student.totalRetards < 3
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-red-50 text-red-700"
                            }`}>
                              {student.totalRetards}
                            </span>
                          </td>
                        </tr>

                        {expandedStudent === student.nom && (
                          <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                            <td colSpan={4} className="px-6 py-4">
                              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
                                {/* Detail header */}
                                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                                  <div className="flex gap-4">
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-500 uppercase font-bold">Matin</span>
                                      <span className="text-sm font-bold text-blue-600">{student.counts.Matin}</span>
                                    </div>
                                    <div className="border-r border-slate-200 dark:border-slate-700" />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-500 uppercase font-bold">Après-midi</span>
                                      <span className="text-sm font-bold text-orange-600">{student.counts["Après-midi"]}</span>
                                    </div>
                                    <div className="border-r border-slate-200 dark:border-slate-700" />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] text-slate-500 uppercase font-bold">De cours</span>
                                      <span className="text-sm font-bold text-purple-600">{student.counts.Cours}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {/* Per-student print button */}
                                    <button
                                      onClick={(e) => handlePrintStudent(student, e)}
                                      className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                      Imprimer cet élève
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setExpandedStudent(null); }}
                                      className="text-xs text-slate-400 hover:text-slate-200"
                                    >
                                      Fermer
                                    </button>
                                  </div>
                                </div>

                                {/* Detail rows */}
                                <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-64 overflow-y-auto">
                                  {student.records
                                    .sort((a, b) => b.debut.getTime() - a.debut.getTime())
                                    .map((rec, i) => (
                                      <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                                        <div className={`p-2 rounded-lg mt-0.5 ${
                                          rec.retardType === "Matin" ? "bg-blue-50 text-blue-600" :
                                          rec.retardType === "Après-midi" ? "bg-orange-50 text-orange-600" :
                                          "bg-purple-50 text-purple-600"
                                        }`}>
                                          <Clock className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between">
                                            <span className="font-bold text-sm">
                                              {rec.retardType === "Matin" ? "Retard Matin" :
                                               rec.retardType === "Après-midi" ? "Retard Après-midi" :
                                               "Retard de cours"}
                                            </span>
                                            <span className="text-xs text-slate-500">{format(rec.debut, "dd/MM/yyyy")}</span>
                                          </div>
                                          <div className="text-xs text-slate-600 mt-1">
                                            {rec.heureArrivee ? `Arrivée à ${rec.heureArrivee}` : "Pas d'heure d'arrivée (Inter-cours)"}
                                            {rec.justification && ` • ${rec.justification}`}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
