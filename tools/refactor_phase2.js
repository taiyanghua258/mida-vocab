const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../frontend/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Color mappings
const colorMap = {
  'parchment': 'bg',
  'charcoal': 'text',
  'ochre': 'accent',
  'terracotta': 'danger',
  'borderline': 'border',
  // surface, muted, success remain the same
};

for (const [oldC, newC] of Object.entries(colorMap)) {
  const regex = new RegExp(`(text|bg|border|ring|shadow|fill|stroke)-${oldC}`, 'g');
  html = html.replace(regex, `$1-${newC}`);
}

// 2. Component mappings
const compMap = {
  'magnetic-btn': 'btn btn--primary',
  'ghost-underline-btn': 'btn btn--ghost',
  'aesthetic-input': 'input',
  'glass-card': 'card card--glass',
  'airy-row': 'row',
  'answer-btn': 'btn btn--study-answer',
  'ws-btn': 'btn btn--ws'
};

for (const [oldComp, newComp] of Object.entries(compMap)) {
  const regex = new RegExp(`\\b${oldComp}\\b`, 'g');
  html = html.replace(regex, newComp);
}

// 3. Motion class cleanup
// Find complex transition classes
html = html.replace(/transition-all\s+duration-\d+\s+ease-\[[^\]]+\]/g, 'motion-brand');
html = html.replace(/transition-transform\s+duration-\d+\s+ease-\[[^\]]+\]/g, 'motion-brand');
html = html.replace(/transition-all\s+duration-[a-z]+\s+var\(--ease[^\)]+\)/g, 'motion-state');
html = html.replace(/transition-colors\s+duration-\d+/g, 'motion-state');
html = html.replace(/transition-opacity\s+duration-\d+/g, 'motion-state');

// Replace standard transition tailwind classes when they are too generic
html = html.replace(/\btransition-all\b/g, 'motion-state');

fs.writeFileSync(htmlPath, html);
console.log('HTML refactored.');
