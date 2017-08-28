'use strict';

var mSocket			= null;
var mPeerConnection	= null;

var mToUserKey			= null;
var mLocalVideo			= document.querySelector('#localVideo');
var mLocalVideoStream	= null;
var mRemoteVideo		= document.querySelector('#remoteVideo');

var messageTextBox = $('#messageTextBox');
messageTextBox.keypress(function(e) {
    if (e.which == 13)
		sendChatMessage();
});

$('#messageSendButton').click(function() {
	sendChatMessage();
});

function sendChatMessage() {
	var message = messageTextBox.val();
	addChatMessage(null, message);
	socketManagementSendMessage(mSocket, mToUserKey, message);
	messageTextBox.val("");
	messageTextBox.focus();
}

$('#callAnswerButton').click(function() {
	socketManagementDialAnswer(mSocket, mToUserKey);
	
	if (mPeerConnection === null)
	{
		// create pear connection
		mPeerConnection = peerConnectionCreate(
			mRemoteVideo,
			function(data) {
				socketManagementSendMessage(mSocket, mToUserKey, data);
			}
		);
		
		// local stream to send for target
		peerConnectionAddStream(mPeerConnection, mLocalVideoStream);
	}
	
	// send call for answer peer connection
	peerConnectionDoCall(mPeerConnection);
	
	closeModalCalling();
});

$('#callRejectButton').click(function() {
	socketManagementDialReject(mSocket, mToUserKey);
	closeModalCalling();
	showModalUsers();
});

$('#callEndButton').click(function() {
	stopVideoCall(mToUserKey);
	showModalUsers();
});

window.onbeforeunload = function() {
	stopVideoCall(mToUserKey);
	stopSession();
};

