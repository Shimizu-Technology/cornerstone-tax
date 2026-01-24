import { Link } from 'react-router-dom'

const values = [
  {
    name: 'Integrity',
    description: 'We operate with honesty and transparency in everything we do, building trust through ethical practices.',
  },
  {
    name: 'Accuracy',
    description: 'Precision matters. We take pride in delivering meticulous work you can rely on.',
  },
  {
    name: 'Client Partnership',
    description: 'Your success is our success. We work alongside you as a true partner in your financial journey.',
  },
  {
    name: 'Responsiveness',
    description: 'We understand time is valuable. Expect prompt, attentive service whenever you need us.',
  },
  {
    name: 'Education',
    description: 'We empower our clients with knowledge, helping them understand their finances and make informed decisions.',
  },
]

export default function About() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-secondary to-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">About Us</h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed">
              Cornerstone Accounting is an accounting firm dedicated to helping individuals and businesses build strong financial foundations.
            </p>
            <p className="mt-4 text-base text-primary font-medium">
              Based in Guam. Built on integrity, accuracy, and trust.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">What We Do</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  We provide income tax preparation, accounting, consulting, and payroll services, with a focus on clarity, accuracy, and dependable guidance. Our goal is to support confident decision-making and long-term financial success.
                </p>
                <p>
                  We go beyond compliance to meet our clients where they are, whether they're starting a business, growing operations, or navigating complex financial and tax matters.
                </p>
                <p>
                  At Cornerstone, we believe accounting is more than numbers—it's about people, goals, and informed decisions.
                </p>
              </div>
            </div>
            <div className="bg-secondary rounded-2xl p-8">
              <div className="text-center">
                <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-3xl">DS</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Dafne Shimizu, CPA</h3>
                <p className="text-primary font-medium">Founder & Owner</p>
                <div className="text-gray-600 mt-4 text-sm leading-relaxed space-y-3 text-left">
                  <p>
                    Dafne Shimizu is a U.S.-licensed CPA born and raised on Guam. A proud Triton, she earned her bachelor's degree in Accounting and her master's degree in Public Administration.
                  </p>
                  <p>
                    With over 30 years of accounting experience, including managerial and executive leadership, Dafne brings thoughtful, dependable guidance to every client relationship.
                  </p>
                  <p>
                    Raised in the village of Merizo, her values were shaped by her parents, Felix and Dot Mansapit, who instilled the importance of hard work, education, and integrity.
                  </p>
                  <p className="italic">
                    At the core of her work is a simple belief: accounting should support people, not overwhelm them.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Our Mission</h3>
              <p className="text-gray-600 leading-relaxed">
                We are a family-operated firm based in Guam, established by Dafne Shimizu, U.S.-licensed CPA, with a mission to provide dependable, high-quality accounting services that bring clarity, confidence, and peace of mind to our clients.
              </p>
            </div>
            <div className="bg-white rounded-xl p-8 shadow-sm">
              <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Our Vision</h3>
              <p className="text-gray-600 leading-relaxed">
                To be a trusted cornerstone for individuals and businesses—recognized for excellence, integrity, and meaningful client relationships.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Our Core Values</h2>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
              These values shape how we work and how we serve our community.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((value, index) => (
              <div
                key={value.name}
                className={`bg-white border border-gray-200 rounded-xl p-6 ${
                  index === values.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <h3 className="text-lg font-semibold text-primary mb-2">{value.name}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-secondary py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Ready to Work Together?</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            We'd love to learn more about your needs and how we can help you achieve your financial goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/contact"
              className="bg-primary text-white px-6 py-3 rounded-lg text-base font-medium hover:bg-primary-dark transition-colors min-h-[48px] flex items-center justify-center"
            >
              Contact Us
            </Link>
            <Link
              to="/services"
              className="bg-white text-primary border-2 border-primary px-6 py-3 rounded-lg text-base font-medium hover:bg-gray-50 transition-colors min-h-[48px] flex items-center justify-center"
            >
              View Our Services
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
