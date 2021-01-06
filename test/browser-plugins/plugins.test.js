const puppeteer = require('puppeteer');
const playwright = require('playwright');

const PuppeteerPlugin = require('../../src/browser-plugins/puppeteer-plugin');
const PuppeteerController = require('../../src/browser-controllers/puppeteer-controller');

const PlaywrightPlugin = require('../../src/browser-plugins/playwright-plugin.js');
const PlaywrightController = require('../../src/browser-controllers/playwright-controller');

const runPluginTest = (Plugin, Controller, library) => {
    const plugin = new Plugin(library);

    describe(`${plugin.constructor.name} general `, () => {
        let browser;

        afterEach(async () => {
            if (browser) {
                await browser.close();
            }
        });

        test('should launch browser', async () => {
            browser = await plugin.launch();
            expect(typeof browser.newPage).toBe('function');
            expect(typeof browser.close).toBe('function');
        });

        test('should create launch context', () => {
            const id = 'abc';
            const launchOptions = { foo: 'bar' };
            const proxyUrl = 'http://proxy.com/';
            const context = plugin.createLaunchContext({
                id,
                launchOptions,
            });

            context.proxyUrl = proxyUrl;
            context.extend({
                one: 1,
            });
            expect(context).toMatchObject({
                id,
                launchOptions,
                browserPlugin: plugin,
                _proxyUrl: proxyUrl,
                one: 1,
            });
        });

        test('should create browser controller', () => {
            const browserController = plugin.createController();
            expect(browserController).toBeInstanceOf(Controller);
        });

        test('should pass launch options to browser', async () => {
            jest.spyOn(plugin.library, 'launch');
            const launchOptions = {
                foo: 'bar',
            };
            browser = await plugin.launch({ launchOptions });
            expect(plugin.library.launch).toHaveBeenCalledWith(launchOptions);
        });

        test('should work with cookies', async () => {
            const browserController = plugin.createController();
            const context = await plugin.createLaunchContext();
            browser = await plugin.launch(context);
            browserController.assignBrowser(browser, context);
            browserController.activate();

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
        let browser;

        afterEach(async () => {
            await browser.close();
        });

        test('should work with non authenticated proxyUrl', async () => {
            const proxyUrl = 'http://10.10.10.0:8080';
            const plugin = new PuppeteerPlugin(puppeteer);
            jest.spyOn(plugin, '_getAnonymizedProxyUrl');
            const context = await plugin.createLaunchContext({ proxyUrl });

            browser = await plugin.launch(context);
            const argWithProxy = context.launchOptions.args.find((arg) => arg.includes('--proxy-server='));

            expect(argWithProxy.includes(proxyUrl)).toBeTruthy();
            expect(plugin._getAnonymizedProxyUrl).not.toBeCalled(); // eslint-disable-line
        });

        test('should work with authenticated proxyUrl', async () => {
            const proxyUrl = 'http://apify1234@10.10.10.0:8080';
            const plugin = new PuppeteerPlugin(puppeteer);
            jest.spyOn(plugin, '_getAnonymizedProxyUrl');
            const context = await plugin.createLaunchContext({ proxyUrl });

            browser = await plugin.launch(context);
            const argWithProxy = context.launchOptions.args.find((arg) => arg.includes('--proxy-server='));

            expect(argWithProxy.includes(context.anonymizedProxyUrl)).toBeTruthy();
            expect(plugin._getAnonymizedProxyUrl).toBeCalled(); // eslint-disable-line
        });
    });

    runPluginTest(PuppeteerPlugin, PuppeteerController, puppeteer);

    describe('Playwright specifics', () => {
        let browserController;

        afterEach(async () => {
            await browserController.close();
        });
        test('should work with non authenticated proxyUrl', async () => {
            const proxyUrl = 'http://10.10.10.0:8080';
            const plugin = new PlaywrightPlugin(playwright.chromium);
            jest.spyOn(plugin, '_getAnonymizedProxyUrl');
            const context = await plugin.createLaunchContext({ proxyUrl });

            browserController = await plugin.launch(context);
            expect(context.launchOptions.proxy.server).toEqual(proxyUrl);
            expect(plugin._getAnonymizedProxyUrl).not.toBeCalled(); // eslint-disable-line
        });
        test('should work with authenticated proxyUrl', async () => {
            const proxyUrl = 'http://apify1234@10.10.10.0:8080';
            const plugin = new PlaywrightPlugin(playwright.chromium);
            jest.spyOn(plugin, '_getAnonymizedProxyUrl');
            const context = await plugin.createLaunchContext({ proxyUrl });

            browserController = await plugin.launch(context);
            expect(context.launchOptions.proxy.server).toEqual(context.anonymizedProxyUrl);
            expect(plugin._getAnonymizedProxyUrl).toBeCalled(); // eslint-disable-line
        });
    });

    runPluginTest(PlaywrightPlugin, PlaywrightController, playwright.chromium);
});
