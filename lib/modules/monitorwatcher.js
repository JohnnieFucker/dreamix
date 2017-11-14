const logger = require('dreamix-logger').getLogger('dreamix', __filename);
const utils = require('../util/utils');
const eventsConstants = require('../util/events');
const Constants = require('../util/constants');

function startOver(self, agent, msg, cb) {
    const fun = self.app.lifecycleCbs[Constants.LIFECYCLE.AFTER_STARTALL];
    if (fun) {
        fun.call(null, self.app);
    }
    self.app.emit(eventsConstants.START_ALL);
    utils.invokeCallback(cb, Constants.SIGNAL.OK);
}

// ----------------- common methods -------------------------

function addServers(self, servers) {
    if (!servers || !servers.length) {
        return;
    }
    self.app.addServers(servers);
}
function addServer(self, agent, msg, cb) {
    logger.debug('[%s] receive addServer signal: %j', self.app.serverId, msg);
    if (!msg || !msg.server) {
        logger.warn('monitorwatcher addServer receive empty message: %j', msg);
        utils.invokeCallback(cb, Constants.SIGNAL.FAIL);
        return;
    }
    addServers(self, [msg.server]);
    utils.invokeCallback(cb, Constants.SIGNAL.OK);
}

function subscribeRequest(self, agent, id, cb) {
    const msg = { action: 'subscribe', id: id };
    agent.request(Constants.KEYWORDS.MASTER_WATCHER, msg, (err, servers) => {
        if (err) {
            logger.error('subscribeRequest request to master with error: %j', err.stack);
            utils.invokeCallback(cb, err);
        }
        const res = [];
        for (const _id in servers) {
            if (servers.hasOwnProperty(_id)) {
                res.push(servers[_id]);
            }
        }
        addServers(self, res);
        utils.invokeCallback(cb);
    });
}

function removeServers(self, ids) {
    if (!ids || !ids.length) {
        return;
    }
    self.app.removeServers(ids);
}
function removeServer(self, agent, msg, cb) {
    logger.debug('%s receive removeServer signal: %j', self.app.serverId, msg);
    if (!msg || !msg.id) {
        logger.warn('monitorwatcher removeServer receive empty message: %j', msg);
        utils.invokeCallback(cb, Constants.SIGNAL.FAIL);
        return;
    }
    removeServers(self, [msg.id]);
    utils.invokeCallback(cb, Constants.SIGNAL.OK);
}

function replaceServers(self, servers) {
    self.app.replaceServers(servers);
}

function replaceServer(self, agent, msg, cb) {
    logger.debug('%s receive replaceServer signal: %j', self.app.serverId, msg);
    if (!msg || !msg.servers) {
        logger.warn('monitorwatcher replaceServer receive empty message: %j', msg);
        utils.invokeCallback(cb, Constants.SIGNAL.FAIL);
        return;
    }
    replaceServers(self, msg.servers);
    utils.invokeCallback(cb, Constants.SIGNAL.OK);
}

// ----------------- bind methods -------------------------

function finishStart(self, id) {
    const msg = { action: 'record', id: id };
    self.service.agent.notify(Constants.KEYWORDS.MASTER_WATCHER, msg);
}

const monitorMethods = {
    addServer: addServer,
    removeServer: removeServer,
    replaceServer: replaceServer,
    startOver: startOver
};

class Module {
    constructor(opts, consoleService) {
        this.app = opts.app;
        this.service = consoleService;
        this.id = this.app.getServerId();
        this.app.on(eventsConstants.START_SERVER, finishStart.bind(null, this));
        this.moduleId = Constants.KEYWORDS.MONITOR_WATCHER;
    }
    start(cb) {
        subscribeRequest(this, this.service.agent, this.id, cb);
    }

    monitorHandler(agent, msg, cb) {
        if (!msg || !msg.action) {
            return;
        }
        const func = monitorMethods[msg.action];
        if (!func) {
            logger.info('monitorwatcher unknown action: %j', msg.action);
            return;
        }
        func(this, agent, msg, cb);
    }
}


module.exports = (opts, consoleService) => new Module(opts, consoleService);
