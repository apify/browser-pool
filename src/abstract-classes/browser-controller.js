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

        const { browser, proxyUrl, anonymizedProxy, browserPlugin, ...rest } = options;
        this.id = nanoid();
        this.browserPlugin = browserPlugin;
        this.browser = browser;
        this.activePages = 0;
        this.totalPages = 0;
        this.lastPageOpenedAt = Date.now(); // Maybe more like last used at.
        this.proxyUrl = proxyUrl;
        this.anonymizedProxy = anonymizedProxy;

        this.userData = {};

        Object.assign(this, rest);
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

    /**
     *
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

    async _close() {
        throwImplementationNeeded('_close');
    }

    async _kill() {
        throwImplementationNeeded('_kill');
    }

    async _newPage() {
        throwImplementationNeeded('_newPage');
    }

    async _setCookies(page, cookies) {
        throwImplementationNeeded('_setCookies');
    }

    async _getCookies() {
        throwImplementationNeeded('_getCookies');
    }
}

module.exports = BrowserController;
