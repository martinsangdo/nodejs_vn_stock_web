/**
 author: Martin 2017
 define structure of Collections
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var DB_STRUCTURE = {
    Temp: {     //for testing only
        last_modified_time: Date,   //time
        rand_str: String  //random string
    },
    SystemInfo: {
        name: {type: String, trim: true},
        plain_name      :   {type: String, trim: true},     //used in search, lowercase
        user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},     //owner of this system
        about: String,     //encrypted by a predefined password of LLOG, to prevent someone else steal DB
        cloud_avatar_id: {org_size: String, thumb_size: String},     //id of avatar in Google Drive
        db_server_link: String,     //Database URL of this system, it may differ from DB of L-LOG. Used to connect system DB. For ex: "http://145.33.55.205:3001"
        db_id_name: String,
        db_username         :   String,
        db_password         :   String,
        member_num: {type: Number, default: 0},
        app_code: String,
        cloud_id: String,
        create_time: {type: Date, default: Date.now},       //the time when this system is created
        update_time: {type: Date, default: Date.now}
    },
    SystemMember: {
        name: {type: String, trim: true},
        plain_name      :   {type: String, trim: true},     //used in search, lowercase
        email: {type: String, trim: true},
        cloud_avatar_id: {org_size: String, thumb_size: String},     //id of avatar in Google Drive
        android_tokens: [{type: String, trim: true}],   //android tokens of phone which user is using, use this token to send push notification
        profile_visibility: {type: Boolean, default: true},      //this user can be search by name by another user or not
        friend_list_visibility: {type: String, enum: ['public', 'friend', 'private'] , default: 'public'}, //this user allows others to see his friend list or not
        group_list_visibility: {type: String, enum: ['public', 'friend', 'private'] , default: 'public'}, //this user allows others to see his group list or not
        public_key: String,
        join_type: {
            type: String,
            enum: ['none', 'request_join', 'accepted', 'rejected', 'removed', 'inviting', 'blocked', 'remove_blocked'],
            default: 'none'
        },
        join_time: {type: Date, default: Date.now},       //the time when user joins into this system
        is_co_admin: {type: Boolean, default: false},    //TRUE/FALSE: TRUE means this user is Admin of this system (same level with owner but cannot kick owner out of this system)
        encrypted_sys_common_key: String,     //encrypted by (public key of this user + common key of system)
        my_sys_cloud_id: String,    //drive Id of my folder SYS_xxx
        edit_detail     :   {name: Date, avatar: Date},     //time of changed specific info
        register_time: {type: Date, default: Date.now},       //the time when user joins into LLOG server
        update_time: {type: Date, default: Date.now}
    },
    //Chat room
    LastMessage: {
        to_user_ids: [{type: Schema.Types.ObjectId, ref: 'SystemMember'}],
        creator_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},      //id of user who sent last message
        creator_name: String,     //name of person who just sent last message
        content: String,     //encrypted by???
        status: {type: String, enum: ['sent', 'delivered', 'read'], default: 'sent'},
        // read: {type: Boolean, default: false},
        mess_type: {type: String, enum: ['image', 'video', 'file', 'text'], default: 'text'},     //type: TEXT / IMAGE / VIDEO / FILE
        group_id: {type: Schema.Types.ObjectId, ref: 'Group'},      //id of group receiving the message
        message_id: {type: Schema.Types.ObjectId, ref: 'Message'},      //id of group receiving the message
        create_time: {type: Date, default: Date.now},
        update_time: {type: Date, default: Date.now},
        // keys_hash : [{//array of common key encrypt by public key
        //     email_hash : String,
        //     encrypt_key: String
        // }],
        first_sender_info: {
            _id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},
            email: String,
            name: String,
            cloud_avatar_id: {org_size: String, thumb_size: String},
            edit_detail: {name: {type: Date, default: Date.now}, avatar: {type: Date, default: Date.now}}
        },
        first_receiver_info: {
            email: String,
            name: String,
            cloud_avatar_id: {org_size: String, thumb_size: String},
            edit_detail: {name: {type: Date, default: Date.now}, avatar: {type: Date, default: Date.now}}
        },
        is_system_scope: {type: Boolean, default: false}
    },
    Message: {
        to_user_ids: [{type: Schema.Types.ObjectId, ref: 'SystemMember'}],
        content: String,      //id of user who sent last message
        mess_type: {type: String, enum: ['image', 'video', 'file', 'text'], default: 'text'},     //type: TEXT / IMAGE / VIDEO / FILE
        status: {type: String, enum: ['sent', 'delivered', 'read'], default: 'sent'},
        // read: {type: Boolean, default: false},
        media_cloud_ids: [{org_size: String, thumb_size: String, fname: String, type: {type: String, enum: ["image", "video"], default: "image"}}],
        resource_ids: [{org_size: String, desc: String, type: {type: String, enum: ["pdf", "doc", "file"], default: "file"}}],    //list of documents attached to the post
        group_id: {type: Schema.Types.ObjectId, ref: 'Group'},      //id of group receiving the message
        is_system_scope: {type: Boolean, default: false},
        from_user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},      //id of who begin chatting
        create_time: {type: Date, default: Date.now},
        update_time: {type: Date, default: Date.now},
    },
    Notification: {
        description: String,
        to_user_ids: [{type: Schema.Types.ObjectId, ref: 'SystemMember'}],
        type: {
            type: String,
            enum: ['none', 'request_join', 'accepted', 'rejected', 'invite_join', 'accept_invite', 'add_co_admin', 'co_admin_left', 'create_post', 'like_post', 'new_mess', 'create_comment', 'like_comment', 'reply_comment', 'create_group'],
            default: 'none'
        },
        group_id: {type: Schema.Types.ObjectId, ref: 'Group'},
        record_id: {type: Schema.Types.ObjectId, ref: 'Record'},
        from_user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},
        comment_id: {type: Schema.Types.ObjectId, ref: 'Comment'},
        reply_id: {type: Schema.Types.ObjectId, ref: 'Reply'},
        is_system_scope: {type: Boolean, default: false},
        create_time: {type: Date, default: Date.now},
        update_time: {type: Date, default: Date.now}
    },
    ReadMessage: {
        last_mess_id: {type: Schema.Types.ObjectId, ref: 'LastMessage'},
        to_user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},      //id of user who sent last message
        read: {type: Boolean, default: false},
        update_time: {type: Date, default: Date.now}
    },
    Comment: {
        content: {type: String, trim: true}, //encrypted by common key of group or system, depends on scope that Record belongs to
        media_cloud_ids: [{org_size: String, thumb_size: String, fname: String, ext: String}],
        user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},
        record_id: {type: Schema.Types.ObjectId, ref: 'Record'},
        resource_ids: [{org_size: String, fname: String, ext: String}],    //list of documents attached to the post
        create_time: {type: Date, default: Date.now},
        update_time: {type: Date, default: Date.now}
    },
    Group: {
        name: {type: String, trim: true},
        plain_name      :   {type: String, trim: true},     //used in search, lowercase
        about: {type: String, trim: true},
        cloud_id: {type: String, trim: true},
        cloud_avatar_id: {org_size: String, thumb_size: String},     //id of avatar in Google Drive
        profile_visibility: {type: Boolean, default: true},
        member_list_visibility: {type: Boolean, default: true},
        member_num: Number,
        user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},
        join_type   :   String, //fake field for searching
        create_time: {type: Date, default: Date.now},
        update_time: {type: Date, default: Date.now}
    },
    GroupMember: {
        join_type: {
            type: String,
            enum: ['none', 'request_join', 'accepted', 'rejected', 'removed', 'inviting', 'blocked', 'remove_blocked'],
            default: 'none'
        },
        //Remove_blocked: removed & blocked, user cannot find & join this group again. But can be invited again.,
        is_co_admin: {type: Boolean, default: false},
        user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},
        group_id: {type: Schema.Types.ObjectId, ref: 'Group'},
        encrypted_group_common_key: String,
        create_time: {type: Date, default: Date.now},
        update_time: {type: Date, default: Date.now}
    },
    Like: {
        record_id: {type: Schema.Types.ObjectId, ref: 'Record'},
        comment_id: {type: Schema.Types.ObjectId, ref: 'Comment'},
        user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},
        reply_id: {type: Schema.Types.ObjectId, ref: 'Reply'},
        create_time: {type: Date, default: Date.now}
    },
    Record: {
        title: {type: String, trim: true},     //encrypted by common key of system or group
        description: {type: String, trim: true},     //encrypted by common key of system or group
        media_cloud_ids: [{org_size: String, thumb_size: String, fname: String, ext: String}],
        resource_ids: [{org_size: String, fname: String, ext: String}],    //list of documents attached to the post
        user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},
        group_id: {type: Schema.Types.ObjectId, ref: 'Group'},
        cmt_num: {type: Number, default: 0},
        like_num: {type: Number, default: 0},
        read_num: {type: Number, default: 0},   //skip owner
        visibility: {type: Boolean, default: true},
        key1: String,
        key2: String,
        is_system_scope: {type: Boolean, default: false},  //this record is visible by users in system or not
        create_time: {type: Date, default: Date.now},
        update_time: {type: Date, default: Date.now}
    },
    ReadRecord: {
        read: {type: Boolean, default: true},
        user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},
        record_id: {type: Schema.Types.ObjectId, ref: 'Record'},
        update_time: {type: Date, default: Date.now}
    },
    Reply: {
        comment_id: {type: Schema.Types.ObjectId, ref: 'Comment'},
        user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},
        content: {type: String, trim: true},     //encrypted by common key of group or system, depends on scope that Record belongs to
        create_time: {type: Date, default: Date.now}
    },
    ReadNotification: {
        read: {type: Boolean, default: false},
        user_id: {type: Schema.Types.ObjectId, ref: 'SystemMember'},
        notification_id: {type: Schema.Types.ObjectId, ref: 'Notification'},
        update_time: {type: Date, default: Date.now}
    }
};
module.exports = DB_STRUCTURE;