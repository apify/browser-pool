import * as ProxyChain from 'proxy-chain';

// --proxy-bypass-list=<-loopback> for launching Chrome
export const createProxyServer = (localAddress: string, username: string, password: string): ProxyChain.Server => {
    return new ProxyChain.Server({
        port: 0,
        prepareRequestFunction: (input) => {
            return {
                localAddress,
                requestAuthentication: input.username !== username || input.password !== password,
            };
        },
    });
};
