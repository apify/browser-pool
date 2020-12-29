class BrowserControllerContext {
    constructor(options) {
        const {
            proxyUrl,
            launchOptions = {},
            ...rest
        } = options;

        this.proxyUrl = proxyUrl;
        this.launchOptions = launchOptions;
        this.anonymizedProxyUrl = null;

        Object.assign(this, rest);
    }

    isProxyUsed() {
        return !!this.proxyUrl;
    }
}

module.exports = BrowserControllerContext;
