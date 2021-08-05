import { BrowserContext } from 'playwright';
import { TypedEmitter } from 'tiny-typed-emitter';

export interface BrowserOptions {
    browserContext: BrowserContext;
    version: string;
}

export interface BrowserEvents {
    disconnected: () => void;
}

/**
 * Browser wrapper created to have consistent API with persistent and non-persistent contexts.
 */
export class Browser extends TypedEmitter<BrowserEvents> {
    browserContext: BrowserContext;

    private _version: string;

    private _isConnected = true;

    constructor(options: BrowserOptions) {
        super();

        const { browserContext, version } = options;
        this.browserContext = browserContext;

        this._version = version;

        this.browserContext.on('close', () => {
            this._isConnected = false;
            this.emit('disconnected');
        });
    }

    /**
     * Closes browser and all pages/contexts assigned to it.
     */
    async close(): Promise<void> {
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
     * @returns {boolean}
     */
    isConnected(): boolean {
        return this._isConnected;
    }

    /**
     * Method added for API consistency.
     * Should not be used.
     * Throws an error if called.
     */
    async newContext(): Promise<never> {
        throw new Error('Could not call `newContext()` on browser, when `useIncognitoPages` is set to `false`');
    }

    /**
     * Creates a new page in a new browser context. Closing this page will close the context as well.
     * @param args - New Page options. See https://playwright.dev/docs/next/api/class-browser#browsernewpageoptions.
     */
    async newPage(...args: Parameters<BrowserContext['newPage']>): ReturnType<BrowserContext['newPage']> {
        return this.browserContext.newPage(...args);
    }

    /**
    * Returns the browser version.
    */
    version(): string {
        return this._version;
    }
}
