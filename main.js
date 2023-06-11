
import firebase from "firebase/app";
import 'firebase/firestore'
const firebaseConfig = {
  apiKey: process.env.FIREBASE_APIKEY,
  authDomain: process.env.FIREBASE_AUTHDOMAIN,
  projectId: process.env.FIREBASE_PROJECTID,
  storageBucket: process.env.FIREBASE_STORAGEBUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGINGSENDERID,
  appId: process.env.FIREBASE_APPID
};

// Initialize Firebase
if (!firebase.apps?.length) {
  firebase.initializeApp(firebaseConfig);
}

const fireStore = firebase.firestore();



const servers = {
  iceServers: [{
    urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'
    ]
  }]
}


let pc = new RTCPeerConnection(servers)
let localStream = null;
let remoteStream = null;


const webCamButton = document.getElementById('webcamButton');
const webCamVideo = document.getElementById('webcamVideo');
const callButton = document.getElementById('callButton');
const callInput = document.getElementById('callInput');
const answerButton = document.getElementById('answerButton');
const remoteVideo = document.getElementById('remoteVideo');
const hangupButton = document.getElementById('hangupButton');


webCamButton.onclick = async () => {
  console.log("webcambutton on click")
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream = new MediaStream();
  localStream.getTracks().forEach(track => {
    pc.addTrack(track);
  })
  pc.ontrack = (event) => {
    console.log(event)
    remoteStream.addTrack(event.track);
    // event.streams[0].getTracks().forEach(track => {
    //   remoteStream.addTrack(track);
    // })
  }

  webCamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
  callButton.disabled = false;
  answerButton.disabled = false;
  webCamButton.disabled = true;
  console.log("call button enabled")
};



callButton.onclick = async () => {
  const callDoc = fireStore.collection('calls').doc();
  const offerCandidates = callDoc.collection('offerCandidates')
  const answerCandidates = callDoc.collection('answerCandidates')
  callInput.value = callDoc.id;

  pc.onicecandidate = event => {
    event.candidate && offerCandidates.add(event.candidate.toJSON());
  }

  const offerDescription = await pc.createOffer();
  await pc.setLocalDescription(offerDescription);
  const offer = {
    sdp: offerDescription.sdp,
    type: offerDescription.type
  }



  await callDoc.set({ offer })

  callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (!pc.currentRemoteDescription && data?.answer) {
      const anserDescription = new RTCSessionDescription(data.answer)
      pc.setRemoteDescription(anserDescription);
    }
  })

  answerCandidates.onSnapshot(snapshot => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);

      }
    })
  })

}


answerButton.onclick = async () => {
  const callId = callInput.value;
  const callDoc = fireStore.collection('calls').doc(callId);
  const answerCandidates = callDoc.collection('answerCandidates');
  const offerCandidates = callDoc.collection('offerCandidates');

  pc.onicecandidate = event => {
    event.candidate && answerCandidates.add(event.candidate.toJSON());
  }
  const callData = (await callDoc.get()).data();
  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
  const anserDescription = await pc.createAnswer()
  await pc.setLocalDescription(anserDescription)

  const answer = {
    type: anserDescription.type,
    sdp: anserDescription.sdp
  }
  await callDoc.update({ answer });
  offerCandidates.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      console.log(change)
      if (change.type === 'added') {
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    })
  })
}
