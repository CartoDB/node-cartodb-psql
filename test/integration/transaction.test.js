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

var POOL_PARAMS = {};

var TRANSACTION_ABORTED_ERR_MESSAGE = 'current transaction is aborted, commands ignored until end of transaction block';

describe('transaction', function() {

    beforeEach(function() {
        pg._pools = [];
    });

    var querySuite = [
        {
            destroyOnError: true,
            assertFn: function validate(done) {
                return function(err, result) {
                    assert.ok(result);
                    assert.equal(result.rows[0].foo, 1);
                    done();
                };
            }
        },
        {
            destroyOnError: false,
            assertFn: function validate(done) {
                return function(err) {
                    assert.ok(err);
                    assert.equal(err.message, TRANSACTION_ABORTED_ERR_MESSAGE);
                    done();
                };
            }
        }
    ];

    querySuite.forEach(function(scenario) {
        var shouldOrShouldNot = scenario.destroyOnError ? ' ' : ' NOT ';
        it('should' + shouldOrShouldNot + 'run query after transaction fails', function(done) {
            var psql = new PSQL(dbopts_auth, POOL_PARAMS, { destroyOnError: scenario.destroyOnError });
            var sql = "BEGIN; select error; COMMIT;";
            psql.query(sql, function(err) {
                assert.ok(err);
                assert.equal(err.message, 'column "error" does not exist');
                psql.query('select 1 as foo', scenario.assertFn(done));
            });
        });
    });

    var eventedQuerySuite = [
        {
            destroyOnError: true,
            assertFn: function validate(done) {
                return function(err, query) {
                    query.on('row', function(row) {
                        assert.ok(row);
                        assert.equal(row.foo, 1);
                        done();
                    });
                };
            }
        },
        {
            destroyOnError: false,
            assertFn: function validate(done) {
                return function(err, query) {
                    query.on('error', function(err) {
                        assert.ok(err);
                        assert.equal(err.message, TRANSACTION_ABORTED_ERR_MESSAGE);
                        done();
                    });
                };
            }
        }
    ];

    eventedQuerySuite.forEach(function(scenario) {
        var shouldOrShouldNot = scenario.destroyOnError ? ' ' : ' NOT ';
        it('should' + shouldOrShouldNot + 'run evented query after transaction fails', function(done) {
            var psql = new PSQL(dbopts_auth, POOL_PARAMS, { destroyOnError: scenario.destroyOnError });
            var sql = "BEGIN; select error; COMMIT;";

            psql.eventedQuery(sql, function(err, query) {

                query.on('error', function(err) {
                    assert.ok(err);
                    assert.equal(err.message, 'column "error" does not exist');
                    psql.eventedQuery('select 1 as foo', scenario.assertFn(done));
                });
            });
        });
    });

});
