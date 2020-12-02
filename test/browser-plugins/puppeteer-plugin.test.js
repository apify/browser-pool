const puppeteer = require('puppeteer');

const PuppeteerPlugin = require('../../src/browser-plugins/puppeteer-plugin');
const PuppeteerController = require('../../src/browser-controllers/puppeteer-controller');

describe('PuppeteerPlugin', () => {
    let browserController;

    afterEach(async () => {
        await browserController.kill();
    });

    test('should launch browser', async () => {
        const puppeteerPlugin = new PuppeteerPlugin(puppeteer, {});

        browserController = await puppeteerPlugin.launch();

        expect(browserController).toBeInstanceOf(PuppeteerController);

        expect(browserController.browser.newPage).toBeDefined();
    });

    test('should work with proxyUrl', async () => {
        const proxyUrl = 'http://10.10.10.0:8080';
        const puppeteerPlugin = new PuppeteerPlugin(puppeteer, { proxyUrl });
        const finalLaunchOptions = await puppeteerPlugin.createLaunchOptions();

        browserController = await puppeteerPlugin.launch(finalLaunchOptions);
        const argWithProxy = finalLaunchOptions.args.find((arg) => arg.includes('--proxy-server='));

        expect(argWithProxy.includes('http://10.10.10.0:8080')).toBeTruthy();
        expect(browserController.proxyUrl).toEqual(proxyUrl);
    });

    test('should work with createProxyUrl', async () => {
        const proxyUrl = 'http://10.10.10.0:8080';
        const puppeteerPlugin = new PuppeteerPlugin(puppeteer, { createProxyUrlFunction: async () => Promise.resolve(proxyUrl) });
        const finalLaunchOptions = await puppeteerPlugin.createLaunchOptions();

        browserController = await puppeteerPlugin.launch(finalLaunchOptions);
        const argWithProxy = finalLaunchOptions.args.find((arg) => arg.includes('--proxy-server='));

        expect(argWithProxy.includes('http://10.10.10.0:8080')).toBeTruthy();
        expect(browserController.proxyUrl).toEqual(proxyUrl);
    });

    test('should work with cookies', async () => {
        const puppeteerPlugin = new PuppeteerPlugin(puppeteer);
        const finalLaunchOptions = await puppeteerPlugin.createLaunchOptions();

        browserController = await puppeteerPlugin.launch(finalLaunchOptions);
        const page = await browserController.newPage();
        await browserController.setCookies(page, [{ name: 'TEST', value: 'TESTER-COOKIE', domain: 'example.com' }]);
        await page.goto('https://example.com');

        const cookies = await browserController.getCookies(page);
        expect(cookies[0].name).toBe('TEST');
        expect(cookies[0].value).toBe('TESTER-COOKIE');
    });
});
