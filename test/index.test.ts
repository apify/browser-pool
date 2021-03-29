import BrowserPool from '../src/browser-pool';
import PuppeteerPlugin from '../src/puppeteer/puppeteer-plugin';
import PlaywrightPlugin from '../src/playwright/playwright-plugin';

import * as modules from '../src/index';

describe('Exports', () => {
    test('Modules', () => {
        expect(modules.BrowserPool).toEqual(BrowserPool);
        expect(modules.PuppeteerPlugin).toEqual(PuppeteerPlugin);
        expect(modules.PlaywrightPlugin).toEqual(PlaywrightPlugin);
    });
});
