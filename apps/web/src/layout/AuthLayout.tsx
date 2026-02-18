import { Outlet, Routes, Route } from 'react-router';
import Login from '../pages/Login';
import Register from '../pages/Register';
import AcceptInvite from '../pages/AcceptInvite';

export const AuthLayout = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="*" element={<Login />} />
      </Routes>
    </div>
  );
};

export default AuthLayout;
