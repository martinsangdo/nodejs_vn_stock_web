/**
 * author: Martin 2017
 */
// var socket  = io.connect('http://hoidapsuckhoeonline.com:3000');
var socket  = io.connect('http://192.168.0.25:3001');
// var socket2  = io.connect('http://192.168.0.25:3002');


var $mess;

socket.on('connect', function () {
    $mess.text('connected!');
    socket.emit('join', {
        user_id: '596b9e8ddc16b51c17161533',
        'system-db-name': 'sys_26-1',
        'system-db-address': '192.168.0.25:3001',
        'system-db-username': '',
        'system-db-password': ''
    });
});

socket.on('disconnect', function () {
    console.log('you have been disconnected');
});
//listen event "message" from server (someone sent message)
socket.on('message', function (data) {
    console.log(data);
});

//listen event "message" from server (someone sent message)
socket.on('channel_list', function (data) {
    console.log(data);
});

socket.on('reconnect', function () {
    console.log('you have been reconnected');
});

/**
 * send random message to user
 */
function send_rand_mess(){
    socket.emit('message', {
        to_user_ids: '596b9e8ddc16b51c17161533',
        creator_name: 'user test 6',
        from_user_id: '5969e0fbb389de26034aa8ae',
        content: Math.random()+' 333',
        mess_type: 'text'
    });
}
//create new mongo db & random collection
function create_new_db(){
    var uri = 'tmp/create_new_db';
    var new_db_name = $.trim($('#txt_new_db').val());
    if (isEmpty(new_db_name)){
        return;
    }
    ajaxPost(uri, {new_db_name: new_db_name, new_db_collection: 'new_col_tbl'}, function(resp){
        console.log(resp);
    });
}
//
function window_onload(){
    $mess = $('#mess');
    // for (var i=0; i<10; i++){
    //     io.connect('http://192.168.0.25:3002');
    // }
}
window.onload = window_onload;