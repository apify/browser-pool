import fs from 'fs-extra';
import LaunchContext, { LaunchContextOptions } from '../launch-context';
import type BrowserController from './browser-controller';
import log from '../logger';
import { throwImplementationNeeded } from './utils';

const merge = require('lodash.merge');
const proxyChain = require('proxy-chain');

/**
 * Each plugin expects an instance of the object with the `.launch()` property.
 * For Puppeteer, it is the `puppeteer` module itself, whereas for Playwright
 * it is one of the browser types, such as `puppeteer.chromium`.
 * `BrowserPlugin` does not include the library. You can choose any version
 * or fork of the library. It also keeps `browser-pool` installation small.
 */
export interface Launcher {
    launch(object: unknown): unknown;
    name?: () => string;
}

export interface BrowserPluginOptions<LaunchOptions extends Record<string, any>> {
    /**
     * Options that will be passed down to the automation library. E.g.
     * `puppeteer.launch(launchOptions);`. This is a good place to set
     *  options that you want to apply as defaults. To dynamically override
     *  those options per-browser, see the `preLaunchHooks` of {@link BrowserPool}.
     */
    launchOptions?: LaunchOptions;
    /**
     * Automation libraries configure proxies differently. This helper allows you
     * to set a proxy URL without worrying about specific implementations.
     * It also allows you use an authenticated proxy without extra code.
     */
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

/**
 * The `BrowserPlugin` serves two purposes. First, it is the base class that
 * specialized controllers like `PuppeteerPlugin` or `PlaywrightPlugin` extend.
 * Second, it allows the user to configure the automation libraries and
 * feed them to {@link BrowserPool} for use.
 */
export default class BrowserPlugin<
    BrowserLauncher extends Launcher,
    BrowserLibrary,
    Page extends object,
    LaunchOptions extends Record<string, any>,
    PageOptions extends Record<string, any>,
> {
    name: string;

    library: BrowserLauncher;

    launchOptions: NonNullable<LaunchOptions>;

    proxyUrl: BrowserPluginOptions<LaunchOptions>['proxyUrl'];

    useIncognitoPages: NonNullable<BrowserPluginOptions<LaunchOptions>['useIncognitoPages']>;

    userDataDir: BrowserPluginOptions<LaunchOptions>['userDataDir'];

    constructor(library: BrowserLauncher, options: BrowserPluginOptions<LaunchOptions> = {}) {
        const {
            launchOptions = {},
            proxyUrl,
            useIncognitoPages = false,
            userDataDir,
        } = options;

        this.name = this.constructor.name;
        this.library = library;
        this.launchOptions = launchOptions as any;
        this.proxyUrl = proxyUrl && new URL(proxyUrl).href;
        this.userDataDir = userDataDir;
        this.useIncognitoPages = useIncognitoPages;
    }

    /**
     * Creates a `LaunchContext` with all the information needed
     * to launch a browser. Aside from library specific launch options,
     * it also includes internal properties used by `BrowserPool` for
     * management of the pool and extra features.
     * @ignore
     */
    createLaunchContext(options: Partial<LaunchContextOptions<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions>> = {}): LaunchContext<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions> {
        const {
            id,
            launchOptions = {},
            proxyUrl = this.proxyUrl,
            useIncognitoPages = this.useIncognitoPages,
            userDataDir = this.userDataDir,
        } = options;

        return new LaunchContext({
            id,
            launchOptions: merge({}, this.launchOptions, launchOptions),
            browserPlugin: this,
            proxyUrl,
            useIncognitoPages,
            userDataDir,
        });
    }

    /**
     * @ignore
     */
    createController(): BrowserController<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions> {
        return this._createController();
    }

    /**
     * Launches the browser using provided launch context.
     *
     * @ignore
     */
    async launch(launchContext: LaunchContext<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions> | LaunchContextOptions<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions> = {}): Promise<BrowserLibrary> {
        const { proxyUrl, useIncognitoPages, userDataDir } = launchContext;

        if (proxyUrl) {
            await this._addProxyToLaunchOptions(launchContext);
        }

        if (!useIncognitoPages && userDataDir) {
            await this._ensureDir(userDataDir);
        }

        return this._launch(launchContext);
    }

    /**
     * @private
     */
    async _addProxyToLaunchOptions(_launchContext: LaunchContextOptions<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions>): Promise<void> { // eslint-disable-line
        throwImplementationNeeded('_addProxyToLaunchOptions');
    }

    /**
     * @private
     */
    async _launch(_launchContext: LaunchContextOptions<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions>): Promise<BrowserLibrary> { // eslint-disable-line
        throwImplementationNeeded('_launch');
    }

    /**
     * @private
     */
    _createController(): BrowserController<BrowserLauncher, BrowserLibrary, Page, LaunchOptions, PageOptions> {
        throwImplementationNeeded('_createController');
    }

    /**
     * Starts proxy-chain server - https://www.npmjs.com/package/proxy-chain#anonymizeproxyproxyurl-callback
     * @param {string} proxyUrl
     *  Proxy URL with username and password.
     * @return
     *  URL of the anonymization proxy server that needs to be closed after the proxy is not used anymore.
     * @private
     */
    async _getAnonymizedProxyUrl(proxyUrl: string): Promise<string> {
        let anonymizedProxyUrl;
        try {
            anonymizedProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);
        } catch (e) {
            throw new Error(`BrowserPool: Could not anonymize proxyUrl: ${proxyUrl}. Reason: ${e.message}.`);
        }

        return anonymizedProxyUrl;
    }

    /**
     * @param {string} proxyUrl
     *  Anonymized proxy URL of a running proxy server.
     * @private
     */
    async _closeAnonymizedProxy(proxyUrl: string): Promise<unknown> {
        return proxyChain.closeAnonymizedProxy(proxyUrl, true).catch((err: Error) => {
            log.debug(`Could not close anonymized proxy server.\nCause:${err.message}`);
        });
    }

    /**
     * Checks if proxy URL should be anonymized.
     * @private
     */
    _shouldAnonymizeProxy(proxyUrl?: string): boolean {
        if (proxyUrl) {
            const parsedProxyUrl = proxyChain.parseUrl(proxyUrl);
            if (parsedProxyUrl.username || parsedProxyUrl.password) {
                if (parsedProxyUrl.scheme !== 'http') {
                    throw new Error('Invalid "proxyUrl" option: authentication is only supported for HTTP proxy type.');
                }
                return true;
            }
        }

        return false;
    }

    /**
     * @param {string} dir - Absolute path to the directory.
     */
    async _ensureDir(dir: string): Promise<void> {
        return fs.ensureDir(dir);
    }
}
