* Version 0.5.0 (2015-mm-dd)
    - Propagate db_max_row_size from global settings to pg default's maxRowSize
      Allows to set the max length in bytes for a row

* Version 0.4.0 (2014-08-14)
    - Have PGSQL.query take an optional third argument to request read-only
      See https://github.com/CartoDB/Windshaft/issues/130
    - Send 500 status and better error message on db connection error
    - Allow to use PSQL class with default libpq parameters

* Version 0.3.1 (2014-08-11)
    - Changes pg version to emit end event on close connection event

* Version 0.3.0 (2014-08-11)
    - Adds support for cancel a query, extracts functionality from CartoDB-SQL-API

* Version 0.2.0 (2014-08-06)
    - Changes to pick pool configuration from global settings if they exist

* Version 0.1.0 (2014-05-06)
    - Initial release
    - Porting from [CartoDB-SQL-API](https://github.com/CartoDB/CartoDB-SQL-API)
