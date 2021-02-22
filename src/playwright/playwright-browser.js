const EventEmitter = require('events');
const log = require('../logger');
/**
 * @typedef PlaywrightBrowserOptions
 * @param {import('playwright').BrowserContext} browserContext
 * @param {string} version
 *
*/

/**
 * Browser wrapper created to have consistent API with persistent and non-persistent contexts.
 */
class PlaywrightBrowser extends EventEmitter {
    /**
     *
     * @param {PlaywrightBrowserOptions} options
     */
    constructor(options = {}) {
        super();

        const { browserContext, version } = options;
        this.browserContext = browserContext;

        this._version = version;
        this._isConnected = true;

        this.browserContext.on('close', () => {
            this._isConnected = false;
            this.emit('disconnected');
        });
    }

    /**
     * Closes browser and all pages/contexts assigned to it.
     */
    async close() {
        await this.browserContext.close();
    }

    /**
     * Returns an array of all open browser contexts. In a newly created browser, this will return zero browser contexts.
     * @returns {Array<import('playwright').BrowserContext>}
     */
    contexts() {
        return [this.browserContext];
    }

    /**
     * Indicates that the browser is connected.
     * @returns {boolean}
     */

    isConnected() {
        return this._isConnected;
    }

    /**
     * Method added for API consistency.
     * It does not create a new context.
     * It only returns the old one since this class is used only without incognito pages.
     * @returns {import('playwright').BrowserContext}
     */
    async newContext() {
        log.error('Could not call `newContext()` on browser, when `useIncognitoPages` is set to `false`');
        // return same old context to allow API consistance?
        return this.browserContext;
    }

    /**
     * Creates a new page in a new browser context. Closing this page will close the context as well.
     * @param  {...any} args - New Page options. See https://playwright.dev/docs/next/api/class-browser#browsernewpageoptions.
     */
    async newPage(...args) {
        return this.browserContext.newPage(...args);
    }

    /**
    * Returns the browser version.
    * @returns {string} browser version.
    */
    version() {
        return this._version;
    }
}

module.exports = PlaywrightBrowser;
