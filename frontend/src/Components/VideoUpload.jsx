import { useState, useEffect } from "react";
import Chatbot from "./Chatbot";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function VideoUpload() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // ── Backend response accessors ─────────────────────────────────────────────
  // Backend shape: { overall_summary, video_analysis, audio_analysis, ... }

  const getOverallSummary  = (result) => result?.overall_summary ?? null;
  const getVideoAnalysis   = (result) => result?.video_analysis  ?? null;
  const getAudioAnalysis   = (result) => result?.audio_analysis  ?? null;

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

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      files.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
    };
  }, []);

  useEffect(() => {
    if (!loading && files.length > 0 && voiceEnabled) {
      const allProcessed = files.every((f) => f.result !== null);
      if (allProcessed) {
        const timer = setTimeout(speakAllResults, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, files, voiceEnabled]);

  // ── Speech ─────────────────────────────────────────────────────────────────
  const speakAllResults = () => {
    if (!voiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(generateSummaryText());
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => { window.speechSynthesis.cancel(); setIsSpeaking(false); };
  const toggleVoice  = () => { if (isSpeaking) stopSpeaking(); setVoiceEnabled((v) => !v); };

  const generateSummaryText = () => {
    const allProcessed = files.filter((f) => f.result !== null);
    if (!allProcessed.length) return "";
    
    const analyzed = allProcessed.filter(f => f.result.analyzed !== false);
    const notEvaluated = allProcessed.filter(f => f.result.analyzed === false);
    
    let text = `Video analysis complete. `;
    
    if (analyzed.length > 0) {
      text += `${analyzed.length} video${analyzed.length > 1 ? 's' : ''} processed. `;
      const fakeCount = analyzed.filter((f) => isOverallFake(f.result)).length;
      const realCount = analyzed.length - fakeCount;
      if (fakeCount) text += `Warning: ${fakeCount} deepfake${fakeCount > 1 ? 's' : ''} detected. `;
      if (realCount) text += `${realCount} authentic video${realCount > 1 ? 's' : ''} verified. `;
      analyzed.forEach((f, i) => {
        const pred  = getOverallPrediction(f.result);
        const conf  = getOverallConfidence(f.result);
        const audio = getAudioAnalysis(f.result);
        const vf    = getVideoAnalysis(f.result)?.valid_frames;
        text += `Video ${i + 1}: ${pred} with ${conf.toFixed(0)}% confidence. `;
        if (audio?.success && !audio?.skipped)
          text += `Audio is ${audio.prediction} at ${Number(audio.confidence).toFixed(0)}% confidence. `;
        if (vf) text += `${vf} frames analyzed. `;
      });
    }
    
    if (notEvaluated.length > 0) {
      text += `${notEvaluated.length} video${notEvaluated.length > 1 ? 's' : ''} not evaluated. Face is not present in ${notEvaluated.length > 1 ? 'these videos' : 'this video'}. `;
    }
    
    return text;
  };

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    setFiles((prev) => [
      ...prev,
      ...selected.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2),
        result: null,
      })),
    ]);
    stopSpeaking();
  };

  const handleUploadAll = async () => {
    if (!files.length) { alert("Please select at least one video first"); return; }
    setLoading(true);
    setUploadProgress(0);
    stopSpeaking();
    let processed = 0;
    for (let i = 0; i < files.length; i++) {
      if (files[i].result) continue;
      try {
        const formData = new FormData();
        formData.append("file", files[i].file);
        const res = await fetch('http://127.0.0.1:8000/predict/video', { method: "POST", body: formData });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log('Backend response:', data);
        setFiles((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], result: data };
          return updated;
        });
        processed++;
        setUploadProgress(Math.round((processed / files.length) * 100));
      } catch (err) {
        console.error(`Error on file ${i + 1}:`, err);
        alert(`Error processing file ${i + 1}. Please try again.`);
      }
    }
    setLoading(false);
  };

  const handleRemoveFile = (index) => {
    URL.revokeObjectURL(files[index].preview);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (selectedFileIndex === index) setSelectedFileIndex(null);
  };

  const handleReset = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setUploadProgress(0);
    setSelectedFileIndex(null);
    stopSpeaking();
  };

  // ── Colour helpers ─────────────────────────────────────────────────────────
  const gradientFor = (fake) =>
    fake ? "bg-gradient-to-r from-red-600 to-red-700" : "bg-gradient-to-r from-green-600 to-green-700";
  const barColorFor = (fake) => fake ? "bg-red-500" : "bg-green-500";

  // ── Audio card ─────────────────────────────────────────────────────────────
  const AudioSection = ({ audio }) => {
    if (!audio) return null;

    if (audio.skipped || !audio.success) {
      return (
        <div className="bg-gray-50 rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-2 text-gray-700 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
            Audio Analysis
          </h3>
          <p className="text-sm text-gray-500 italic">{audio.reason ?? audio.error ?? "Audio analysis unavailable."}</p>
        </div>
      );
    }

    return (
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12M9.172 16.828A4 4 0 016 13.657V10.343a4 4 0 012.828-3.172" />
          </svg>
          Audio Analysis
        </h3>

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
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className={`h-1.5 rounded-full ${label === "Real" ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between bg-white rounded-lg px-3 py-2 shadow-sm">
            <span className="text-gray-500">Confidence Level</span>
            <span className="font-semibold text-gray-800">{audio.confidence_level}</span>
          </div>
          <div className="flex justify-between bg-white rounded-lg px-3 py-2 shadow-sm">
            <span className="text-gray-500">Raw Score</span>
            <span className="font-semibold text-gray-800">{audio.raw_score}</span>
          </div>
        </div>

        {audio.interpretation && (
          <p className="text-xs text-gray-500 italic bg-white rounded-lg px-3 py-2 shadow-sm">
            💬 {audio.interpretation}
          </p>
        )}
      </div>
    );
  };

  // ── Overall summary card ───────────────────────────────────────────────────
  const OverallSummarySection = ({ summary }) => {
    if (!summary) return null;
    return (
      <div className={`rounded-xl p-5 text-white ${gradientFor(summary.is_fake)}`}>
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          Overall Verdict
        </h3>

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

  // ── Detail modal ───────────────────────────────────────────────────────────
  const renderDetailedView = () => {
    if (selectedFileIndex === null || !files[selectedFileIndex]?.result) return null;
    const file         = files[selectedFileIndex];
    const result       = file.result;
    const summary      = getOverallSummary(result);
    const video        = getVideoAnalysis(result);
    const audio        = getAudioAnalysis(result);
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

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 bg-gradient-to-br from-blue-50 to-blue-100 py-16 px-4 overflow-y-auto">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-blue-600 mb-2">Video Deepfake Detector</h1>
            <p className="text-gray-600 text-sm">Upload videos to detect visual &amp; audio deepfakes using AI</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-blue-50">
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center">
                  <svg className="w-14 h-14 text-blue-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-lg font-semibold text-blue-600 mb-1">Click to upload videos</p>
                  <p className="text-sm text-gray-500">MP4, AVI, MOV, MKV, WEBM · Multiple files supported</p>
                </div>
                <input id="file-upload" type="file" className="hidden" accept="video/*" multiple onChange={handleFileChange} />
              </label>
            </div>

            {files.length > 0 && (
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleUploadAll}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Analyzing..." : `Analyze ${files.length} Video${files.length > 1 ? 's' : ''}`}
                </button>

                <button
                  onClick={toggleVoice}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${voiceEnabled ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
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

                {isSpeaking && (
                  <button onClick={stopSpeaking} className="px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all animate-pulse">
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
                  <span className="text-sm font-medium text-blue-600">Processing videos… This may take a while.</span>
                  <span className="text-sm font-semibold text-blue-600">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {isSpeaking && (
              <div className="mt-4 bg-blue-100 rounded-lg p-4 flex items-center space-x-3">
                <svg className="w-6 h-6 text-blue-600 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="text-blue-700 font-semibold">🎙️ Reading results aloud…</span>
              </div>
            )}
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-4">
              {files.map((file, index) => {
                const result  = file.result;
                const summary = getOverallSummary(result);
                const audio   = getAudioAnalysis(result);
                const video   = getVideoAnalysis(result);
                const fake    = isOverallFake(result);
                const pred    = getOverallPrediction(result);
                const conf    = getOverallConfidence(result);

                return (
                  <div key={index} className="bg-white rounded-xl shadow-lg p-4 flex items-center gap-6 hover:shadow-xl transition-shadow">

                    <div className="relative flex-shrink-0">
                      <video src={file.preview} className="w-32 h-32 object-cover rounded-lg" muted />
                      <button
                        onClick={() => handleRemoveFile(index)}
                        disabled={loading}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 flex items-center gap-4 flex-wrap">
                      {result ? (
                        result.analyzed !== false ? (
                          <>
                          {/* Overall verdict badge */}
                          <div className={`px-5 py-2.5 rounded-lg text-white font-bold text-lg whitespace-nowrap ${gradientFor(fake)}`}>
                            {pred}
                          </div>

                          {/* Confidence bar */}
                          <div className="flex items-center gap-3 flex-1 min-w-40">
                            <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Confidence:</span>
                            <div className="flex-1 bg-gray-200 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full transition-all duration-500 ${barColorFor(fake)}`}
                                style={{ width: `${conf}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{conf.toFixed(1)}%</span>
                          </div>

                          {/* Audio pill */}
                          {audio && !audio.skipped && audio.success ? (
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                              audio.is_fake ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                            }`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6v12M9.172 16.828A4 4 0 016 13.657V10.343a4 4 0 012.828-3.172" />
                              </svg>
                              Audio: {audio.prediction} {Number(audio.confidence).toFixed(0)}%
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 whitespace-nowrap">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                              </svg>
                              No Audio
                            </div>
                          )}

                          {/* Frame count */}
                          <div className="text-sm text-gray-500 whitespace-nowrap">
                            {video?.valid_frames ?? 0} frames
                          </div>

                          {/* Reliability badge */}
                          {summary?.reliability && (
                            <div className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ${
                              summary.reliability === 'High'   ? 'bg-green-100 text-green-700' :
                              summary.reliability === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                  'bg-red-100 text-red-700'
                            }`}>
                              {summary.reliability} Reliability
                            </div>
                          )}

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
                          {loading ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                              </svg>
                              Processing…
                            </span>
                          ) : "Ready to analyze"}
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
              <p>{files.length} video{files.length > 1 ? 's' : ''} uploaded · Visual + Audio AI · Secure &amp; Private · Voice: {voiceEnabled ? 'ON 🔊' : 'OFF 🔇'}</p>
            </div>
          )}
        </div>
      </div>

      {renderDetailedView()}
      {/* <Chatbot /> */}
    </div>
  );
}

export default VideoUpload;