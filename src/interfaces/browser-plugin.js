const _ = require('lodash');
const { throwImplementationNeeded } = require('./utils');

class BrowserPlugin {
    constructor(library, options = {}) {
        const {
            launchOptions,
            createProxyUrlFunction,
            proxyUrl,
        } = options;

        this.name = this.constructor.name;
        this.library = library;
        this.launchOptions = launchOptions;
        this.createProxyUrlFunction = createProxyUrlFunction;
        this.proxyUrl = proxyUrl;
    }

    async createLaunchOptions() {
        const launchOptions = _.cloneDeep(this.launchOptions);
        const proxyUrl = await this._getProxyUrl();

        if (proxyUrl) {
            await this._addProxyToLaunchOptions(proxyUrl, launchOptions);

            launchOptions.apifyInternalProxyUrl = proxyUrl; // Just an internal dirty hack to illustrate my point
        }

        return launchOptions;
    }

    async launch(finalLaunchOptions) {
        return this._launch(finalLaunchOptions);
    }

    async _addProxyToLaunchOptions(proxyUrl, options) {
        throwImplementationNeeded('_addProxyToLaunchOptions');
    }

    async _launch(finalLaunchOptions) {
        throwImplementationNeeded('_launch');
    }

    _getProxyUrl() {
        if (this.proxyUrl) {
            return this.proxyUrl;
        }

        return this.createProxyUrlFunction && this.createProxyUrlFunction(this);
    }
}

module.exports = BrowserPlugin;
