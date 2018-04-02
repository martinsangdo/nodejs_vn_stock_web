/**
 * author: Martin
 * modified: Nhan
 * @type {*}
 */
var express = require('express');
var Constant = require('../common/constant.js');

var Common = require('../common/common.js');
var common = new Common();
var PushNotif = require('../common/push_notif.js');
var pushNotif = new PushNotif();

var global = require('../global.js');

var DB_STRUCTURE = require('../models/system/DBStructure.js');
var DBOperater = require('../models/db_operator.js');
var dbOperator = new DBOperater();

module.exports = function (io) {
    // var i=0;

    io.on('connection', function (client) { // clients (Android/iOS/Web) connected to system automatically
        // common.dlog('-- Socket connected -- ' + (i++) + ': ' + client.id + " length: " + common.get_obj_len(io.sockets.sockets));
        // common.dlog('-- Socket connected -- ' + client.id);
        /**
         * register into socket list after login or open app again
         */
        client.on('join', function (options) { // add to Stream
            //save each user to his system, not necessary because we connect to each System DB
            var user_id = options.user_id;     //who begins using app
            client['user_info'] = {            //save user info to socket instance in order to use at another function
                user_id: user_id,
                sys_address: options[Constant.HEADER_PARAM.DB_ADDR],
                sys_db_name: options[Constant.HEADER_PARAM.DB_NAME]
            };

            if (common.isEmpty()) {
                global.online_sockets[user_id] = [];
            }
            global.online_sockets[user_id].push(client.id);     //set this user is online

            // common.dlog('-- ' + client.id + ' joined -- options.id: ' + user_id);
            //connect to specific system db
            var resp_conn = common.getSystemModelFromSocket(options[Constant.HEADER_PARAM.DB_ADDR], options[Constant.HEADER_PARAM.DB_NAME],
                options[Constant.HEADER_PARAM.DB_USERNAME], options[Constant.HEADER_PARAM.DB_PASSWORD], DB_STRUCTURE.LastMessage, Constant.COLLECTION_NAME.LAST_MESSAGE);
            if (resp_conn.result == Constant.FAILED_CODE) {
                client.emit('channel_list', {
                    result: Constant.FAILED_CODE,
                    message: Constant.SYSTEM_ADDRESS_NOT_FOUND
                });
            } else {
                //get list of friends who chatted with this user
                var condition = {
                    $or: [
                        {creator_id: user_id},        //me sent mess at the beginning
                        {to_user_ids: user_id}      //someone sent message to me
                    ]
                };
                //save DB models for fasting access
                //save DB model of LastMessage
                client['user_info']['db_last_message_model'] = resp_conn.db_model;
                //save DB model of Message
                var resp_message_conn = common.getSystemModelFromSocket(options[Constant.HEADER_PARAM.DB_ADDR], options[Constant.HEADER_PARAM.DB_NAME],
                    options[Constant.HEADER_PARAM.DB_USERNAME], options[Constant.HEADER_PARAM.DB_PASSWORD], DB_STRUCTURE.Message, Constant.COLLECTION_NAME.MESSAGE);
                client['user_info']['db_message_model'] = resp_message_conn.db_model;
                //save DB model of ReadMessage
                var resp_read_message_conn = common.getSystemModelFromSocket(options[Constant.HEADER_PARAM.DB_ADDR], options[Constant.HEADER_PARAM.DB_NAME],
                    options[Constant.HEADER_PARAM.DB_USERNAME], options[Constant.HEADER_PARAM.DB_PASSWORD], DB_STRUCTURE.ReadMessage, Constant.COLLECTION_NAME.READ_MESSAGE);
                client['user_info']['db_read_message_model'] = resp_read_message_conn.db_model;
                //save DB model of SystemMember
                var resp_sys_member_conn = common.getSystemModelFromSocket(options[Constant.HEADER_PARAM.DB_ADDR], options[Constant.HEADER_PARAM.DB_NAME],
                    options[Constant.HEADER_PARAM.DB_USERNAME], options[Constant.HEADER_PARAM.DB_PASSWORD], DB_STRUCTURE.SystemMember, Constant.COLLECTION_NAME.SYSTEM_MEMBER);
                client['user_info']['db_sys_mem_model'] = resp_sys_member_conn.db_model;

                //update status is delivered
                update_delivered_status_message(resp_conn.db_model, resp_message_conn.db_model, user_id);

                //find in LastMessage

                dbOperator.get_my_message_thread(resp_conn.db_model, condition, '', function (resp) {
                    if (common.isNotEmpty(resp.result) && resp.result == Constant.OK_CODE) {
                        //get data of first sender or receiver
                        var threads = resp.data;
                        var thread_len = threads.length;
                        if (thread_len == 0) {
                            //chat with noone
                            var resp_data = {
                                result: Constant.OK_CODE,
                                data: threads
                            };
                            client.emit('channel_list', resp_data);     //empty threads
                        } else {
                            //chat with someone else
                            var user_infos = {};
                            var count = 0;
                            var obj_emails = {};        //list of emails of sender & receiver

                            for (var i = 0; i < thread_len; i++) {
                                //get all emails of sender & receiver
                                obj_emails[threads[i]['first_sender_info']['email']] = 1;       //pivot key
                                obj_emails[threads[i]['first_receiver_info']['email']] = 1;     //pivot key
                            }
                            var email_num = common.get_obj_len(obj_emails);     //number of needed search emails
                            //search info of sender & receiver
                            Object.keys(obj_emails).forEach(function (email) {
                                user_infos[email] = {};     //keep info of this email
                                dbOperator.simple_search_by_condition(client['user_info']['db_sys_mem_model'],
                                    {email: email}, 'id email name cloud_avatar_id edit_detail', function(resp_user_info){
                                        if (resp_user_info.result == Constant.OK_CODE && resp_user_info.data.length > 0){
                                            user_infos[resp_user_info.data[0]['email']] = resp_user_info.data[0];
                                        }
                                        count++;
                                        if (count == email_num) {
                                            //searched all
                                            for (var j = thread_len-1; j >= 0; j--) {
                                                if (threads[j]['to_user_ids'].length == 0){
                                                    threads.splice(j, 1);       //remove this channel because receiver info not found
                                                    continue;
                                                }
                                                threads[j]['first_sender_info']['name'] = user_infos[threads[j]['first_sender_info']['email']]['name'];
                                                threads[j]['first_sender_info']['cloud_avatar_id'] = user_infos[threads[j]['first_sender_info']['email']]['cloud_avatar_id'];
                                                threads[j]['first_sender_info']['edit_detail'] = user_infos[threads[j]['first_sender_info']['email']]['edit_detail'];
                                                threads[j]['first_receiver_info']['name'] = user_infos[threads[j]['first_receiver_info']['email']]['name'];
                                                threads[j]['first_receiver_info']['cloud_avatar_id'] = user_infos[threads[j]['first_receiver_info']['email']]['cloud_avatar_id'];
                                                threads[j]['first_receiver_info']['edit_detail'] = user_infos[threads[j]['first_receiver_info']['email']]['edit_detail'];
                                            }
                                            var resp_data = {
                                                result: Constant.OK_CODE,
                                                data: threads
                                            };
                                            client.emit('channel_list', resp_data);
                                        }
                                    });
                            });
                        }
                    } else {        //server error
                        var resp_data = {
                            result: Constant.FAILED_CODE,
                            message: Constant.SERVER_ERR
                        };
                        client.emit('channel_list', resp_data);
                    }
                });
            }
        });


        /**
         * when user wants to send something to someone
         */
        client.on('message', function (options) {
            if (common.isEmpty(options) || common.isEmpty(options[Constant.PARAM.TO_USER_IDS])) {
                return;     //do nothing
            }
            var from_user_id = options[Constant.PARAM.FROM_USER_ID];
            var to_user_ids = options[Constant.PARAM.TO_USER_IDS];

            //check whether 2 users chatted or not before
            var condition = {
                $or: [
                    {creator_id: from_user_id, to_user_ids: to_user_ids},
                    {creator_id: to_user_ids, to_user_ids: from_user_id}
                ]
            };

            var db_last_message_model = client['user_info']['db_last_message_model'];
            var db_message_model = client['user_info']['db_message_model'];
            //
            var push_body = Constant.MESS.SENDING_A_MESS + options['mess_type'];        //body of Push notification
            if (common.isNotEmpty(options['push_body'])) {
                push_body = options['push_body'];
                if (push_body.length > 100){
                    //cut off the string
                    push_body = push_body.substr(0, 100);
                }
            }

            //Nhan: modify 20171225
            //find current last message
            dbOperator.search_one_by_condition(db_last_message_model, condition, '_id creator_id creator_name first_sender_info first_receiver_info status', function (res_search) {
                var data = {
                    creator_id: from_user_id,
                    creator_name: options['creator_name'],
                    content: options['content'],        //last message content
                    mess_type: options['mess_type']
                };

                if (common.isNotEmpty(options[Constant.PARAM.ORG_SIZE_ID]) && common.isNotEmpty(options[Constant.PARAM.TYPE])) {
                    data['media_cloud_ids'] = [];
                    data['media_cloud_ids'].push({
                        org_size: options[Constant.PARAM.ORG_SIZE_ID],
                        thumb_size: options[Constant.PARAM.THUMB_SIZE_ID],
                        fname: options[Constant.PARAM.FNAME],
                        type: options[Constant.PARAM.TYPE]
                    });
                }

                if (res_search.result == Constant.OK_CODE && common.isNotEmpty(res_search.data)) {
                    //2 users chatted before, just update something
                    data['from_user_id'] = from_user_id;
                    data['to_user_ids'] = [to_user_ids];
                    //create new message
                    create_new_message(db_message_model, data, function (res_create_mess) {
                        if (common.isNotEmpty(res_create_mess.result) && res_create_mess.result == Constant.OK_CODE) {
                            //get to_user_names because message needs name
                            dbOperator.search_by_condition(client['user_info']['db_sys_mem_model'], {_id: to_user_ids},
                                {limit: 1, skip: 0}, '_id name email public_key cloud_avatar_id edit_detail', {}, function (to_user_info) {
                                    if (common.isNotEmpty(to_user_info.result) && to_user_info.result == Constant.OK_CODE &&
                                        to_user_info.data.length > 0) {
                                        data['to_user_ids'] = [{
                                            _id: to_user_info.data[0]['_id'],
                                            name: to_user_info.data[0]['name'],
                                            email: to_user_info.data[0]['email'],
                                            cloud_avatar_id: to_user_info.data[0]['cloud_avatar_id'],
                                            edit_detail: to_user_info.data[0]['edit_detail']
                                        }];
                                        data['_id'] = res_create_mess._id;
                                        data['update_time'] = new Date();
                                        data['first_sender_info'] = res_search.data['first_sender_info'];
                                        data['first_receiver_info'] = res_search.data['first_receiver_info'];
                                        data['status'] = Constant.MESSAGE_STATUS.SENT;
                                        var resp_data = {
                                            result: Constant.OK_CODE,
                                            data: data,
                                            last_message_id: res_search.data['_id'],
                                            sys_address: client['user_info']['sys_address'],
                                            sys_db_name: client['user_info']['sys_db_name']
                                        };
                                        //update last message
                                        res_search.data.creator_id = data.creator_id;
                                        res_search.data.creator_name = data.creator_name;
                                        res_search.data.content = data.content;
                                        res_search.data.update_time = new Date();
                                        res_search.data.to_user_ids = [to_user_ids];
                                        res_search.data.mess_type = data.mess_type;
                                        res_search.data.message_id = res_create_mess._id;

                                        // res_search.data.read = false;
                                        res_search.data.status = Constant.MESSAGE_STATUS.SENT;
                                        res_search.data.save(function () {
                                            emit_message(resp_data);
                                        });
                                    } else {
                                        //not found
                                        var resp_data = {
                                            result: Constant.FAILED_CODE,
                                            message: Constant.USER_NOT_FOUND,
                                            sys_address: client['user_info']['sys_address'],
                                            sys_db_name: client['user_info']['sys_db_name']
                                        };
                                        emit_message(resp_data);
                                    }
                                });
                            //
                            var offlineUsers = common.get_offline_user([to_user_ids]);
                            send_push_new_message(client['user_info']['db_sys_mem_model'], options['creator_name'],
                                res_search.data['_id'], offlineUsers, push_body);
                            // upsert_read_message(client['user_info']['db_read_message_model'], client['user_info']['db_sys_mem_model'], options['creator_name'], res_search.data['_id'], to_user_ids);
                        } else {
                            var resp_data = {
                                result: Constant.FAILED_CODE,
                                message: res_create_mess.message,
                                sys_address: client['user_info']['sys_address'],
                                sys_db_name: client['user_info']['sys_db_name']
                            };
                            emit_message(resp_data);
                        }
                    });

                } else {
                    //2 users never chatted before
                    data['to_user_ids'] = [to_user_ids];
                    data['creator_id'] = from_user_id;
                    data['first_sender_info'] = {
                        _id: from_user_id,
                        name: common.isNotEmpty(options['first_sender_name']) ? options['first_sender_name'] : '',
                        email: common.isNotEmpty(options['first_sender_email']) ? options['first_sender_email'] : '',
                        cloud_avatar_id: {
                            org_size: common.isNotEmpty(options['first_sender_org_size']) ? options['first_sender_org_size'] : '',
                            thumb_size: common.isNotEmpty(options['first_sender_thumb_size']) ? options['first_sender_thumb_size'] : ''
                        }
                    };
                    data['first_receiver_info'] = {
                        name: common.isNotEmpty(options['first_receiver_name']) ? options['first_receiver_name'] : '',
                        email: common.isNotEmpty(options['first_receiver_email']) ? options['first_receiver_email'] : '',
                        cloud_avatar_id: {
                            org_size: common.isNotEmpty(options['first_receiver_org_size']) ? options['first_receiver_org_size'] : '',
                            thumb_size: common.isNotEmpty(options['first_receiver_thumb_size']) ? options['first_receiver_thumb_size'] : ''
                        }
                    };
                    data['from_user_id'] = from_user_id;
                    data['status'] = Constant.MESSAGE_STATUS.SENT;

                    create_new_message(client['user_info']['db_message_model'], data, function (res_create_mess) {
                        if (common.isNotEmpty(res_create_mess.result) && res_create_mess.result == Constant.OK_CODE) {
                            dbOperator.search_by_condition(client['user_info']['db_sys_mem_model'], {_id: to_user_ids},
                                {limit: 1, skip: 0}, '_id name email public_key cloud_avatar_id edit_detail', {}, function (to_user_info) {
                                    if (common.isNotEmpty(to_user_info.result) && to_user_info.result == Constant.OK_CODE &&
                                        to_user_info.data.length > 0) {
                                        //found info
                                        data['to_user_ids'] = [{
                                            _id: to_user_info.data[0]['_id'],
                                            name: to_user_info.data[0]['name'],
                                            email: to_user_info.data[0]['email'],
                                            cloud_avatar_id: to_user_info.data[0]['cloud_avatar_id'],
                                            edit_detail: to_user_info.data[0]['edit_detail']
                                        }];
                                        data['_id'] = res_create_mess._id;
                                        data['message_id'] = res_create_mess._id;
                                        data['update_time'] = new Date();
                                        data['status'] = Constant.MESSAGE_STATUS.SENT;

                                        dbOperator.create(db_last_message_model, data, function (res_create) {
                                            var resp_data = {
                                                result: Constant.OK_CODE,
                                                data: data,
                                                last_message_id: res_create['_id'],
                                                sys_address: client['user_info']['sys_address'],
                                                sys_db_name: client['user_info']['sys_db_name']
                                            };

                                            emit_message(resp_data);

                                            send_push_new_message(client['user_info']['db_sys_mem_model'], options['creator_name'],
                                                res_create['_id'], common.get_offline_user([to_user_ids]), push_body);
                                            // upsert_read_message(client['user_info']['db_read_message_model'], client['user_info']['db_sys_mem_model'], options['creator_name'], res_create['_id'], to_user_ids);
                                        });
                                    } else {
                                        //not found
                                        var resp_data = {
                                            result: Constant.FAILED_CODE,
                                            message: Constant.USER_NOT_FOUND,
                                            sys_address: client['user_info']['sys_address'],
                                            sys_db_name: client['user_info']['sys_db_name']
                                        };
                                        emit_message(resp_data);
                                    }
                                });

                        } else {
                            var resp_data = {
                                result: Constant.FAILED_CODE,
                                message: res_create_mess.message,
                                sys_address: client['user_info']['sys_address'],
                                sys_db_name: client['user_info']['sys_db_name']
                            };
                            emit_message(resp_data);
                        }
                    });
                }
            });


        });

        /**
         * when user wants to delete something to someone
         */
        client.on('delete_message', function (options) {
            if (common.isEmpty(options) || common.isEmpty(options[Constant.PARAM.TO_USER_IDS])) {
                return;     //do nothing
            }

            var loginedUserId = client['user_info'].user_id;

            var toUserId = common.trim(options[Constant.PARAM.TO_USER_IDS]);// user id receive message
            var messageId = common.trim(options[Constant.PARAM.MESSAGE_ID]);// message need deleting

            var send_data = {
                message_id: messageId
            };

            dbOperator.search_one_by_condition(client['user_info']['db_message_model'], {_id: messageId}, '', function (res_search) {
                if (res_search.result == Constant.OK_CODE) {
                    if (common.isNotEmpty(res_search.data)) {
                        if (res_search.data.from_user_id == loginedUserId) {
                            res_search.data.remove(function (err) {
                                if (!err) {
                                    //search if there is any Message
                                    var cond_mess  = {
                                            $or: [
                                                {from_user_id: loginedUserId, to_user_ids: toUserId},
                                                {from_user_id: toUserId, to_user_ids: loginedUserId}
                                            ]
                                        };
                                    dbOperator.simple_search_by_condition(client['user_info']['db_message_model'], cond_mess, '', function (res_search_1) {
                                        if (res_search_1.result == Constant.OK_CODE && res_search_1.data.length > 0){
                                            update_last_message(client['user_info']['db_sys_mem_model'], client['user_info']['db_message_model'],
                                                client['user_info']['db_last_message_model'], loginedUserId, res_search.data['to_user_ids'],
                                                function (res_update_last_mess) {
                                                    //emit to client, don't care data is null or not
                                                    common.emit_to_clients("delete_message", [loginedUserId], res_update_last_mess);
                                                    common.emit_to_clients("delete_message", toUserId, res_update_last_mess);
                                                });
                                        } else {
                                            //emit to client, don't care data is null or not
                                            common.emit_to_clients("delete_message", [loginedUserId], {result: Constant.OK_CODE});
                                            common.emit_to_clients("delete_message", toUserId, {result: Constant.OK_CODE});
                                        }
                                    });
                                } else {
                                    //error
                                }
                            });
                        } else {
                            //not allow to delete this mess
                        }
                    } else {
                        //message not found
                    }
                } else {
                    //error when retrieve message
                }
            });
        });

        /**
         * when user reads message from someone
         */
        client.on('read_message', function (options) {
            if (common.isEmpty(options) || common.isEmpty(options[Constant.PARAM.TO_USER_IDS])) {
                return;     //do nothing
            }

            var loginedUserId = client['user_info'].user_id;

            var toUserId = common.trim(options[Constant.PARAM.TO_USER_IDS]);// user id receive message
            var messageId = common.trim(options[Constant.PARAM.MESSAGE_ID]);// message need deleting
            var channelId = common.trim(options[Constant.PARAM.LAST_MESSAGE_ID]);// message need deleting


            var send_data = {
                message_id: messageId,
                last_message_id: channelId,
                status: Constant.MESSAGE_STATUS.READ
            };

            //update last message is read
            var db_last_message_model = client['user_info']['db_last_message_model'];
            if (common.isNotEmpty(channelId)) {
                dbOperator.update(db_last_message_model, {_id: channelId}, {status: Constant.MESSAGE_STATUS.READ}, function (resp_update) {

                });
            }

            dbOperator.search_one_by_condition(client['user_info']['db_message_model'], {_id: messageId}, '', function (res_search) {
                if (res_search.result == Constant.OK_CODE) {
                    if (common.isNotEmpty(res_search.data)) {
                        if (res_search.data.from_user_id != loginedUserId) {
                            // res_search.data.read = true;
                            res_search.data.status = Constant.MESSAGE_STATUS.READ;
                            res_search.data.save(function (err) {
                                if (!err) {
                                    //emit to client
                                    common.emit_to_clients("read_message", toUserId, send_data);
                                } else {
                                }
                            });
                        } else {
                        }
                    }
                } else {
                }
            });
        });

        /**
         * when user update status something to someone
         * user out site message details
         * if status isn't "read" or "delivery" => update status is "delivery"
         */
        client.on('update_status_message', function (options) {
            if (common.isEmpty(options) || common.isEmpty(options[Constant.PARAM.TO_USER_IDS])) {// object invalidate
                return;     //do nothing
            }

            var loginedUserId = client['user_info'].user_id;// signed user

            var toUserId = common.trim(options[Constant.PARAM.TO_USER_IDS]);// user id receive message
            var messageId = common.trim(options[Constant.PARAM.MESSAGE_ID]);// message need deleting
            var channelId = common.trim(options[Constant.PARAM.LAST_MESSAGE_ID]);// message need deleting


            var send_data = {
                message_id: messageId,
                last_message_id: channelId,
                status: Constant.MESSAGE_STATUS.DELIVERED
            };

            var db_last_message_model = client['user_info']['db_last_message_model'];
            if (common.isNotEmpty(channelId)) {
                dbOperator.update(db_last_message_model, {
                    _id: channelId,
                    status: {$ne: Constant.MESSAGE_STATUS.READ}
                }, {status: Constant.MESSAGE_STATUS.DELIVERED}, function (resp_update) {

                });
            }

            dbOperator.search_one_by_condition(client['user_info']['db_message_model'], {_id: messageId}, '', function (res_search) {
                if (res_search.result == Constant.OK_CODE) {
                    if (common.isNotEmpty(res_search.data)) {
                        if (res_search.data.from_user_id != loginedUserId && res_search.data.status != Constant.MESSAGE_STATUS.READ) {
                            res_search.data.status = Constant.MESSAGE_STATUS.DELIVERED;
                            res_search.data.save(function (err) {
                                if (!err) {
                                    //emit to client
                                    common.emit_to_clients("read_message", toUserId, send_data);
                                } else {
                                }
                            });
                        } else {
                        }
                    }
                } else {
                }
            });
        });

        /**
         * close or logout app
         */
        client.on('disconnect', function (options) {
            leave(options);
        });
        client.on('leave', function (options) {
            leave(options);
        });

        //========== ADDITIONAL FUNCTIONS
        /**
         * called when disconnected or leave/log out the app
         */
        function leave(options) {
            // common.dlog('-- ' + client.id + ' left --');
            if (common.isNotEmpty(client['user_info'])) {
                var user_id = client['user_info'].user_id;
                common.removeArrayItem(global.online_sockets[user_id], client.id);
            }


        }

        /**
         * indicate I read your message
         * @param resp_data
         */
        function emit_read_message(resp_data) {
            var sockets = io.sockets.sockets;	//all sockets of connected devices
            for (var socket_id in sockets) {		//traverse through all connected devices
                io.sockets.connected[socket_id].emit('is_read_message', resp_data);     //app will catch this event in message detail page
            }
        }


        function emit2Client(event, toUserId, sendData) {
            var sockets = io.sockets.sockets;	//all sockets of connected devices
            for (var socket_id in sockets) {		//traverse through all connected devices
                var receiver = io.sockets.connected[socket_id];
                if(receiver.user_info != null && receiver.user_info.user_id == toUserId){
                    io.sockets.connected[socket_id].emit(event, sendData);
                }

                // io.sockets.connected[socket_id].emit('message', resp_data);
            }
        }


        /**
         * emit message to other clients
         */
        function emit_message(resp_data) {
            var sockets = io.sockets.sockets;	//all sockets of connected devices
            for (var socket_id in sockets) {		//traverse through all connected devices
                io.sockets.connected[socket_id].emit('message', resp_data);
            }
        }

        /**
         * create new document in Message
         * @param last_mess_package
         * @param callback
         */
        function create_new_message(db_message_model, last_mess_package, callback) {
            var new_doc = {
                to_user_ids: last_mess_package['to_user_ids'],
                content: last_mess_package['content'],
                mess_type: last_mess_package['mess_type'],
                from_user_id: last_mess_package['creator_id']
            };
            if (common.isNotEmpty(last_mess_package['media_cloud_ids'])) {
                new_doc['media_cloud_ids'] = last_mess_package['media_cloud_ids'];
            }
            dbOperator.create(db_message_model, new_doc, callback);
        }

        // /**
        //  * insert / update document to ReadMessage
        //  * @param last_mess_id
        //  * @param to_user_id
        //  */
        // function upsert_read_message(db_read_message_model, db_sys_mem_model, sender_name, last_mess_id, to_user_id) {
        //     var condition = {
        //         last_mess_id: last_mess_id,
        //         to_user_id: to_user_id
        //     };
        //     var update_data = {
        //         last_mess_id: last_mess_id,
        //         to_user_id: to_user_id,
        //         read: false,
        //         update_time: new Date()
        //     };
        //     dbOperator.upsert(db_read_message_model, condition, update_data, function (resp) {
        //         //send push notification
        //         send_push_new_message(db_sys_mem_model, sender_name, last_mess_id, to_user_id);
        //     });
        // }

        /**
         * send push notif to all active phones of receiver
         * @param sender_name
         * @param last_mess_id
         * @param to_user_id
         */
        function send_push_new_message(db_sys_mem_model, sender_name, last_mess_id, to_user_id, push_content) {
            if (common.isEmpty(to_user_id) || to_user_id.length == 0) {
                return;
            }
            //get tokens of receivers
            dbOperator.search_by_condition(db_sys_mem_model, {_id: to_user_id}, {
                limit: 1,
                skip: 0
            }, 'android_tokens', {}, function (resp) {
                if (common.isNotEmpty(resp.result) && resp.result == Constant.OK_CODE) {
                    if (common.isNotEmpty(resp.data) && common.isNotEmpty(resp.data[0])) {
                        var params = {
                            to_user_id: to_user_id
                        };
                        //begin sending push message to phones
                        pushNotif.send_push_new_message(resp.data[0]['android_tokens'], params, sender_name, push_content);
                    }
                } else {
                    //do nothing
                }
            });
        }

        //update collection LastMessage after deleting
        function update_last_message(db_sys_mem_model, db_message_model, db_last_message_model, from_user_id, to_user_ids, callback) {
            var condition_last_message = {
                $or: [
                    {creator_id: from_user_id, to_user_ids: to_user_ids},
                    {creator_id: to_user_ids, to_user_ids: from_user_id}
                ]
            };
            dbOperator.search_one_by_condition(db_last_message_model, condition_last_message, '', function (res_last_mess) {
                if (res_last_mess.result == Constant.FAILED_CODE) {
                    callback(res_last_mess);
                } else if (res_last_mess.data != null) {
                    var lastMessId = res_last_mess.data['_id'];
                    //get newest message between 2 users
                    condition_last_message = {
                        $or: [
                            {from_user_id: from_user_id, to_user_ids: to_user_ids},
                            {from_user_id: to_user_ids, to_user_ids: from_user_id}
                        ]
                    };
                    dbOperator.get_my_final_message(db_message_model, condition_last_message, '', function (res_final_mess) {
                        if (res_final_mess.result == Constant.FAILED_CODE) {
                            callback(res_final_mess);
                        } else if (res_final_mess.data.length > 0) {
                            var finalMessData = res_final_mess.data[0];
                            //found 1, update it to LastMessage
                            var new_data_LastMessage = {
                                creator_id: finalMessData['from_user_id']['_id'],
                                creator_name: finalMessData['from_user_id']['name'],
                                content: finalMessData['content'],
                                message_id: finalMessData['_id'],
                                is_system_scope: finalMessData['is_system_scope'],
                                update_time: finalMessData['update_time'],
                                create_time: finalMessData['create_time'],
                                mess_type: finalMessData['mess_type'],
                                // read: finalMessData['read'],
                                status: finalMessData['status'],
                                to_user_ids: finalMessData['to_user_ids']
                            };
                            dbOperator.update(db_last_message_model, {_id: lastMessId}, new_data_LastMessage, function (res_update_last_mess) {
                                var last_mess = new_data_LastMessage;
                                last_mess['first_sender_info'] = res_last_mess.data['first_sender_info'];
                                last_mess['first_receiver_info'] = res_last_mess.data['first_receiver_info'];
                                last_mess['from_user_id'] = finalMessData['from_user_id']['_id'];
                                //find information of to_user_ids
                                dbOperator.search_by_condition(db_sys_mem_model, {_id: to_user_ids},
                                    {limit: 1, skip: 0}, '_id name email cloud_avatar_id edit_detail', {}, function (to_user_info) {
                                        if (to_user_info.result == Constant.OK_CODE && common.isNotEmpty(to_user_info.data) && to_user_info.data.length > 0){
                                            last_mess['to_user_ids'] = [{
                                                _id: to_user_info.data[0]['_id'],
                                                name: to_user_info.data[0]['name'],
                                                email: to_user_info.data[0]['email'],
                                                cloud_avatar_id: to_user_info.data[0]['cloud_avatar_id'],
                                                edit_detail: to_user_info.data[0]['edit_detail']
                                            }];
                                        }
                                        callback({
                                            result: Constant.OK_CODE,
                                            data: last_mess,
                                            last_message_id: lastMessId
                                        });
                                    });
                            });
                        } else {
                            //not found any message any more
                            //update LastMessage to deleted content (keep last one otherwise it will create new keys)
                            var new_data_LastMessage = {
                                content: '',
                                update_time: finalMessData['update_time']
                            };
                            dbOperator.update(db_last_message_model, {_id: lastMessId}, new_data_LastMessage, function (res_update_last_mess) {
                                callback({result: Constant.OK_CODE});       //all messages were deleted like never chat before
                            });
                        }
                    });
                } else {
                    //not found any last message
                    callback({result: Constant.OK_CODE});       //all messages were deleted like never chat before
                }
            });
        }

        //update status is delivered when user connect socket
        function update_delivered_status_message(dbLastMess, dbMess, user_id) {
            var deliveredCondition = {
                creator_id: {$ne: user_id},// creator not me
                to_user_ids: user_id, //i'm receiver
                status: Constant.MESSAGE_STATUS.SENT //status is sent
            };

            //updata status of channel
            dbOperator.update(dbLastMess, deliveredCondition, {status: Constant.MESSAGE_STATUS.DELIVERED}, function (resp_update) {

                }
            );

            var deliveredMessCondition = {
                from_user_id: {$ne: user_id},// creator not me
                to_user_ids: user_id, //i'm receiver
                status: Constant.MESSAGE_STATUS.SENT //status is sent
            };

            //update status of message
            dbOperator.search_all_by_condition(dbMess, deliveredMessCondition, "", {}, function (resp) {
                    if (common.isNotEmpty(resp.result) && resp.result == Constant.OK_CODE) {
                        for (var i = 0;i < resp.data.length; i++) {



                            resp.data[i].status = Constant.MESSAGE_STATUS.DELIVERED;
                            resp.data[i].save();

                            var condition_last_message = {
                                $or: [
                                    {creator_id: user_id, to_user_ids: resp.data[i].from_user_id},
                                    {creator_id: resp.data[i].from_user_id, to_user_ids: user_id}
                                ]
                            };

                            dbOperator.search_one_by_condition(dbLastMess, condition_last_message, '_id creator_name creator_id read status', function (res_channel_search, flag_object) {
                                if (common.isNotEmpty(res_channel_search.result) && res_channel_search.result == Constant.OK_CODE) {
                                    var resData = {
                                        message_id : flag_object._id,
                                        last_message_id: res_channel_search.data._id,
                                        status : Constant.MESSAGE_STATUS.DELIVERED
                                    };
                                    emit2Client("read_message",flag_object.from_user_id, resData);
                                }
                            }, resp.data[i]);

                        }
                    }


                }
            );
        }
    });
};