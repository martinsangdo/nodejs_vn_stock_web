/**
 * global variables
 */

var Global = {
		io : { },
		client_io: {},    //this server is client which connect to another server
		streams: {},
		system_db_server_connection: {} ,    //keep connections of db servers
		online_sockets: {}     //keep connections of db servers
};
module.exports = Global;
