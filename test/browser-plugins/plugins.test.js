const puppeteer = require('puppeteer');
const playwright = require('playwright');

const PuppeteerPlugin = require('../../src/browser-plugins/puppeteer-plugin');
const PuppeteerController = require('../../src/browser-controllers/puppeteer-controller');

const PlaywrightPlugin = require('../../src/browser-plugins/playwright-plugin.js');
const PlaywrightController = require('../../src/browser-controllers/playwright-controller');

const BrowserControllerContext = require('../../src/browser-controller-context');

const runPluginTest = (Plugin, Controller, library) => {
    const plg = new Plugin(library)

    describe(`${plg.constructor.name} general `, () => {
        let browserController;

        afterEach(async () => {
            await browserController.kill();
        });

        test('should launch browser', async () => {
            const plugin = new Plugin(library, {});

            const context = await plugin.createBrowserControllerContext();
            browserController = await plugin.launch(context);

            expect(browserController).toBeInstanceOf(Controller);

            expect(browserController.browser.newPage).toBeDefined();
        });

        test('should launch  with custom context', async () => {
            const createContextFunction = async () => new BrowserControllerContext({ customOption: 'TEST' });
            const plugin = new Plugin(puppeteer, { createContextFunction });

            const context = await plugin.createBrowserControllerContext();
            browserController = await plugin.launch(context);
            expect(browserController.customOption).toBeDefined();
            expect(browserController.customOption).toBe('TEST');
        });

        test('should work with createContextFunction', async () => {
            const proxyUrl = 'http://10.10.10.0:8080';
            const plugin = new Plugin(
                library,
                {
                    createContextFunction: async () => Promise.resolve(new BrowserControllerContext({ proxyUrl: 'http://10.10.10.0:8080' })),
                },
            );
            const context = await plugin.createBrowserControllerContext();

            browserController = await plugin.launch(context);

            expect(browserController.proxyUrl).toEqual(proxyUrl);
        });

        test('should work with cookies', async () => {
            const plugin = new Plugin(library);
            const context = await plugin.createBrowserControllerContext();

            browserController = await plugin.launch(context);
            const page = await browserController.newPage();
            await browserController.setCookies(page, [{ name: 'TEST', value: 'TESTER-COOKIE', url: 'https://example.com' }]);
            await page.goto('https://example.com');

            const cookies = await browserController.getCookies(page);
            expect(cookies[0].name).toBe('TEST');
            expect(cookies[0].value).toBe('TESTER-COOKIE');
        });
    });
}
describe('Plugins', () => {

    describe('Puppeteer specifics', () => {
        let browserController;

        afterEach(async () => {
            await browserController.kill();
        });

        test('should work with proxyUrl', async () => {
            const proxyUrl = 'http://10.10.10.0:8080';
            const plugin = new PuppeteerPlugin(puppeteer, { proxyUrl });
            const context = await plugin.createBrowserControllerContext();

            browserController = await plugin.launch(context);
            const argWithProxy = context.pluginLaunchOptions.args.find((arg) => arg.includes('--proxy-server='));

            expect(argWithProxy.includes('http://10.10.10.0:8080')).toBeTruthy();
            expect(browserController.proxyUrl).toEqual(proxyUrl);
        });
    })

    runPluginTest(PuppeteerPlugin, PuppeteerController, puppeteer)

    describe('Playwright specifics', () => {
        let browserController;

        afterEach(async () => {
            await browserController.kill();
        });

        test('should work with proxyUrl', async () => {
            const proxyUrl = 'http://10.10.10.0:8080';
            const plugin = new PlaywrightPlugin(playwright.chromium, { proxyUrl });
            const context = await plugin.createBrowserControllerContext();

            browserController = await plugin.launch(context);
            expect(context.pluginLaunchOptions.proxy.server).toEqual(proxyUrl)
        });
    })

    runPluginTest(PlaywrightPlugin, PlaywrightController, playwright.chromium)
});
