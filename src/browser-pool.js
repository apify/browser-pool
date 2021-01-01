const EventEmitter = require('events');
const ow = require('ow').default;
const { nanoid } = require('nanoid');
const log = require('./logger');
const { addTimeoutToPromise } = require('./utils');

const {
    BROWSER_POOL_EVENTS: {
        BROWSER_LAUNCHED,
        BROWSER_RETIRED,
        PAGE_CREATED,
        PAGE_CLOSED,
    },
} = require('./events');

const PAGE_CLOSE_KILL_TIMEOUT_MILLIS = 1000;
const BROWSER_KILLER_INTERVAL_MILLIS = 10 * 1000;

/**
 * The `BrowserPool` class is the most important class of the `browser-pool` module.
 * It manages opening and closing of browsers and their pages and its constructor
 * options allow easy configuration of the browsers' and pages' lifecycle.
 *
 * The most important and useful constructor options are the various lifecycle hooks.
 * Those allow you to sequentially call a list of (asynchronous) functions at each
 * stage of the browser / page lifecycle.
 *
 * **Example:**
 * ```js
 * const { BrowserPool, PlaywrightPlugin } = require('browser-pool');
 * const playwright = require('playwright');
 *
 * const browserPool = new BrowserPool({
 *     browserPlugins: [ new PlaywrightPlugin(playwright.chromium)],
 *     preLaunchHooks: [(pageId, launchContext) => {
 *         // do something before a browser gets launched
 *         launchContext.launchOptions.headless = false;
 *     }],
 *     postLaunchHooks: [(pageId, browserController) => {
 *         // manipulate the browser right after launch
 *         console.dir(browserController.browser.contexts());
 *     }],
 *     prePageCreateHooks: [(pageId, browserController) => {
 *         if (pageId === 'my-page') {
 *             // make changes right before a specific page is created
 *         }
 *     }],
 *     postPageCreateHooks: [async (page, browserController) => {
 *         // update some or all new pages
 *         await page.evaluate(() => {
 *             // now all pages will have 'foo'
 *             window.foo = 'bar'
 *         })
 *     }],
 *     prePageCloseHooks: [async (page, browserController) => {
 *         // collect information just before a page closes
 *         await page.screenshot();
 *     }],
 *     postPageCloseHooks: [(pageId, browserController) => {
 *         // clean up or log after a job is done
 *         console.log('Page closed: ', pageId)
 *     }]
 * });
 * ```
 *
 * @param {object} options
 * @param {BrowserPlugin[]} options.browserPlugins
 *  Browser plugins are wrappers of browser automation libraries that
 *  allow `BrowserPool` to control browsers with those libraries.
 *  `browser-pool` comes with a `PuppeteerPlugin` and a `PlaywrightPlugin`.
 * @param {number} [options.maxOpenPagesPerBrowser=20]
 *  Sets the maximum number of pages that can be open in a browser at the
 *  same time. Once reached, a new browser will be launched to handle the excess.
 * @param {number} [options.retireBrowserAfterPageCount=100]
 *  Browsers tend to get bloated after processing a lot of pages. This option
 *  configures the number of processed pages after which the browser will
 *  automatically retire and close. A new browser will launch in its place.
 * @param {number} [options.operationTimeoutSecs=15]
 *  As we know from experience, async operations of the underlying libraries,
 *  such as launching a browser or opening a new page, can get stuck.
 *  To prevent `BrowserPool` from getting stuck, we add a timeout
 *  to those operations and you can configure it with this option.
 * @param {number} [options.closeInactiveBrowserAfterSecs=300]
 *  Browsers normally close immediately after their last page is processed.
 *  However, there could be situations where this does not happen. Browser Pool
 *  makes sure all inactive browsers are closed regularly, to free resources.
 * @param {function[]} [options.preLaunchHooks]
 *  Pre-launch hooks are executed just before a browser is launched and provide
 *  a good opportunity to dynamically change the launch options.
 *  The hooks are called with two arguments:
 *  `pageId`:`string` and `launchContext`:{@link LaunchContext}
 * @param {function[]} [options.postLaunchHooks]
 *  Post-launch hooks are executed as soon as a browser is launched.
 *  The hooks are called with two arguments:
 *  `pageId`:`string` and `browserController`:{@link BrowserController}
 *  To guarantee order of execution before other hooks in the same browser,
 *  the {@link BrowserController} methods cannot be used until the post-launch
 *  hooks complete. If you attempt to call `await browserController.close()` from
 *  a post-launch hook, it will deadlock the process. This API is subject to change.
 * @param {function[]} [options.prePageCreateHooks]
 *  Pre-page-create hooks are executed just before a new page is created. They
 *  are useful to make dynamic changes to the browser before opening a page.
 *  The hooks are called with two arguments:
 *  `pageId`:`string` and `browserController`:{@link BrowserController}
 * @param {function[]} [options.postPageCreateHooks]
 *  Post-page-create hooks are called right after a new page is created
 *  and all internal actions of Browser Pool are completed. This is the
 *  place to make changes to a page that you would like to apply to all
 *  pages. Such as injecting a JavaScript library into all pages.
 *  The hooks are called with two arguments:
 *  `page`:`Page` and `browserController`:{@link BrowserController}
 * @param {function[]} [options.prePageCloseHooks]
 *  Pre-page-close hooks give you the opportunity to make last second changes
 *  in a page that's about to be closed, such as saving a snapshot or updating
 *  state.
 *  The hooks are called with two arguments:
 *  `page`:`Page` and `browserController`:{@link BrowserController}
 * @param {function[]} [options.postPageCloseHooks]
 *  Post-page-close hooks allow you to do page related clean up.
 *  The hooks are called with two arguments:
 *  `pageId`:`string` and `browserController`:{@link BrowserController}
 */
