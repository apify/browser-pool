const puppeteer = require('puppeteer');

const PuppeteerPlugin = require('../../src/browser-plugins/puppeteer-plugin');
const PuppeteerController = require('../../src/browser-controllers/puppeteer-controller');

describe('PuppeteerPlugin', () => {
    test('should launch browser', async () => {
        const puppeteerPlugin = new PuppeteerPlugin(puppeteer, {});

        const browserController = await puppeteerPlugin.launch();

        expect(browserController).toBeInstanceOf(PuppeteerController);

        expect(browserController.browser.newPage).toBeDefined();
    });

    test('should work with proxyUrl', async () => {
        const proxyUrl = 'http://10.10.10.0:8080';
        const puppeteerPlugin = new PuppeteerPlugin(puppeteer, { proxyUrl });
        const finalLaunchOptions = await puppeteerPlugin.createLaunchOptions();

        const browserController = await puppeteerPlugin.launch(finalLaunchOptions);
        const argWithProxy = finalLaunchOptions.args.find((arg) => arg.includes('--proxy-server='));

        expect(argWithProxy.includes('http://10.10.10.0:8080')).toBeTruthy();
        expect(browserController.proxyUrl).toEqual(proxyUrl);
    });

    test('should work with createProxyUrl', async () => {
        const proxyUrl = 'http://10.10.10.0:8080';
        const puppeteerPlugin = new PuppeteerPlugin(puppeteer, { createProxyUrlFunction: async () => Promise.resolve(proxyUrl) });
        const finalLaunchOptions = await puppeteerPlugin.createLaunchOptions();

        const browserController = await puppeteerPlugin.launch(finalLaunchOptions);
        const argWithProxy = finalLaunchOptions.args.find((arg) => arg.includes('--proxy-server='));

        expect(argWithProxy.includes('http://10.10.10.0:8080')).toBeTruthy();
        expect(browserController.proxyUrl).toEqual(proxyUrl);
    });
});
