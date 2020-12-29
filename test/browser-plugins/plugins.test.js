const puppeteer = require('puppeteer');
const playwright = require('playwright');

const PuppeteerPlugin = require('../../src/browser-plugins/puppeteer-plugin');
const PuppeteerController = require('../../src/browser-controllers/puppeteer-controller');

const PlaywrightPlugin = require('../../src/browser-plugins/playwright-plugin.js');
const PlaywrightController = require('../../src/browser-controllers/playwright-controller');

const runPluginTest = (Plugin, Controller, library) => {
    const plg = new Plugin(library);

    describe(`${plg.constructor.name} general `, () => {
        let browserController;

        afterEach(async () => {
            await browserController.close();
        });

        test('should launch browser', async () => {
            const plugin = new Plugin(library, {});

            const context = await plugin.createLaunchContext();
            browserController = await plugin.launch(context);

            expect(browserController).toBeInstanceOf(Controller);

            expect(browserController.browser.newPage).toBeDefined();
        });

        test('should launch  with custom context', async () => {
            const plugin = new Plugin(puppeteer);

            const context = await plugin.createLaunchContext();
            context.customOption = 'TEST';
            browserController = await plugin.launch(context);
            expect(browserController.launchContext).toBeDefined();
            expect(browserController.launchContext.customOption).toBe('TEST');
        });
        test('should work with cookies', async () => {
            const plugin = new Plugin(library);
            const context = await plugin.createLaunchContext();

            browserController = await plugin.launch(context);
            const page = await browserController.newPage();
            await browserController.setCookies(page, [{ name: 'TEST', value: 'TESTER-COOKIE', url: 'https://example.com' }]);
            await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

            const cookies = await browserController.getCookies(page);
            expect(cookies[0].name).toBe('TEST');
            expect(cookies[0].value).toBe('TESTER-COOKIE');
        });
    });
};
describe('Plugins', () => {
    describe('Puppeteer specifics', () => {
        let browserController;

        afterEach(async () => {
            await browserController.close();
        });

        test('should work with proxyUrl', async () => {
            const proxyUrl = 'http://10.10.10.0:8080';
            const plugin = new PuppeteerPlugin(puppeteer);
            const context = await plugin.createLaunchContext({ proxyUrl });

            browserController = await plugin.launch(context);
            const argWithProxy = context.launchOptions.args.find((arg) => arg.includes('--proxy-server='));

            expect(argWithProxy.includes('http://10.10.10.0:8080')).toBeTruthy();
            expect(browserController.launchContext.proxyUrl).toEqual(proxyUrl);
        });
    });

    runPluginTest(PuppeteerPlugin, PuppeteerController, puppeteer);

    describe('Playwright specifics', () => {
        let browserController;

        afterEach(async () => {
            await browserController.close();
        });

        test('should work with proxyUrl', async () => {
            const proxyUrl = 'http://10.10.10.0:8080';
            const plugin = new PlaywrightPlugin(playwright.chromium);
            const context = await plugin.createLaunchContext({ proxyUrl });

            browserController = await plugin.launch(context);
            expect(context.launchOptions.proxy.server).toEqual(proxyUrl);
        });
    });

    runPluginTest(PlaywrightPlugin, PlaywrightController, playwright.chromium);
});
