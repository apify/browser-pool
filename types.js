const fs = require('fs');

fs.copyFileSync('./node_modules/puppeteer/lib/types.d.ts', './types/puppeteer/types.d.ts');
fs.copyFileSync('./node_modules/devtools-protocol/protocol.d.ts', './types/puppeteer/protocol.d.ts');
fs.copyFileSync('./node_modules/devtools-protocol/protocol-mapping.d.ts', './types/puppeteer/protocol-mapping.d.ts');
fs.copyFileSync('./node_modules/playwright/types/types.d.ts', './types/playwright/types.d.ts');
fs.copyFileSync('./node_modules/playwright/types/protocol.d.ts', './types/playwright/protocol.d.ts');
