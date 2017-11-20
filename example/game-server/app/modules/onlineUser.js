/**
 *Intro:
 *Author:shine
 *Date:2017/11/18
 */
const logger = require('dreamix-logger').getLogger('dreamix-admin', __filename);
const utils = require('../util/utils');

const moduleId = 'onlineUser';


class Module {
    constructor(opts) {
        opts = opts || {};
        this.app = opts.app;
        this.type = opts.type || 'pull';
        this.interval = opts.interval || 5;
    }

    monitorHandler(agent, msg) {
        const connectionService = this.app.components.__connection__;
        if (!connectionService) {
            logger.error('not support connection: %j', agent.id);
            return;
        }
        agent.notify(moduleId, connectionService.getStatisticsInfo());
    }

    masterHandler(agent, msg) {  // eslint-disable-line
        if (!msg) {
            // pull interval callback
            const list = agent.typeMap.connector;
            if (!list || list.length === 0) {
                return;
            }
            agent.notifyByType('connector', moduleId);
            return;
        }

        let data = agent.get(moduleId);
        if (!data) {
            data = {};
            agent.set(moduleId, data);
        }

        data[msg.serverId] = msg;
    }

    clientHandler(agent, msg, cb) {      // eslint-disable-line
        utils.invokeCallback(cb, null, agent.get(moduleId));
    }
}

module.exports = opts => new Module(opts);
module.exports.moduleId = moduleId;