function getParameterByName(name) {
	var url = window.location.href;
	name = name.replace(/[\[\]]/g, "\\$&");
	var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
		results = regex.exec(url);
	if (!results)
		return null;
	if (!results[2])
		return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function showModalUsers() {
	$('#modalUsers').modal({
		backdrop	: 'static',
		keyboard	: false,
		show		: true
	});
}

function closeModalUsers() {
	$('#modalUsers').modal('hide');
}

function addUsersRegister(users) {
	var user_list = $('#modalUsersList');
	for (var user_idx in users)
	{
		var user = users[user_idx];
		
		var button_existing = $("button[data-key='" + user.key + "']", user_list);
		if (button_existing.length == 0)
		{
			var button = $("<button>", {
				'data-key'	: user.key,
				'type'		: 'button',
				'class'		: 'btn btn-primary btn-sm btn-block'
			})
			.text(user.name)
			.click(function(){
				var user_key = $(this).attr('data-key');
				mToUserKey = user_key;
				socketManagementDialRequest(mSocket, user_key);
			});
			user_list.append(button);
		}
		else
		{
			if (user.oncall)
				button_existing.text(user.name + " [on calling]");
			else
				button_existing.text(user.name);
		}
	}
}

function removeUsersRegister(users) {
	var user_list = $('#modalUsersList');
	for (var user_idx in users)
	{
		var user = users[user_idx];
		
		var button = $("button[data-key='" + user.key + "']", user_list);
		button.remove();
	}
}

function showModalCalling(user_caller) {
	$('#modalCalling').modal({
		backdrop	: 'static',
		keyboard	: false,
		show		: true
	});
	
	if (user_caller)
	{
		$('#modalCallingLabel').text(user_caller.name + " memanggil...");
	}
}

function closeModalCalling() {
	$('#modalCalling').modal('hide');
	$('#modalCallingLabel').text("Tidak ada yang memanggil.");
}

function addChatMessage(user, message) {
	var message_list = $('#messageList');
	var user_name = "me";
	if (user)
		user_name = user.name;
	var message = $("<li>")
		.text(user_name + " : " + message);
	message_list.append(message);
	
	var message_list_parent = message_list.parent();
	message_list_parent.scrollTop(message_list_parent[0].scrollHeight);
}

// ---------------------
// -- session handler --
// ---------------------

function startSession() {
	var id = getParameterByName('id'),
		type = getParameterByName('type'),
		name = getParameterByName('name'),
		photo = "http://localhost/image.jpg";
	
	mSocket = socketManagementRegister(
		{
			id		: id,
			type	: type,
			name	: name,
			photo	: photo
		},
		{
			onRegistered			: signalOnRegistered,
			onUserOtherRegistered	: signalOnUserOtherRegistered,
			onUserOtherUnregistered	: signalOnUserOtherUnregistered,
			onGetUserOthers			: signalOnGetUserOthers,
			onUserOtherOffCall		: signalOnUserOtherOffCall,
			onUserOtherOnCall		: signalOnUserOtherOnCall,
			onRequestDial			: signalOnRequestDial,
			onDialingFailed			: signalOnDialingFailed,
			onDialAnswered			: signalOnDialAnswered,
			onDialRejected			: signalOnDialRejected,
			onDialEnded				: signalOnDialEnded,
			onMessageReceive		: signalOnMessageReceive
		}
	);
}

navigator.mediaDevices.getUserMedia({
	audio: true,
	video: true
})
	.then(function(stream) {
		if (mLocalVideo === null)
			return;
		
		// show local video
		mLocalVideo.src = window.URL.createObjectURL(stream);
		mLocalVideoStream = stream;
	})
	.catch(function(e) {
		alert('getUserMedia() error: ' + e.name);
	});

function stopVideoCall(to_user_key) {
	// -- send dial end message --
	socketManagementDialEnd(mSocket, to_user_key);
	
	// -- close peer connection --
	peerConnectionDestroy(mPeerConnection);
	mPeerConnection = null;
	
	// -- close local video stream --
	// if (mLocalVideoStream !== null)
		// mLocalVideoStream.getTracks()[0].stop();
	// mLocalVideoStream = null;
}

function stopSession() {
	// -- unregister and close the socket --
	socketManagementUnregister(mSocket);
	mSocket = null;
}

startSession();

// -----------------------
// -- signaling handler --
// -----------------------

function signalOnRegistered(user_my) {
	showModalUsers();
	socketManagementGetUserOthers(mSocket);
}

function signalOnUserOtherRegistered(user_other) {
	addUsersRegister([user_other]);
}

function signalOnUserOtherUnregistered(user_other) {
	removeUsersRegister([user_other]);
}

function signalOnGetUserOthers(user_others) {
	addUsersRegister(user_others);
}

function signalOnUserOtherOffCall(user_other) {
	addUsersRegister([user_other]);
}

function signalOnUserOtherOnCall(user_other) {
	addUsersRegister([user_other]);
}

function signalOnRequestDial(user_from) {
	mToUserKey = user_from.key;
	showModalCalling(user_from);
	closeModalUsers();
}

function signalOnDialingFailed(data) {
	var user_to	= data.to,
		message	= data.message;
	mToUserKey = null;
}

function signalOnDialAnswered(user_from) {
	closeModalUsers();
	
	if (mPeerConnection === null)
	{
		// create pear connection
		mPeerConnection = peerConnectionCreate(
			mRemoteVideo,
			function(data) {
				socketManagementSendMessage(mSocket, user_from.key, data);
			}
		);
		
		// local stream to send for target
		peerConnectionAddStream(mPeerConnection, mLocalVideoStream);
	}
}

function signalOnDialRejected(user_from) {
	mToUserKey = null;
}

function signalOnDialEnded(user_from) {
	// -- close peer connection --
	peerConnectionDestroy(mPeerConnection);
	mPeerConnection = null;
	
	// -- close local video stream --
	// if (mLocalVideoStream !== null)
		// mLocalVideoStream.getTracks()[0].stop();
	// mLocalVideoStream = null;
	
	showModalUsers();
}

function signalOnMessageReceive(data) {
	if (data.message)
	{
		if (data.message.type)
			peerConnectionOnReceiveData(mSocket, data.from.key, data.message);
		else
			addChatMessage(data.from, data.message);
	}
}


// ---------------
// -- signaling --
// ---------------

function socketManagementRegister(user, setting) {
	var socketio = io('https://174.138.24.216:8080');
	var socket = socketio.connect();
	
	socket.emit('register', user);
	
	socket.on('user_registered', function(data) {
		console.log('user_registered', data);
		
		if (setting.onRegistered)
			setting.onRegistered(data);
	});
	
	socket.on('user_other_registered', function(data) {
		console.log('user_other_registered', data);
		
		if (setting.onUserOtherRegistered)
			setting.onUserOtherRegistered(data);
	});

	socket.on('user_other_unregistered', function(data) {
		console.log('user_other_unregistered', data);
		
		if (setting.onUserOtherUnregistered)
			setting.onUserOtherUnregistered(data);
	});

	socket.on('get_user_others', function(data) {
		console.log('get_user_others', data);
		
		if (setting.onGetUserOthers)
			setting.onGetUserOthers(data);
	});
	
	socket.on('user_other_offcall', function(data) {
		console.log('user_other_offcall', data);
		
		if (setting.onUserOtherOffCall)
			setting.onUserOtherOffCall(data);
	});
	
	socket.on('user_other_oncall', function(data) {
		console.log('user_other_oncall', data);
		
		if (setting.onUserOtherOnCall)
			setting.onUserOtherOnCall(data);
	});
	
	socket.on('dial_dialing', function(data) {
		console.log('dial_dialing', data);
		
		if (setting.onRequestDial)
			setting.onRequestDial(data);
	});
	
	socket.on('dial_dialing_failed', function(data) {
		console.log('dial_dialing_failed', data);
		
		if (setting.onDialingFailed)
			setting.onDialingFailed(data);
	});
	
	socket.on('dial_answer', function(data) {
		console.log('dial_answer', data);
		
		if (setting.onDialAnswered)
			setting.onDialAnswered(data);
	});
	
	socket.on('dial_reject', function(data) {
		console.log('dial_reject', data);
		
		if (setting.onDialRejected)
			setting.onDialRejected(data);
	});
	
	socket.on('dial_end', function(data) {
		console.log('dial_end', data);
		
		if (setting.onDialEnded)
			setting.onDialEnded(data);
	});

	socket.on('message_receive', function(data) {
		console.log('message_receive', data);
		
		if (setting.onMessageReceive)
			setting.onMessageReceive(data);
	});

	socket.on('log', function(data) {
		console.log(data);
	});

	return socket;
}

function socketManagementUnregister(socket) {
	if (socket === null)
		return;
	
	socket.emit('unregister');
	socket.disconnect();
}

function socketManagementGetUserOthers(socket) {
	if (socket === null)
		return;
	
	socket.emit('get_user_others');
}

function socketManagementDialRequest(socket, to_user_key) {
	if (socket === null || to_user_key === null)
		return;
	
	socket.emit('dial', {
		type	: 'dialing',
		to		: to_user_key
	});
}

function socketManagementDialAnswer(socket, to_user_key) {
	if (socket === null || to_user_key === null)
		return;
	
	socket.emit('dial', {
		type	: 'answer',
		to		: to_user_key
	});
}

function socketManagementDialReject(socket, to_user_key) {
	if (socket === null || to_user_key === null)
		return;
	
	socket.emit('dial', {
		type	: 'reject',
		to		: to_user_key
	});
}

function socketManagementDialEnd(socket, to_user_key) {
	if (socket === null || to_user_key === null)
		return;
	
	socket.emit('dial', {
		type	: 'end',
		to		: to_user_key
	});
}

function socketManagementSendMessage(socket, to_user_key, message) {
	if (socket === null || to_user_key === null)
		return;
	
	console.log('socketManagementSendMessage', to_user_key, message);
	
	socket.emit('message_send', {
		to		: to_user_key,
		message	: message
	});
}


// -----------------------
// -- RTC Communication --
// -----------------------

function peerConnectionCreate(remoteVideo, onSendSignalData) {
	var peerConnectionProfile = null;
	
	try
	{
		var peerConnection = new RTCPeerConnection({
			'iceServers': [
				{
					'url': 'stun:174.138.24.216:3478'
				},
				{
					'url'		: 'turn:174.138.24.216:3478',
					'username'	: 'firman',
					'credential'	: '1122334455'
				}
			]
		});
		
		peerConnection.onicecandidate = function(event) {
			console.log('icecandidate event: ', event);
			if (event.candidate)
			{
				if (onSendSignalData)
				{
					onSendSignalData({
						type		: 'candidate',
						id			: event.candidate.sdpMid,
						label		: event.candidate.sdpMLineIndex,
						candidate	: event.candidate.candidate
					});
				}
			}
			else
			{
				console.log('End of candidates.');
			}
		};
		
		peerConnection.onaddstream = function(event) {
			console.log('Remote stream added.');
			
			if (remoteVideo === null)
				return;
			
			remoteVideo.src = window.URL.createObjectURL(event.stream);
		};
		
		peerConnection.onremovestream = function(event) {
			console.log('Remote stream removed. Event: ', event);
		};
		
		console.log('Created RTCPeerConnnection');
		peerConnectionProfile = {
			peerConnection		: peerConnection,
			onSendSignalData	: onSendSignalData
		};
	}
	catch (e)
	{
		console.log('Failed to create PeerConnection, exception: ' + e.message);
		peerConnectionProfile = null
	}
	
	return peerConnectionProfile;
}

function peerConnectionAddStream(peerConnection, stream) {
	if (peerConnection === null)
		return;
	
	if (peerConnection.peerConnection === null)
		return;
	
	if (stream === null)
		return;
	
	peerConnection.peerConnection.addStream(stream);
}

function peerConnectionDoCall(peerConnection) {
	if (peerConnection === null)
		return;
	
	if (peerConnection.peerConnection === null)
		return;
	
	console.log('Sending call to peer.');
	peerConnection.peerConnection.createOffer(
		function (sessionDescription) {
			peerConnection.peerConnection.setLocalDescription(sessionDescription);
			
			if (peerConnection.onSendSignalData)
				peerConnection.onSendSignalData(sessionDescription);
		}, 
		function (event) {
			console.log('createOffer() error: ', event);
		}
	);
}

function peerConnectionDoAnswer(peerConnection) {
	if (peerConnection === null)
		return;
	
	if (peerConnection.peerConnection === null)
		return;
	
	console.log('Sending answer to peer.');
	peerConnection.peerConnection.createAnswer().then(
		function (sessionDescription) {
			peerConnection.peerConnection.setLocalDescription(sessionDescription);
			
			if (peerConnection.onSendSignalData)
				peerConnection.onSendSignalData(sessionDescription);
		},
		function (error) {
			console.log('createAnswer() error: ', error);
		}
	);
}

function peerConnectionOnReceiveData(socket, to_user_key, data) {
	if (!data.type)
		return;
	
	if (data.type === 'offer')
	{
		if (mPeerConnection === null)
		{
			// create pear connection
			mPeerConnection = peerConnectionCreate(
				mRemoteVideo,
				function(data) {
					socketManagementSendMessage(socket, to_user_key, data);
				}
			);
			
			// local stream to send for target
			peerConnectionAddStream(mPeerConnection, mLocalVideoStream);
		}
		
		// set remote description
		mPeerConnection.peerConnection.setRemoteDescription(new RTCSessionDescription(data));
		
		// send answer from call peer connection
		peerConnectionDoAnswer(mPeerConnection);
	}
	else if (data.type === 'answer')
	{
		if (mPeerConnection !== null)
		{
			// set remote description
			mPeerConnection.peerConnection.setRemoteDescription(new RTCSessionDescription(data));
		}
	}
	else if (data.type === 'candidate')
	{
		if (mPeerConnection !== null)
		{
			// add ICE candidate
			mPeerConnection.peerConnection.addIceCandidate(
				new RTCIceCandidate({
					sdpMLineIndex	: data.label,
					candidate		: data.candidate
				})
			);
		}
	}
}

function peerConnectionDestroy(peerConnection) {
	if (peerConnection === null)
		return;
	
	peerConnection.onSendSignalData = null;
	if (peerConnection.peerConnection !== null)
		peerConnection.peerConnection.close();
	peerConnection.peerConnection = null;
}
