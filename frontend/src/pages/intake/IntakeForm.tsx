import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import type { IntakeFormData, Dependent } from '../../types/intake';
import {
  defaultIntakeFormData,
  FILING_STATUS_OPTIONS,
  FORM_1099_TYPES,
  emptyDependent,
} from '../../types/intake';
import { api } from '../../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { FadeUp } from '../../components/ui/MotionComponents';

const STEPS = [
  'Client Information',
  'Tax Filing Info',
  'Income Sources',
  'Special Questions',
  'Spouse Information',
  'Dependents',
  'Refund Preference',
  'Authorization',
];

type ServiceType = 'personal' | 'business' | null;

export default function IntakeForm() {
  const [searchParams] = useSearchParams();
  const isKioskMode = searchParams.get('mode') === 'kiosk';

  // Service type selection (before form steps)
  // CST-19: Support /intake/personal and /intake/business URL paths
  const location = useLocation();
  const getInitialServiceType = (): ServiceType => {
    const path = location.pathname.toLowerCase();
    if (path.includes('/personal')) return 'personal';
    if (path.includes('/business')) return 'business';
    return null;
  };
  const [serviceType, setServiceType] = useState<ServiceType>(getInitialServiceType);
  
  // Business inquiry form state
  const [businessFormData, setBusinessFormData] = useState({
    name: '',
    email: '',
    phone: '',
    business_name: '',
    message: '',
  });
  const [businessFormSubmitting, setBusinessFormSubmitting] = useState(false);
  const [businessFormSubmitted, setBusinessFormSubmitted] = useState(false);
  const [businessFormError, setBusinessFormError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<IntakeFormData>(defaultIntakeFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Auto-reset for kiosk mode
  const resetForm = useCallback(() => {
    setFormData(defaultIntakeFormData);
    setCurrentStep(0);
    setIsSubmitted(false);
    setErrors({});
    setSubmitError(null);
    setCountdown(null);
    setServiceType(null);
    setBusinessFormData({ name: '', email: '', phone: '', business_name: '', message: '' });
    setBusinessFormSubmitted(false);
    setBusinessFormError(null);
  }, []);

  useEffect(() => {
    if (isSubmitted && isKioskMode && countdown === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountdown(15);
    }
  }, [isSubmitted, isKioskMode, countdown]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetForm();
    }
  }, [countdown, resetForm]);

  useEffect(() => {
    document.title = 'Client Intake Form | Cornerstone Tax';
  }, []);

  const updateField = <K extends keyof IntakeFormData>(
    field: K,
    value: IntakeFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 0: // Client Information
        if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
        if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';
        if (!formData.date_of_birth) newErrors.date_of_birth = 'Date of birth is required';
        if (!formData.email.trim()) newErrors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
          newErrors.email = 'Please enter a valid email';
        if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
        if (!formData.mailing_address.trim())
          newErrors.mailing_address = 'Mailing address is required';
        break;

      case 1: // Tax Filing Info
        if (!formData.filing_status) newErrors.filing_status = 'Filing status is required';
        break;

      case 7: // Authorization
        if (!formData.authorization_confirmed)
          newErrors.authorization_confirmed = 'You must confirm the information is accurate';
        if (!formData.signature.trim()) newErrors.signature = 'Electronic signature is required';
        if (!formData.signature_date) newErrors.signature_date = 'Signature date is required';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      // Skip spouse step if not married
      if (currentStep === 3 && formData.filing_status !== 'married') {
        setCurrentStep(5); // Skip to dependents
      } else {
        setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
      }
    }
  };

  const prevStep = () => {
    // Skip spouse step if not married (going back)
    if (currentStep === 5 && formData.filing_status !== 'married') {
      setCurrentStep(3);
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 0));
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    setSubmitError(null);

    // Transform form data for API
    const submitData = {
      ...formData,
      // Convert W2 employers to income sources
      income_sources: [
        ...formData.w2_employers
          .filter((e) => e.trim())
          .map((employer) => ({
            source_type: 'w2',
            payer_name: employer,
            notes: '',
          })),
        ...formData.form_1099_types.map((type) => ({
          source_type: type,
          payer_name: formData.form_1099_payer_names[type] || '',
          notes: '',
        })),
      ],
    };

    const result = await api.submitIntake(submitData);

    setIsSubmitting(false);

    if (result.error) {
      if (result.errors && result.errors.length > 0) {
        const serverFieldErrors: Record<string, string> = {};
        result.errors.forEach((message) => {
          const normalized = message.toLowerCase();
          if (normalized.includes('signature date')) {
            serverFieldErrors.signature_date = message;
          } else if (normalized.includes('signature')) {
            serverFieldErrors.signature = message;
          } else if (normalized.includes('authorization')) {
            serverFieldErrors.authorization_confirmed = message;
          }
        });
        if (Object.keys(serverFieldErrors).length > 0) {
          setErrors((prev) => ({ ...prev, ...serverFieldErrors }));
        }
      }
      setSubmitError(result.error);
      if (result.errors && result.errors.length > 0) {
        setSubmitError(result.errors.join(', '));
      }
    } else {
      setIsSubmitted(true);
    }
  };

  // Handle business inquiry form submission
  const handleBusinessSubmit = async () => {
    // Validate
    if (!businessFormData.name.trim() || !businessFormData.email.trim() || !businessFormData.phone.trim()) {
      setBusinessFormError('Please fill in all required fields.');
      return;
    }

    setBusinessFormSubmitting(true);
    setBusinessFormError(null);

    // Submit using the contact form API
    const result = await api.submitContact({
      name: businessFormData.name,
      email: businessFormData.email,
      phone: businessFormData.phone,
      subject: `Business Tax Inquiry${businessFormData.business_name ? ` - ${businessFormData.business_name}` : ''}`,
      message: businessFormData.message || 'I would like to schedule a consultation to discuss my business tax needs.',
    });

    setBusinessFormSubmitting(false);

    if (result.error) {
      setBusinessFormError(result.error);
    } else {
      setBusinessFormSubmitted(true);
    }
  };

  // Render service type selection (first screen)
  if (serviceType === null) {
    return (
      <div className="min-h-screen bg-secondary flex flex-col">
        {!isKioskMode && <IntakeHeader />}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <FadeUp><div className="bg-white rounded-2xl shadow-sm p-8 max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                How Can We Help You?
              </h1>
              <p className="text-gray-600">
                Select the type of service you need to get started.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Taxes Card */}
              <button
                onClick={() => setServiceType('personal')}
                className="group bg-white border-2 border-gray-200 hover:border-primary rounded-xl p-6 text-left transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-secondary rounded-xl flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Personal Taxes</h2>
                <p className="text-gray-600 text-sm mb-4">
                  Individual tax returns, W-2s, 1099s, and personal tax planning.
                </p>
                <span className="text-primary font-medium text-sm inline-flex items-center gap-1">
                  Start Online Intake
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>

              {/* Business Taxes Card */}
              <button
                onClick={() => setServiceType('business')}
                className="group bg-white border-2 border-gray-200 hover:border-primary rounded-xl p-6 text-left transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <div className="w-14 h-14 bg-secondary rounded-xl flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Business Taxes</h2>
                <p className="text-gray-600 text-sm mb-4">
                  Business returns, payroll, bookkeeping, and corporate tax services.
                </p>
                <span className="text-primary font-medium text-sm inline-flex items-center gap-1">
                  Schedule a Consultation
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            </div>

            {!isKioskMode && (
              <div className="mt-8 text-center">
                <Link
                  to="/"
                  className="text-gray-500 hover:text-gray-700 text-sm inline-flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Home
                </Link>
              </div>
            )}
          </div></FadeUp>
        </main>
      </div>
    );
  }

  // Render business inquiry form
  if (serviceType === 'business') {
    if (businessFormSubmitted) {
      return (
        <div className="min-h-screen bg-secondary flex flex-col">
          {!isKioskMode && <IntakeHeader />}
          <main className="flex-1 flex items-center justify-center px-4 py-8">
            <FadeUp><div className="bg-white rounded-2xl shadow-sm p-8 max-w-lg w-full text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Received!</h1>
              <p className="text-gray-600 mb-6">
                Thank you for your interest in our business services. We'll contact you within 1-2 business days to schedule your consultation.
              </p>

              {isKioskMode ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    This form will reset in <span className="font-bold text-primary">{countdown}</span> seconds
                  </p>
                  <button
                    onClick={resetForm}
                    className="w-full bg-primary text-white px-6 py-4 rounded-xl font-medium hover:bg-primary-dark transition-colors min-h-[56px]"
                  >
                    Start New Form
                  </button>
                </div>
              ) : (
                <Link
                  to="/"
                  className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary-dark transition-colors"
                >
                  Back to Home
                </Link>
              )}
            </div></FadeUp>
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-secondary flex flex-col">
        {!isKioskMode && <IntakeHeader />}
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 md:py-8">
          <FadeUp><div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
            {/* Back button */}
            <button
              onClick={() => setServiceType(null)}
              className="text-gray-500 hover:text-gray-700 text-sm inline-flex items-center gap-1 mb-6"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Selection
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center text-primary mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Business Tax Consultation</h1>
              <p className="text-gray-600">
                Business taxes require a personalized approach. Fill out the form below and we'll contact you to schedule a consultation.
              </p>
            </div>

            {/* Contact Info */}
            <div className="bg-secondary rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Prefer to call?</strong> Reach us directly:
              </p>
              <p className="text-primary font-medium">
                <a href="tel:+16716499838" className="hover:underline">(671) 649-9838</a>
                {' • '}
                <a href="mailto:dmshimizucpa@gmail.com" className="hover:underline">dmshimizucpa@gmail.com</a>
              </p>
            </div>

            {/* Form */}
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={businessFormData.name}
                    onChange={(e) => setBusinessFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary ${isKioskMode ? 'text-lg' : ''}`}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={businessFormData.business_name}
                    onChange={(e) => setBusinessFormData(prev => ({ ...prev, business_name: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary ${isKioskMode ? 'text-lg' : ''}`}
                    placeholder="ABC Company LLC"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={businessFormData.email}
                    onChange={(e) => setBusinessFormData(prev => ({ ...prev, email: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary ${isKioskMode ? 'text-lg' : ''}`}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={businessFormData.phone}
                    onChange={(e) => setBusinessFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary ${isKioskMode ? 'text-lg' : ''}`}
                    placeholder="(671) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tell us about your business needs
                </label>
                <textarea
                  value={businessFormData.message}
                  onChange={(e) => setBusinessFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary ${isKioskMode ? 'text-lg' : ''}`}
                  placeholder="What type of business do you have? What services are you interested in? (Optional)"
                />
              </div>

              {businessFormError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700">{businessFormError}</p>
                </div>
              )}

              <button
                onClick={handleBusinessSubmit}
                disabled={businessFormSubmitting}
                className={`w-full bg-primary text-white px-6 py-4 rounded-xl font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isKioskMode ? 'min-h-[56px] text-lg' : 'min-h-[48px]'}`}
              >
                {businessFormSubmitting ? 'Submitting...' : 'Request Consultation'}
              </button>
            </div>
          </div></FadeUp>
        </main>
      </div>
    );
  }

  // Render success page (for personal taxes)
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-secondary flex flex-col">
        {!isKioskMode && <IntakeHeader />}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <FadeUp><div className="bg-white rounded-2xl shadow-sm p-8 max-w-lg w-full text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
            <p className="text-gray-600 mb-6">
              Your intake form has been submitted successfully. We'll review your information and contact you soon.
            </p>

            {isKioskMode ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  This form will reset in <span className="font-bold text-primary">{countdown}</span> seconds
                </p>
                <button
                  onClick={resetForm}
                  className="w-full bg-primary text-white px-6 py-4 rounded-xl font-medium hover:bg-primary-dark transition-colors min-h-[56px]"
                >
                  Start New Form
                </button>
              </div>
            ) : (
              <Link
                to="/"
                className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary-dark transition-colors"
              >
                Back to Home
              </Link>
            )}
          </div></FadeUp>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary flex flex-col">
      {!isKioskMode && <IntakeHeader />}

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 md:py-8">
        {/* Back to service selection (only on first step) */}
        {currentStep === 0 && (
          <button
            onClick={() => setServiceType(null)}
            className="text-gray-500 hover:text-gray-700 text-sm inline-flex items-center gap-1 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" aria-hidden="true" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Change Service Type
          </button>
        )}

        {/* Progress Bar */}
        <div className="mb-6 md:mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Step {currentStep + 1} of {STEPS.length}</span>
            <span>Personal Tax Return: {STEPS[currentStep]}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={false}
              animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Form Card */}
        <FadeUp>
        <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight mb-6">
            {STEPS[currentStep]}
          </h2>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              {currentStep === 0 && (
                <StepClientInfo formData={formData} updateField={updateField} errors={errors} isKioskMode={isKioskMode} />
              )}
              {currentStep === 1 && (
                <StepFilingInfo formData={formData} updateField={updateField} errors={errors} isKioskMode={isKioskMode} />
              )}
              {currentStep === 2 && (
                <StepIncomeSources formData={formData} updateField={updateField} isKioskMode={isKioskMode} />
              )}
              {currentStep === 3 && (
                <StepSpecialQuestions formData={formData} updateField={updateField} isKioskMode={isKioskMode} />
              )}
              {currentStep === 4 && (
                <StepSpouseInfo formData={formData} updateField={updateField} isKioskMode={isKioskMode} />
              )}
              {currentStep === 5 && (
                <StepDependents formData={formData} setFormData={setFormData} isKioskMode={isKioskMode} />
              )}
              {currentStep === 6 && (
                <StepRefundPreference formData={formData} updateField={updateField} isKioskMode={isKioskMode} />
              )}
              {currentStep === 7 && (
                <StepAuthorization formData={formData} updateField={updateField} errors={errors} isKioskMode={isKioskMode} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Error Display */}
          {submitError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{submitError}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={prevStep}
                className={`flex-1 sm:flex-none px-6 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-all hover:-translate-y-0.5 active:translate-y-0 ${isKioskMode ? 'min-h-[56px]' : 'min-h-[48px]'}`}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={currentStep === STEPS.length - 1 ? handleSubmit : nextStep}
              disabled={isSubmitting}
              className={`flex-1 px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none ${isKioskMode ? 'min-h-[56px]' : 'min-h-[48px]'}`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </span>
              ) : currentStep === STEPS.length - 1 ? (
                'Submit Form'
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
        </FadeUp>

        {!isKioskMode && (
          <p className="text-center text-sm text-gray-500 mt-6">
            Questions? Call us at{' '}
            <a href="tel:+16714828671" className="text-primary hover:underline">(671) 482-8671</a>
          </p>
        )}
      </main>
    </div>
  );
}

// Header Component
function IntakeHeader() {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
        <Link to="/" className="flex items-center shrink-0">
          <div className="h-14 sm:h-16 overflow-hidden flex items-center">
            <img 
              src="/logo.jpeg" 
              alt="Cornerstone Accounting & Business Management" 
              className="h-28 sm:h-32 w-auto max-w-none object-contain"
            />
          </div>
        </Link>
      </div>
    </header>
  );
}

// Form Field Components
interface InputProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  isKioskMode?: boolean;
}

function FormInput({ label, name, type = 'text', value, onChange, error, required, placeholder, isKioskMode }: InputProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${isKioskMode ? 'text-lg' : ''}`}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

interface TextareaProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
  isKioskMode?: boolean;
}

function FormTextarea({ label, name, value, onChange, error, required, placeholder, rows = 3, isKioskMode }: TextareaProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-colors ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${isKioskMode ? 'text-lg' : ''}`}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

// Step Components
interface StepProps {
  formData: IntakeFormData;
  updateField: <K extends keyof IntakeFormData>(field: K, value: IntakeFormData[K]) => void;
  errors?: Record<string, string>;
  isKioskMode?: boolean;
}

function StepClientInfo({ formData, updateField, errors = {}, isKioskMode }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          label="First Name"
          name="first_name"
          value={formData.first_name}
          onChange={(v) => updateField('first_name', v)}
          error={errors.first_name}
          required
          isKioskMode={isKioskMode}
        />
        <FormInput
          label="Last Name"
          name="last_name"
          value={formData.last_name}
          onChange={(v) => updateField('last_name', v)}
          error={errors.last_name}
          required
          isKioskMode={isKioskMode}
        />
      </div>
      <FormInput
        label="Date of Birth"
        name="date_of_birth"
        type="date"
        value={formData.date_of_birth}
        onChange={(v) => updateField('date_of_birth', v)}
        error={errors.date_of_birth}
        required
        isKioskMode={isKioskMode}
      />
      <FormInput
        label="Email Address"
        name="email"
        type="email"
        value={formData.email}
        onChange={(v) => updateField('email', v)}
        error={errors.email}
        required
        placeholder="you@example.com"
        isKioskMode={isKioskMode}
      />
      <FormInput
        label="Phone Number"
        name="phone"
        type="tel"
        value={formData.phone}
        onChange={(v) => updateField('phone', v)}
        error={errors.phone}
        required
        placeholder="(671) 123-4567"
        isKioskMode={isKioskMode}
      />
      <FormTextarea
        label="Mailing Address"
        name="mailing_address"
        value={formData.mailing_address}
        onChange={(v) => updateField('mailing_address', v)}
        error={errors.mailing_address}
        required
        placeholder="123 Main St, Hagatna, GU 96910"
        isKioskMode={isKioskMode}
      />
    </div>
  );
}

function StepFilingInfo({ formData, updateField, errors = {}, isKioskMode }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Filing Status <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {FILING_STATUS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${
                formData.filing_status === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 hover:bg-gray-50'
              } ${isKioskMode ? 'min-h-[56px]' : ''}`}
            >
              <input
                type="radio"
                name="filing_status"
                value={option.value}
                checked={formData.filing_status === option.value}
                onChange={(e) => updateField('filing_status', e.target.value as IntakeFormData['filing_status'])}
                className="w-5 h-5 text-primary"
              />
              <span className={`ml-3 font-medium ${isKioskMode ? 'text-lg' : ''}`}>{option.label}</span>
            </label>
          ))}
        </div>
        {errors.filing_status && <p className="mt-2 text-sm text-red-500">{errors.filing_status}</p>}
      </div>

      <div className="space-y-3">
        <label className={`flex items-center gap-3 p-4 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 ${isKioskMode ? 'min-h-[56px]' : ''}`}>
          <input
            type="checkbox"
            checked={formData.is_new_client}
            onChange={(e) => updateField('is_new_client', e.target.checked)}
            className="w-5 h-5 rounded text-primary"
          />
          <span className={isKioskMode ? 'text-lg' : ''}>I am a new client</span>
        </label>

        <label className={`flex items-center gap-3 p-4 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 ${isKioskMode ? 'min-h-[56px]' : ''}`}>
          <input
            type="checkbox"
            checked={formData.has_prior_year_return}
            onChange={(e) => updateField('has_prior_year_return', e.target.checked)}
            className="w-5 h-5 rounded text-primary"
          />
          <span className={isKioskMode ? 'text-lg' : ''}>I have a copy of my prior year return</span>
        </label>
      </div>

      <FormTextarea
        label="Any changes from prior year?"
        name="changes_from_prior_year"
        value={formData.changes_from_prior_year}
        onChange={(v) => updateField('changes_from_prior_year', v)}
        placeholder="New job, new dependent, got married, bought a home, etc."
        isKioskMode={isKioskMode}
      />
    </div>
  );
}

