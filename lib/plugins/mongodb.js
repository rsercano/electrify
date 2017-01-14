const fs = require('fs');
const os = require('os');
const join = require('path').join;
const path = require('path');
const spawn = require('child_process').spawn;
const shell = require('shelljs');

module.exports = function ($, logger) {
    return new MongoDB($, logger);
};

const getProperMongo = function () {
    switch (os.platform()) {
        case 'darwin':
            return __dirname + '/mongo/darwin';
        case 'win32':
            return __dirname + '/mongo/win32';
        case 'linux':
            return __dirname + '/mongo/linux';
        default :
            throw 'Not supported os: ' + os.platform();
    }
};

function MongoDB($, logger) {
    this.$ = $;

    this.name = 'mongodb';
    this.app_mongo_path = join(this.$.env.app.bin, 'mongo');
    this.app_mongod_path = this.app_mongo_path + 'd';

    // the env object properties is sent to meteor during initialization,
    // through process.env
    this.env = {};

    this.log = logger($, 'electrify:plugins:' + this.name);

    if (this.$.env.os.is_windows) {
        this.app_mongo_path += '.exe';
        this.app_mongod_path += '.exe';
    }
}

MongoDB.prototype.acquire = function (done) {

    if (!fs.existsSync(this.app_mongo_path)) {
        this.log.info('acquiring mongo');
        shell.cp(getProperMongo() + "/mongo" + (os.platform() === 'win32' ? '.exe' : ''), this.$.env.app.bin);
    } else
        this.log.info('mongo already acquired, moving on');

    if (!fs.existsSync(this.app_mongod_path)) {
        this.log.info('acquiring mongod');
        shell.cp(getProperMongo() + "/mongod" + (os.platform() === 'win32' ? '.exe' : ''), this.$.env.app.bin);
    } else
        this.log.info('mongod already acquired, moving on');

    done();
};

MongoDB.prototype.start = function (done) {

    // in development mode, when app is not inside elctron, mongodb is just not
    // needed, since meteor itself is already running its own mongodb
    if (!this.$.env.app.is_packaged) {
        this.log.info('app not packaged, skipping start');
        return setTimeout(done, 1);
    }

    this.log.info('starting mongo...');

    var self = this;

    this.$.freeport(null, function (port) {

        // mounts mongodb data dir based on user's config

        // when `preserve_db` option is set to true, store db in user's data dir
        if (self.$.env.app.config.preserve_db)
            self.dbdir = join(self.$.env.app.data_dir, 'db');

        // otherwise store db in `/resources` folder
        else
            self.dbdir = join(self.$.env.app.root, 'db');

        // assemble other data
        self.lockfile = join(self.dbdir, 'mongod.lock');
        self.port = port;

        // certify the the dir exists before using it
        shell.mkdir('-p', self.dbdir);

        // force removes the mongod.lock file - even it may look foolish, it's the
        // only way since mongod never shutdown under windows
        shell.rm('-f', self.lockfile);

        self.process = spawn(self.app_mongod_path, [
            '--dbpath', self.dbdir,
            '--port', self.port,
            '--bind_ip', '127.0.0.1',
            '--smallfiles'
        ]);

        var started = false;
        self.process.stdout.on('data', function (data) {
            // mimics inherit
            console.log(data.toString());

            if (!started && /waiting for connections/.test(data.toString())) {
                self.log.info('mongo started');
                self.env.MONGO_URL = 'mongodb://localhost:' + self.port + '/meteor';
                started = true;
                done();
            }
        });

        self.process.stderr.pipe(process.stderr);
    });
};

MongoDB.prototype.stop = function () {
    if (this.process)
        this.$._kill(this.process);
};
