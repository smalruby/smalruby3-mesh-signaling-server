const WebSocket = require('ws');

const wss = new WebSocket.Server({
    port: 8080,
    perMessageDeflate: {
        zlibDeflateOptions: {
            // See zlib defaults.
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024 // Size (in bytes) below which messages
        // should not be compressed.
    }
});

const meshHosts = {};
const connections = {};

const registerHost = function (hostInfo) {
    if (meshHosts.hasOwnProperty(hostInfo.id)) {
        meshHosts[hostInfo.id].connnectionId = hostInfo.connectionId;
        meshHosts[hostInfo.id].remoteAddress = hostInfo.remoteAddress;
        meshHosts[hostInfo.id].updatedAt = new Date();
    } else {
        meshHosts[hostInfo.id] = Object.assign(hostInfo, {
            "createdAt": new Date(),
            "updatedAt": new Date()
        });
    }
};

const isSameNetwork = function (addressA, addressB) {
    if (addressA === addressB) {
        return true;
    }
    return true;
};

wss.on('connection', (socket, request) => {
    const remoteAddress = request.connection.remoteAddress;
    console.log(`connected: remote addrees=<${remoteAddress}>`);
    socket.on('message', message => {
        console.log(`received message: ${message}`);

        const { action, data } = JSON.parse(message);

        let hostInfo;
        let clientInfo;
        let hostIds;

        switch (action) {
        case 'register':
            hostInfo = {
                connectionId: data.id,
                id: data.id,
                remoteAddress: remoteAddress
            };
            registerHost(hostInfo);

            connections[data.id] = socket;

            socket.send(JSON.stringify({
                service: 'mesh',
                action: 'register',
                result: true,
                data: {}
            }));
            break;
        case 'list':
            hostIds = [];
            Object.keys(meshHosts).forEach(id => {
                const hostInfo = meshHosts[id];
                if (isSameNetwork(remoteAddress, hostInfo.remoteAddress)) {
                    hostIds.push(hostInfo.id);
                }
            });

            socket.send(JSON.stringify({
                service: 'mesh',
                action: 'list',
                result: true,
                data: {
                    hostIds: hostIds
                }
            }));
            break;
        case 'offer':
            hostInfo = meshHosts[data.hostId];
            if (isSameNetwork(remoteAddress, hostInfo.remoteAddress)) {
                connections[hostInfo.id].send(JSON.stringify({
                    service: 'mesh',
                    action: 'offer',
                    data: {
                        id: data.id,
                        hostId: hostInfo.id,
                        clientDescription: data.clientDescription
                    }
                }));
            } else {
                socket.send(JSON.stringify({
                    service: 'mesh',
                    action: 'offer',
                    result: false,
                    data: {
                        error: `Host is not same network`
                    }
                }));
            }
            break;
        case 'answer':
            hostInfo = meshHosts[data.id];
            clientInfo = meshHosts[data.clientId];
            if (isSameNetwork(remoteAddress, clientInfo.remoteAddress)) {
                connections[clientInfo.id].send(JSON.stringify({
                    service: 'mesh',
                    action: 'answer',
                    data: {
                        id: data.id,
                        clientId: clientInfo.id,
                        hostDescription: data.hostDescription
                    }
                }));
            } else {
                socket.send(JSON.stringify({
                    service: 'mesh',
                    action: 'answer',
                    result: false,
                    data: {
                        error: `Client is not same network`
                    }
                }));
            }
            break;
        default:
            socket.send(JSON.stringify({
                service: 'mesh',
                action: data.action,
                result: false,
                data: {
                    error: `invalid action: ${action}`
                }
            }));
            break;
        }
    });

    socket.on('close', () => {
        console.log(`close`);
    });
});

wss.on('error', error => {
    console.log(`server on error: ${error}`);
});

console.info(`WebRTC signaling server for Smalruby3's Mesh extension is running at ${wss.address().address}:${wss.address().port}`);
