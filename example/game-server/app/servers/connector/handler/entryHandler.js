

class Handler {
    constructor(app) {
        this.app = app;
    }
    /**
     * New client entry.
     *
     * @param  {Object}   msg     request message
     * @param  {Object}   session current session object
     * @param  {Function} next    next step callback
     */
    entry(msg, session, next) {         // eslint-disable-line
        if (msg.uid) {
            session.bind(msg.uid);
            const userInfo = {
                username: msg.username,
                cid: msg.cid,
                client_os: msg.client_os,
                version: msg.version
            };
            session.updateUserInfo(userInfo);
        }

        next(null, { code: 200, body: 'game server is ok.', id: msg.id, route: msg.route });
    }

    /**
     * Publish route for mqtt connector.
     *
     * @param  {Object}   msg     request message
     * @param  {Object}   session current session object
     * @param  {Function} next    next step callback
     */
    publish(msg, session, next) {      // eslint-disable-line
        const result = {
            topic: 'publish',
            payload: JSON.stringify({ code: 200, msg: 'publish message is ok.' })
        };
        next(null, result);
    }

    /**
     * Subscribe route for mqtt connector.
     *
     * @param  {Object}   msg     request message
     * @param  {Object}   session current session object
     * @param  {Function} next    next step callback
     */
    subscribe(msg, session, next) {    // eslint-disable-line
        const result = {
            topic: 'subscribe',
            payload: JSON.stringify({ code: 200, msg: 'subscribe message is ok.' })
        };
        next(null, result);
    }
}

module.exports = app => new Handler(app);

