/**
 * Test bank CSV column mapping
 */
import { mapColumns } from '../src/ingestion/column-map';
import { readFileSync } from 'fs';

const csvContent = readFileSync('docs/test-data/bank_statement_demo.csv', 'utf-8');
const headers = csvContent.split('\n')[0].split(',').map(h => h.trim());

console.log('Bank CSV headers:', headers);
console.log('\nMapping result:');

const result = mapColumns(headers, 'bank');

console.log('Detected headers:', result.detectedHeaders);
console.log('Mapped fields:', result.mappedFields);
console.log('Missing required:', result.missingRequired);
console.log('Unknown headers:', result.unknownHeaders);
console.log('Warnings:', result.warnings);

if (result.missingRequired.length > 0) {
  console.log('\n❌ FAIL - Missing required columns');
} else {
  console.log('\n✓ PASS - All required columns present');
}
