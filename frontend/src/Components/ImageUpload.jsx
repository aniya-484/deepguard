import { useState, useRef, useEffect } from "react";
import Chatbot from "./Chatbot";

function ImageUpload() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Scroll to top and clean up speech on mount/unmount
  useEffect(() => {
    window.scrollTo(0, 0);
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
    const allFiles = files.filter(file => file.result !== null);
    if (allFiles.length === 0) return "";

    const processedFiles = allFiles.filter(file => file.result.analyzed);
    const notEvaluatedFiles = allFiles.filter(file => !file.result.analyzed);

    let text = `Image analysis complete. `;
    
    if (processedFiles.length > 0) {
      text += `${processedFiles.length} image${processedFiles.length > 1 ? 's' : ''} analyzed. `;

      const fakeCount = processedFiles.filter(file => 
        getDisplayResult(file.result.prediction) === "Fake"
      ).length;
      const realCount = processedFiles.length - fakeCount;

      if (fakeCount > 0) {
        text += `Warning: ${fakeCount} deepfake${fakeCount > 1 ? 's' : ''} detected. `;
      }
      if (realCount > 0) {
        text += `${realCount} authentic image${realCount > 1 ? 's' : ''} verified. `;
      }

      // Add details for each analyzed file
      processedFiles.forEach((file, index) => {
        const result = getDisplayResult(file.result.prediction);
        const confidence = file.result.confidence;
        text += `Image ${index + 1}: ${result} with ${confidence.toFixed(0)}% confidence. `;
      });
    }

    if (notEvaluatedFiles.length > 0) {
      text += `${notEvaluatedFiles.length} image${notEvaluatedFiles.length > 1 ? 's' : ''} not evaluated. Face is not present in ${notEvaluatedFiles.length > 1 ? 'these images' : 'this image'}. `;
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
      preview: URL.createObjectURL(file),
      name: file.name,
      result: null,
    }));

    setFiles([...files, ...newFiles]);
    stopSpeaking(); // Stop any ongoing speech when new files are added
  };

  const handleUploadAll = async () => {
    if (files.length === 0) {
      alert("Please select at least one image first");
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    stopSpeaking(); // Stop speech before starting analysis

    const totalFiles = files.length;
    let processedCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (files[i].result) continue;

      try {
        const formData = new FormData();
        formData.append("file", files[i].file);

        const res = await fetch('http://127.0.0.1:8000/predict/image', {
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
    URL.revokeObjectURL(files[index].preview);
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    
    if (selectedFileIndex === index) {
      setSelectedFileIndex(null);
    }
  };

  const handleReset = () => {
    files.forEach((file) => URL.revokeObjectURL(file.preview));
    setFiles([]);
    setUploadProgress(0);
    setSelectedFileIndex(null);
    stopSpeaking();
    window.scrollTo(0, 0);
  };

  const renderDetailedView = () => {
    if (selectedFileIndex === null || !files[selectedFileIndex]) return null;

    const file = files[selectedFileIndex];
    if (!file.result || !file.result.analyzed) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center rounded-t-2xl z-10">
            <h2 className="text-2xl font-bold text-gray-800">Image Analysis</h2>
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
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold mb-3 text-gray-700">Original Image</h3>
                  <div className="flex justify-center">
                    <img
                      src={file.preview}
                      alt="Original"
                      className="max-w-xs max-h-64 rounded-lg shadow-md object-contain"
                    />
                  </div>
                </div>

                <div className={`rounded-xl p-6 text-white ${
                  getDisplayResult(file.result.prediction) === "Real" 
                    ? "bg-gradient-to-r from-green-600 to-green-700" 
                    : "bg-gradient-to-r from-red-600 to-red-700"
                }`}>
                  <h3 className="text-xl font-bold mb-4">Detection Result</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm opacity-90">Classification:</span>
                      <span className="text-2xl font-bold">{getDisplayResult(file.result.prediction)}</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-3">
                      <div
                        className="bg-white h-3 rounded-full transition-all duration-500"
                        style={{ width: `${file.result.confidence}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm opacity-90">Confidence:</span>
                      <span className="text-xl font-bold">{file.result.confidence}%</span>
                    </div>
                    <div className="text-center text-xs mt-2 opacity-90 bg-white/10 rounded-lg py-2">
                      {file.result.confidence >= 90 ? (
                        <p>✓ High Confidence</p>
                      ) : file.result.confidence >= 70 ? (
                        <p>⚠ Moderate Confidence</p>
                      ) : (
                        <p>⚠ Low Confidence</p>
                      )}
                    </div>
                  </div>
                </div>

                {file.result.allProbabilities && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">All Class Probabilities</h3>
                    <div className="space-y-2">
                      {Object.entries(file.result.allProbabilities)
                        .sort((a, b) => b[1] - a[1])
                        .map(([method, prob]) => (
                          <div key={method} className="flex items-center">
                            <span className="text-sm font-medium w-32 text-gray-700">{method}:</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-4 mx-2">
                              <div
                                className={`h-4 rounded-full ${method === 'Real' ? 'bg-green-500' : 'bg-red-500'}`}
                                style={{ width: `${prob}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold w-16 text-right text-gray-700">{prob}%</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Backend Data Only */}
              <div className="space-y-4">
                {/* Face Image from Backend */}
                {file.result.faceImage && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">Face Image</h3>
                    <div className="flex justify-center">
                      <img 
                        src={file.result.faceImage} 
                        alt="Face" 
                        className="max-w-full h-auto rounded-lg shadow-md"
                      />
                    </div>
                  </div>
                )}

                {/* Feature Quality from Backend */}
                {file.result.featureQuality && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-lg font-semibold mb-3 text-gray-700">Feature Quality Analysis</h3>
                    <div className="space-y-3">
                      {Object.entries(file.result.featureQuality).map(([feature, value]) => {
                        const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                        return (
                          <div key={feature}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium text-gray-700">{feature}</span>
                              <span className="text-sm font-semibold text-gray-700">{numValue.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full transition-all ${
                                  numValue > 70 ? 'bg-green-500' : numValue > 40 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${numValue}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-4 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>Good (&gt;70)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span>Fair (40-70)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span>Poor (&lt;40)</span>
                      </div>
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

      <div className="flex-1 bg-gradient-to-br from-blue-50 to-blue-100 py-8 px-4 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-blue-600 mb-2">
              Image Deepfake Detector
            </h1>
            <p className="text-gray-600 text-sm">
              Upload images to detect if they're real or AI-generated
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50">
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center">
                  <svg className="w-14 h-14 text-blue-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-lg font-semibold text-blue-600 mb-1">
                    Click to upload images
                  </p>
                  <p className="text-sm text-gray-500">
                    PNG, JPG, JPEG up to 10MB • Multiple files supported
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
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
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Analyzing..." : `Analyze ${files.length} Image${files.length > 1 ? 's' : ''}`}
                </button>
                
                {/* Voice Control Button */}
                <button
                  onClick={toggleVoice}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    voiceEnabled
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
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
                  className="px-6 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset All
                </button>
              </div>
            )}

            {loading && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-600">Processing images...</span>
                  <span className="text-sm font-semibold text-blue-600">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Speaking Indicator */}
            {isSpeaking && (
              <div className="mt-4 bg-blue-100 rounded-lg p-4 flex items-center space-x-3">
                <svg className="w-6 h-6 text-blue-600 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="text-blue-700 font-semibold">🎙️ Reading results aloud...</span>
              </div>
            )}
          </div>

          {/* HORIZONTAL LAYOUT - Image + Results in ONE LINE */}
          {files.length > 0 && (
            <div className="space-y-4">
              {files.map((file, index) => (
                <div 
                  key={index} 
                  className="bg-white rounded-xl shadow-lg p-4 flex items-center gap-6 hover:shadow-xl transition-shadow"
                >
                  {/* Image Preview - Left Side */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={file.preview}
                      alt={`Upload ${index + 1}`}
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                    
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
                  <div className="flex-1 flex items-center gap-4 flex-wrap">
                    {file.result ? (
                      file.result.analyzed ? (
                        <>
                          {/* Result Badge */}
                          <div className={`px-6 py-3 rounded-lg text-white font-bold text-lg whitespace-nowrap ${
                            getDisplayResult(file.result.prediction) === "Real" 
                              ? "bg-gradient-to-r from-green-500 to-green-600" 
                              : "bg-gradient-to-r from-red-500 to-red-600"
                          }`}>
                            {getDisplayResult(file.result.prediction)}
                          </div>

                          {/* Confidence */}
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Confidence:</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  getDisplayResult(file.result.prediction) === "Real" 
                                    ? "bg-green-500" 
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${file.result.confidence}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{file.result.confidence}%</span>
                          </div>

                          {/* View Analysis Button */}
                          <button
                            onClick={() => setSelectedFileIndex(index)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors whitespace-nowrap shadow-md hover:shadow-lg"
                          >
                            View Analysis
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
                          <p className="text-red-800 font-bold text-sm">
                            ⚠️ NOT EVALUATED - Face is not present
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
              <p>{files.length} image{files.length > 1 ? 's' : ''} uploaded • Powered by AI • Secure & Private • Voice: {voiceEnabled ? 'ON 🔊' : 'OFF 🔇'}</p>
            </div>
          )}
        </div>
      </div>

      {renderDetailedView()}
      {/* <Chatbot /> */}
    </div>
  );
}

export default ImageUpload;