//author: SangDo 2015

var submitting = false;
var SERVER_URI = 'http://192.168.0.25:3001/';

function dlog(mess){
	if (!isEmpty(mess) && console.log)		//avoid IE
		console.log(mess);
		
}
function isEmpty(a_var){
	return a_var === undefined || a_var == null || $.trim(a_var)=='';
}
function isset(a_var){
	return !isEmpty(a_var);
}
function parseBool(b) {
    return !(/^(false|0)$/i).test(b) && !!b;
}
function show_alert(mess){
	alert(mess);
}
function show_confirm(mess){
	return window.confirm(mess);
}
//=======Redirect
function redirect(url){
	window.location.href=url;
}

function isAlphanumeric( str ) {
	 return /^[0-9a-zA-Z]+$/.test(str);
}
//========== CLASS
function Common() { }

//====================
function ajaxPost(uri, params, callback, callback_err){
	uri = encodeURI(SERVER_URI + uri);

	$.ajax({
		url: uri,//url is a link request
		type: 'POST',
		data: params, //data send to server
		dataType: 'json',	//jsonp causes error in IE
		complete: function (response){ //response that server rely
//			slog('>>>> complete request: ' + uri);
//			slog(response);
			if (response.status == 500 && callback_err !== undefined)		//error
				callback_err(response.responseText);
			else if (response.status == 200 && callback !== undefined)
				callback(response.responseText);
		},
	});
}
//====================
function ajaxGet(uri, params, callback, callback_err){
	uri = encodeURI(SERVER_URI + uri);

	$.ajax({
		url: uri,
		type: 'GET',
		data: params,
		dataType: 'json',	//jsonp causes error in IE
		complete: function (response){
//			slog('>>>> complete request: ' + uri);
//			slog(response);
			if (response.status == 500 && callback_err !== undefined)		//error
				callback_err(response.responseText);
			else if (response.status == 200 && callback !== undefined)
				callback(response.responseText);
		}
	});
}


var common = new Common();		//global object

