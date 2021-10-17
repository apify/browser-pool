import merge from 'lodash.merge';
import { LaunchContext, LaunchContextOptions } from '../launch-context';
import { BrowserController } from './browser-controller';
import { throwImplementationNeeded } from './utils';
import { UnwrapPromise } from '../utils';

/**
 * Each plugin expects an instance of the object with the `.launch()` property.
 * For Puppeteer, it is the `puppeteer` module itself, whereas for Playwright
 * it is one of the browser types, such as `puppeteer.chromium`.
 * `BrowserPlugin` does not include the library. You can choose any version
 * or fork of the library. It also keeps `browser-pool` installation small.
 */
export interface CommonLibrary {
    launch(...args: unknown[]): Promise<CommonBrowser>;
    name?: () => string;
}

/** @internal */
export interface CommonBrowser {
    newPage(...args: unknown[]): Promise<CommonPage>;
}

/** @internal */
export interface CommonPage {
    close(...args: unknown[]): Promise<unknown>;
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
    LibraryOptions extends unknown = Parameters<Library['launch']>[0],
    LaunchResult extends CommonBrowser = UnwrapPromise<ReturnType<Library['launch']>>,
    NewPageOptions = Parameters<LaunchResult['newPage']>[0],
    NewPageResult = UnwrapPromise<ReturnType<LaunchResult['newPage']>>,
> = Partial<Omit<LaunchContextOptions<Library, LibraryOptions, LaunchResult, NewPageOptions, NewPageResult>, 'browserPlugin'>>;

/**
 * The `BrowserPlugin` serves two purposes. First, it is the base class that
 * specialized controllers like `PuppeteerPlugin` or `PlaywrightPlugin` extend.
 * Second, it allows the user to configure the automation libraries and
 * feed them to {@link BrowserPool} for use.
 */
export abstract class BrowserPlugin<
    Library extends CommonLibrary = CommonLibrary,
    LibraryOptions extends unknown = Parameters<Library['launch']>[0],
    LaunchResult extends CommonBrowser = UnwrapPromise<ReturnType<Library['launch']>>,
    NewPageOptions = Parameters<LaunchResult['newPage']>[0],
    NewPageResult = UnwrapPromise<ReturnType<LaunchResult['newPage']>>,
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
        options: CreateLaunchContextOptions<Library, LibraryOptions, LaunchResult, NewPageOptions, NewPageResult> = {},
    ): LaunchContext<Library, LibraryOptions, LaunchResult, NewPageOptions, NewPageResult> {
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

    createController(): BrowserController<Library, LibraryOptions, LaunchResult, NewPageOptions, NewPageResult> {
        return this._createController();
    }

    /**
     * Launches the browser using provided launch context.
     */
    async launch(
        launchContext: LaunchContext<Library, LibraryOptions, LaunchResult, NewPageOptions, NewPageResult> = this.createLaunchContext(),
    ): Promise<LaunchResult> {
        const { proxyUrl } = launchContext;

        if (proxyUrl) {
            await this._addProxyToLaunchOptions(launchContext);
        }

        return this._launch(launchContext);
    }

    /**
     * @private
     */
    // @ts-expect-error Give runtime error as well as compile time
    // eslint-disable-next-line space-before-function-paren, @typescript-eslint/no-unused-vars, max-len
    protected abstract _addProxyToLaunchOptions(launchContext: LaunchContext<Library, LibraryOptions, LaunchResult, NewPageOptions, NewPageResult>): Promise<void> {
        throwImplementationNeeded('_addProxyToLaunchOptions');
    }

    /**
     * @private
     */
    // @ts-expect-error Give runtime error as well as compile time
    // eslint-disable-next-line space-before-function-paren, @typescript-eslint/no-unused-vars, max-len
    protected abstract _launch(launchContext: LaunchContext<Library, LibraryOptions, LaunchResult, NewPageOptions, NewPageResult>): Promise<LaunchResult> {
        throwImplementationNeeded('_launch');
    }

    /**
     * @private
     */
    // @ts-expect-error Give runtime error as well as compile time
    // eslint-disable-next-line space-before-function-paren
    protected abstract _createController(): BrowserController<Library, LibraryOptions, LaunchResult, NewPageOptions, NewPageResult> {
        throwImplementationNeeded('_createController');
    }
}
