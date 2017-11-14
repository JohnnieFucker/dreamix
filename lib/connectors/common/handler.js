const protocol = require('pomelo-protocol');

const Package = protocol.Package;
const logger = require('dreamix-logger').getLogger('dreamix', __filename);

const handlers = {};

const ST_INITED = 0;
const ST_WAIT_ACK = 1;
const ST_WORKING = 2;
const ST_CLOSED = 3;

function handleHandshake(socket, pkg) {
    if (socket.state !== ST_INITED) {
        return;
    }
    try {
        socket.emit('handshake', JSON.parse(protocol.strdecode(pkg.body)));
    } catch (ex) {
        socket.emit('handshake', {});
    }
}

function handleHandshakeAck(socket, pkg) {
    if (socket.state !== ST_WAIT_ACK) {
        return;
    }
    socket.state = ST_WORKING;
    socket.emit('heartbeat');
}

function handleHeartbeat(socket, pkg) {
    if (socket.state !== ST_WORKING) {
        return;
    }
    socket.emit('heartbeat');
}

function handleData(socket, pkg) {
    if (socket.state !== ST_WORKING) {
        return;
    }
    socket.emit('message', pkg);
}

handlers[Package.TYPE_HANDSHAKE] = handleHandshake;
handlers[Package.TYPE_HANDSHAKE_ACK] = handleHandshakeAck;
handlers[Package.TYPE_HEARTBEAT] = handleHeartbeat;
handlers[Package.TYPE_DATA] = handleData;


module.exports = (socket, pkg) => {
    const handler = handlers[pkg.type];
    if (handler) {
        handler(socket, pkg);
    } else {
        logger.error('could not find handle invalid data package.');
        socket.disconnect();
    }
};
