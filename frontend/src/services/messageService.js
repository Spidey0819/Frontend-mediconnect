import encryptionManager from '../utils/encryption';

const API_BASE_URL = 'https://backend-mediconnect.onrender.com/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const messageService = {
  // Get all conversations for current user
  getConversations: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }
      
      const data = await response.json();
      
      // Decrypt last messages and add "You: " prefix
      if (data.conversations && Array.isArray(data.conversations)) {
        const currentUserEmail = localStorage.getItem('email');
        
        for (let conversation of data.conversations) {
          if (conversation.last_message) {
            let messageToShow = conversation.last_message;
            
            // Try to decrypt if encryption is supported
            if (encryptionManager.isEncryptionSupported()) {
              try {
                messageToShow = await encryptionManager.decryptMessage(conversation.id, conversation.last_message);
              } catch (error) {
                console.warn('Failed to decrypt conversation last message:', error);
                // Keep original message if decryption fails
              }
            }
            
            // Add "You: " prefix if the current user sent the last message
            if (conversation.last_message_sender_email === currentUserEmail) {
              conversation.last_message = `You: ${messageToShow}`;
            } else {
              conversation.last_message = messageToShow;
            }
          }
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  },

  // Get messages for a specific conversation
  getMessages: async (conversationId, otherUserEmail) => {
    try {
      // Setup DH encryption for this conversation if possible
      if (encryptionManager.isEncryptionSupported()) {
        try {
          await messageService.setupDHEncryption(conversationId);
        } catch (dhError) {
          console.warn('DH setup failed, using legacy encryption:', dhError);
        }
      }

      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const data = await response.json();
      
      // Decrypt messages on the client side
      if (data.messages && Array.isArray(data.messages)) {
        for (let message of data.messages) {
          if (message.message && encryptionManager.isEncryptionSupported()) {
            try {
              // Attempt to decrypt the message
              const decryptedMessage = await encryptionManager.decryptMessage(conversationId, message.message);
              message.message = decryptedMessage;
            } catch (error) {
              console.warn('Failed to decrypt message:', error);
              // Keep the original message if decryption fails (could be legacy plain text)
            }
          }
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  },

  // Send a message
  sendMessage: async (conversationId, message, otherUserEmail, imageAttachment = null) => {
    try {
      // Encrypt the message before sending
      let encryptedMessage = '';
      if (message && message.trim()) {
        if (encryptionManager.isEncryptionSupported()) {
          encryptedMessage = await encryptionManager.encryptMessage(conversationId, message.trim());
        } else {
          console.warn('Encryption not supported, sending plain text');
          encryptedMessage = message.trim();
        }
      }
      
      const payload = { message: encryptedMessage };
      if (imageAttachment) {
        payload.file_attachment = imageAttachment;
      }
      
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      
      console.log('API response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('API error response:', errorData);
        throw new Error(`Failed to send message: ${response.status} ${errorData}`);
      }
      
      const result = await response.json();
      console.log('Message sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  // Upload image
  uploadImage: async (imageFile) => {
    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to upload image: ${response.status} ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },

  // Get image URL
  getImageUrl: (fileId) => {
    return `${API_BASE_URL}/files/${fileId}`;
  },

  // Start a new conversation and initiate key exchange
  startConversation: async (otherUserEmail) => {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ other_user_email: otherUserEmail })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }
      
      const result = await response.json();
      const conversationId = result.conversation_id;
      
      // Initiate DH key exchange for new conversations
      if (encryptionManager.isEncryptionSupported()) {
        try {
          const publicKey = await encryptionManager.getPublicKey(conversationId);
          await messageService.initiateKeyExchange(conversationId, publicKey);
        } catch (keyExchangeError) {
          console.warn('Failed to initiate key exchange, falling back to legacy encryption:', keyExchangeError);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error starting conversation:', error);
      throw error;
    }
  },

  // Initiate Diffie-Hellman key exchange
  initiateKeyExchange: async (conversationId, publicKey) => {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/key-exchange/initiate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ public_key: publicKey })
      });
      
      if (!response.ok) {
        throw new Error('Failed to initiate key exchange');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error initiating key exchange:', error);
      throw error;
    }
  },

  // Complete Diffie-Hellman key exchange
  completeKeyExchange: async (conversationId, publicKey) => {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/key-exchange/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ public_key: publicKey })
      });
      
      if (!response.ok) {
        throw new Error('Failed to complete key exchange');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error completing key exchange:', error);
      throw error;
    }
  },


  // Setup DH encryption for a conversation
  setupDHEncryption: async (conversationId) => {
    try {
      // Check if DH key exchange is already complete
      if (encryptionManager.isDHKeyExchangeAvailable(conversationId)) {
        return true;
      }

      // Get our public key
      const ourPublicKey = await encryptionManager.getPublicKey(conversationId);
      
      // Complete key exchange (send our key and get theirs)
      const keyExchangeResult = await messageService.completeKeyExchange(conversationId, ourPublicKey);
      
      if (keyExchangeResult.other_public_key) {
        // Complete the shared secret calculation
        await encryptionManager.completeKeyExchange(conversationId, keyExchangeResult.other_public_key);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error setting up DH encryption:', error);
      return false;
    }
  },


  // Format timestamp for display
  formatTime: (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
    }
  },

  // Format timestamp for message display
  formatMessageTime: (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
};