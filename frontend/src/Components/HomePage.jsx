import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import Chatbot from './Chatbot';

function HomePage() {
  return (
    <div className="min-h-screen bg-white  overflow-x-hidden w-full">

      {/* Hero Section */}
      <section id="home" className="bg-gradient-to-br from-blue-50 to-blue-100 py-20 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                Detect Deepfakes with
                <span className="text-blue-600"> AI Precision</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Advanced multimodal AI technology to identify manipulated images and protect digital authenticity. Safeguard your content in seconds.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  to="/upload"
                  className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-center"
                >
                  Try Detection Tool
                </Link>
                <a href="#how-it-works" className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-center">
                  Learn More
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <img 
                src="https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80" 
                alt="AI Detection" 
                className="rounded-2xl shadow-2xl w-full"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Powerful Features</h2>
            <p className="text-xl text-gray-600">Advanced technology to keep you protected</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "🔍",
                title: "Deep Analysis",
                description: "Multi-layer neural network analysis to detect even the most sophisticated deepfakes",
                delay: 0
              },
              {
                icon: "⚡",
                title: "Lightning Fast",
                description: "Get results in seconds with our optimized AI models and infrastructure",
                delay: 0.1
              },
              {
                icon: "🎯",
                title: "High Accuracy",
                description: "High detection accuracy across various deepfake generation techniques",
                delay: 0.2
              },
              {
                icon: "🔒",
                title: "Secure & Private",
                description: "Your images are processed securely and never stored on our servers",
                delay: 0.3
              },
              {
                icon: "🌐",
                title: "Multimodal Detection",
                description: "Analyze images, videos, and audio for comprehensive deepfake detection",
                delay: 0.4
              },
              {
                icon: "📊",
                title: "Detailed Reports",
                description: "Get confidence scores and detailed analysis of manipulation indicators",
                delay: 0.5
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: feature.delay }}
                viewport={{ once: true }}
                className="bg-blue-50 p-8 rounded-xl hover:shadow-lg transition-shadow"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-gradient-to-br from-blue-50 to-blue-100 scroll-mt-20">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="text-center mb-16"
    >
      <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
      <p className="text-xl text-gray-600">Simple, fast, and accurate detection in 3 steps</p>
    </motion.div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {[
        {
          step: "1",
          title: "Upload Media File",
          description: "Select and upload the Media file (image or audio) you want to analyze for deepfake manipulation",
          image: "https://images.unsplash.com/photo-1633265486064-086b219458ec?w=400&q=80"
        },
        {
          step: "2",
          title: "AI Analysis",
          description: "Our advanced AI models analyze the file using multiple detection algorithms",
          image: "https://images.unsplash.com/photo-1555255707-c07966088b7b?w=400&q=80"
        },
        {
          step: "3",
          title: "Get Results",
          description: "Receive detailed results with confidence scores and manipulation indicators",
          image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80"
        }
      ].map((item, index) => (
        <Link to="/upload" key={index}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.2 }}
            viewport={{ once: true }}
            className="bg-white hover:bg-gradient-to-br hover:from-blue-600 hover:to-blue-700 p-8 rounded-xl shadow-lg cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-300 group"
          >
            <div className="w-16 h-16 bg-blue-600 group-hover:bg-white text-white group-hover:text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mb-6 mx-auto transition-all duration-300">
              {item.step}
            </div>
            <img src={item.image} alt={item.title} className="w-full h-48 object-cover rounded-lg mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 group-hover:text-white mb-3 text-center transition-colors duration-300">{item.title}</h3>
            <p className="text-gray-600 group-hover:text-white text-center transition-colors duration-300">{item.description}</p>
          </motion.div>
        </Link>
      ))}
    </div>
  </div>
</section>

      {/* Statistics Section */}
      

      {/* About Section */}
      <section id="about" className="py-20 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <img 
                src="https://images.unsplash.com/photo-1639322537228-f710d846310a?w=800&q=80" 
                alt="About DeepGuard" 
                className="rounded-2xl shadow-2xl w-full"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-bold text-gray-900 mb-6">About DeepGuard</h2>
              <p className="text-lg text-gray-600 mb-6">
                DeepGuard is a cutting-edge deepfake detection platform powered by advanced artificial intelligence and machine learning algorithms. Our mission is to protect digital authenticity and combat the spread of manipulated media.
              </p>
              <p className="text-lg text-gray-600 mb-6">
                With the rise of sophisticated deepfake technology, distinguishing real from fake has become increasingly challenging. Our multimodal AI system analyzes images at multiple levels, detecting subtle artifacts and inconsistencies that indicate manipulation.
              </p>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <div>
                    <h4 className="font-semibold text-gray-900">Research-Backed Technology</h4>
                    <p className="text-gray-600">Built on the latest academic research in deepfake detection</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <div>
                    <h4 className="font-semibold text-gray-900">Continuously Updated</h4>
                    <p className="text-gray-600">Regular updates to detect new deepfake generation methods</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <div>
                    <h4 className="font-semibold text-gray-900">User Privacy First</h4>
                    <p className="text-gray-600">We never store your images or share your data</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">Ready to Detect Deepfakes?</h2>
            <p className="text-xl text-blue-100 mb-8">
              Start protecting your digital content today with our advanced AI detection technology
            </p>
            <Link 
              to="/upload"
              className="inline-block bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-lg shadow-lg"
            >
              Try Detection Tool Now
            </Link>
          </motion.div>
        </div>
      </section>


    </div>
  );
}

export default HomePage;