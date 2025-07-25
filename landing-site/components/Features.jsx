export default function Features() {
  const features = [
    {
      title: "Daily Attendance Marking",
      description: "Manual register ka jhanjhat khatam – supervisor phone se mark karega, aap live dekh sakte hain.",
      icon: "📋",
      iconBg: "bg-gradient-to-br from-blue-100 to-blue-200",
      iconColor: "text-blue-600",
      category: "Core",
      highlight: true,
      benefit: "Save 2 hours daily",
      gradient: "from-blue-50 to-blue-100"
    },
    {
      title: "Supervisor Access Control", 
      description: "Supervisor ko sirf data entry ka access – edit ya delete nahi kar sakta, security guaranteed.",
      icon: "🔒",
      iconBg: "bg-gradient-to-br from-purple-100 to-purple-200",
      iconColor: "text-purple-600",
      category: "Security",
      highlight: false,
      benefit: "100% Data Safety",
      gradient: "from-purple-50 to-purple-100"
    },
    {
      title: "Monthly Report Generation",
      description: "Har mahine automatic PDF report ready – attendance, payment, sab kuch ek click mein.", 
      icon: "📊",
      iconBg: "bg-gradient-to-br from-green-100 to-green-200",
      iconColor: "text-green-600",
      category: "Reports",
      highlight: true,
      benefit: "1-Click Reports",
      gradient: "from-green-50 to-green-100"
    },
    {
      title: "Labour Payment Calculator",
      description: "Attendance ke basis par automatic payment calculation – manual math ki zarurat nahi.",
      icon: "💰",
      iconBg: "bg-gradient-to-br from-yellow-100 to-yellow-200",
      iconColor: "text-yellow-600",
      category: "Finance",
      highlight: true,
      benefit: "Zero Math Errors",
      gradient: "from-yellow-50 to-yellow-100"
    },
    {
      title: "Data History & Backup",
      description: "Purane records safe rahenge cloud mein – kabhi bhi access kar sakte hain.",
      icon: "☁️",
      iconBg: "bg-gradient-to-br from-indigo-100 to-indigo-200",
      iconColor: "text-indigo-600",
      category: "Storage",
      highlight: false,
      benefit: "Lifetime Backup",
      gradient: "from-indigo-50 to-indigo-100"
    },
    {
      title: "Export & Share Reports",
      description: "Reports ko PDF mein download karein ya WhatsApp se share karein – bilkul simple.",
      icon: "📤",
      iconBg: "bg-gradient-to-br from-teal-100 to-teal-200",
      iconColor: "text-teal-600",
      category: "Sharing",
      highlight: false,
      benefit: "Instant Sharing",
      gradient: "from-teal-50 to-teal-100"
    },
    {
      title: "Secure Data Storage",
      description: "Bank-level security – aapka data safe aur private rahega hamesha.",
      icon: "🛡️",
      iconBg: "bg-gradient-to-br from-red-100 to-red-200",
      iconColor: "text-red-600",
      category: "Security",
      highlight: false,
      benefit: "Bank-Level Security",
      gradient: "from-red-50 to-red-100"
    },
    {
      title: "Multi-Site Management",
      description: "Ek account mein multiple sites manage karein – har site ka alag record.",
      icon: "🏗️",
      iconBg: "bg-gradient-to-br from-orange-100 to-orange-200",
      iconColor: "text-orange-600",
      category: "Management",
      highlight: false,
      benefit: "Unlimited Sites",
      gradient: "from-orange-50 to-orange-100"
    }
  ];

  return (
    <section className="py-32 bg-gradient-to-b from-white via-gray-50/30 to-white relative overflow-hidden">
      {/* Advanced Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-96 h-96 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse delay-2000"></div>
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-32 left-1/4 w-4 h-4 bg-blue-400 rounded-full opacity-20 animate-bounce delay-300"></div>
        <div className="absolute top-48 right-1/3 w-3 h-3 bg-orange-400 rounded-full opacity-20 animate-bounce delay-700"></div>
        <div className="absolute bottom-32 left-1/3 w-5 h-5 bg-green-400 rounded-full opacity-20 animate-bounce delay-1000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Enhanced Section Header */}
        <div className="text-center mb-24">
          <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 rounded-full text-sm font-bold mb-8 shadow-lg">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 animate-pulse"></span>
            📱 Complete Digital Toolkit
            <span className="w-2 h-2 bg-blue-500 rounded-full ml-3 animate-pulse"></span>
          </div>
          <h2 className="text-6xl md:text-7xl font-black bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent mb-10 leading-tight">
            Contractor ka<br />
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
              Digital Toolkit
            </span>
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full mb-8"></div>
          <p className="text-2xl md:text-3xl text-gray-600 max-w-5xl mx-auto leading-relaxed font-light">
            Attendance se lekar monthly report tak,<br />
            <span className="font-semibold text-gray-800">har kaam ek hi jagah pe.</span>
          </p>
        </div>
        
        {/* Ultra-Modern Features Grid */}
        <div className="mb-24">
          {/* Desktop: Enhanced 4x2 Grid */}
          <div className="hidden md:grid md:grid-cols-4 gap-10 mb-12">
            {features.slice(0, 4).map((feature, index) => (
              <div key={index} className={`group relative bg-gradient-to-br ${feature.gradient} backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-3xl transition-all duration-700 border border-white/50 transform hover:-translate-y-6 hover:rotate-1 ${feature.highlight ? 'ring-2 ring-blue-300 hover:ring-blue-400 shadow-blue-200/50' : ''}`}>
                {/* Highlight Badge */}
                {feature.highlight && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white px-5 py-2 rounded-full text-xs font-bold shadow-lg animate-pulse">
                      ⭐ Most Popular
                    </div>
                  </div>
                )}
                
                {/* Category & Benefit */}
                <div className="flex items-center justify-between mb-6">
                  <span className="px-3 py-1 bg-white/70 text-gray-700 text-xs rounded-full font-bold backdrop-blur-sm">
                    {feature.category}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-bold">
                    {feature.benefit}
                  </span>
                </div>

                {/* Icon Container */}
                <div className={`w-20 h-20 ${feature.iconBg} rounded-3xl flex items-center justify-center mb-8 group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 shadow-lg`}>
                  <span className={`text-3xl ${feature.iconColor} filter drop-shadow-sm`}>{feature.icon}</span>
                </div>

                {/* Content */}
                <h3 className="text-xl font-black text-gray-900 mb-5 leading-tight group-hover:text-blue-700 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-700 leading-relaxed text-sm font-medium mb-6">{feature.description}</p>
                
                {/* Feature Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-blue-700 font-bold">
                    <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-2 animate-pulse"></div>
                    Ready to Use
                  </div>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <span className="text-blue-600 text-sm">→</span>
                  </div>
                </div>

                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-purple-400/0 to-blue-400/0 group-hover:from-blue-400/10 group-hover:via-purple-400/10 group-hover:to-blue-400/10 rounded-3xl transition-all duration-700"></div>
              </div>
            ))}
          </div>
          
          <div className="hidden md:grid md:grid-cols-4 gap-10">
            {features.slice(4, 8).map((feature, index) => (
              <div key={index + 4} className={`group relative bg-gradient-to-br ${feature.gradient} backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-3xl transition-all duration-700 border border-white/50 transform hover:-translate-y-6 hover:rotate-1 ${feature.highlight ? 'ring-2 ring-blue-300 hover:ring-blue-400 shadow-blue-200/50' : ''}`}>
                {/* Highlight Badge */}
                {feature.highlight && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white px-5 py-2 rounded-full text-xs font-bold shadow-lg animate-pulse">
                      ⭐ Most Popular
                    </div>
                  </div>
                )}
                
                {/* Category & Benefit */}
                <div className="flex items-center justify-between mb-6">
                  <span className="px-3 py-1 bg-white/70 text-gray-700 text-xs rounded-full font-bold backdrop-blur-sm">
                    {feature.category}
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-bold">
                    {feature.benefit}
                  </span>
                </div>

                {/* Icon Container */}
                <div className={`w-20 h-20 ${feature.iconBg} rounded-3xl flex items-center justify-center mb-8 group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 shadow-lg`}>
                  <span className={`text-3xl ${feature.iconColor} filter drop-shadow-sm`}>{feature.icon}</span>
                </div>

                {/* Content */}
                <h3 className="text-xl font-black text-gray-900 mb-5 leading-tight group-hover:text-blue-700 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-gray-700 leading-relaxed text-sm font-medium mb-6">{feature.description}</p>
                
                {/* Feature Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-blue-700 font-bold">
                    <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-2 animate-pulse"></div>
                    Ready to Use
                  </div>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <span className="text-blue-600 text-sm">→</span>
                  </div>
                </div>

                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-purple-400/0 to-blue-400/0 group-hover:from-blue-400/10 group-hover:via-purple-400/10 group-hover:to-blue-400/10 rounded-3xl transition-all duration-700"></div>
              </div>
            ))}
          </div>

          {/* Mobile: Enhanced Horizontal Scroll */}
          <div className="md:hidden">
            <div className="flex space-x-8 overflow-x-auto pb-8 scrollbar-hide px-4">
              {features.map((feature, index) => (
                <div key={index} className={`flex-shrink-0 w-80 bg-gradient-to-br ${feature.gradient} backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/50 ${feature.highlight ? 'ring-2 ring-blue-300 shadow-blue-200/50' : ''}`}>
                  {feature.highlight && (
                    <div className="mb-6">
                      <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg">
                        ⭐ Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-18 h-18 ${feature.iconBg} rounded-3xl flex items-center justify-center shadow-lg`}>
                      <span className={`text-3xl ${feature.iconColor}`}>{feature.icon}</span>
                    </div>
                    <div className="text-right">
                      <span className="block px-3 py-1 bg-white/70 text-gray-700 text-xs rounded-full font-bold mb-1">
                        {feature.category}
                      </span>
                      <span className="block px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-bold">
                        {feature.benefit}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-black text-gray-900 mb-4 leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-sm font-medium mb-6">{feature.description}</p>
                  
                  <div className="flex items-center text-sm text-blue-700 font-bold">
                    <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-2 animate-pulse"></div>
                    Ready to Use
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ultra-Modern Trust Strip */}
        <div className="mb-20">
          <div className="relative">
            {/* Main Container */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-900 via-indigo-900 to-slate-900 text-white py-20 px-16 rounded-3xl shadow-3xl relative overflow-hidden border border-blue-800/30">
              {/* Animated Background Elements */}
              <div className="absolute inset-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full -translate-y-32 translate-x-32 animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-cyan-400/20 to-blue-400/20 rounded-full translate-y-24 -translate-x-24 animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full animate-pulse delay-2000"></div>
              </div>
              
              {/* Grid Pattern Overlay */}
              <div className="absolute inset-0 opacity-5">
                <div className="w-full h-full" style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
                  backgroundSize: '20px 20px'
                }}></div>
              </div>

              <div className="relative z-10 text-center">
                {/* Icon with Glow */}
                <div className="relative inline-block mb-8">
                  <div className="text-7xl filter drop-shadow-2xl">🏗️</div>
                  <div className="absolute inset-0 text-7xl blur-xl opacity-50">🏗️</div>
                </div>

                {/* Main Quote */}
                <h3 className="text-4xl md:text-5xl font-black leading-tight mb-6 bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                  "Ye sirf attendance app nahi hai –"
                </h3>
                <h3 className="text-4xl md:text-5xl font-black leading-tight mb-8">
                  <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">
                    ye ek full site management tool hai."
                  </span>
                </h3>

                {/* Subtitle */}
                <p className="text-2xl text-blue-100 max-w-4xl mx-auto mb-12 font-light">
                  Aapka har kaam record pe, har payment ka hisaab safe.
                </p>

                {/* Enhanced Trust Indicators */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                    <div className="text-3xl mb-3">✅</div>
                    <div className="text-lg font-bold text-white mb-2">Complete Solution</div>
                    <div className="text-blue-200 text-sm">End-to-end site management</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                    <div className="text-3xl mb-3">🏆</div>
                    <div className="text-lg font-bold text-white mb-2">Professional Grade</div>
                    <div className="text-blue-200 text-sm">Enterprise-level features</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                    <div className="text-3xl mb-3">🚀</div>
                    <div className="text-lg font-bold text-white mb-2">Trusted by 100+ Sites</div>
                    <div className="text-blue-200 text-sm">Proven track record</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ultra-Modern Final CTA */}
        <div className="text-center">
          <div className="relative inline-block">
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-400 rounded-3xl blur-xl opacity-30 animate-pulse"></div>
            
            {/* Main Button */}
            <button className="group relative bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 text-white px-20 py-10 rounded-3xl font-black hover:from-orange-700 hover:via-red-700 hover:to-pink-700 transition-all duration-700 text-2xl shadow-3xl hover:shadow-orange-500/40 transform hover:-translate-y-4 hover:scale-110 border border-orange-400/30">
              <span className="relative z-10 flex items-center justify-center">
                <span className="text-4xl mr-4 group-hover:animate-bounce">🚀</span>
                <span className="bg-gradient-to-r from-white to-yellow-100 bg-clip-text text-transparent">
                  Abhi Try Karke Dekhiye – Free Demo
                </span>
              </span>
              
              {/* Animated Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-all duration-500"></div>
              
              {/* Ripple Effect */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-orange-400/20 to-red-400/20 opacity-0 group-hover:opacity-100 group-hover:animate-ping transition-all duration-1000"></div>
            </button>
          </div>
          
          {/* Enhanced Trust Indicators */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-lg">
            <div className="flex items-center bg-green-50 px-4 py-2 rounded-full">
              <span className="text-green-500 mr-2">✅</span>
              <span className="text-green-700 font-semibold">No setup required</span>
            </div>
            <div className="flex items-center bg-blue-50 px-4 py-2 rounded-full">
              <span className="text-blue-500 mr-2">⚡</span>
              <span className="text-blue-700 font-semibold">Instant access</span>
            </div>
            <div className="flex items-center bg-purple-50 px-4 py-2 rounded-full">
              <span className="text-purple-500 mr-2">🎯</span>
              <span className="text-purple-700 font-semibold">Real site demo</span>
            </div>
          </div>
          
          {/* Additional Trust Line */}
          <p className="text-gray-500 mt-6 text-lg font-medium">
            Join 100+ contractors who switched to digital site management
          </p>
        </div>
      </div>
    </section>
  );
}