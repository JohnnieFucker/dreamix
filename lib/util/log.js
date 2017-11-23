const logger = require('dreamix-logger');

/**
 * Configure dreamix logger
 */
module.exports.configure = (app, filename) => {
    const serverId = app.getServerId();
    const base = app.getBase();
    console.log(serverId);
    console.log(filename);
    logger.configure(filename, { serverId: serverId, base: base });
};
