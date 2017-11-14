const SessionService = require('../common/service/sessionService');


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
        const getFun = m => (() => () => self.service[m].apply(self.service, arguments))();// eslint-disable-line

        // proxy the service methods except the lifecycle interfaces of component
        let method;
        const self = this;
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

module.exports = (app, opts) => {
    const cmp = new Component(app, opts);
    app.set('sessionService', cmp, true);
    return cmp;
};
