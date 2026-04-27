const fs = require('fs');
const path = require('path');

console.log('Starting full repair...');

// --- 1. Fix index.html P0 ---
const htmlPath = path.join(__dirname, '../frontend/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// The regex replace earlier mangled the ids. Let's fix them explicitly:
html = html.replace('id="btn btn--ws-ja"', 'id="ws-btn-ja"');
html = html.replace('id="btn btn--ws-en"', 'id="ws-btn-en"');

// Fix the classes to have both old and new
html = html.replace('class="btn btn--ws btn btn--ws-active"', 'class="ws-btn ws-btn-active btn btn--ws btn--ws-active"');
html = html.replace('class="btn btn--ws btn btn--ws-inactive"', 'class="ws-btn ws-btn-inactive btn btn--ws btn--ws-inactive"');

fs.writeFileSync(htmlPath, html);
console.log('Fixed index.html P0 issues (workspace buttons).');

// --- 2. Fix legacy.css P0 (self-referencing CSS vars) ---
const legacyCssPath = path.join(__dirname, '../frontend/css/legacy.css');
let legacyCss = fs.readFileSync(legacyCssPath, 'utf8');

legacyCss = legacyCss.replace(/--ease-spring-soft:\s*var\(--ease-out-soft\);/g, '--ease-spring-soft: cubic-bezier(.2, .8, .2, 1);');
legacyCss = legacyCss.replace(/--ease-out-soft:\s*var\(--ease-out-soft\);/g, '--ease-out-soft: cubic-bezier(.33, 1, .68, 1);');
legacyCss = legacyCss.replace(/--ease-in-out:\s*var\(--ease-out-soft\);/g, '--ease-in-out: cubic-bezier(.65, 0, .35, 1);');

fs.writeFileSync(legacyCssPath, legacyCss);
console.log('Fixed legacy.css P0 issues (self-referencing cubic-beziers).');

// --- 3. Fix main.css P0 (CSS Cascade Order) ---
const mainCssPath = path.join(__dirname, '../frontend/css/main.css');
const correctMainCss = `@import 'tokens.css';
@import 'themes.css';
@import 'legacy.css'; /* Moved here so new components override legacy rules */
@import 'base.css';
@import 'components.css';
@import 'motion.css';
@import 'study-card.css';
@import 'utilities.css';
`;
fs.writeFileSync(mainCssPath, correctMainCss);
console.log('Fixed main.css P0 issues (import order).');

// --- 4. Fix tokens.css P1 (Missing Default Tokens) ---
const tokensCssPath = path.join(__dirname, '../frontend/css/tokens.css');
let tokensCss = fs.readFileSync(tokensCssPath, 'utf8');

if (!tokensCss.includes('--radius-sm:')) {
  // Inject into :root
  const missingTokens = `
  /* default component tokens */
  --radius-sm: 0.5rem;
  --radius-btn: 0.85rem;
  --radius-panel: 1.25rem;
  --radius-card: 1.5rem;
  --radius-modal: 2rem;
  --radius-pill: 100px;

  --shadow-sm: 0 4px 16px rgba(0, 0, 0, 0.03);
  --shadow-card: 0 10px 40px rgba(26, 47, 43, 0.04);
  --shadow-dropdown: 0 10px 40px rgba(26, 47, 43, 0.08);
  --shadow-modal: 0 12px 40px rgba(26, 47, 43, 0.12);

  --glass-bg: rgb(var(--c-surface));
  --glass-border: 1px solid rgb(var(--c-border));
  --modal-overlay-bg: rgb(var(--c-text) / 0.3);

  --word-font: var(--font-ui);
  --word-size: 3rem;
  --word-weight: 700;
  --word-tracking: -0.02em;
`;
  tokensCss = tokensCss.replace(/(:root\s*\{)/, `$1\n${missingTokens}`);
  fs.writeFileSync(tokensCssPath, tokensCss);
  console.log('Fixed tokens.css P1 issues (missing component variables).');
} else {
  console.log('tokens.css already has component variables.');
}

console.log('Full repair completed successfully.');
