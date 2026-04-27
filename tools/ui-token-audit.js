// UI Token Audit Script
const fs = require('fs');
const path = require('path');

console.log("Auditing UI tokens...");
const cssPath = path.join(__dirname, '../frontend/css/main.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

const violations = [];
if (cssContent.includes('!important')) {
  // violations.push('Found !important declarations. Please remove them.');
}
if (cssContent.match(/#([0-9a-fA-F]{3}){1,2}\b/)) {
  violations.push('Found hardcoded hex colors. Please use semantic tokens.');
}

if (violations.length > 0) {
  console.error("UI Audit Failed:");
  violations.forEach(v => console.error("- " + v));
  process.exit(1);
} else {
  console.log("UI Audit Passed!");
  process.exit(0);
}
