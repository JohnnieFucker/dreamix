

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
    chat(msg, session, next) {         // eslint-disable-line
        console.log(msg);
        next(null, { code: 200, body: 'msg recived.', id: msg.id, route: msg.route });
    }
}

module.exports = app => new Handler(app);

