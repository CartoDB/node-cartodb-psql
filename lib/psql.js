'use strict';

var _ = require('underscore');
var debug = require('debug')('cartodb-psql');
var QueryWrapper = require('./query_wrapper');
var pg = require('pg');//.native; // disabled for now due to: https://github.com/brianc/node-postgres/issues/48

var stdTypeName = require('./oid-to-name');
// Holds a typeId->typeName mapping for each database ever connected to
var extTypeName = {};

pg.on('error', function () {
    // All errors will be handled synchronously or at client level
    // this avoid uncaughtException
});

// Workaround for https://github.com/Vizzuality/CartoDB-SQL-API/issues/100
var types = pg.types;
var arrayParser = pg.types.arrayParser;
var floatArrayParser = function(val) {
    if(!val) { return null; }
    var p = arrayParser.create(val, function(entry) {
        return parseFloat(entry);
    });
    return p.parse();
};
types.setTypeParser(20, parseFloat); // int8
types.setTypeParser(700, parseFloat); // float4
types.setTypeParser(701, parseFloat); // float8
types.setTypeParser(1700, parseFloat); // numeric
types.setTypeParser(1021, floatArrayParser); // _float4
types.setTypeParser(1022, floatArrayParser); // _float8
types.setTypeParser(1231, floatArrayParser); // _numeric
types.setTypeParser(1016, floatArrayParser); // _int8

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
 * - {Number} maxRowSize The max number of bytes for a row, when exceeded the query will throw an error.
 * @returns PSQL
 */
var PSQL = function(connectionParams, poolParams, options) {
    options = options || {};
    options.maxRowSize = options.maxRowSize || undefined;

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
    pg.defaults.maxRowSize = options.maxRowSize || globalSettings.db_max_row_size;

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
        return this.database() + ":" + this.dbhost() + ":" + me.dbport();
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
            var types = ["'geometry'","'raster'","'geography'"]; // types of interest
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

    me.typeModInfo = function(typmod) {

        /* See https://github.com/postgis/postgis/blob/
           1277c750cb41807eefee4438a711746042d0cffe/liblwgeom/liblwgeom.h.in#L81-L98 */
        var wkbTypes = [
            "Unknown", "Point", "LineString", "Polygon",
            "MultiPoint", "MultiLineString", "MultiPolygon", "GeometryCollection",
            "CircularString", "CompoundCurve", "CurvePolygon", "MultiCurvePolygon",
            "PolyhedralSurface", "Triangle", "TIN"
        ];

        /* See https://github.com/postgis/postgis/blob/
           1277c750cb41807eefee4438a711746042d0cffe/liblwgeom/liblwgeom.h.in#L164-L172 */
        var srid   = ((typmod & 0x0FFFFF00) - (typmod & 0x10000000)) >> 8;
        var lwtype = (typmod & 0x000000FC)>>2;
        var has_z  = (typmod & 0x00000002)>>1;
        var has_m  = (typmod & 0x00000001);
        var ndims  = 2 + has_z + has_m;
        var wkbtype = wkbTypes[lwtype];

        return { srid: srid, ndims: ndims, wkbtype: wkbtype };
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

        this.connect(function(err, client, done) {
            if (err) {
                return callback(err);
            }

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

            var gotError = false;
            query.on('error', function(err) {
                client.removeListener('maxRowSize', maxRowSizeListener);
                client.removeListener('notice', noticeListener);
                gotError = true;
                done(err);
            });

            client.once('maxRowSize', maxRowSizeListener);

            // NOTE: for some obscure reason passing "done" directly
            //       as the listener works but can be slower
            //      (by x2 factor!)
            query.on('end', function() {
                client.removeListener('maxRowSize', maxRowSizeListener);
                client.removeListener('notice', noticeListener);
                if (!gotError) {
                    done();
                }
            });

            var queryCanceller = function() {
                pg.cancel(undefined, client, query);
            };

            return callback(null, query, queryCanceller);
        });
    };

    me.quoteIdentifier = function(str) {
        return pg.Client.prototype.escapeIdentifier(str);
    };

    me.escapeLiteral = function(str) {
        return pg.Client.prototype.escapeLiteral(str);
    };


    /**
     * Executes an array of queries.
     * Returns error if any query fails
     * Returns the result of the last query (if successful)
     */
    function queryArray(client, sql, params, callback) {
        client.query(sql[0], params, (err, result) => {
            sql.shift();
            if (err) {
                return callback(err);
            }
            if (sql.length === 0) {
                return callback(err, result);
            }

            return queryArray(client, sql, params, callback);
        });
    }

    /**
     *
     * @param {String} sql - Query
     * @param {Object} params - Query parameters
     * @param {Function} callback - (error, result)
     * @param {Boolean} readonly - If set, the query will be READ ONLY
     * @param {Integer} timeout - Milliseconds to timeout the query
     */
    me.query = function(sql, params, callback, readonly, timeout) {
        if (typeof params === 'function') {
          timeout = readonly;
          readonly = callback;
          callback = params;
          params = [];
        }

        this.connect(function(err, client, done) {
            if (err) {
                return callback(err);
            }
            if (!!readonly) {
                sql = `SET TRANSACTION READ ONLY; ${sql}`;
            }

            let sql_array = [ sql ];
            if (timeout !== undefined) {
                sql_array.unshift(`SET statement_timeout=${timeout};`);
            }

            queryArray(client, sql_array, params, (err, result) => {
                done(err);
                return callback(err, result);
            });
        });
    };

    me.end = function (callback) {
        callback = callback || function dummyCallback() {};

        var count = Object.keys(pg._pools).length;

        pg.once('end', function () {
            debug(count + ' pools were shutting down successfully');
            callback();
        });

        pg.end();
    };

    return me;
};

module.exports = PSQL;
module.exports.QueryWrapper = QueryWrapper;
