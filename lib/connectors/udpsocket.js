const handler = require('./common/handler');
const protocol = require('dreamix-protocol');

const Package = protocol.Package;
const EventEmitter = require('events');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);

const ST_INITED = 0;
const ST_WAIT_ACK = 1;
const ST_WORKING = 2;
const ST_CLOSED = 3;

class Socket extends EventEmitter {
    constructor(id, socket, peer) {
        super();

        this.id = id;
        this.socket = socket;
        this.peer = peer;
        this.host = peer.address;
        this.port = peer.port;
        this.remoteAddress = {
            ip: this.host,
            port: this.port
        };

        const self = this;
        this.on('package', (pkg) => {
            if (pkg) {
                pkg = Package.decode(pkg);
                handler(self, pkg);
            }
        });

        this.state = ST_INITED;
    }

    /**
     * Send byte data package to client.
     *
     * @param  {Buffer} msg byte data
     */
    send(msg) {
        if (this.state !== ST_WORKING) {
            return;
        }
        if (msg instanceof String) {
            msg = new Buffer(msg);
        } else if (!(msg instanceof Buffer)) {
            msg = new Buffer(JSON.stringify(msg));
        }
        this.sendRaw(Package.encode(Package.TYPE_DATA, msg));
    }
    sendRaw(msg) {
        this.socket.send(msg, 0, msg.length, this.port, this.host, (err) => {
            if (err) {
                logger.error('send msg to remote with err: %j', err.stack);
            }
        });
    }
    sendForce(msg) {
        if (this.state === ST_CLOSED) {
            return;
        }
        this.sendRaw(msg);
    }
    handshakeResponse(resp) {
        if (this.state !== ST_INITED) {
            return;
        }
        this.sendRaw(resp);
        this.state = ST_WAIT_ACK;
    }

    sendBatch(msgs) {
        if (this.state !== ST_WORKING) {
            return;
        }
        const rs = [];
        for (let i = 0; i < msgs.length; i++) {
            const src = Package.encode(Package.TYPE_DATA, msgs[i]);
            rs.push(src);
        }
        this.sendRaw(Buffer.concat(rs));
    }
    disconnect() {
        if (this.state === ST_CLOSED) {
            return;
        }
        this.state = ST_CLOSED;
        this.emit('disconnect', 'the connection is disconnected.');
    }
}

module.exports = Socket;

