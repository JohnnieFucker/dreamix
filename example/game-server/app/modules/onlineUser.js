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
        console.log('monitorHandler');
        console.log(connectionService.getStatisticsInfo());
        agent.notify(moduleId, connectionService.getStatisticsInfo());
    }

    masterHandler(agent, msg) {
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
        console.log('masterHandler');
        console.log(data);
    }

    clientHandler(agent, msg, cb) {
        utils.invokeCallback(cb, null, agent.get(moduleId));
    }
}

module.exports = opts => new Module(opts);
module.exports.moduleId = moduleId;

