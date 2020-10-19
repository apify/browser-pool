const EventEmitter = require('events');
const defaultLog = require('apify-shared/log');
const { addTimeoutToPromise } = require('./utils');

const {
    BROWSER_LAUNCHED,
    BROWSER_CLOSED,
    BROWSER_RETIRED,
    PAGE_CREATED,
    PAGE_CLOSED,
} = require('./events');

const PROCESS_KILL_TIMEOUT_MILLIS = 5000;
const PAGE_CLOSE_KILL_TIMEOUT_MILLIS = 1000;

defaultLog.setLevel(defaultLog.LEVELS.DEBUG);

class BrowserPool extends EventEmitter {
    constructor(options = {}) {
        const {
            browserControllerPlugins,
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

        this.browserControllerPlugins = browserControllerPlugins;
        this.maxOpenPagesPerBrowser = maxOpenPagesPerBrowser;
        this.retireBrowserAfterPageCount = retireBrowserAfterPageCount;
        this.operationTimeoutSecs = operationTimeoutSecs;
        this.killInstanceAfterSecs = killInstanceAfterSecs;
        this.keepOriginalPageClose = keepOriginalPageClose; // Not sure about the implementation of this.

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

        this.instanceKillerInterval = setInterval(
            () => this._killRetiredBrowsers(),
            instanceKillerIntervalSecs * 1000,
        );

        setInterval(
            () => this.log.info(
                'STATS',
                {
                    active: Object.values(this.activeBrowserControllers).length,
                    retiredBrowserControllers: Object.values(this.retiredBrowserControllers).length,
                },
            ),
            10 * 1000,
        );
        this.log = defaultLog;
    }

    // Returns existing pending page or new page. Emits `pageCreated` event. Name alternatives: retrievePage, getPage.
    // I think that new page is rather confusing because it does not mean the page is always new.
    async newPage() {
        let browserController = this._pickBrowserWithFreeCapacity();

        if (!browserController) browserController = await this._launchBrowser();
        return this._createPageForBrowser(browserController);
    }

    async newPageInNewBrowser() {
        const browserController = this._launchBrowser();
        return this._createPageForBrowser(browserController);
    }

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
                this.retireBrowser(browserController);
            }

            this._overridePageClose(page);
            this.emit(PAGE_CREATED, page); // @TODO: CONSIDER renaming this event.
            await this._executeHooks(this.postPageCreateHooks, browserController, page); // @TODO: Not sure about the placement of this hooks
            return page;
        } catch (err) {
            this.retireBrowser(browserController);
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

    retireBrowserByPage(page) {
        const browserController = this.getBrowserControllerByPage(page);
        return this._retireBrowser(browserController);
    }

    // Closes all browserControllers and clears all event listeners.
    async retire() {
        Object.values(this.activeBrowserControllers);
    }

    // Kills all browserControllers...
    async destroy() {
        const allOpenBrowsers = Object.values(this.activeBrowserControllers).concat(Object.values(this.retiredBrowserControllers));
        // Maybe PromiseAll
        for (const browserController of allOpenBrowsers) {
            await browserController.kill();
        }

        this.activeBrowserControllers = new Map();
        this.retiredBrowserControllers = new Map();
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
        return this.browserControllerPlugins[Math.floor(Math.random() * this.browserControllerPlugins.length)];
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
                    id: retiredBrowser.id,
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
        }
        this.emit(BROWSER_CLOSED, browserController);
    }

    _overridePageClose(page) {
        const originalPageClose = page.close;

        page.close = async (...args) => {
            const browserController = this.pagesToBrowserControler[page];
            const { id } = browserController;
            console.log('Closing page', browserController.activePages);
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
            await this._executeHooks(this.prePageCloseHooks, browserController, page);
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
