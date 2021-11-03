const fs = require('fs');
const path = require('path');

fs.copyFileSync(
    path.join('src', 'puppeteer', 'puppeteer-proxy-per-page.d.ts'),
    path.join('dist', 'puppeteer', 'puppeteer-proxy-per-page.d.ts'),
);
