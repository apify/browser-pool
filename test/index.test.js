const BrowserPool = require('../src/browser-pool');
const PuppeteerPlugin = require('../src/browser-plugins/puppeteer-plugin');
const PlaywrightPlugin = require('../src/browser-plugins/playwright-plugin.js');
const EVENTS = require('../src/events');

const modules = require('../src/index');

describe('Exports', () => {
    test('Modules', () => {
        expect(modules.BrowserPool).toEqual(BrowserPool);
        expect(modules.PuppeteerPlugin).toEqual(PuppeteerPlugin);
        expect(modules.PlaywrightPlugin).toEqual(PlaywrightPlugin);
        expect(modules.EVENTS).toEqual(EVENTS);
    });
});
