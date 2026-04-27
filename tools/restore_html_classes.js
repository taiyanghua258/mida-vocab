const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '../frontend/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const restoreMap = {
  'btn btn--primary': 'magnetic-btn btn btn--primary',
  'btn btn--ghost': 'ghost-underline-btn btn btn--ghost',
  'input': 'aesthetic-input input',
  'card card--glass': 'glass-card card card--glass',
  'row': 'airy-row row',
  'btn btn--study-answer': 'answer-btn btn btn--study-answer'
};

for (const [newComp, restored] of Object.entries(restoreMap)) {
  html = html.split(newComp).join(restored);
  const oldClass = restored.split(' ')[0];
  html = html.split(`${oldClass} ${oldClass}`).join(oldClass);
}

// Ensure ws-btn is not double replaced
html = html.replace(/ws-btn\s+ws-btn\s+ws-btn-active/g, 'ws-btn ws-btn-active');
html = html.replace(/ws-btn\s+ws-btn\s+ws-btn-inactive/g, 'ws-btn ws-btn-inactive');

fs.writeFileSync(htmlPath, html);
console.log('Restored old component classes in index.html to stop visual bugs.');
