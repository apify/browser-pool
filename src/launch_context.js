class LaunchContext {
    /**
     * @param {object} options
     * @param {BrowserPlugin} options.browserPlugin
     * @param {object} options.launchOptions
     * @param {string} [options.id]
     * @param {string} [options.proxyUrl]
     */
    constructor(options) {
        const {
            id,
            browserPlugin,
            launchOptions,
            proxyUrl,
        } = options;

        this.id = id;
        this.browserPlugin = browserPlugin;
        this.launchOptions = launchOptions;

        this._proxyUrl = proxyUrl;
        this._reservedFieldNames = Reflect.ownKeys(this);
    }

    /**
     * Extend the launch context with any extra fields.
     * This is useful to keep state information relevant
     * to the browser being launched.
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
