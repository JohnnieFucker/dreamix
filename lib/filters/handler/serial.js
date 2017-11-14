/**
 * Filter to keep request sequence.
 */
const logger = require('dreamix-logger').getLogger('dreamix', __filename);
const taskManager = require('../../common/manager/taskManager');

class Filter {
    constructor(timeout) {
        this.timeout = timeout;
    }
    /**
     * request serialization after filter
     */
    before(msg, session, next) {
        taskManager.addTask(session.id, (task) => {
            session.__serialTask__ = task;
            next();
        }, () => {
            logger.error(`[serial filter] msg timeout, msg:${JSON.stringify(msg)}`);
        }, this.timeout);
    }

    /**
     * request serialization after filter
     */
    after(err, msg, session, resp, next) {     // eslint-disable-line
        const task = session.__serialTask__;
        if (task) {
            if (!task.done() && !err) {
                err = new Error(`task time out. msg:${JSON.stringify(msg)}`);
            }
        }
        next(err);
    }
}


module.exports = timeout => new Filter(timeout);
