import { EventEmitter } from 'events';
import type { BrowserContext, Browser as PlaywrightBrowser } from 'playwright';

export interface BrowserOptions {
    browserContext: BrowserContext;
    version: string;
}

/**
 * Browser wrapper created to have consistent API with persistent and non-persistent contexts.
 */
export class Browser extends EventEmitter implements PlaywrightBrowser {
    private _browserContext: BrowserContext;

    private _version: string;

    private _isConnected = true;

    constructor(options: BrowserOptions) {
        super();

        const { browserContext, version } = options;
        this._browserContext = browserContext;

        this._version = version;

        this._browserContext.once('close', () => {
            this._isConnected = false;
            this.emit('disconnected');
        });
    }

    async close(): Promise<void> {
        await this._browserContext.close();
    }

    contexts(): BrowserContext[] {
        return [this._browserContext];
    }

    isConnected(): boolean {
        return this._isConnected;
    }

    version(): string {
        return this._version;
    }

    async newPage(...args: Parameters<BrowserContext['newPage']>): ReturnType<BrowserContext['newPage']> {
        return this._browserContext.newPage(...args);
    }

    async newContext(): Promise<never> {
        throw new Error('Function `newContext()` is not available in incognito mode');
    }

    async newBrowserCDPSession(): Promise<never> {
        throw new Error('Function `newBrowserCDPSession()` is not available in incognito mode');
    }

    async startTracing(): Promise<never> {
        throw new Error('Function `startTracing()` is not available in incognito mode');
    }

    async stopTracing(): Promise<never> {
        throw new Error('Function `stopTracing()` is not available in incognito mode');
    }
}
