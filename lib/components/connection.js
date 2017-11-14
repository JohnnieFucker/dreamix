const ConnectionService = require('../common/service/connectionService');


class Component {
    constructor(app) {
        this.app = app;
        this.service = new ConnectionService(app);


        this.name = '__connection__';
        const self = this;

        // proxy the service methods except the lifecycle interfaces of component
        let method;
        const getFun = m => (() => () => self.service[m].apply(self.service, arguments))(); // eslint-disable-line

        for (const m in this.service) {
            if (this.service.hasOwnProperty(m)) {
                if (m !== 'start' && m !== 'stop') {
                    method = this.service[m];
                    if (typeof method === 'function') {
                        this[m] = getFun(m);
                    }
                }
            }
        }
    }
}

/**
 * Connection component for statistics connection status of frontend servers
 */
module.exports = app => new Component(app);
