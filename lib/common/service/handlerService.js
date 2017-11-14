const fs = require('fs');
const utils = require('../../util/utils');
const Loader = require('dreamix-loader');
const pathUtil = require('../../util/pathUtil');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);
const forwardLogger = require('dreamix-logger').getLogger('forward-log', __filename);

/**
 * Load handlers from current application
 */
function loadHandlers(app, serverType, handlerMap) {
    const p = pathUtil.getHandlerPath(app.getBase(), serverType);
    if (p) {
        handlerMap[serverType] = Loader.load(p, app);
    }
}

function watchHandlers(app, handlerMap) {
    const p = pathUtil.getHandlerPath(app.getBase(), app.serverType);
    if (p) {
        fs.watch(p, (event) => {
            if (event === 'change') {
                handlerMap[app.serverType] = Loader.load(p, app);
            }
        });
    }
}

/**
 * Handler service.
 * Dispatch request to the relactive handler.
 *
 * @param {Object} app      current application context
 */
class Service {
    constructor(app, opts) {
        this.app = app;
        this.handlerMap = {};
        if (opts.reloadHandlers) {
            watchHandlers(app, this.handlerMap);
        }

        this.enableForwardLog = opts.enableForwardLog || false;
        this.name = 'handler';
    }
    /**
     * Handler the request.
     */
    handle(routeRecord, msg, session, cb) {
        // the request should be processed by current server
        const handler = this.getHandler(routeRecord);
        if (!handler) {
            logger.error('[handleManager]: fail to find handler for %j', msg.__route__);
            utils.invokeCallback(cb, new Error(`fail to find handler for ${msg.__route__}`));
            return;
        }
        const start = Date.now();
        const self = this;

        const callback = (err, resp, opts) => {
            if (self.enableForwardLog) {
                const log = {
                    route: msg.__route__,
                    args: msg,
                    time: utils.format(new Date(start)),
                    timeUsed: new Date() - start
                };
                forwardLogger.info(JSON.stringify(log));
            }

            // resp = getResp(arguments);
            utils.invokeCallback(cb, err, resp, opts);
        };

        const method = routeRecord.method;

        if (!Array.isArray(msg)) {
            handler[method](msg, session, callback);
        } else {
            msg.push(session);
            msg.push(callback);
            handler[method](...msg);
        }
    }

    /**
     * Get handler instance by routeRecord.
     *
     * @param  {Object} routeRecord route record parsed from route string
     * @return {Object}             handler instance if any matchs or null for match fail
     */
    getHandler(routeRecord) {
        const serverType = routeRecord.serverType;
        if (!this.handlerMap[serverType]) {
            loadHandlers(this.app, serverType, this.handlerMap);
        }
        const handlers = this.handlerMap[serverType] || {};
        const handler = handlers[routeRecord.handler];
        if (!handler) {
            logger.warn('could not find handler for routeRecord: %j', routeRecord);
            return null;
        }
        if (typeof handler[routeRecord.method] !== 'function') {
            logger.warn('could not find the method %s in handler: %s', routeRecord.method, routeRecord.handler);
            return null;
        }
        return handler;
    }
}

module.exports = Service;
