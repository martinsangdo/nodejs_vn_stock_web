/**
 * author: Martin
 */

var config = {
		local: {
			mode: 'local',
			port: 3003,
			mongo: {        //connect to LLOG DB
				host: 'localhost',
				port: 27017,
				user: 'sample_user',
				pass: '123456',
				db_name: 'llog_db'       //system1_db, llog_db
			},
						// local_mongo_server: '125.212.219.128:27017'      //real server: localhost:27017
			crypto_db: {	//app Crypto Wallet
				apiKey: "AIzaSyCVMevY_DkB_M_qWYM8BkJ3qRi7Hh47RKk",
		    authDomain: "cryptowallet-703c2.firebaseapp.com",
		    databaseURL: "https://cryptowallet-703c2.firebaseio.com",
		    projectId: "cryptowallet-703c2",
		    storageBucket: "cryptowallet-703c2.appspot.com",
		    messagingSenderId: "25714788159",
		    appId: "1:25714788159:web:967b4efcbd88266077b58a"
			}
		},
		production: {
			mode: 'production',
			port: 80,
			mongo: {
				host: '127.0.0.1',
				port: 27017
			},
			secret: 'adc07b33-12e0-4442-9db8-574a0441627b'		//session secret key
		}
}
module.exports = function(mode) {
	return config[mode || process.argv[2] || 'local'] || config.local;
}
