/**
 * Scheduler component to schedule message sending.
 */

const DefaultScheduler = require('../pushSchedulers/direct');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);

function getScheduler(pushSchedulerComp, app, opts) {
    const Scheduler = opts.scheduler || DefaultScheduler;
    if (typeof Scheduler === 'function') {
        return new Scheduler(app, opts);
    }

    if (Array.isArray(Scheduler)) {
        const res = {};
        Scheduler.forEach((sch) => {
            if (typeof sch.scheduler === 'function') {
                res[sch.id] = new sch.scheduler(app, sch.options); // eslint-disable-line
            } else {
                res[sch.id] = sch.scheduler;
            }
        });
        pushSchedulerComp.isSelectable = true;
        pushSchedulerComp.selector = opts.selector;
        return res;
    }

    return Scheduler;
}

class PushScheduler {
    constructor(app, opts) {
        this.app = app;
        opts = opts || {};
        this.scheduler = getScheduler(this, app, opts);
        this.name = '__pushScheduler__';
    }
    /**
     * Component lifecycle callback
     *
     * @param {Function} cb
     */
    afterStart(cb) {
        if (this.isSelectable) {
            for (const k in this.scheduler) {
                if (this.scheduler.hasOwnProperty(k)) {
                    const sch = this.scheduler[k];
                    if (typeof sch.start === 'function') {
                        sch.start();
                    }
                }
            }
            process.nextTick(cb);
        } else if (typeof this.scheduler.start === 'function') {
            this.scheduler.start(cb);
        } else {
            process.nextTick(cb);
        }
    }

    /**
     * Component lifecycle callback
     * @param {boolean} force
     * @param {Function} cb
     */
    stop(force, cb) {
        if (this.isSelectable) {
            for (const k in this.scheduler) {
                if (this.scheduler.hasOwnProperty(k)) {
                    const sch = this.scheduler[k];
                    if (typeof sch.stop === 'function') {
                        sch.stop();
                    }
                }
            }
            process.nextTick(cb);
        } else if (typeof this.scheduler.stop === 'function') {
            this.scheduler.stop(cb);
        } else {
            process.nextTick(cb);
        }
    }

    /**
     * Schedule how the message to send.
     *
     * @param  {Number}   reqId request id
     * @param  {String}   route route string of the message
     * @param  {Object}   msg   message content after encoded
     * @param  {Array}    recvs array of receiver's session id
     * @param  {Object}   opts  options
     * @param  {Function} cb
     */

    schedule(reqId, route, msg, recvs, opts, cb) {
        const self = this;
        if (self.isSelectable) {
            if (typeof self.selector === 'function') {
                self.selector(reqId, route, msg, recvs, opts, (id) => {
                    if (self.scheduler[id] && typeof self.scheduler[id].schedule === 'function') {
                        self.scheduler[id].schedule(reqId, route, msg, recvs, opts, cb);
                    } else {
                        logger.error('invalid pushScheduler id, id: %j', id);
                    }
                });
            } else {
                logger.error('the selector for pushScheduler is not a function, selector: %j', self.selector);
            }
        } else if (typeof self.scheduler.schedule === 'function') {
            self.scheduler.schedule(reqId, route, msg, recvs, opts, cb);
        } else {
            logger.error('the scheduler does not have a schedule function, scheduler: %j', self.scheduler);
        }
    }
}

module.exports = (app, opts) => new PushScheduler(app, opts);
