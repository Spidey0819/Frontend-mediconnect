import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import apiConfig from '../config/api';

const VideoCall = ({ appointmentId, onCallEnd }) => {
    const [peer, setPeer] = useState(null);
    const [myPeerId, setMyPeerId] = useState('');
    const [call, setCall] = useState(null);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [sessionId, setSessionId] = useState(null);
    const [roomId, setRoomId] = useState('');
    const [error, setError] = useState('');
    const [connectedPeers, setConnectedPeers] = useState([]);
    const [peerDiscoveryLog, setPeerDiscoveryLog] = useState([]);

    // Video refs
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();
    const localStreamRef = useRef();
    const userRole = localStorage.getItem('role');
    const userName = localStorage.getItem('name');

    // Add log entry
    const addLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        setPeerDiscoveryLog(prev => [...prev.slice(-4), `${timestamp}: ${message}`]);
        console.log(`[VideoCall] ${message}`);
    };

    // Initialize PeerJS and video session
    useEffect(() => {
        const initializeVideoCall = async () => {
            try {
                setIsConnecting(true);
                setError('');
                addLog('Initializing video call...');

                // Create or join video session
                const token = localStorage.getItem('token');
                const response = await fetch(`${apiConfig.apiUrl}/api/video/session/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ appointment_id: appointmentId })
                });

                if (!response.ok) {
                    throw new Error('Failed to create video session');
                }

                const sessionData = await response.json();
                setSessionId(sessionData.session_id);
                setRoomId(sessionData.room_id);
                addLog(`Created session: ${sessionData.room_id}`);

                // Initialize PeerJS
                const peerId = `${sessionData.room_id}_${userRole}_${Date.now()}`;
                const newPeer = new Peer(peerId, {
                    host: apiConfig.peerjsHost,
                    port: parseInt(apiConfig.peerjsPort),
                    path: '/peerjs',
                    secure: false,
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' }
                        ]
                    },
                    debug: 2
                });

                newPeer.on('open', (id) => {
                    console.log('My peer ID is: ' + id);
                    setMyPeerId(id);
                    setConnectionStatus('connected');
                    addLog(`Connected with peer ID: ${id.substring(0, 20)}...`);
                    initializeMedia();

                    // Store peer ID in backend
                    storePeerIdInBackend(sessionData.session_id, id);
                });

                newPeer.on('call', (incomingCall) => {
                    console.log('Receiving call...');
                    addLog('Incoming call received!');
                    if (localStreamRef.current) {
                        incomingCall.answer(localStreamRef.current);
                        setCall(incomingCall);

                        incomingCall.on('stream', (remoteStream) => {
                            console.log('Received remote stream');
                            addLog('Remote video stream connected!');
                            if (remoteVideoRef.current) {
                                remoteVideoRef.current.srcObject = remoteStream;
                            }
                            setIsCallActive(true);
                        });

                        incomingCall.on('close', () => {
                            console.log('Call ended by remote peer');
                            addLog('Remote participant left the call');
                            endCall();
                        });
                    }
                });

                newPeer.on('disconnected', () => {
                    console.log('Peer disconnected');
                    addLog('Peer connection lost');
                    setConnectionStatus('disconnected');
                });

                newPeer.on('error', (err) => {
                    console.error('PeerJS error:', err);
                    addLog(`Connection error: ${err.message}`);
                    setError(`Connection error: ${err.message}`);
                    setConnectionStatus('error');
                });

                setPeer(newPeer);

                // Join the session and start peer discovery
                await joinSession(sessionData.session_id);

            } catch (error) {
                console.error('Error initializing video call:', error);
                addLog(`Initialization failed: ${error.message}`);
                setError(`Failed to initialize video call: ${error.message}`);
                setIsConnecting(false);
            }
        };

        if (appointmentId) {
            initializeVideoCall();
        }

        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (peer) {
                peer.destroy();
            }
        };
    }, [appointmentId]);

    const initializeMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            setIsConnecting(false);
            addLog('Camera and microphone initialized');
            console.log('Local media initialized');
        } catch (error) {
            console.error('Error accessing media devices:', error);
            addLog('Failed to access camera/microphone');
            setError('Failed to access camera/microphone');
            setIsConnecting(false);
        }
    };

    const storePeerIdInBackend = async (sessionId, peerId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiConfig.apiUrl}/api/video/session/${sessionId}/peer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    peer_id: peerId,
                    user_role: userRole,
                    user_name: userName
                })
            });

            if (response.ok) {
                addLog('Registered with session successfully');
            } else {
                addLog('Failed to register with session');
            }

            // Start discovering other peers
            setTimeout(() => discoverPeers(sessionId), 2000);
        } catch (error) {
            console.error('Error storing peer ID:', error);
            addLog('Error registering with session');
        }
    };

    const joinSession = async (sessionId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiConfig.apiUrl}/api/video/session/${sessionId}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                addLog('Joined video session successfully');
                console.log('Successfully joined video session');
            }
        } catch (error) {
            console.error('Error joining session:', error);
            addLog('Failed to join session');
        }
    };

    const discoverPeers = async (sessionId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiConfig.apiUrl}/api/video/session/${sessionId}/peers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const otherPeers = data.peers.filter(p =>
                    p.peer_id !== myPeerId && p.user_role !== userRole
                );

                setConnectedPeers(data.peers);
                addLog(`Found ${data.peers.length} total peers, ${otherPeers.length} other participants`);

                if (otherPeers.length > 0) {
                    const targetPeer = otherPeers[0];
                    addLog(`Attempting to connect to: ${targetPeer.user_name} (${targetPeer.user_role})`);
                    console.log('Found peer to connect to:', targetPeer);

                    // If we're a patient, initiate the call
                    if (userRole === 'patient') {
                        makeCall(targetPeer.peer_id);
                    }
                } else {
                    addLog('No other participants found, retrying in 3 seconds...');
                    // Retry discovery
                    setTimeout(() => discoverPeers(sessionId), 3000);
                }
            }
        } catch (error) {
            console.error('Error discovering peers:', error);
            addLog('Peer discovery failed');
            setError('Failed to discover other participants. Please ensure both parties have joined the session.');
        }
    };

    const makeCall = (targetPeerId) => {
        if (peer && localStreamRef.current && targetPeerId) {
            addLog(`Initiating call to peer: ${targetPeerId.substring(0, 20)}...`);
            console.log(`Calling ${targetPeerId}...`);
            const outgoingCall = peer.call(targetPeerId, localStreamRef.current);

            outgoingCall.on('stream', (remoteStream) => {
                console.log('Received stream from callee');
                addLog('Call connected! Remote video should appear now.');
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setIsCallActive(true);
            });

            outgoingCall.on('close', () => {
                console.log('Call ended');
                addLog('Call ended by remote participant');
                endCall();
            });

            setCall(outgoingCall);
        }
    };

    const endCall = async () => {
        try {
            if (call) {
                call.close();
                setCall(null);
            }

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }

            if (peer) {
                peer.destroy();
            }

            setIsCallActive(false);
            setConnectionStatus('disconnected');
            addLog('Call ended');

            // End session on backend
            if (sessionId) {
                const token = localStorage.getItem('token');
                await fetch(`${apiConfig.apiUrl}${apiConfig.apiUrl}/api/video/session/${sessionId}/end`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
            }

            if (onCallEnd) {
                onCallEnd();
            }
        } catch (error) {
            console.error('Error ending call:', error);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
                addLog(videoTrack.enabled ? 'Camera turned on' : 'Camera turned off');
            }
        }
    };

    const toggleAudio = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
                addLog(audioTrack.enabled ? 'Microphone unmuted' : 'Microphone muted');
            }
        }
    };

    // Force refresh peer discovery
    const refreshPeerDiscovery = () => {
        if (sessionId) {
            addLog('Manually refreshing peer discovery...');
            discoverPeers(sessionId);
        }
    };

    return (
        <div className="video-call-container" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#1a1a1a',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div className="video-call-header" style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '1rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h5 className="mb-0">Medical Consultation</h5>
                    <small className="opacity-75">
                        {connectionStatus === 'connected' ? 'Connected' :
                            connectionStatus === 'connecting' ? 'Connecting...' :
                                connectionStatus === 'error' ? 'Connection Error' : 'Disconnected'}
                        {connectedPeers.length > 0 && ` • ${connectedPeers.length} participant(s)`}
                    </small>
                </div>
                <div className="d-flex align-items-center gap-3">
                    <span className="badge bg-white text-dark px-3 py-2">
                        Room: {roomId || 'Loading...'}
                    </span>
                    <button
                        className="btn btn-sm btn-outline-light"
                        onClick={refreshPeerDiscovery}
                        title="Refresh peer discovery"
                    >
                        <i className="fas fa-sync"></i>
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={endCall}
                        style={{ borderRadius: '20px' }}
                    >
                        <i className="fas fa-phone-slash me-2"></i>
                        End Call
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="alert alert-danger m-3" role="alert">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    {error}
                </div>
            )}

            {/* Video Area */}
            <div className="video-area flex-grow-1 position-relative p-3">
                {/* Remote Video (Main) */}
                <div className="remote-video-container" style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '15px',
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {isCallActive ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    ) : (
                        <div className="text-center text-white">
                            {isConnecting ? (
                                <>
                                    <div className="spinner-border mb-3" role="status"></div>
                                    <p>Connecting to video call...</p>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-user-circle fa-5x mb-3 opacity-50"></i>
                                    <p>Waiting for other participant to join...</p>
                                    <small className="text-muted">
                                        {userRole === 'patient'
                                            ? 'Waiting for doctor to join the session...'
                                            : 'Waiting for patient to join the session...'}
                                    </small>
                                    {connectedPeers.length === 1 && (
                                        <div className="mt-3">
                                            <span className="badge bg-warning">
                                                Only you are in the session
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Local Video (Picture-in-Picture) */}
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        right: '20px',
                        width: '200px',
                        height: '150px',
                        backgroundColor: '#3a3a3a',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '2px solid #fff'
                    }}>
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transform: 'scaleX(-1)'
                            }}
                        />
                        {!isVideoEnabled && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                backgroundColor: '#1a1a1a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white'
                            }}>
                                <i className="fas fa-video-slash fa-2x"></i>
                            </div>
                        )}
                        <div style={{
                            position: 'absolute',
                            bottom: '5px',
                            left: '5px',
                            color: 'white',
                            fontSize: '0.8rem',
                            background: 'rgba(0,0,0,0.5)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                        }}>
                            You ({userRole})
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="video-controls" style={{
                padding: '2rem',
                background: 'rgba(0,0,0,0.8)',
                display: 'flex',
                justifyContent: 'center',
                gap: '1rem'
            }}>
                <button
                    className={`btn ${isVideoEnabled ? 'btn-secondary' : 'btn-danger'} rounded-circle`}
                    onClick={toggleVideo}
                    style={{ width: '60px', height: '60px' }}
                    title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                    <i className={`fas ${isVideoEnabled ? 'fa-video' : 'fa-video-slash'} fa-lg`}></i>
                </button>

                <button
                    className={`btn ${isAudioEnabled ? 'btn-secondary' : 'btn-danger'} rounded-circle`}
                    onClick={toggleAudio}
                    style={{ width: '60px', height: '60px' }}
                    title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                    <i className={`fas ${isAudioEnabled ? 'fa-microphone' : 'fa-microphone-slash'} fa-lg`}></i>
                </button>

                <button
                    className="btn btn-info rounded-circle"
                    style={{ width: '60px', height: '60px' }}
                    title="Chat"
                >
                    <i className="fas fa-comment fa-lg"></i>
                </button>

                <button
                    className="btn btn-warning rounded-circle"
                    style={{ width: '60px', height: '60px' }}
                    title="Screen share"
                >
                    <i className="fas fa-desktop fa-lg"></i>
                </button>

                <button
                    className="btn btn-success rounded-circle"
                    style={{ width: '60px', height: '60px' }}
                    title="Settings"
                >
                    <i className="fas fa-cog fa-lg"></i>
                </button>
            </div>

            {/* Enhanced Debug Info */}
            <div style={{
                position: 'absolute',
                top: '100px',
                left: '20px',
                background: 'rgba(0,0,0,0.9)',
                color: 'white',
                padding: '15px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                maxWidth: '350px',
                maxHeight: '300px',
                overflow: 'auto'
            }}>
                <div><strong>Status:</strong> {connectionStatus}</div>
                <div><strong>My ID:</strong> {myPeerId ? myPeerId.substring(0, 25) + '...' : 'Generating...'}</div>
                <div><strong>Room:</strong> {roomId}</div>
                <div><strong>Participants:</strong> {connectedPeers.length}</div>
                {isCallActive && <div className="text-success"><strong>📹 Call Active</strong></div>}

                <hr style={{ margin: '10px 0', borderColor: '#444' }} />
                <div><strong>Peer Discovery Log:</strong></div>
                {peerDiscoveryLog.map((log, index) => (
                    <div key={index} style={{ fontSize: '0.7rem', marginBottom: '2px' }}>
                        {log}
                    </div>
                ))}

                {connectedPeers.length > 0 && (
                    <>
                        <hr style={{ margin: '10px 0', borderColor: '#444' }} />
                        <div><strong>Connected Peers:</strong></div>
                        {connectedPeers.map((peer, index) => (
                            <div key={index} style={{ fontSize: '0.7rem' }}>
                                • {peer.user_name} ({peer.user_role})
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};

export default VideoCall;