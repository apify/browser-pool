# Browser Pool - the headless browser manager
Browser Pool is a small, but powerful and extensible library, that allows you to seamlessly
control multiple headless browsers at the same time with only a little configuration, and a
single function call. Currently it supports [Puppeteer](https://github.com/puppeteer/puppeteer),
[Playwright](https://github.com/microsoft/playwright) and it can be easily extended with plugins.

We created Browser Pool because we regularly needed to execute tasks concurrently in many
headless browsers and their pages, but we did not want to worry about launching browsers, closing
browsers, restarting them after crashes and so on. We also wanted to easily and reliably manage
the whole browser / page lifecycle.

You can use Browser Pool for scraping the internet at scale, testing your website
in multiple browsers at the same time or launching web automation robots. We're interested
to hear about your use cases in the [Discussions](https://github.com/apify/browser-pool/discussions).

<!-- toc -->

- [Installation](#installation)
- [Usage](#usage)
- [Launching multiple browsers](#launching-multiple-browsers)
- [Features](#features)
  * [Proxy management](#proxy-management)
  * [Lifecycle management with hooks](#lifecycle-management-with-hooks)
  * [Single API for common operations](#single-api-for-common-operations)
  * [(UNSTABLE) Extensibility with plugins](#unstable-extensibility-with-plugins)
- [API Reference](#api-reference)

<!-- tocstop -->

## Installation
Use NPM or Yarn to install `browser-pool`. Note that `browser-pool` does not come preinstalled
with browser automation libraries. This allows you to choose your own libraries and their
versions and it also makes `browser-pool` much smaller.

Run this command to install `browser-pool` and the `playwright` browser automation library.
```bash
npm install browser-pool playwright
```

## Usage
This simple example shows how to open a page in a browser using Browser Pool.
We use the provided `PlaywrightPlugin` to wrap a Playwright installation of
your own. By calling `browserPool.newPage()` you launch a new Firefox browser
and open a new page in that browser.

```js
const { BrowserPool, PlaywrightPlugin } = require('browser-pool');
const playwright = require('playwright');

const browserPool = new BrowserPool({
    browserPlugins: [new PlaywrightPlugin(playwright.chromium)],
});

// An asynchronous IIFE (immediately invoked function expression)
// allows us to use the 'await' keyword.
(async () => {
    // Launches Chromium with Playwright and returns a Playwright Page.
    const page1 = await browserPool.newPage();
    // You can interact with the page as you're used to.
    await page1.goto('https://example.com');

    // Opens a second page in the same browser.
    const page2 = await browserPool.newPage();

    // When you're done, clean up the browser pool.
    await browserPool.destroy();
})();
```

> Browser Pool uses the same asynchronous API as the underlying automation libraries which means
extensive use of Promises and the `async` / `await` pattern. [Visit MDN to learn more](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await).

## Launching multiple browsers
The basic example shows how to launch a single browser, but the purpose
of Browser Pool is to launch many browsers. This is done automatically
in the background simply by providing the relevant plugins and calling
`browserPool.newPage()`.

```js
const { BrowserPool, PlaywrightPlugin } = require('browser-pool');
const playwright = require('playwright');

const browserPool = new BrowserPool({
    browserPlugins: [
        new PlaywrightPlugin(playwright.chromium),
        new PlaywrightPlugin(playwright.firefox),
        new PlaywrightPlugin(playwright.webkit),
    ],
});

(async () => {
    // Open 4 pages in 3 browsers. The browsers are launched
    // in a round-robin fashion based on the plugin order.
    const chromiumPage = await browserPool.newPage();
    const firefoxPage = await browserPool.newPage();
    const webkitPage = await browserPool.newPage();
    const chromiumPage2 = await browserPool.newPage();

    await browserPool.destroy();
})();
```

This round-robin way of opening pages may not be useful for you,
if you need to consistently run tasks in multiple environments.
For that, there's the `newPageWithEachPlugin` function.

```js
const { BrowserPool, PlaywrightPlugin, PuppeteerPlugin } = require('browser-pool');
const playwright = require('playwright');
const puppeteer = require('puppeteer');

const browserPool = new BrowserPool({
    browserPlugins: [
        new PlaywrightPlugin(playwright.chromium),
        new PuppeteerPlugin(puppeteer),
    ],
});

(async () => {
    const pages = await browserPool.newPageWithEachPlugin();
    pages.forEach(page => {
        // run some task with each page
        // pages are in order of plugins
        // [playwrightPage, puppeteerPage]
    });

    await browserPool.destroy();
})();
```

## Features
Besides a simple interface for launching browsers, Browser Pool includes
other helpful features that make browser management more convenient.

### Proxy management
When scraping at scale or testing websites from multiple geolocations,
one often needs to use proxy servers. Setting up an authenticated proxy
in Playwright or Puppeteer can be cumbersome, so we created a helper
that does all the heavy lifting for you. Simply provide a proxy URL
with authentication credentials, and you're done.

```js
const browserPool = new BrowserPool(puppeteer, {
    proxyUrl: 'http://<username>:<password>@proxy.com:8000'
})
```

### Lifecycle management with hooks
Browser Pool allows you to manage the full browser / page lifecycle
by attaching hooks to the most important events. Asynchronous hooks
are supported, and their execution order is guaranteed.

```js
const browserPool = new BrowserPool({
    browserPlugins: [
        new PlaywrightPlugin(playwright.chromium),
    ],
    preLaunchHooks: [(pageId, launchContext) => {
        // You can use pre-launch hooks to make dynamic changes
        // to the launchContext, such as changing a proxyUrl
        // or updating the browser launchOptions
    }],
    postPageCreateHooks: [(page, browserController) => {
        // It makes sense to make global changes to pages
        // in post-page-create hooks. For example, you can
        // inject some JavaScript library, such as jQuery.
    }]
});
```

> See the API Documentation for all hooks and their arguments.

### Single API for common operations
Puppeteer and Playwright handle some things differently. Browser Pool
attempts to remove those differences for the most common use-cases.

```js
// Playwright
const cookies = await context.cookies();
await context.addCookies(cookies);

// Puppeteer
const cookies = await page.cookies();
await page.setCookie(...cookies);

// BrowserPool uses the same API for all plugins
const cookies = await browserController.getCookies(page);
await browserController.setCookies(page, cookies);
```

### (UNSTABLE) Extensibility with plugins
A new super cool browser automation library appears? No problem, we add
a simple plugin to Browser Pool and it automagically works.

> The BrowserPlugin and BrowserController interfaces are unstable and may
> change if we find some implementation to be sub-optimal.

## API Reference
All public classes, methods and their parameters can be inspected in this API reference.

{{>all-docs~}}

