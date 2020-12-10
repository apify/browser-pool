class BrowserPlugin{
    constructor(library, options) {
        this.name = "..."
        this.library = library
        this.launchOptions = options.launchOptions
        this.weight = options.weight // Future
    }

    async createBrowserControllerContext(options){
        const launchOptions = this.launchOptions.clone()
        this._addProxyToLaunchOptions(launchOptions);

        return launchOptions;
    }

    async launch(finalLaunchOptions){
        return this._launch(finalLaunchOptions)
    }

    _addProxyToLaunchOptions(options){

    }

    async _launch(finalLaunchOptions){
        const browser = await this.library.launch(options);
        return new BrowserController(browser)
    }
}

class PuppeteerPlugin extends BrowserPlugin{

}
