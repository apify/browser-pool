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

class BrowserPool extends EventEmitter {
    constructor(options = {}) {
        ow(options, ow.object.exactShape({
            browserPlugins: ow.array.minLength(1),
            maxOpenPagesPerBrowser: ow.optional.number,
            retireBrowserAfterPageCount: ow.optional.number,
            operationTimeoutSecs: ow.optional.number,
            killInactiveBrowserAfterSecs: ow.optional.number,
            preLaunchHooks: ow.optional.array,
            postLaunchHooks: ow.optional.array,
            prePageCreateHooks: ow.optional.array,
            postPageCreateHooks: ow.optional.array,
            prePageCloseHooks: ow.optional.array,
            postPageCloseHooks: ow.optional.array,
        }));

        const {
            browserPlugins,
            maxOpenPagesPerBrowser = 50,
            retireBrowserAfterPageCount = 100,
            operationTimeoutSecs = 15,
            killInactiveBrowserAfterSecs = 300,
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
        this.killBrowserAfterMillis = killInactiveBrowserAfterSecs * 1000;

        // hooks
        this.preLaunchHooks = preLaunchHooks;
        this.postLaunchHooks = postLaunchHooks;
        this.prePageCreateHooks = prePageCreateHooks;
        this.postPageCreateHooks = postPageCreateHooks;
        this.prePageCloseHooks = prePageCloseHooks;
        this.postPageCloseHooks = postPageCloseHooks;

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
     * @return {Promise<Page>}
     */
    async newPage(options = {}) {
        const {
            id = nanoid(),
            pageOptions,
        } = options;
        let browserController = this._pickBrowserWithFreeCapacity();

        if (!browserController) browserController = await this._launchBrowser(id);
        const page = await this._createPageForBrowser(id, browserController, pageOptions);
        this.pages.set(id, page);
        this.pageIds.set(page, id);
        return page;
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
     * @return {Promise<Page>}
     */
    async newPageInNewBrowser(options = {}) {
        const {
            id = nanoid(),
            pageOptions,
            launchOptions,
            browserPlugin,
        } = options;

        const browserController = await this._launchBrowser(id, { launchOptions, browserPlugin });
        const page = await this._createPageForBrowser(id, browserController, pageOptions);
        this.pages.set(id, page);
        return page;
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
        const browserControllers = this._getAllBrowserControllers();
        const promises = browserControllers.map((controller) => controller.close());
        await Promise.all(promises);
    }

    /**
     * Closes all managed browsers and tears down the pool.
     * @return {Promise<void>}
     */
    async destroy() {
        this.browserKillerInterval = clearInterval(this.browserKillerInterval);

        const controllers = this._getAllBrowserControllers();
        const promises = [];
        controllers.forEach((controller) => {
            promises.push(controller.close());
        });
        await Promise.all(promises);

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
     * @param {object} [options]
     * @param {object} [options.launchOptions]
     * @param {object} [options.browserPlugin]
     * @return {Promise<BrowserController>}
     * @private
     */
    async _launchBrowser(pageId, options = {}) {
        const {
            launchOptions,
            browserPlugin = this._pickNewBrowserPluginToLaunch(),
        } = options;

        const launchContext = browserPlugin.createLaunchContext({
            id: pageId,
            launchOptions,
        });

        await this._executeHooks(this.preLaunchHooks, launchContext);

        const browserController = await browserPlugin.launch(launchContext);
        log.debug('Launched new browser.', { id: browserController.id });

        await this._executeHooks(this.postLaunchHooks, browserController);
        this.emit(BROWSER_LAUNCHED, browserController);

        this.activeBrowserControllers.add(browserController);

        return browserController;
    }

    _pickNewBrowserPluginToLaunch() {
        return this.browserPlugins[Math.floor(Math.random() * this.browserPlugins.length)];
    }

    _pickBrowserWithFreeCapacity() {
        return Array.from(this.activeBrowserControllers.values())
            .find((inst) => inst.activePages < this.maxOpenPagesPerBrowser);
    }

    async _closeInactiveRetiredBrowsers() {
        const closedBrowserIds = [];

        this.retiredBrowserControllers.forEach((controller) => {
            const millisSinceLastPageOpened = Date.now() - controller.lastPageOpenedAt;
            const isBrowserIdle = millisSinceLastPageOpened >= this.killBrowserAfterMillis;
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

        page.close = async (...args) => {
            await this._executeHooks(this.prePageCloseHooks, page, browserController);
            await originalPageClose.apply(page, args)
                .catch((err) => {
                    log.debug(`Could not close page.\nCause:${err.message}`, { id: browserController.id });
                });
            await this._executeHooks(this.postPageCloseHooks, page, browserController);
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
