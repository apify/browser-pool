const { default: defaultLog } = require('@apify/log');

const log = defaultLog.child({
    prefix: 'BrowserPool',
});

module.exports = log;
