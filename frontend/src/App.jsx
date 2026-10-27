import { Routes, Route } from 'react-router-dom';
import HomePage from './Components/HomePage';
import Upload from './Components/Upload';
import ImageUpload from './Components/ImageUpload';
import AudioUpload from './Components/AudioUpload';
import VideoUpload from './Components/VideoUpload';
import Navbar from './Components/Navbar';
import Footer from './Components/Footer';
import Chatbot from './Components/Chatbot';

function App() {
  return (
    <>
      <div className="flex flex-col min-h-screen" style={{ isolation: 'isolate' }}>
        <Navbar />
        <main className="flex-grow pt-20">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/upload/image" element={<ImageUpload />} />
            <Route path="/upload/audio" element={<AudioUpload />} />
            <Route path="/upload/video" element={<VideoUpload />} />

          </Routes>
        </main>
        <Footer />
      </div>
      {/* <Chatbot /> */}
    </>
  );
}

export default App;