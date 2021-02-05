/**
 * `LaunchContext` holds information about the launched browser. It's useful
 * to retrieve the `launchOptions`, the proxy the browser was launched with
 * or any other information user chose to add to the `LaunchContext` by calling
 * its `extend` function. This is very useful to keep track of browser-scoped
 * values, such as session IDs.
 * @property {string} id
 *  To make identification of `LaunchContext` easier, `BrowserPool` assigns
 *  the `LaunchContext` an `id` that's equal to the `id` of the page that
 *  triggered the browser launch. This is useful, because many pages share
 *  a single launch context (single browser).
 * @property {BrowserPlugin} browserPlugin
 *  The `BrowserPlugin` instance used to launch the browser.
 * @property {object} launchOptions
 *  The actual options the browser was launched with, after changes.
 *  Those changes would be typically made in pre-launch hooks.
 * @property {boolean} [useIncognitoPages]
 *  By default pages share the same browser context.
 *  If set to true each page uses its own context that is destroyed once the page is closed or crashes.
 * @property {object} [userDataDir]
 *  Path to a User Data Directory, which stores browser session data like cookies and local storage.
 * @hideconstructor
 */
class LaunchContext {
    /**
     * @param {object} options
     * @param {BrowserPlugin} options.browserPlugin
     * @param {object} options.launchOptions
     * @param {string} [options.id]
     * @param {string} [options.proxyUrl]
     * @param {boolean} [options.useIncognitoPages]
     * @param {string} [options.userDataDir]
     */
    constructor(options) {
        const {
            id,
            browserPlugin,
            launchOptions,
            proxyUrl,
            useIncognitoPages,
            userDataDir,
        } = options;

        this.id = id;
        this.browserPlugin = browserPlugin;
        this.launchOptions = launchOptions;
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
     *
     * @param {object} fields
     */
    extend(fields) {
        Object.entries(fields).forEach(([key, value]) => {
            if (this._reservedFieldNames.includes(key)) {
                throw new Error(`Cannot extend LaunchContext with key: ${key}, because it's reserved.`);
            } else {
                this[key] = value;
            }
        });
    }

    /**
     * Sets a proxy URL for the browser.
     * Use `undefined` to unset existing proxy URL.
     *
     * @param {?string} url
     */
    set proxyUrl(url) {
        this._proxyUrl = url && new URL(url).href;
    }

    /**
     * Returns the proxy URL of the browser.
     * @return {string}
     */
    get proxyUrl() {
        return this._proxyUrl;
    }
}

module.exports = LaunchContext;
