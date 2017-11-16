const ConnectionService = require('../common/service/connectionService');
const utils = require('../util/utils');

class Component {
    constructor(app) {
        this.app = app;
        this.service = new ConnectionService(app);


        this.name = '__connection__';
        const self = this;

        // proxy the service methods except the lifecycle interfaces of component
        let method;
        // const getFun = function (m) {   // eslint-disable-line
        //     return (function () {       // eslint-disable-line
        //         return function () {    // eslint-disable-line
        //             return self.service[m].apply(self.service, arguments);   // eslint-disable-line
        //         };
        //     }());
        // };
        const getFun = m => (() => (...args) => self.service[m](...args))();
        const methods = utils.getFunctionsOfClass(this.service);
        for (const m of methods) {
            if (m !== 'start' && m !== 'stop' && m !== 'constructor') {
                method = this.service[m];
                if (typeof method === 'function') {
                    this[m] = getFun(m);
                }
            }
        }
    }
}

/**
 * Connection component for statistics connection status of frontend servers
 */
module.exports = app => new Component(app);
