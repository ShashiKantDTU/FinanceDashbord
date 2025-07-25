export default function ProblemSolution() {
  const problems = [
    {
      icon: "📋",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      title: "Attendance Register gum ho jaye toh?",
      description: "Manual register sambhalna mushkil hai, data har waqt risk mein hota hai.",
      severity: "high"
    },
    {
      icon: "📞",
      iconBg: "bg-orange-100", 
      iconColor: "text-orange-600",
      title: "Attendance ya payment update lena padta hai?",
      description: "Supervisor se har baar call karna padta hai – time bhi lagta hai aur galti ka chance bhi hota hai.",
      severity: "medium"
    },
    {
      icon: "⏰",
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600", 
      title: "Manual calculation mein time barbaad hota hai",
      description: "Mahine ke end mein attendance jodna aur payment nikalna kaafi tedious kaam hota hai.",
      severity: "medium"
    }
  ];

  const benefits = [
    {
      icon: "📱",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      title: "Supervisor Data Entry System",
      description: "Supervisor apne phone se attendance aur site details dalega, sab kuch real-time sync hoga.",
      badge: "Real-time"
    },
    {
      icon: "🔒",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      title: "Limited Access Supervisor Login", 
      description: "Supervisor sirf data add kar sakta hai – edit/delete ka option nahi milega.",
      badge: "Secure"
    },
    {
      icon: "📊",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      title: "Automatic Monthly Reports",
      description: "Attendance aur kaam ke basis par app monthly report khud generate karega.",
      badge: "Automated"
    },
    {
      icon: "💰",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      title: "Labour Payment Auto Calculation",
      description: "Har mahine kis labour ko kitna paisa dena hai – app khud jod kar bata dega.",
      badge: "Smart"
    },
    {
      icon: "🛡️",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      title: "Secure & Transparent System",
      description: "Har entry safe hai. Supervisor ke paas restricted access hai – data manipulation ka risk nahi.",
      badge: "Protected"
    }
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-orange-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold mb-6">
            🚀 Smart Solution for Smart Contractors
          </div>
          <h2 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent mb-8 leading-tight">
            Roz ke Site ke Jhanjhat,<br />
            <span className="text-orange-600">Ab Sirf Ek App se Hal!</span>
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            Contractor aur Supervisor dono ke kaam ab smart tareeke se honge.
          </p>
        </div>

        {/* Problems Section - Modern Card Layout */}
        <div className="mb-24">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">⚠️ Ye Problems Har Din Face Karte Hain</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {problems.map((problem, index) => (
              <div key={index} className="group relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-red-200 transform hover:-translate-y-2">
                <div className="absolute top-4 right-4">
                  <div className={`w-3 h-3 rounded-full ${problem.severity === 'high' ? 'bg-red-500' : problem.severity === 'medium' ? 'bg-orange-500' : 'bg-yellow-500'} animate-pulse`}></div>
                </div>
                <div className={`w-16 h-16 ${problem.iconBg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <span className={`text-2xl ${problem.iconColor}`}>{problem.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4 leading-tight group-hover:text-red-600 transition-colors">
                  {problem.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">{problem.description}</p>
                <div className="mt-6 flex items-center text-sm text-red-500 font-medium">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                  Daily Problem
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bridge Statement - Modern Design */}
        <div className="text-center mb-24">
          <div className="relative">
            <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white py-16 px-12 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-transparent"></div>
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-16 -translate-x-16"></div>
              <div className="relative z-10">
                <div className="text-6xl mb-6">💡</div>
                <h3 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                  "Supervisor ko app do, woh data dalega –<br />
                  <span className="text-yellow-300">aapke phone par sab auto-update hoga!"</span>
                </h3>
                <div className="w-24 h-1 bg-yellow-300 mx-auto rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Section - Modern Grid */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">✅ Site Haazri: Smart Solutions</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="group bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-green-300 transform hover:-translate-y-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-100 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`w-16 h-16 ${benefit.iconBg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <span className={`text-2xl ${benefit.iconColor}`}>{benefit.icon}</span>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                      {benefit.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-green-600 transition-colors">
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed mb-4">{benefit.description}</p>
                  <div className="flex items-center text-sm text-green-600 font-medium">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Smart Feature
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Highlight - Modern Card */}
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 rounded-3xl p-10 md:p-12 mb-16 border border-amber-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-orange-200/30 to-transparent rounded-full -translate-y-20 translate-x-20"></div>
          <div className="relative z-10 flex items-start">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-2xl flex items-center justify-center mr-8 flex-shrink-0 shadow-lg">
              <span className="text-3xl">⭐</span>
            </div>
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">
                "Supervisor ke liye alag login banaiye. Aap kaam unhe dijiye, bas phone par data check kijiye."
              </h3>
              <p className="text-xl text-gray-700 leading-relaxed mb-4">
                Simple delegation, accurate results – bina confusion ke, bina phone call ke.
              </p>
              <div className="flex items-center text-orange-600 font-semibold">
                <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                Key Feature
              </div>
            </div>
          </div>
        </div>

        {/* Trust Note - Modern Q&A */}
        <div className="bg-white rounded-3xl p-10 md:p-12 mb-20 shadow-xl border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-100/50 to-transparent rounded-full -translate-y-16 -translate-x-16"></div>
          <div className="relative z-10">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-800">🤔 Common Concern</h3>
            </div>
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-600 font-bold">Q</span>
                </div>
                <div>
                  <span className="inline-block bg-orange-100 text-orange-800 px-4 py-2 rounded-xl font-bold text-lg mb-2">
                    Concern
                  </span>
                  <p className="text-lg text-gray-800">
                    "Agar supervisor data galat bhar de ya baad mein change kare?"
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-green-600 font-bold">A</span>
                </div>
                <div>
                  <span className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-xl font-bold text-lg mb-2">
                    Answer
                  </span>
                  <p className="text-lg text-gray-800">
                    Supervisor sirf naye entries dal sakte hain. Koi bhi purana data edit ya delete nahi kar sakta. Har entry secure aur traceable hoti hai.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA - Modern Button */}
        <div className="text-center">
          <button className="group relative bg-gradient-to-r from-orange-600 via-orange-700 to-red-600 text-white px-16 py-8 rounded-2xl font-bold hover:from-orange-700 hover:via-orange-800 hover:to-red-700 transition-all duration-500 text-2xl shadow-2xl hover:shadow-orange-500/25 transform hover:-translate-y-2 hover:scale-105">
            <span className="relative z-10 flex items-center justify-center">
              <span className="mr-3">🚀</span>
              Demo Dekhiye – Kaise Kaam Karta Hai Site Haazri
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
          <p className="text-gray-600 mt-4 text-lg">Free demo • No credit card required</p>
        </div>
      </div>
    </section>
  );
}