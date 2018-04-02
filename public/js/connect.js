/**
 * author Sang Do
 * @type {{host: string, hostname: string, "max reconnection attempts": number, path: string, port: number, secure: boolean, transports: string[], "try multiple transports": boolean}}
 */

var socket_options = {
    host: '123.30.182.116',
    hostname: '123.30.182.116',
    'max reconnection attempts': 100,
    path: '/socket.io',
    port: 8080,
    secure: false,
    transports: ['websocket'],
    'try multiple transports': false
}

function xlog(title, data){
    if (title == null){
        console.log(data);
    } else {
        console.log(title, data);
    }
}

var socket = io.connect('http://123.30.182.116:8080', socket_options);
socket.on("connect",function(){
    xlog('socket connected');

});
socket.on("HOSE_QUOTE",function(data){
    xlog('HOSE_QUOTE', data);
    data=JXG.decompress(data.msg);
    xlog('=========');
    xlog(data);
});
socket.on("MARKET_ALL_INDEX",function(data){
    xlog('MARKET_ALL_INDEX', data);
    data=JXG.decompress(data.msg);
    xlog('=========');
    xlog(data);
});
socket.on("HOSE_PT_BID",function(data){
    xlog('HOSE_PT_BID', data);
    data=JXG.decompress(data.msg);
    xlog('=========');
    xlog(data);
});
socket.on("HOSE_PT_MATCH",function(data){
    xlog('HOSE_PT_MATCH', data);
    data=JXG.decompress(data.msg);
    xlog('=========');
    xlog(data);
});
socket.on("disconnect",function(){
    xlog('socket disconnected');
});