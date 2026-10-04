import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Kronos Atelier Frontend Architecture & Data Separation Tests', () => {
  it('1. Verifies frontend code never contains backend secrets or database credentials', () => {
    const frontendFiles = [
      path.resolve(process.cwd(), 'src', 'App.tsx'),
      path.resolve(process.cwd(), 'src', 'services', 'apiClient.ts'),
      path.resolve(process.cwd(), 'src', 'components', 'AdminConsole.tsx'),
      path.resolve(process.cwd(), 'src', 'components', 'ProductImage.tsx'),
    ];

    for (const file of frontendFiles) {
      const content = fs.readFileSync(file, 'utf8');
      assert.equal(
        content.includes('node:sqlite'),
        false,
        `Frontend file ${file} must not import node:sqlite directly`
      );
      assert.equal(
        content.includes('JWT_SECRET'),
        false,
        `Frontend file ${file} must not reference JWT_SECRET`
      );
      assert.equal(
        content.includes('private.key'),
        false,
        `Frontend file ${file} must not reference private keys`
      );
    }
  });

  it('2. Verifies ProductImage component enforces referrerPolicy="no-referrer" and fallback', () => {
    const imgFile = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'components', 'ProductImage.tsx'),
      'utf8'
    );
    assert.ok(imgFile.includes('referrerPolicy="no-referrer"'));
    assert.ok(imgFile.includes('onError'));
  });

  it('3. Verifies Top Bar Contract and REST API communication in App.tsx', () => {
    const appFile = fs.readFileSync(path.resolve(process.cwd(), 'src', 'App.tsx'), 'utf8');
    assert.ok(appFile.includes('Kronos Atelier'));
    assert.ok(appFile.includes('apiClient.getProducts'));
    assert.ok(appFile.includes('apiClient.createOrder'));
  });
});
