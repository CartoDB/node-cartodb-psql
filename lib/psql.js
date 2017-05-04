'use strict';

var _ = require('underscore');
var debug = require('debug')('cartodb-psql');
var assert = require('assert');
var QueryWrapper = require('./query_wrapper');
var step = require('step');
var pg = require('pg');//.native; // disabled for now due to: https://github.com/brianc/node-postgres/issues/48

pg.on('error', function () {
    // All errors will be handled synchronously or at client level
    // this avoid uncaughtException
});

// Workaround for https://github.com/Vizzuality/CartoDB-SQL-API/issues/100
var types = pg.types;
var arrayParser = pg.types.arrayParser;
var floatParser = function(val) {
    return parseFloat(val);
};
var floatArrayParser = function(val) {
    if(!val) { return null; }
    var p = arrayParser.create(val, function(entry) {
        return floatParser(entry);
    });
    return p.parse();
};
types.setTypeParser(20, floatParser); // int8
types.setTypeParser(700, floatParser); // float4
types.setTypeParser(701, floatParser); // float8
types.setTypeParser(1700, floatParser); // numeric
types.setTypeParser(1021, floatArrayParser); // _float4
types.setTypeParser(1022, floatArrayParser); // _float8
types.setTypeParser(1231, floatArrayParser); // _numeric
types.setTypeParser(1016, floatArrayParser); // _int8

// Standard type->name mappnig (up to oid=2000)
var stdTypeName = {
    16: 'bool',
    17: 'bytea',
    18: 'char',
    19: 'name',
    20: 'int8',
    21: 'int2',
    22: 'int2vector',
    23: 'int4',
    24: 'regproc',
    25: 'text',
    26: 'oid',
    27: 'tid',
    28: 'xid',
    29: 'cid',
    30: 'oidvector',
    71: 'pg_type',
    75: 'pg_attribute',
    81: 'pg_proc',
    83: 'pg_class',
    114: 'JSON',
    142: 'xml',
    143: '_xml',
    199: '_json',
    194: 'pg_node_tree',
    32: 'pg_ddl_command',
    210: 'smgr',
    600: 'point',
    601: 'lseg',
    602: 'path',
    603: 'box',
    604: 'polygon',
    628: 'line',
    629: '_line',
    700: 'float4',
    701: 'float8',
    702: 'abstime',
    703: 'reltime',
    704: 'tinterval',
    705: 'unknown',
    718: 'circle',
    719: '_circle',
    790: 'money',
    791: '_money',
    829: 'macaddr',
    869: 'inet',
    650: 'cidr',
    1000: '_bool',
    1001: '_bytea',
    1002: '_char',
    1003: '_name',
    1005: '_int2',
    1006: '_int2vector',
    1007: '_int4',
    1008: '_regproc',
    1009: '_text',
    1028: '_oid',
    1010: '_tid',
    1011: '_xid',
    1012: '_cid',
    1013: '_oidvector',
    1014: '_bpchar',
    1015: '_varchar',
    1016: '_int8',
    1017: '_point',
    1018: '_lseg',
    1019: '_path',
    1020: '_box',
    1021: '_float4',
    1022: '_float8',
    1023: '_abstime',
    1024: '_reltime',
    1025: '_tinterval',
    1027: '_polygon',
    1033: 'aclitem',
    1034: '_aclitem',
    1040: '_macaddr',
    1041: '_inet',
    1263: '_cstring',
    1042: 'bpchar',
    1043: 'varchar',
    1082: 'date',
    1083: 'time',
    1114: 'timestamp',
    1115: '_timestamp',
    1182: '_date',
    1183: '_time',
    1184: 'timestamptz',
    1185: '_timestamptz',
    1186: 'interval',
    1187: '_interval',
    1231: '_numeric',
    1266: 'timetz',
    1270: '_timetz',
    1560: 'bit',
    1561: '_bit',
    1562: 'varbit',
    1563: '_varbit',
    1700: 'numeric',
    1790: 'refcursor',
    2201: '_refcursor',
    2202: 'regprocedure',
    2203: 'regoper',
    2204: 'regoperator',
    2205: 'regclass',
    2206: 'regtype',
    4096: 'regrole',
    4089: 'regnamespace',
    2207: '_regprocedure',
    2208: '_regoper',
    2209: '_regoperator',
    2210: '_regclass',
    2211: '_regtype',
    4097: '_regrole',
    4090: '_regnamespace',
    2950: 'uuid',
    2951: '_uuid',
    3220: 'pg_lsn',
    3221: '_pg_lsn',
    3614: 'tsvector',
    3642: 'gtsvector',
    3615: 'tsquery',
    3734: 'regconfig',
    3769: 'regdictionary',
    3643: '_tsvector',
    3644: '_gtsvector',
    3645: '_tsquery',
    3735: '_regconfig',
    3770: '_regdictionary',
    3802: 'jsonb',
    3807: '_jsonb',
    2970: 'txid_snapshot',
    2949: '_txid_snapshot',
    3904: 'int4range',
    3905: '_int4range',
    3906: 'numrange',
    3907: '_numrange',
    3908: 'tsrange',
    3909: '_tsrange',
    3910: 'tstzrange',
    3911: '_tstzrange',
    3912: 'daterange',
    3913: '_daterange',
    3926: 'int8range',
    3927: '_int8range',
    2249: 'record',
    2287: '_record',
    2275: 'cstring',
    2276: 'any',
    2277: 'anyarray',
    2278: 'void',
    2279: 'trigger',
    3838: 'event_trigger',
    2280: 'language_handler',
    2281: 'internal',
    2282: 'opaque',
    2283: 'anyelement',
    2776: 'anynonarray',
    3500: 'anyenum',
    3115: 'fdw_handler',
    3310: 'tsm_handler',
    3831: 'anyrange',
};

