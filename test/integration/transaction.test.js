'use strict';

require('../setup');

var _ = require('underscore');
var assert = require('assert');
var PSQL = require('../../lib/psql');

var dbopts_auth = {
    host: global.settings.db_host,
    port: global.settings.db_port,
    user: _.template(global.settings.db_user, {user_id: 1}),
    dbname: _.template(global.settings.db_base_name, {user_id: 1}),
    pass: _.template(global.settings.db_user_pass, {user_id: 1})
};

var POOL_PARAMS = {};

describe('transaction', function() {

    it('query can be run after transaction fails', function(done){
        var pg = new PSQL(dbopts_auth, POOL_PARAMS, { destroyOnError: true });
        var sql = "BEGIN; select error; COMMIT;";
        pg.query(sql, function(err) {
            assert.ok(err);
            assert.equal(err.message, 'column "error" does not exist');

            pg.query('select 1 as foo', function(err, result) {
                assert.ok(result);
                assert.equal(result.rows[0].foo, 1);
                done();
            });
        });
    });

    it('evented query can be run after transaction fails', function(done){
        var pg = new PSQL(dbopts_auth, POOL_PARAMS, { destroyOnError: true });
        var sql = "BEGIN; select error; COMMIT;";
        pg.eventedQuery(sql, function(err, query) {

            query.on('error', function(err) {
                assert.ok(err);
                assert.equal(err.message, 'column "error" does not exist');
            });

            query.on('end', function() {
                pg.eventedQuery('select 1 as foo', function(err, query) {
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
