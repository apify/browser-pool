import { EventEmitter } from 'events';
import type { BrowserContext } from 'playwright';

export interface BrowserOptions {
    browserContext: BrowserContext;
    version: string;
}

/**
 * Browser wrapper created to have consistent API with persistent and non-persistent contexts.
 */
export default class Browser extends EventEmitter {
    browserContext: BrowserContext;

    _version: string;

    _isConnected: boolean;

    constructor(options: BrowserOptions) {
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
     */
    contexts(): BrowserContext[] {
        return [this.browserContext];
    }

    /**
     * Indicates that the browser is connected.
     */
    isConnected() {
        return this._isConnected;
    }

    /**
     * Method added for API consistency.
     * Should not be used.
     * Throws an error if called.
     */
    async newContext() {
        throw new Error('Could not call `newContext()` on browser, when `useIncognitoPages` is set to `false`');
    }

    /**
     * Creates a new page in a new browser context. Closing this page will close the context as well.
     * @param  {...any} args - New Page options. See https://playwright.dev/docs/next/api/class-browser#browsernewpageoptions.
     */
    async newPage(...args: any) {
        // TODO: BrowserContext.newPage doesn't allow arguments
        return (this.browserContext.newPage as any)(...args);
    }

    /**
    * Returns the browser version.
    */
    version(): string {
        return this._version;
    }
}
