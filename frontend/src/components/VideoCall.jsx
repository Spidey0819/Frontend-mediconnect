import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import apiConfig, { getPeerJSConfig } from '../config/api';

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
    const [connectionAttempts, setConnectionAttempts] = useState(0);
    const [callInitiated, setCallInitiated] = useState(false);

    // Video refs
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();
    const localStreamRef = useRef();
    const connectionTimeoutRef = useRef();
    const discoveryIntervalRef = useRef();

    const userRole = localStorage.getItem('role');
    const userName = localStorage.getItem('name');

    // Add log entry
    const addLog = (message) => {
        const timestamp = new Date().toLocaleTimeString();
        setPeerDiscoveryLog(prev => [...prev.slice(-8), `${timestamp}: ${message}`]);
        console.log(`[VideoCall] ${message}`);
    };

    // Enhanced PeerJS configuration with TURN servers
    const getEnhancedPeerConfig = () => {
        const baseConfig = getPeerJSConfig();
        return {
            ...baseConfig,
            config: {
                iceServers: [
                    // Public STUN servers
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    // Public TURN servers (these are free but limited)
                    {
                        urls: 'turn:openrelay.metered.ca:80',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    {
                        urls: 'turn:openrelay.metered.ca:443',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    },
                    {
                        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                        username: 'openrelayproject',
                        credential: 'openrelayproject'
                    }
                ],
                iceTransportPolicy: 'all',
                iceCandidatePoolSize: 10
            },
            debug: 3 // Maximum debug level
        };
    };

    // Initialize PeerJS and video session
    useEffect(() => {
        const initializeVideoCall = async () => {
            try {
                setIsConnecting(true);
                setError('');
                addLog('Initializing enhanced video call...');

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

                // Initialize media first
                await initializeMedia();

                // Then initialize PeerJS
                await initializePeerJS(sessionData);

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
            cleanup();
        };
    }, [appointmentId]);

    const initializeMedia = async () => {
        try {
            addLog('Requesting camera and microphone access...');

            // Request media with fallback options
            let stream;
            try {
                // Try with ideal constraints first
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
                addLog('High quality media failed, trying basic constraints...');
                // Fallback to basic constraints
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
            }

            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            addLog(`Media initialized: ${stream.getVideoTracks().length} video, ${stream.getAudioTracks().length} audio tracks`);

        } catch (error) {
            console.error('Error accessing media devices:', error);
            addLog(`Media access failed: ${error.message}`);
            setError('Failed to access camera/microphone. Please check permissions.');
            throw error;
        }
    };

    const initializePeerJS = async (sessionData) => {
        try {
            const peerConfig = getEnhancedPeerConfig();
            const peerId = `${sessionData.room_id}_${userRole}_${Date.now()}`;

            addLog(`Connecting to PeerJS: ${peerConfig.secure ? 'wss' : 'ws'}://${peerConfig.host}:${peerConfig.port}`);

            const newPeer = new Peer(peerId, peerConfig);

            // Set connection timeout
            connectionTimeoutRef.current = setTimeout(() => {
                if (!myPeerId) {
                    addLog('❌ PeerJS connection timeout');
                    setError('Connection timeout. Please check your internet connection.');
                    setConnectionStatus('error');
                }
            }, 15000); // 15 second timeout

            newPeer.on('open', (id) => {
                clearTimeout(connectionTimeoutRef.current);
                console.log('My peer ID is: ' + id);
                setMyPeerId(id);
                setConnectionStatus('connected');
                setIsConnecting(false);
                addLog(`✅ PeerJS connected: ${id.substring(0, 20)}...`);

                // Store peer ID and start discovery
                storePeerIdInBackend(sessionData.session_id, id);
                joinSession(sessionData.session_id);
            });

            newPeer.on('call', (incomingCall) => {
                addLog('📞 Incoming call received!');
                handleIncomingCall(incomingCall);
            });

            newPeer.on('disconnected', () => {
                addLog('⚠️ Peer disconnected, attempting reconnection...');
                setConnectionStatus('reconnecting');

                // Attempt to reconnect
                setTimeout(() => {
                    if (newPeer && !newPeer.destroyed) {
                        newPeer.reconnect();
                    }
                }, 2000);
            });

            newPeer.on('error', (err) => {
                clearTimeout(connectionTimeoutRef.current);
                console.error('PeerJS error:', err);
                addLog(`❌ PeerJS error: ${err.type} - ${err.message}`);

                if (err.type === 'peer-unavailable') {
                    addLog('Target peer unavailable, retrying discovery...');
                    setConnectionAttempts(prev => prev + 1);
                } else {
                    setError(`Connection error: ${err.message}`);
                    setConnectionStatus('error');
                }
            });

            setPeer(newPeer);

        } catch (error) {
            addLog(`❌ PeerJS initialization failed: ${error.message}`);
            throw error;
        }
    };

    const handleIncomingCall = (incomingCall) => {
        if (localStreamRef.current) {
            addLog('Answering incoming call...');
            incomingCall.answer(localStreamRef.current);
            setCall(incomingCall);
            setCallInitiated(true);

            incomingCall.on('stream', (remoteStream) => {
                addLog('✅ Remote video stream connected!');
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
                setIsCallActive(true);
                setConnectionStatus('call-active');
            });

            incomingCall.on('close', () => {
                addLog('Call ended by remote participant');
                handleCallEnd();
            });

            incomingCall.on('error', (error) => {
                addLog(`Call error: ${error.message}`);
                handleCallEnd();
            });
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
                addLog('✅ Registered with backend');
            } else {
                addLog('❌ Backend registration failed');
            }
        } catch (error) {
            addLog(`Backend registration error: ${error.message}`);
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
                addLog('✅ Joined video session');
                startPeerDiscovery(sessionId);
            }
        } catch (error) {
            addLog(`Session join error: ${error.message}`);
        }
    };

    const startPeerDiscovery = (sessionId) => {
        // Start immediate discovery
        discoverPeers(sessionId);

        // Set up periodic discovery
        discoveryIntervalRef.current = setInterval(() => {
            if (!isCallActive) {
                discoverPeers(sessionId);
            }
        }, 3000);
    };

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
                    addLog(`🎯 Found ${targetPeer.user_name} (${targetPeer.user_role})`);

                    // Add delay for mobile networks
                    setTimeout(() => {
                        if (userRole === 'patient' && !callInitiated) {
                            initiateCall(targetPeer.peer_id, targetPeer.user_name);
                        }
                    }, 2000);
                } else if (otherPeers.length === 0) {
                    addLog(`Waiting for other participant... (${data.peers.length} total)`);
                }
            }
        } catch (error) {
            addLog(`Peer discovery error: ${error.message}`);
        }
    };

    const initiateCall = async (targetPeerId, targetName) => {
        if (!peer || !localStreamRef.current || callInitiated) {
            return;
        }

        try {
            setCallInitiated(true);
            addLog(`📞 Calling ${targetName}...`);

            const outgoingCall = peer.call(targetPeerId, localStreamRef.current);

            if (!outgoingCall) {
                throw new Error('Failed to initiate call');
            }

            setCall(outgoingCall);

            // Set call timeout
            const callTimeout = setTimeout(() => {
                if (!isCallActive) {
                    addLog('❌ Call timeout, retrying...');
                    setCallInitiated(false);
                    setConnectionAttempts(prev => prev + 1);
                }
            }, 10000);

            outgoingCall.on('stream', (remoteStream) => {
                clearTimeout(callTimeout);
                addLog('✅ Call connected successfully!');
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
                addLog('Call closed by remote participant');
                handleCallEnd();
            });

            outgoingCall.on('error', (error) => {
                clearTimeout(callTimeout);
                addLog(`❌ Call error: ${error.message}`);
                setCallInitiated(false);
                setConnectionAttempts(prev => prev + 1);

                // Retry if not too many attempts
                if (connectionAttempts < 3) {
                    setTimeout(() => {
                        addLog('Retrying call...');
                        initiateCall(targetPeerId, targetName);
                    }, 3000);
                }
            });

        } catch (error) {
            addLog(`❌ Call initiation failed: ${error.message}`);
            setCallInitiated(false);
        }
    };

    const handleCallEnd = () => {
        setIsCallActive(false);
        setCallInitiated(false);
        setCall(null);
        setConnectionStatus('connected');

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
    };

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
            console.error('Error ending call:', error);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
                addLog(videoTrack.enabled ? 'Camera on' : 'Camera off');
            }
        }
    };

    const toggleAudio = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
                addLog(audioTrack.enabled ? 'Microphone on' : 'Microphone off');
            }
        }
    };

    const retryConnection = () => {
        addLog('🔄 Manual retry initiated...');
        setConnectionAttempts(0);
        setCallInitiated(false);
        if (sessionId) {
            startPeerDiscovery(sessionId);
        }
    };

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

            {/* Video Area */}
            <div className="video-area flex-grow-1 position-relative p-3">
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
                                    <p>{getStatusMessage()}</p>
                                    {connectedPeers.length === 2 && !isCallActive && (
                                        <div className="mt-3">
                                            <button
                                                className="btn btn-primary"
                                                onClick={retryConnection}
                                            >
                                                <i className="fas fa-sync me-2"></i>
                                                Retry Connection
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Local Video */}
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
                >
                    <i className={`fas ${isVideoEnabled ? 'fa-video' : 'fa-video-slash'} fa-lg`}></i>
                </button>

                <button
                    className={`btn ${isAudioEnabled ? 'btn-secondary' : 'btn-danger'} rounded-circle`}
                    onClick={toggleAudio}
                    style={{ width: '60px', height: '60px' }}
                >
                    <i className={`fas ${isAudioEnabled ? 'fa-microphone' : 'fa-microphone-slash'} fa-lg`}></i>
                </button>

                <button
                    className="btn btn-info rounded-circle"
                    style={{ width: '60px', height: '60px' }}
                >
                    <i className="fas fa-comment fa-lg"></i>
                </button>

                <button
                    className="btn btn-warning rounded-circle"
                    style={{ width: '60px', height: '60px' }}
                >
                    <i className="fas fa-desktop fa-lg"></i>
                </button>

                <button
                    className="btn btn-success rounded-circle"
                    style={{ width: '60px', height: '60px' }}
                >
                    <i className="fas fa-cog fa-lg"></i>
                </button>
            </div>

            {/* Enhanced Debug Info */}
            <div style={{
                position: 'absolute',
                top: '100px',
                left: '20px',
                background: 'rgba(0,0,0,0.95)',
                color: 'white',
                padding: '15px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                maxWidth: '400px',
                maxHeight: '350px',
                overflow: 'auto'
            }}>
                <div><strong>Status:</strong> {connectionStatus}</div>
                <div><strong>Participants:</strong> {connectedPeers.length}/2</div>
                <div><strong>Call Active:</strong> {isCallActive ? '✅ Yes' : '❌ No'}</div>
                <div><strong>Call Initiated:</strong> {callInitiated ? 'Yes' : 'No'}</div>
                <div><strong>Attempts:</strong> {connectionAttempts}</div>

                <hr style={{ margin: '10px 0', borderColor: '#444' }} />
                <div><strong>Discovery Log:</strong></div>
                {peerDiscoveryLog.map((log, index) => (
                    <div key={index} style={{ fontSize: '0.7rem', marginBottom: '2px' }}>
                        {log}
                    </div>
                ))}

                {connectedPeers.length > 0 && (
                    <>
                        <hr style={{ margin: '10px 0', borderColor: '#444' }} />
                        <div><strong>Peers:</strong></div>
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