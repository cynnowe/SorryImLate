const fs = require('fs');
const XLSX = require('xlsx');

try {
  const buffer = fs.readFileSync('Absences.xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet);
  console.log('Total rows parsed:', rawData.length);
  if (rawData.length > 0) {
    console.log('First row headers:', Object.keys(rawData[0]));
    console.log('First row values:', rawData[0]);
  }
} catch (err) {
  console.error('Error parsing excel:', err);
}
