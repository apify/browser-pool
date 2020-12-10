class BrowserPool extends EventEmitter {
    constructor(options = {}) {
        const {
            // The Browsers to be rotated ie class that implements the required interface.
            // Rotation - round robin. In the future by some weight option in plugin.
            browserPlugins: [
                new PlayWrightPlugin(playwright["chromium"], {launchOptions: {}, proxyUrl, createProxyUrlFunction}),
                new PlayWrightPlugin(playwright["firefox"]),
                new PuppeteerPlugin(puppeteer),
            ],
            maxOpenPagesPerInstance = 50,
            retireInstanceAfterPageCount = 100,
            operationTimeoutSecs = 15,
            instanceKillerIntervalSecs = 60,
            killInstanceAfterSecs = 300,
            keepOriginalPageClose = false.
            // public
            preLaunchHooks = [async (plugin, launchOptions) =>], // Proxy setting
            postLaunchHooks = [async (browserController) =>],
            prePageCreateHooks = [async (browserController) =>],
            postPageCreateHooks = [async (browserController, page) =>],
            prePageCloseHooks = [async (browserController, page) =>],
            postPageCloseHooks = [async (browserController, page) =>],
        } = options;
        super();

        // In the browser pool only the browser rotation should be handled.
        // Every browser might want to handle the page reuse differently.
        // For example puppeteer pool is not using it, but in playwright it is an performance benefit.
        this.browserPool = new Map()
        this.pagesToBrowserControler = new WeakMap()

    }

    getBrowserWrapperByPage(page) {}

    // Returns existing pending page or new page. Emits `pageCreated` event. Name alternatives: retrievePage, getPage.
    // I think that new page is rather confusing because it does not mean the page is always new.
    async newPage() {}

    async newPageInNewBrowser() {}

    // Waits for pending jobs to finish.
    async retireBrowser(browser) {}

    // Closes all browsers and clears all event listeners.
    async retire() {}

    // Kills all browsers...
    async destroy() {}

}

const browserPool = new BrowserPool()

// Events
// We could get some inspiration from https://github.com/jsoverson/hackium#plugin-api
// This should be handled outside of the browser pool.
// Pool should only return the page that is than manipulated by crawlers.
browserPool.on("pageCreated", async (page) => await pageCreatedHandler(page))
browserPool.on("pageClosed", async (page) => await pageRecycledHandler(page))

// Only browser created and closed events should be supported.
browserPool.on("browserLaunched", async (browserWrapper) => await browserCreatedHandler(browserWrapper))

// this could be use for the session to be put back to the pool all additional session logic would handled in the crawlers.
browserPool.on("browserRetired", async (browserWrapper) => await browserRetiredHandler(browserWrapper))
browserPool.on("browserClosed", async (browserWrapper) => await browserRetiredHandler(browserWrapper))
