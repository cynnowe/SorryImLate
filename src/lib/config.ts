export type SchoolPeriod = {
  id: string;
  name: string;
  start: Date;
  end: Date;
};

export const SCHOOL_PERIODS: SchoolPeriod[] = [
  { id: 'p1', name: 'Période 1', start: new Date('2025-08-27'), end: new Date('2025-10-17') },
  { id: 'p2', name: 'Période 2', start: new Date('2025-11-03'), end: new Date('2025-12-19') },
  { id: 'p3', name: 'Période 3', start: new Date('2026-01-05'), end: new Date('2026-02-13') },
  { id: 'p4', name: 'Période 4', start: new Date('2026-03-02'), end: new Date('2026-04-24') },
  { id: 'p5', name: 'Période 5', start: new Date('2026-05-11'), end: new Date('2026-06-26') },
];
