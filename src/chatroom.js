const myHostname = window.location.hostname;
console.log("Hostname: " + myHostname);

let connection = null;
let clientID = 0;

const mediaConstraints = {
  audio: true,
  video: true
};

let myUsername = null;
let targetUsername = null;
let myPeerConnection = null;

let hasAddTrack = false;

const log = text => {
  const time = new Date();
  console.log("[" + time.toLocaleTimeString() + "] " + text);
};

const log_error = text => {
  const time = new Date();
  console.error("[" + time.toLocaleTimeString() + "] " + text);
};

const sendToServer = msg => {
  const msgJSON = JSON.stringify(msg);
  log("Sending '" + msg.type + "' message: " + msgJSON);
  connection.send(msgJSON);
};

const setUsername = () => {
  myUsername = document.getElementById("name").value;
  sendToServer({
    name: myUsername,
    date: Date.now(),
    id: clientID,
    type: "username"
  });
};

function connect() {
  let serverUrl;

  serverUrl = "wss://" + myHostname + ":5000";
  connection = new WebSocket(serverUrl, "json");
  connection.onopen = function(evt) {
    document.getElementById("text").disabled = false;
    document.getElementById("send").disabled = false;
  };
  connection.onerror = function(evt) {
    console.dir(evt);
  };
  connection.onmessage = function(evt) {
    const chatFrameDocument = document.getElementById("chatbox").contentDocument;
    let text = "";
    let msg = JSON.parse(evt.data);
    let time = new Date(msg.date);
    let timeStr = time.toLocaleTimeString();

    switch(msg.type) {
      case "id":
        clientID = msg.id;
        setUsername();
        break;

      case "username":
        text = "<b>User <em>" + msg.name + "</em> signed in at " + timeStr + "</b><br>";
        break;

      case "message":
        text = "(" + timeStr + ") <b>" + msg.name + "</b>: " + msg.text + "<br>";
        break;

      case "rejectusername":
        myUsername = msg.name;
        text = "<b>Your username has been set to <em>" + myUsername +
          "</em> because the name you chose is in use.</b><br>";
        break;

      case "userlist":
        handleUserlistMsg(msg);
        break;

      case "video-offer":
        handleVideoOfferMsg(msg);
        break;

      case "video-answer":
        handleVideoAnswerMsg(msg);
        break;

      case "new-ice-candidate":
        handleNewICECandidateMsg(msg);
        break;

      case "hang-up":
        handleHangUpMsg(msg);
        break;

      default:
        log_error("Unknown message received:");
        log_error(msg);
    }

    if (text.length) {
      chatFrameDocument.write(text);
      document.getElementById("chatbox").contentWindow.scrollByPages(1);
    }
  };
}

function handleSendButton() {
  const msg = {
    text: document.getElementById("text").value,
    type: "message",
    id: clientID,
    date: Date.now()
  };
  sendToServer(msg);
  document.getElementById("text").value = "";
}

function handleKey(evt) {
  if (evt.keyCode === 13 || evt.keyCode === 14) {
    if (!document.getElementById("send").disabled) {
      handleSendButton();
    }
  }
}

function createPeerConnection() {
  log("Setting up a connection...");
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302'
        },
        {
            urls:'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com'
        }
    ]});

        // [
        // {url:'stun:stun.1.google.com:19302'},
        // {url:'turn:numb.viagenie.ca',credential: 'muazkh', username: 'webrtc@live.com'}]});
    // myPeerConnection = new RTCPeerConnection();
  hasAddTrack = (myPeerConnection.addTrack !== undefined);

  myPeerConnection.onicecandidate = handleICECandidateEvent;
  myPeerConnection.onremovestream = handleRemoveStreamEvent;
  myPeerConnection.oniceconnectionstatechange = handleICEConnectionStateChangeEvent;
  myPeerConnection.onicegatheringstatechange = handleICEGatheringStateChangeEvent;
  myPeerConnection.onsignalingstatechange = handleSignalingStateChangeEvent;
  myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;

  if (hasAddTrack) {
    myPeerConnection.ontrack = handleTrackEvent;
  } else {
    myPeerConnection.onaddstream = handleAddStreamEvent;
  }
}

function handleNegotiationNeededEvent() {
  log("*** Negotiation needed");

  log("---> Creating offer");
  myPeerConnection.createOffer().then(function(offer) {
    log("---> Creating new description object to send to remote peer");
    return myPeerConnection.setLocalDescription(offer);
  })
  .then(function() {
    log("---> Sending offer to remote peer");
    sendToServer({
      name: myUsername,
      target: targetUsername,
      type: "video-offer",
      sdp: myPeerConnection.localDescription
    });
  })
  .catch(reportError);
}

function handleTrackEvent(event) {
  log("*** Track event");
  document.getElementById("received_video").srcObject = event.streams[0];
  document.getElementById("hangup-button").disabled = false;
}

function handleAddStreamEvent(event) {
  log("*** Stream added");
  document.getElementById("received_video").srcObject = event.stream;
  document.getElementById("hangup-button").disabled = false;
}

function handleRemoveStreamEvent(event) {
  log("*** Stream removed");
  closeVideoCall();
}

function handleICECandidateEvent(event) {
  if (event.candidate) {
    log("Outgoing ICE candidate: " + event.candidate.candidate);

    sendToServer({
      type: "new-ice-candidate",
      target: targetUsername,
      candidate: event.candidate
    });
  }
}

function handleICEConnectionStateChangeEvent(event) {
  log("*** ICE connection state changed to " + myPeerConnection.iceConnectionState);

  switch(myPeerConnection.iceConnectionState) {
    case "closed":
    case "failed":
    case "disconnected":
      closeVideoCall();
      break;
  }
}

