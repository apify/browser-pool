const puppeteer = require('puppeteer');

const PuppeteerPlugin = require('../../src/browser-plugins/puppeteer-plugin');
const PuppeteerController = require('../../src/browser-controllers/puppeteer-controller');
const BrowserControllerContext = require('../../src/abstract-classes/browser-controlller-context');

describe('PuppeteerPlugin', () => {
    let browserController;

    afterEach(async () => {
        await browserController.kill();
    });

    test('should launch browser', async () => {
        const puppeteerPlugin = new PuppeteerPlugin(puppeteer, {});

        const context = await puppeteerPlugin.createBrowserControllerContext();
        browserController = await puppeteerPlugin.launch(context);

        expect(browserController).toBeInstanceOf(PuppeteerController);

        expect(browserController.browser.newPage).toBeDefined();
    });

    test('should work with proxyUrl', async () => {
        const proxyUrl = 'http://10.10.10.0:8080';
        const puppeteerPlugin = new PuppeteerPlugin(puppeteer, { proxyUrl });
        const context = await puppeteerPlugin.createBrowserControllerContext();

        browserController = await puppeteerPlugin.launch(context);
        const argWithProxy = context.pluginLaunchOptions.args.find((arg) => arg.includes('--proxy-server='));

        expect(argWithProxy.includes('http://10.10.10.0:8080')).toBeTruthy();
        expect(browserController.proxyUrl).toEqual(proxyUrl);
    });

    test('should work with createContextFunction', async () => {
        const proxyUrl = 'http://10.10.10.0:8080';
        const puppeteerPlugin = new PuppeteerPlugin(
            puppeteer,
            {
                createContextFunction: async () => Promise.resolve(new BrowserControllerContext({ proxyUrl: 'http://10.10.10.0:8080' })),
            },
        );
        const context = await puppeteerPlugin.createBrowserControllerContext();

        browserController = await puppeteerPlugin.launch(context);
        const argWithProxy = context.pluginLaunchOptions.args.find((arg) => arg.includes('--proxy-server='));

        expect(argWithProxy.includes('http://10.10.10.0:8080')).toBeTruthy();
        expect(browserController.proxyUrl).toEqual(proxyUrl);
    });

    test('should work with cookies', async () => {
        const puppeteerPlugin = new PuppeteerPlugin(puppeteer);
        const context = await puppeteerPlugin.createBrowserControllerContext();

        browserController = await puppeteerPlugin.launch(context);
        const page = await browserController.newPage();
        await browserController.setCookies(page, [{ name: 'TEST', value: 'TESTER-COOKIE', domain: 'example.com' }]);
        await page.goto('https://example.com');

        const cookies = await browserController.getCookies(page);
        expect(cookies[0].name).toBe('TEST');
        expect(cookies[0].value).toBe('TESTER-COOKIE');
    });
});
