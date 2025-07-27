import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const VideoCall = ({ appointmentId, onCallEnd }) => {
    // State
    const [isCallActive, setIsCallActive] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [error, setError] = useState('');
    const [roomId, setRoomId] = useState('');
    const [connectedPeers, setConnectedPeers] = useState([]);

    // Refs
    const localVideoRef = useRef();
    const remoteVideoRef = useRef();
    const localStreamRef = useRef();
    const peerConnectionRef = useRef();
    const socketRef = useRef();

    // User data
    const userRole = localStorage.getItem('role');
    const userName = localStorage.getItem('name');

    // WebRTC Configuration
    const rtcConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
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
        iceCandidatePoolSize: 10
    };

    // Initialize everything
    useEffect(() => {
        initializeCall();
        return cleanup;
    }, [appointmentId]);

    const initializeCall = async () => {
        try {
            setIsConnecting(true);
            setError('');

            // Get media first
            await getUserMedia();

            // Initialize socket connection
            initializeSocket();

            // Create room ID from appointment
            const room = `appointment_${appointmentId}`;
            setRoomId(room);

            // Join the room
            setTimeout(() => {
                if (socketRef.current) {
                    socketRef.current.emit('join-room', {
                        roomId: room,
                        userRole,
                        userName
                    });
                }
            }, 1000);

        } catch (error) {
            setError(`Failed to initialize: ${error.message}`);
            setIsConnecting(false);
        }
    };

    // Get user media
    const getUserMedia = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            console.log('✅ Media acquired');
        } catch (error) {
            console.error('❌ Media error:', error);
            throw new Error('Camera/microphone access denied');
        }
    };

    // Initialize Socket.IO
    const initializeSocket = () => {
        // Connect to your Flask-SocketIO server
        socketRef.current = io('https://backend-mediconnect.onrender.com', {
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            console.log('✅ Socket connected');
            setConnectionStatus('connected');
            setIsConnecting(false);
        });

        socketRef.current.on('disconnect', () => {
            console.log('❌ Socket disconnected');
            setConnectionStatus('disconnected');
        });

        // Room events
        socketRef.current.on('user-joined', (data) => {
            console.log('👤 User joined:', data);
            setConnectedPeers(data.users);

            // If we're the patient and doctor joined, start the call
            if (userRole === 'patient' && data.user.role === 'doctor') {
                setTimeout(() => createOffer(), 1000);
            }
        });

        socketRef.current.on('user-left', (data) => {
            console.log('👋 User left:', data);
            setConnectedPeers(data.users);
            handlePeerDisconnected();
        });

        // WebRTC signaling events
        socketRef.current.on('offer', handleOffer);
        socketRef.current.on('answer', handleAnswer);
        socketRef.current.on('ice-candidate', handleIceCandidate);

        socketRef.current.on('error', (error) => {
            console.error('Socket error:', error);
            setError(error.message || 'Connection error');
        });
    };

    // Create WebRTC peer connection
    const createPeerConnection = () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }

        const pc = new RTCPeerConnection(rtcConfig);
        peerConnectionRef.current = pc;

        // Add local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        // Handle remote stream
        pc.ontrack = (event) => {
            console.log('🎥 Remote stream received');
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setIsCallActive(true);
            }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                socketRef.current.emit('ice-candidate', {
                    roomId,
                    candidate: event.candidate
                });
            }
        };

        // Connection state changes
        pc.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', pc.connectionState);
            if (pc.connectionState === 'connected') {
                setConnectionStatus('call-active');
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setConnectionStatus('disconnected');
                setIsCallActive(false);
            }
        };

        return pc;
    };

    // Create offer (caller - usually patient)
    const createOffer = async () => {
        try {
            console.log('📞 Creating offer...');
            const pc = createPeerConnection();

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socketRef.current.emit('offer', {
                roomId,
                offer: offer
            });

        } catch (error) {
            console.error('❌ Offer creation failed:', error);
            setError('Failed to create offer');
        }
    };

    // Handle incoming offer
    const handleOffer = async (data) => {
        try {
            console.log('📧 Received offer');
            const pc = createPeerConnection();

            await pc.setRemoteDescription(data.offer);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socketRef.current.emit('answer', {
                roomId,
                answer: answer
            });

        } catch (error) {
            console.error('❌ Offer handling failed:', error);
            setError('Failed to handle offer');
        }
    };

    // Handle answer
    const handleAnswer = async (data) => {
        try {
            console.log('✅ Received answer');
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(data.answer);
            }
        } catch (error) {
            console.error('❌ Answer handling failed:', error);
        }
    };

    // Handle ICE candidate
    const handleIceCandidate = async (data) => {
        try {
            if (peerConnectionRef.current) {
                await peerConnectionRef.current.addIceCandidate(data.candidate);
            }
        } catch (error) {
            console.error('❌ ICE candidate error:', error);
        }
    };

    // Handle peer disconnected
    const handlePeerDisconnected = () => {
        setIsCallActive(false);
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
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
        setError('');
        setIsCallActive(false);
        if (userRole === 'patient') {
            setTimeout(() => createOffer(), 1000);
        }
    };

    // End call
    const endCall = () => {
        cleanup();
        if (onCallEnd) {
            onCallEnd();
        }
    };

    // Cleanup
    const cleanup = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
        if (socketRef.current) {
            socketRef.current.disconnect();
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
            return 'Both participants online, connecting...';
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
                                        Start Video Call
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

                {/* Control Bar */}
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