class BrowserPool extends EventEmitter {
    constructor(options = {}) {
        ow(options, ow.object.exactShape({
            browserPlugins: ow.array.minLength(1),
            maxOpenPagesPerBrowser: ow.optional.number,
            retireBrowserAfterPageCount: ow.optional.number,
            operationTimeoutSecs: ow.optional.number,
            closeInactiveBrowserAfterSecs: ow.optional.number,
            preLaunchHooks: ow.optional.array,
            postLaunchHooks: ow.optional.array,
            prePageCreateHooks: ow.optional.array,
            postPageCreateHooks: ow.optional.array,
            prePageCloseHooks: ow.optional.array,
            postPageCloseHooks: ow.optional.array,
        }));

        const {
            browserPlugins,
            maxOpenPagesPerBrowser = 20,
            retireBrowserAfterPageCount = 100,
            operationTimeoutSecs = 15,
            closeInactiveBrowserAfterSecs = 300,
            preLaunchHooks = [],
            postLaunchHooks = [],
            prePageCreateHooks = [],
            postPageCreateHooks = [],
            prePageCloseHooks = [],
            postPageCloseHooks = [],
        } = options;

        super();

        this.browserPlugins = browserPlugins;
        this.maxOpenPagesPerBrowser = maxOpenPagesPerBrowser;
        this.retireBrowserAfterPageCount = retireBrowserAfterPageCount;
        this.operationTimeoutMillis = operationTimeoutSecs * 1000;
        this.closeInactiveBrowserAfterMillis = closeInactiveBrowserAfterSecs * 1000;

        // hooks
        this.preLaunchHooks = preLaunchHooks;
        this.postLaunchHooks = postLaunchHooks;
        this.prePageCreateHooks = prePageCreateHooks;
        this.postPageCreateHooks = postPageCreateHooks;
        this.prePageCloseHooks = prePageCloseHooks;
        this.postPageCloseHooks = postPageCloseHooks;

        this.pageCounter = 0;
        this.pages = new Map();
        this.pageIds = new WeakMap();
        this.activeBrowserControllers = new Set();
        this.retiredBrowserControllers = new Set();
        this.pageToBrowserController = new WeakMap();

        this.browserKillerInterval = setInterval(
            () => this._closeInactiveRetiredBrowsers(),
            BROWSER_KILLER_INTERVAL_MILLIS,
        );
    }

