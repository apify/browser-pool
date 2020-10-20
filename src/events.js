const BROWSER_POOL_EVENTS = {
    BROWSER_LAUNCHED: 'browserLaunched',
    BROWSER_RETIRED: 'browserRetired',
    BROWSER_CLOSED: 'browserClosed',

    PAGE_CREATED: 'pageCreated',
    PAGE_CLOSED: 'pageClosed',
};

const BROWSER_CONTROLLER_EVENTS = {
    BROWSER_CLOSED: 'browserClosed',
    BROWSER_KILLED: 'browserCreated',
    BROWSER_TERMINATED: 'browserCreated',
};

module.exports = {
    BROWSER_POOL_EVENTS,
    BROWSER_CONTROLLER_EVENTS,
};
