/**
 * Filter for timeout.
 * Print a warn information when request timeout.
 */
const logger = require('dreamix-logger').getLogger('dreamix', __filename);
const utils = require('../../util/utils');

const DEFAULT_TIMEOUT = 3000;
const DEFAULT_SIZE = 500;


class Filter {
    constructor(timeout, maxSize) {
        this.timeout = timeout;
        this.maxSize = maxSize;
        this.timeouts = {};
        this.curId = 0;
    }
    before(msg, session, next) {
        const count = utils.size(this.timeouts);
        logger.debug('timeout filter. msg= %j , maxSize %s, count %s', msg, this.maxSize, count);
        if (count > this.maxSize) {
            logger.warn('timeout filter is out of range, current size is %s, max size is %s', count, this.maxSize);
            next();
            return;
        }
        this.curId++;
        this.timeouts[this.curId] = setTimeout(() => {
            logger.warn('request %j timeout.', msg.__route__);
        }, this.timeout);
        session.__timeout__ = this.curId;
        next();
    }

    after(err, msg, session, resp, next) {
        const timeout = this.timeouts[session.__timeout__];
        if (timeout) {
            clearTimeout(timeout);
            delete this.timeouts[session.__timeout__];
        }
        next(err);
    }
}

module.exports = (timeout, maxSize) => new Filter(timeout || DEFAULT_TIMEOUT, maxSize || DEFAULT_SIZE);
