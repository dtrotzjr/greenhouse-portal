// Test date conversion logic
// Simulate: Server is Nov 14, 2025 8:45 PM local (UTC-8)
// UTC time would be: Nov 15, 2025 4:45 AM
// Timestamp stored is Unix timestamp for Nov 15, 2025 4:45 AM UTC

// Create a timestamp for Nov 15, 2025 4:45 AM UTC
const utcDate = new Date('2025-11-15T04:45:00Z');
const timestamp = Math.floor(utcDate.getTime() / 1000);

console.log('=== Server creates timestamp ===');
console.log('UTC time:', utcDate.toUTCString());
console.log('Timestamp (seconds):', timestamp);
console.log('');

// Client receives timestamp and converts it
const clientDate = new Date(timestamp * 1000);
console.log('=== Client receives timestamp ===');
console.log('Client local time:', clientDate.toLocaleString());
console.log('Client date components:');
console.log('  getFullYear():', clientDate.getFullYear());
console.log('  getMonth():', clientDate.getMonth(), '(November = 10)');
console.log('  getDate():', clientDate.getDate());
console.log('  getUTCFullYear():', clientDate.getUTCFullYear());
console.log('  getUTCMonth():', clientDate.getUTCMonth(), '(November = 10)');
console.log('  getUTCDate():', clientDate.getUTCDate());
console.log('');

// Extract date string for date picker
const year = clientDate.getFullYear();
const month = String(clientDate.getMonth() + 1).padStart(2, '0');
const day = String(clientDate.getDate()).padStart(2, '0');
const dateStr = `${year}-${month}-${day}`;
console.log('=== Date string for date picker ===');
console.log('Date string:', dateStr);
console.log('');

// Create local date from components (what we're doing in the code)
const localDate = new Date(
  clientDate.getFullYear(),
  clientDate.getMonth(),
  clientDate.getDate()
);
console.log('=== Local date created from components ===');
console.log('Local date:', localDate.toLocaleString());
console.log('Date components:');
console.log('  getFullYear():', localDate.getFullYear());
console.log('  getMonth():', localDate.getMonth());
console.log('  getDate():', localDate.getDate());
console.log('');

// Check what the date picker would show
console.log('=== What date picker should show ===');
console.log('If client is in UTC-8 (same as server):', dateStr, '(should be 2025-11-14)');
console.log('If client is in UTC (different from server):', dateStr, '(would be 2025-11-15)');
