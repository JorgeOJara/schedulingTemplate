import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Settings, Check } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const CreateBusiness = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuthStore();
  const [formData, setFormData] = useState({
    businessName: '',
    address: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError('');

      if (!formData.businessName) {
        setError('Please fill in business name');
        setIsLoading(false);
        return;
      }

      const orgId = 'org-' + Date.now().toString(36);
      
      if (user) {
        updateUser({ orgId });
      }

      setTimeout(() => {
        setSuccess(true);
        setTimeout(() => {
          navigate('/');
        }, 1500);
      }, 1000);
    } catch (err) {
      setError('Failed to create business profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50 px-4 py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6">
            <Check className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">Organization Created!</h2>
          <p className="text-sm sm:text-lg text-slate-600">You can now manage employees and schedules</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-emerald-50 px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 rounded-xl sm:rounded-2xl mb-4 sm:mb-6">
            <Settings className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" />
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900">Create Organization</h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-600">
            Set up your organization profile to开始 managing employees and schedules
          </p>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl p-6 sm:p-8">
          <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 p-3 sm:p-4 text-xs sm:text-sm text-red-700 border border-red-100">
                {error}
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                  className="block w-full rounded-lg border border-slate-300 px-3 sm:px-4 py-2.5 sm:py-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm text-sm sm:text-base"
                  placeholder="e.g., Acme Corp"
                />
              </div>
            </div>

            <div className="pt-3 sm:pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2.5 sm:py-3 px-3 sm:px-4 border border-transparent text-xs sm:text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <span className="hidden sm:inline">Create Organization</span>
                    <span className="sm:hidden">Create</span>
                    <Settings className="ml-2 h-3 w-3 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateBusiness;
