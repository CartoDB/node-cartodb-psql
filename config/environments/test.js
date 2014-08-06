module.exports.environment  = 'test';
module.exports.db_base_name = 'cartodb_test_user_<%= user_id %>_db';
module.exports.db_user      = 'test_cartodb_user_<%= user_id %>';
module.exports.db_user_pass      = 'test_cartodb_user_<%= user_id %>_pass';
// Name of the anonymous PostgreSQL user
module.exports.db_pubuser   = 'testpsqlpublicuser';
// Password for the anonymous PostgreSQL user
module.exports.db_pubuser_pass   = 'public';
module.exports.db_host      = 'localhost';
module.exports.db_port      = '5432';
