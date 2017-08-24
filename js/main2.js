'use strict';

var textId = document.querySelector('input#id');
var textName = document.querySelector('input#name');
var textPhoto = document.querySelector('input#photo');

var textToId = document.querySelector('input#toId');
var textMessage = document.querySelector('input#message');

var connectAsDocterButton = document.querySelector('button#connectAsDocterButton');
connectAsDocterButton.onclick = function() {
	register('docter');
};

var connectAsPatientButton = document.querySelector('button#connectAsPatientButton');
connectAsPatientButton.onclick = function() {
	register('patient');
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

function register(register_as) {
	var socketio = io('https://192.168.1.100:8080');
	socket = socketio.connect();
	
	socket.emit('register_' + register_as, {
		id : textId.value,
		name : textName.value,
		photo : textPhoto.value
	});
	
	socket.on('registered_docter', function(data) {
		console.log('registered_docter', data);
	});

	socket.on('registered_patient', function(data) {
		console.log('registered_patient', data);
	});
	
	socket.on('new_registered_docter', function(data) {
		console.log('new_registered_docter', data);
	});

	socket.on('new_registered_patient', function(data) {
		console.log('new_registered_patient', data);
	});

	socket.on('delete_registered_docter', function(data) {
		console.log('delete registered docter', data);
	});

	socket.on('delete_registered_patient', function(data) {
		console.log('delete registered patient', data);
	});

	socket.on('registered_docters', function(data) {
		console.log('registered_docters', data);
	});

	socket.on('registered_patients', function(data) {
		console.log('registered_patients', data);
	});

	socket.on('message_receive', function(data) {
		console.log(data);
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
}

function sendMessage(to, message) {
	if (socket === null)
		return;
	
	socket.emit('message_send', {
		to		: to,
		message	: message
	});
}

window.onbeforeunload = function() {
	unregister();
};