const EventEmitter = require('events');
const { nanoid } = require('nanoid');
const log = require('../logger');
const { throwImplementationNeeded } = require('./utils');
const { BROWSER_CONTROLLER_EVENTS: { BROWSER_CLOSED } } = require('../events');

const PROCESS_KILL_TIMEOUT_MILLIS = 5000;

/**
 * The `BrowserController` serves two purposes. First, it is the base class that
 * specialized controllers like `PuppeteerController` or `PlaywrightController`
 * extend. Second, it defines the public interface of the specialized classes
 * which provide only private methods. Therefore, we do not keep documentation
 * for the specialized classes, because it's the same for all of them.
 * @property {string} id
 * @property {BrowserPlugin} browserPlugin
 *  The `BrowserPlugin` instance used to launch the browser.
 * @property {Browser} browser
 *  Browser representation of the underlying automation library.
 * @property {LaunchContext} launchContext
 *  The configuration the browser was launched with.
 * @hideconstructor
 */
class BrowserController extends EventEmitter {
    /**
     * @param {BrowserPlugin} browserPlugin
     */
    constructor(browserPlugin) {
        super();

        this.id = nanoid();
        this.browserPlugin = browserPlugin;
        this.browser = undefined;
        this.launchContext = undefined;
        this.isActive = false;
        this.supportsPageOptions = false;

        this.isActivePromise = new Promise((resolve) => {
            this._activate = resolve;
        });
        this.hasBrowserPromise = new Promise((resolve) => {
            this.commitBrowser = resolve;
        });

        this.activePages = 0;
        this.totalPages = 0;
        this.lastPageOpenedAt = Date.now(); // Maybe more like last used at.
    }

    /**
     * Activates the BrowserController. If you try to open new pages before
     * activation, the pages will get queued and will only be opened after
     * activate is called.
     * @ignore
     */
    activate() {
        if (!this.browser) {
            throw new Error('Cannot activate BrowserController without an assigned browser.');
        }
        this._activate();
        this.isActive = true;
    }

    /**
     * @param {Browser} browser
     * @param {LaunchContext} launchContext
     * @ignore
     */
    assignBrowser(browser, launchContext) {
        if (this.browser) {
            throw new Error('BrowserController already has a browser instance assigned.');
        }
        this.browser = browser;
        this.launchContext = launchContext;
        this.commitBrowser();
    }

    /**
     * Gracefully closes the browser and makes sure
     * there will be no lingering browser processes.
     *
     * Emits 'browserClosed' event.
     * @return {Promise<void>}
     */
    async close() {
        await this.hasBrowserPromise;
        await this._close().catch((err) => {
            log.debug(`Could not close browser.\nCause: ${err.message}`, { id: this.id });
        });
        this.emit(BROWSER_CLOSED, this);
        setTimeout(() => {
            this._kill().catch((err) => {
                log.debug(`Could not kill browser.\nCause: ${err.message}`, { id: this.id });
            });
        }, PROCESS_KILL_TIMEOUT_MILLIS);
    }

    /**
     * Immediately kills the browser process.
     *
     * Emits 'browserClosed' event.
     * @return {Promise<void>}
     */
    async kill() {
        await this.hasBrowserPromise;
        await this._kill();
        this.emit(BROWSER_CLOSED, this);
    }

    /**
     * Opens new browser page.
     * @param {object} pageOptions
     * @return {Promise<Page>}
     * @ignore
     */
    async newPage(pageOptions) {
        this.activePages++;
        this.totalPages++;
        await this.isActivePromise;
        const page = await this._newPage(pageOptions);
        this.lastPageOpenedAt = Date.now();
        return page;
    }

    /**
     * @param page {Object}
     * @param cookies {Array<object>}
     * @return {Promise<void>}
     */
    async setCookies(page, cookies) {
        return this._setCookies(page, cookies);
    }

    /**
     *
     * @param page {Object}
     * @return {Promise<Array<object>>}
     */
    async getCookies(page) {
        return this._getCookies(page);
    }

    /**
     * @return {Promise<void>}
     * @private
     */
    async _close() {
        throwImplementationNeeded('_close');
    }

    /**
     * @return {Promise<void>}
     * @private
     */
    async _kill() {
        throwImplementationNeeded('_kill');
    }

    /**
     * @param {object} pageOptions
     * @return {Promise<Page>}
     * @private
     */
    async _newPage(pageOptions) { // eslint-disable-line no-unused-vars
        throwImplementationNeeded('_newPage');
    }

    /**
     * @param {Page} page
     * @param {object[]} cookies
     * @return {Promise<void>}
     * @private
     */
    async _setCookies(page, cookies) { // eslint-disable-line no-unused-vars
        throwImplementationNeeded('_setCookies');
    }

    /**
     * @param {Page} page
     * @return {Promise<Array<object>>}
     * @private
     */
    async _getCookies(page) { // eslint-disable-line no-unused-vars
        throwImplementationNeeded('_getCookies');
    }
}

module.exports = BrowserController;
