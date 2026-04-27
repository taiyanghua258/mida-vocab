const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../frontend/css/legacy.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Replace material variable usages with semantic variable usages
const map = {
  '--color-parchment': '--c-bg',
  '--color-surface': '--c-surface',
  '--color-charcoal': '--c-text',
  '--color-ochre': '--c-accent',
  '--color-terracotta': '--c-danger',
  '--color-muted': '--c-text-muted',
  '--color-borderline': '--c-border',
  '--color-success': '--c-success',
  '--bg-body': '--c-bg',
  '--duration-micro': '--motion-micro',
  '--duration-fast': '--motion-fast',
  '--duration-normal': '--motion-normal',
  '--duration-slow': '--motion-slow',
  '--ease-spring': '--ease-spring-soft',
  '--ease-fluid': '--ease-out-soft'
};

for (const [oldVar, newVar] of Object.entries(map)) {
  css = css.replace(new RegExp(oldVar, 'g'), newVar);
}

// Remove hardcoded bezier curves
css = css.replace(/cubic-bezier\([^)]+\)/g, 'var(--ease-out-soft)');

fs.writeFileSync(cssPath, css);
console.log('Legacy CSS cleaned.');
