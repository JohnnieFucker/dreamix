/**
 * Module dependencies.
 */
const fs = require('fs');
const path = require('path');
const Application = require('./application');
const Package = require('../package');
const eventsConstants = require('./util/events');

function load(_path, name) {
    if (name) {
        return require(_path + name);  // eslint-disable-line
    }
    return require(_path); // eslint-disable-line
}

class Dreamix {
    constructor() {
        /**
         * Framework version.
         */
        this.version = Package.version;
        /**
         * Event definitions that would be emitted by app.event
         */
        this.events = eventsConstants;
        /**
         * auto loaded components
         */
        this.components = {};
        /**
         * auto loaded filters
         */
        this.filters = {};
        /**
         * auto loaded rpc filters
         */
        this.rpcFilters = {};
        /**
         * connectors
         */
        this.connectors = {
            sioconnector: load.bind(null, './connectors/sioconnector'),
            hybridconnector: load.bind(null, './connectors/hybridconnector'),
            udpconnector: load.bind(null, './connectors/udpconnector'),
            mqttconnector: load.bind(null, './connectors/mqttconnector')
        };

        /**
         * pushSchedulers
         */
        this.pushSchedulers = {
            direct: load.bind(null, './pushSchedulers/direct'),
            buffer: load.bind(null, './pushSchedulers/buffer')
        };

        this.initApp();
    }

    /**
     * Create an dreamix application.
     *
     * @return {Application}
     * @api public
     */
    createApp(opts) {
        const app = new Application(opts);
        this.app = app;
        return app;
    }

    initApp() {
        const self = this;
        /**
         * Auto-load bundled components with getters.
         */
        fs.readdirSync(`${__dirname}/components`).forEach((filename) => {
            if (!/\.js$/.test(filename)) {
                return;
            }
            const name = path.basename(filename, '.js');
            const _load = load.bind(null, './components/', name);
            Object.defineProperty(self.components, name, _load);
            Object.defineProperty(self, name, _load);
        });

        fs.readdirSync(`${__dirname}/filters/handler`).forEach((filename) => {
            if (!/\.js$/.test(filename)) {
                return;
            }
            const name = path.basename(filename, '.js');
            const _load = load.bind(null, './filters/handler/', name);
            Object.defineProperty(self.filters, name, _load);
            Object.defineProperty(self, name, _load);
        });

        fs.readdirSync(`${__dirname}/filters/rpc`).forEach((filename) => {
            if (!/\.js$/.test(filename)) {
                return;
            }
            const name = path.basename(filename, '.js');
            const _load = load.bind(null, './filters/rpc/', name);
            Object.defineProperty(self.rpcFilters, name, _load);
        });
    }
}


module.exports = new Dreamix();
