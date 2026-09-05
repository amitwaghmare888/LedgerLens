/**
 * Direct API test for bank CSV import
 * 
 * Run this with dev server running:
 * npm run dev
 * 
 * Then in another terminal:
 * npx tsx scripts/test-import-api.ts
 */
import { readFileSync } from 'fs';
import { join } from 'path';

async function testBankImport() {
  const filePath = join(process.cwd(), 'docs', 'test-data', 'bank_statement_demo.csv');
  const fileContent = readFileSync(filePath, 'utf-8');
  
  console.log('Testing bank import via direct API call...\n');
  console.log('File:', filePath);
  console.log('First line:', fileContent.split('\n')[0]);
  console.log('');
  
  // Create FormData
  const formData = new FormData();
  const blob = new Blob([fileContent], { type: 'text/csv' });
  const file = new File([blob], 'bank_statement_demo.csv', { type: 'text/csv' });
  
  formData.append('file', file);
  formData.append('source', 'bank');
  formData.append('format', 'csv');
  formData.append('confirmImport', 'false');
  
  console.log('Sending request to http://localhost:3000/api/import...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/import', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.log('❌ FAIL');
      console.log('Status:', response.status);
      console.log('Error:', result.error);
      if (result.details) {
        console.log('Details:', JSON.stringify(result.details, null, 2));
      }
    } else {
      console.log('✅ PASS');
      console.log('Import ID:', result.importId);
      console.log('Source:', result.source);
      console.log('Total rows:', result.totalRows);
      console.log('Valid rows:', result.validRows);
      console.log('Invalid rows:', result.invalidRows);
      if (result.warnings.length > 0) {
        console.log('Warnings:', result.warnings);
      }
      if (result.rowErrors && result.rowErrors.length > 0) {
        console.log('Row errors:', result.rowErrors);
      }
    }
  } catch (error) {
    console.log('❌ REQUEST FAILED');
    console.error(error);
  }
}

testBankImport();
