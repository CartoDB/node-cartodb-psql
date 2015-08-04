'use strict';

require('../setup');

var _ = require('underscore');
var assert = require('assert');
var PSQL = require('../../lib/psql');

var public_user = global.settings.db_pubuser;

var dbopts_auth = {
    host: global.settings.db_host,
    port: global.settings.db_port,
    user: _.template(global.settings.db_user, {user_id: 1}),
    dbname: _.template(global.settings.db_base_name, {user_id: 1}),
    pass: _.template(global.settings.db_user_pass, {user_id: 1})
};

var dbopts_anon = _.clone(dbopts_auth);
dbopts_anon.user = global.settings.db_pubuser;
dbopts_anon.pass = global.settings.db_pubuser_pass;

[true, false].forEach(function(useConfigObject) {
describe('psql', function() {

    before(function() {
        global.settings.db_use_config_object = useConfigObject;
    });

    it('test private user can execute SELECTS on db', function(done){
        var pg = new PSQL(dbopts_auth);
        var sql = "SELECT 1 as test_sum";
        pg.query(sql, function(err, result){
            assert.ok(!err, err);
            assert.equal(result.rows[0].test_sum, 1);
            done();
        });
    });

    it('test private user can execute CREATE on db', function(done){
        var pg = new PSQL(dbopts_auth);
        var sql = "DROP TABLE IF EXISTS distributors;" +
            " CREATE TABLE distributors (id integer, name varchar(40), UNIQUE(name))";
        pg.query(sql, function(err/*, result*/){
            assert.ok(_.isNull(err));
            done();
        });
    });

    it('test private user can execute INSERT on db', function(done){
        var pg = new PSQL(dbopts_auth);
        var sql = "DROP TABLE IF EXISTS distributors1;" +
            " CREATE TABLE distributors1 (id integer, name varchar(40), UNIQUE(name))";
        pg.query(sql, function(/*err, result*/){
            sql = "INSERT INTO distributors1 (id, name) VALUES (1, 'fish')";
            pg.query(sql,function(err, result){
                assert.deepEqual(result.rows, []);
                done();
            });
        });
    });

    it('test public user can execute SELECT on enabled tables', function(done){
        var pg = new PSQL(dbopts_auth);
        var sql = "DROP TABLE IF EXISTS distributors2;" +
            " CREATE TABLE distributors2 (id integer, name varchar(40), UNIQUE(name));" +
            " GRANT SELECT ON distributors2 TO " + public_user + ";";
        pg.query(sql, function(/*err, result*/){
            pg = new PSQL(dbopts_anon);
            pg.query("SELECT count(*) FROM distributors2", function(err, result){
                assert.equal(result.rows[0].count, 0);
                done();
            });
        });
    });

    it('test public user cannot execute INSERT on db', function(done){
        var pg = new PSQL(dbopts_auth);
        var sql = "DROP TABLE IF EXISTS distributors3;" +
            " CREATE TABLE distributors3 (id integer, name varchar(40), UNIQUE(name));" +
            " GRANT SELECT ON distributors3 TO " + public_user + ";";
        pg.query(sql, function(/*err, result*/){

            pg = new PSQL(dbopts_anon);
            pg.query("INSERT INTO distributors3 (id, name) VALUES (1, 'fishy')", function(err/*, result*/){
                assert.equal(err.message, 'permission denied for relation distributors3');
                done();
            });
        });
    });

    it('eventedQuery provisions a cancel mechanism to abort queries', function (done) {
        var psql = new PSQL(dbopts_auth);
        psql.eventedQuery("SELECT 1 as foo", function(err, query, queryCanceller) {
            assert.ok(_.isFunction(queryCanceller));
            done();
        });
    });
    it('should work with parameters', function (done) {
      var psql = new PSQL(dbopts_auth);
      psql.query("select * from generate_series(0, $1, $2)", [99, 1],function(err, result) {
          assert.equal(result && result.rows && result.rows.length, 100);
          done(err);
      });
    });
    it('should work with parameters as evented query', function (done) {
      var psql = new PSQL(dbopts_auth);
      psql.eventedQuery("select * from generate_series(0, $1, $2)", [99, 1],function(err, query) {
          assert.ok(!err);
          var called = 0;
          query.on('row', function () {
            called++;
            if (called > 99) {
              done();
            }
          }).on('error', done);
      });
    });
});
});

describe('client gets keep-alive config', function() {
    before(function() {
        global.settings.db_use_config_object = true;
    });

    after(function() {
        global.settings.db_use_config_object = false;
    });

    it('keep-alive is disabled by default', function (done) {
        var psql = new PSQL(dbopts_auth);
        psql.connect(function(err, client, close) {
            if (err) {
                return done(err);
            }

            close();

            assert.equal(client.connectionParameters.keepAlive, false);

            done();
        });
    });

    it('global keep-alive config is propagated to pg client', function (done) {
        var keepAliveEnabled = true;
        var keepAliveInitialDelay = 1000;
        global.settings.db_keep_alive = {
            enabled: keepAliveEnabled,
            initialDelay: keepAliveInitialDelay
        };
        var psql = new PSQL(dbopts_auth);
        psql.connect(function(err, client, close) {
            if (err) {
                return done(err);
            }

            close();

            assert.equal(client.connectionParameters.keepAlive.enabled, keepAliveEnabled);
            assert.equal(client.connectionParameters.keepAlive.initialDelay, keepAliveInitialDelay);

            done();
        });
    });
});
