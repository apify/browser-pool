import net, { AddressInfo } from 'net';
import http from 'http';
import { promisify } from 'util';

import puppeteer from 'puppeteer';
import playwright from 'playwright';

import { PuppeteerPlugin } from '../../src/puppeteer/puppeteer-plugin';
import { PuppeteerController } from '../../src/puppeteer/puppeteer-controller';

import { PlaywrightPlugin } from '../../src/playwright/playwright-plugin';
import { PlaywrightController } from '../../src/playwright/playwright-controller';
import { Browser } from '../../src/playwright/browser';

import { LaunchContext } from '../../src/launch-context';
import { UnwrapPromise } from '../../src/utils';
import { CommonLibrary } from '../../src/abstract-classes/browser-plugin';

// TODO: make `proxy-chain` accept `localAddress`
import { createProxyServer } from './create-proxy-server';

jest.setTimeout(120000);

const runPluginTest = <
    P extends typeof PlaywrightPlugin | typeof PuppeteerPlugin,
    C extends typeof PuppeteerController | typeof PlaywrightController,
    L extends CommonLibrary,
>(Plugin: P, Controller: C, library: L) => {
    let plugin = new Plugin(library as never);

    describe(`${plugin.constructor.name} - ${'name' in library ? library.name!() : ''} general`, () => {
        let browser: playwright.Browser | UnwrapPromise<ReturnType<typeof puppeteer['launch']>> | undefined;

        beforeEach(() => {
            plugin = new Plugin(library as never);
        });

        afterEach(async () => {
            await browser?.close();
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
                // @ts-expect-error Testing options
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
            expect(context['_proxyUrl']).toEqual(desiredObject._proxyUrl); // eslint-disable-line
            expect(context.one).toEqual(desiredObject.one);
            expect(context.useIncognitoPages).toEqual(desiredObject.useIncognitoPages);
        });

        test('should get default launchContext values from plugin options', async () => {
            const proxyUrl = 'http://apify1234@10.10.10.0:8080/';

            plugin = new Plugin(library as never, {
                proxyUrl,
                userDataDir: 'test',
                useIncognitoPages: true,
            });

            const context = plugin.createLaunchContext();

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

            browser = await plugin.launch(context as never);

            browserController.assignBrowser(browser as never, context as never);
            browserController.activate();

            const page = await browserController.newPage();
            await browserController.setCookies(page as never, [{ name: 'TEST', value: 'TESTER-COOKIE', url: 'https://example.com' }]);
            await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

            const cookies = await browserController.getCookies(page as never);
            expect(cookies[0].name).toBe('TEST');
            expect(cookies[0].value).toBe('TESTER-COOKIE');
        });
    });
};

describe('Plugins', () => {
    let target: http.Server;
    let unprotectedProxy: http.Server;
    let protectedProxy: http.Server;

    beforeAll(async () => {
        target = http.createServer((request, response) => {
            response.end(request.socket.remoteAddress);
        });
        await promisify(target.listen.bind(target) as any)(0, '127.0.0.1');

        unprotectedProxy = createProxyServer('127.0.0.2', '', '');
        await promisify(unprotectedProxy.listen.bind(unprotectedProxy) as any)(0, '127.0.0.2');

        protectedProxy = createProxyServer('127.0.0.3', 'foo', 'bar');
        await promisify(protectedProxy.listen.bind(protectedProxy) as any)(0, '127.0.0.3');
    });

    afterAll(async () => {
        await promisify(target.close.bind(target))();
        await promisify(unprotectedProxy.close.bind(unprotectedProxy))();
        await promisify(protectedProxy.close.bind(protectedProxy))();
    });

    describe('Puppeteer specifics', () => {
        let browser: puppeteer.Browser;

        afterEach(async () => {
            await browser.close();
        });

        test('should work with non authenticated proxyUrl', async () => {
            const proxyUrl = `http://127.0.0.2:${(unprotectedProxy.address() as AddressInfo).port}`;
            const plugin = new PuppeteerPlugin(puppeteer);

            const context = plugin.createLaunchContext({
                proxyUrl,
                launchOptions: {
                    args: [
                        '--proxy-bypass-list=<-loopback>',
                    ],
                },
            });

            browser = await plugin.launch(context);
            const argWithProxy = context.launchOptions?.args?.find((arg) => arg.includes('--proxy-server='));

            expect(argWithProxy?.includes(proxyUrl)).toBeTruthy();

            const page = await browser.newPage();
            const response = await page.goto(`http://127.0.0.1:${(target.address() as AddressInfo).port}`);

            const text = await response.text();

            expect(text).toBe('127.0.0.2');

            await page.close();
        });

        test('should work with authenticated proxyUrl', async () => {
            const proxyUrl = 'http://apify1234@10.10.10.0:8080';

            const plugin = new PuppeteerPlugin(puppeteer);

            const context = plugin.createLaunchContext({ proxyUrl });

            browser = await plugin.launch(context);
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
            const launchOptions: Record<string, unknown> = {
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
        let browser: playwright.Browser;

        afterEach(async () => {
            await browser.close();
        });

        describe.each(['chromium', 'firefox', 'webkit'] as const)('with %s', (browserName) => {
            test('should work with non authenticated proxyUrl', async () => {
                const proxyUrl = 'http://10.10.10.0:8080';
                const plugin = new PlaywrightPlugin(playwright[browserName]);

                const context = plugin.createLaunchContext({ proxyUrl });

                browser = await plugin.launch(context);
                expect(context.launchOptions!.proxy!.server).toEqual(proxyUrl);
            });

            test('should work with authenticated proxyUrl', async () => {
                const proxyUrl = 'http://apify1234:password@10.10.10.0:8080';
                const plugin = new PlaywrightPlugin(playwright[browserName]);

                const context = plugin.createLaunchContext({ proxyUrl });

                browser = await plugin.launch(context);
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
                const context = page.context();
                await browserController.newPage();

                expect(context.pages()).toHaveLength(3); // 3 pages because of the about:blank.
            });

            test('should pass launch options to browser', async () => {
                const plugin = new PlaywrightPlugin(playwright[browserName]);

                jest.spyOn(plugin.library, 'launch');
                const launchOptions: Record<string, unknown> = {
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
                    // Cast to any to access private property
                    // eslint-disable-next-line no-underscore-dangle
                    expect(contexts[0]).toEqual((browser as any)._browserContext);
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
                        .toThrow('Function `newContext()` is not available in incognito mode');
                });

                test('should have same public interface as playwright browserType', async () => {
                    const plugin = new PlaywrightPlugin(playwright[browserName]);
                    const originalFunctionNames = ['close', 'contexts', 'isConnected', 'newContext', 'newPage', 'version'] as const;
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

    runPluginTest(PlaywrightPlugin, PlaywrightController, playwright.chromium);
    runPluginTest(PlaywrightPlugin, PlaywrightController, playwright.firefox);
    runPluginTest(PlaywrightPlugin, PlaywrightController, playwright.webkit);
});
