const net = require('net');
const dgram = require('dgram');
const utils = require('../util/utils');
const Constants = require('../util/constants');
const UdpSocket = require('./udpsocket');
const Kick = require('./commands/kick');
const Handshake = require('./commands/handshake');
const Heartbeat = require('./commands/heartbeat');
const protocol = require('dreamix-protocol');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);

const Package = protocol.Package;
const Message = protocol.Message;
const coder = require('./common/coder');
const EventEmitter = require('events');

let curId = 1;


function genKey(peer) {
    return `${peer.address}:${peer.port}`;
}

class Connector extends EventEmitter {
    constructor(port, host, opts) {
        super();
        this.opts = opts || {};
        this.type = opts.udpType || 'udp4';
        this.handshake = new Handshake(opts);
        if (!opts.heartbeat) {
            opts.heartbeat = Constants.TIME.DEFAULT_UDP_HEARTBEAT_TIME;
            opts.timeout = Constants.TIME.DEFAULT_UDP_HEARTBEAT_TIMEOUT;
        }
        this.heartbeat = new Heartbeat(utils.extends(opts, { disconnectOnTimeout: true }));
        this.clients = {};
        this.host = host;
        this.port = port;
    }
    start(cb) {
        const self = this;
        this.tcpServer = net.createServer();
        this.socket = dgram.createSocket(this.type, (msg, peer) => {
            const key = genKey(peer);
            if (!self.clients[key]) {
                const udpsocket = new UdpSocket(curId++, self.socket, peer);
                self.clients[key] = udpsocket;

                udpsocket.on('handshake',
                    self.handshake.handle.bind(self.handshake, udpsocket));

                udpsocket.on('heartbeat',
                    self.heartbeat.handle.bind(self.heartbeat, udpsocket));

                udpsocket.on('disconnect',
                    self.heartbeat.clear.bind(self.heartbeat, udpsocket.id));

                udpsocket.on('disconnect', () => {
                    delete self.clients[genKey(udpsocket.peer)];
                });

                udpsocket.on('closing', Kick.handle.bind(null, udpsocket));

                self.emit('connection', udpsocket);
            }
        });

        this.socket.on('message', (data, peer) => {
            const socket = self.clients[genKey(peer)];
            if (socket) {
                socket.emit('package', data);
            }
        });

        this.socket.on('error', (err) => {
            logger.error('udp socket encounters with error: %j', err.stack);
        });

        this.socket.bind(this.port, this.host);
        this.tcpServer.listen(this.port);
        process.nextTick(cb);
    }

    decode(...args) {    // eslint-disable-line
        coder.decode.bind(this, ...args);
    }

    encode(...args) {   // eslint-disable-line
        coder.encode.bind(this, ...args);
    }

    stop(force, cb) {
        this.socket.close();
        process.nextTick(cb);
    }
}

module.exports = Connector;
