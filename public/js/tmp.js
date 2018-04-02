/**
 * author: Martin 2017
 */
// var socket  = io.connect('http://hoidapsuckhoeonline.com:3000');

/*
var socket  = io.connect('http://192.168.0.25:3000');

var $mess = $('#mess');

socket.on('connect', function () {
    $mess.text('connected!');
    socket.emit('join', { email: 'testengma1@gmail.com' });
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
*/
/**
 * send random message to user
 */
function send_rand_mess(){
    socket.emit('message', {
        to_email: 'testengma1@gmail.com',
        creator_name: 'I am engma 3',
        creator_email: 'testengma3@gmail.com',
        last_mess: Math.random()+'',
        mess_type: 'TEXT'
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
//PUSH
function send_push_message(){
    var uri = 'tmp/send_push_message';
    var token = $.trim($('#txt_token').val());
    var content = $.trim($('#txt_content').val());
    if (isEmpty(token) || isEmpty(content)){
        alert('must type token or content');
        return;
    }
    ajaxPost(uri, {token: token, content: content}, function(resp){
        console.log(resp);
    });
}
//
function window_onload(){

}
window.onload = window_onload;