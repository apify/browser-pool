const EventEmitter = require('events');
const ow = require('ow').default;
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

        this.activeBrowserControllers = new Set();
        this.retiredBrowserControllers = new Set();
        this.pageToBrowserController = new WeakMap();

        this.browserKillerInterval = setInterval(
            () => this._closeInactiveRetiredBrowsers(),
            BROWSER_KILLER_INTERVAL_MILLIS,
        );
    }

    /**
     * Returns existing pending page or new page.
     * @return {Promise<Page>}
     */
    async newPage(options = {}) {
        const { pageOptions, ...others } = options;
        let browserController = this._pickBrowserWithFreeCapacity();

        if (!browserController) browserController = await this._launchBrowser({ ...others });
        return this._createPageForBrowser(browserController, pageOptions);
    }

    /**
     * @param options
     * @return {Promise<Page>}
     */
    async newPageInNewBrowser(options = {}) {
        const { pageOptions, ...others } = options;

        const browserController = await this._launchBrowser({ ...others });
        return this._createPageForBrowser(browserController, pageOptions);
    }

    /**
     *
     * @param page {Page} - Browser plugin page
     * @return {BrowserController|undefined}
     */
    getBrowserControllerByPage(page) {
        return this.pageToBrowserController.get(page);
    }

    async _createPageForBrowser(browserController, pageOptions) {
        try {
            await this._executeHooks(this.prePageCreateHooks, browserController);
            const page = await addTimeoutToPromise(
                browserController.newPage(pageOptions),
                this.operationTimeoutMillis,
                'browserController.newPage() timed out.',
            );
            this.pageToBrowserController.set(page, browserController);

            if (browserController.totalPages >= this.retireBrowserAfterPageCount) {
                this._retireBrowser(browserController);
            }

            this._overridePageClose(page);
            this.emit(PAGE_CREATED, page); // @TODO: CONSIDER renaming this event.
            await this._executeHooks(this.postPageCreateHooks, browserController, page); // @TODO: Not sure about the placement of this hooks
            return page;
        } catch (err) {
            this._retireBrowser(browserController);
            const betterError = new Error(`browserController.newPage() failed: ${browserController.id}.`);
            betterError.stack = err.stack;
            throw betterError;
        }
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
     * @return {Promise<BrowserController>}
     * @private
     */
    async _launchBrowser(options) {
        const browserPlugin = this._pickNewBrowserPluginToLaunch();
        const launchContext = browserPlugin.createLaunchContext(options);
        launchContext.browserPlugin = browserPlugin;

        await this._executeHooks(this.preLaunchHooks, launchContext);

        const browserController = await browserPlugin.launch(launchContext);
        log.debug('Launched new browser.', { id: browserController.id });

        this.emit(BROWSER_LAUNCHED, browserController);
        await this._executeHooks(this.postLaunchHooks, browserController);

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
            await this._executeHooks(this.prePageCloseHooks, browserController, page);
            await originalPageClose.apply(page, args)
                .catch((err) => {
                    log.debug(`Could not close page.\nCause:${err.message}`, { id: browserController.id });
                });
            await this._executeHooks(this.postPageCloseHooks, browserController, page);
            this.emit(PAGE_CLOSED, page);
            this._closeRetiredBrowserWithNoPages(browserController);
        };
    }

    /**
     * @param {function[]} hooks
     * @param {Array} args
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
