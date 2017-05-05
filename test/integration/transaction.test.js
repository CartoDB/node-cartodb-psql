'use strict';

require('../setup');

var _ = require('underscore');
var assert = require('assert');
var PSQL = require('../../lib/psql');
var pg = require('pg');

var dbopts_auth = {
    host: global.settings.db_host,
    port: global.settings.db_port,
    user: _.template(global.settings.db_user, {user_id: 1}),
    dbname: _.template(global.settings.db_base_name, {user_id: 1}),
    pass: _.template(global.settings.db_user_pass, {user_id: 1})
};

describe('transaction', function() {

    beforeEach(function() {
        pg._pools = [];
    });

    it('should run query after transaction fails', function(done) {
        var psql = new PSQL(dbopts_auth);
        var sql = "BEGIN; select error; COMMIT;";
        psql.query(sql, function(err) {
            assert.ok(err);
            assert.equal(err.message, 'column "error" does not exist');
            psql.query('select 1 as foo', function(err, result) {
                assert.ok(result);
                assert.equal(result.rows[0].foo, 1);
                done();
            });
        });
    });

    it('should run evented query after transaction fails', function(done) {
        var psql = new PSQL(dbopts_auth);
        var sql = "BEGIN; select error; COMMIT;";

        psql.eventedQuery(sql, function(err, query) {

            query.on('error', function(err) {
                assert.ok(err);
                assert.equal(err.message, 'column "error" does not exist');
                psql.eventedQuery('select 1 as foo', function(err, query) {
                    query.on('row', function(row) {
                        assert.ok(row);
                        assert.equal(row.foo, 1);
                        done();
                    });
                });
            });
        });
    });

});
