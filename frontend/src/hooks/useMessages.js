import { useState, useEffect, useCallback } from 'react';
import { messageService } from '../services/messageService';

export const useMessages = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load conversations on component mount
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await messageService.getConversations();
      setConversations(response.conversations || []);
    } catch (err) {
      setError('Failed to load conversations');
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load messages for a specific conversation
  const loadMessages = useCallback(async (conversationId, otherUserEmail) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await messageService.getMessages(conversationId, otherUserEmail);
      setMessages(response.messages || []);
    } catch (err) {
      setError('Failed to load messages');
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Send a message
  const sendMessage = useCallback(async (conversationId, messageText, otherUserEmail, imageAttachment = null) => {
    if (!conversationId || (!messageText.trim() && !imageAttachment)) return;

    try {
      await messageService.sendMessage(conversationId, messageText.trim(), otherUserEmail, imageAttachment);
      
      // Reload messages and conversations to get updated data
      await Promise.all([
        loadMessages(conversationId, otherUserEmail),
        loadConversations()
      ]);
      
      return true;
    } catch (err) {
      setError('Failed to send message');
      console.error('Error sending message:', err);
      return false;
    }
  }, [loadMessages, loadConversations]);

  // Upload image
  const uploadImage = useCallback(async (imageFile) => {
    try {
      const result = await messageService.uploadImage(imageFile);
      return result;
    } catch (err) {
      setError('Failed to upload image');
      console.error('Error uploading image:', err);
      return null;
    }
  }, []);

  // Start a new conversation
  const startConversation = useCallback(async (otherUserEmail) => {
    try {
      const response = await messageService.startConversation(otherUserEmail);
      await loadConversations(); // Refresh conversations list
      return response.conversation_id;
    } catch (err) {
      setError('Failed to start conversation');
      console.error('Error starting conversation:', err);
      return null;
    }
  }, [loadConversations]);

  // Select a conversation
  const selectConversation = useCallback((conversation) => {
    setActiveConversation(conversation);
    if (conversation) {
      loadMessages(conversation.conversation_id, conversation.other_user_email);
    } else {
      setMessages([]);
    }
  }, [loadMessages]);

  // Get unread message count
  const getUnreadCount = useCallback(() => {
    return conversations.reduce((total, conv) => total + (conv.unread_count || 0), 0);
  }, [conversations]);

  // Initialize conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    activeConversation,
    messages,
    loading,
    error,
    loadConversations,
    loadMessages,
    sendMessage,
    uploadImage,
    startConversation,
    selectConversation,
    getUnreadCount,
    clearError: () => setError(null)
  };
};