const BrowserPool = require('../src/browser-pool');
const PuppeteerPlugin = require('../src/puppeteer/puppeteer-plugin');
const PlaywrightPlugin = require('../src/playwright/playwright-plugin');

const modules = require('../src/index');

describe('Exports', () => {
    test('Modules', () => {
        expect(modules.BrowserPool).toEqual(BrowserPool);
        expect(modules.PuppeteerPlugin).toEqual(PuppeteerPlugin);
        expect(modules.PlaywrightPlugin).toEqual(PlaywrightPlugin);
    });
});
