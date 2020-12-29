const BrowserPool = require('../src/browser-pool');
const BrowserController = require('../src/abstract-classes/browser-controller');
const BrowserPlugin = require('../src/abstract-classes/browser-plugin');

const PuppeteerPlugin = require('../src/browser-plugins/puppeteer-plugin');
const PlaywrightPlugin = require('../src/browser-plugins/playwright-plugin.js');

const modules = require('../src/index');

describe('Exports', () => {
    test('Modules', () => {
        expect(modules.BrowserPool).toEqual(BrowserPool);

        expect(modules.PuppeteerPlugin).toEqual(PuppeteerPlugin);
        expect(modules.PlaywrightPlugin).toEqual(PlaywrightPlugin);

        expect(modules.BrowserController).toEqual(BrowserController);
        expect(modules.BrowserPlugin).toEqual(BrowserPlugin);
    });
});
