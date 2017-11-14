const logger = require('dreamix-logger');

/**
 * Configure pomelo logger
 */
module.exports.configure = (app, filename) => {
    const serverId = app.getServerId();
    const base = app.getBase();
    logger.configure(filename, { serverId: serverId, base: base });
};
