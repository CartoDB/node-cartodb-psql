## Version 0.14.0 (2019-09-10)
 - Add optional timeout parameter to `PGSQL.query`. 

## Version 0.13.1 (2018-12-10)
 - Include host and port in the dbkey, so that type cache is
   recomputed upon migration #39

## Version 0.13.0 (2018-11-20)
 - Add support for Node.js 10
 - Add package-lock.json
 - `.end()` accepts callback

## Version 0.12.0 (2018-06-06)
 - Add `psql.typeModInfo(typmod)`

## Version 0.11.0 (2018-05-28)
 - Use node-postgres to `6.4.2-cdb1`.

## Version 0.10.2 (2017-10-03)
 - Upgrade debug to 3.x.

## Version 0.10.1 (2017-08-13)
 - Upgrade node-postgres to 6.1.6-cdb1.

## Version 0.10.0 (2017-08-10)
 - Remove check for SET statements.

## Version 0.9.0 (2017-08-09)
 - Expose `pg.end` #26.

## Version 0.8.0 (2017-05-05)
 - Remove `destroyOnError` option as we need to always destroy on error #22.
 - Remove `window_sql` function.

## Version 0.7.1 (2017-01-16)
 - Remove maxRowSize after query ends or errors #15.

## Version 0.7.0 (2016-12-21)
 - Upgrades pg to 6.1.2-cdb1.
 - Upgrade dev dependencies.
 - Replace comments with a single space #9.

## Version 0.6.1 (2015-09-16)
 - Use debug module to not output to stdout by default

## Version 0.6.0 (2015-08-04)
 - Updates types from pg_type.h (#1)
 - New `destroyOnError` option to remove clients from pool after a query fails
 - Discourages node 0.8.x

## Version 0.5.1 (2015-02-20)
 - Upgrades pg to 2.6.2-cdb3: keep alive set on socket connect

## Version 0.5.0 (2015-02-19)
 - Allow to specify keep-alive config via global.settings.db_keep_alive (#3)
   - It requires to use config as object
 - Connection config can be an object or a connectionString
 - Propagate db_max_row_size from global settings to pg default's maxRowSize
   Allows to set the max length in bytes for a row

## Version 0.4.0 (2014-08-14)
 - Have PGSQL.query take an optional third argument to request read-only
   See https://github.com/CartoDB/Windshaft/issues/130
 - Send 500 status and better error message on db connection error
 - Allow to use PSQL class with default libpq parameters

## Version 0.3.1 (2014-08-11)
 - Changes pg version to emit end event on close connection event

## Version 0.3.0 (2014-08-11)
 - Adds support for cancel a query, extracts functionality from CartoDB-SQL-API

## Version 0.2.0 (2014-08-06)
 - Changes to pick pool configuration from global settings if they exist

## Version 0.1.0 (2014-05-06)
 - Initial release
 - Porting from [CartoDB-SQL-API](https://github.com/CartoDB/CartoDB-SQL-API)