    /**
     * Opens a new page in one of the running browsers or launches
     * a new browser and opens a page there, if no browsers are active,
     * or their page limits have been exceeded.
     *
     * @param {object} options
     * @param {string} [options.id]
     *  Assign a custom ID to the page. If you don't a random string ID
     *  will be generated.
     * @param {object} [options.pageOptions]
     *  Some libraries (Playwright) allow you to open new pages with specific
     *  options. Use this property to set those options.
     * @param {BrowserPlugin} [options.browserPlugin]
     *  Choose a plugin to open the page with. If none is provided,
     *  one of the pool's available plugins will be used.
     *
     *  It must be one of the plugins browser pool was created with.
     *  If you wish to start a browser with a different configuration,
     *  see the `newPageInNewBrowser` function.
     * @return {Promise<Page>}
     */
    async newPage(options = {}) {
        const {
            id = nanoid(),
            pageOptions,
            browserPlugin = this._pickBrowserPlugin(),
        } = options;

        if (this.pages.has(id)) {
            throw new Error(`Page with ID: ${id} already exists.`);
        }

        if (browserPlugin && !this.browserPlugins.includes(browserPlugin)) {
            throw new Error('Provided browserPlugin is not one of the plugins used by BrowserPool.');
        }

        let browserController = this._pickBrowserWithFreeCapacity(browserPlugin);

        if (!browserController) browserController = await this._launchBrowser(id, { browserPlugin });
        return this._createPageForBrowser(id, browserController, pageOptions);
    }

    /**
     * Unlike {@link newPage}, `newPageInNewBrowser` always launches a new
     * browser to open the page in. Use the `launchOptions` option to
     * configure the new browser.
     *
     * @param {object} options
     * @param {string} [options.id]
     *  Assign a custom ID to the page. If you don't a random string ID
     *  will be generated.
     * @param {object} [options.pageOptions]
     *  Some libraries (Playwright) allow you to open new pages with specific
     *  options. Use this property to set those options.
     * @param {object} [options.launchOptions]
     *  Options that will be used to launch the new browser.
     * @param {BrowserPlugin} [options.browserPlugin]
     *  Provide a plugin to launch the browser. If none is provided,
     *  one of the pool's available plugins will be used.
     *
     *  If you configured `BrowserPool` to rotate multiple libraries,
     *  such as both Puppeteer and Playwright, you should always set
     *  the `browserPlugin` when using the `launchOptions` option.
     *
     *  The plugin will not be added to the list of plugins used by
     *  the pool. You can either use one of those, to launch a specific
     *  browser, or provide a completely new configuration.
     * @return {Promise<Page>}
     */
    async newPageInNewBrowser(options = {}) {
        const {
            id = nanoid(),
            pageOptions,
            launchOptions,
            browserPlugin = this._pickBrowserPlugin(),
        } = options;

        if (this.pages.has(id)) {
            throw new Error(`Page with ID: ${id} already exists.`);
        }

        const browserController = await this._launchBrowser(id, { launchOptions, browserPlugin });
        return this._createPageForBrowser(id, browserController, pageOptions);
    }

    /**
     * Opens new pages with all available plugins and returns an array
     * of pages in the same order as the plugins were provided to `BrowserPool`.
     * This is useful when you want to run a script in multiple environments
     * at the same time, typically in testing or website analysis.
     *
     * **Example:**
     * ```js
     * const browserPool = new BrowserPool({
     *     browserPlugins: [
     *         new PlaywrightPlugin(playwright.chromium),
     *         new PlaywrightPlugin(playwright.firefox),
     *         new PlaywrightPlugin(playwright.webkit),
     *         new PuppeteerPlugin(puppeteer),
     *     ]
     * });
     *
     * const pages = await browserPool.newPageWithEachPlugin();
     * const [chromiumPage, firefoxPage, webkitPage, puppeteerPage] = pages;
     * ```
     *
     * @param {object[]} optionsList
     * @return {Promise<Page[]>}
     */
    async newPageWithEachPlugin(optionsList = []) {
        const pagePromises = this.browserPlugins.map((browserPlugin, idx) => {
            const userOptions = optionsList[idx] || {};
            return this.newPage({
                ...userOptions,
                browserPlugin,
            });
        });
        return Promise.all(pagePromises);
    }

