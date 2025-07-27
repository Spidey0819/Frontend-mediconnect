import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import apiConfig, { getPeerJSConfig } from '../config/api';

const VideoCall = ({ appointmentId, onCallEnd }) => {
    // State management
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
    const [connectionAttempts, setConnectionAttempts] = useState(0);
    const [callInitiated, setCallInitiated] = useState(false);

    // Refs
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();
    const localStreamRef = useRef();
    const connectionTimeoutRef = useRef();
    const discoveryIntervalRef = useRef();

    // User data
    const userRole = localStorage.getItem('role');
    const userName = localStorage.getItem('name');

    // Enhanced PeerJS configuration with TURN servers
    const getEnhancedPeerConfig = () => {
        const baseConfig = getPeerJSConfig();
        return {
            ...baseConfig,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    {
                        urls: 'turn:openrelay.metered.ca:80',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    {
                        urls: 'turn:openrelay.metered.ca:443',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    }
                ],
                iceTransportPolicy: 'all',
                iceCandidatePoolSize: 10
            }
        };
    };

    // Initialize video call
    useEffect(() => {
        const initializeVideoCall = async () => {
            try {
                setIsConnecting(true);
                setError('');

                // Create video session
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

                // Initialize media
                await initializeMedia();

                // Initialize PeerJS
                await initializePeerJS(sessionData);

            } catch (error) {
                setError(`Failed to initialize video call: ${error.message}`);
                setIsConnecting(false);
            }
        };

        if (appointmentId) {
            initializeVideoCall();
        }

        return cleanup;
    }, [appointmentId]);

    // Initialize media devices
    const initializeMedia = async () => {
        try {
            let stream;
            try {
                // Try high quality first
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30, max: 30 }
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            } catch (error) {
                // Fallback to basic quality
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
            }

            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

        } catch (error) {
            setError('Failed to access camera/microphone. Please check permissions.');
            throw error;
        }
    };

    // Initialize PeerJS
    const initializePeerJS = async (sessionData) => {
        try {
            const peerConfig = getEnhancedPeerConfig();
            const peerId = `${sessionData.room_id}_${userRole}_${Date.now()}`;

            const newPeer = new Peer(peerId, peerConfig);

            // Connection timeout
            connectionTimeoutRef.current = setTimeout(() => {
                if (!myPeerId) {
                    setError('Connection timeout. Please check your internet connection.');
                    setConnectionStatus('error');
                }
            }, 15000);

            newPeer.on('open', (id) => {
                clearTimeout(connectionTimeoutRef.current);
                setMyPeerId(id);
                setConnectionStatus('connected');
                setIsConnecting(false);

                // Store peer ID and start discovery
                storePeerIdInBackend(sessionData.session_id, id);
                joinSession(sessionData.session_id);
            });

            newPeer.on('call', (incomingCall) => {
                handleIncomingCall(incomingCall);
            });

            newPeer.on('disconnected', () => {
                setConnectionStatus('reconnecting');
                setTimeout(() => {
                    if (newPeer && !newPeer.destroyed) {
                        newPeer.reconnect();
                    }
                }, 2000);
            });

            newPeer.on('error', (err) => {
                clearTimeout(connectionTimeoutRef.current);
                if (err.type === 'peer-unavailable') {
                    setConnectionAttempts(prev => prev + 1);
                } else {
                    setError(`Connection error: ${err.message}`);
                    setConnectionStatus('error');
                }
            });

            setPeer(newPeer);

        } catch (error) {
            throw error;
        }
    };

    // Handle incoming call
    const handleIncomingCall = (incomingCall) => {
        if (localStreamRef.current) {
            incomingCall.answer(localStreamRef.current);
            setCall(incomingCall);
            setCallInitiated(true);

            incomingCall.on('stream', (remoteStream) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setIsCallActive(true);
                setConnectionStatus('call-active');

                // Stop peer discovery
                if (discoveryIntervalRef.current) {
                    clearInterval(discoveryIntervalRef.current);
                }
            });

            incomingCall.on('close', () => {
                handleCallEnd();
            });

            incomingCall.on('error', () => {
                handleCallEnd();
            });
        }
    };

    // Store peer ID in backend
    const storePeerIdInBackend = async (sessionId, peerId) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${apiConfig.apiUrl}/api/video/session/${sessionId}/peer`, {
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
        } catch (error) {
            // Handle silently
        }
    };

    // Join session
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
                startPeerDiscovery(sessionId);
            }
        } catch (error) {
            // Handle silently
        }
    };

    // Start peer discovery
    const startPeerDiscovery = (sessionId) => {
        discoverPeers(sessionId);
        discoveryIntervalRef.current = setInterval(() => {
            if (!isCallActive) {
                discoverPeers(sessionId);
            }
        }, 3000);
    };

    // Discover peers
    const discoverPeers = async (sessionId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiConfig.apiUrl}/api/video/session/${sessionId}/peers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const otherPeers = data.peers.filter(p =>
                    p.peer_id !== myPeerId && p.user_role !== userRole
                );

                setConnectedPeers(data.peers);

                if (otherPeers.length > 0 && !callInitiated && !isCallActive) {
                    const targetPeer = otherPeers[0];

                    // Patient initiates call
                    if (userRole === 'patient') {
                        setTimeout(() => {
                            initiateCall(targetPeer.peer_id, targetPeer.user_name);
                        }, 2000);
                    }
                }
            }
        } catch (error) {
            // Handle silently
        }
    };

    // Initiate call
    const initiateCall = async (targetPeerId, targetName) => {
        if (!peer || !localStreamRef.current || callInitiated) {
            return;
        }

        try {
            setCallInitiated(true);
            const outgoingCall = peer.call(targetPeerId, localStreamRef.current);

            if (!outgoingCall) {
                throw new Error('Failed to initiate call');
            }

            setCall(outgoingCall);

            // Call timeout
            const callTimeout = setTimeout(() => {
                if (!isCallActive) {
                    setCallInitiated(false);
                    setConnectionAttempts(prev => prev + 1);
                }
            }, 10000);

            outgoingCall.on('stream', (remoteStream) => {
                clearTimeout(callTimeout);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setIsCallActive(true);
                setConnectionStatus('call-active');

                // Stop peer discovery
                if (discoveryIntervalRef.current) {
                    clearInterval(discoveryIntervalRef.current);
                }
            });

            outgoingCall.on('close', () => {
                clearTimeout(callTimeout);
                handleCallEnd();
            });

            outgoingCall.on('error', (error) => {
                clearTimeout(callTimeout);
                setCallInitiated(false);
                setConnectionAttempts(prev => prev + 1);

                // Retry if not too many attempts
                if (connectionAttempts < 3) {
                    setTimeout(() => {
                        initiateCall(targetPeerId, targetName);
                    }, 3000);
                }
            });

        } catch (error) {
            setCallInitiated(false);
        }
    };

    // Handle call end
    const handleCallEnd = () => {
        setIsCallActive(false);
        setCallInitiated(false);
        setCall(null);
        setConnectionStatus('connected');

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
    };

    // Cleanup function
    const cleanup = () => {
        if (discoveryIntervalRef.current) {
            clearInterval(discoveryIntervalRef.current);
        }
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (peer && !peer.destroyed) {
            peer.destroy();
        }
    };

    // End call
    const endCall = async () => {
        try {
            cleanup();

            if (sessionId) {
                const token = localStorage.getItem('token');
                await fetch(`${apiConfig.apiUrl}/api/video/session/${sessionId}/end`, {
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
            if (onCallEnd) {
                onCallEnd();
            }
        }
    };

    // Toggle video
    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };

    // Toggle audio
    const toggleAudio = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
            }
        }
    };

    // Retry connection
    const retryConnection = () => {
        setConnectionAttempts(0);
        setCallInitiated(false);
        if (sessionId) {
            startPeerDiscovery(sessionId);
        }
    };

    // Status message
    const getStatusMessage = () => {
        if (isCallActive) return 'Video call active';
        if (isConnecting) return 'Connecting to video service...';
        if (connectionStatus === 'connected' && connectedPeers.length === 1) {
            return `Waiting for ${userRole === 'doctor' ? 'patient' : 'doctor'} to join...`;
        }
        if (connectionStatus === 'connected' && connectedPeers.length === 2) {
            return callInitiated ? 'Establishing connection...' : 'Both participants online, connecting...';
        }
        if (connectionStatus === 'error') return 'Connection error';
        return 'Initializing...';
    };

    return (
        <div className="video-call-container" style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            width: '90vw',
            height: '90vh',
            maxWidth: '1400px',
            maxHeight: '900px',
            backgroundColor: '#1a1a1a',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            border: '2px solid #333',
            transform: 'translateX(-50%) translateY(-50%)'
        }}>
            {/* Header */}
            <div className="video-call-header" style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '1rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: '12px 12px 0 0',
                minHeight: '70px'
            }}>
                <div>
                    <h5 className="mb-0">Medical Consultation</h5>
                    <small className="opacity-75">{getStatusMessage()}</small>
                </div>
                <div className="d-flex align-items-center gap-3">
                    <span className="badge bg-white text-dark px-3 py-2">
                        {connectedPeers.length} participant(s)
                    </span>
                    {!isCallActive && connectedPeers.length === 2 && (
                        <button
                            className="btn btn-sm btn-warning"
                            onClick={retryConnection}
                            title="Retry connection"
                        >
                            <i className="fas fa-sync"></i> Retry
                        </button>
                    )}
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
                    <button
                        className="btn btn-sm btn-outline-danger ms-2"
                        onClick={retryConnection}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Main Video Area */}
            <div className="video-area flex-grow-1 position-relative" style={{
                padding: '20px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gridTemplateRows: '1fr auto',
                gap: '15px',
                minHeight: '0'
            }}>
                {/* Remote Video (Main) */}
                <div className="remote-video-container" style={{
                    gridColumn: '1',
                    gridRow: '1',
                    backgroundColor: '#2a2a2a',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '400px',
                    aspectRatio: '16/9'
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
                                <div>
                                    <div className="spinner-border text-light mb-3" role="status">
                                        <span className="visually-hidden">Connecting...</span>
                                    </div>
                                    <h5>Connecting to video service...</h5>
                                    <p>Please wait while we establish the connection.</p>
                                </div>
                            ) : connectionStatus === 'connected' && connectedPeers.length < 2 ? (
                                <div>
                                    <i className="fas fa-user-clock fa-3x mb-3"></i>
                                    <h5>Waiting for other participant...</h5>
                                    <p>The {userRole === 'doctor' ? 'patient' : 'doctor'} will join shortly.</p>
                                </div>
                            ) : connectionStatus === 'connected' && connectedPeers.length === 2 ? (
                                <div>
                                    <i className="fas fa-video fa-3x mb-3"></i>
                                    <h5>Both participants online, connecting...</h5>
                                    <button
                                        className="btn btn-primary mt-2"
                                        onClick={retryConnection}
                                    >
                                        <i className="fas fa-sync me-2"></i>
                                        Retry Connection
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <i className="fas fa-exclamation-triangle fa-3x mb-3 text-warning"></i>
                                    <h5>Connection Issue</h5>
                                    <p>Please check your internet connection and try again.</p>
                                    <button
                                        className="btn btn-warning"
                                        onClick={retryConnection}
                                    >
                                        <i className="fas fa-redo me-2"></i>
                                        Retry
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Connection Status Overlay */}
                    {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') && (
                        <div style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            background: 'rgba(255, 193, 7, 0.9)',
                            color: 'black',
                            padding: '8px 12px',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            fontWeight: 'bold'
                        }}>
                            <i className="fas fa-spinner fa-spin me-2"></i>
                            {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
                        </div>
                    )}
                </div>

                {/* Local Video (Picture-in-Picture) */}
                <div className="local-video-container" style={{
                    gridColumn: '2',
                    gridRow: '1',
                    width: '250px',
                    height: '188px',
                    backgroundColor: '#3a3a3a',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    position: 'relative',
                    alignSelf: 'start',
                    border: '2px solid #667eea'
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
                    <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '8px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem'
                    }}>
                        You ({userRole})
                    </div>
                </div>

                {/* Control Bar - Only Camera and Microphone */}
                <div className="control-bar" style={{
                    gridColumn: '1 / -1',
                    gridRow: '2',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '30px',
                    padding: '15px',
                    backgroundColor: 'rgba(42, 42, 42, 0.8)',
                    borderRadius: '25px',
                    backdropFilter: 'blur(10px)'
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
                </div>
            </div>
        </div>
    );
};

export default VideoCall;