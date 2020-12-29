const defaultLog = require('apify-shared/log');

const log = defaultLog.child({
    prefix: 'BrowserPool',
});

module.exports = log;