    /**
     * Retrieves a {@link BrowserController} for a given page. This is useful
     * when you're working only with pages and need to access the browser
     * manipulation functionality.
     *
     * You could access the browser directly from the page,
     * but that would circumvent `BrowserPool` and most likely
     * cause weird things to happen, so please always use `BrowserController`
     * to control your browsers. The function returns `undefined` if the
     * browser is closed.
     *
     * @param page {Page} - Browser plugin page
     * @return {?BrowserController}
     */
    getBrowserControllerByPage(page) {
        return this.pageToBrowserController.get(page);
    }

    /**
     * If you provided a custom ID to one of your pages or saved the
     * randomly generated one, you can use this function to retrieve
     * the page. If the page is no longer open, the function will
     * return `undefined`.
     *
     * @param {string} id
     * @return {?Page}
     */
    getPage(id) {
        return this.pages.get(id);
    }

    /**
     * Page IDs are used throughout `BrowserPool` as a method of linking
     * events. You can use a page ID to track the full lifecycle of the page.
     * It is created even before a browser is launched and stays with the page
     * until it's closed.
     *
     * @param {Page} page
     * @return {string}
     */
    getPageId(page) {
        return this.pageIds.get(page);
    }

    /**
     * @param {string} pageId
     * @param {BrowserController} browserController
     * @param {object} pageOptions
     * @return {Promise<Page>}
     * @private
     */
    async _createPageForBrowser(pageId, browserController, pageOptions) {
        await this._executeHooks(this.prePageCreateHooks, pageId, browserController);
        let page;
        try {
            page = await addTimeoutToPromise(
                browserController.newPage(pageOptions),
                this.operationTimeoutMillis,
                'browserController.newPage() timed out.',
            );
            this.pages.set(pageId, page);
            this.pageIds.set(page, pageId);
            this.pageToBrowserController.set(page, browserController);

            if (browserController.totalPages >= this.retireBrowserAfterPageCount) {
                this._retireBrowser(browserController);
            }

            this._overridePageClose(page);
        } catch (err) {
            this._retireBrowser(browserController);
            throw new Error(`browserController.newPage() failed: ${browserController.id}\nCause:${err.message}.`);
        }
        await this._executeHooks(this.postPageCreateHooks, page, browserController);
        this.emit(PAGE_CREATED, page); // @TODO: CONSIDER renaming this event.
        return page;
    }

    /**
     * @param {BrowserController} browserController
     * @private
     */
    _retireBrowser(browserController) {
        const hasBeenRetiredOrKilled = !this.activeBrowserControllers.has(browserController);
        if (hasBeenRetiredOrKilled) return;

        this.retiredBrowserControllers.add(browserController);
        this.emit(BROWSER_RETIRED, browserController);
        this.activeBrowserControllers.delete(browserController);
    }

    /**
     * Removes a browser from the pool. It will be
     * closed after all its pages are closed.
     * @param {Page} page
     */
    retireBrowserByPage(page) {
        const browserController = this.getBrowserControllerByPage(page);
        this._retireBrowser(browserController);
    }

    /**
     * Removes all active browsers from the pool. The browsers will be
     * closed after all their pages are closed.
     */
    retireAllBrowsers() {
        this.activeBrowserControllers.forEach((controller) => {
            this._retireBrowser(controller);
        });
    }

    /**
     * Closes all managed browsers without waiting for pages to close.
     * @return {Promise<void>}
     */
    async closeAllBrowsers() {
        const controllers = this._getAllBrowserControllers();
        const promises = [];
        controllers.forEach((controller) => {
            promises.push(controller.close());
        });
        await Promise.all(promises);
    }

    /**
     * Closes all managed browsers and tears down the pool.
     * @return {Promise<void>}
     */
    async destroy() {
        this.browserKillerInterval = clearInterval(this.browserKillerInterval);
        await this.closeAllBrowsers();
        this._teardown();
    }

    _teardown() {
        this.activeBrowserControllers.clear();
        this.retiredBrowserControllers.clear();

        this.removeAllListeners();
    }

    /**
     * @return {Set<BrowserController>}
     * @private
     */
    _getAllBrowserControllers() {
        return new Set([...this.activeBrowserControllers, ...this.retiredBrowserControllers]);
    }

