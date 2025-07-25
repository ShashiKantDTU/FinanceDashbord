export default function DemoSection() {
  return (
    <section className="py-20 bg-blue-900 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Live Demo - Dekho Kaise Kaam Karta Hai
          </h2>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            2 minute mein attendance mark hota hai aur report ready ho jati hai.
          </p>
        </div>
        
        <div className="mb-12">
          <div className="bg-white rounded-2xl overflow-hidden shadow-xl">
            <div className="aspect-video bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-opacity-30 transition-all">
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-white text-xl font-bold mb-2">Site Haazri Demo</p>
                <p className="text-blue-200">3 minutes • Hindi explanation</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="text-center bg-blue-800 rounded-xl p-6">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-bold mb-2">Quick Setup</h3>
            <p className="text-blue-200 text-sm">2 minute setup</p>
          </div>
          <div className="text-center bg-blue-800 rounded-xl p-6">
            <div className="text-3xl mb-3">👨‍🏫</div>
            <h3 className="font-bold mb-2">Easy Training</h3>
            <p className="text-blue-200 text-sm">No tech knowledge needed</p>
          </div>
          <div className="text-center bg-blue-800 rounded-xl p-6">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-bold mb-2">Instant Reports</h3>
            <p className="text-blue-200 text-sm">1-click PDF reports</p>
          </div>
        </div>
        
        <div className="text-center">
          <button className="bg-orange-600 text-white px-10 py-4 rounded-xl font-bold hover:bg-orange-700 transition-colors text-lg shadow-lg">
            <span className="mr-2">🚀</span>
            Free Demo Try Karein
          </button>
          <p className="text-blue-200 text-sm mt-4">
            No registration required • Instant access • Hindi support
          </p>
        </div>
      </div>
    </section>
  );
}