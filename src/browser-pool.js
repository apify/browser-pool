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

// @TODO: Probably should rename all browser stuff to BrowserController stuff
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

        // hooks
        this.preLaunchHooks = preLaunchHooks;
        this.postLaunchHooks = postLaunchHooks;
        this.prePageCreateHooks = prePageCreateHooks;
        this.postPageCreateHooks = postPageCreateHooks;
        this.prePageCloseHooks = prePageCloseHooks;
        this.postPageCloseHooks = postPageCloseHooks;

        this.activeBrowsers = new Map();
        this.retiredBrowsers = new Map();
        this.pagesToBrowserControler = new WeakMap();

        this.instanceKillerInterval = setInterval(
            () => this._killRetiredBrowsers(),
            instanceKillerIntervalSecs * 1000,
        );

        setInterval(
            () => this.log.info(
                'STATS',
                {
                    active: Object.values(this.activeBrowsers).length,
                    retiredBrowsers: Object.values(this.retiredBrowsers).length,
                },
            ),
            10 * 1000,
        );
        this.log = defaultLog;
    }

    // Returns existing pending page or new page. Emits `pageCreated` event. Name alternatives: retrievePage, getPage.
    // I think that new page is rather confusing because it does not mean the page is always new.
    async newPage() {
        let browser = this._pickBrowserWithFreeCapacity();

        if (!browser) browser = await this._launchBrowser();
        return this._createPageForBrowser(browser);
    }

    async newPageInNewBrowser() {
        const browser = this._launchBrowser();
        return this._createPageForBrowser(browser);
    }

    getBrowserControllerByPage(page) {
        return this.pagesToBrowserControler[page];
    }

    async _createPageForBrowser(browser) {
        try {
            await this._executeHooks(this.prePageCreateHooks, browser);
            const page = await addTimeoutToPromise(
                browser.newPage(),
                this.operationTimeoutSecs * 1000,
                'browser.newPage() timed out.',
            );
            this.pagesToBrowserControler[page] = browser;

            if (browser.totalPages >= this.retireBrowserAfterPageCount) {
                this.retireBrowser(browser);
            }

            this._overridePageClose(page);
            this.emit(PAGE_CREATED, page); // @TODO: CONSIDER renaming this event.
            await this._executeHooks(this.postPageCreateHooks, browser, page); // @TODO: Not sure about the placement of this hooks
            return page;
        } catch (err) {
            this.retireBrowser(browser);
            const betterError = new Error(`browser.newPage() failed: ${browser.id}.`);
            betterError.stack = err.stack;
            throw betterError;
        }
    }

    // Waits for pending jobs to finish.
    retireBrowser(browser) {
        const { id } = browser;

        if (!this.activeBrowsers[id]) return; // RETIRED ALREADY;
        this.retiredBrowsers[id] = browser;
        this.emit(BROWSER_RETIRED, browser);
        delete this.activeBrowsers[id];
    }

    // Closes all browsers and clears all event listeners.
    async retire() {
        Object.values(this.activeBrowsers);
    }

    // Kills all browsers...
    async destroy() {
        const allOpenBrowsers = Object.values(this.activeBrowsers).concat(Object.values(this.retiredBrowsers));
        // Maybe PromiseAll
        for (const openBrowser of allOpenBrowsers) {
            await openBrowser.kill();
        }

        this.activeBrowsers = new Map();
        this.retiredBrowsers = new Map();
    }

    async _launchBrowser() {
        const browserPlugin = this._pickNewBrowserPluginToLaunch();
        const launchOptions = await browserPlugin.createLaunchOptions();

        await this._executeHooks(this.preLaunchHooks, browserPlugin, launchOptions);

        const browser = await browserPlugin.launch(launchOptions);
        this.log.debug('Launched new browser', { id: browser.id, name: browser.name });

        this.emit(BROWSER_LAUNCHED, browser);
        await this._executeHooks(this.postLaunchHooks, browser);

        this.activeBrowsers[browser.id] = browser;

        return browser;
    }

    _pickNewBrowserPluginToLaunch() {
        return this.browserPlugins[Math.floor(Math.random() * this.browserPlugins.length)];
    }

    _pickBrowserWithFreeCapacity() {
        return Object
            .values(this.activeBrowsers)
            .find((inst) => inst.activePages < this.maxOpenPagesPerBrowser);
    }

    async _killRetiredBrowsers() {
        const retiredBrowsers = Object.values(this.retiredBrowsers);
        this.log.debug('Retired browsers count', { count: retiredBrowsers.length });

        for (const retiredBrowser of retiredBrowsers) {
            if (Date.now() - retiredBrowser.lastPageOpenedAt > this.killInstanceAfterMillis) {
                this.log.debug('killing retired browser after period of inactivity', {
                    id: retiredBrowser.id,
                    killInstanceAfterSecs: this.killInstanceAfterSecs,
                });
                this._killBrowser(retiredBrowser);
                return;
            }

            // NOTE: we are killing instance when the number of pages is less or equal to 1 because there is always about:blank page.
            // @TODO: REEVALUATE - the counting of active pages is done internally now, so the about blank should not affect this.
            if (retiredBrowser.activePages === 0) {
                this.log.debug('Killing retired browser because it has no open tabs', { id: retiredBrowser.id });
                this._killBrowser(retiredBrowser);
            }
        }
    }

    async _killBrowser(browser) {
        try {
            const { id } = browser;

            setTimeout(() => {
                // This is here because users reported that it happened
                // that error `TypeError: Cannot read property 'kill' of null` was thrown.
                // Likely Chrome process wasn't started due to some error ...
                browser.kill();
            }, PROCESS_KILL_TIMEOUT_MILLIS);

            delete this.retiredInstances[id];
            await browser.close();
        } catch (e) {
            // Do nothing. If it is impossible to kill it is already dead.
        }
        this.emit(BROWSER_CLOSED, browser);
    }

    _overridePageClose(page) {
        const originalPageClose = page.close;

        page.close = async (...args) => {
            const browser = this.pagesToBrowserControler[page];
            const { id } = browser;
            console.log('Closing page', browser.activePages);
            await this._executeHooks(this.prePageCloseHooks, browser, page);

            if (browser.activePages === 0 && this.retiredBrowsers[id]) {
                // Run this with a delay, otherwise page.close()
                // might fail with "Protocol error (Target.closeTarget): Target closed."
                setTimeout(() => {
                    this.log.debug('Killing retired browser because it has no active pages', { id });
                    this._killBrowser(browser);
                }, PAGE_CLOSE_KILL_TIMEOUT_MILLIS);
            }
            await originalPageClose.apply(page, args)
                .catch((err) => {
                    this.log.debug('Page.close() failed', { errorMessage: err.message, id });
                });
            this.emit(PAGE_CLOSED, page);
            await this._executeHooks(this.prePageCloseHooks, browser, page);
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
