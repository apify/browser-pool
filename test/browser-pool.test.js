const puppeteer = require('puppeteer');
const playwright = require('playwright');
const BrowserPool = require('../src/browser-pool');
const PuppeteerPlugin = require('../src/browser-plugins/puppeteer-plugin');
const PlaywrightPlugin = require('../src/browser-plugins/playwright-plugin');
const {
    BROWSER_POOL_EVENTS: {
        BROWSER_LAUNCHED,
        BROWSER_RETIRED,
        PAGE_CREATED,
        PAGE_CLOSED,
    },
} = require('../src/events');

// Tests could be generated from this blueprint for each plugin
describe('BrowserPool', () => {
    const puppeteerPlugin = new PuppeteerPlugin(puppeteer);
    const playwrightPlugin = new PlaywrightPlugin(playwright.chromium); // chromium is faster than firefox and webkit
    let browserPool;

    beforeEach(async () => {
        jest.clearAllMocks();
        browserPool = new BrowserPool({
            browserPlugins: [puppeteerPlugin, playwrightPlugin],
            closeInactiveBrowserAfterSecs: 2,
        });
    });

    afterEach(async () => {
        browserPool = await browserPool.destroy();
    });

    describe('Initialization & retirement', () => {
        test('should retire browsers', async () => {
            await browserPool.newPage();

            await browserPool.retireAllBrowsers();
            expect(browserPool.activeBrowserControllers.size).toBe(0);
            expect(browserPool.retiredBrowserControllers.size).toBe(1);
        });

        test('should destroy pool', async () => {
            const page = await browserPool.newPage();
            const browserController = await browserPool.getBrowserControllerByPage(page);
            jest.spyOn(browserController, 'close');

            await browserPool.destroy();

            expect(browserController.close).toHaveBeenCalled();
            expect(browserPool.activeBrowserControllers.size).toBe(0);
            expect(browserPool.retiredBrowserControllers.size).toBe(0);
            expect(browserPool.browserKillerInterval).toBeUndefined();
        });
    });

    describe('Basic user functionality', () => {
        // Basic user facing functionality
        test('should open new page', async () => {
            const page = await browserPool.newPage();
            const page2 = await browserPool.newPage();

            expect(page.goto).toBeDefined();
            expect(page.close).toBeDefined();
        });

        test('should open page in correct browser plugin', async () => {
            let page = await browserPool.newPage({
                browserPlugin: playwrightPlugin,
            });
            let controller = browserPool.getBrowserControllerByPage(page);
            expect(controller.launchContext.browserPlugin).toBe(playwrightPlugin);

            page = await browserPool.newPage({
                browserPlugin: puppeteerPlugin,
            });
            controller = browserPool.getBrowserControllerByPage(page);
            expect(controller.launchContext.browserPlugin).toBe(puppeteerPlugin);
            expect(browserPool.activeBrowserControllers.size).toBe(2);
        });

        test('should loop through plugins round-robin', async () => {
            const correctPluginOrder = [
                puppeteerPlugin,
                playwrightPlugin,
                puppeteerPlugin,
            ];

            const pagePromises = correctPluginOrder.map(() => {
                return browserPool.newPage();
            });
            const pages = await Promise.all(pagePromises);

            expect(pages).toHaveLength(correctPluginOrder.length);
            expect(browserPool.activeBrowserControllers.size).toBe(2);
            pages.forEach((page, idx) => {
                const controller = browserPool.getBrowserControllerByPage(page);
                const { browserPlugin } = controller.launchContext;
                const correctPlugin = correctPluginOrder[idx];
                expect(browserPlugin).toBe(correctPlugin);
            });
        });

        test('should open new page in new browser', async () => {
            jest.spyOn(puppeteerPlugin, 'launch');
            jest.spyOn(playwrightPlugin, 'launch');

            await browserPool.newPage();
            await browserPool.newPageInNewBrowser();
            await browserPool.newPageInNewBrowser();

            expect(browserPool.activeBrowserControllers.size).toBe(3);
            expect(puppeteerPlugin.launch).toHaveBeenCalledTimes(2);
            expect(playwrightPlugin.launch).toHaveBeenCalledTimes(1);
        });

        test('newPageWithEachPlugin should open all pages', async () => {
            const [puppeteerPage, playwrightPage] = await browserPool.newPageWithEachPlugin();
            const puppeteerController = browserPool.getBrowserControllerByPage(puppeteerPage);
            const playwrightController = browserPool.getBrowserControllerByPage(playwrightPage);
            expect(puppeteerController.launchContext.browserPlugin).toBe(puppeteerPlugin);
            expect(playwrightController.launchContext.browserPlugin).toBe(playwrightPlugin);
        });

        test('newPageWithEachPlugin should open in existing browsers', async () => {
            jest.spyOn(puppeteerPlugin, 'launch');
            jest.spyOn(playwrightPlugin, 'launch');

            // launch 2 browsers
            await browserPool.newPage();
            await browserPool.newPage();
            expect(puppeteerPlugin.launch).toHaveBeenCalledTimes(1);
            expect(playwrightPlugin.launch).toHaveBeenCalledTimes(1);
            expect(browserPool.activeBrowserControllers.size).toBe(2);

            // Open more pages
            await browserPool.newPageWithEachPlugin();
            expect(puppeteerPlugin.launch).toHaveBeenCalledTimes(1);
            expect(playwrightPlugin.launch).toHaveBeenCalledTimes(1);
            expect(browserPool.activeBrowserControllers.size).toBe(2);
        });

        test('should correctly override page close', async () => {
            jest.spyOn(browserPool, '_overridePageClose');

            const page = await browserPool.newPage();

            expect(browserPool._overridePageClose).toBeCalled(); // eslint-disable-line

            const controller = browserPool.getBrowserControllerByPage(page);

            expect(controller.activePages).toEqual(1);
            expect(controller.totalPages).toEqual(1);

            await page.close();

            expect(controller.activePages).toEqual(0);
            expect(controller.totalPages).toEqual(1);
        });

        test('should retire browser after page count', async () => {
            browserPool.retireBrowserAfterPageCount = 2;

            jest.spyOn(browserPool, '_retireBrowser');
            expect(browserPool.activeBrowserControllers.size).toBe(0);

            await browserPool.newPage();
            await browserPool.newPage();
            await browserPool.newPage();

            expect(browserPool.activeBrowserControllers.size).toBe(1);
            expect(browserPool.retiredBrowserControllers.size).toBe(1);

            expect(browserPool._retireBrowser).toBeCalledTimes(1); // eslint-disable-line
        });

        test('should allow max pages per browser', async () => {
            browserPool.maxOpenPagesPerBrowser = 1;
            jest.spyOn(browserPool, '_launchBrowser');

            await browserPool.newPage();
            expect(browserPool.activeBrowserControllers.size).toBe(1);
            await browserPool.newPage();
            expect(browserPool.activeBrowserControllers.size).toBe(2);
            await browserPool.newPage();
            expect(browserPool.activeBrowserControllers.size).toBe(3);

            expect(browserPool._launchBrowser).toBeCalledTimes(3); // eslint-disable-line
        });

        test('should close retired browsers', async () => {
            browserPool.retireBrowserAfterPageCount = 1;
            clearInterval(browserPool.browserKillerInterval);
            browserPool.browserKillerInterval = setInterval(
                () => browserPool._closeInactiveRetiredBrowsers(), // eslint-disable-line
                100,
            );
            jest.spyOn(browserPool, '_closeRetiredBrowserWithNoPages');
            expect(browserPool.retiredBrowserControllers.size).toBe(0);

            const page = await browserPool.newPage();
            const controller = await browserPool.getBrowserControllerByPage(page);
            jest.spyOn(controller, 'close');

            expect(browserPool.retiredBrowserControllers.size).toBe(1);
            await page.close();

            await new Promise((resolve) => setTimeout(() => {
                resolve();
            }, 1000));

            expect(browserPool._closeRetiredBrowserWithNoPages).toHaveBeenCalled(); //eslint-disable-line
            expect(controller.close).toHaveBeenCalled();
            expect(browserPool.retiredBrowserControllers.size).toBe(0);
        });

        describe('hooks', () => {
            test('should run hooks in series with custom args', async () => {
                const indexArray = [];
                const createAsyncHookReturningIndex = (i) => async () => {
                    const index = await new Promise((resolve) => setTimeout(() => resolve(i), 100));
                    indexArray.push(index);
                };
                const hooks = new Array(10);
                for (let i = 0; i < hooks.length; i++) {
                    hooks[i] = createAsyncHookReturningIndex(i);
                }
            await browserPool._executeHooks(hooks); // eslint-disable-line
                expect(indexArray).toHaveLength(10);
                indexArray.forEach((v, index) => expect(v).toEqual(index));
            });

            describe('preLaunchHooks', () => {
                test('should evaluate hook before launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve({});
                    browserPool.preLaunchHooks = [myAsyncHook];
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    const pageId = await browserPool.getPageId(page);
                    const { launchContext } = browserPool.getBrowserControllerByPage(page);
                    expect(browserPool._executeHooks).toHaveBeenNthCalledWith(1, browserPool.preLaunchHooks, pageId, launchContext); // eslint-disable-line
                });
            });

            describe('postLaunchHooks', () => {
                test('should evaluate hook after launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve({});
                    browserPool.postLaunchHooks = [myAsyncHook];
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    const pageId = await browserPool.getPageId(page);
                    const browserController = browserPool.getBrowserControllerByPage(page);
                expect(browserPool._executeHooks).toHaveBeenNthCalledWith(2, browserPool.postLaunchHooks, pageId, browserController); // eslint-disable-line
                });
            });

            describe('prePageCreateHooks', () => {
                test('should evaluate hook after launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve({});
                    browserPool.prePageCreateHooks = [myAsyncHook];
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    const pageId = browserPool.getPageId(page);
                    const browserController = browserPool.getBrowserControllerByPage(page);
                    expect(browserPool._executeHooks).toHaveBeenNthCalledWith(3, browserPool.prePageCreateHooks, pageId, browserController); // eslint-disable-line
                });
            });

            describe('postPageCreateHooks', () => {
                test('should evaluate hook after launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve({});
                    browserPool.postPageCreateHooks = [myAsyncHook];
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    const browserController = browserPool.getBrowserControllerByPage(page);
                    expect(browserPool._executeHooks).toHaveBeenNthCalledWith(4, browserPool.postPageCreateHooks, page, browserController); // eslint-disable-line
                });
            });

            describe('prePageCloseHooks', () => {
                test('should evaluate hook after launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve({});
                    browserPool.prePageCloseHooks = [myAsyncHook];
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    await page.close();

                    const browserController = browserPool.getBrowserControllerByPage(page);
                    expect(browserPool._executeHooks).toHaveBeenNthCalledWith(5, browserPool.prePageCloseHooks, page, browserController); // eslint-disable-line
                });
            });

            describe('postPageCloseHooks', () => {
                test('should evaluate hook after launching browser with correct args', async () => {
                    const myAsyncHook = () => Promise.resolve({});
                    browserPool.postPageCloseHooks = [myAsyncHook];
                    jest.spyOn(browserPool, '_executeHooks');

                    const page = await browserPool.newPage();
                    await page.close();

                    const browserController = browserPool.getBrowserControllerByPage(page);
                    expect(browserPool._executeHooks).toHaveBeenNthCalledWith(6, browserPool.postPageCloseHooks, page, browserController); // eslint-disable-line
                });
            });
        });

        describe('events', () => {
            test(`should emit ${BROWSER_LAUNCHED} event`, async () => {
                browserPool.maxOpenPagesPerBrowser = 1;
                let calls = 0;
                let argument;

                browserPool.on(BROWSER_LAUNCHED, (arg) => {
                    argument = arg;
                    calls++;
                });
                await browserPool.newPage();
                const page = await browserPool.newPage();

                expect(calls).toEqual(2);
                expect(argument).toEqual(browserPool.getBrowserControllerByPage(page));
            });

            test(`should emit ${BROWSER_RETIRED} event`, async () => {
                browserPool.retireBrowserAfterPageCount = 1;
                let calls = 0;
                let argument;
                browserPool.on(BROWSER_RETIRED, (arg) => {
                    argument = arg;
                    calls++;
                });

                await browserPool.newPage();
                const page = await browserPool.newPage();

                expect(calls).toEqual(2);
                expect(argument).toEqual(browserPool.getBrowserControllerByPage(page));
            });

            test(`should emit ${PAGE_CREATED} event`, async () => {
                let calls = 0;
                let argument;
                browserPool.on(PAGE_CREATED, (arg) => {
                    argument = arg;
                    calls++;
                });

                const page = await browserPool.newPage();
                expect(argument).toEqual(page);
                const page2 = await browserPool.newPage();
                expect(calls).toEqual(2);
                expect(argument).toEqual(page2);
            });

            test(`should emit ${PAGE_CLOSED} event`, async () => {
                let calls = 0;
                let argument;
                browserPool.on(PAGE_CLOSED, (arg) => {
                    argument = arg;
                    calls++;
                });

                const page = await browserPool.newPage();
                await page.close();
                expect(argument).toEqual(page);
                const page2 = await browserPool.newPage();
                await page2.close();
                expect(calls).toEqual(2);
                expect(argument).toEqual(page2);
            });
        });
    });
});
