/**
 * Filter for rpc log.
 * Reject rpc request when toobusy
 */
const rpcLogger = require('dreamix-logger').getLogger('rpc-log', __filename);

let toobusy = null;

const DEFAULT_MAXLAG = 70;

class Filter {
    constructor(maxLag) {
        try {
            toobusy = require('toobusy');   // eslint-disable-line
        } catch (e) {}            // eslint-disable-line
        if (toobusy) {
            toobusy.maxLag(maxLag);
        }
        this.name = 'toobusy';
    }
    before(serverId, msg, opts, next) { // eslint-disable-line
        opts = opts || {};
        if (!!toobusy && toobusy()) {
            rpcLogger.warn(`Server too busy for rpc request, serverId:${serverId} msg: ${msg}`);
            const err = new Error(`Backend server ${serverId} is too busy now!`);
            err.code = 500;
            next(err);
        } else {
            next();
        }
    }
}


module.exports = maxLag => new Filter(maxLag || DEFAULT_MAXLAG);
