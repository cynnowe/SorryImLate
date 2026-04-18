import { startOfDay, format } from 'date-fns';
import * as ExcelJS from 'exceljs';

export type RetardType = 'Matin' | 'Après-midi' | 'Cours';

export type ProcessedRecord = {
  id: string;
  classe: string;
  niveau: string;
  nom: string;
  debut: Date;
  amPm: string;
  heureArrivee: string | undefined;
  retardType: RetardType;
  justification: string;
};

export type StudentStats = {
  nom: string;
  lastName: string;
  classe: string;
  niveau: string;
  totalRetards: number;
  counts: { Matin: number; 'Après-midi': number; Cours: number };
  records: ProcessedRecord[];
};

function parseExcelDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'number') {
    const date = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  }
  return null;
}

export async function parseExcelFile(file: File): Promise<ProcessedRecord[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const worksheet = workbook.worksheets[0];
  const headerRow = worksheet.getRow(1);
  const headers: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    headers[cell.value?.toString().trim() || ''] = colNumber;
  });

  const rawRecords: any[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const getValue = (name: string) => {
      const col = headers[name];
      return col ? row.getCell(col).value : undefined;
    };

    const ref = String(getValue('Ref') || '').trim();
    if (!/^\d{4,5}$/.test(ref)) return;

    const debut = parseExcelDate(getValue('Début'));
    if (!debut) return;

    const justification = String(getValue('Justification') || '');
    const heureArrivee = getValue("Heure d'arrivée");
    
    // CRITICAL FILTER: Keep ONLY explicitly marked Retards or those with an arrival time
    const hasArrivalTime = heureArrivee !== undefined && heureArrivee !== null && String(heureArrivee).trim() !== '';
    const isRetardJustif = justification.toLowerCase().includes('retard');
    
    if (!hasArrivalTime && !isRetardJustif) return;

    rawRecords.push({
      classe: String(getValue('Classe') || 'Inconnu'),
      niveau: String(getValue('Niveau') || 'Inconnu'),
      nom: String(getValue('Nom') || 'Inconnu'),
      debut,
      amPm: String(getValue('AM/PM') || 'AM-PM'),
      heureArrivee: hasArrivalTime ? String(heureArrivee) : undefined,
      justification
    });
  });

  // Group to avoid duplicates on same half-day if any
  const grouped = new Map<string, any[]>();
  rawRecords.forEach(rec => {
    const dayStr = format(rec.debut, 'yyyy-MM-dd');
    const key = `${rec.nom}|${dayStr}|${rec.amPm.includes('AM') ? 'AM' : 'PM'}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(rec);
  });

  const processed: ProcessedRecord[] = [];

  grouped.forEach((rows, key) => {
    const [nom, dayStr, period] = key.split('|');
    const first = rows[0];
    const day = startOfDay(new Date(dayStr));

    let type: RetardType = 'Cours';
    let arrivalTime: string | undefined = undefined;

    const withTime = rows.find(r => r.heureArrivee);
    if (withTime) {
      arrivalTime = withTime.heureArrivee;
      const hour = parseInt(arrivalTime.split(':')[0]);
      if (hour < 11) type = 'Matin';
      else if (hour >= 12) type = 'Après-midi';
      else type = 'Cours';
    } else {
      type = 'Cours';
    }

    processed.push({
      id: key,
      classe: first.classe,
      niveau: first.niveau,
      nom: first.nom,
      debut: day,
      amPm: period === 'AM' ? 'AM' : 'PM',
      heureArrivee: arrivalTime,
      retardType: type,
      justification: rows.map(r => r.justification).filter((v,i,a) => v && a.indexOf(v) === i).join(', ')
    });
  });

  return processed;
}

export function filterRecords(
  records: ProcessedRecord[],
  filters: { niveau?: string; classe?: string; startDate?: Date; endDate?: Date; }
): ProcessedRecord[] {
  return records.filter(r => {
    if (filters.niveau && r.niveau !== filters.niveau) return false;
    if (filters.classe && r.classe !== filters.classe && filters.classe !== 'Toutes') return false;
    if (filters.startDate && filters.endDate) {
      if (r.debut < filters.startDate || r.debut > filters.endDate) return false;
    }
    return true;
  });
}

export function computeStats(records: ProcessedRecord[]): StudentStats[] {
  const statsMap = new Map<string, StudentStats>();

  records.forEach(r => {
    if (!statsMap.has(r.nom)) {
      const parts = r.nom.split(' ');
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
      statsMap.set(r.nom, {
        nom: r.nom,
        lastName: lastName.toLowerCase(),
        classe: r.classe,
        niveau: r.niveau,
        totalRetards: 0,
        counts: { Matin: 0, 'Après-midi': 0, Cours: 0 },
        records: []
      });
    }

    const stat = statsMap.get(r.nom)!;
    stat.totalRetards += 1;
    stat.counts[r.retardType] += 1;
    stat.records.push(r);
  });

  return Array.from(statsMap.values()).sort((a, b) => a.lastName.localeCompare(b.lastName));
}
