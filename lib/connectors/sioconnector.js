const EventEmitter = require('events');
const httpServer = require('http').createServer();
const SioSocket = require('./siosocket');

const PKG_ID_BYTES = 4;
const PKG_ROUTE_LENGTH_BYTES = 1;
const PKG_HEAD_BYTES = PKG_ID_BYTES + PKG_ROUTE_LENGTH_BYTES;

let curId = 1;


function composeResponse(msgId, route, msgBody) {
    return {
        id: msgId,
        body: msgBody
    };
}

function composePush(route, msgBody) {
    return JSON.stringify({ route: route, body: msgBody });
}

function parseIntField(str, offset, len) {
    let res = 0;
    for (let i = 0; i < len; i++) {
        if (i > 0) {
            res <<= 8; // eslint-disable-line
        }
        res |= str.charCodeAt(offset + i) & 0xff; // eslint-disable-line
    }

    return res;
}


/**
 * Connector that manager low level connection and protocol bewteen server and client.
 * Develper can provide their own connector to switch the low level prototol, such as tcp or probuf.
 */
class Connector extends EventEmitter {
    constructor(port, host, opts) {
        super();
        this.port = port;
        this.host = host;
        this.opts = opts;
        this.heartbeats = opts.heartbeats || true;
        this.closeTimeout = opts.closeTimeout || 60;
        this.heartbeatTimeout = opts.heartbeatTimeout || 60;
        this.heartbeatInterval = opts.heartbeatInterval || 25;
    }
    /**
     * Start connector to listen the specified port
     */
    start(cb) {
        const self = this;
        // issue https://github.com/NetEase/pomelo-cn/issues/174
        let opts = {};
        if (this.opts) {
            opts = this.opts;
        } else {
            opts = {
                transports: [
                    'websocket', 'polling-xhr', 'polling-jsonp', 'polling'
                ]
            };
        }

        const sio = require('socket.io')(httpServer, opts); // eslint-disable-line

        const port = this.port;
        httpServer.listen(port, () => {
            console.log('sio Server listening at port %d', port);
        });
        sio.set('resource', '/socket.io');
        sio.set('transports', this.opts.transports);
        sio.set('heartbeat timeout', this.heartbeatTimeout);
        sio.set('heartbeat interval', this.heartbeatInterval);

        sio.on('connection', (socket) => {
            const siosocket = new SioSocket(curId++, socket);
            self.emit('connection', siosocket);
            siosocket.on('closing', (reason) => {
                siosocket.send({ route: 'onKick', reason: reason });
            });
        });

        process.nextTick(cb);
    }

    /**
     * Stop connector
     */
    stop(force, cb) {
        this.wsocket.server.close();
        process.nextTick(cb);
    }

    encode(reqId, route, msg) {   // eslint-disable-line
        if (reqId) {
            return composeResponse(reqId, route, msg);
        }
        return composePush(route, msg);
    }

    /**
     * Decode client message package.
     *
     * Package format:
     *   message id: 4bytes big-endian integer
     *   route length: 1byte
     *   route: route length bytes
     *   body: the rest bytes
     *
     * @param  {String} msg socket.io package from client
     * @return {Object}      message object
     */
    decode(msg) {   // eslint-disable-line
        let index = 0;

        const id = parseIntField(msg, index, PKG_ID_BYTES);
        index += PKG_ID_BYTES;

        const routeLen = parseIntField(msg, index, PKG_ROUTE_LENGTH_BYTES);

        const route = msg.substr(PKG_HEAD_BYTES, routeLen);
        const body = msg.substr(PKG_HEAD_BYTES + routeLen);

        return {
            id: id,
            route: route,
            body: JSON.parse(body)
        };
    }
}

module.exports = Connector;

