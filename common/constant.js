/**
 * author: Martin
 * define constants using in this project
 */

var Constant	= {
		SERVER_ERR				: 'SERVER_ERR',
		QUERY_ERR 				: 'QUERY_ERR',
		EMPTY_DATA 				: 'EMPTY_DATA',
		FAILED_CODE				: 'FAILED',
		FAILED_LOG				: 'FAILED_LOG',
        EXISTED				    : 'EXISTED',
        NOT_EXISTED				: 'NOT_EXISTED',
        CONNECTED				: 'CONNECTED',
        CANNOT_CONNECTED		: 'CANNOT_CONNECTED',
		OK_CODE					: 'OK',
		LOGINED					: 'LOGINED',
		MISMATCH_PARAMS			: 'MISMATCH_PARAMS',    //wrong/missing parameters sending to server
        MALFORMED_PARAM         :   'MALFORMED_PARAM',  //param is not correct format
        NOT_FOUND               : 'NOT_FOUND',
		INVALID_PARAM_VALUE     :   'INVALID_PARAM_VALUE',
		SYSTEM_OWNER_NOT_FOUND  :   'SYSTEM_OWNER_NOT_FOUND',
        GROUP_OWNER_NOT_FOUND  :   'GROUP_OWNER_NOT_FOUND',
        SYSTEM_ADDRESS_NOT_FOUND   :   'SYSTEM_ADDRESS_NOT_FOUND',  //cannot connect to system db
        SYSTEM_NOT_FOUND          :   'SYSTEM_NOT_FOUND',
        USER_NOT_FOUND          :   'USER_NOT_FOUND',
        GROUP_NOT_FOUND          :   'GROUP_NOT_FOUND',
        UNAUTHORIZATION          :   'UNAUTHORIZATION',
        RECORD_NOT_FOUND         : 'RECORD_NOT_FOUND',
        COMMENT_NOT_FOUND         : 'COMMENT_NOT_FOUND',
		INVALID_REQUEST         :   'INVALID_REQUEST',
		COMMON_KEY_NOT_FOUND    : 'COMMON_KEY_NOT_FOUND',       //common key not found in Group or System
		CREATE_NOTIF_FAIL      :   'CREATE_NOTIF_FAIL',    //create notification is failed
		UTF_8					: 'UTF-8',
		TRUE					: true,
		FALSE					: false,
		STR_TRUE				: 'true',
		STR_FALSE				: 'false',
		INCREASE_1_FACTOR       :  1,   //used to increase counting number
        DECREASE_1_FACTOR       :  -1,
        PREVIOUS_RELATED_ITEMS_LEN: 5,  //such as: get 5 latest persons who commented
		UNDERSCORE: '_',
		COMMA: ',',
		DOT: '.',
		YES_NUMBER_VAL: 1,		//replace for "true" value because number is easier to compare
		STR_ALL: 'all',
		STR_YES: 'yes',
		STR_NO: 'no',
		LLOG_ACCESS_TOKEN_KEY: 'llog-token',       //in header of request
		LINE_FEED_CHAR: '\r\n',
		DEFAULT_PAGE_LENGTH: 10,        //number of items in 1 paging
        SEARCH_TYPE_AND:    'AND',
        SEARCH_TYPE_OR:     'OR',
        CAST_ERROR: 'CastError',        //message from query mongodb
        ObjectID: 'ObjectID',
        ObjectId: 'ObjectId',
        HEADER_PARAM: {
            DB_NAME: 'system-db-name',
            DB_ADDR: 'system-db-address',     //system db IP & port
            DB_USERNAME: 'system-db-username',
            DB_PASSWORD: 'system-db-password',
            PRIVATE_ACCESS_TOKEN: 'private_access_token'    //sent by SNS app only
        },
        MAX_TOKEN_NUM:  999,    //number of tokens that can send via Firebase
		PARAM: {	//params of APIs sent from client app
            _ID: '_id',
            NAME: 'name',
            USER_ID: 'user_id',
            MESSAGE_ID: 'message_id',
            USER_NAME: 'user_name',
			EMAIL: 'email',
            SEARCH_TYPE: 'search_type',     //AND or OR
            SEARCH_FIELD: 'search_field',   //conditioning field to search such as: name, email, ...
            SECURITY_CODE: 'security_code',
			EXCEPT_LOGIN_USER: 'except_login_user',
			PUBLIC_KEY: 'public_key',
			ANDROID_TOKENS: 'android_tokens',   //for Push notification
			AVATAR_ORG_SIZE_ID: 'avatar_org_size_id',   //Cloud id of avatar in original size
            AVATAR_THUMB_SIZE_ID: 'avatar_thumb_size_id',   //Cloud id of avatar in thumbnail size
            ORG_SIZE_ID: 'org_size_id',   //Cloud id of file in original size
            THUMB_SIZE_ID: 'thumb_size_id',     //Cloud id of file in thumbnail size
            EXTENSION: 'extension',
            FNAME: 'fname',     //file name
            PROFILE_VISIBILITY: 'profile_visibility',
            FRIEND_LIST_VISIBILITY: 'friend_list_visibility',
            GROUP_LIST_VISIBILITY: 'group_list_visibility',
            MEMBER_LIST_VISIBILITY: 'member_list_visibility',
            OFFSET: 'offset',		//used in paging
			LENGTH: 'length',		//used in paging
            JOIN_TYPE   :   'join_type',
            NOTIF_ID: 'notif_id',
            NOTIF_IDS: 'notif_ids',     //list of notification ids
            TO_USER_IDS: 'to_user_ids',
            FROM_USER_ID:   'from_user_id',
            LAST_MESSAGE_ID:   'last_message_id',
            LIST_KEY_HASH:   'list_key_hash',
            TIME_OF_OLDEST_MESSAGE:   'time_of_oldest_message_id',
            //system
            IS_CO_ADMIN :   'is_co_admin',      //is Admin of group/system too
            DB_SERVER_LINK  :   'db_server_link',
            DB_ID_NAME  :   'db_id_name',
            DB_USERNAME :   'db_username',
            DB_PASSWORD :   'db_password',
            ABOUT :   'about',
            ENCRYPTED_SYS_COMMON_KEY: 'encrypted_sys_common_key',
            ENCRYPTED_GROUP_COMMON_KEY: 'encrypted_group_common_key',
            SYSTEM_ID   :   'system_id',
            SYSTEM_NAME   :   'system_name',
            MY_SYS_CLOUD_ID :   'my_sys_cloud_id',      //cloud id of folder SYS_xxx
            CLOUD_ID :   'cloud_id',
            TYPE: 'type',
            VISIBILITY: 'visibility',
            IS_GET_MEM_LIST: 'is_get_mem_list',
            IS_GET_GROUP_LIST: 'is_get_group_list',
            IS_GET_COMMENT_LIST: 'is_get_cmt_list',
            //group
            GROUP_ID   :   'group_id',
            IS_SYSTEM_SCOPE: 'is_system_scope',
            GROUP_ID_LIST   :   'group_ids',
            //record
            TITLE: 'title',
            CONTENT: 'content',
            DESCRIPTION: 'description',
            RES_CLOUD_ID: 'resource_cloud_id',
            RECORD_ID: 'record_id',      //record/post ID
            MEDIA_CLOUD_ARRAY: 'media_cloud_array',
            RESOURCE_CLOUD_ARRAY: 'resource_cloud_array',
            COMMENT_ID: 'comment_id',
            IS_EDIT_AVATAR: 'is_edit_avatar'
		},
        SESSION: {		//keys in session
            KEY_USER_ID: 'sess_user_id',
            KEY_USER_TYPE: 'sess_user_type',
            KEY_USER_NAME: 'sess_user_name',
            LLOG_DB_ID: 'llog_db_id'        //key of session to login LLOG server
        },
        JOIN_TYPE: {        //used in enum of "join_type" in collections
            NONE:       'none',     //default
            REQUESTING_JOIN: 'request_join',
            ACCEPTED:   'accepted',
            REJECTED:   'rejected',
            REMOVED:    'removed',
            INVITING:   'inviting',
            BLOCKED:    'blocked',
            REMOVE_BLOCKED: 'remove_blocked'
        },
        NOTIF_TYPE: {       //type of each notification, must same in defined in collection Notification
		    CREATE_GROUP: 'create_group',
            CREATE_POST: 'create_post',
            CREATE_COMMENT: 'create_comment'
        },
        PUSH_CATEGORY: {
            MESSAGE: 'message',
            CREATED_NEW_RECORD: 'create_new_record',
            CREATED_NEW_COMMENT: 'create_new_comment'
        },
        MESS: {
		    SENDING_A_MESS: 'Sent you a new ',     //content of push notification Message
            CREATED_NEW_RECORD: '%from_obj% created new post in %to_obj%',
            CREATED_NEW_COMMENT: '%from_obj% commented in the post',
            CREATED_NEW_RECORD_BODY: 'Created post in ',
            CREATED_NEW_COMMENT_BODY: 'Commented in the post',
            REQUESTING_JOIN_SYSTEM: '%from_obj% requested to join your system %to_obj%',
            ACCEPTED_JOIN_SYSTEM: '%from_obj% accepted your request to join system: %to_obj%',
            REJECTED_JOIN_SYSTEM: '%from_obj% rejected your request to join system: %to_obj%',
            CREATE_GROUP: '%from_obj% created new group %to_obj%',
            REQUEST_JOIN_GROUP: '%from_obj% requested to join your group %to_obj%',
            ACCEPT_JOIN_GROUP: '%from_obj% accepted to join your group %to_obj%',
            REJECTED_JOIN_GROUP: '%from_obj% denied your request to join group %to_obj%'
        },
        COLLECTION_NAME: {      //DB collection names in system DB
		    LAST_MESSAGE: 'LastMessage',
            MESSAGE: 'Message',
            NOTIFICATION: 'Notification',
            READ_NOTIFICATION: 'ReadNotification',
            READ_MESSAGE: 'ReadMessage',
            SYSTEM_INFO: 'SystemInfo',
            SYSTEM_MEMBER: 'SystemMember',
            GROUP: 'Group',
            GROUP_MEMBER: 'GroupMember',
            RECORD: 'Record',
            READ_RECORD: 'ReadRecord',
            COMMENT: 'Comment'
        },
        MESSAGE_STATUS: {
            SENT: 'sent',
            DELIVERED: 'delivered',
            READ: 'read'
        }
};
//
module.exports = Constant;
