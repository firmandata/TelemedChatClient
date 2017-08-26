'use strict';

var textId = document.querySelector('input#id');
var textName = document.querySelector('input#name');
var textPhoto = document.querySelector('input#photo');

var textToId = document.querySelector('input#toId');
var textMessage = document.querySelector('input#message');

var connectAsDocterButton = document.querySelector('button#connectAsDocterButton');
connectAsDocterButton.onclick = function() {
	register(1);
};

var connectAsPatientButton = document.querySelector('button#connectAsPatientButton');
connectAsPatientButton.onclick = function() {
	register(2);
};

var disconnectButton = document.querySelector('button#disconnectButton');
disconnectButton.onclick = function() {
	unregister();
};

var sendMessageButton = document.querySelector('button#sendMessageButton');
sendMessageButton.onclick = function() {
	sendMessage(textToId.value, textMessage.value);
};

var socket = null;

function register(type) {
	var socketio = io('https://192.168.0.8:8080');
	socket = socketio.connect();
	
	socket.emit('register', {
		id : textId.value,
		type : type,
		name : textName.value,
		photo : textPhoto.value
	});
	
	socket.on('registered', function(data) {
		console.log('registered', data);
		onUserRegistered(data);
	});
	
	socket.on('registered_new', function(data) {
		console.log('registered_new', data);
	});

	socket.on('delete_registered', function(data) {
		console.log('delete registered', data);
		onUserClose(data);
	});

	socket.on('registered_all', function(data) {
		console.log('registered_all', data);
	});

	socket.on('message_receive', function(data) {
		console.log(data);
		onUserMessageReceive(data);
	});

	socket.on('log', function(data) {
		console.log(data);
	});
}

function unregister() {
	if (socket === null)
		return;
	
	socket.emit('unregister');
	socket.disconnect();
	socket = null;
	
	onUserUnregistered();
}

function sendMessage(to, message) {
	if (socket === null)
		return;
	
	var data = {
		to		: to,
		message	: message
	};
	
	onUserSendMessage(data);
	socket.emit('message_send', data);
}

window.onbeforeunload = function() {
	unregister();
};

// -- user media (video and audio) --
var mLocalVideo = document.querySelector('#localVideo');
var mLocalVideoStream = null;
var mRemoteVideo = document.querySelector('#remoteVideo');

var mUserMedia = navigator.mediaDevices.getUserMedia({
	audio: true,
	video: true
})
	.then(function(stream) {
		if (mLocalVideo === null)
			return;
		
		mLocalVideo.src = window.URL.createObjectURL(stream);
		mLocalVideoStream = stream;
	})
	.catch(function(e) {
		alert('getUserMedia() error: ' + e.name);
	});


// -- RTC Communication --
function peerConnectionCreate(to) {
	var peerConnectionProfile = null;
	
	try
	{
		var peerConnection = new RTCPeerConnection(null);
		
		peerConnection.onicecandidate = function(event) {
			console.log('icecandidate event: ', event);
			if (event.candidate)
			{
				sendMessage(to, {
					type		: 'candidate',
					id			: event.candidate.sdpMid,
					label		: event.candidate.sdpMLineIndex,
					candidate	: event.candidate.candidate
				});
			}
			else
			{
				console.log('End of candidates.');
			}
		};
		
		peerConnection.onaddstream = function(event) {
			console.log('Remote stream added.');
			
			if (mRemoteVideo === null)
				return;
			
			mRemoteVideo.src = window.URL.createObjectURL(event.stream);
		};
		
		peerConnection.onremovestream = function(event) {
			console.log('Remote stream removed. Event: ', event);
		};
		
		console.log('Created RTCPeerConnnection');
		peerConnectionProfile = {
			to				: to,
			peerConnection	: peerConnection
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
	
	peerConnection.peerConnection.addStream(stream);
}

function peerConnectionDoCall(peerConnection) {
	if (peerConnection === null)
		return;
	
	if (peerConnection.peerConnection === null)
		return;
	
	peerConnection.peerConnection.createOffer(
		function (sessionDescription) {
			peerConnection.peerConnection.setLocalDescription(sessionDescription);
			
			console.log('sending message call to peer sessionDescription', sessionDescription);
			sendMessage(peerConnection.to, sessionDescription);
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
			
			console.log('sending message answer to peer sessionDescription', sessionDescription);
			sendMessage(peerConnection.to, sessionDescription);
		},
		function (error) {
			trace('Failed to create session description: ' + error.toString());
		}
	);
}

function peerConnectionSetRemoteDescription(peerConnection, data) {
	if (peerConnection === null)
		return;
	
	if (peerConnection.peerConnection === null)
		return;
	
	peerConnection.peerConnection.setRemoteDescription(new RTCSessionDescription(data));
}

function peerConnectionAddCandidate(peerConnection, data) {
	if (peerConnection === null)
		return;
	
	if (peerConnection.peerConnection === null)
		return;
	
	var candidate = new RTCIceCandidate({
		sdpMLineIndex: data.label,
		candidate: data.candidate
	});
	peerConnection.peerConnection.addIceCandidate(candidate);
}

function peerConnectionDestroy(peerConnection) {
	if (peerConnection === null)
		return;
	
	peerConnection.to = null;
	if (peerConnection.peerConnection !== null)
		peerConnection.peerConnection.close();
	peerConnection.peerConnection = null;
}


// -- event handler --
var mPeerConnection = null;

function onUserRegistered(data) {
	
}

function onUserSendMessage(data) {
	if (data.message == 'calling')
	{
		if (mLocalVideoStream !== null)
		{
			if (mPeerConnection === null)
			{
				mPeerConnection = peerConnectionCreate(data.to);
				if (mPeerConnection !== null)
					peerConnectionAddStream(mPeerConnection, mLocalVideoStream);
				peerConnectionDoCall(mPeerConnection);
			}
		}
	}
}

function onUserMessageReceive(data) {
	if (data.message)
	{
		if (data.message == 'calling')
		{
			if (mLocalVideoStream !== null)
			{
				if (mPeerConnection === null)
				{
					mPeerConnection = peerConnectionCreate(data.from.key);
					if (mPeerConnection !== null)
						peerConnectionAddStream(mPeerConnection, mLocalVideoStream);
				}
			}
		}
		if (data.message.type)
		{
			if (data.message.type === 'offer')
			{
				peerConnectionSetRemoteDescription(mPeerConnection, data.message);
				peerConnectionDoAnswer(mPeerConnection);
			}
			else if (data.message.type === 'answer')
				peerConnectionSetRemoteDescription(mPeerConnection, data.message);
			else if (data.message.type === 'candidate')
				peerConnectionAddCandidate(mPeerConnection, data.message);
		}
	}
}

function onUserClose(data) {
	if (mPeerConnection !== null)
	{
		if (mPeerConnection.to == data.key)
		{
			peerConnectionDestroy(mPeerConnection);
			mPeerConnection = null;
		}
	}
}

function onUserUnregistered() {
	peerConnectionDestroy(mPeerConnection);
	mPeerConnection = null;
}

