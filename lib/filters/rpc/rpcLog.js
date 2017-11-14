/**
 * Filter for rpc log.
 * Record used time for remote process call.
 */
const rpcLogger = require('dreamix-logger').getLogger('rpc-log', __filename);
const utils = require('../../util/utils');


class Filter {
    constructor() {
        this.name = 'rpcLog';
    }

    /**
     * Before filter for rpc
     */

    before(serverId, msg, opts, next) {  // eslint-disable-line
        opts = opts || {};
        opts.__start_time__ = Date.now();
        next();
    }

    /**
     * After filter for rpc
     */
    after(serverId, msg, opts, next) {       // eslint-disable-line
        if (!!opts && !!opts.__start_time__) {
            const start = opts.__start_time__;
            const end = Date.now();
            const timeUsed = end - start;
            const log = {
                route: msg.service,
                args: msg.args,
                time: utils.format(new Date(start)),
                timeUsed: timeUsed
            };
            rpcLogger.info(JSON.stringify(log));
        }
        next();
    }
}

module.exports = () => new Filter();
