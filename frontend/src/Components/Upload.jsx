import { useState, useEffect } from "react";
import Chatbot from "./Chatbot";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function Upload() {
  const [files, setFiles] = useState([]);
  const [fileType, setFileType] = useState(null);
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
      files.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
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

    const processedFiles = allFiles.filter(file => file.result.analyzed !== false);
    const notEvaluatedFiles = allFiles.filter(file => file.result.analyzed === false);

    let mediaTypeLabel = fileType === 'image' ? 'image' : fileType === 'audio' ? 'audio' : 'video';
    let text = `${mediaTypeLabel} analysis complete. `;

    if (processedFiles.length > 0) {
      text += `${processedFiles.length} ${mediaTypeLabel}${processedFiles.length > 1 ? 's' : ''} analyzed. `;

      if (fileType === 'video') {
        const fakeCount = processedFiles.filter(file => isOverallFake(file.result)).length;
        const realCount = processedFiles.length - fakeCount;

        if (fakeCount > 0) {
          text += `Warning: ${fakeCount} deepfake${fakeCount > 1 ? 's' : ''} detected. `;
        }
        if (realCount > 0) {
          text += `${realCount} authentic video${realCount > 1 ? 's' : ''} verified. `;
        }

        processedFiles.forEach((file, index) => {
          const pred = getOverallPrediction(file.result);
          const conf = getOverallConfidence(file.result);
          text += `Video ${index + 1}: ${pred} with ${conf.toFixed(0)}% confidence. `;
        });
      } else {
        const fakeCount = processedFiles.filter(file => 
          getDisplayResult(file.result.prediction) === "Fake"
        ).length;
        const realCount = processedFiles.length - fakeCount;

        if (fakeCount > 0) {
          text += `Warning: ${fakeCount} deepfake${fakeCount > 1 ? 's' : ''} detected. `;
        }
        if (realCount > 0) {
          text += `${realCount} authentic ${mediaTypeLabel}${realCount > 1 ? 's' : ''} verified. `;
        }

        processedFiles.forEach((file, index) => {
          const result = getDisplayResult(file.result.prediction);
          const confidence = file.result.confidence;
          text += `File ${index + 1}: ${result} with ${confidence.toFixed(0)}% confidence. `;
        });
      }
    }

    if (notEvaluatedFiles.length > 0) {
      text += `${notEvaluatedFiles.length} ${mediaTypeLabel}${notEvaluatedFiles.length > 1 ? 's' : ''} not evaluated. Face is not present in ${notEvaluatedFiles.length > 1 ? 'these ' + mediaTypeLabel + 's' : 'this ' + mediaTypeLabel}. `;
    }

    return text;
  };

  // ==========================
  //    IMAGE/AUDIO HELPERS
  // ==========================
  const getDisplayResult = (prediction) => {
    if (prediction === "Real") {
      return "Real";
    }
    return "Fake";
  };

  // ==========================
  //    VIDEO HELPERS
  // ==========================
  const getOverallSummary = (result) => result?.overall_summary ?? null;
  const getVideoAnalysis = (result) => result?.video_analysis ?? null;
  const getAudioAnalysis = (result) => result?.audio_analysis ?? null;

  const getOverallPrediction = (result) => {
    if (!result) return "Unknown";
    if (result.overall_summary?.prediction) return result.overall_summary.prediction;
    return result.overall_prediction || result.prediction || "Unknown";
  };

  const getOverallConfidence = (result) => {
    if (!result) return 0;
    if (result.overall_summary?.confidence !== undefined)
      return Number(result.overall_summary.confidence);
    const c = result.overall_confidence ?? result.confidence;
    return c !== undefined ? Number(c) : 0;
  };

  const isOverallFake = (result) => {
    if (!result) return false;
    if (result.overall_summary?.is_fake !== undefined) return result.overall_summary.is_fake;
    const pred = getOverallPrediction(result);
    return pred !== "Real" && pred !== "Unknown";
  };

  const gradientFor = (fake) =>
    fake ? "bg-gradient-to-r from-red-600 to-red-700" : "bg-gradient-to-r from-green-600 to-green-700";
  const barColorFor = (fake) => fake ? "bg-red-500" : "bg-green-500";

  // ==========================
  //    FILE DETECTION
  // ==========================
  const detectFileType = (file) => {
    const type = file.type.toLowerCase();
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('audio/')) return 'audio';
    if (type.startsWith('video/')) return 'video';
    
    const name = file.name.toLowerCase();
    if (name.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) return 'image';
    if (name.match(/\.(mp3|wav|flac|ogg|m4a|aac)$/)) return 'audio';
    if (name.match(/\.(mp4|avi|mov|mkv|webm|flv|wmv|m4v)$/)) return 'video';
    
    return 'unknown';
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    const firstFileType = detectFileType(selectedFiles[0]);
    
    if (firstFileType === 'unknown') {
      alert('Unsupported file type. Please upload images, audio, or video files.');
      return;
    }

    if (files.length > 0 && fileType !== firstFileType) {
      alert(`You can only upload ${fileType} files at a time. Please clear existing files first.`);
      return;
    }

    const allSameType = selectedFiles.every(file => detectFileType(file) === firstFileType);
    if (!allSameType) {
      alert('Please select only one type of file (all images, all audio, or all videos).');
      return;
    }

    const newFiles = selectedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2),
      duration: 0,
      result: null,
    }));

    setFiles([...files, ...newFiles]);
    setFileType(firstFileType);
    stopSpeaking();

    // Get audio/video duration if applicable
    if (firstFileType === 'audio' || firstFileType === 'video') {
      newFiles.forEach((newFile) => {
        const media = new (firstFileType === 'audio' ? Audio : HTMLVideoElement)();
        media.onloadedmetadata = () => {
          setFiles(prevFiles => {
            const updated = [...prevFiles];
            const fileIndex = prevFiles.findIndex(f => f.file === newFile.file);
            if (fileIndex !== -1) {
              updated[fileIndex].duration = Math.round(media.duration);
            }
            return updated;
          });
        };
        media.src = URL.createObjectURL(newFile.file);
      });
    }
  };

  const handleUploadAll = async () => {
    if (files.length === 0) {
      alert("Please select at least one file first");
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    stopSpeaking();

    const totalFiles = files.length;
    let processedCount = 0;

    const endpoints = {
      image: 'http://127.0.0.1:8000/predict/image',
      audio: 'http://127.0.0.1:8000/predict/audio',
      video: 'http://127.0.0.1:8000/predict/video',
    };

    const endpoint = endpoints[fileType];

    for (let i = 0; i < files.length; i++) {
      if (files[i].result) continue;

      try {
        const formData = new FormData();
        formData.append("file", files[i].file);

        const res = await fetch(endpoint, {
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
    if (files[index].preview) {
      URL.revokeObjectURL(files[index].preview);
    }
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    
    if (newFiles.length === 0) {
      setFileType(null);
      setSelectedFileIndex(null);
    } else if (selectedFileIndex === index) {
      setSelectedFileIndex(null);
    }
  };

  const handleReset = () => {
    files.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
    setFileType(null);
    setUploadProgress(0);
    setSelectedFileIndex(null);
    stopSpeaking();
    window.scrollTo(0, 0);
  };

  // ==========================
  //    AUDIO SECTION COMPONENT
  // ==========================
  const AudioSection = ({ audio }) => {
    if (!audio) return null;

    if (audio.skipped || !audio.success) {
      return (
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-2 text-gray-700">Audio Analysis</h3>
          <p className="text-sm text-gray-500 italic">{audio.reason ?? audio.error ?? "Audio analysis unavailable."}</p>
        </div>
      );
    }

    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-700">Audio Analysis</h3>

        <div className={`rounded-lg px-4 py-3 text-white ${gradientFor(audio.is_fake)}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm opacity-90">Classification:</span>
            <span className="text-xl font-bold">{audio.prediction}</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2.5 mb-2">
            <div className="bg-white h-2.5 rounded-full" style={{ width: `${audio.confidence}%` }} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="opacity-90">Confidence:</span>
            <span className="font-bold">{Number(audio.confidence).toFixed(1)}%</span>
          </div>
        </div>

        {audio.probabilities && (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(audio.probabilities).map(([label, pct]) => (
              <div key={label} className="bg-white rounded-lg p-3 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-lg font-bold text-gray-800">{Number(pct).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        )}

        {audio.interpretation && (
          <p className="text-xs text-gray-500 italic bg-white rounded-lg px-3 py-2 shadow-sm">
            💬 {audio.interpretation}
          </p>
        )}
      </div>
    );
  };

  // ==========================
  //    OVERALL SUMMARY COMPONENT
  // ==========================
  const OverallSummarySection = ({ summary }) => {
    if (!summary) return null;
    return (
      <div className={`rounded-xl p-5 text-white ${gradientFor(summary.is_fake)}`}>
        <h3 className="text-xl font-bold mb-4">Overall Verdict</h3>

        <div className="flex justify-between items-center mb-2">
          <span className="text-sm opacity-90">Classification:</span>
          <span className="text-2xl font-bold">{summary.prediction}</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3 mb-2">
          <div className="bg-white h-3 rounded-full" style={{ width: `${summary.confidence}%` }} />
        </div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm opacity-90">Combined Confidence:</span>
          <span className="text-xl font-bold">{Number(summary.confidence).toFixed(1)}%</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-lg p-2 text-center">
            <p className="text-xs opacity-75 mb-1">Visual</p>
            <p className="font-bold">{summary.details?.video_verdict ?? '—'}</p>
            {summary.details?.video_confidence != null && (
              <p className="text-xs opacity-75">{Number(summary.details.video_confidence).toFixed(1)}%</p>
            )}
          </div>
          <div className="bg-white/10 rounded-lg p-2 text-center">
            <p className="text-xs opacity-75 mb-1">Audio</p>
            <p className="font-bold">{summary.details?.audio_verdict ?? 'N/A'}</p>
            {summary.details?.audio_confidence != null && summary.details.audio_confidence !== 'N/A' && (
              <p className="text-xs opacity-75">{Number(summary.details.audio_confidence).toFixed(1)}%</p>
            )}
          </div>
        </div>

        <div className="mt-3 text-center text-xs bg-white/10 rounded-lg py-2 px-3">
          <span className="opacity-90">{summary.agreement}</span>
          {summary.reliability && (
            <span className="ml-2 font-semibold">· Reliability: {summary.reliability}</span>
          )}
        </div>
      </div>
    );
  };

  // ==========================
  //    DETAILED VIEW MODAL
  // ==========================
  const renderDetailedView = () => {
    if (selectedFileIndex === null || !files[selectedFileIndex]) return null;

    const file = files[selectedFileIndex];
    if (!file.result || file.result.analyzed === false) return null;

    if (fileType === 'video') {
      return renderVideoDetailedView(file);
    } else {
      return renderImageAudioDetailedView(file);
    }
  };

  const renderImageAudioDetailedView = () => {
    const file = files[selectedFileIndex];
    if (!file.result) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center rounded-t-2xl z-10">
            <h2 className="text-2xl font-bold text-gray-800">{fileType === 'image' ? 'Image' : 'Audio'} Analysis</h2>
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
                {/* File Preview/Info */}
                {fileType === 'image' ? (
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
                ) : (
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
                )}

                {/* Detection Result */}
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

                {/* Audio-specific: Interpretation */}
                {fileType === 'audio' && file.result.interpretation && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="text-lg font-semibold mb-2 text-blue-900">Interpretation</h3>
                    <p className="text-sm text-blue-800">{file.result.interpretation}</p>
                  </div>
                )}

                {/* Image: All Class Probabilities */}
                {fileType === 'image' && file.result.allProbabilities && (
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
                {/* Audio: Probability Distribution */}
                {fileType === 'audio' && file.result.allProbabilities && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">Probability Distribution</h3>
                    <div className="space-y-4">
                      {Object.entries(file.result.allProbabilities).map(([label, prob]) => (
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

                {/* Image: Face Image from Backend */}
                {fileType === 'image' && file.result.faceImage && (
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

                {/* Image: Feature Quality */}
                {fileType === 'image' && file.result.featureQuality && (
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
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderVideoDetailedView = () => {
    const file = files[selectedFileIndex];
    const result = file.result;
    const summary = getOverallSummary(result);
    const video = getVideoAnalysis(result);
    const audio = getAudioAnalysis(result);
    const frameDetails = video?.frame_details ?? [];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">

          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center rounded-t-2xl z-10">
            <h2 className="text-2xl font-bold text-gray-800">Video Analysis — {file.name}</h2>
            <button onClick={() => setSelectedFileIndex(null)} className="text-gray-500 hover:text-gray-700 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-6">

            {/* Row 1 — preview · overall verdict · audio */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Video Preview</h3>
                <div className="flex justify-center">
                  <video src={file.preview} controls className="max-w-full max-h-52 rounded-lg shadow-md" />
                </div>
                <div className="mt-2 text-sm text-gray-600 text-center space-y-1">
                  <p>{file.name}</p>
                  <p>{file.size} MB</p>
                </div>
              </div>
              <OverallSummarySection summary={summary} />
              <AudioSection audio={audio} />
            </div>

            {/* Row 2 — visual analysis */}
            {video && (
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Visual Analysis</h3>
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">

                  <div className="space-y-4">
                    <div className={`rounded-xl p-5 text-white ${gradientFor(video.is_fake)}`}>
                      <h4 className="font-semibold mb-3">Frame-level Detection</h4>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm opacity-90">Classification:</span>
                        <span className="text-xl font-bold">{video.prediction}</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-3 mb-2">
                        <div className="bg-white h-3 rounded-full" style={{ width: `${video.confidence}%` }} />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="opacity-90">Confidence:</span>
                        <span className="font-bold">{Number(video.confidence).toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="font-semibold text-gray-700 mb-3">Frame Statistics</h4>
                      <div className="space-y-2">
                        {[
                          ['Valid Frames',   video.valid_frames],
                          ['Total Frames',   video.total_frames],
                          ['Fake Frames',    video.statistics?.fake_frame_count],
                          ['Real Frames',    video.statistics?.real_frame_count],
                          ['Fake Ratio',     video.statistics?.fake_ratio      != null ? `${video.statistics.fake_ratio}%`           : null],
                          ['Avg Confidence', video.statistics?.avg_frame_confidence != null ? `${video.statistics.avg_frame_confidence}%` : null],
                        ].map(([label, val]) => val != null && (
                          <div key={label} className="flex justify-between text-sm">
                            <span className="text-gray-600">{label}:</span>
                            <span className="font-semibold text-gray-900">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {video.method_comparison && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-700 mb-3">Aggregation Methods</h4>
                        <div className="space-y-2">
                          {Object.entries(video.method_comparison).map(([method, info]) => (
                            <div key={method} className="flex justify-between text-sm bg-white rounded-lg px-3 py-2 shadow-sm">
                              <span className="text-gray-600 capitalize">{method}:</span>
                              <span className="font-semibold text-gray-800">
                                {info.class} ({Number(info.confidence).toFixed(1)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {video.statistics && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-700 mb-3">Prediction Distribution</h4>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={[
                            { name: 'Real', count: video.statistics.real_frame_count ?? 0 },
                            { name: 'Fake', count: video.statistics.fake_frame_count ?? 0 },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count">
                              <Cell fill="#10b981" />
                              <Cell fill="#ef4444" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {frameDetails.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-700 mb-3">Per-Frame Confidence</h4>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={frameDetails
                            .filter((f) => f.status === 'Success')
                            .map((f) => ({ frame: `F${f.frame_idx}`, confidence: Number(f.confidence ?? 0) }))
                          }>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="frame" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Bar dataKey="confidence" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {frameDetails.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-700 mb-3">Frame Details</h4>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {frameDetails.map((frame, idx) => (
                            <div key={idx} className="bg-white rounded-lg p-3 shadow-sm">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium text-gray-700">Frame {frame.frame_idx}</span>
                                {frame.status === 'Success' ? (
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                    frame.is_fake ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                                  }`}>
                                    {frame.prediction}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500">
                                    {frame.status}
                                  </span>
                                )}
                              </div>
                              {frame.status === 'Success' && (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${frame.is_fake ? "bg-red-500" : "bg-green-500"}`}
                                      style={{ width: `${frame.confidence ?? 0}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-semibold text-gray-600">
                                    {Number(frame.confidence ?? 0).toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================
  //    MAIN RENDER
  // ==========================
  return (
    <div className="min-h-screen flex flex-col bg-white">

      <div className="flex-1 bg-gradient-to-br from-blue-50 to-blue-100 py-8 px-4 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-blue-600 mb-2">
              Multi-Modal Deepfake Detector
            </h1>
            <p className="text-gray-600 text-sm">
              Upload images, audio, or video files to detect if they're real or AI-generated
            </p>
            {fileType && (
              <p className="text-blue-600 text-sm font-semibold mt-2">
                Current mode: {fileType === 'image' ? '🖼️ Images' : fileType === 'audio' ? '🎵 Audio' : '🎬 Videos'}
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50">
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center">
                  {fileType === 'audio' ? (
                    <svg className="w-14 h-14 text-blue-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  ) : fileType === 'video' ? (
                    <svg className="w-14 h-14 text-blue-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-14 h-14 text-blue-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                  <p className="text-lg font-semibold text-blue-600 mb-1">
                    Click to upload {fileType ? `${fileType}s` : 'files'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {fileType === 'audio' 
                      ? 'MP3, WAV, M4A, OGG up to 50MB'
                      : fileType === 'video'
                      ? 'MP4, AVI, MOV, MKV, WEBM up to 500MB'
                      : 'PNG, JPG, JPEG up to 10MB'} • Multiple files supported
                  </p>
                  {files.length > 0 && (
                    <p className="text-xs text-blue-500 mt-2">
                      Note: All files must be the same type
                    </p>
                  )}
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept={fileType === 'audio' ? 'audio/*' : fileType === 'video' ? 'video/*' : fileType === 'image' ? 'image/*' : 'image/*,audio/*,video/*'}
                  multiple
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {files.length > 0 && (
              <div className="flex gap-3 mt-6 flex-wrap">
                <button
                  onClick={handleUploadAll}
                  disabled={loading}
                  className="flex-1 min-w-48 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Analyzing..." : `Analyze ${files.length} ${fileType === 'image' ? 'Image' : fileType === 'audio' ? 'Audio' : 'Video'}${files.length > 1 ? 's' : ''}`}
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
                  <span className="text-sm font-medium text-blue-600">
                    Processing {fileType}s{fileType === 'video' ? ' (this may take a while)' : ''}...
                  </span>
                  <span className="text-sm font-semibold text-blue-600">
                    {uploadProgress}%
                  </span>
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
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0117 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="text-blue-700 font-semibold">🎙️ Reading results aloud...</span>
              </div>
            )}
          </div>

          {/* HORIZONTAL LAYOUT - File + Results in ONE LINE */}
          {files.length > 0 && (
            <div className="space-y-4">
              {files.map((file, index) => {
                const result = file.result;
                const fake = fileType === 'video' ? isOverallFake(result) : result ? getDisplayResult(result.prediction) === "Fake" : false;
                const pred = fileType === 'video' ? getOverallPrediction(result) : result ? getDisplayResult(result.prediction) : "Unknown";
                const conf = fileType === 'video' ? getOverallConfidence(result) : result ? result.confidence : 0;
                const summary = fileType === 'video' ? getOverallSummary(result) : null;
                const video = fileType === 'video' ? getVideoAnalysis(result) : null;
                const audio = fileType === 'video' ? getAudioAnalysis(result) : null;

                return (
                  <div 
                    key={index} 
                    className="bg-white rounded-xl shadow-lg p-4 flex items-center gap-6 hover:shadow-xl transition-shadow flex-wrap lg:flex-nowrap"
                  >
                    {/* File Preview - Left Side */}
                    <div className="relative flex-shrink-0">
                      {fileType === 'image' ? (
                        <img
                          src={file.preview}
                          alt={`Upload ${index + 1}`}
                          className="w-32 h-32 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-32 h-32 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex flex-col items-center justify-center">
                          <svg className="w-12 h-12 text-blue-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={fileType === 'audio' ? "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" : "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"} />
                          </svg>
                          <p className="text-xs font-semibold text-center text-gray-700 px-1">{file.duration}s</p>
                        </div>
                      )}
                      
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
                      {result ? (
                        result.analyzed ? (
                          <>
                            {/* Result Badge */}
                            <div className={`px-6 py-3 rounded-lg text-white font-bold text-lg whitespace-nowrap ${
                              fileType === 'video' 
                                ? gradientFor(fake)
                                : pred === "Real" 
                                ? "bg-gradient-to-r from-green-500 to-green-600" 
                                : "bg-gradient-to-r from-red-500 to-red-600"
                            }`}>
                              {pred}
                            </div>

                            {/* Confidence */}
                            <div className="flex items-center gap-3 flex-1 min-w-40">
                              <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Confidence:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-3">
                                <div
                                  className={`h-3 rounded-full transition-all duration-500 ${
                                    fake ? "bg-red-500" : "bg-green-500"
                                  }`}
                                  style={{ width: `${conf}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{typeof conf === 'number' ? conf.toFixed(1) : conf}%</span>
                            </div>

                            {/* Video-specific: Audio pill */}
                            {fileType === 'video' && audio && !audio.skipped && audio.success ? (
                              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                                audio.is_fake ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                              }`}>
                                🎵 {audio.prediction} {Number(audio.confidence).toFixed(0)}%
                              </div>
                            ) : fileType === 'video' ? (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 whitespace-nowrap">
                                🔇 No Audio
                              </div>
                            ) : null}

                            {/* Video-specific: Frame count */}
                            {fileType === 'video' && video?.valid_frames && (
                              <div className="text-sm text-gray-500 whitespace-nowrap">
                                {video.valid_frames} frames
                              </div>
                            )}

                            {/* Video-specific: Reliability badge */}
                            {fileType === 'video' && summary?.reliability && (
                              <div className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${
                                summary.reliability === 'High'   ? 'bg-green-100 text-green-700' :
                                summary.reliability === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-red-100 text-red-700'
                              }`}>
                                {summary.reliability} Reliability
                              </div>
                            )}

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
                            <p className="text-red-700 text-xs mt-1">{result.message}</p>
                          </div>
                        )
                      ) : (
                        <div className="text-gray-500 text-sm">
                          {loading ? "Processing..." : "Ready to analyze"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {files.length > 0 && (
            <div className="mt-6 text-center text-xs text-gray-500">
              <p>{files.length} {fileType}{files.length > 1 ? 's' : ''} uploaded • Powered by AI • Secure & Private • Voice: {voiceEnabled ? 'ON 🔊' : 'OFF 🔇'}</p>
            </div>
          )}
        </div>
      </div>

      {renderDetailedView()}
      {/* <Chatbot /> */}
    </div>
  );
}

export default Upload;