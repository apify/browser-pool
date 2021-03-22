export const BROWSER_POOL_EVENTS = {
    BROWSER_LAUNCHED: 'browserLaunched',
    BROWSER_RETIRED: 'browserRetired',
    BROWSER_CLOSED: 'browserClosed',

    PAGE_CREATED: 'pageCreated',
    PAGE_CLOSED: 'pageClosed',
} as const;

export const BROWSER_CONTROLLER_EVENTS = {
    BROWSER_CLOSED: 'browserClosed',
} as const;
