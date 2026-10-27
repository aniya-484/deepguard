import React, { useState, useRef, useEffect } from "react";

const Chatbot = () => {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "👋 Hi! I'm DeepGuard AI, your deepfake detection assistant. I can help you with:\n\n• Understanding deepfakes\n• Detecting fake images & audio\n• Tips to spot AI-generated content\n• Media authenticity verification\n\nWhat would you like to know?"
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ==========================
  //    SPEECH RECOGNITION SETUP
  // ==========================
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
        
        // Auto-send message when speech stops
        setTimeout(() => {
          sendMessage(transcript);
        }, 100);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      // Stop any ongoing speech when component unmounts
      window.speechSynthesis.cancel();
    };
  }, []);

  // ==========================
  //    VOICE INPUT TOGGLE
  // ==========================
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // ⭐ STOP ANY ONGOING SPEECH BEFORE STARTING TO LISTEN
      stopSpeaking();
      
      setInputMessage('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // ==========================
  //    TEXT TO SPEECH
  // ==========================
  const speak = (text) => {
    if (!voiceEnabled) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const toggleVoiceOutput = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setVoiceEnabled(!voiceEnabled);
  };

  // ==========================
  //    CLOSE CHAT HANDLER
  // ==========================
  const handleCloseChat = () => {
    // Stop any ongoing speech
    stopSpeaking();
    // Stop listening if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    // Close the chat
    setIsOpen(false);
  };

  // Quick question buttons
  const quickQuestions = [
    "How do I detect a deepfake?",
    "What are deepfakes?",
    "How are audio deepfakes made?",
    "Tips to spot fake videos"
  ];

  // ==========================
  //    SEND MESSAGE HANDLER
  // ==========================
  const sendMessage = async (messageText = null) => {
    const userMessage = messageText || inputMessage.trim();
    if (!userMessage || isLoading) return;

    setInputMessage("");

    // Add user message to UI
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Call your backend chatbot API
      const response = await fetch("http://localhost:8000/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Backend error");
      }

      const aiResponse = data.reply;

      // Add AI response to UI
      setMessages((prev) => [...prev, { role: "assistant", content: aiResponse }]);
      
      // Speak the response ONLY if voice is enabled
      if (voiceEnabled) {
        speak(aiResponse);
      }
    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMsg = "⚠️ Sorry, I'm having trouble connecting. Please try again in a moment.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMsg,
        },
      ]);
      
      // Speak error ONLY if voice is enabled
      if (voiceEnabled) {
        speak(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleQuickQuestion = (question) => {
    sendMessage(question);
  };

  return (
    <>
      {/* Floating Button - Only show when chatbot is closed - CHANGED z-50 to z-40 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-blue-600 to-blue-800 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-200 group"
          aria-label="Open chat"
        >
          {/* Message Icon SVG */}
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-7 w-7" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
            />
          </svg>
          
          {/* Notification Badge */}
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold animate-pulse">
            !
          </span>

          {/* Tooltip */}
          <span className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap pointer-events-none">
            Chat with DeepGuard AI
          </span>
        </button>
      )}

      {/* Side Panel Chatbot - Full Height - CHANGED z-50 to z-40 */}
      {isOpen && (
        <div className="fixed top-0 right-0 h-screen w-full sm:w-[450px] bg-white shadow-2xl z-40 flex flex-col">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-full text-2xl">
                🤖
              </div>
              <div>
                <h2 className="text-lg font-bold">DeepGuard AI</h2>
                <p className="text-xs text-blue-100">Deepfake Detection Expert</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Voice Toggle Button */}
              <button
                onClick={toggleVoiceOutput}
                className={`p-2 rounded-full transition-colors ${
                  voiceEnabled 
                    ? ' bg-opacity-20 hover:bg-opacity-30' 
                    : ' bg-opacity-10 hover:bg-opacity-20'
                }`}
                title={voiceEnabled ? 'Voice enabled - Click to disable' : 'Voice disabled - Click to enable'}
              >
                {voiceEnabled ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <button 
                onClick={handleCloseChat}
                className="text-white hover:bg-blue-800 rounded-full w-10 h-10 flex items-center justify-center transition-colors text-2xl font-light"
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages Area - Takes remaining height */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-4">
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm max-w-[85%] shadow-sm ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md"
                        : "bg-white text-gray-800 border border-gray-200 rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-start space-x-2">
                        <span className="text-xl">🤖</span>
                        <span className="whitespace-pre-line pt-0.5">{msg.content}</span>
                      </div>
                    )}
                    {msg.role === "user" && (
                      <span className="whitespace-pre-line">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-600 px-4 py-3 rounded-2xl text-sm border border-gray-200 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: "0.1s"}}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></div>
                      </div>
                      <span>Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Speaking Indicator - Only show when voice is enabled AND speaking */}
              {isSpeaking && voiceEnabled && (
                <div className="flex justify-center">
                  <div className="bg-blue-100 text-blue-600 px-3 py-2 rounded-full text-xs flex items-center space-x-2">
                    <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>Speaking...</span>
                  </div>
                </div>
              )}

              {/* Quick Questions (show only at start) */}
              {messages.length === 1 && !isLoading && (
                <div className="space-y-3 mt-4">
                  <p className="text-xs text-gray-600 font-semibold flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Quick questions:
                  </p>
                  {quickQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickQuestion(question)}
                      className="w-full text-left text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2.5 rounded-xl transition-all border border-blue-200 hover:border-blue-300"
                    >
                      💬 {question}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef}></div>
            </div>
          </div>

          {/* Input Box - Fixed at bottom */}
          <div className="border-t bg-white flex-shrink-0">
            <form onSubmit={handleSubmit} className="p-4 flex items-center space-x-2">
              {/* Microphone Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-xl transition-all flex-shrink-0 ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse shadow-lg' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
              </button>

              <input
                type="text"
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                placeholder={isListening ? "🎤 Listening... Speak now" : "Ask about deepfakes..."}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading || isListening}
              />
              
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim() || isListening}
                className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex-shrink-0"
                aria-label="Send message"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-5 w-5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M14 5l7 7m0 0l-7 7m7-7H3" 
                  />
                </svg>
              </button>
            </form>

            {/* Listening Status */}
            {isListening && (
              <div className="px-4 pb-3 flex items-center justify-center space-x-2 text-red-500 text-xs animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="font-semibold">Recording... Speak now. Will auto-send when you stop.</span>
              </div>
            )}
            
            {/* Footer */}
            <div className="bg-gray-50 px-4 py-2.5 text-center border-t">
              <p className="text-xs text-gray-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Specialized in deepfake detection only • Voice: {voiceEnabled ? 'ON 🔊' : 'OFF 🔇'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;