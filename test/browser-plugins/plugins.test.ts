import puppeteer from 'puppeteer';
import playwright from 'playwright';
import fs from 'fs';

import BrowserPlugin, { Launcher } from '../../src/abstract-classes/browser-plugin';
import BrowserController from '../../src/abstract-classes/browser-controller';

import PuppeteerPlugin from '../../src/puppeteer/puppeteer-plugin';
import PuppeteerController from '../../src/puppeteer/puppeteer-controller';

import PlaywrightPlugin from '../../src/playwright/playwright-plugin';
import PlaywrightController from '../../src/playwright/playwright-controller';
import Browser from '../../src/playwright/browser';
import LaunchContext from '../../src/launch-context';

jest.setTimeout(120000);

const runPluginTest = <A extends typeof BrowserPlugin, B extends typeof BrowserController, C extends Launcher>(Plugin: A, Controller: B, library: C) => {
    let plugin = new Plugin(library);

    describe(`${plugin.constructor.name} - ${library.name ? library.name() : ''} general`, () => {
        let browser: BrowserController<any, any, any, any, any>;

        beforeEach(() => {
            plugin = new Plugin(library);
        });
        afterEach(async () => {
            if (browser) {
                await browser.close();
            }
        });

        test('should launch browser', async () => {
            browser = await plugin.launch() as any;
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

            expect(context).toBeInstanceOf(LaunchContext);

            context.proxyUrl = proxyUrl;
            context.extend({
                one: 1,
            });

            const desiredObject = {
                id,
                launchOptions,
                browserPlugin: plugin,
                _proxyUrl: proxyUrl,
                one: 1,
                useIncognitoPages: false,
            };

            // expect(context).toMatchObject(desiredObject)
            // Switch to this after the issue with `TypeError: prop.startsWith is not a function` is solved.

            expect(context.id).toEqual(desiredObject.id);
            expect(context.launchOptions).toEqual(desiredObject.launchOptions);
            expect(context.browserPlugin).toEqual(desiredObject.browserPlugin);
            expect((context as any)._proxyUrl).toEqual(desiredObject._proxyUrl); // eslint-disable-line
            expect((context as any).one).toEqual(desiredObject.one);
            expect(context.useIncognitoPages).toEqual(desiredObject.useIncognitoPages);
        });

        test('should create userDatadir', async () => {
            plugin = new Plugin(library, {
                useIncognitoPages: false,
            });

            const context = plugin.createLaunchContext();
            browser = await plugin.launch(context) as any;

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
            const context = plugin.createLaunchContext();
            browser = await plugin.launch(context) as any;
            browserController.assignBrowser(browser, context);
            browserController.activate();

            const page = await browserController.newPage();
            await browserController.setCookies(page, [{ name: 'TEST', value: 'TESTER-COOKIE', url: 'https://example.com' }]);
            await (page as any).goto('https://example.com', { waitUntil: 'domcontentloaded' });

            const cookies = await browserController.getCookies(page);
            expect(cookies[0].name).toBe('TEST');
            expect(cookies[0].value).toBe('TESTER-COOKIE');
        });
    });
};
describe('Plugins', () => {
    describe('Puppeteer specifics', () => {
        let browser: puppeteer.Browser;

        afterEach(async () => {
            await browser.close();
        });

        test('should work with non authenticated proxyUrl', async () => {
            const proxyUrl = 'http://10.10.10.0:8080';
            const plugin = new PuppeteerPlugin(puppeteer as any);
            jest.spyOn(plugin, '_getAnonymizedProxyUrl');
            const context = await plugin.createLaunchContext({ proxyUrl });

            browser = await plugin.launch(context) as any;
            const argWithProxy = context.launchOptions?.args?.find((arg) => arg.includes('--proxy-server='));

            expect(argWithProxy?.includes(proxyUrl)).toBeTruthy();
            expect(plugin._getAnonymizedProxyUrl).not.toBeCalled(); // eslint-disable-line
        });

        test('should work with authenticated proxyUrl', async () => {
            const proxyUrl = 'http://apify1234@10.10.10.0:8080';
            const plugin = new PuppeteerPlugin(puppeteer as any);
            jest.spyOn(plugin, '_getAnonymizedProxyUrl');
            const context = plugin.createLaunchContext({ proxyUrl });

            browser = await plugin.launch(context) as any;
            const argWithProxy = context.launchOptions?.args?.find((arg) => arg.includes('--proxy-server='));

            expect(argWithProxy?.includes(context?.anonymizedProxyUrl as any)).toBeTruthy();
            expect(plugin._getAnonymizedProxyUrl).toBeCalled(); // eslint-disable-line
        });

        test('should use persistent context by default', async () => {
            const plugin = new PuppeteerPlugin(puppeteer as any);
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
            const launchOptions: Record<string, any> = {
                foo: 'bar',
            };
            const launchContext = plugin.createLaunchContext({ launchOptions });
            browser = await plugin.launch(launchContext);
            launchOptions.userDataDir = launchContext.userDataDir;
            expect(plugin.library.launch).toHaveBeenCalledWith(launchOptions);
        });
    });

    runPluginTest(PuppeteerPlugin as any, PuppeteerController as any, puppeteer);

    type BrowserName = keyof Pick<typeof playwright, 'firefox' | 'webkit' | 'chromium'>;

    describe('Playwright specifics', () => {
        let browser: playwright.Browser;

        afterEach(async () => {
            await browser.close();
        });

        describe.each(['chromium', 'firefox', 'webkit'] as BrowserName[])('with %s', (browserName) => {
            test('should work with non authenticated proxyUrl', async () => {
                const proxyUrl = 'http://10.10.10.0:8080';
                const plugin = new PlaywrightPlugin(playwright[browserName]);
                jest.spyOn(plugin, '_getAnonymizedProxyUrl');
                const context = await plugin.createLaunchContext({ proxyUrl });

                browser = await plugin.launch(context);
                expect(context?.launchOptions?.proxy?.server).toEqual(proxyUrl);
                expect(plugin._getAnonymizedProxyUrl).not.toBeCalled(); // eslint-disable-line
            });

            test('should work with authenticated proxyUrl', async () => {
                const proxyUrl = 'http://apify1234:password@10.10.10.0:8080';
                const plugin = new PlaywrightPlugin(playwright[browserName]);
                jest.spyOn(plugin, '_getAnonymizedProxyUrl');
                const context = await plugin.createLaunchContext({ proxyUrl });

                browser = await plugin.launch(context);
                expect(context?.launchOptions?.proxy?.server).toEqual(context.anonymizedProxyUrl);
            expect(plugin._getAnonymizedProxyUrl).toBeCalled(); // eslint-disable-line
            });

            test('should use incognito context by option', async () => {
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
                const plugin = new PlaywrightPlugin(playwright[browserName]);
                const browserController = plugin.createController();

                const launchContext = plugin.createLaunchContext();

                browser = await plugin.launch(launchContext);
                browserController.assignBrowser(browser, launchContext);
                browserController.activate();

                const page = await browserController.newPage();
                const context = await page.context();
                await browserController.newPage();

                expect(context.pages()).toHaveLength(3); // 3 pages because of the about:blank.
            });

            test('should pass launch options to browser', async () => {
                const plugin = new PlaywrightPlugin(playwright[browserName]);

                jest.spyOn(plugin.library, 'launch');
                const launchOptions: Record<string, any> = {
                    foo: 'bar',
                };
                const launchContext = plugin.createLaunchContext({ launchOptions, useIncognitoPages: true });
                browser = await plugin.launch(launchContext);
                expect(plugin.library.launch).toHaveBeenCalledWith(launchOptions);
            });
            describe('Browser', () => {
                test('should create new page', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);

                    const launchContext = plugin.createLaunchContext();
                    browser = await plugin.launch(launchContext);
                    const page = await browser.newPage();

                    expect(typeof page.close).toBe('function');
                    expect(typeof page.evaluate).toBe('function');
                });

                test('should emit disconnected event on close', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);

                    const launchContext = plugin.createLaunchContext();
                    browser = await plugin.launch(launchContext);
                    let called = false;

                    browser.on('disconnected', () => {
                        called = true;
                    });

                    await browser.close();

                    expect(called).toBe(true);
                });

                test('should be used only with incognito pages context', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);

                    const launchContext = plugin.createLaunchContext({ useIncognitoPages: false });
                    browser = await plugin.launch(launchContext);
                    expect(browser).toBeInstanceOf(Browser);

                    await browser.close();

                    const launchContext2 = plugin.createLaunchContext({ useIncognitoPages: true });
                    browser = await plugin.launch(launchContext2);
                    expect(browser).not.toBeInstanceOf(Browser);
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
                    // TODO this is actually the wrapper of original playwright browser instance in playwright/browser.ts
                    expect(contexts[0]).toEqual((browser as any).browserContext);
                });

                test('should return correct connected status', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);

                    const launchContext = plugin.createLaunchContext();
                    browser = await plugin.launch(launchContext);
                    expect(browser.isConnected()).toBe(true);

                    await browser.close();

                    expect(browser.isConnected()).toBe(false);
                });

                test('should throw on newContext call', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);
                    const launchContext = plugin.createLaunchContext();
                    browser = await plugin.launch(launchContext);

                    expect(browser.newContext())
                        .rejects
                        .toThrow('Could not call `newContext()` on browser, when `useIncognitoPages` is set to `false`');
                });

                test('should have same public interface as playwright browserType', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);
                    const originalFunctionNames: Array<keyof typeof browser> = ['close', 'contexts', 'isConnected', 'newContext', 'newPage', 'version'];
                    const launchContext = plugin.createLaunchContext({ useIncognitoPages: true });
                    browser = await plugin.launch(launchContext);

                    for (const originalFunctionName of originalFunctionNames) {
                        expect(typeof browser[originalFunctionName]).toBe('function');
                    }

                    expect.hasAssertions();
                });
            });
        });
    });

    runPluginTest(PlaywrightPlugin as any, PlaywrightController as any, playwright.chromium);
    runPluginTest(PlaywrightPlugin as any, PlaywrightController as any, playwright.firefox);
    runPluginTest(PlaywrightPlugin as any, PlaywrightController as any, playwright.webkit);
});
