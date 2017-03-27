(function (module) {
	"use strict";

	var user = module.parent.require('./user'),
		meta = module.parent.require('./meta'),
		db = module.parent.require('../src/database'),
		passport = module.parent.require('passport'),
		passportWeibo = require('passport-weibo').Strategy,
		nconf = module.parent.require('nconf'),
		async = module.parent.require('async');

	var authenticationController = module.parent.require('./controllers/authentication');

	var constants = Object.freeze({
		'name': "weibo",
		'display_name': "微博",
		'plugin_name': "sso-auth-weibo",
		'admin': {
			'route': '/plugins/sso-auth-weibo',
			'icon': 'fa-weibo'
		}
	});

	var OAuth = {
		settings: undefined
	};

	OAuth.init = function (data, callback) {
		function render(req, res, next) {
			res.render('admin'+constants.admin.route, {});
		}

		data.router.get('/admin'+constants.admin.route, data.middleware.admin.buildHeader, render);
		data.router.get('/api/admin'+constants.admin.route, render);

		callback();
	};

	OAuth.getStrategy = function (strategies, callback) {
		meta.settings.get(constants.plugin_name, function (err, settings) {
			OAuth.settings = settings;
			if (!err && settings['id'] && settings['secret']) {
				passport.use(new passportWeibo({
					clientID: settings['id'],
					clientSecret: settings['secret'],
					callbackURL: nconf.get('url') + '/auth/'+constants.name+'/callback',
					passReqToCallback: true
				}, function (req, accessToken, refreshToken, profile, done) {
					if (req.hasOwnProperty('user') && req.user.hasOwnProperty('uid') && req.user.uid > 0) {
						user.setUserField(req.user.uid, constants.name+':open_id', profile.id);
						db.setObjectField(constants.name+':open_id', profile.id, req.user.uid);
						return done(null, req.user);
					}

					OAuth.login(profile.id, profile.displayName, profile._json.profile_image_url, function (err, user) {
						if (err) {
							return done(err);
						}

						authenticationController.onSuccessfulLogin(req, user.uid);
						done(null, user);
					});
				}));

				strategies.push({
					name: constants.name,
					displayName: constants.display_name,
					url: '/auth/'+constants.name,
					callbackURL: '/auth/'+constants.name+'/callback',
					icon: constants.admin.icon,
					scope: ''
				});
			}

			callback(null, strategies);
		});
	};

	OAuth.getAssociation = function (data, callback) {
		user.getUserField(data.uid, constants.name+':open_id', function (err, open_id) {
			if (err) {
				return callback(err, data);
			}

			if (open_id) {
				data.associations.push({
					associated: true,
					url: 'https://weibo.com/u/' + open_id,
					name: constants.name,
					icon: constants.admin.icon
				});
			} else {
				data.associations.push({
					associated: false,
					url: nconf.get('url') + '/auth/'+constants.name,
					name: constants.name,
					icon: constants.admin.icon
				});
			}

			callback(null, data);
		})
	};

	OAuth.login = function (open_id, username, photo, callback) {
		OAuth.getUidByOpenId(open_id, function (err, uid) {
			if (err) {
				return callback(err);
			}

			if (uid !== null) {
				callback(null, {
					uid: uid
				});
			} else {
				user.create({username: username}, function (err, uid) {
					if (err) {
						return callback(err);
					}

					user.setUserField(uid, constants.name+':open_id', open_id);
					db.setObjectField(constants.name+':open_id', open_id, uid);
					var autoConfirm = Weibo.settings && Weibo.settings.autoconfirm === "on" ? 1 : 0;
					user.setUserField(uid, 'email:confirmed', autoConfirm);

					if (photo && photo.length > 0) {
						user.setUserField(uid, 'uploadedpicture', photo);
						user.setUserField(uid, 'picture', photo);
					}

					callback(null, {
						uid: uid
					});
				});
			}
		});
	};

	OAuth.getUidByOpenId = function (open_id, callback) {
		db.getObjectField(constants.name+':open_id', open_id, function (err, uid) {
			if (err) {
				return callback(err);
			}
			callback(null, uid);
		});
	};

	OAuth.addMenu = function (custom_header, callback) {
		custom_header.authentication.push({
			"route": constants.admin.route,
			"icon": constants.admin.icon,
			"name": constants.name
		});

		callback(null, custom_header);
	};

	OAuth.deleteUser = function (data, callback) {
		var uid = data.uid;

		async.waterfall([
			async.apply(user.getUserField, uid, constants.name+':open_id'),
			function (open_id, next) {
				db.deleteObjectField(constants.name+':open_id', open_id, next);
			}
		], function (err) {
			if (err) {
				winston.error('[sso-weibo] Could not remove OAuthId data for open id ' + uid + '. Error: ' + err);
				return callback(err);
			}
			callback(null, uid);
		});
	};

	module.exports = OAuth;
}(module));
