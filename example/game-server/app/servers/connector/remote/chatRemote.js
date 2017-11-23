const logger = require('dreamix-logger').getLogger('dreamix-biz', __filename);

class ChatRemote {
    constructor(app) {
        this.app = app;
        this.sessionService = app.get('sessionService');
    }
    sendMessageByUid(uid, msg, next) {
        logger.info('****sendMessageUid start...****, msg = [%j], uid = [%s].', msg, uid);
        this.sessionService.sendMessageByUid(uid, msg);
        next();
    }
}
module.exports = app => new ChatRemote(app);