// Holds a typeId->typeName mapping for each
// database ever connected to
var extTypeName = {};

/**
 * A simple postgres wrapper with logic about username and database to connect
 * - intended for use with pg_bouncer
 * - defaults to connecting with a "READ ONLY" user to given DB if not passed a specific user_id
 *
 * @param {Object} connectionParams Connection param options
 * - user: database username
 * - pass: database user password
 * - host: database host
 * - port: database port
 * - dbname: database name
 * @param {Object} poolParams
 * - size
 * - idleTimeout
 * - reapInterval
 * @param {Object} options
 * - {Boolean} destroyOnError whether the client must be removed from the pool on query error or not
 * @returns PSQL
 */
var PSQL = function(connectionParams, poolParams, options) {
    options = options || {};
    options.destroyOnError = options.destroyOnError || false;

    var me = {
        POOL_DEFAULT_SIZE: 16,
        POOL_DEFAULT_IDLE_TIMEOUT: 3000,
        POOL_DEFAULT_REAP_INTERVAL: 1000
    };

    // default pool params by global settings or default value
    var globalSettings = global.settings || {};
    var _poolParams = {
        size: globalSettings.db_pool_size || me.POOL_DEFAULT_SIZE,
        idleTimeout: globalSettings.db_pool_idleTimeout || me.POOL_DEFAULT_IDLE_TIMEOUT,
        reapInterval: globalSettings.db_pool_reapInterval || me.POOL_DEFAULT_REAP_INTERVAL
    };

    // pool params will have precedence over global or default settings
    poolParams = poolParams || {};
    _poolParams = _.extend(_poolParams, poolParams);

    // Max database connections in the pool
    // Subsequent connections will block waiting for a free slot
    pg.defaults.poolSize = _poolParams.size;

    // Milliseconds of idle time before removing connection from pool
    pg.defaults.poolIdleTimeout = _poolParams.idleTimeout;

    // Frequency to check for idle clients within the pool, ms
    pg.defaults.reapIntervalMillis = _poolParams.reapInterval;

    // Max row size returned by PG stream
    pg.defaults.maxRowSize = globalSettings.db_max_row_size;

    // keep alive configuration
    var keepAliveConfig;

    if (globalSettings.db_keep_alive) {
        keepAliveConfig = globalSettings.db_keep_alive.enabled;
    }

    var error_text = "Incorrect access parameters." +
        " If you are accessing via OAuth, please check your tokens are correct." +
        " For public users, please ensure your table is published.";
    if ( ! connectionParams || ( !_.isString(connectionParams.user) && !_.isString(connectionParams.dbname))) {
        throw new Error(error_text);
    }

    me.dbopts = connectionParams;

    me.poolParams = _poolParams;

    me.username = function(){
        return this.dbopts.user;
    };

    me.password = function(){
        return this.dbopts.pass;
    };

    me.database = function(){
        return this.dbopts.dbname;
    };

    me.dbhost = function(){
        return this.dbopts.host;
    };

    me.dbport = function(){
        return this.dbopts.port;
    };

    me.conString = "tcp://";
    if (me.username()) {
        me.conString += me.username();
    }
    me.conString += ":";
    if (me.password()) {
        me.conString += me.password();
    }
    me.conString += "@";
    if (me.dbhost()) {
        me.conString += me.dbhost();
    }
    if (me.dbport()) {
        me.conString += ":" + me.dbport();
    }
    me.conString += "/" + me.database();

    me.connectionObject = {
        host: me.dbhost(),
        port: me.dbport(),
        database: me.database(),
        user: me.username(),
        password: me.password(),
        keepAlive: keepAliveConfig,
        ssl: false
    };

    me.getConnectionConfig = function () {
        if (globalSettings.db_use_config_object) {
            return me.connectionObject;
        }
        return me.conString;
    };

    me.dbkey = function(){
        return this.database(); // + ":" + this.dbhost() + ":" + me.dbport();
    };

    me.ensureTypeCache = function(cb) {
        var db = this.dbkey();
        if (extTypeName[db]) {
            return cb();
        }
        this.dbConnect(this.getConnectionConfig(), function(err, client, done) {
            if (err) {
                return cb(err);
            }
            var types = ["'geometry'","'raster'"]; // types of interest
            var typesSqlQuery = "SELECT oid, typname FROM pg_type where typname in (" + types.join(',') + ")";
            client.query(typesSqlQuery, function(err,res) {
                done();
                if (err) {
                    return cb(err);
                }
                var cache = {};
                res.rows.map(function(r) {
                    cache[r.oid] = r.typname;
                });
                extTypeName[db] = cache;
                cb();
            });
        });
    };

    // Return type name for a type identifier
    //
    // Possibly returns undefined, for unkonwn (uncached)
    //
    me.typeName = function(typeId) {
        return stdTypeName[typeId] ? stdTypeName[typeId] : extTypeName[this.dbkey()][typeId];
    };

    me.dbConnect = function(conConfig, cb) {
        pg.connect(conConfig, function(err, client, done) {
            if ( err ) {
                debug("PostgreSQL connection error: %s - connection config: %s", err, conConfig);
                err = new Error("cannot connect to the database");
                err.http_status = 500; // connection errors are internal
            }
            cb(err, client, done);
        });
    };

    me.connect = function(cb){
        var that = this;
        this.ensureTypeCache(function(err) {
            if (err) {
                return cb(err);
            }

            that.dbConnect(that.getConnectionConfig(), cb);
        });
    };

    me.eventedQuery = function(sql, params, callback){
        var that = this;
        if (typeof params === 'function') {
          callback = params;
          params = [];
        }
        params = params || [];
        step(
            function(){
                that.sanitize(sql, this);
            },
            function(err) {
                assert.ifError(err);
                that.connect(this);
            },
            function(err, client, done){
                var next = this;
                assert.ifError(err);
                var query = client.query(sql, params);

                function maxRowSizeListener(message) {
                    pg.cancel(that.getConnectionConfig(), client, query);
                    query.emit('error', new Error('Row too large, was ' + message.length + ' bytes'));
                }

                // forward notices to query
                var noticeListener = function() {
                    query.emit('notice', arguments);
                };
                client.on('notice', noticeListener);

                query.on('error', function() {
                    client.removeListener('maxRowSize', maxRowSizeListener);
                    client.removeListener('notice', noticeListener);
                    done(options.destroyOnError);
                });

                client.once('maxRowSize', maxRowSizeListener);

                // NOTE: for some obscure reason passing "done" directly
                //       as the listener works but can be slower
                //      (by x2 factor!)
                query.on('end', function() {
                    client.removeListener('maxRowSize', maxRowSizeListener);
                    client.removeListener('notice', noticeListener);
                    done();
                });

                next(null, query, client);
            },
            function(err, query, client) {
                var queryCanceller = function() {
                    pg.cancel(undefined, client, query);
                };
                callback(err, query, queryCanceller);
            }
        );
    };

    me.quoteIdentifier = function(str) {
        return pg.Client.prototype.escapeIdentifier(str);
    };

    me.escapeLiteral = function(str) {
        return pg.Client.prototype.escapeLiteral(str);
    };

    me.query = function(sql, params, callback, readonly) {
        var that = this;
        var finish;
        if (typeof params === 'function') {
          readonly = callback;
          callback = params;
          params = [];
        }
        step(
            function(){
                that.sanitize(sql, this);
            },
            function(err) {
                assert.ifError(err);
                that.connect(this);
            },
            function(err, client, done){
                assert.ifError(err);
                finish = done;
                if (!!readonly) {
                    sql = 'SET TRANSACTION READ ONLY; ' + sql;
                }
                client.query(sql, params, this);
            },
            function(err, res) {

                // Release client to the pool
                //
                // NOTE: If we pass a true value to finish() the client will be removed from the pool.
                // We use that behaviour to remove clients when they err
                //
                // should this be postponed to after the callback ?
                if ( finish ) {
                    finish(options.destroyOnError && !!err);
                }

                callback(err, res);
            }
        );
    };

    // throw exception if illegal operations are detected
    // NOTE: this check is weak hack, better database
    //       permissions should be used instead.
    me.sanitize = function(sql, callback){
        // NOTE: illegal table access is checked in main app
        if (sql.match(/^\s+set\s+/i)){
            var error = new SyntaxError("SET command is forbidden");
            error.http_status = 403;
            callback(error);
            return;
        }
        callback(null,true);
    };

    return me;
};

module.exports = PSQL;
module.exports.QueryWrapper = QueryWrapper;
