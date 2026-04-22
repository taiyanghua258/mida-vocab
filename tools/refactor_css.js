const fs = require('fs');

const cssPath = '/Users/chenchen/my-vocab/frontend/css/main.css';
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Inject root design tokens into :root
const rootTokens = `
      /* Design System Tokens - The Million Dollar Foundation */
      --radius-sm: 0.5rem;
      --radius-btn: 0.85rem;
      --radius-panel: 1.25rem;
      --radius-card: 1.5rem;
      --radius-modal: 2rem;
      
      --shadow-sm: 0 4px 16px rgba(0, 0, 0, 0.03);
      --shadow-card: 0 10px 40px rgba(26, 47, 43, 0.04);
      --shadow-dropdown: 0 10px 40px rgba(26, 47, 43, 0.08);
      --shadow-modal: 0 12px 40px rgba(26, 47, 43, 0.12);
      
      --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
      --ease-fluid: cubic-bezier(0.2, 0.8, 0.2, 1);
      --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
      
      --glass-bg: rgb(var(--color-surface));
      --glass-border: 1px solid rgb(var(--color-borderline) / 0.6);
      --modal-overlay-bg: rgb(var(--color-charcoal) / 0.3);
`;

css = css.replace(/--font-display: var\(--font-serif\);/, '--font-display: var(--font-serif);' + rootTokens);

// 2. Inject obsidian tokens
const obsidianTokens = `
      --shadow-sm: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 10px rgba(0,0,0,0.5);
      --shadow-card: inset 0 1px 0 rgba(255,255,255,0.05), 0 25px 50px -12px rgba(0,0,0,0.7);
      --shadow-dropdown: 0 12px 40px rgba(0,0,0,0.8);
      --shadow-modal: 0 12px 40px rgba(0,0,0,0.8);
      --glass-bg: #121214;
      --glass-border: 1px solid rgba(255, 255, 255, 0.1);
      --modal-overlay-bg: rgba(0, 0, 0, 0.6);
`;

css = css.replace(/-moz-osx-font-smoothing: grayscale;/, '-moz-osx-font-smoothing: grayscale;' + obsidianTokens);

// 3. Inject editorial tokens
const editorialTokens = `
      --radius-sm: 0;
      --radius-btn: 0;
      --radius-panel: 0;
      --radius-card: 0;
      --radius-modal: 0;
      
      --shadow-sm: none;
      --shadow-card: none;
      --shadow-dropdown: none;
      --shadow-modal: none;
      
      --glass-bg: transparent;
      --glass-border: 1px solid rgba(20, 20, 20, 0.15);
      --modal-overlay-bg: rgba(20, 20, 20, 0.8);
`;

css = css.replace(/--word-tracking: -0\.06em;/, '--word-tracking: -0.06em;' + editorialTokens);

// 4. Clean up dirty obsidian overrides
css = css.replace(/\[data-theme="obsidian"\] \.paper-card,[\s\S]*?border: 1px solid rgba\(255,255,255,0\.1\) !important;\n    }/, '');
css = css.replace(/\[data-theme="obsidian"\] \.modal-overlay \{[\s\S]*?\}/, '');

// 5. Replace magic curves with variables
css = css.replace(/cubic-bezier\(0\.34,\s*1\.56,\s*0\.64,\s*1\)/g, 'var(--ease-spring)');
css = css.replace(/cubic-bezier\(0\.2,\s*0\.8,\s*0\.2,\s*1\)/g, 'var(--ease-fluid)');
css = css.replace(/cubic-bezier\(0\.4,\s*0,\s*0\.2,\s*1\)/g, 'var(--ease-in-out)');

// 6. Update glass-card to use tokens
css = css.replace(/\.glass-card \{[\s\S]*?transition: transform/g, `.glass-card {
  background: var(--glass-bg);
  border: var(--glass-border);
  box-shadow: var(--shadow-sm);
  border-radius: var(--radius-panel);
  transition: transform`);

// 7. Update paper-card to use tokens
css = css.replace(/\.paper-card \{[\s\S]*?border-radius: 1\.5rem;/g, `.paper-card {
  position: absolute; width: 100%; height: 100%;
  border-radius: var(--radius-card);`);
css = css.replace(/border: 1px solid rgb\(var\(--color-borderline\) \/ 0\.6\);/g, 'border: var(--glass-border);');

// 8. Replace modal content styling
css = css.replace(/\.modal-content \{[\s\S]*?opacity: 0;/g, `.modal-content {
  transform: scale(0.96) translateY(10px);
  opacity: 0;
  background: var(--glass-bg);
  border: var(--glass-border);
  box-shadow: var(--shadow-modal);
  border-radius: var(--radius-modal);`);

css = css.replace(/\.modal-overlay \{[\s\S]*?transition: opacity 0\.35s ease;/g, `.modal-overlay {
  opacity: 0; pointer-events: none; backdrop-filter: blur(4px);
  background-color: var(--modal-overlay-bg);
  transition: opacity 0.35s ease;`);

// 9. Remove brutalist !important rules from editorial
css = css.replace(/\/\* 1\. 彻底粉碎主页所有导致“杂乱”的容器边框、色块与圆角 \*\/[\s\S]*?border-radius: 0 !important;\n      box-shadow: none !important;\n    \}/, '');
css = css.replace(/\[data-theme="editorial"\] \.modal-content \{[\s\S]*?\}/, '');

// Clean up more editorial brutalist rules
css = css.replace(/\[data-theme="editorial"\] main \.bg-surface,[\s\S]*?box-shadow: none !important;\n    \}/, '');

fs.writeFileSync(cssPath, css);
console.log('CSS refactored with strict tokens.');
