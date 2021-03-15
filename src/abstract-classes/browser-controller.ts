import EventEmitter from 'events';
import { nanoid } from 'nanoid';
import type { Protocol } from 'puppeteer';
import log from '../logger';
import { throwImplementationNeeded } from './utils';
import type BrowserPlugin from './browser-plugin'; // eslint-disable-line import/no-duplicates
import type { Browser } from './browser-plugin'; // eslint-disable-line import/no-duplicates
import type LaunchContext from '../launch-context';

const { BROWSER_CONTROLLER_EVENTS: { BROWSER_CLOSED } } = require('../events');

const PROCESS_KILL_TIMEOUT_MILLIS = 5000;

/**
 * Common interface for browser cookies
 */
export interface BrowserControllerCookie {
    name: string;
    value: string;
    /**
     * either url or domain / path are required. Optional.
     */
    url?: string;
    /**
     * either url or domain / path are required Optional.
     */
    domain?: string;
    /**
     * either url or domain / path are required Optional.
     */
    path?: string;
    /**
     * Unix time in seconds. Optional.
     */
    expires?: number;
    /**
     * Optional.
     */
    httpOnly?: boolean;
    /**
     * Optional.
     */
    secure?: boolean;
    /**
     * Optional.
     */
    sameSite?: Protocol.Network.CookieSameSite;
}

/**
 * The `BrowserController` serves two purposes. First, it is the base class that
 * specialized controllers like `PuppeteerController` or `PlaywrightController`
 * extend. Second, it defines the public interface of the specialized classes
 * which provide only private methods. Therefore, we do not keep documentation
 * for the specialized classes, because it's the same for all of them.
 * @hideconstructor
 */
export default class BrowserController<
    BrowserLibrary extends Browser,
    Page extends object,
    LaunchOptions extends Record<string, any>,
    PageOptions extends Record<string, any>,
> extends EventEmitter {
    id: string;

    /**
     * The `BrowserPlugin` instance used to launch the browser.
     */
    browserPlugin: BrowserPlugin<BrowserLibrary, Page, LaunchOptions, PageOptions>

    /**
     * Browser representation of the underlying automation library.
     */
    browser: BrowserLibrary;

    /**
     * The configuration the browser was launched with.
     */
    launchContext: LaunchContext<BrowserLibrary, Page, LaunchOptions, PageOptions>;

    isActive: boolean;

    supportsPageOptions: boolean;

    isActivePromise: Promise<void>;

    hasBrowserPromise: Promise<void>;

    protected _activate!: () => any;

    protected commitBrowser!: () => any;

    activePages: number;

    totalPages: number;

    lastPageOpenedAt: number;

    constructor(browserPlugin: BrowserPlugin<BrowserLibrary, Page, LaunchOptions, PageOptions>) {
        super();

        this.id = nanoid();
        this.browserPlugin = browserPlugin;
        this.browser = undefined as any;
        this.launchContext = undefined as any;
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
    activate(): void {
        if (!this.browser) {
            throw new Error('Cannot activate BrowserController without an assigned browser.');
        }
        this._activate();
        this.isActive = true;
    }

    /**
     * @ignore
     */
    assignBrowser(browser: BrowserLibrary, launchContext: LaunchContext<BrowserLibrary, Page, LaunchOptions, PageOptions>): void {
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
     */
    async close(): Promise<void> {
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
     */
    async kill(): Promise<void> {
        await this.hasBrowserPromise;
        await this._kill();
        this.emit(BROWSER_CLOSED, this);
    }

    /**
     * Opens new browser page.
     *
     * @ignore
     */
    async newPage(pageOptions?: PageOptions): Promise<Page> {
        this.activePages++;
        this.totalPages++;
        await this.isActivePromise;
        const page = await this._newPage(pageOptions);
        this.lastPageOpenedAt = Date.now();
        return page;
    }

    /**
     */
    async setCookies(page: Page, cookies: BrowserControllerCookie[]): Promise<void> {
        return this._setCookies(page, cookies);
    }

    /**
     */
    async getCookies(page: Page): Promise<BrowserControllerCookie[]> {
        return this._getCookies(page);
    }

    /**
     * @protected
     */
    async _close(): Promise<void> {
        throwImplementationNeeded('_close');
    }

    /**
     * @protected
     */
    async _kill(): Promise<void> {
        throwImplementationNeeded('_kill');
    }

    /**
     * @protected
     */
    async _newPage(_pageOptions?: PageOptions): Promise<Page> { // eslint-disable-line @typescript-eslint/no-unused-vars
        throwImplementationNeeded('_newPage');
    }

    /**
     * @protected
     */
    async _setCookies(_page: Page, _cookies: BrowserControllerCookie[]): Promise<void> { // eslint-disable-line @typescript-eslint/no-unused-vars
        throwImplementationNeeded('_setCookies');
    }

    /**
     * @protected
     */
    async _getCookies(_page: Page): Promise<BrowserControllerCookie[]> { // eslint-disable-line @typescript-eslint/no-unused-vars
        throwImplementationNeeded('_getCookies');
    }
}
