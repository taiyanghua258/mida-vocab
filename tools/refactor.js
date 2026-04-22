const fs = require('fs');

const htmlPath = 'frontend/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Replace hardcoded border radius in html
html = html.replace(/rounded-\[1\.5rem\]/g, 'rounded-[var(--radius-card)]');
html = html.replace(/rounded-\[1\.25rem\]/g, 'rounded-[var(--radius-panel)]');
html = html.replace(/rounded-\[2rem\]/g, 'rounded-[var(--radius-modal)]');
html = html.replace(/rounded-\[0\.85rem\]/g, 'rounded-[var(--radius-btn)]');
html = html.replace(/rounded-2xl/g, 'rounded-[var(--radius-panel)]');

// 2. Replace hardcoded shadows in html
html = html.replace(/shadow-\[0_12px_40px_rgba\(26,47,43,0\.12\)\]/g, 'shadow-[var(--shadow-modal)]');
html = html.replace(/shadow-\[0_10px_40px_rgba\(26,47,43,0\.08\)\]/g, 'shadow-[var(--shadow-dropdown)]');
html = html.replace(/shadow-\[0_10px_40px_rgba\(26,47,43,0\.04\)\]/g, 'shadow-[var(--shadow-card)]');

fs.writeFileSync(htmlPath, html);
console.log('HTML refactored.');
