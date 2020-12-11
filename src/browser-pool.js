const EventEmitter = require('events');
const ow = require('ow').default;
const defaultLog = require('apify-shared/log');
const { addTimeoutToPromise } = require('./utils');

const {
    BROWSER_POOL_EVENTS: {
        BROWSER_LAUNCHED,
        BROWSER_CLOSED,
        BROWSER_RETIRED,
        PAGE_CREATED,
        PAGE_CLOSED,
    },
} = require('./events');

const PROCESS_KILL_TIMEOUT_MILLIS = 5000;
const PAGE_CLOSE_KILL_TIMEOUT_MILLIS = 1000;

class BrowserPool extends EventEmitter {
    constructor(options = {}) {
        ow(options, ow.object.exactShape({
            browserPlugins: ow.array.minLength(1),
            maxOpenPagesPerBrowser: ow.optional.number,
            retireBrowserAfterPageCount: ow.optional.number,
            operationTimeoutSecs: ow.optional.number,
            killBrowserAfterSecs: ow.optional.number,
            browserKillerIntervalSecs: ow.optional.number,
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
            killBrowserAfterSecs = 300,
            browserKillerIntervalSecs = 60,
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
        this.killBrowserAfterMillis = killBrowserAfterSecs * 1000;
        this.browserKillerIntervalMillis = browserKillerIntervalSecs * 1000;

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

        this.log = defaultLog;

        this.browserKillerInterval = setInterval(
            () => this._killRetiredBrowsers(),
            this.browserKillerIntervalMillis,
        );
    }

    /**
     * Returns existing pending page or new page.
     * @return {Promise<Page>}
     */
    async newPage() {
        let browserController = this._pickBrowserWithFreeCapacity();

        if (!browserController) browserController = await this._launchBrowser();
        return this._createPageForBrowser(browserController);
    }

    /**
     *
     * @return {Promise<Page>}
     */
    async newPageInNewBrowser() {
        const browserController = await this._launchBrowser();
        return this._createPageForBrowser(browserController);
    }

    /**
     *
     * @param page {Page} - Browser plugin page
     * @return {BrowserController|undefined}
     */
    getBrowserControllerByPage(page) {
        return this.pageToBrowserController.get(page);
    }

    async _createPageForBrowser(browserController) {
        try {
            await this._executeHooks(this.prePageCreateHooks, browserController);
            const page = await addTimeoutToPromise(
                browserController.newPage(),
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
     * @param {Page} page
     */
    retireBrowserByPage(page) {
        const browserController = this.getBrowserControllerByPage(page);
        return this._retireBrowser(browserController);
    }

    /**
     * Retires all managed browsers.
     * @return {Promise<void>}
     */
    async retireAllBrowsers() {
        this.browserKillerInterval = clearInterval(this.browserKillerInterval);
        const allOpenBrowsers = this._getAllOpenBrowsers();
        // Maybe PromiseAll
        for (const browserController of allOpenBrowsers) {
            await browserController.close();
        }
        this._teardown();
    }

    /**
     * Kills all managed browsers and tears down the pool.
     * @return {Promise<void>}
     */
    async destroy() {
        this.browserKillerInterval = clearInterval(this.browserKillerInterval);

        const controllers = this._getAllOpenBrowsers();
        controllers.forEach((controller) => {
            controller.kill().catch((err) => {
                this.log.debug(`Could not kill browser when destroying the pool.\nCause${err.message}`);
            });
        });

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
    _getAllOpenBrowsers() {
        return new Set([...this.activeBrowserControllers, ...this.retiredBrowserControllers]);
    }

    /**
     * @return {Promise<BrowserController>}
     * @private
     */
    async _launchBrowser() {
        const browserPlugin = this._pickNewBrowserPluginToLaunch();
        const browserControllerContext = await browserPlugin.createBrowserControllerContext();

        browserControllerContext.browserPlugin = browserPlugin;

        await this._executeHooks(this.preLaunchHooks, browserControllerContext);

        const browserController = await browserPlugin.launch(browserControllerContext);
        this.log.debug('Launched new browserController', { id: browserController.id, name: browserController.name });

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

    async _killRetiredBrowsers() {
        this.log.debug('Retired browserControllers count', { count: this.retiredBrowserControllers.size });

        for (const retiredBrowserController of this.retiredBrowserControllers.values()) {
            const millisSinceLastPageOpened = Date.now() - retiredBrowserController.lastPageOpenedAt;
            if (millisSinceLastPageOpened >= this.killBrowserAfterMillis) {
                this.log.debug(`Killing retired browserController after ${this.killBrowserAfterMillis}ms of inactivity.`, {
                    id: retiredBrowserController.id,
                });
                this._killBrowser(retiredBrowserController);
            } else if (retiredBrowserController.activePages === 0) {
                this.log.debug('Killing retired browserController because it has no open tabs', { id: retiredBrowserController.id });
                this._killBrowser(retiredBrowserController);
            }
        }
    }

    // TODO shouldn't the below be a method of the BrowserController?
    // Or at least the part where it closes and then kills?
    /**
     * @param {BrowserController} browserController
     * @private
     */
    _killBrowser(browserController) {
        const { id } = browserController;

        browserController.close()
            .catch((err) => {
                this.log.debug(`Could not close browser.\nCause${err.message}`, { id });
            })
            .finally(() => {
                this.emit(BROWSER_CLOSED, browserController);
            });

        // Make sure the browser really dies. Let's keep the debug logging for now
        // to see how it behaves in production.
        setTimeout(() => {
            browserController.kill().catch((err) => {
                this.log.debug(`Could not kill browser.\nCause${err.message}`, { id });
            });
        }, PROCESS_KILL_TIMEOUT_MILLIS);
        this.retiredBrowserControllers.delete(browserController);
    }

    /**
     * @param {Page} page
     * @return {Promise<void>}
     * @private
     */
    _overridePageClose(page) {
        const originalPageClose = page.close;
        const browserController = this.pageToBrowserController.get(page);

        page.close = async (...args) => {
            await this._executeHooks(this.prePageCloseHooks, browserController, page);
            await originalPageClose.apply(page, args)
                .catch((err) => {
                    this.log.debug(`Could not close page.\nCause:${err.message}`, { id: browserController.id });
                });
            await this._executeHooks(this.postPageCloseHooks, browserController, page);
            this.emit(PAGE_CLOSED, page);
            this._killRetiredBrowserWithNoPages(browserController);
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
    _killRetiredBrowserWithNoPages(browserController) {
        if (browserController.activePages === 0 && this.retiredBrowserControllers.has(browserController)) {
            // Run this with a delay, otherwise page.close()
            // might fail with "Protocol error (Target.closeTarget): Target closed."
            setTimeout(() => {
                this.log.debug('Killing retired browser because it has no active pages', { id: browserController.id });
                this._killBrowser(browserController);
            }, PAGE_CLOSE_KILL_TIMEOUT_MILLIS);
        }
    }
}

module.exports = BrowserPool;