function StepIncomeSources({ formData, updateField, isKioskMode }: StepProps) {
  const addW2Employer = () => {
    updateField('w2_employers', [...formData.w2_employers, '']);
  };

  const updateW2Employer = (index: number, value: string) => {
    const updated = [...formData.w2_employers];
    updated[index] = value;
    updateField('w2_employers', updated);
  };

  const removeW2Employer = (index: number) => {
    const updated = formData.w2_employers.filter((_, i) => i !== index);
    updateField('w2_employers', updated.length > 0 ? updated : ['']);
  };

  const toggle1099Type = (type: string) => {
    const current = formData.form_1099_types;
    if (current.includes(type)) {
      updateField('form_1099_types', current.filter((t) => t !== type));
      // Clean up payer name when unchecking
      const updatedNames = { ...formData.form_1099_payer_names };
      delete updatedNames[type];
      updateField('form_1099_payer_names', updatedNames);
    } else {
      updateField('form_1099_types', [...current, type]);
    }
  };

  const updatePayerName = (type: string, name: string) => {
    updateField('form_1099_payer_names', {
      ...formData.form_1099_payer_names,
      [type]: name,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          W-2 Employers (where you worked)
        </label>
        <div className="space-y-2">
          {formData.w2_employers.map((employer, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={employer}
                onChange={(e) => updateW2Employer(index, e.target.value)}
                placeholder="Employer name"
                className={`flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent ${isKioskMode ? 'text-lg' : ''}`}
              />
              {formData.w2_employers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeW2Employer(index)}
                  className="px-3 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addW2Employer}
          className={`mt-2 text-primary font-medium flex items-center gap-1 hover:underline ${isKioskMode ? 'text-lg py-2' : ''}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Another Employer
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Did you receive any of these forms?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FORM_1099_TYPES.map((type) => (
            <label
              key={type.value}
              className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
                formData.form_1099_types.includes(type.value)
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 hover:bg-gray-50'
              } ${isKioskMode ? 'min-h-[56px]' : ''}`}
            >
              <input
                type="checkbox"
                checked={formData.form_1099_types.includes(type.value)}
                onChange={() => toggle1099Type(type.value)}
                className="w-5 h-5 rounded text-primary"
              />
              <span className={isKioskMode ? 'text-lg' : ''}>{type.label}</span>
            </label>
          ))}
        </div>

        {/* Payer name fields for selected 1099 types (CST-1) */}
        {formData.form_1099_types.length > 0 && (
          <div className="mt-4 space-y-3 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm font-medium text-gray-700">
              Please provide the payer name for each selected form:
            </p>
            {formData.form_1099_types.map((type) => {
              const typeLabel = FORM_1099_TYPES.find((t) => t.value === type)?.label || type;
              return (
                <div key={type}>
                  <label className="block text-sm text-gray-600 mb-1">
                    {typeLabel} — Payer Name
                  </label>
                  <input
                    type="text"
                    value={formData.form_1099_payer_names[type] || ''}
                    onChange={(e) => updatePayerName(type, e.target.value)}
                    placeholder="Who paid you? (e.g., Company Name)"
                    className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent ${isKioskMode ? 'text-lg' : ''}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StepSpecialQuestions({ formData, updateField, isKioskMode }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-amber-800 text-sm">
          These questions help us ensure your return is prepared correctly.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Have you ever been denied EIC (Earned Income Credit), ACTC (Additional Child Tax Credit), or HOH (Head of Household) status by the IRS?
        </label>
        <div className="flex gap-4">
          <label className={`flex-1 flex items-center justify-center gap-2 p-4 border rounded-xl cursor-pointer transition-colors ${
            formData.denied_eic_actc ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
          } ${isKioskMode ? 'min-h-[56px]' : ''}`}>
            <input
              type="radio"
              name="denied_eic_actc"
              checked={formData.denied_eic_actc === true}
              onChange={() => updateField('denied_eic_actc', true)}
              className="w-5 h-5 text-primary"
            />
            <span className={isKioskMode ? 'text-lg' : ''}>Yes</span>
          </label>
          <label className={`flex-1 flex items-center justify-center gap-2 p-4 border rounded-xl cursor-pointer transition-colors ${
            formData.denied_eic_actc === false ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
          } ${isKioskMode ? 'min-h-[56px]' : ''}`}>
            <input
              type="radio"
              name="denied_eic_actc"
              checked={formData.denied_eic_actc === false}
              onChange={() => updateField('denied_eic_actc', false)}
              className="w-5 h-5 text-primary"
            />
            <span className={isKioskMode ? 'text-lg' : ''}>No</span>
          </label>
        </div>

        {formData.denied_eic_actc && (
          <div className="mt-4">
            <FormInput
              label="What year?"
              name="denied_eic_actc_year"
              type="number"
              value={formData.denied_eic_actc_year.toString()}
              onChange={(v) => updateField('denied_eic_actc_year', v ? parseInt(v) : '')}
              placeholder="e.g., 2023"
              isKioskMode={isKioskMode}
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Did you receive, sell, exchange, or dispose of any cryptocurrency (Bitcoin, Ethereum, etc.) in {formData.tax_year}?
        </label>
        <div className="flex gap-4">
          <label className={`flex-1 flex items-center justify-center gap-2 p-4 border rounded-xl cursor-pointer transition-colors ${
            formData.has_crypto_transactions ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
          } ${isKioskMode ? 'min-h-[56px]' : ''}`}>
            <input
              type="radio"
              name="has_crypto_transactions"
              checked={formData.has_crypto_transactions === true}
              onChange={() => updateField('has_crypto_transactions', true)}
              className="w-5 h-5 text-primary"
            />
            <span className={isKioskMode ? 'text-lg' : ''}>Yes</span>
          </label>
          <label className={`flex-1 flex items-center justify-center gap-2 p-4 border rounded-xl cursor-pointer transition-colors ${
            formData.has_crypto_transactions === false ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
          } ${isKioskMode ? 'min-h-[56px]' : ''}`}>
            <input
              type="radio"
              name="has_crypto_transactions"
              checked={formData.has_crypto_transactions === false}
              onChange={() => updateField('has_crypto_transactions', false)}
              className="w-5 h-5 text-primary"
            />
            <span className={isKioskMode ? 'text-lg' : ''}>No</span>
          </label>
        </div>
      </div>
    </div>
  );
}

function StepSpouseInfo({ formData, updateField, isKioskMode }: StepProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <p className="text-blue-800 text-sm">
          Since you selected "Married Filing Jointly", please provide your spouse's information.
        </p>
      </div>

      <FormInput
        label="Spouse's Full Name"
        name="spouse_name"
        value={formData.spouse_name}
        onChange={(v) => updateField('spouse_name', v)}
        placeholder="First Last"
        isKioskMode={isKioskMode}
      />

      <FormInput
        label="Spouse's Date of Birth"
        name="spouse_dob"
        type="date"
        value={formData.spouse_dob}
        onChange={(v) => updateField('spouse_dob', v)}
        isKioskMode={isKioskMode}
      />
    </div>
  );
}

interface StepDependentsProps {
  formData: IntakeFormData;
  setFormData: React.Dispatch<React.SetStateAction<IntakeFormData>>;
  isKioskMode?: boolean;
}

function StepDependents({ formData, setFormData, isKioskMode }: StepDependentsProps) {
  const addDependent = () => {
    setFormData((prev) => ({
      ...prev,
      dependents: [...prev.dependents, { ...emptyDependent }],
    }));
  };

  const updateDependent = (index: number, field: keyof Dependent, value: Dependent[keyof Dependent]) => {
    setFormData((prev) => {
      const updated = [...prev.dependents];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, dependents: updated };
    });
  };

  const removeDependent = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      dependents: prev.dependents.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        Add any dependents you want to claim on your tax return.
      </p>

      {formData.dependents.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl">
          <p className="text-gray-500 mb-4">No dependents added yet</p>
          <button
            type="button"
            onClick={addDependent}
            className={`bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-dark transition-colors ${isKioskMode ? 'min-h-[56px] text-lg' : ''}`}
          >
            + Add Dependent
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {formData.dependents.map((dep, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-xl space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Dependent {index + 1}</h4>
                <button
                  type="button"
                  onClick={() => removeDependent(index)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  label="Full Name"
                  name={`dep_name_${index}`}
                  value={dep.name}
                  onChange={(v) => updateDependent(index, 'name', v)}
                  isKioskMode={isKioskMode}
                />
                <FormInput
                  label="Date of Birth"
                  name={`dep_dob_${index}`}
                  type="date"
                  value={dep.date_of_birth}
                  onChange={(v) => updateDependent(index, 'date_of_birth', v)}
                  isKioskMode={isKioskMode}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  label="Relationship"
                  name={`dep_relationship_${index}`}
                  value={dep.relationship}
                  onChange={(v) => updateDependent(index, 'relationship', v)}
                  placeholder="e.g., Son, Daughter, etc."
                  isKioskMode={isKioskMode}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Months lived with you (0-12)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={dep.months_lived_with_client}
                    onChange={(e) => updateDependent(index, 'months_lived_with_client', e.target.value ? parseInt(e.target.value) : '')}
                    className={`w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent ${isKioskMode ? 'text-lg' : ''}`}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dep.is_student}
                    onChange={(e) => updateDependent(index, 'is_student', e.target.checked)}
                    className="w-5 h-5 rounded text-primary"
                  />
                  <span>Full-time student</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dep.is_disabled}
                    onChange={(e) => updateDependent(index, 'is_disabled', e.target.checked)}
                    className="w-5 h-5 rounded text-primary"
                  />
                  <span>Disabled</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dep.can_be_claimed_by_other}
                    onChange={(e) => updateDependent(index, 'can_be_claimed_by_other', e.target.checked)}
                    className="w-5 h-5 rounded text-primary"
                  />
                  <span>Can be claimed by another</span>
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addDependent}
            className={`w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 font-medium hover:border-primary hover:text-primary transition-colors ${isKioskMode ? 'min-h-[56px] text-lg' : ''}`}
          >
            + Add Another Dependent
          </button>
        </div>
      )}
    </div>
  );
}

function StepRefundPreference({ formData, updateField, isKioskMode }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          How would you like to receive your refund?
        </label>
        <div className="space-y-2">
          <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${
            !formData.wants_direct_deposit ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
          } ${isKioskMode ? 'min-h-[56px]' : ''}`}>
            <input
              type="radio"
              name="refund_method"
              checked={!formData.wants_direct_deposit}
              onChange={() => updateField('wants_direct_deposit', false)}
              className="w-5 h-5 text-primary"
            />
            <span className={`ml-3 ${isKioskMode ? 'text-lg' : ''}`}>Paper Check</span>
          </label>
          <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${
            formData.wants_direct_deposit ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
          } ${isKioskMode ? 'min-h-[56px]' : ''}`}>
            <input
              type="radio"
              name="refund_method"
              checked={formData.wants_direct_deposit}
              onChange={() => updateField('wants_direct_deposit', true)}
              className="w-5 h-5 text-primary"
            />
            <span className={`ml-3 ${isKioskMode ? 'text-lg' : ''}`}>Direct Deposit (faster)</span>
          </label>
        </div>
      </div>

      {formData.wants_direct_deposit && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
          <p className="text-sm text-gray-600">
            Please enter your bank account information for direct deposit. This information is encrypted and secure.
          </p>

          <FormInput
            label="Bank Routing Number"
            name="bank_routing_number"
            value={formData.bank_routing_number}
            onChange={(v) => updateField('bank_routing_number', v)}
            placeholder="9-digit routing number"
            isKioskMode={isKioskMode}
          />

          <FormInput
            label="Bank Account Number"
            name="bank_account_number"
            value={formData.bank_account_number}
            onChange={(v) => updateField('bank_account_number', v)}
            placeholder="Your account number"
            isKioskMode={isKioskMode}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Type
            </label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center gap-2 p-4 border rounded-xl cursor-pointer transition-colors ${
                formData.bank_account_type === 'checking' ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
              } ${isKioskMode ? 'min-h-[56px]' : ''}`}>
                <input
                  type="radio"
                  name="bank_account_type"
                  checked={formData.bank_account_type === 'checking'}
                  onChange={() => updateField('bank_account_type', 'checking')}
                  className="w-5 h-5 text-primary"
                />
                <span className={isKioskMode ? 'text-lg' : ''}>Checking</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 p-4 border rounded-xl cursor-pointer transition-colors ${
                formData.bank_account_type === 'savings' ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
              } ${isKioskMode ? 'min-h-[56px]' : ''}`}>
                <input
                  type="radio"
                  name="bank_account_type"
                  checked={formData.bank_account_type === 'savings'}
                  onChange={() => updateField('bank_account_type', 'savings')}
                  className="w-5 h-5 text-primary"
                />
                <span className={isKioskMode ? 'text-lg' : ''}>Savings</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepAuthorization({ formData, updateField, errors = {}, isKioskMode }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-50 rounded-xl">
        <h3 className="font-medium text-gray-900 mb-2">Authorization Agreement</h3>
        <p className="text-sm text-gray-600">
          By signing below, I confirm that the information provided in this intake form is true, accurate, and complete to the best of my knowledge. I authorize Cornerstone Accounting & Business Services to prepare my tax return based on this information.
        </p>
      </div>

      <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition-colors ${
        formData.authorization_confirmed ? 'border-primary bg-primary/5' : 'border-gray-300 hover:bg-gray-50'
      } ${errors.authorization_confirmed ? 'border-red-500' : ''}`}>
        <input
          type="checkbox"
          checked={formData.authorization_confirmed}
          onChange={(e) => updateField('authorization_confirmed', e.target.checked)}
          className="w-6 h-6 mt-0.5 rounded text-primary"
        />
        <span className={isKioskMode ? 'text-lg' : ''}>
          I confirm that the information I have provided is accurate and complete <span className="text-red-500">*</span>
        </span>
      </label>
      {errors.authorization_confirmed && (
        <p className="text-sm text-red-500">{errors.authorization_confirmed}</p>
      )}

      <FormInput
        label="Electronic Signature (Type your full name)"
        name="signature"
        value={formData.signature}
        onChange={(v) => updateField('signature', v)}
        error={errors.signature}
        required
        placeholder="John Doe"
        isKioskMode={isKioskMode}
      />

      <FormInput
        label="Date"
        name="signature_date"
        type="date"
        value={formData.signature_date}
        onChange={(v) => updateField('signature_date', v)}
        error={errors.signature_date}
        required
        isKioskMode={isKioskMode}
      />
    </div>
  );
}
