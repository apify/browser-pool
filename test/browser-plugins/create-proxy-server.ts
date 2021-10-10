import http from 'http';
import net from 'net';

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
            headers: Object.fromEntries(
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

    server.on('connect', (request, socket) => {
        if (!isAuthorized(request)) {
            socket.end([
                'HTTP/1.1 401 Unauthorized',
                'Connection: close',
                `Date: ${(new Date()).toUTCString()}`,
                'Content-Length: 0',
                '',
            ]);
        }

        const [host, port] = request.url!.split(':');

        const target = net.connect({
            host,
            port: Number(port),
            localAddress,
        });

        target.pipe(socket);
        socket.pipe(target);

        socket.once('close', () => {
            target.resume();

            if (target.writable) {
                target.end();
            }
        });

        target.once('close', () => {
            socket.resume();

            if (socket.writable) {
                socket.end();
            }
        });

        socket.once('error', () => {
            target.destroy();
        });

        target.once('error', () => {
            socket.destroy();
        });
    });

    return server;
};
