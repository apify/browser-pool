const puppeteer = require('puppeteer');
const playwright = require('playwright');
const fs = require('fs');

const PuppeteerPlugin = require('../../src/puppeteer/puppeteer-plugin');
const PuppeteerController = require('../../src/puppeteer/puppeteer-controller');

const PlaywrightPlugin = require('../../src/playwright/playwright-plugin.js');
const PlaywrightController = require('../../src/playwright/playwright-controller');
const PlaywrightBrowser = require('../../src/playwright/playwright-browser');

const log = require('../../src/logger');

const runPluginTest = (Plugin, Controller, library) => {
    let plugin = new Plugin(library);

    describe(`${plugin.constructor.name} - ${library.name ? library.name() : ''} general`, () => {
        let browser;
        beforeEach(() => {
            plugin = new Plugin(library);
        });
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

        test('should create userDatadir', async () => {
            plugin = new Plugin(library, {
                useIncognitoPages: false,
            });

            const context = await plugin.createLaunchContext();
            browser = await plugin.launch(context);

            expect(fs.existsSync(context.userDataDir)).toBeTruthy();
            await browser.close();
        });

        test('should get default launchContext values from plugin options', async () => {
            const proxyUrl = 'http://apify1234@10.10.10.0:8080/';
            plugin = new Plugin(library, {
                proxyUrl,
                userDataDir: 'test',
                useIncognitoPages: true,
            });
            jest.spyOn(plugin, '_getAnonymizedProxyUrl');
            const context = await plugin.createLaunchContext();
            expect(context.proxyUrl).toEqual(proxyUrl);
            expect(context.useIncognitoPages).toBeTruthy();
            expect(context.userDataDir).toEqual('test');
        });

        test('should create browser controller', () => {
            const browserController = plugin.createController();
            expect(browserController).toBeInstanceOf(Controller);
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

        test('should use persistent context by default', async () => {
            const plugin = new PuppeteerPlugin(puppeteer);
            const browserController = plugin.createController();

            const launchContext = plugin.createLaunchContext();

            browser = await plugin.launch(launchContext);
            browserController.assignBrowser(browser, launchContext);
            browserController.activate();

            const page = await browserController.newPage();
            const browserContext = page.browserContext();

            expect(browserContext.isIncognito()).toBeFalsy();
        });

        test('should use incognito pages by option', async () => {
            const plugin = new PuppeteerPlugin(puppeteer);
            const browserController = plugin.createController();

            const launchContext = plugin.createLaunchContext({ useIncognitoPages: true });

            browser = await plugin.launch(launchContext);
            browserController.assignBrowser(browser, launchContext);
            browserController.activate();

            const page = await browserController.newPage();
            const browserContext = page.browserContext();

            expect(browserContext.isIncognito()).toBeTruthy();
        });

        test('should pass launch options to browser', async () => {
            const plugin = new PuppeteerPlugin(puppeteer);

            jest.spyOn(plugin.library, 'launch');
            const launchOptions = {
                foo: 'bar',
            };
            const launchContext = plugin.createLaunchContext({ launchOptions });
            browser = await plugin.launch(launchContext);
            launchOptions.userDataDir = launchContext.userDataDir;
            expect(plugin.library.launch).toHaveBeenCalledWith(launchOptions);
        });
    });

    runPluginTest(PuppeteerPlugin, PuppeteerController, puppeteer);

    describe('Playwright specifics', () => {
        let browser;

        afterEach(async () => {
            await browser.close();
        });

        describe.each(['chromium', 'firefox'])('with %s', (browserName) => {
            test('should work with non authenticated proxyUrl', async () => {
                const proxyUrl = 'http://10.10.10.0:8080';
                const plugin = new PlaywrightPlugin(playwright[browserName]);
                jest.spyOn(plugin, '_getAnonymizedProxyUrl');
                const context = await plugin.createLaunchContext({ proxyUrl });

                browser = await plugin.launch(context);
                expect(context.launchOptions.proxy.server).toEqual(proxyUrl);
                expect(plugin._getAnonymizedProxyUrl).not.toBeCalled(); // eslint-disable-line
            });

            test('should work with authenticated proxyUrl', async () => {
                const proxyUrl = 'http://apify1234@10.10.10.0:8080';
                const plugin = new PlaywrightPlugin(playwright[browserName]);
                jest.spyOn(plugin, '_getAnonymizedProxyUrl');
                const context = await plugin.createLaunchContext({ proxyUrl });

                browser = await plugin.launch(context);
                expect(context.launchOptions.proxy.server).toEqual(context.anonymizedProxyUrl);
            expect(plugin._getAnonymizedProxyUrl).toBeCalled(); // eslint-disable-line
            });

            test('should use icognito context by option', async () => {
                const plugin = new PlaywrightPlugin(playwright[browserName]);
                const browserController = plugin.createController();

                const launchContext = plugin.createLaunchContext({ useIncognitoPages: true });

                browser = await plugin.launch(launchContext);
                browserController.assignBrowser(browser, launchContext);
                browserController.activate();

                const page = await browserController.newPage();
                const browserContext = page.context();
                await browserController.newPage();

                expect(browserContext.pages()).toHaveLength(1);
            });

            test('should use persistent context by default', async () => {
                jest.setTimeout(30000);

                const plugin = new PlaywrightPlugin(playwright[browserName]);
                const browserController = plugin.createController();

                const launchContext = plugin.createLaunchContext();

                browser = await plugin.launch(launchContext);
                browserController.assignBrowser(browser, launchContext);
                browserController.activate();

                const page = await browserController.newPage();
                const context = await page.context();
                await browserController.newPage();

                expect(context.pages()).toHaveLength(3);
            });

            test('should pass launch options to browser', async () => {
                const plugin = new PlaywrightPlugin(playwright[browserName]);

                jest.spyOn(plugin.library, 'launch');
                const launchOptions = {
                    foo: 'bar',
                };
                const launchContext = plugin.createLaunchContext({ launchOptions, useIncognitoPages: true });
                browser = await plugin.launch(launchContext);
                expect(plugin.library.launch).toHaveBeenCalledWith(launchOptions);
            });
            describe('PlaywrighBrowser', () => {
                test('should create new page', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);

                    const launchContext = plugin.createLaunchContext();
                    browser = await plugin.launch(launchContext);
                    const page = await browser.newPage();

                    expect(page.close).toBeDefined();
                });

                test('should emit disconnnected event on close', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);

                    const launchContext = plugin.createLaunchContext();
                    browser = await plugin.launch(launchContext);
                    let called = false;

                    browser.on('disconnected', () => {
                        called = true;
                    });

                    await browser.close();

                    expect(called).toBeTruthy();
                });

                test('should be used only with incognito pages context', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);

                    const launchContext = plugin.createLaunchContext({ useIncognitoPages: false });
                    browser = await plugin.launch(launchContext);
                    expect(browser).toBeInstanceOf(PlaywrightBrowser);

                    await browser.close();

                    const launchContext2 = plugin.createLaunchContext({ useIncognitoPages: true });
                    browser = await plugin.launch(launchContext2);
                    expect(browser).not.toBeInstanceOf(PlaywrightBrowser);
                });

                test('should return correct version', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);

                    const launchContext = plugin.createLaunchContext({ useIncognitoPages: false });
                    browser = await plugin.launch(launchContext);
                    const version1 = browser.version();

                    await browser.close();

                    const launchContext2 = plugin.createLaunchContext({ useIncognitoPages: true });
                    browser = await plugin.launch(launchContext2);
                    expect(version1).toEqual(browser.version());
                });

                test('should return all contexts', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);

                    const launchContext = plugin.createLaunchContext();
                    browser = await plugin.launch(launchContext);
                    const contexts = browser.contexts();
                    expect(contexts).toHaveLength(1);
                    expect(contexts[0]).toEqual(browser.browserContext);
                });

                test('should return correct connected status', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);

                    const launchContext = plugin.createLaunchContext();
                    browser = await plugin.launch(launchContext);
                    expect(browser.isConnected()).toBeTruthy();

                    await browser.close();

                    expect(browser.isConnected()).toBeFalsy();
                });

                test('should return old context as new context and log error', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);
                    jest.spyOn(log, 'error');
                    const launchContext = plugin.createLaunchContext();
                    browser = await plugin.launch(launchContext);
                    const context = await browser.newContext();

                    expect(context).toEqual(browser.contexts()[0]);
                    expect(log.error).toBeCalledWith('Could not call `newContext()` on browser, when `useIncognitoPages` is set to `false`');
                });

                test('should have same public interface as playwright browserType', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);
                    const originalFunctionNames = ['close', 'contexts', 'isConnected', 'newContext', 'newPage', 'version'];
                    const launchContext = plugin.createLaunchContext({ useIncognitoPages: true });
                    browser = await plugin.launch(launchContext);

                    for (const originalFunctionName of originalFunctionNames) {
                        expect(browser[originalFunctionName]).toBeDefined();
                    }

                    expect.hasAssertions();
                });
            });
        });
    });

    runPluginTest(PlaywrightPlugin, PlaywrightController, playwright.chromium);
    runPluginTest(PlaywrightPlugin, PlaywrightController, playwright.firefox);
});
