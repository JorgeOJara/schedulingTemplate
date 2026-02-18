import { useNavigate } from 'react-router';

const ShiftSwapDetail = () => {
  const navigate = useNavigate();
  const swapId = new URLSearchParams(window.location.search).get('id');

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Shift Swap Detail</h1>
        <button
          onClick={() => navigate(-1)}
          className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
        >
          Back
        </button>
      </div>

      {swapId ? (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <p className="text-sm sm:text-base text-slate-600">Loading shift swap details...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 text-center">
          <p className="text-sm sm:text-base text-slate-600">No shift swap ID specified</p>
        </div>
      )}
    </div>
  );
};

export default ShiftSwapDetail;
