/**
 * Test reconciliation via API (simulates browser)
 */
async function testRecon() {
  console.log('Testing reconciliation API...\n');
  
  const response = await fetch('http://localhost:3000/api/recon/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runName: 'Test reconciliation' }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    console.error('Error:', error);
    return;
  }
  
  const result = await response.json();
  console.log('Success!');
  console.log(JSON.stringify(result, null, 2));
}

testRecon().catch(console.error);
