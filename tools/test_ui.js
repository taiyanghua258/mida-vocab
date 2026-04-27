const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert');

test('UI Component Structure Smoke Test', async (t) => {
  const htmlPath = path.join(__dirname, '../frontend/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  await t.test('Should not contain old material color tailwind classes (e.g. bg-parchment)', () => {
    assert.strictEqual(html.includes('bg-parchment'), false, 'Found old bg-parchment class');
    assert.strictEqual(html.includes('text-charcoal'), false, 'Found old text-charcoal class');
    assert.strictEqual(html.includes('text-ochre'), false, 'Found old text-ochre class');
    assert.strictEqual(html.includes('border-terracotta'), false, 'Found old border-terracotta class');
  });

  await t.test('Should contain semantic tailwind classes', () => {
    assert.ok(html.includes('bg-bg'), 'Missing bg-bg class');
    assert.ok(html.includes('text-text'), 'Missing text-text class');
    assert.ok(html.includes('text-accent'), 'Missing text-accent class');
  });

  await t.test('Should have properly componentized buttons', () => {
    assert.ok(html.includes('btn btn--primary'), 'Missing primary button class');
    assert.ok(html.includes('btn btn--ws'), 'Missing workspace switch button class');
  });

  await t.test('Should not have excessive inline tailwind transition bezier curves', () => {
    assert.strictEqual(html.includes('ease-[cubic-bezier'), false, 'Found hardcoded cubic-bezier in HTML classes');
  });
});
