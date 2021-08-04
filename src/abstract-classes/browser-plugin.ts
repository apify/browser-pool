import merge from 'lodash.merge';
import { ensureDir } from 'fs-extra';
import { log } from '../logger';
import { LaunchContext, LaunchContextOptions } from '../launch-context';
import type BrowserController from './browser-controller';
import { throwImplementationNeeded } from './utils';
import { UnwrapPromise } from '../utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires -- TODO: Type this module, and convert import
const proxyChain = require('proxy-chain');

/**
 * Each plugin expects an instance of the object with the `.launch()` property.
 * For Puppeteer, it is the `puppeteer` module itself, whereas for Playwright
 * it is one of the browser types, such as `puppeteer.chromium`.
 * `BrowserPlugin` does not include the library. You can choose any version
 * or fork of the library. It also keeps `browser-pool` installation small.
 */
export interface CommonLibrary {
    launch(...args: unknown[]): unknown;
    name?: () => string;
}

export interface BrowserPluginOptions<LibraryOptions> {
    /**
     * Options that will be passed down to the automation library. E.g.
     * `puppeteer.launch(launchOptions);`. This is a good place to set
     * options that you want to apply as defaults. To dynamically override
     * those options per-browser, see the `preLaunchHooks` of {@link BrowserPool}.
     */
    launchOptions?: LibraryOptions;
    /**
     * Automation libraries configure proxies differently. This helper allows you
     * to set a proxy URL without worrying about specific implementations.
     * It also allows you use an authenticated proxy without extra code.
     */
    proxyUrl?: string;
    /**
     * By default pages share the same browser context.
     * If set to true each page uses its own context that is destroyed once the page is closed or crashes.
     *
     * @default false
     */
    useIncognitoPages?: boolean;
    /**
     * Path to a User Data Directory, which stores browser session data like cookies and local storage.
     */
    userDataDir?: string;
};

export type CreateLaunchContextOptions<
    Library extends CommonLibrary,
    LibraryOptions = Parameters<Library['launch']>[0],
    LaunchResult = UnwrapPromise<ReturnType<Library['launch']>>,
> = Partial<Omit<LaunchContextOptions<Library, LibraryOptions, LaunchResult>, 'browserPlugin'>>;

/**
 * The `BrowserPlugin` serves two purposes. First, it is the base class that
 * specialized controllers like `PuppeteerPlugin` or `PlaywrightPlugin` extend.
 * Second, it allows the user to configure the automation libraries and
 * feed them to {@link BrowserPool} for use.
 */
export abstract class BrowserPlugin<
    Library extends CommonLibrary,
    LibraryOptions = Parameters<Library['launch']>[0],
    LaunchResult = UnwrapPromise<ReturnType<Library['launch']>>,
> {
    name = this.constructor.name;

    library: Library;

    launchOptions: LibraryOptions;

    proxyUrl?: string;

    userDataDir?: string;

    useIncognitoPages: boolean;

    constructor(library: Library, options: BrowserPluginOptions<LibraryOptions> = {}) {
        const {
            launchOptions = {} as LibraryOptions,
            proxyUrl,
            userDataDir,
            useIncognitoPages = false,
        } = options;

        this.library = library;
        this.launchOptions = launchOptions;
        this.proxyUrl = proxyUrl && new URL(proxyUrl).href;
        this.userDataDir = userDataDir;
        this.useIncognitoPages = useIncognitoPages;
    }

    /**
     * Creates a `LaunchContext` with all the information needed
     * to launch a browser. Aside from library specific launch options,
     * it also includes internal properties used by `BrowserPool` for
     * management of the pool and extra features.
     */
    createLaunchContext(
        options: CreateLaunchContextOptions<Library, LibraryOptions, LaunchResult> = {},
    ): LaunchContext<Library, LibraryOptions, LaunchResult> {
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

    createController(): BrowserController {
        return this._createController();
    }

    /**
     * Launches the browser using provided launch context.
     */
    async launch(launchContext = this.createLaunchContext()): Promise<LaunchResult> {
        const { proxyUrl, useIncognitoPages, userDataDir } = launchContext;

        if (proxyUrl) {
            await this._addProxyToLaunchOptions(launchContext);
        }

        if (!useIncognitoPages) {
            await ensureDir(userDataDir);
        }

        return this._launch(launchContext);
    }

    /**
     * @private
     */
    // @ts-expect-error Give runtime error as well as compile time
    // eslint-disable-next-line space-before-function-paren, @typescript-eslint/no-unused-vars
    protected abstract _addProxyToLaunchOptions(launchContext: LaunchContext): Promise<void> {
        throwImplementationNeeded('_addProxyToLaunchOptions');
    }

    /**
     * @private
     */
    // @ts-expect-error Give runtime error as well as compile time
    // eslint-disable-next-line space-before-function-paren, @typescript-eslint/no-unused-vars
    protected abstract _launch(launchContext: LaunchContext): Promise<LaunchResult> {
        throwImplementationNeeded('_launch');
    }

    /**
     * @private
     */
    // @ts-expect-error Give runtime error as well as compile time
    // eslint-disable-next-line space-before-function-paren
    protected abstract _createController(): BrowserController {
        throwImplementationNeeded('_createController');
    }

    /**
     * Starts proxy-chain server - https://www.npmjs.com/package/proxy-chain#anonymizeproxyproxyurl-callback
     * @param proxyUrl Proxy URL with username and password.
     * @return URL of the anonymization proxy server that needs to be closed after the proxy is not used anymore.
     * @private
     */
    protected async _getAnonymizedProxyUrl(proxyUrl: string): Promise<string> {
        try {
            return await proxyChain.anonymizeProxy(proxyUrl);
        } catch (e) {
            throw new Error(`BrowserPool: Could not anonymize proxyUrl: ${proxyUrl}. Reason: ${(e as Error).message}.`);
        }
    }

    /**
     * @param proxyUrl Anonymized proxy URL of a running proxy server.
     * @private
     */
    protected async _closeAnonymizedProxy(proxyUrl: string): Promise<boolean> {
        return proxyChain.closeAnonymizedProxy(proxyUrl, true).catch((err: Error) => {
            log.debug(`Could not close anonymized proxy server.\nCause:${err.message}`);
        });
    }

    /**
     * Checks if proxy URL should be anonymized.
     * @private
     */
    protected _shouldAnonymizeProxy(proxyUrl: string): boolean {
        const parsedProxyUrl = proxyChain.parseUrl(proxyUrl);
        if (parsedProxyUrl.username || parsedProxyUrl.password) {
            if (parsedProxyUrl.scheme !== 'http') {
                throw new Error('Invalid "proxyUrl" option: authentication is only supported for HTTP proxy type.');
            }
            return true;
        }

        return false;
    }
}
