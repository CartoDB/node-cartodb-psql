var _   = require('underscore'),
    env = require('../config/environments/test');

global.settings = {};
_.extend(global.settings, env);
