import http from 'http';

const hopByHopHeaders = [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
];

export const isHopByHopHeader = (header: string): boolean => hopByHopHeaders.includes(header.toLowerCase());

const fromEntries = <K extends string | number | symbol, V>(entries: Array<[K, V]>) => {
    const result: Record<K, V> = {} as Record<K, V>;

    for (const [key, value] of entries) {
        result[key] = value;
    }

    return result;
};

// --proxy-bypass-list=<-loopback> for launching Chrome
export const createProxyServer = (localAddress: string, username: string, password: string): http.Server => {
    const pair = Buffer.from(`${username}:${password}`).toString('base64');
    const desiredAuthorization = `Basic ${pair}`;

    const isAuthorized = (request: http.IncomingMessage) => {
        const authorization = request.headers['proxy-authorization'] || request.headers.authorization;

        if (username || password) {
            return authorization === desiredAuthorization;
        }

        return true;
    };

    const server = http.createServer((request, response) => {
        if (!isAuthorized(request)) {
            response.statusCode = 401;
            response.end();
            return;
        }

        const client = http.request(request.url!, {
            headers: fromEntries(
                Object.entries(request.headers).filter(
                    (entry) => !isHopByHopHeader(entry[0]),
                ),
            ),
            localAddress,
        }, (clientResponse) => {
            for (const [header, value] of Object.entries(clientResponse.headers)) {
                response.setHeader(header, value!);
            }

            clientResponse.pipe(response);
        });

        request.pipe(client);

        client.once('error', () => {
            response.destroy();
        });
    });

    return server;
};
