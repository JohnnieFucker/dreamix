const fs = require('fs');
const path = require('path');
const protobuf = require('dreamix-protobuf');
const Constants = require('../util/constants');
const crypto = require('crypto');
const logger = require('dreamix-logger').getLogger('dreamix', __filename);


class Component {
    constructor(app, opts) {
        this.app = app;
        opts = opts || {};
        this.watchers = {};
        this.serverProtos = {};
        this.clientProtos = {};
        this.version = '';

        this.name = '__protobuf__';

        const env = app.get(Constants.RESERVED.ENV);
        const originServerPath = path.join(app.getBase(), Constants.FILEPATH.SERVER_PROTOS);
        const presentServerPath = path.join(Constants.FILEPATH.CONFIG_DIR, env, path.basename(Constants.FILEPATH.SERVER_PROTOS));
        const originClientPath = path.join(app.getBase(), Constants.FILEPATH.CLIENT_PROTOS);
        const presentClientPath = path.join(Constants.FILEPATH.CONFIG_DIR, env, path.basename(Constants.FILEPATH.CLIENT_PROTOS));

        this.serverProtosPath = opts.serverProtos || (fs.existsSync(originServerPath) ? Constants.FILEPATH.SERVER_PROTOS : presentServerPath);
        this.clientProtosPath = opts.clientProtos || (fs.existsSync(originClientPath) ? Constants.FILEPATH.CLIENT_PROTOS : presentClientPath);

        this.setProtos(Constants.RESERVED.SERVER, path.join(app.getBase(), this.serverProtosPath));
        this.setProtos(Constants.RESERVED.CLIENT, path.join(app.getBase(), this.clientProtosPath));

        protobuf.init({ encoderProtos: this.serverProtos, decoderProtos: this.clientProtos });
    }


    encode(key, msg) {  // eslint-disable-line
        return protobuf.encode(key, msg);
    }

    encode2Bytes(key, msg) {   // eslint-disable-line
        return protobuf.encode2Bytes(key, msg);
    }

    decode(key, msg) {  // eslint-disable-line
        return protobuf.decode(key, msg);
    }

    getProtos() {
        return {
            server: this.serverProtos,
            client: this.clientProtos,
            version: this.version
        };
    }

    getVersion() {
        return this.version;
    }

    setProtos(type, _path) {
        if (!fs.existsSync(_path)) {
            return;
        }

        if (type === Constants.RESERVED.SERVER) {
            this.serverProtos = protobuf.parse(require(_path));// eslint-disable-line
        }

        if (type === Constants.RESERVED.CLIENT) {
            this.clientProtos = protobuf.parse(require(_path));// eslint-disable-line
        }

        const protoStr = JSON.stringify(this.clientProtos) + JSON.stringify(this.serverProtos);
        this.version = crypto.createHash('md5').update(protoStr, 'utf-8').digest('base64');

        // Watch file
        const watcher = fs.watch(_path, this.onUpdate.bind(this, type, _path));
        if (this.watchers[type]) {
            this.watchers[type].close();
        }
        this.watchers[type] = watcher;
    }

    onUpdate(type, _path, event) {
        if (event !== 'change') {
            return;
        }

        const self = this;
        fs.readFile(_path, 'utf8', (err, data) => {
            try {
                const protos = protobuf.parse(JSON.parse(data));
                if (type === Constants.RESERVED.SERVER) {
                    protobuf.setEncoderProtos(protos);
                    self.serverProtos = protos;
                } else {
                    protobuf.setDecoderProtos(protos);
                    self.clientProtos = protos;
                }

                const protoStr = JSON.stringify(self.clientProtos) + JSON.stringify(self.serverProtos);
                self.version = crypto.createHash('md5').update(protoStr, 'utf-8').digest('base64');
                logger.info('change proto file , type : %j, path : %j, version : %j', type, _path, self.version);
            } catch (e) {
                logger.warn('change proto file error! path : %j', _path);
                logger.warn(e);
            }
        });
    }

    stop(force, cb) {
        for (const type in this.watchers) {
            if (this.watchers.hasOwnProperty(type)) {
                this.watchers[type].close();
            }
        }
        this.watchers = {};
        process.nextTick(cb);
    }
}


module.exports = (app, opts) => new Component(app, opts);
