'use strict';

// We do async work so Playwright needs to know when we are ready.
let finishLoading;
const loading = new Promise(resolve => {
    finishLoading = resolve;
});

// Otherwise Playwright won't know what's the tabId.
chrome.webNavigation.onCompleted.addListener(async details => {
    // Different protocols are required, otherwise `onCompleted` won't be emitted.
    if (details.url.toLowerCase() === 'data:text/plain,tabid' && details.frameId === 0) {
        await chrome.tabs.update(details.tabId, {url: 'about:blank#' + encodeURIComponent(JSON.stringify({tabId: details.tabId}))});
    }
});

const isFirefox = navigator.userAgent.includes('Firefox');

// TODO: https://developer.mozilla.org/en-US/docs/Web/API/Cookie_Store_API

// Uncomment this line if there's a cookie memory leak:
// chrome.privacy.network.networkPredictionEnabled.set({value: false});

const translator = new Map();
const counter = new Map();

const getOpenerId = id => {
    if (typeof id !== 'number') {
        throw new Error('Expected `id` to be a number');
    }

    if (translator.has(id)) {
        const opener = translator.get(id);

        if (translator.has(opener)) {
            throw new Error('Opener is not the most ascendent');
        }

        // console.log(`getopener ${id} -> ${opener}`);
        return opener;
    }

    return id;
};

const getCookieURL = cookie => {
    const protocol = cookie.secure ? 'https:' : 'http:';
    const fixedDomain = cookie.domain[0] === '.' ? cookie.domain.slice(1) : cookie.domain;
    const url = `${protocol}//${fixedDomain}${cookie.path}`;

    return url;
};

// Rewrite cookies that were programatically set to tabId instead of openerId.
// This is requried because we cannot reliably get openerId inside Playwright.
chrome.cookies.onChanged.addListener(async changeInfo => {
    if (!changeInfo.removed) {
        const {cookie} = changeInfo;

        const dotIndex = cookie.name.indexOf('.');
        if (dotIndex === -1) {
            return;
        }

        const tabId = Number(cookie.name.slice(0, dotIndex));
        const realCookieName = cookie.name.slice(dotIndex + 1);
        const opener = getOpenerId(tabId);

        if (tabId !== opener) {
            await chrome.cookies.remove({
                name: cookie.name,
                url: getCookieURL(cookie),
                storeId: cookie.storeId,
            });

            delete cookie.hostOnly;
            delete cookie.session;

            await chrome.cookies.set({
                ...cookie,
                name: `${opener}.${realCookieName}`,
                url: getCookieURL(cookie),
            });
        }
    }
});

chrome.webRequest.onBeforeSendHeaders.addListener(
    details => {
        for (const header of details.requestHeaders) {
            if (header.name.toLowerCase() === 'cookie') {
                const id = `${getOpenerId(details.tabId)}.`;

                const fixedCookies = header.value.split('; ').filter(x => x.startsWith(id)).map(x => x.slice(id.length)).join('; ');
                header.value = fixedCookies;
            }

            // Sometimes Chrome makes a request on a ghost tab.
            // We don't want these in order to prevent cluttering cookies.
            // Yes, `webNavigation.onComitted` is emitted and `webNavigation.onCreatedNavigationTarget` is not.
            if (header.name.toLowerCase() === 'purpose' && header.value === 'prefetch' && !(counter.has(details.tabId))) {
                console.log(details);
                return {
                    cancel: true,
                };
            }
        }

        return {
            requestHeaders: details.requestHeaders.filter(header => header.name.toLowerCase() !== 'cookie' || header.value !== ''),
        };
    },
    {urls: ['<all_urls>']},
    isFirefox ? ['blocking', 'requestHeaders'] : ['blocking', 'requestHeaders', 'extraHeaders'],
);

// Firefox Bug: doesn't catch https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-uri
chrome.webRequest.onHeadersReceived.addListener(
    details => {
        for (const header of details.responseHeaders) {
            if (header.name.toLowerCase() === 'set-cookie') {
                const parts = header.value.split('\n');

                // `details.tabId` === -1 when Chrome is making internal requests, such downloading a service worker.

                const openerId = getOpenerId(details.tabId);

                header.value = parts.map(part => {
                    const equalsIndex = part.indexOf('=');
                    if (equalsIndex === -1) {
                        return `${openerId}.=${part.trimStart()}`;
                    } else {
                        return `${openerId}.${part.trimStart()}`;
                    }
                }).join('\n');
            }
        }

        return {
            responseHeaders: details.responseHeaders,
        };
    },
    {urls: ['<all_urls>']},
    isFirefox ? ['blocking', 'responseHeaders'] : ['blocking', 'responseHeaders', 'extraHeaders'],
);

chrome.tabs.onRemoved.addListener(async tabId => {
    const opener = getOpenerId(tabId);
    translator.delete(tabId);

    if (counter.has(opener)) {
        counter.set(opener, counter.get(opener) - 1);

        if (counter.get(opener) < 1) {
            counter.delete(opener);
        } else {
            return;
        }
    }

    const id = `${opener}.`;

    chrome.cookies.getAll({}, async cookies => {
        await Promise.allSettled(cookies.filter(cookie => cookie.name.startsWith(id)).map(cookie => {
            return chrome.cookies.remove({
                name: cookie.name,
                url: getCookieURL(cookie),
                storeId: cookie.storeId,
            });
        }));
    });
});

(async () => {
    const contentResponse = await fetch(chrome.runtime.getURL('content.js'));
    const contentText = await contentResponse.text();

    // `tabs.onCreated` doesn't work here when manually creating new tabs,
    // because the opener is the current tab active.
    //
    // This events only fires when the page opens something.
    chrome.webNavigation.onCreatedNavigationTarget.addListener(details => {
        translator.set(details.tabId, getOpenerId(details.sourceTabId));

        const opener = getOpenerId(details.tabId);

        if (counter.has(opener)) {
            counter.set(opener, counter.get(opener) + 1);
        } else {
            counter.set(opener, 2); // the current one + opener = 2
        }
    });

    chrome.webNavigation.onCommitted.addListener(async details => {
        if (details.url.startsWith('chrome')) {
            return;
        }

        const executeCodeInPageContext = `
        const script = document.createElement('script');
        script.textContent = code;

        const destination = document.head ?? document.documentElement;

        if (document instanceof HTMLDocument) {
            destination.append(script);
            script.remove();
        }
        `;

        // Race condition: website scripts may run first
        await chrome.tabs.executeScript(details.tabId, {
            code: `'use strict';
            (() => {
                if (window.totallyRandomString) {
                    return;
                }

                window.totallyRandomString = true;

                const code = "'use strict'; const tabId = '${getOpenerId(details.tabId)}'; (() => {\\n" + ${JSON.stringify(contentText)} + "\\n})();\\n";
                ${executeCodeInPageContext}
            })();
            `,
            matchAboutBlank: true,
            allFrames: true,
            runAt: 'document_start',
        });
    });

    finishLoading();
})();
