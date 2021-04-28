import defaultLog from "@apify/log";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore For now till the logger becomes its own module
export const log = defaultLog.child({
    prefix: "BrowserPool",
});
