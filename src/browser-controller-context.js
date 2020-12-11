class BrowserControllerContext {
    constructor(options) {
        const {
            proxyUrl,
            pluginLaunchOptions = {},
            ...rest
        } = options;

        this.proxyUrl = proxyUrl;
        this.pluginLaunchOptions = pluginLaunchOptions;
        this.anonymizedProxyUrl = null;

        Object.assign(this, rest);
    }

    isProxyUsed() {
        return !!this.proxyUrl;
    }
}

module.exports = BrowserControllerContext;
