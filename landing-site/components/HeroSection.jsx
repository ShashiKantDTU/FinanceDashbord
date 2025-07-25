import Link from 'next/link';
import Image from 'next/image';

export default function HeroSection() {
  const statsData = [
    { number: "100+", label: "Happy Contractors", icon: "👥" },
    { number: "2 Min", label: "Quick Setup", icon: "⚡" },
    { number: "₹10/Day", label: "Cost Per Site", icon: "💰" }
  ];

  return (
    <section className="relative bg-white min-h-screen flex items-center overflow-hidden py-12">
      {/* Simple Background Elements */}
      <div className="absolute top-32 right-20 w-48 h-48 bg-blue-50 rounded-full opacity-60"></div>
      <div className="absolute bottom-32 left-20 w-48 h-48 bg-orange-50 rounded-full opacity-60"></div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="text-left order-2 lg:order-1">
            <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold mb-6">
              🇮🇳 Made in India for Indian Contractors
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Site Haazri –<br />
              <span className="text-blue-600">Aapke Site ka Smart Manager</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Attendance, Daily Reports aur Site Ka Poora Record – Sab kuch ek hi app mein.
            </p>

            <div className="space-y-6 mb-10">
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="#demo"
                  className="inline-flex items-center justify-center bg-orange-600 text-white px-10 py-4 rounded-xl font-bold hover:bg-orange-700 transition-colors text-lg shadow-lg"
                >
                  <span className="mr-2">📲</span>
                  App Install Karein
                </Link>

                <Link
                  href="#demo"
                  className="inline-flex items-center justify-center border-2 border-gray-300 text-gray-700 px-10 py-4 rounded-xl font-semibold hover:bg-gray-50 hover:border-blue-400 hover:text-blue-600 transition-all duration-200 text-lg"
                >
                  Demo Dekhein →
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <span className="text-green-500 mr-2">✅</span>
                  Free trial available
                </div>
                <div className="flex items-center">
                  <span className="text-blue-500 mr-2">📞</span>
                  Hindi support
                </div>
                <div className="flex items-center">
                  <span className="text-purple-500 mr-2">🔒</span>
                  Secure & safe
                </div>
              </div>
            </div>

            {/* Simple Stats */}
            <div className="grid grid-cols-3 gap-4">
              {statsData.map((stat, index) => (
                <div key={index} className="text-center bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-bold text-gray-900">{stat.number}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Multi-Device Preview */}
          <div className="flex justify-center lg:justify-end order-1 lg:order-2 mb-8 lg:mb-0">
            <div className="relative w-full max-w-2xl mx-auto">
              {/* Multi-Device Container */}
              <div className="relative h-[500px] w-full">

                {/* Laptop/Desktop - Back Left */}
                <div className="absolute top-0 left-0 w-96 h-60 bg-gradient-to-b from-gray-800 to-gray-900 rounded-lg shadow-2xl transform -rotate-2 z-10">
                  {/* Laptop Screen */}
                  <div className="w-full h-full bg-white rounded-lg overflow-hidden relative p-3">
                    <div className="w-full h-full rounded overflow-hidden bg-gray-50 relative">
                      <Image
                        src="/images/desktopimage.png"
                        alt="Site Haazri Desktop Dashboard"
                        fill
                        className="object-contain"
                        style={{ imageRendering: 'crisp-edges' }}
                        priority
                        quality={90}
                        sizes="(max-width: 768px) 100vw, 384px"
                      />
                    </div>
                  </div>
                  {/* Laptop Base */}
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-24 h-3 bg-gray-700 rounded-b-lg"></div>
                </div>

                {/* Tablet - Middle */}
                <div className="absolute top-16 left-1/2 transform -translate-x-1/2 w-56 h-72 bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl shadow-xl z-20">
                  {/* Tablet Screen */}
                  <div className="w-full h-full bg-white rounded-2xl overflow-hidden relative p-3">
                    <div className="w-full h-full rounded-xl overflow-hidden bg-gray-50 relative">
                      <Image
                        src="/images/tablet.PNG"
                        alt="Site Haazri Tablet Interface"
                        fill
                        className="object-contain"
                        style={{ imageRendering: 'crisp-edges' }}
                        quality={85}
                        sizes="(max-width: 768px) 100vw, 224px"
                      />
                    </div>
                  </div>
                  {/* Tablet Home Button */}
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-gray-800 rounded-full"></div>
                </div>

                {/* Mobile Phone - Front Right */}
                <div className="absolute top-8 right-0 w-48 h-80 bg-gradient-to-b from-gray-900 to-gray-800 rounded-[2rem] shadow-2xl z-30">
                  {/* Phone Screen */}
                  <div className="w-full h-full bg-white rounded-[2rem] overflow-hidden relative p-4">
                    <div className="w-full h-full rounded-2xl overflow-hidden bg-gray-50 relative">
                      <Image
                        src="/images/mobile.jpg"
                        alt="Site Haazri Mobile App"
                        fill
                        className="object-contain"
                        style={{ imageRendering: 'crisp-edges' }}
                        quality={85}
                        sizes="(max-width: 768px) 100vw, 192px"
                      />
                    </div>
                  </div>
                  {/* Phone Notch */}
                  <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-gray-900 rounded-full"></div>
                </div>

                {/* Platform Labels */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-6 bg-white px-6 py-3 rounded-full shadow-lg border border-green-200">
                  <div className="flex items-center text-sm font-medium text-gray-700">
                    <span className="mr-1">💻</span>
                    Desktop
                  </div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div className="flex items-center text-sm font-medium text-gray-700">
                    <span className="mr-1">📱</span>
                    Tablet
                  </div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div className="flex items-center text-sm font-medium text-gray-700">
                    <span className="mr-1">📱</span>
                    Mobile
                  </div>
                </div>
              </div>

              {/* Static Decorative Elements */}
              <div className="absolute -top-6 -left-6 w-10 h-10 opacity-60 z-5">
                <img
                  src="/images/LoginPageLogo.png"
                  alt="Site Haazri Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 text-2xl opacity-60 z-5">🧱</div>
              <div className="absolute top-1/3 -left-8 text-2xl opacity-60 z-5">⛑️</div>

              {/* Feature Cards */}
              <div className="absolute -right-20 top-12 bg-white p-3 rounded-lg shadow-lg border border-green-200 hover:shadow-xl transition-shadow duration-200 hidden xl:block z-35">
                <div className="text-sm font-medium text-gray-900">🌐 Responsive Design</div>
                <div className="text-xs text-green-600 mt-1 font-medium">All Devices Supported</div>
              </div>

              <div className="absolute -left-16 bottom-16 bg-white p-3 rounded-lg shadow-lg border border-green-200 hover:shadow-xl transition-shadow duration-200 hidden lg:block z-35">
                <div className="text-sm font-medium text-gray-900">🔄 Real-time Sync</div>
                <div className="text-xs text-green-600 mt-1 font-medium">Cross-platform Data</div>
              </div>

              <div className="absolute -right-4 bottom-24 bg-green-500 text-white p-2 rounded-lg shadow-lg hidden lg:block z-35">
                <div className="text-xs font-medium">Hindi Interface</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}