function handleSignalingStateChangeEvent(event) {
  log("*** WebRTC signaling state changed to: " + myPeerConnection.signalingState);
  switch(myPeerConnection.signalingState) {
    case "closed":
      closeVideoCall();
      break;
  }
}

function handleICEGatheringStateChangeEvent(event) {
  log("*** ICE gathering state changed to: " + myPeerConnection.iceGatheringState);
}

function handleUserlistMsg(msg) {
  const listElem = document.getElementById("userlistbox");
  while (listElem.firstChild) {
    listElem.removeChild(listElem.firstChild);
  }
  for (const user of msg.users) {
    const item = document.createElement("li");
    item.appendChild(document.createTextNode(user));
    item.addEventListener("click", invite, false);
    listElem.appendChild(item);
  }
}

function closeVideoCall() {
  const remoteVideo = document.getElementById("received_video");
  const localVideo = document.getElementById("local_video");

  log("Closing the call");

  if (myPeerConnection) {
    log("--> Closing the peer connection");

    myPeerConnection.onaddstream = null;
    myPeerConnection.ontrack = null;
    myPeerConnection.onremovestream = null;
    myPeerConnection.onnicecandidate = null;
    myPeerConnection.oniceconnectionstatechange = null;
    myPeerConnection.onsignalingstatechange = null;
    myPeerConnection.onicegatheringstatechange = null;
    myPeerConnection.onnotificationneeded = null;

    if (remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    }

    if (localVideo.srcObject) {
      localVideo.srcObject.getTracks().forEach(track => track.stop());
    }

    myPeerConnection.close();
    myPeerConnection = null;
  }

  remoteVideo.removeAttribute("src");
  remoteVideo.removeAttribute("srcObject");
  localVideo.removeAttribute("src");
  remoteVideo.removeAttribute("srcObject");

  document.getElementById("hangup-button").disabled = true;
  targetUsername = null;
}

function handleHangUpMsg(msg) {
  log("*** Received hang up notification from other peer");

  closeVideoCall();
}

function hangUpCall() {
  closeVideoCall();
  sendToServer({
    name: myUsername,
    target: targetUsername,
    type: "hang-up"
  });
}

function invite(evt) {
  log("Starting to prepare an invitation");
  if (myPeerConnection) {
    alert("You can't start a call because you already have one open!");
  } else {
    const clickedUsername = evt.target.textContent;
    if (clickedUsername === myUsername) {
      alert("You cannot talk to yourself.");
      return;
    }

    targetUsername = clickedUsername;
    log("Inviting user " + targetUsername);

    log("Setting up connection to invite user: " + targetUsername);
    createPeerConnection();

    log("Requesting webcam access...");

    navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(function(localStream) {
      log("-- Local video stream obtained");
      document.getElementById("local_video").srcObject = localStream;

      if (hasAddTrack) {
        log("-- Adding tracks to the RTCPeerConnection");
        localStream.getTracks().forEach(track => myPeerConnection.addTrack(track, localStream));
      } else {
        log("-- Adding stream to the RTCPeerConnection");
        myPeerConnection.addStream(localStream);
      }
    })
    .catch(handleGetUserMediaError);
  }
}

function handleVideoOfferMsg(msg) {
  let localStream = null;
  targetUsername = msg.name;

  log("Starting to accept invitation from " + targetUsername);
  createPeerConnection();

  const desc = new RTCSessionDescription(msg.sdp);

  myPeerConnection.
  setRemoteDescription(desc).
  then(() => {
    log("Setting up the local media stream...");
    return navigator.mediaDevices.getUserMedia(mediaConstraints);
  })
  .then(stream => {
    log("-- Local video stream obtained");
    localStream = stream;
    document.getElementById("local_video").srcObject = localStream;

    if (hasAddTrack) {
      log("-- Adding tracks to the RTCPeerConnection");
      localStream.getTracks().forEach(track =>
            myPeerConnection.addTrack(track, localStream)
      );
    } else {
      log("-- Adding stream to the RTCPeerConnection");
      myPeerConnection.addStream(localStream);
    }
  })
  .then(() => {
    log("------> Creating answer");
    return myPeerConnection.createAnswer();
  })
  .then(answer => {
    log("------> Setting local description after creating answer");
    return myPeerConnection.setLocalDescription(answer);
  })
  .then(() => {
    const msg = {
      name: myUsername,
      target: targetUsername,
      type: "video-answer",
      sdp: myPeerConnection.localDescription
    };
    log("Sending answer packet back to other peer");  `Z1`
    sendToServer(msg);
  })
  .catch(handleGetUserMediaError);
}

function handleVideoAnswerMsg(msg) {
  log("Call recipient has accepted our call");
  const desc = new RTCSessionDescription(msg.sdp);
  myPeerConnection.setRemoteDescription(desc).catch(reportError);
}

function handleNewICECandidateMsg(msg) {
  const candidate = new RTCIceCandidate(msg.candidate);

  log("Adding received ICE candidate: " + JSON.stringify(candidate));
  myPeerConnection.addIceCandidate(candidate)
    .catch(reportError);
}

function handleGetUserMediaError(e) {
  log(e);
  switch(e.name) {
    case "NotFoundError":
      alert("Unable to open your call because no camera and/or microphone" +
            "were found.");
      break;
    case "SecurityError":
    case "PermissionDeniedError":
      break;
    default:
      alert("Error opening your camera and/or microphone: " + e.message);
      break;
  }

  closeVideoCall();
}

function reportError(errMessage) {
  log_error("Error " + errMessage.name + ": " + errMessage.message);
}