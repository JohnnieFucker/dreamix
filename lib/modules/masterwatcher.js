const logger = require('dreamix-logger').getLogger('dreamix', __filename);
const utils = require('../util/utils');
const Constants = require('../util/constants');
const MasterWatchdog = require('../master/watchdog');


// ----------------- bind methods -------------------------

function record(module, agent, msg, cb) {
    if (!msg) {
        utils.invokeCallback(cb, new Error('masterwatcher record empty message.'));
        return;
    }
    module.watchdog.record(msg.id);
}

function onServerAdd(module, _record) {
    logger.debug('masterwatcher receive add server event, with server: %j', _record);
    if (!_record || _record.type === 'client' || !_record.serverType) {
        return;
    }
    module.watchdog.addServer(_record);
}

function onServerReconnect(module, _record) {
    logger.debug('masterwatcher receive reconnect server event, with server: %j', _record);
    if (!_record || _record.type === 'client' || !_record.serverType) {
        logger.warn('onServerReconnect receive wrong message: %j', _record);
        return;
    }
    module.watchdog.reconnectServer(_record);
}

function onServerLeave(module, id, type) {
    logger.debug('masterwatcher receive remove server event, with server: %s, type: %s', id, type);
    if (!id) {
        logger.warn('onServerLeave receive server id is empty.');
        return;
    }
    if (type !== 'client') {
        module.watchdog.removeServer(id);
    }
}

// ----------------- monitor request methods -------------------------

function subscribe(module, agent, msg, cb) {
    if (!msg) {
        utils.invokeCallback(cb, new Error('masterwatcher subscribe empty message.'));
        return;
    }

    module.watchdog.subscribe(msg.id);
    utils.invokeCallback(cb, null, module.watchdog.query());
}

function unsubscribe(module, agent, msg, cb) {
    if (!msg) {
        utils.invokeCallback(cb, new Error('masterwatcher unsubscribe empty message.'));
        return;
    }
    module.watchdog.unsubscribe(msg.id);
    utils.invokeCallback(cb);
}

function query(module, agent, msg, cb) {
    utils.invokeCallback(cb, null, module.watchdog.query());
}
const masterMethods = {
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    query: query,
    record: record
};

class Module {
    constructor(opts, consoleService) {
        this.app = opts.app;
        this.service = consoleService;
        this.id = this.app.getServerId();

        this.watchdog = new MasterWatchdog(this.app, this.service);
        this.service.on('register', onServerAdd.bind(null, this));
        this.service.on('disconnect', onServerLeave.bind(null, this));
        this.service.on('reconnect', onServerReconnect.bind(null, this));
        this.moduleId = Constants.KEYWORDS.MASTER_WATCHER;
    }
    start(cb) {   // eslint-disable-line
        utils.invokeCallback(cb);
    }

    masterHandler(agent, msg, cb) {
        if (!msg) {
            logger.warn('masterwatcher receive empty message.');
            return;
        }
        const func = masterMethods[msg.action];
        if (!func) {
            logger.info('masterwatcher unknown action: %j', msg.action);
            return;
        }
        func(this, agent, msg, cb);
    }
}


module.exports = (opts, consoleService) => new Module(opts, consoleService);