    /**
     * @param {string} pageId
     * @param {object} options
     * @param {BrowserPlugin} options.browserPlugin
     * @param {object} [options.launchOptions]
     * @return {Promise<BrowserController>}
     * @private
     */
    async _launchBrowser(pageId, options = {}) {
        const {
            browserPlugin,
            launchOptions,
        } = options;

        const browserController = browserPlugin.createController();
        this.activeBrowserControllers.add(browserController);

        const launchContext = browserPlugin.createLaunchContext({
            id: pageId,
            launchOptions,
        });

        await this._executeHooks(this.preLaunchHooks, pageId, launchContext);
        const browser = await browserPlugin.launch(launchContext);
        browserController.assignBrowser(browser, launchContext);

        log.debug('Launched new browser.', { id: browserController.id });
        await this._executeHooks(this.postLaunchHooks, pageId, browserController);
        this.emit(BROWSER_LAUNCHED, browserController);
        browserController.activate();

        return browserController;
    }

    /**
     * Picks plugins round robin.
     * @return {BrowserPlugin}
     * @private
     */
    _pickBrowserPlugin() {
        const pluginIndex = this.pageCounter % this.browserPlugins.length;
        this.pageCounter++;

        return this.browserPlugins[pluginIndex];
    }

    /**
     * @param {BrowserPlugin} browserPlugin
     * @return {BrowserController}
     * @private
     */
    _pickBrowserWithFreeCapacity(browserPlugin) {
        return Array.from(this.activeBrowserControllers.values())
            .find((controller) => {
                const hasCapacity = controller.activePages < this.maxOpenPagesPerBrowser;
                const isCorrectPlugin = controller.browserPlugin === browserPlugin;
                return hasCapacity && isCorrectPlugin;
            });
    }

    async _closeInactiveRetiredBrowsers() {
        const closedBrowserIds = [];

        this.retiredBrowserControllers.forEach((controller) => {
            const millisSinceLastPageOpened = Date.now() - controller.lastPageOpenedAt;
            const isBrowserIdle = millisSinceLastPageOpened >= this.closeInactiveBrowserAfterMillis;
            const isBrowserEmpty = controller.activePages === 0;

            if (isBrowserIdle || isBrowserEmpty) {
                const { id } = controller;
                log.debug('Closing retired browser.', { id });
                controller.close();
                this.retiredBrowserControllers.delete(controller);
                closedBrowserIds.push(id);
            }
        });

        if (closedBrowserIds.length) {
            log.debug('Closed retired browsers.', {
                count: closedBrowserIds.length,
                closedBrowserIds,
            });
        }
    }

    /**
     * @param {Page} page
     * @private
     */
    _overridePageClose(page) {
        const originalPageClose = page.close;
        const browserController = this.pageToBrowserController.get(page);
        const pageId = this.getPageId(page);

        page.close = async (...args) => {
            await this._executeHooks(this.prePageCloseHooks, page, browserController);
            await originalPageClose.apply(page, args)
                .catch((err) => {
                    log.debug(`Could not close page.\nCause:${err.message}`, { id: browserController.id });
                });
            await this._executeHooks(this.postPageCloseHooks, pageId, browserController);
            this.pages.delete(this.getPageId(page));
            this._closeRetiredBrowserWithNoPages(browserController);
            this.emit(PAGE_CLOSED, page);
        };
    }

    /**
     * @param {function[]} hooks
     * @param {...*} args
     * @return {Promise<void>}
     * @private
     */
    async _executeHooks(hooks, ...args) {
        for (const hook of hooks) {
            await hook(...args);
        }
    }

    /**
     * @param {BrowserController} browserController
     * @private
     */
    _closeRetiredBrowserWithNoPages(browserController) {
        if (browserController.activePages === 0 && this.retiredBrowserControllers.has(browserController)) {
            // Run this with a delay, otherwise page.close()
            // might fail with "Protocol error (Target.closeTarget): Target closed."
            setTimeout(() => {
                log.debug('Closing retired browser because it has no active pages', { id: browserController.id });
                browserController.close();
                this.retiredBrowserControllers.delete(browserController);
            }, PAGE_CLOSE_KILL_TIMEOUT_MILLIS);
        }
    }
}

module.exports = BrowserPool;
