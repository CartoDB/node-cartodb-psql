var _      = require('underscore'),
    assert = require('assert'),
    PSQL   = require('../../lib/psql'),
    setup  = require('../setup');

var dbopts_anon = {
    host: global.settings.db_host,
    port: global.settings.db_port,
    user: global.settings.db_pubuser,
    dbname: _.template(global.settings.db_base_name, {user_id: 1}),
    pass: global.settings.db_pubuser_pass
};

suite('psql', function() {

    test('test throws error if no args passed to constructor', function(){
        var msg;
        try {
            new PSQL();
        } catch (err){
            msg = err.message;
        }
        assert.equal(msg, "Incorrect access parameters. If you are accessing via OAuth, please check your tokens are correct. For public users, please ensure your table is published.");
    });

    test('dbkey depends on dbopts', function(){
        var opt1 = _.clone(dbopts_anon);
        opt1.dbname = 'dbname1';
        var pg1 = new PSQL(opt1);

        var opt2 = _.clone(dbopts_anon);
        opt2.dbname = 'dbname2';
        var pg2 = new PSQL(opt2);

        assert.ok(pg1.dbkey() !== pg2.dbkey(),
                'both PSQL object using same dbkey ' + pg1.dbkey());

        assert.ok(_.isString(pg1.dbkey()), "pg1 dbkey is " + pg1.dbkey());
    });

});
