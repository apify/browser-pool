const fs = require('fs');

fs.mkdirSync('./types/playwright', { recursive: true });
fs.mkdirSync('./types/puppeteer', { recursive: true });

fs.copyFileSync('./node_modules/puppeteer/lib/types.d.ts', './types/puppeteer/types.d.ts');
fs.copyFileSync('./node_modules/devtools-protocol/types/protocol.d.ts', './types/puppeteer/protocol.d.ts');
fs.copyFileSync('./node_modules/devtools-protocol/types/protocol-mapping.d.ts', './types/puppeteer/protocol-mapping.d.ts');
fs.copyFileSync('./node_modules/playwright/types/types.d.ts', './types/playwright/types.d.ts');
fs.copyFileSync('./node_modules/playwright/types/protocol.d.ts', './types/playwright/protocol.d.ts');
fs.copyFileSync('./node_modules/playwright/types/structs.d.ts', './types/playwright/structs.d.ts');

fs.writeFileSync('./types/puppeteer.d.ts', `
declare module 'puppeteer' {
    export * from './puppeteer/types.d.ts';
}
`.trimStart());

fs.writeFileSync('./types/playwright.d.ts', `
declare module 'playwright' {
    export * from './playwright/types.d.ts';
}
`.trimStart());
