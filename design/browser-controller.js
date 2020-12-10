// Browser abstract class.
class BrowserController {
    constructor(options) {
        const {browser} = options;
        // After launch this should be the underlying library browser.
        // I guess we only want to wrap the functions for the pool, so the original API should be available under some property.
        this.id = "Zfxeu2" // Auto generated random id
        this.browser = browser
        this.activePages = 0
        this.totalPages = 0
        this.proxyUrl = ""
        this.userData = {}

    }

    close() {}

    kill() {}

    newPage() {}


    // Not sure about these but we need to set the cookies in the pool, so we should have a standardize way
    setCookies() {}

    getCookies() {}

}

class PuppeteerBrowser extends BrowserController {

}
