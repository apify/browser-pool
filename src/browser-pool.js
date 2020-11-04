const EventEmitter = require('events');
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
        const {
            browserPlugins,
            maxOpenPagesPerBrowser = 50,
            retireBrowserAfterPageCount = 100,
            operationTimeoutSecs = 15,
            instanceKillerIntervalSecs = 60,
            killInstanceAfterSecs = 300,
            keepOriginalPageClose = false, // public
            preLaunchHooks = [], // Proxy setting
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
        this.operationTimeoutSecs = operationTimeoutSecs;
        this.killInstanceAfterSecs = killInstanceAfterSecs;
        this.keepOriginalPageClose = keepOriginalPageClose; // Not sure about the implementation of this.
        this.instanceKillerIntervalSecs = instanceKillerIntervalSecs;

        // hooks
        this.preLaunchHooks = preLaunchHooks;
        this.postLaunchHooks = postLaunchHooks;
        this.prePageCreateHooks = prePageCreateHooks;
        this.postPageCreateHooks = postPageCreateHooks;
        this.prePageCloseHooks = prePageCloseHooks;
        this.postPageCloseHooks = postPageCloseHooks;

        this.activeBrowserControllers = new Map();
        this.retiredBrowserControllers = new Map();
        this.pagesToBrowserControler = new WeakMap();

        this.log = defaultLog;

        this.instanceKillerInterval = setInterval(
            () => this._killRetiredBrowsers(),
            this.instanceKillerIntervalSecs * 1000,
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
        return this.pagesToBrowserControler[page];
    }

    async _createPageForBrowser(browserController) {
        try {
            await this._executeHooks(this.prePageCreateHooks, browserController);
            const page = await addTimeoutToPromise(
                browserController.newPage(),
                this.operationTimeoutSecs * 1000,
                'browserController.newPage() timed out.',
            );
            this.pagesToBrowserControler[page] = browserController;

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

    // Waits for pending jobs to finish.
    _retireBrowser(browserController) {
        const { id } = browserController;

        if (!this.activeBrowserControllers[id]) return; // RETIRED ALREADY;
        this.retiredBrowserControllers[id] = browserController;
        this.emit(BROWSER_RETIRED, browserController);
        delete this.activeBrowserControllers[id];
    }

    /**
     *
     * @param page {Page}
     * @return {undefined}
     */
    retireBrowserByPage(page) {
        const browserController = this.getBrowserControllerByPage(page);
        return this._retireBrowser(browserController);
    }

    /**
     * Closes all browserControllers
     * @return {Promise<void>}
     */
    async retire() {
        this.instanceKillerInterval = clearInterval(this.instanceKillerInterval);
        const allOpenBrowsers = this._getAllOpenBrowsers();
        // Maybe PromiseAll
        for (const browserController of allOpenBrowsers) {
            await browserController.close();
        }
        this._teardown();
    }

    /**
     * Kills all browserControllers
     * @return {Promise<void>}
     */
    async destroy() {
        this.instanceKillerInterval = clearInterval(this.instanceKillerInterval);

        const allOpenBrowsers = this._getAllOpenBrowsers();
        // Maybe PromiseAll
        for (const browserController of allOpenBrowsers) {
            await browserController.kill();
        }

        this._teardown();
    }

    _teardown() {
        this.activeBrowserControllers = new Map();
        this.retiredBrowserControllers = new Map();

        this.removeAllListeners();
    }

    /**
     *
     * @return {[]}
     * @private
     */
    _getAllOpenBrowsers() {
        const activeBrowserControllers = Object.values(this.activeBrowserControllers) || [];
        const retiredBrowserControllers = Object.values(this.retiredBrowserControllers) || [];

        return activeBrowserControllers.concat(retiredBrowserControllers);
    }

    async _launchBrowser() {
        const browserControllerPlugin = this._pickNewBrowserPluginToLaunch();
        const launchOptions = await browserControllerPlugin.createLaunchOptions();

        await this._executeHooks(this.preLaunchHooks, browserControllerPlugin, launchOptions);

        const browserController = await browserControllerPlugin.launch(launchOptions);
        this.log.debug('Launched new browserController', { id: browserController.id, name: browserController.name });

        this.emit(BROWSER_LAUNCHED, browserController);
        await this._executeHooks(this.postLaunchHooks, browserController);

        this.activeBrowserControllers[browserController.id] = browserController;

        return browserController;
    }

    _pickNewBrowserPluginToLaunch() {
        return this.browserPlugins[Math.floor(Math.random() * this.browserPlugins.length)];
    }

    _pickBrowserWithFreeCapacity() {
        return Object
            .values(this.activeBrowserControllers)
            .find((inst) => inst.activePages < this.maxOpenPagesPerBrowser);
    }

    async _killRetiredBrowsers() {
        const retiredBrowserControllers = Object.values(this.retiredBrowserControllers);
        this.log.debug('Retired browserControllers count', { count: retiredBrowserControllers.length });

        for (const retiredBrowserController of retiredBrowserControllers) {
            if (Date.now() - retiredBrowserController.lastPageOpenedAt > this.killInstanceAfterMillis) {
                this.log.debug('killing retired browserController after period of inactivity', {
                    id: retiredBrowserController.id,
                    killInstanceAfterSecs: this.killInstanceAfterSecs,
                });
                this._killBrowser(retiredBrowserController);
                return;
            }

            // NOTE: we are killing instance when the number of pages is less or equal to 1 because there is always about:blank page.
            // @TODO: REEVALUATE - the counting of active pages is done internally now, so the about blank should not affect this.
            if (retiredBrowserController.activePages === 0) {
                this.log.debug('Killing retired browserController because it has no open tabs', { id: retiredBrowserController.id });
                this._killBrowser(retiredBrowserController);
            }
        }
    }

    async _killBrowser(browserController) {
        try {
            const { id } = browserController;

            setTimeout(() => {
                // This is here because users reported that it happened
                // that error `TypeError: Cannot read property 'kill' of null` was thrown.
                // Likely Chrome process wasn't started due to some error ...
                browserController.kill();
            }, PROCESS_KILL_TIMEOUT_MILLIS);

            delete this.retiredBrowserControllers[id];
            await browserController.close();
        } catch (e) {
            // Do nothing. If it is impossible to kill it is already dead.
        } finally {
            this.emit(BROWSER_CLOSED, browserController);
        }
    }

    _overridePageClose(page) {
        const originalPageClose = page.close;

        page.close = async (...args) => {
            const browserController = this.pagesToBrowserControler[page];
            const { id } = browserController;
            await this._executeHooks(this.prePageCloseHooks, browserController, page);

            if (browserController.activePages === 0 && this.retiredBrowserControllers[id]) {
                // Run this with a delay, otherwise page.close()
                // might fail with "Protocol error (Target.closeTarget): Target closed."
                setTimeout(() => {
                    this.log.debug('Killing retired browserController because it has no active pages', { id });
                    this._killBrowser(browserController);
                }, PAGE_CLOSE_KILL_TIMEOUT_MILLIS);
            }
            await originalPageClose.apply(page, args)
                .catch((err) => {
                    this.log.debug('Page.close() failed', { errorMessage: err.message, id });
                });
            this.emit(PAGE_CLOSED, page);
            await this._executeHooks(this.postPageCloseHooks, browserController, page);
        };
    }

    async _executeHooks(hooks, ...args) {
        if (Array.isArray(hooks) && hooks.length) {
            for (const hook of hooks) {
                await hook(...args);
            }
        }
    }
}

module.exports = BrowserPool;
