const SessionService = require('../common/service/sessionService');
const utils = require('../util/utils');


/**
 * Session component. Manage sessions.
 *
 * @param {Object} app  current application context
 * @param {Object} opts attach parameters
 */
class Component {
    constructor(app, opts) {
        opts = opts || {};
        this.app = app;
        this.service = new SessionService(opts);
        this.name = '__session__';

        const self = this;

        // proxy the service methods except the lifecycle interfaces of component
        // const getFun = function (m) {   // eslint-disable-line
        //     return (function () {   // eslint-disable-line
        //         return function () {   // eslint-disable-line
        //             return self.service[m].apply(self.service, arguments); // eslint-disable-line
        //         };
        //     }());
        // };
        const getFun = m => (() => (...args) => self.service[m](...args))();
        let method;
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

module.exports = (app, opts) => {
    const cmp = new Component(app, opts);
    app.set('sessionService', cmp, true);
    return cmp;
};
