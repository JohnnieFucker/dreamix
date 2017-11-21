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
        this.connectors = {};
        Object.defineProperty(this.connectors, 'sioconnector', {
            get: load.bind(null, './connectors/sioconnector'),
            enumerable: true
        });
        Object.defineProperty(this.connectors, 'hybridconnector', {
            get: load.bind(null, './connectors/hybridconnector'),
            enumerable: true
        });
        Object.defineProperty(this.connectors, 'udpconnector', {
            get: load.bind(null, './connectors/udpconnector'),
            enumerable: true
        });
        Object.defineProperty(this.connectors, 'mqttconnector', {
            get: load.bind(null, './connectors/mqttconnector'),
            enumerable: true
        });

        /**
         * pushSchedulers
         */
        this.pushSchedulers = {};
        Object.defineProperty(this.pushSchedulers, 'direct', {
            get: load.bind(null, './pushSchedulers/direct'),
            enumerable: true
        });
        Object.defineProperty(this.pushSchedulers, 'buffer', {
            get: load.bind(null, './pushSchedulers/buffer'),
            enumerable: true
        });
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
            Object.defineProperty(self.components, name, {
                get: _load,
                enumerable: true
            });
            Object.defineProperty(self, name, {
                get: _load,
                enumerable: true
            });
        });

        fs.readdirSync(`${__dirname}/filters/handler`).forEach((filename) => {
            if (!/\.js$/.test(filename)) {
                return;
            }
            const name = path.basename(filename, '.js');
            const _load = load.bind(null, './filters/handler/', name);
            Object.defineProperty(self.filters, name, {
                get: _load,
                enumerable: true
            });
            Object.defineProperty(self, name, {
                get: _load,
                enumerable: true
            });
        });

        fs.readdirSync(`${__dirname}/filters/rpc`).forEach((filename) => {
            if (!/\.js$/.test(filename)) {
                return;
            }
            const name = path.basename(filename, '.js');
            const _load = load.bind(null, './filters/rpc/', name);
            Object.defineProperty(self.rpcFilters, name, {
                get: _load,
                enumerable: true
            });
        });
    }
}


module.exports = new Dreamix();
