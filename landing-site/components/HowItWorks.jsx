export default function HowItWorks() {
  const steps = [
    {
      number: 1,
      icon: "📱",
      title: "App Install karo",
      description: "Google Play Store se Site Haazri download karein aur account banayein – bilkul free.",
      color: "bg-blue-500",
      bgColor: "bg-blue-50"
    },
    {
      number: 2,
      icon: "👤",
      title: "Supervisor ka account banayein",
      description: "Apne supervisor ko app dein aur uska separate login ID create karein – restricted access ke saath.",
      color: "bg-green-500",
      bgColor: "bg-green-50"
    },
    {
      number: 3,
      icon: "✅",
      title: "Supervisor data update karega",
      description: "Daily attendance, work progress aur site details supervisor phone se update karega – real-time sync.",
      color: "bg-purple-500",
      bgColor: "bg-purple-50"
    },
    {
      number: 4,
      icon: "📊",
      title: "Contractor sab kuch live dekh sakta hai",
      description: "Aapke phone par sab kuch automatically update hoga – reports, payments, attendance sab ready.",
      color: "bg-orange-500",
      bgColor: "bg-orange-50"
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold mb-6">
            🔄 How It Works
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Sirf 4 simple steps mein apka poora site record app mein tayyar!
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Na koi training ki zarurat, na koi confusion – Supervisor aur Contractor dono ke liye asaan.
          </p>
        </div>

        {/* Steps Timeline */}
        <div className="relative mb-16">
          {/* Desktop Timeline */}
          <div className="hidden md:block">
            {/* Connection Line */}
            <div className="absolute top-16 left-0 right-0 h-0.5 bg-gray-300 z-0"></div>
            <div className="absolute top-16 left-0 h-0.5 bg-blue-500 z-10 transition-all duration-1000" style={{width: '100%'}}></div>
            
            <div className="grid grid-cols-4 gap-8 relative z-20">
              {steps.map((step, index) => (
                <div key={index} className="text-center">
                  {/* Step Circle */}
                  <div className="relative mb-6">
                    <div className={`w-16 h-16 ${step.color} text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg`}>
                      {step.number}
                    </div>
                    <div className="text-3xl mb-4">{step.icon}</div>
                  </div>
                  
                  {/* Step Content */}
                  <div className={`${step.bgColor} rounded-xl p-6 border border-gray-200`}>
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{step.title}</h3>
                    <p className="text-gray-700 text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Timeline */}
          <div className="md:hidden space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="relative">
                {/* Vertical Line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-6 top-12 w-0.5 h-16 bg-gray-300"></div>
                )}
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-4">
                    <div className={`w-12 h-12 ${step.color} text-white rounded-full flex items-center justify-center text-lg font-bold shadow-lg`}>
                      {step.number}
                    </div>
                  </div>
                  <div className={`flex-1 ${step.bgColor} rounded-xl p-6 border border-gray-200`}>
                    <div className="text-2xl mb-3">{step.icon}</div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-700 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bonus Security Note */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-2xl p-8 mb-12">
          <div className="flex items-start">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-6 flex-shrink-0">
              <span className="text-2xl">🛡️</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Bonus: Data Security Guarantee
              </h3>
              <p className="text-gray-700 text-lg leading-relaxed mb-2">
                Supervisor data sirf add kar sakta hai, delete/edit ka option nahi hota – taaki record safe rahe.
              </p>
              <p className="text-gray-600">
                Aapka data completely secure rahega aur koi bhi unauthorized changes nahi ho sakti.
              </p>
            </div>
          </div>
        </div>

        {/* Video/Demo Section */}
        <div className="mb-16 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Dekho kaise kaam karta hai
              </h3>
              <p className="text-gray-600">Live demo video - Hindi mein samjhaya gaya hai</p>
            </div>
            
            <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200">
              <div className="aspect-video bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 flex items-center justify-center relative">
                <div className="text-center">
                  <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6 hover:bg-opacity-30 transition-all cursor-pointer">
                    <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-white text-xl font-bold mb-2">Site Haazri Demo Video</p>
                  <p className="text-blue-200 mb-4">3:30 minutes • Hindi explanation</p>
                  <div className="flex items-center justify-center space-x-4 text-blue-200 text-sm">
                    <span>📱 Mobile App Demo</span>
                    <span>•</span>
                    <span>🎯 Real Site Example</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Ready to try it yourself?
            </h3>
          </div>
          
          <button className="bg-orange-600 text-white px-12 py-4 rounded-xl font-bold hover:bg-orange-700 transition-colors text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 mb-4">
            <span className="flex items-center justify-center">
              <span className="mr-2">🚀</span>
              Demo Try Karein – Free!
            </span>
          </button>
          
          <p className="text-gray-600 max-w-2xl mx-auto">
            Ek baar dekh lo kaise kaam karta hai – bina kuch bharein, ek example site pe demo milega.
          </p>
          
          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-sm text-gray-600">
            <div className="flex items-center">
              <span className="text-green-500 mr-1">✅</span>
              No registration required
            </div>
            <div className="flex items-center">
              <span className="text-blue-500 mr-1">⚡</span>
              Instant access
            </div>
            <div className="flex items-center">
              <span className="text-purple-500 mr-1">📱</span>
              Works on any phone
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}