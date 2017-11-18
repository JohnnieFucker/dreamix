const Package = require('dreamix-protocol').Package;
const logger = require('dreamix-logger').getLogger('dreamix', __filename);


function clearTimers(self, id) {
    delete self.clients[id];
    const tid = self.timeouts[id];
    if (tid) {
        clearTimeout(tid);
        delete self.timeouts[id];
    }
}

/**
 * Process heartbeat request.
 *
 * @param {Object} opts option request
 *                      opts.heartbeat heartbeat interval
 */
class Command {
    constructor(opts) {
        opts = opts || {};
        this.heartbeat = null;
        this.timeout = null;

        if (opts.heartbeat) {
            this.heartbeat = opts.heartbeat * 1000; // heartbeat interval
            this.timeout = opts.timeout * 1000 || this.heartbeat * 2; // max heartbeat message timeout
        }

        this.timeouts = {};
        this.clients = {};
        this.disconnectOnTimeout = opts.disconnectOnTimeout;
    }
    handle(socket) {
        if (!this.heartbeat) {
            // no heartbeat setting
            return;
        }

        const self = this;

        if (!this.clients[socket.id]) {
            // clear timers when socket disconnect or error
            this.clients[socket.id] = 1;
            socket.once('disconnect', clearTimers.bind(null, this, socket.id));
            socket.once('error', clearTimers.bind(null, this, socket.id));
        }

        // clear timeout timer
        if (self.disconnectOnTimeout) {
            this.clear(socket.id);
        }

        socket.sendRaw(Package.encode(Package.TYPE_HEARTBEAT));

        if (self.disconnectOnTimeout) {
            self.timeouts[socket.id] = setTimeout(() => {
                logger.info('client %j heartbeat timeout.', socket.id);
                socket.disconnect();
            }, self.timeout);
        }
    }

    clear(id) {
        const tid = this.timeouts[id];
        if (tid) {
            clearTimeout(tid);
            delete this.timeouts[id];
        }
    }
}

module.exports = Command;

