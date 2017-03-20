define('admin/plugins/sso-auth-weibo', ['settings'], function(Settings) {
	'use strict';
	/* globals $, app, socket, require */

	var ACP = {};

	ACP.init = function() {
		Settings.load('sso-auth-weibo', $('.sso-auth-weibo-settings'));

		$('#save').on('click', function() {
			Settings.save('sso-auth-weibo', $('.sso-auth-weibo-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'sso-auth-weibo-saved',
					title: 'Settings Saved',
					message: 'Please reload your NodeBB to apply these settings',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return ACP;
});
