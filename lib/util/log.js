const logger = require('dreamix-logger');

/**
 * Configure dreamix logger
 */
module.exports.configure = (app, filename) => {
    const serverId = app.getServerId();
    const base = app.getBase();
    logger.configure(filename, { serverId: serverId, base: base });
};
