import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { registerEmployee, registerOwner } from '../services/authService';
import { getMyOrganization } from '../services/organizationService';

export const Register = () => {
  const navigate = useNavigate();
  const { login, updateUser } = useAuthStore();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'owner' as 'owner' | 'employee',
    organizationName: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  };

  const validateForm = () => {
    if (!formData.firstName || !formData.lastName) return 'Please enter your name';
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Please enter a valid email address';
    if (formData.password.length < 8) return 'Password must be at least 8 characters';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    if (!formData.organizationName) return 'Please enter your organization name';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (formData.accountType === 'owner') {
        const response = await registerOwner({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          organizationName: formData.organizationName,
        });

        login(response.user, response.tokens);
        
        try {
          const org = await getMyOrganization();
          updateUser({ orgName: org.name });
        } catch (err) {
          console.error('Failed to fetch organization:', err);
        }
        
        navigate('/');
        return;
      }

      await registerEmployee({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        organizationName: formData.organizationName,
      });

      setSuccess('Join request submitted. The organization owner must approve your account before you can log in.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50 px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div>
          <div className="flex justify-center">
            <div className="h-12 w-12 sm:h-16 sm:w-16 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="h-6 w-6 sm:h-8 sm:w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>
          <h2 className="mt-4 sm:mt-6 text-center text-xl sm:text-3xl font-extrabold text-slate-900">Create your account</h2>
        </div>

        <form className="mt-6 sm:mt-8 space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
          {error && <div className="rounded-lg bg-red-50 p-3 sm:p-4 text-xs sm:text-sm text-red-700 border border-red-100">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 p-3 sm:p-4 text-xs sm:text-sm text-emerald-700 border border-emerald-100">{success}</div>}

          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base"
              placeholder="First name"
            />
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base"
              placeholder="Last name"
            />
          </div>

          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base"
            placeholder="you@example.com"
          />

          <input
            type="password"
            required
            value={formData.password}
            onChange={(e) => handleChange('password', e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base"
            placeholder="Password"
          />

          <input
            type="password"
            required
            value={formData.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base"
            placeholder="Confirm password"
          />

          <select
            value={formData.accountType}
            onChange={(e) => handleChange('accountType', e.target.value as 'owner' | 'employee')}
            className="block w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base"
          >
            <option value="owner">I am creating my company account</option>
            <option value="employee">I am joining an existing company</option>
          </select>

          <input
            type="text"
            required
            value={formData.organizationName}
            onChange={(e) => handleChange('organizationName', e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base"
            placeholder="Organization / Company name"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-2.5 sm:py-3 px-3 sm:px-4 border border-transparent text-xs sm:text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 transition-colors"
          >
            {isLoading ? 'Creating account...' : (
              <>
                <span className="hidden sm:inline">Create account</span>
                <span className="sm:hidden">Create</span>
                <ArrowRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
              </>
            )}
          </button>

          <p className="text-center text-xs sm:text-sm text-slate-600">
            Already have an account? <a href="/login" className="text-blue-600">Sign in</a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
