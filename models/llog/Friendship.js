/**
 * author: Martin
 * relationship between users & friends
 */
//grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

//define format of Collection
var FriendshipSchema = new Schema({
    join_type       :   {type: String, enum: ['none', 'accepted', 'requesting', 'rejected'] , default: 'none'},
    from_user_id    :   {type: Schema.Types.ObjectId, ref :'User'},
    to_user_id      :   {type: Schema.Types.ObjectId, ref :'User'},
    encrypted_from_common_key :   String,
    encrypted_to_common_key   :   String,
    create_time     :   Boolean,
    update_time     :   Boolean
}, { collection: 'Friendship' });

//the schema is useless so far
//we need to create a model using it
var Friendship = mongoose.model('Friendship', FriendshipSchema);

//make this available to our users in our Node applications
module.exports = Friendship;

