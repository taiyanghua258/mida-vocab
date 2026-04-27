const fs = require('fs');
const path = require('path');

const cssDir = '/Users/chenchen/my-vocab/frontend/css';
const mainCssPath = path.join(cssDir, 'main.css');

let mainCss = fs.readFileSync(mainCssPath, 'utf8');

// The new token rules requested
const newTokens = `
:root {
  /* color: semantic, not material name only */
  --c-bg: 253 251 247;
  --c-surface: 255 255 255;
  --c-surface-muted: 249 247 241;
  --c-text: 26 47 43;
  --c-text-muted: 139 137 130;
  --c-border: 229 225 216;
  --c-accent: 223 159 40;
  --c-danger: 209 107 74;
  --c-success: 75 115 101;

  /* typography */
  --font-ui: "Inter", "Noto Sans JP", "Noto Sans SC", -apple-system, sans-serif;
  --font-display: "Playfair Display", "Shippori Mincho", "Noto Serif JP", serif;
  --font-reading: var(--font-ui);
  --font-brand: "Playfair Display", "Shippori Mincho", "Noto Serif JP", serif;
  --font-study-ja: "Noto Sans JP", "Shippori Mincho", sans-serif;
  --font-study-en: "Inter", "Playfair Display", sans-serif;
  --font-editorial: "Baskerville", "Georgia", "Shippori Mincho", "Noto Serif JP", serif;

  /* motion */
  --ease-standard: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-emphasized: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --motion-micro: 120ms;
  --motion-fast: 220ms;
  --motion-normal: 360ms;
  --motion-slow: 560ms;

  --ease-out-soft: cubic-bezier(.33, 1, .68, 1);
  --ease-spring-soft: cubic-bezier(.2, .8, .2, 1);
  --ease-study-card: cubic-bezier(.18, .89, .32, 1.12);
  
  --dur-1: 120ms;
  --dur-2: 220ms;
  --dur-3: 360ms;
  --dur-4: 560ms;
}
`;

const newThemes = `
[data-theme="parchment"] {
  --surface-treatment: soft-paper;
  --motion-density: normal;
  --radius-card: 1.5rem;
  --shadow-card: 0 10px 40px rgb(var(--c-text) / 0.04);
}
`;

// Also we should write out the files
fs.writeFileSync(path.join(cssDir, 'tokens.css'), newTokens + '\n/* Extracted Tokens */\n');
fs.writeFileSync(path.join(cssDir, 'themes.css'), newThemes + '\n/* Extracted Themes */\n');
fs.writeFileSync(path.join(cssDir, 'base.css'), '/* Extracted Base Styles */\n');
fs.writeFileSync(path.join(cssDir, 'components.css'), '/* Extracted Component Styles */\n');
fs.writeFileSync(path.join(cssDir, 'motion.css'), '/* Extracted Motion Styles */\n');
fs.writeFileSync(path.join(cssDir, 'study-card.css'), '/* Extracted Study Card Styles */\n');
fs.writeFileSync(path.join(cssDir, 'utilities.css'), '/* Extracted Utility Styles */\n');

// We will split the file manually since it's safer than regex, but we will output everything into main.css for now and use @imports
fs.writeFileSync(mainCssPath, \`@import 'tokens.css';
@import 'themes.css';
@import 'base.css';
@import 'components.css';
@import 'motion.css';
@import 'study-card.css';
@import 'utilities.css';

\` + mainCss);

console.log('Created CSS files structure.');
