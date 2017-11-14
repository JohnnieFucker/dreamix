/**
 * Filter for toobusy.
 * if the process is toobusy, just skip the new request
 */
const conLogger = require('dreamix-logger').getLogger('con-log', __filename);

let toobusy = null;
const DEFAULT_MAXLAG = 70;


class Filter {
    constructor(maxLag) {
        try {
            toobusy = require('toobusy');  // eslint-disable-line
        } catch (e) {}        // eslint-disable-line
        if (toobusy) {
            toobusy.maxLag(maxLag);
        }
    }
    before(msg, session, next) {     // eslint-disable-line
        if (!!toobusy && toobusy()) {
            conLogger.warn(`[toobusy] reject request msg: ${msg}`);
            const err = new Error('Server toobusy!');
            err.code = 500;
            next(err);
        } else {
            next();
        }
    }
}

module.exports = maxLag => new Filter(maxLag || DEFAULT_MAXLAG);
