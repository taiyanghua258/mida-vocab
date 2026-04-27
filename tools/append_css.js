const fs = require('fs');
const path = require('path');

const compCssPath = path.join(__dirname, '../frontend/css/components.css');
const studyCssPath = path.join(__dirname, '../frontend/css/study-card.css');

fs.appendFileSync(compCssPath, `
/* Modal floating feel */
.modal-overlay {
  opacity: 0; pointer-events: none;
  background-color: rgb(var(--c-text) / 0.15); /* Softer */
  transition: opacity var(--motion-normal) ease; 
}
.modal-overlay.active { opacity: 1; pointer-events: auto; }
.modal-content {
  transform: translateY(15px);
  opacity: 0;
  background: var(--glass-bg);
  border: var(--glass-border);
  box-shadow: 0 10px 40px rgb(var(--c-text) / 0.04);
  border-radius: var(--radius-modal);
  transition: transform var(--motion-slow) var(--ease-out-soft), opacity var(--motion-slow) var(--ease-out-soft); 
}
.modal-overlay.active .modal-content {
  transform: translateY(0);
  opacity: 1;
}

/* Toast paper feel */
.toast { 
  opacity: 0; transform: translateY(-8px); 
  transition: all var(--motion-normal) var(--ease-out-soft); 
  background: rgb(var(--c-surface)); 
  color: rgb(var(--c-text)); 
  border: 1px solid rgb(var(--c-border)); 
  box-shadow: 0 4px 16px rgba(0,0,0,0.03); /* Lighter shadow */
}
.toast.show { opacity: 1; transform: translateY(0); }
.toast.toast-success { border-left: 2px solid rgb(var(--c-success)); }
.toast.toast-error { border-left: 2px solid rgb(var(--c-danger)); }
.toast.toast-info { border-left: 2px solid rgb(var(--c-accent)); }

/* Workspace switch soft enter */
.workspace-switching #workspaceTransitionRoot {
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
  transition: opacity var(--motion-fast) ease, transform var(--motion-fast) ease;
}
body:not(.workspace-switching) #workspaceTransitionRoot {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
  transition: opacity var(--motion-normal) ease 50ms, transform var(--motion-normal) var(--ease-out-soft) 50ms;
}
`);

fs.appendFileSync(studyCssPath, `
/* Card Stack System (Phase 3) */
.study-stack {
  position: relative;
  width: 100%;
  height: 100%;
}
.study-card {
  position: absolute; width: 100%; height: 100%;
  border-radius: var(--radius-card); 
  background: rgb(var(--c-surface)); 
  border: var(--glass-border);
  display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 2rem;
  transform-origin: center center;
  transition: transform var(--motion-slow) var(--ease-study-card), opacity var(--motion-normal) ease, box-shadow var(--motion-slow) ease;
}
.study-card--front { 
  z-index: 2; cursor: pointer; 
  background: linear-gradient(135deg, rgb(var(--c-surface)) 0%, rgb(var(--c-surface-muted)) 100%); 
  box-shadow: 0 4px 20px rgb(var(--c-text) / 0.05); 
}
.study-card--back { 
  z-index: 1; 
  background: linear-gradient(145deg, rgb(var(--c-surface)), rgb(var(--c-surface-muted))); 
  transform: scale(0.97) translateY(4px); opacity: 1; 
  box-shadow: 0 4px 16px rgb(var(--c-text) / 0.06); 
}

/* Card physics */
.study-card.is-discarding-again { transform: translateY(20px) scale(0.9) !important; opacity: 0.3 !important; pointer-events: none; }
.study-card.is-discarding-hard { transform: translate(-40%, 10%) rotate(-5deg) scale(0.95) !important; opacity: 0 !important; pointer-events: none; }
.study-card.is-discarding-good { transform: translate(40%, -5%) rotate(5deg) scale(0.95) !important; opacity: 0 !important; pointer-events: none; }
.study-card.is-discarding-easy { transform: translateY(-30px) scale(1.05) !important; opacity: 0 !important; pointer-events: none; }
`);
