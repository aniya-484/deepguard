import { useState, useRef, useEffect } from "react";
import Chatbot from "./Chatbot";

function AudioUpload() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Speak results when all files are processed
  useEffect(() => {
    if (!loading && files.length > 0 && voiceEnabled) {
      const allProcessed = files.every(file => file.result !== null);
      if (allProcessed) {
        const timer = setTimeout(() => {
          speakAllResults();
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, files, voiceEnabled]);

  // ==========================
  //    TEXT TO SPEECH
  // ==========================
  const speakAllResults = () => {
    if (!voiceEnabled) return;

    window.speechSynthesis.cancel();

    const speechText = generateSummaryText();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
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

  const toggleVoice = () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setVoiceEnabled(!voiceEnabled);
  };

  const generateSummaryText = () => {
    const allProcessed = files.filter(file => file.result !== null);
    if (allProcessed.length === 0) return "";

    const analyzedFiles = allProcessed.filter(file => file.result.analyzed !== false);
    const notAnalyzedFiles = allProcessed.filter(file => file.result.analyzed === false);

    let text = `Audio analysis complete. `;

    if (analyzedFiles.length > 0) {
      text += `${analyzedFiles.length} file${analyzedFiles.length > 1 ? 's' : ''} processed. `;

      const fakeCount = analyzedFiles.filter(file => 
        getDisplayResult(file.result.prediction) === "Fake"
      ).length;
      const realCount = analyzedFiles.length - fakeCount;

      if (fakeCount > 0) {
        text += `Warning: ${fakeCount} deepfake audio${fakeCount > 1 ? 's' : ''} detected. `;
      }
      if (realCount > 0) {
        text += `${realCount} authentic audio${realCount > 1 ? 's' : ''} verified. `;
      }

      // Add details for each file
      analyzedFiles.forEach((file, index) => {
        const result = getDisplayResult(file.result.prediction);
        const confidence = file.result.confidence;
        const interpretation = file.result.interpretation;
        text += `File ${index + 1}: ${result} with ${confidence}% confidence. ${interpretation}. `;
      });
    }

    if (notAnalyzedFiles.length > 0) {
      text += `${notAnalyzedFiles.length} file${notAnalyzedFiles.length > 1 ? 's' : ''} not analyzed. Silent, ringtone, or synthetic audio in ${notAnalyzedFiles.length > 1 ? 'these files' : 'this file'}. `;
    }

    return text;
  };

  const getDisplayResult = (prediction) => {
    return prediction === "Real" ? "Real" : "Fake";
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    const newFiles = selectedFiles.map((file) => ({
      file,
      name: file.name,
      duration: 0,
      result: null,
    }));

    setFiles([...files, ...newFiles]);
    stopSpeaking();

    // Get audio duration
    newFiles.forEach((newFile, index) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        setFiles(prevFiles => {
          const updated = [...prevFiles];
          const fileIndex = prevFiles.findIndex(f => f.file === newFile.file);
          if (fileIndex !== -1) {
            updated[fileIndex].duration = Math.round(audio.duration);
          }
          return updated;
        });
      };
      audio.src = URL.createObjectURL(newFile.file);
    });
  };

  const handleUploadAll = async () => {
    if (files.length === 0) {
      alert("Please select at least one audio file first");
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    stopSpeaking();

    const totalFiles = files.length;
    let processedCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (files[i].result) continue;

      try {
        const formData = new FormData();
        formData.append("file", files[i].file);

        const res = await fetch('http://127.0.0.1:8000/predict/audio', {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const data = await res.json();

        setFiles((prevFiles) => {
          const updatedFiles = [...prevFiles];
          updatedFiles[i] = {
            ...updatedFiles[i],
            result: data,
          };
          return updatedFiles;
        });

        processedCount++;
        setUploadProgress(Math.round((processedCount / totalFiles) * 100));
      } catch (error) {
        console.error(`Error processing file ${i + 1}:`, error);
        alert(`Error processing file ${i + 1}. Please try again.`);
      }
    }

    setLoading(false);
  };

  const handleRemoveFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    
    if (selectedFileIndex === index) {
      setSelectedFileIndex(null);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setUploadProgress(0);
    setSelectedFileIndex(null);
    stopSpeaking();
  };

  const renderDetailedView = () => {
    if (selectedFileIndex === null || !files[selectedFileIndex]) return null;

    const file = files[selectedFileIndex];
    if (!file.result || file.result.analyzed === false) return null;

    const result = file.result;
    const isReal = result.prediction === "Real";
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center rounded-t-2xl z-10">
            <h2 className="text-2xl font-bold text-gray-800">Audio Analysis</h2>
            <button
              onClick={() => setSelectedFileIndex(null)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6">
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              
              {/* Left Column */}
              <div className="space-y-4">
                {/* File Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">File Information</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Filename:</span>
                      <span className="text-sm font-medium text-gray-800">{file.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Duration:</span>
                      <span className="text-sm font-medium text-gray-800">{file.duration}s</span>
                    </div>
                  </div>
                </div>

                {/* Detection Result */}
                <div className={`rounded-xl p-6 text-white ${
                  isReal 
                    ? "bg-gradient-to-r from-green-600 to-green-700" 
                    : "bg-gradient-to-r from-red-600 to-red-700"
                }`}>
                  <h3 className="text-xl font-bold mb-4">Detection Result</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm opacity-90">Classification:</span>
                      <span className="text-2xl font-bold">{result.prediction}</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-3">
                      <div
                        className="bg-white h-3 rounded-full transition-all duration-500"
                        style={{ width: `${result.confidence}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm opacity-90">Confidence:</span>
                      <span className="text-xl font-bold">{result.confidence}%</span>
                    </div>
                    <div className="text-center text-xs mt-2 opacity-90 bg-white/10 rounded-lg py-2">
                      <p>{result.confidence_level}</p>
                    </div>
                  </div>
                </div>

                {/* Interpretation */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="text-lg font-semibold mb-2 text-blue-900">Interpretation</h3>
                  <p className="text-sm text-blue-800">{result.interpretation}</p>
                </div>
              </div>

              {/* Right Column - Backend Data */}
              <div className="space-y-4">
                {/* Probability Distribution */}
                {result.probabilities && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">Probability Distribution</h3>
                    <div className="space-y-4">
                      {Object.entries(result.probabilities).map(([label, prob]) => (
                        <div key={label}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">{label}</span>
                            <span className="text-sm font-bold text-gray-800">{prob}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-4">
                            <div
                              className={`h-4 rounded-full transition-all ${
                                label === 'Real' ? 'bg-green-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${prob}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

       
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">

      <div className="flex-1 bg-gradient-to-br from-purple-50 to-purple-100 py-8 px-4 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-purple-600 mb-2">
              🎵 Audio Deepfake Detector
            </h1>
            <p className="text-gray-600 text-sm">
              Upload audio files to detect if they're real or AI-generated deepfakes
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center hover:border-purple-500 transition-colors cursor-pointer bg-purple-50">
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center">
                  <svg className="w-14 h-14 text-purple-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2m0-5c0 1.1-1.343 2-3 2s-3-.9-3-2m15-5h.01M3 5h.01" />
                  </svg>
                  <p className="text-lg font-semibold text-purple-600 mb-1">
                    Click to upload audio files
                  </p>
                  <p className="text-sm text-gray-500">
                    MP3, WAV, M4A, OGG up to 50MB • Multiple files supported
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="audio/*"
                  multiple
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {files.length > 0 && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleUploadAll}
                  disabled={loading}
                  className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Analyzing..." : `Analyze ${files.length} File${files.length > 1 ? 's' : ''}`}
                </button>
                
                {/* Voice Control Button */}
                <button
                  onClick={toggleVoice}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    voiceEnabled
                      ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  title={voiceEnabled ? 'Voice ON' : 'Voice OFF'}
                >
                  {voiceEnabled ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                {/* Stop Speaking Button */}
                {isSpeaking && (
                  <button
                    onClick={stopSpeaking}
                    className="px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all animate-pulse"
                    title="Stop speaking"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}

                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="px-6 py-3 border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset All
                </button>
              </div>
            )}

            {loading && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-purple-600">Processing audio files...</span>
                  <span className="text-sm font-semibold text-purple-600">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-purple-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Speaking Indicator */}
            {isSpeaking && (
              <div className="mt-4 bg-purple-100 rounded-lg p-4 flex items-center space-x-3">
                <svg className="w-6 h-6 text-purple-600 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="text-purple-700 font-semibold">🎙️ Reading results aloud...</span>
              </div>
            )}
          </div>

          {/* HORIZONTAL LAYOUT - File Info + Results in ONE LINE */}
          {files.length > 0 && (
            <div className="space-y-4">
              {files.map((file, index) => (
                <div 
                  key={index} 
                  className="bg-white rounded-xl shadow-lg p-4 flex items-center gap-6 hover:shadow-xl transition-shadow"
                >
                  {/* Audio Icon + File Info - Left Side */}
                  <div className="relative flex-shrink-0 flex flex-col items-center justify-center w-32">
                    <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center mb-2 shadow-md">
                      <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">{file.duration}s</p>
                      <p className="text-xs font-semibold text-gray-700 truncate w-full">{file.name.substring(0, 15)}</p>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      disabled={loading}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Results - Right Side - ONE LINE */}
                  <div className="flex-1 flex items-center gap-4">
                    {file.result ? (
                    file.result.analyzed !== false ? (
                      <>
                        {/* Result Badge */}
                        <div className={`px-6 py-3 rounded-lg text-white font-bold text-lg whitespace-nowrap ${
                          file.result.prediction === "Real" 
                            ? "bg-gradient-to-r from-green-500 to-green-600" 
                            : "bg-gradient-to-r from-red-500 to-red-600"
                        }`}>
                          {file.result.prediction}
                        </div>

                        {/* Confidence */}
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Confidence:</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full transition-all duration-500 ${
                                file.result.prediction === "Real" 
                                  ? "bg-green-500" 
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${file.result.confidence}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{file.result.confidence}%</span>
                        </div>

                        {/* Confidence Level Badge */}
                        <div className="text-center px-3 py-2 bg-gray-100 rounded-lg whitespace-nowrap">
                          <p className="text-xs font-semibold text-gray-700">{file.result.confidence_level}</p>
                        </div>

                        {/* View Analysis Button */}
                        <button
                          onClick={() => setSelectedFileIndex(index)}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors whitespace-nowrap shadow-md hover:shadow-lg"
                        >
                          View Analysis
                        </button>
                      </>
                    ) : (
                      <div className="flex-1 bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
                        <p className="text-red-800 font-bold text-sm">
                          ⚠️ NOT ANALYZED - Cannot analyze this audio
                        </p>
                        <p className="text-red-700 text-xs mt-1">{file.result.message}</p>
                      </div>
                    )
                  ) : (
                      <div className="text-gray-500 text-sm">
                        {loading ? "Processing..." : "Ready to analyze"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-6 text-center text-xs text-gray-500">
              <p>{files.length} file{files.length > 1 ? 's' : ''} uploaded • Powered by AI • Secure & Private • Voice: {voiceEnabled ? 'ON 🔊' : 'OFF 🔇'}</p>
            </div>
          )}
        </div>
      </div>

      {renderDetailedView()}
      {/* <Chatbot /> */}
    </div>
  );
}

export default AudioUpload;