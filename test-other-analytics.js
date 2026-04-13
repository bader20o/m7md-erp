const http = require('http');

const options1 = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/analytics/ai-summary?from=2026-02-01&to=2026-04-01',
  method: 'GET'
};

const options2 = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/analytics/outstanding',
  method: 'GET'
};

const req1 = http.request(options1, res => {
  console.log('AI-Summary statusCode:', res.statusCode);
  res.on('data', d => process.stdout.write(d));
});
req1.end();

const req2 = http.request(options2, res => {
  console.log('\nOutstanding statusCode:', res.statusCode);
  res.on('data', d => process.stdout.write(d));
});
req2.end();
