import { Server as ProxyChainServer } from 'proxy-chain';

const server = new ProxyChainServer({
    port: 0,
});

server.server.unref();

// https://github.com/microsoft/playwright/blob/2e4722d460b5142267e0e506ca7ea9a259556b5f/packages/playwright-core/src/server/browserContext.ts#L423-L427
export async function getLocalProxyAddress() {
    if (!server.server.listening) {
        await server.listen();
    }

    return `http://127.0.0.1:${server.port}`;
}
