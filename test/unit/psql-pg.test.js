var _ = require('underscore');
var assert = require('assert');
var PSQL = require('../../lib/psql');
var pg = require('pg');
var setup = require('../setup');

var dbopts_anon = {
    host: global.settings.db_host,
    port: global.settings.db_port,
    user: global.settings.db_pubuser,
    dbname: _.template(global.settings.db_base_name, {user_id: 1}),
    pass: global.settings.db_pubuser_pass
};

describe('maxRowSize config', function() {
    var globalSettings;

    before(function() {
        globalSettings = global.settings;
    });

    beforeEach(function() {
        global.settings = {};
    });

    after(function() {
        global.settings = globalSettings;
    });

    it('has a default undefined maxRowSize', function() {
        var psql = new PSQL(dbopts_anon);

        assert.equal(pg.defaults.maxRowSize, undefined);
    });

    it('sets maxRowSize', function() {
        var maxRowSize = 1000;
        global.settings.db_max_row_size = maxRowSize;
        var psql = new PSQL(dbopts_anon);

        assert.equal(pg.defaults.maxRowSize, maxRowSize);
    });
});
