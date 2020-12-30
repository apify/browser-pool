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
    browserPlugins: [new PlaywrightPlugin(playwright.firefox)],
});

// An asynchronous IIFE (immediately invoked function expression)
// allows us to use the 'await' keyword.
(async () => {
    // Launches Firefox with Playwright and returns a Playwright Page.
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

## Features

plugins
single API
proxy improvements
cookie settings


## API Reference
All public classes, methods and their parameters can be inspected in this API reference.

{{>all-docs~}}

