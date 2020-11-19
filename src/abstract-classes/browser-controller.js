const EventEmitter = require('events');
const { nanoid } = require('nanoid');
const { throwImplementationNeeded } = require('./utils');
const { BROWSER_CONTROLLER_EVENTS: { BROWSER_KILLED, BROWSER_CLOSED, BROWSER_TERMINATED } } = require('../events');

/**
 * BrowserController abstract class is a abstract wrapper of any browser automation library.
 * This class defines necessary methods that needs to be implemented for browser pool rotation logic.
 */
class BrowserController extends EventEmitter {
    constructor(options) {
        super();

        const { browser, proxyUrl, browserPlugin } = options;
        this.id = nanoid();
        this.browser = browser;
        this.activePages = 0;
        this.totalPages = 0;
        this.lastPageOpenedAt = Date.now(); // Maybe more like last used at.
        this.proxyUrl = proxyUrl;
        this.browserPlugin = browserPlugin;
        this.userData = {};
    }

    /**
     * Closes the browser.
     * Emits respective events.
     * @return {Promise<void>}
     */
    async close() {
        await this._close();
        this.emit(BROWSER_CLOSED, this);
        this.emit(BROWSER_TERMINATED, this);
    }

    /**
     * Kills the browser process.
     * Emits respective events.
     * @return {Promise<void>}
     */
    async kill() {
        await this._kill();
        this.emit(BROWSER_KILLED, this);
        this.emit(BROWSER_TERMINATED, this);
    }

    /**
     * Opens new browser page.
     * @return {Promise<void>}
     */
    async newPage() {
        this.activePages++;
        this.totalPages++;
        const page = await this._newPage();
        this.lastPageOpenedAt = Date.now();
        return page;
    }

    // @TODO: To page or to browser?
    async setCookies(cookies) {
        return this._setCookies(cookies);
    }

    async getCookies() {
        return this._getCookies();
    }

    async _close() {
        throwImplementationNeeded('_close');
    }

    async _kill() {
        throwImplementationNeeded('_kill');
    }

    async _newPage() {
        throwImplementationNeeded('_newPage');
    }

    async _setCookies(cookies) {}

    async _getCookies() {}
}

module.exports = BrowserController;
