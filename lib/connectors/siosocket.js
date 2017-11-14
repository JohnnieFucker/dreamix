const EventEmitter = require('events');

const ST_INITED = 0;
const ST_CLOSED = 1;


/**
 * Encode batch msg to client
 */
function encodeBatch(msgs) {
    let res = '[';
    let msg;
    for (let i = 0, l = msgs.length; i < l; i++) {
        if (i > 0) {
            res += ',';
        }
        msg = msgs[i];
        if (typeof msg === 'string') {
            res += msg;
        } else {
            res += JSON.stringify(msg);
        }
    }
    res += ']';
    return res;
}

/**
 * Socket class that wraps socket.io socket to provide unified interface for up level.
 */
class Socket extends EventEmitter {
    constructor(id, socket) {
        super();
        this.id = id;
        this.socket = socket;
        this.remoteAddress = {
            ip: socket.handshake.address.address,
            port: socket.handshake.address.port
        };

        const self = this;

        socket.on('disconnect', this.emit.bind(this, 'disconnect'));

        socket.on('error', this.emit.bind(this, 'error'));

        socket.on('message', (msg) => {
            self.emit('message', msg);
        });

        this.state = ST_INITED;

        // TODO: any other events?
    }
    send(msg) {
        if (this.state !== ST_INITED) {
            return;
        }
        if (typeof msg !== 'string') {
            msg = JSON.stringify(msg);
        }
        this.socket.send(msg);
    }

    disconnect() {
        if (this.state === ST_CLOSED) {
            return;
        }

        this.state = ST_CLOSED;
        this.socket.disconnect();
    }

    sendBatch(msgs) {
        this.send(encodeBatch(msgs));
    }
}

module.exports = Socket;
