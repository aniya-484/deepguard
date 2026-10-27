import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigateToSection = (sectionId) => {
    setIsOpen(false);
    
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleDetectionNavigate = (path) => {
    navigate(path);
    setShowDropdown(false);
    setIsOpen(false);
  };

  return (
    <nav className="bg-white shadow-lg fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <motion.div 
            className="flex items-center"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-2xl">DG</span>
              </div>
              <span className="text-2xl font-bold text-blue-600">DeepGuard</span>
            </Link>
          </motion.div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <button 
              onClick={() => handleNavigateToSection('home')}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors text-base"
            >
              Home
            </button>
            <button 
              onClick={() => handleNavigateToSection('features')}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors text-base"
            >
              Features
            </button>
            <button 
              onClick={() => handleNavigateToSection('how-it-works')}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors text-base"
            >
              How It Works
            </button>
            <button 
              onClick={() => handleNavigateToSection('about')}
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors text-base"
            >
              About
            </button>
            
            {/* Dropdown Button */}
            <div 
              className="relative"
              onMouseEnter={() => setShowDropdown(true)}
              onMouseLeave={() => setShowDropdown(false)}
            >
              <button 
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-all duration-300 font-semibold shadow-md hover:shadow-lg flex items-center gap-2"
              >
                Start Detection
                <svg 
                  className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full mt-2 right-0 w-64 bg-white rounded-lg shadow-xl border border-gray-100 py-2 overflow-hidden"
                  >
                    <button
                      onClick={() => handleDetectionNavigate('/upload/image')}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">Image Detection</div>
                        <div className="text-xs text-gray-500">Analyze image authenticity</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleDetectionNavigate('/upload/audio')}
                      className="w-full px-4 py-3 text-left hover:bg-purple-50 transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 group-hover:text-purple-600 transition-colors">Audio Detection</div>
                        <div className="text-xs text-gray-500">Verify audio authenticity</div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleDetectionNavigate('/upload/video')}
                      className="w-full px-4 py-3 text-left hover:bg-green-50 transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 group-hover:text-green-600 transition-colors">Video Detection</div>
                        <div className="text-xs text-gray-500">Detect video deepfakes</div>
                      </div>
                    </button>

                    <div className="h-px bg-gray-200 my-1"></div>

                    <button
                      onClick={() => handleDetectionNavigate('/upload')}
                      className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center group-hover:from-blue-200 group-hover:to-purple-200 transition-colors">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">Multi-Modal Detection</div>
                        <div className="text-xs text-gray-500">Image + Audio detection</div>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 hover:text-blue-600 focus:outline-none p-2"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <motion.div 
            className="md:hidden pb-4 pt-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button 
              onClick={() => handleNavigateToSection('home')}
              className="block w-full text-left py-2.5 text-gray-700 hover:text-blue-600 font-medium"
            >
              Home
            </button>
            
            <button 
              onClick={() => handleNavigateToSection('features')}
              className="block w-full text-left py-2.5 text-gray-700 hover:text-blue-600 font-medium"
            >
              Features
            </button>
            <button 
              onClick={() => handleNavigateToSection('how-it-works')}
              className="block w-full text-left py-2.5 text-gray-700 hover:text-blue-600 font-medium"
            >
              How It Works
            </button>
            <button 
              onClick={() => handleNavigateToSection('about')}
              className="block w-full text-left py-2.5 text-gray-700 hover:text-blue-600 font-medium"
            >
              About
            </button>
            
            {/* Mobile Dropdown Options */}
            <div className="mt-3 space-y-2">
              <button 
                onClick={() => handleDetectionNavigate('/upload/image')}
                className="block w-full bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-center"
              >
                🖼️ Image Detection
              </button>
              <button 
                onClick={() => handleDetectionNavigate('/upload/audio')}
                className="block w-full bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-colors font-semibold text-center"
              >
                🎵 Audio Detection
              </button>
              <button 
                onClick={() => handleDetectionNavigate('/upload/video')}
                className="block w-full bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-semibold text-center"
              >
                🎬 Video Detection
              </button>
              <button 
                onClick={() => handleDetectionNavigate('/upload')}
                className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-semibold text-center"
              >
                🔬 Multi-Modal Detection
              </button>
              
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;