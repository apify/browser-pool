import path from 'path';
import os from 'os';
import { nanoid } from 'nanoid';
import type BrowserPlugin from './abstract-classes/browser-plugin'; // eslint-disable-line import/no-duplicates
import type { Launcher } from './abstract-classes/browser-plugin'; // eslint-disable-line import/no-duplicates

export interface LaunchContextOptions<BrowserLauncher extends Launcher, BrowserLibrary, Page extends object, LaunchOptions, PageOptions> extends LaunchContextDynamicProps {
    /**
     * The `BrowserPlugin` instance used to launch the browser.
     */
    browserPlugin?: BrowserPlugin<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions>;
    /**
     *  To make identification of `LaunchContext` easier, `BrowserPool` assigns
     *  the `LaunchContext` an `id` that's equal to the `id` of the page that
     *  triggered the browser launch. This is useful, because many pages share
     *  a single launch context (single browser).
     */
    id?: string;
    launchOptions?: LaunchOptions;
    proxyUrl?: string;
    /**
     * By default pages share the same browser context.
     * If set to true each page uses its own context that is destroyed once the page is closed or crashes.
     */
    useIncognitoPages?: boolean;
    /**
     * Path to a User Data Directory, which stores browser session data like cookies and local storage.
     */
    userDataDir?: string;
}

export interface LaunchContextDynamicProps {
    [key: string]: any;
}

/**
 * `LaunchContext` holds information about the launched browser. It's useful
 * to retrieve the `launchOptions`, the proxy the browser was launched with
 * or any other information user chose to add to the `LaunchContext` by calling
 * its `extend` function. This is very useful to keep track of browser-scoped
 * values, such as session IDs.
 *
 * @hideconstructor
 */
export default class LaunchContext<
    BrowserLauncher extends Launcher,
    BrowserLibrary,
    Page extends object, // eslint-disable-line
    LaunchOptions extends Record<string, any>,
    PageOptions extends Record<string, any>,
> implements LaunchContextDynamicProps {
    [key: string]: any;

    id: NonNullable<LaunchContextOptions<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions>['id']>;

    launchOptions: NonNullable<LaunchContextOptions<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions>['launchOptions']>;

    browserPlugin: LaunchContextOptions<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions>['browserPlugin'];

    useIncognitoPages: LaunchContextOptions<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions>['useIncognitoPages'];

    userDataDir: NonNullable<LaunchContextOptions<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions>['userDataDir']>;

    protected _proxyUrl?: string;

    protected _reservedFieldNames: (string|symbol)[];

    anonymizedProxyUrl?: string;

    constructor(options: LaunchContextOptions<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions> = {}) {
        const {
            id = nanoid(),
            browserPlugin,
            launchOptions,
            proxyUrl,
            useIncognitoPages,
            userDataDir = path.join(os.tmpdir(), nanoid()),
        } = options;

        this.id = id;
        this.browserPlugin = browserPlugin;
        this.launchOptions = launchOptions || {} as any;
        this.useIncognitoPages = useIncognitoPages;
        this.userDataDir = userDataDir;

        this._proxyUrl = proxyUrl;
        this._reservedFieldNames = Reflect.ownKeys(this);
    }

    /**
     * Extend the launch context with any extra fields.
     * This is useful to keep state information relevant
     * to the browser being launched. It ensures that
     * no internal fields are overridden and should be
     * used instead of property assignment.
     */
    extend(fields: Record<string, any>): void {
        Object.entries(fields).forEach(([key, value]) => {
            if (this._reservedFieldNames.includes(key)) {
                throw new Error(`Cannot extend LaunchContext with key: ${key}, because it's reserved.`);
            } else {
                (this as any)[key] = value;
            }
        });
    }

    /**
     * Sets a proxy URL for the browser.
     * Use `undefined` to unset existing proxy URL.
     */
    set proxyUrl(url: string | undefined) {
        this._proxyUrl = url && new URL(url).href;
    }

    /**
     * Returns the proxy URL of the browser.
     */
    get proxyUrl(): string | undefined {
        return this._proxyUrl;
    }
}
