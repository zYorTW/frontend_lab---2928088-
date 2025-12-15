const fs = require('fs');
const path = require('path');

// Pre-build copy: overwrite public/env.js with public/env.prod.js
const srcProd = path.join(__dirname, '..', 'public', 'env.prod.js');
const destEnv = path.join(__dirname, '..', 'public', 'env.js');

console.log('Preparando configuración de producción (pre-build)...');
console.log('Origen:', srcProd);
console.log('Destino:', destEnv);

try {
  if (!fs.existsSync(srcProd)) {
    throw new Error('No se encontró public/env.prod.js');
  }
  fs.copyFileSync(srcProd, destEnv);
  console.log('✓ public/env.js sobrescrito con valores de producción');
} catch (error) {
  console.error('✗ Error preparando configuración de producción:', error.message);
  process.exit(1);
}
